package claude_test

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/claude"
	"github.com/guilhermt/myspec/internal/claude/claudetest"
)

// sessionID is the id the app picks for the session under test.
const sessionID = "3f2b0c62-9b16-4d5c-9a1b-6c9b2c1d0e4f"

// eventTimeout is how long a test waits for the fake CLI to say something.
const eventTimeout = 10 * time.Second

// argvReporter is a stand-in CLI that reports its command line and exits.
const argvReporter = `#!/bin/sh
for arg in "$@"; do printf '%s\n' "$arg" >&2; done
`

// discardLog is the logger the driver writes its debug lines to.
func discardLog() *slog.Logger {
	return slog.New(slog.DiscardHandler)
}

// fakeConfig runs this test binary as the fake CLI playing one scenario.
func fakeConfig(t *testing.T, scenario string) claude.Config {
	t.Helper()

	return claude.Config{
		Binary:    os.Args[0],
		Dir:       t.TempDir(),
		SessionID: sessionID,
		Model:     "claude-opus-5",
		Effort:    "high",
		Env: append(os.Environ(),
			claudetest.EnvFlag+"=1",
			claudetest.EnvScenario+"="+scenario,
		),
	}
}

// start launches a process and kills whatever is left of it when the test ends.
func start(t *testing.T, cfg claude.Config) *claude.Process {
	t.Helper()

	p, err := claude.Start(t.Context(), cfg, discardLog())
	if err != nil {
		t.Fatalf("Start() = %v, want nil", err)
	}
	t.Cleanup(func() {
		if err := p.Kill(); err != nil {
			t.Errorf("Kill() = %v, want nil", err)
		}
	})
	return p
}

// send writes a user message, failing the test when the CLI refuses it.
func send(t *testing.T, p *claude.Process, text string) {
	t.Helper()

	if err := p.Send(text); err != nil {
		t.Fatalf("Send(%q) = %v, want nil", text, err)
	}
}

// nextEvent reads events until one matches, failing the test when the stream
// ends or the deadline passes first.
func nextEvent(t *testing.T, p *claude.Process, want string, match func(claude.Event) bool) claude.Event {
	t.Helper()

	deadline := time.After(eventTimeout)
	for {
		select {
		case event, ok := <-p.Events():
			if !ok {
				t.Fatalf("the event stream ended before %s", want)
			}
			if match(event) {
				return event
			}
		case <-deadline:
			t.Fatalf("no %s within %s", want, eventTimeout)
		}
	}
}

// turn reads a whole turn, up to and including the result that closes it.
func turn(t *testing.T, p *claude.Process) []claude.Event {
	t.Helper()

	var events []claude.Event
	for {
		event := nextEvent(t, p, "the result of the turn", func(claude.Event) bool { return true })
		events = append(events, event)
		if event.Result != nil {
			return events
		}
	}
}

// exitOf reads what is left of the stream and reports how the process ended.
func exitOf(t *testing.T, p *claude.Process) claude.ExitInfo {
	t.Helper()

	exited := make(chan claude.ExitInfo, 1)
	go func() {
		// The events left are of no interest, but the reader has to reach the
		// end of the stream before the exit status is known.
		for range p.Events() {
			continue
		}
		exited <- p.Wait()
	}()

	select {
	case exit := <-exited:
		return exit
	case <-time.After(eventTimeout):
		t.Fatalf("the process did not exit within %s", eventTimeout)
		return claude.ExitInfo{}
	}
}

// isInit matches the event that opens a turn.
func isInit(event claude.Event) bool { return event.Init != nil }

// isControlRequest matches a question the CLI asks the app.
func isControlRequest(event claude.Event) bool { return event.ControlRequest != nil }

// isTextDelta matches a piece of streamed text.
func isTextDelta(event claude.Event) bool {
	return event.Stream != nil &&
		event.Stream.Event.Delta != nil &&
		event.Stream.Event.Delta.Type == "text_delta"
}

// streamedText joins the text deltas of a turn, as the conversation renders it.
func streamedText(events []claude.Event) string {
	var text strings.Builder
	for _, event := range events {
		if isTextDelta(event) {
			text.WriteString(event.Stream.Event.Delta.Text)
		}
	}
	return text.String()
}

// finalText joins the text of the authoritative assistant blocks of a turn.
func finalText(events []claude.Event) string {
	var text strings.Builder
	for _, message := range assistants(events) {
		for _, block := range message.Message.Content {
			if block.Type == "text" {
				text.WriteString(block.Text)
			}
		}
	}
	return text.String()
}

// toolResults collects what the tools of a turn returned to the agent.
func toolResults(events []claude.Event) []claude.ToolResult {
	var collected []claude.ToolResult
	for _, message := range users(events) {
		collected = append(collected, message.ToolResults()...)
	}
	return collected
}

// reporterBinary writes the stand-in CLI that reports its command line.
func reporterBinary(t *testing.T) string {
	t.Helper()

	path := filepath.Join(t.TempDir(), "argv")
	if err := os.WriteFile(path, []byte(argvReporter), 0o700); err != nil {
		t.Fatalf("WriteFile(%s) = %v, want nil", path, err)
	}
	return path
}

func TestStartRunsTheCLIWithTheFixedFlags(t *testing.T) {
	t.Parallel()

	tests := map[string]struct {
		resume bool
		want   []string
	}{
		"a new session": {want: append(slices.Clone(claude.Args),
			"--session-id", sessionID, "--model", "claude-opus-5", "--effort", "high")},
		"a resumed session": {resume: true, want: append(slices.Clone(claude.Args),
			"--resume", sessionID, "--model", "claude-opus-5", "--effort", "high")},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			p := start(t, claude.Config{
				Binary:    reporterBinary(t),
				Dir:       t.TempDir(),
				SessionID: sessionID,
				Resume:    tc.resume,
				Model:     "claude-opus-5",
				Effort:    "high",
			})

			exit := exitOf(t, p)
			if exit.Code != 0 {
				t.Fatalf("exit code = %d, want 0", exit.Code)
			}
			got := strings.Split(strings.TrimRight(exit.Stderr, "\n"), "\n")
			if diff := cmp.Diff(tc.want, got); diff != "" {
				t.Errorf("command line mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestStartOpensEveryExtraDirectory(t *testing.T) {
	t.Parallel()

	p := start(t, claude.Config{
		Binary:    reporterBinary(t),
		Dir:       t.TempDir(),
		SessionID: sessionID,
		Model:     "claude-opus-5",
		Effort:    "high",
		ExtraDirs: []string{"/clones/acme/api", "/clones/acme/web"},
	})

	exit := exitOf(t, p)
	if exit.Code != 0 {
		t.Fatalf("exit code = %d, want 0", exit.Code)
	}
	want := append(slices.Clone(claude.Args),
		"--session-id", sessionID, "--model", "claude-opus-5", "--effort", "high",
		"--add-dir", "/clones/acme/api", "--add-dir", "/clones/acme/web")
	got := strings.Split(strings.TrimRight(exit.Stderr, "\n"), "\n")
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("command line mismatch (-want +got):\n%s", diff)
	}
}

func TestStartLeavesTheEffortOutForAModelThatTakesNone(t *testing.T) {
	t.Parallel()

	p := start(t, claude.Config{
		Binary:    reporterBinary(t),
		Dir:       t.TempDir(),
		SessionID: sessionID,
		Model:     "claude-haiku-4-5-20251001",
	})

	exit := exitOf(t, p)
	if exit.Code != 0 {
		t.Fatalf("exit code = %d, want 0", exit.Code)
	}
	want := append(slices.Clone(claude.Args),
		"--session-id", sessionID, "--model", "claude-haiku-4-5-20251001")
	got := strings.Split(strings.TrimRight(exit.Stderr, "\n"), "\n")
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("command line mismatch (-want +got):\n%s", diff)
	}
}

func TestTheFakeRefusesAProcessWithoutAModel(t *testing.T) {
	t.Parallel()

	cfg := fakeConfig(t, "echo")
	cfg.Model = ""
	// The fake reads its command line before its input, so the process ends
	// without a message ever being sent.
	exit := exitOf(t, start(t, cfg))

	if exit.Code != 64 {
		t.Errorf("Code = %d, want 64 for a command line the CLI refuses", exit.Code)
	}
	if want := "--model is required"; !strings.Contains(exit.Stderr, want) {
		t.Errorf("Stderr = %q, want it to contain %q", exit.Stderr, want)
	}
}

func TestStartStreamsAWholeTurn(t *testing.T) {
	t.Parallel()
	cfg := fakeConfig(t, "echo")
	p := start(t, cfg)

	send(t, p, "hello there again")
	events := turn(t, p)

	opened := inits(events)
	if len(opened) != 1 {
		t.Fatalf("init events = %d, want 1", len(opened))
	}
	if opened[0].SessionID != cfg.SessionID {
		t.Errorf("SessionID = %q, want %q", opened[0].SessionID, cfg.SessionID)
	}
	if opened[0].CWD != cfg.Dir {
		t.Errorf("CWD = %q, want %q", opened[0].CWD, cfg.Dir)
	}
	if opened[0].Model != claudetest.Model {
		t.Errorf("Model = %q, want %q", opened[0].Model, claudetest.Model)
	}
	if diff := cmp.Diff(claudetest.Capabilities, opened[0].Capabilities); diff != "" {
		t.Errorf("Capabilities mismatch (-want +got):\n%s", diff)
	}

	if got := streamedText(events); got != "hello there again" {
		t.Errorf("streamed text = %q, want the message back", got)
	}
	if got := finalText(events); got != "hello there again" {
		t.Errorf("assistant text = %q, want the message back", got)
	}

	types := streamTypes(events)
	for _, want := range []string{"message_start", "content_block_start", "content_block_stop", "message_delta", "message_stop"} {
		if types[want] != 1 {
			t.Errorf("%s events = %d, want 1", want, types[want])
		}
	}
	if types["content_block_delta"] != 3 {
		t.Errorf("content_block_delta events = %d, want the 3 pieces the text was cut into", types["content_block_delta"])
	}

	closing := results(events)
	if len(closing) != 1 {
		t.Fatalf("result events = %d, want 1", len(closing))
	}
	if closing[0].Subtype != "success" || closing[0].IsError {
		t.Errorf("result = %q, is_error = %v, want success and false", closing[0].Subtype, closing[0].IsError)
	}
	if got := closing[0].ContextWindow(); got != claudetest.ContextWindow {
		t.Errorf("ContextWindow() = %d, want %d", got, claudetest.ContextWindow)
	}
	if got := closing[0].Usage.ContextTokens(); got == 0 {
		t.Error("ContextTokens() = 0, want the tokens of the turn")
	}
}

func TestStartStreamsAToolUseAndItsResult(t *testing.T) {
	t.Parallel()
	p := start(t, fakeConfig(t, "tool"))

	send(t, p, "read the file")
	events := turn(t, p)

	var used *claude.ContentBlock
	for _, message := range assistants(events) {
		for i, block := range message.Message.Content {
			if block.Type == "tool_use" {
				used = &message.Message.Content[i]
			}
		}
	}
	if used == nil {
		t.Fatal("no tool_use block, want the file the CLI read")
	}
	if used.Name != "Read" || used.ID == "" {
		t.Errorf("tool = %q with id %q, want Read with an id", used.Name, used.ID)
	}
	var input struct {
		FilePath string `json:"file_path"`
	}
	if err := json.Unmarshal(used.Input, &input); err != nil {
		t.Fatalf("decode the tool input = %v, want nil", err)
	}
	if input.FilePath != claudetest.ReadPath {
		t.Errorf("file_path = %q, want %q", input.FilePath, claudetest.ReadPath)
	}

	answered := toolResults(events)
	if len(answered) != 1 {
		t.Fatalf("tool results = %d, want 1", len(answered))
	}
	if answered[0].ToolUseID != used.ID {
		t.Errorf("tool result of %q, want the result of %q", answered[0].ToolUseID, used.ID)
	}
	if got := finalText(events); got != "read the file" {
		t.Errorf("assistant text = %q, want the message back", got)
	}
}

func TestStartReportsACompactedConversation(t *testing.T) {
	t.Parallel()
	p := start(t, fakeConfig(t, "compact"))

	send(t, p, "carry on")
	events := turn(t, p)

	var compacted *claude.CompactBoundaryEvent
	for _, event := range events {
		if event.CompactBoundary != nil {
			compacted = event.CompactBoundary
		}
	}
	if compacted == nil {
		t.Fatal("no compact_boundary event, want the point where the context was compacted")
	}
	if compacted.CompactMetadata.Trigger == "" || compacted.CompactMetadata.PreTokens == 0 {
		t.Errorf("compact metadata = %+v, want the trigger and the tokens it replaced", compacted.CompactMetadata)
	}
	if got := finalText(events); got != "carry on" {
		t.Errorf("assistant text = %q, want the message back", got)
	}
}

func TestSendKeepsTheSessionOpenForTheNextTurn(t *testing.T) {
	t.Parallel()
	p := start(t, fakeConfig(t, "echo"))

	for _, message := range []string{"first message", "second message"} {
		send(t, p, message)
		if got := finalText(turn(t, p)); got != message {
			t.Errorf("assistant text = %q, want %q", got, message)
		}
	}
}

func TestCloseInputEndsTheProcessAndRefusesWrites(t *testing.T) {
	t.Parallel()
	p := start(t, fakeConfig(t, "echo"))

	if err := p.CloseInput(); err != nil {
		t.Fatalf("CloseInput() = %v, want nil", err)
	}
	if err := p.CloseInput(); err != nil {
		t.Errorf("CloseInput() twice = %v, want nil", err)
	}

	if err := p.Send("too late"); !errors.Is(err, claude.ErrInputClosed) {
		t.Errorf("Send() = %v, want ErrInputClosed", err)
	}
	if _, err := p.Interrupt(); !errors.Is(err, claude.ErrInputClosed) {
		t.Errorf("Interrupt() = %v, want ErrInputClosed", err)
	}
	if err := p.Respond("req_1", claude.PermissionResponse{Behavior: "allow"}); !errors.Is(err, claude.ErrInputClosed) {
		t.Errorf("Respond() = %v, want ErrInputClosed", err)
	}

	exit := exitOf(t, p)
	if diff := cmp.Diff(claude.ExitInfo{}, exit); diff != "" {
		t.Errorf("ExitInfo mismatch (-want +got):\n%s", diff)
	}
	select {
	case <-p.Done():
	default:
		t.Error("Done() is open after the process exited, want it closed")
	}
	if diff := cmp.Diff(exit, p.Wait()); diff != "" {
		t.Errorf("Wait() twice mismatch (-first +second):\n%s", diff)
	}
}

func TestInterruptEndsTheTurnAndKeepsTheSession(t *testing.T) {
	t.Parallel()
	p := start(t, fakeConfig(t, "slow"))

	send(t, p, "keep going")
	nextEvent(t, p, "the first text delta", isTextDelta)

	requestID, err := p.Interrupt()
	if err != nil {
		t.Fatalf("Interrupt() = %v, want nil", err)
	}
	if requestID == "" {
		t.Error("Interrupt() returned an empty request id, want one to match the answer")
	}

	answer := nextEvent(t, p, "the control response", func(e claude.Event) bool {
		return e.ControlResponse != nil
	}).ControlResponse
	if answer.Response.RequestID != requestID {
		t.Errorf("request id = %q, want %q", answer.Response.RequestID, requestID)
	}
	if answer.Response.Subtype != "success" {
		t.Errorf("control response = %q, want success", answer.Response.Subtype)
	}

	aborted := nextEvent(t, p, "the interrupted message", func(e claude.Event) bool {
		return e.User != nil
	})
	if !strings.Contains(string(aborted.Raw), "[Request interrupted by user]") {
		t.Errorf("interrupted message = %s, want the interruption marker", aborted.Raw)
	}

	closing := nextEvent(t, p, "the aborted result", func(e claude.Event) bool { return e.Result != nil }).Result
	if closing.Subtype != "error_during_execution" || !closing.IsError {
		t.Errorf("result = %q, is_error = %v, want error_during_execution and true", closing.Subtype, closing.IsError)
	}
	if closing.TerminalReason != "aborted_streaming" {
		t.Errorf("TerminalReason = %q, want aborted_streaming", closing.TerminalReason)
	}

	// The session survives an interruption: the next message opens a new turn.
	send(t, p, "and again")
	nextEvent(t, p, "the init of the next turn", isInit)
}

func TestRespondAllowsATool(t *testing.T) {
	t.Parallel()
	p := start(t, fakeConfig(t, "permission"))

	send(t, p, "create the file")
	request := nextEvent(t, p, "the permission request", isControlRequest).ControlRequest
	if request.Request.Subtype != "can_use_tool" || request.Request.ToolName != "Bash" {
		t.Fatalf("request = %q for %q, want can_use_tool for Bash", request.Request.Subtype, request.Request.ToolName)
	}
	if request.Request.ToolUseID == "" {
		t.Error("ToolUseID is empty, want the id of the tool_use block")
	}
	if len(request.Request.PermissionSuggestions) == 0 {
		t.Error("PermissionSuggestions is empty, want what the CLI offers to remember")
	}
	var input struct {
		Command string `json:"command"`
	}
	if err := json.Unmarshal(request.Request.Input, &input); err != nil {
		t.Fatalf("decode the request input = %v, want nil", err)
	}
	if input.Command != claudetest.BashCommand {
		t.Errorf("command = %q, want %q", input.Command, claudetest.BashCommand)
	}

	if err := p.Respond(request.RequestID, claude.PermissionResponse{
		Behavior:     "allow",
		UpdatedInput: request.Request.Input,
	}); err != nil {
		t.Fatalf("Respond() = %v, want nil", err)
	}

	events := turn(t, p)
	if got := finalText(events); got != "done" {
		t.Errorf("assistant text = %q, want done", got)
	}
	answered := toolResults(events)
	if len(answered) != 1 {
		t.Fatalf("tool results = %d, want 1", len(answered))
	}
	if answered[0].ToolUseID != request.Request.ToolUseID || answered[0].IsError {
		t.Errorf("tool result = %+v, want the tool use answered without an error", answered[0])
	}
}

func TestRespondDeniesATool(t *testing.T) {
	t.Parallel()
	p := start(t, fakeConfig(t, "permission"))

	send(t, p, "create the file")
	request := nextEvent(t, p, "the permission request", isControlRequest).ControlRequest

	if err := p.Respond(request.RequestID, claude.PermissionResponse{
		Behavior: "deny",
		Message:  "not this time",
	}); err != nil {
		t.Fatalf("Respond() = %v, want nil", err)
	}

	events := turn(t, p)
	if got := finalText(events); got != "denied: not this time" {
		t.Errorf("assistant text = %q, want the denial and its message", got)
	}
	if got := toolResults(events); len(got) != 0 {
		t.Errorf("tool results = %d, want none for a denied tool", len(got))
	}
}

func TestRespondAnswersAStructuredQuestion(t *testing.T) {
	t.Parallel()
	p := start(t, fakeConfig(t, "question"))

	send(t, p, "ask me")
	request := nextEvent(t, p, "the question", isControlRequest).ControlRequest
	if request.Request.ToolName != "AskUserQuestion" || !request.Request.RequiresUserInteraction {
		t.Fatalf("request = %q, interactive = %v, want AskUserQuestion and true",
			request.Request.ToolName, request.Request.RequiresUserInteraction)
	}

	var asked struct {
		Questions []struct {
			Question    string `json:"question"`
			MultiSelect bool   `json:"multiSelect"`
		} `json:"questions"`
	}
	if err := json.Unmarshal(request.Request.Input, &asked); err != nil {
		t.Fatalf("decode the questions = %v, want nil", err)
	}
	if len(asked.Questions) != 2 {
		t.Fatalf("questions = %d, want 2", len(asked.Questions))
	}
	if asked.Questions[0].MultiSelect || !asked.Questions[1].MultiSelect {
		t.Errorf("multiSelect = %v and %v, want false and true",
			asked.Questions[0].MultiSelect, asked.Questions[1].MultiSelect)
	}

	// The answer carries the questions back, with the chosen labels beside them.
	answers := map[string]string{
		asked.Questions[0].Question: "Red",
		asked.Questions[1].Question: "Apple, Pear",
	}
	var updated map[string]json.RawMessage
	if err := json.Unmarshal(request.Request.Input, &updated); err != nil {
		t.Fatalf("decode the request input = %v, want nil", err)
	}
	chosen, err := json.Marshal(answers)
	if err != nil {
		t.Fatalf("encode the answers = %v, want nil", err)
	}
	updated["answers"] = chosen
	input, err := json.Marshal(updated)
	if err != nil {
		t.Fatalf("encode the updated input = %v, want nil", err)
	}

	if err := p.Respond(request.RequestID, claude.PermissionResponse{
		Behavior:     "allow",
		UpdatedInput: input,
	}); err != nil {
		t.Fatalf("Respond() = %v, want nil", err)
	}

	events := turn(t, p)
	var got map[string]string
	if err := json.Unmarshal([]byte(finalText(events)), &got); err != nil {
		t.Fatalf("decode the answers the CLI got = %v, want nil", err)
	}
	if diff := cmp.Diff(answers, got); diff != "" {
		t.Errorf("answers mismatch (-want +got):\n%s", diff)
	}
}

func TestTerminateAndKillStopTheProcess(t *testing.T) {
	t.Parallel()

	tests := map[string]struct {
		stop func(*claude.Process) error
		want string
	}{
		"terminate": {stop: (*claude.Process).Terminate, want: "SIGTERM"},
		"kill":      {stop: (*claude.Process).Kill, want: "SIGKILL"},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			p := start(t, fakeConfig(t, "slow"))

			send(t, p, "keep going")
			nextEvent(t, p, "the first text delta", isTextDelta)

			if err := tc.stop(p); err != nil {
				t.Fatalf("stopping the process = %v, want nil", err)
			}

			exit := exitOf(t, p)
			if exit.Signal != tc.want {
				t.Errorf("Signal = %q, want %q", exit.Signal, tc.want)
			}
			if exit.Code != -1 {
				t.Errorf("Code = %d, want -1 for a signalled process", exit.Code)
			}
		})
	}
}

func TestWaitReportsACrashWithItsStderr(t *testing.T) {
	t.Parallel()
	p := start(t, fakeConfig(t, "crash"))

	send(t, p, "go")
	nextEvent(t, p, "the init of the turn", isInit)

	exit := exitOf(t, p)
	if exit.Code != 2 {
		t.Errorf("Code = %d, want 2", exit.Code)
	}
	if exit.Signal != "" {
		t.Errorf("Signal = %q, want none for a process that exited on its own", exit.Signal)
	}
	if !strings.Contains(exit.Stderr, "boom") {
		t.Errorf("Stderr = %q, want what the CLI printed before dying", exit.Stderr)
	}
}

func TestStartReportsAMissingBinary(t *testing.T) {
	t.Parallel()

	_, err := claude.Start(t.Context(), claude.Config{
		Binary:    filepath.Join(t.TempDir(), "nowhere"),
		SessionID: sessionID,
	}, discardLog())
	if err == nil {
		t.Fatal("Start() = nil, want an error")
	}
}

func TestStartReportsACancelledContext(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(t.Context())
	cancel()

	_, err := claude.Start(ctx, fakeConfig(t, "echo"), discardLog())
	if !errors.Is(err, context.Canceled) {
		t.Errorf("Start() = %v, want context.Canceled", err)
	}
}
