package claude_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/claude"
)

// The captures of real sessions every decoding test reads.
const (
	turnFixture      = "turn-with-permission.jsonl"
	interruptFixture = "interrupt.jsonl"
	questionFixture  = "question.jsonl"
	resumeFixture    = "resume.jsonl"
)

// loadFixture decodes every line of a captured session in testdata.
func loadFixture(t *testing.T, name string) []claude.Event {
	t.Helper()

	raw, err := os.ReadFile(filepath.Join("testdata", name))
	if err != nil {
		t.Fatalf("ReadFile(%s) = %v, want nil", name, err)
	}

	lines := strings.Split(strings.TrimRight(string(raw), "\n"), "\n")
	events := make([]claude.Event, 0, len(lines))
	for i, line := range lines {
		event, err := claude.Decode([]byte(line))
		if err != nil {
			t.Fatalf("Decode(%s line %d) = %v, want nil", name, i+1, err)
		}
		events = append(events, event)
	}
	return events
}

// pick returns every payload of one kind, in the order it was captured.
func pick[T any](events []claude.Event, payload func(claude.Event) *T) []*T {
	var picked []*T
	for _, event := range events {
		if got := payload(event); got != nil {
			picked = append(picked, got)
		}
	}
	return picked
}

func inits(events []claude.Event) []*claude.InitEvent {
	return pick(events, func(e claude.Event) *claude.InitEvent { return e.Init })
}

func streams(events []claude.Event) []*claude.StreamEvent {
	return pick(events, func(e claude.Event) *claude.StreamEvent { return e.Stream })
}

func assistants(events []claude.Event) []*claude.AssistantEvent {
	return pick(events, func(e claude.Event) *claude.AssistantEvent { return e.Assistant })
}

func users(events []claude.Event) []*claude.UserEvent {
	return pick(events, func(e claude.Event) *claude.UserEvent { return e.User })
}

func results(events []claude.Event) []*claude.ResultEvent {
	return pick(events, func(e claude.Event) *claude.ResultEvent { return e.Result })
}

func controlRequests(events []claude.Event) []*claude.ControlRequestEvent {
	return pick(events, func(e claude.Event) *claude.ControlRequestEvent { return e.ControlRequest })
}

func controlResponses(events []claude.Event) []*claude.ControlResponseEvent {
	return pick(events, func(e claude.Event) *claude.ControlResponseEvent { return e.ControlResponse })
}

// streamTypes is the set of event.type values seen in a capture.
func streamTypes(events []claude.Event) map[string]int {
	counted := make(map[string]int)
	for _, stream := range streams(events) {
		counted[stream.Event.Type]++
	}
	return counted
}

// Fact 2: system/init opens every turn, not only the first.
func TestDecodeInitOpensEveryTurn(t *testing.T) {
	t.Parallel()
	events := loadFixture(t, turnFixture)

	got := inits(events)
	if len(got) != 2 {
		t.Fatalf("init events = %d, want 2", len(got))
	}
	if got[0].SessionID != got[1].SessionID {
		t.Errorf("session ids = %q and %q, want the same", got[0].SessionID, got[1].SessionID)
	}

	first := got[0]
	if first.SessionID == "" {
		t.Error("SessionID is empty, want the session id")
	}
	if first.Model == "" || first.CWD == "" {
		t.Errorf("Model = %q, CWD = %q, want both set", first.Model, first.CWD)
	}
	if first.ClaudeCodeVersion != "2.1.261" {
		t.Errorf("ClaudeCodeVersion = %q, want 2.1.261", first.ClaudeCodeVersion)
	}
	if first.PermissionMode != "default" {
		t.Errorf("PermissionMode = %q, want default", first.PermissionMode)
	}
	if len(first.Tools) == 0 {
		t.Error("Tools is empty, want the tool names")
	}
	want := []string{"interrupt_receipt_v1", "interrupt_cancel_queued_v1", "msg_lifecycle_v1"}
	if diff := cmp.Diff(want, first.Capabilities); diff != "" {
		t.Errorf("Capabilities mismatch (-want +got):\n%s", diff)
	}
}

// Fact 4: partial messages carry the whole shape of a streamed message.
func TestDecodeStreamEventsCoverTheWholeMessage(t *testing.T) {
	t.Parallel()
	events := loadFixture(t, turnFixture)

	counted := streamTypes(events)
	for _, want := range []string{
		"message_start", "content_block_start", "content_block_delta",
		"content_block_stop", "message_delta", "message_stop",
	} {
		if counted[want] == 0 {
			t.Errorf("stream events of type %s = 0, want at least one", want)
		}
	}

	blockTypes := make(map[string]int)
	deltaTypes := make(map[string]int)
	for _, stream := range streams(events) {
		switch stream.Event.Type {
		case "message_start":
			message := stream.Event.Message
			if message == nil {
				t.Fatal("message_start has no message, want id, model and usage")
			}
			if message.ID == "" || message.Model == "" {
				t.Errorf("message id = %q, model = %q, want both set", message.ID, message.Model)
			}
			if message.Usage.ContextTokens() == 0 {
				t.Error("message_start usage has no context tokens, want the request size")
			}
		case "content_block_start":
			block := stream.Event.ContentBlock
			if block == nil {
				t.Fatal("content_block_start has no content block, want one")
			}
			blockTypes[block.Type]++
			if block.Type == "tool_use" && (block.ID == "" || block.Name == "") {
				t.Errorf("tool_use block id = %q, name = %q, want both set", block.ID, block.Name)
			}
		case "content_block_delta":
			delta := stream.Event.Delta
			if delta == nil {
				t.Fatal("content_block_delta has no delta, want one")
			}
			deltaTypes[delta.Type]++
			if delta.Type == "thinking_delta" && delta.Text != "" {
				t.Errorf("thinking_delta text = %q, want empty", delta.Text)
			}
		case "message_delta":
			if stream.Event.Delta == nil || stream.Event.Delta.StopReason == "" {
				t.Error("message_delta has no stop reason, want one")
			}
			if stream.Event.Usage == nil {
				t.Error("message_delta has no usage, want the token counts")
			}
		}
	}

	for _, want := range []string{"thinking", "text", "tool_use"} {
		if blockTypes[want] == 0 {
			t.Errorf("content blocks of type %s = 0, want at least one", want)
		}
	}
	for _, want := range []string{"text_delta", "input_json_delta", "thinking_delta", "signature_delta"} {
		if deltaTypes[want] == 0 {
			t.Errorf("deltas of type %s = 0, want at least one", want)
		}
	}
}

// Fact 4 and 5: text deltas add up to the text the assistant event carries.
func TestDecodeTextDeltasAddUpToTheAssistantBlock(t *testing.T) {
	t.Parallel()
	events := loadFixture(t, turnFixture)

	var streamed strings.Builder
	for _, stream := range streams(events) {
		if delta := stream.Event.Delta; delta != nil && delta.Type == "text_delta" {
			streamed.WriteString(delta.Text)
		}
	}

	var final strings.Builder
	for _, assistant := range assistants(events) {
		for _, block := range assistant.Message.Content {
			if block.Type == "text" {
				final.WriteString(block.Text)
			}
		}
	}

	if streamed.Len() == 0 {
		t.Fatal("no text was streamed, want the assistant text")
	}
	if streamed.String() != final.String() {
		t.Errorf("streamed text = %q, want %q", streamed.String(), final.String())
	}
}

// Fact 5: an assistant event is one content block of the message being streamed.
func TestDecodeAssistantIsOneBlockOfTheOpenMessage(t *testing.T) {
	t.Parallel()
	events := loadFixture(t, turnFixture)

	open := ""
	seen := 0
	for _, event := range events {
		if stream := event.Stream; stream != nil && stream.Event.Type == "message_start" {
			open = stream.Event.Message.ID
		}
		assistant := event.Assistant
		if assistant == nil {
			continue
		}
		seen++
		if len(assistant.Message.Content) != 1 {
			t.Fatalf("assistant content blocks = %d, want 1", len(assistant.Message.Content))
		}
		if assistant.Message.ID != open {
			t.Errorf("assistant message id = %q, want %q", assistant.Message.ID, open)
		}
	}
	if seen == 0 {
		t.Fatal("no assistant events, want several")
	}
}

// Fact 5: the tool_use block of an assistant event carries the complete input.
func TestDecodeAssistantToolUseCarriesTheWholeInput(t *testing.T) {
	t.Parallel()
	events := loadFixture(t, turnFixture)

	var block claude.ContentBlock
	for _, assistant := range assistants(events) {
		if got := assistant.Message.Content[0]; got.Type == "tool_use" {
			block = got
			break
		}
	}
	if block.Name != "Bash" {
		t.Fatalf("tool_use name = %q, want Bash", block.Name)
	}
	if block.ID == "" {
		t.Error("tool_use id is empty, want the tool use id")
	}

	var input struct {
		Command string `json:"command"`
	}
	if err := json.Unmarshal(block.Input, &input); err != nil {
		t.Fatalf("unmarshal tool input = %v, want nil", err)
	}
	if input.Command != `echo "hi" > hello.txt` {
		t.Errorf("command = %q, want the captured one", input.Command)
	}
}

// Fact 6: a user event carries the tool results of the tools that ran.
func TestDecodeUserToolResults(t *testing.T) {
	t.Parallel()
	events := loadFixture(t, turnFixture)

	var results []claude.ToolResult
	for _, user := range users(events) {
		results = append(results, user.ToolResults()...)
	}
	if len(results) != 1 {
		t.Fatalf("tool results = %d, want 1", len(results))
	}

	got := results[0]
	if got.ToolUseID == "" {
		t.Error("ToolUseID is empty, want the id of the tool use it answers")
	}
	if got.IsError {
		t.Error("IsError = true, want false")
	}
	var content string
	if err := json.Unmarshal(got.Content, &content); err != nil {
		t.Fatalf("unmarshal tool result content = %v, want nil", err)
	}
	if content != "(Bash completed with no output)" {
		t.Errorf("content = %q, want the captured one", content)
	}
}

// Fact 6: a failed tool marks its result.
func TestDecodeUserToolResultReportsAnError(t *testing.T) {
	t.Parallel()
	events := loadFixture(t, questionFixture)

	failed := 0
	for _, user := range users(events) {
		for _, result := range user.ToolResults() {
			if result.IsError {
				failed++
			}
		}
	}
	if failed == 0 {
		t.Error("failed tool results = 0, want the captured one")
	}
}

func TestDecodeUserTextHasNoToolResults(t *testing.T) {
	t.Parallel()
	events := loadFixture(t, turnFixture)

	first := users(events)[0]
	if got := first.ToolResults(); got != nil {
		t.Errorf("ToolResults() = %v, want none", got)
	}
}

func TestDecodeUserStringContentHasNoToolResults(t *testing.T) {
	t.Parallel()

	event, err := claude.Decode([]byte(`{"type":"user","message":{"content":"plain text"}}`))
	if err != nil {
		t.Fatalf("Decode() = %v, want nil", err)
	}
	if got := event.User.ToolResults(); got != nil {
		t.Errorf("ToolResults() = %v, want none", got)
	}
}

func TestDecodeCompactBoundary(t *testing.T) {
	t.Parallel()
	line := `{"type":"system","subtype":"compact_boundary",` +
		`"compact_metadata":{"trigger":"auto","pre_tokens":120000}}`

	event, err := claude.Decode([]byte(line))
	if err != nil {
		t.Fatalf("Decode() = %v, want nil", err)
	}
	if event.CompactBoundary == nil {
		t.Fatal("CompactBoundary is nil, want the compaction metadata")
	}
	got := event.CompactBoundary.CompactMetadata
	if got.Trigger != "auto" || got.PreTokens != 120000 {
		t.Errorf("CompactMetadata = %+v, want auto and 120000", got)
	}
}

func TestDecodeAPIRetry(t *testing.T) {
	t.Parallel()
	line := `{"type":"system","subtype":"api_retry","attempt":2,"max_retries":5,` +
		`"retry_delay_ms":1000,"error":"overloaded"}`

	event, err := claude.Decode([]byte(line))
	if err != nil {
		t.Fatalf("Decode() = %v, want nil", err)
	}
	if event.APIRetry == nil {
		t.Fatal("APIRetry is nil, want the retry details")
	}
	want := claude.APIRetryEvent{Attempt: 2, MaxRetries: 5, RetryDelayMS: 1000, Error: "overloaded"}
	if diff := cmp.Diff(want, *event.APIRetry); diff != "" {
		t.Errorf("APIRetry mismatch (-want +got):\n%s", diff)
	}
}

// Fact 7: the result closes a turn with its outcome and its cost.
func TestDecodeResultClosesTheTurn(t *testing.T) {
	t.Parallel()
	events := loadFixture(t, turnFixture)

	got := results(events)
	if len(got) != 2 {
		t.Fatalf("result events = %d, want 2", len(got))
	}

	first := got[0]
	if first.Subtype != "success" || first.IsError {
		t.Errorf("Subtype = %q, IsError = %v, want success and false", first.Subtype, first.IsError)
	}
	if first.Result == "" {
		t.Error("Result is empty, want the final text")
	}
	if first.StopReason == nil || *first.StopReason != "end_turn" {
		t.Errorf("StopReason = %v, want end_turn", first.StopReason)
	}
	if first.TerminalReason != "completed" {
		t.Errorf("TerminalReason = %q, want completed", first.TerminalReason)
	}
	if first.NumTurns != 2 {
		t.Errorf("NumTurns = %d, want 2", first.NumTurns)
	}
	if first.TotalCostUSD == 0 {
		t.Error("TotalCostUSD = 0, want the cost of the turn")
	}
	if first.Usage.OutputTokens == 0 || first.Usage.ContextTokens() == 0 {
		t.Errorf("Usage = %+v, want the token counts", first.Usage)
	}
	if got := first.ContextWindow(); got != 200000 {
		t.Errorf("ContextWindow() = %d, want 200000", got)
	}
}

// Fact 8: a tool the classifier escalates arrives as a can_use_tool request.
func TestDecodePermissionRequest(t *testing.T) {
	t.Parallel()
	events := loadFixture(t, turnFixture)

	requests := controlRequests(events)
	if len(requests) != 1 {
		t.Fatalf("control requests = %d, want 1", len(requests))
	}

	got := requests[0]
	if got.RequestID == "" {
		t.Error("RequestID is empty, want the id to answer")
	}
	request := got.Request
	if request.Subtype != "can_use_tool" {
		t.Errorf("Subtype = %q, want can_use_tool", request.Subtype)
	}
	if request.ToolName != "Bash" || request.DisplayName != "Bash" {
		t.Errorf("ToolName = %q, DisplayName = %q, want Bash", request.ToolName, request.DisplayName)
	}
	if request.Description == "" {
		t.Error("Description is empty, want what the tool intends to do")
	}
	if request.ToolUseID == "" {
		t.Error("ToolUseID is empty, want the block the request belongs to")
	}
	if !strings.HasSuffix(request.BlockedPath, "/hello.txt") {
		t.Errorf("BlockedPath = %q, want the path the command writes", request.BlockedPath)
	}

	var input struct {
		Command string `json:"command"`
	}
	if err := json.Unmarshal(request.Input, &input); err != nil {
		t.Fatalf("unmarshal request input = %v, want nil", err)
	}
	if input.Command != `echo "hi" > hello.txt` {
		t.Errorf("command = %q, want the captured one", input.Command)
	}

	var suggestions []struct {
		Type        string `json:"type"`
		Behavior    string `json:"behavior"`
		Destination string `json:"destination"`
	}
	if err := json.Unmarshal(request.PermissionSuggestions, &suggestions); err != nil {
		t.Fatalf("unmarshal permission suggestions = %v, want nil", err)
	}
	if len(suggestions) != 2 {
		t.Fatalf("permission suggestions = %d, want 2", len(suggestions))
	}
	if suggestions[0].Type != "addRules" || suggestions[0].Destination != "localSettings" {
		t.Errorf("first suggestion = %+v, want an addRules for localSettings", suggestions[0])
	}
	if suggestions[1].Type != "addDirectories" || suggestions[1].Destination != "session" {
		t.Errorf("second suggestion = %+v, want an addDirectories for the session", suggestions[1])
	}
}

// Fact 9: the CLI echoes the answer to a permission request.
func TestDecodePermissionResponseIsEchoedBack(t *testing.T) {
	t.Parallel()
	events := loadFixture(t, turnFixture)

	responses := controlResponses(events)
	if len(responses) != 1 {
		t.Fatalf("control responses = %d, want 1", len(responses))
	}
	got := responses[0].Response
	if got.Subtype != "success" {
		t.Errorf("Subtype = %q, want success", got.Subtype)
	}
	if want := controlRequests(events)[0].RequestID; got.RequestID != want {
		t.Errorf("RequestID = %q, want %q", got.RequestID, want)
	}

	var answer claude.PermissionResponse
	if err := json.Unmarshal(got.Response, &answer); err != nil {
		t.Fatalf("unmarshal control response = %v, want nil", err)
	}
	if answer.Behavior != "allow" {
		t.Errorf("Behavior = %q, want allow", answer.Behavior)
	}
	if len(answer.UpdatedInput) == 0 {
		t.Error("UpdatedInput is empty, want the input the tool runs with")
	}
}

// Fact 10: a structured question is a can_use_tool for AskUserQuestion.
func TestDecodeQuestionRequest(t *testing.T) {
	t.Parallel()
	events := loadFixture(t, questionFixture)

	requests := controlRequests(events)
	if len(requests) != 1 {
		t.Fatalf("control requests = %d, want 1", len(requests))
	}

	request := requests[0].Request
	if request.Subtype != "can_use_tool" || request.ToolName != "AskUserQuestion" {
		t.Errorf("Subtype = %q, ToolName = %q, want can_use_tool for AskUserQuestion",
			request.Subtype, request.ToolName)
	}
	if !request.RequiresUserInteraction {
		t.Error("RequiresUserInteraction = false, want true")
	}

	var input struct {
		Questions []struct {
			Question    string `json:"question"`
			Header      string `json:"header"`
			MultiSelect bool   `json:"multiSelect"`
			Options     []struct {
				Label       string `json:"label"`
				Description string `json:"description"`
			} `json:"options"`
		} `json:"questions"`
	}
	if err := json.Unmarshal(request.Input, &input); err != nil {
		t.Fatalf("unmarshal question input = %v, want nil", err)
	}
	if len(input.Questions) != 2 {
		t.Fatalf("questions = %d, want 2", len(input.Questions))
	}
	first := input.Questions[0]
	if first.Question == "" || first.Header == "" || len(first.Options) != 2 {
		t.Errorf("first question = %+v, want a question, a header and two options", first)
	}
	if first.Options[0].Label == "" || first.Options[0].Description == "" {
		t.Errorf("first option = %+v, want a label and a description", first.Options[0])
	}
	if first.MultiSelect {
		t.Error("first question MultiSelect = true, want false")
	}
	if !input.Questions[1].MultiSelect {
		t.Error("second question MultiSelect = false, want true")
	}
}

// Fact 10: the tool result of an answered question says so.
func TestDecodeQuestionToolResult(t *testing.T) {
	t.Parallel()
	events := loadFixture(t, questionFixture)

	wanted := controlRequests(events)[0].Request.ToolUseID
	for _, user := range users(events) {
		for _, result := range user.ToolResults() {
			if result.ToolUseID != wanted {
				continue
			}
			var content string
			if err := json.Unmarshal(result.Content, &content); err != nil {
				t.Fatalf("unmarshal tool result content = %v, want nil", err)
			}
			if !strings.HasPrefix(content, "Your questions have been answered") {
				t.Errorf("content = %q, want the answered questions", content)
			}
			return
		}
	}
	t.Errorf("no tool result for %s, want the answer of the question", wanted)
}

// Fact 11: an interrupt ends the turn and leaves the session alive.
func TestDecodeInterruptedTurn(t *testing.T) {
	t.Parallel()
	events := loadFixture(t, interruptFixture)

	responses := controlResponses(events)
	if len(responses) != 1 {
		t.Fatalf("control responses = %d, want 1", len(responses))
	}
	if got := responses[0].Response.Subtype; got != "success" {
		t.Errorf("Subtype = %q, want success", got)
	}
	var receipt struct {
		StillQueued []string `json:"still_queued"`
	}
	if err := json.Unmarshal(responses[0].Response.Response, &receipt); err != nil {
		t.Fatalf("unmarshal interrupt receipt = %v, want nil", err)
	}
	if len(receipt.StillQueued) != 0 {
		t.Errorf("still_queued = %v, want empty", receipt.StillQueued)
	}

	var interrupted bool
	for _, user := range users(events) {
		var blocks []struct {
			Text string `json:"text"`
		}
		if err := json.Unmarshal(user.Message.Content, &blocks); err != nil {
			continue
		}
		for _, block := range blocks {
			if block.Text == "[Request interrupted by user]" {
				interrupted = true
			}
		}
	}
	if !interrupted {
		t.Error("no synthetic user message, want [Request interrupted by user]")
	}

	got := results(events)
	if len(got) != 1 {
		t.Fatalf("result events = %d, want 1", len(got))
	}
	if got[0].Subtype != "error_during_execution" || !got[0].IsError {
		t.Errorf("Subtype = %q, IsError = %v, want error_during_execution and true",
			got[0].Subtype, got[0].IsError)
	}
	if got[0].TerminalReason != "aborted_streaming" {
		t.Errorf("TerminalReason = %q, want aborted_streaming", got[0].TerminalReason)
	}
}

// Fact 12: resuming keeps the session id the first process reported.
func TestDecodeResumeKeepsTheSessionID(t *testing.T) {
	t.Parallel()

	first := inits(loadFixture(t, questionFixture))
	resumed := inits(loadFixture(t, resumeFixture))
	if len(resumed) != 1 {
		t.Fatalf("init events after resume = %d, want 1", len(resumed))
	}
	if resumed[0].SessionID != first[0].SessionID {
		t.Errorf("resumed session id = %q, want %q", resumed[0].SessionID, first[0].SessionID)
	}
	if len(results(loadFixture(t, resumeFixture))) == 0 {
		t.Error("no result after resume, want the turn to complete")
	}
}

func TestDecodeKeepsTheRawLine(t *testing.T) {
	t.Parallel()
	line := []byte(`{"type":"system","subtype":"status","status":"requesting"}`)

	event, err := claude.Decode(line)
	if err != nil {
		t.Fatalf("Decode() = %v, want nil", err)
	}
	if string(event.Raw) != string(line) {
		t.Errorf("Raw = %s, want %s", event.Raw, line)
	}
	if event.Status == nil || event.Status.Status != "requesting" {
		t.Errorf("Status = %+v, want requesting", event.Status)
	}
}

func TestDecodeUnknownTypeKeepsOnlyTheEnvelope(t *testing.T) {
	t.Parallel()

	for _, line := range []string{
		`{"type":"rate_limit_event","rate_limit_info":{"status":"allowed"}}`,
		`{"type":"system","subtype":"thinking_tokens","estimated_tokens":50}`,
	} {
		event, err := claude.Decode([]byte(line))
		if err != nil {
			t.Fatalf("Decode(%s) = %v, want nil", line, err)
		}
		if event.Type == "" {
			t.Errorf("Decode(%s) type is empty, want the envelope type", line)
		}
		want := claude.Event{Type: event.Type, Subtype: event.Subtype, Raw: event.Raw}
		if diff := cmp.Diff(want, event); diff != "" {
			t.Errorf("Decode(%s) mismatch (-want +got):\n%s", line, diff)
		}
	}
}

func TestDecodeRejectsALineThatIsNotJSON(t *testing.T) {
	t.Parallel()

	if _, err := claude.Decode([]byte("not json")); err == nil {
		t.Error("Decode() = nil, want an error")
	}
}

func TestDecodeRejectsAMalformedPayload(t *testing.T) {
	t.Parallel()

	if _, err := claude.Decode([]byte(`{"type":"result","usage":"nope"}`)); err == nil {
		t.Error("Decode() = nil, want an error")
	}
	if _, err := claude.Decode([]byte(`{"type":"system","subtype":"init","tools":"nope"}`)); err == nil {
		t.Error("Decode() = nil, want an error")
	}
}

func TestUsageContextTokens(t *testing.T) {
	t.Parallel()
	usage := claude.Usage{
		InputTokens:              1,
		CacheCreationInputTokens: 20,
		CacheReadInputTokens:     300,
		OutputTokens:             4000,
	}

	if got := usage.ContextTokens(); got != 321 {
		t.Errorf("ContextTokens() = %d, want 321", got)
	}
}

func TestResultContextWindowTakesTheLargest(t *testing.T) {
	t.Parallel()
	var result claude.ResultEvent
	if err := json.Unmarshal([]byte(`{"modelUsage":{
		"small":{"contextWindow":200000},
		"big":{"contextWindow":1000000}
	}}`), &result); err != nil {
		t.Fatalf("unmarshal result = %v, want nil", err)
	}

	if got := result.ContextWindow(); got != 1000000 {
		t.Errorf("ContextWindow() = %d, want 1000000", got)
	}
	if got := (claude.ResultEvent{}).ContextWindow(); got != 0 {
		t.Errorf("ContextWindow() of an empty result = %d, want 0", got)
	}
}

func TestUserMessageIsWhatTheCLIExpects(t *testing.T) {
	t.Parallel()

	line := claude.UserMessage("write the PRD")
	if strings.ContainsAny(string(line), "\n") {
		t.Errorf("UserMessage() = %s, want no newline", line)
	}

	want := `{"type":"user","message":{"role":"user","content":[{"type":"text","text":"write the PRD"}]},"parent_tool_use_id":null}`
	if string(line) != want {
		t.Errorf("UserMessage() = %s, want %s", line, want)
	}
}

func TestInterruptRequestIsWhatTheCLIExpects(t *testing.T) {
	t.Parallel()

	line := claude.InterruptRequest("aaf1b6ec")
	want := `{"type":"control_request","request_id":"aaf1b6ec","request":{"subtype":"interrupt"}}`
	if string(line) != want {
		t.Errorf("InterruptRequest() = %s, want %s", line, want)
	}
}

func TestControlResponseAllows(t *testing.T) {
	t.Parallel()

	line, err := claude.ControlResponse("aaf1b6ec", claude.PermissionResponse{
		Behavior:     "allow",
		UpdatedInput: json.RawMessage(`{"command":"ls"}`),
	})
	if err != nil {
		t.Fatalf("ControlResponse() = %v, want nil", err)
	}

	want := `{"type":"control_response","response":{"subtype":"success","request_id":"aaf1b6ec",` +
		`"response":{"behavior":"allow","updatedInput":{"command":"ls"}}}}`
	if string(line) != want {
		t.Errorf("ControlResponse() = %s, want %s", line, want)
	}
}

func TestControlResponseDenies(t *testing.T) {
	t.Parallel()

	line, err := claude.ControlResponse("aaf1b6ec", claude.PermissionResponse{
		Behavior: "deny",
		Message:  "not this time",
	})
	if err != nil {
		t.Fatalf("ControlResponse() = %v, want nil", err)
	}

	want := `{"type":"control_response","response":{"subtype":"success","request_id":"aaf1b6ec",` +
		`"response":{"behavior":"deny","message":"not this time"}}}`
	if string(line) != want {
		t.Errorf("ControlResponse() = %s, want %s", line, want)
	}
}

func TestControlResponseCarriesTheRememberedPermissions(t *testing.T) {
	t.Parallel()

	line, err := claude.ControlResponse("aaf1b6ec", claude.PermissionResponse{
		Behavior:           "allow",
		UpdatedInput:       json.RawMessage(`{}`),
		UpdatedPermissions: json.RawMessage(`[{"type":"addRules"}]`),
	})
	if err != nil {
		t.Fatalf("ControlResponse() = %v, want nil", err)
	}
	if !strings.Contains(string(line), `"updatedPermissions":[{"type":"addRules"}]`) {
		t.Errorf("ControlResponse() = %s, want the updated permissions", line)
	}
}

func TestControlResponseRejectsAnInvalidInput(t *testing.T) {
	t.Parallel()

	if _, err := claude.ControlResponse("aaf1b6ec", claude.PermissionResponse{
		Behavior:     "allow",
		UpdatedInput: json.RawMessage(`{`),
	}); err == nil {
		t.Error("ControlResponse() = nil, want an error")
	}
}
