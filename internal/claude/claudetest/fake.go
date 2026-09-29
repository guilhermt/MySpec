// Package claudetest is a fake Claude Code CLI. The tests of the packages that
// drive the real one run it as an auxiliary process: a test binary whose
// TestMain hands over to Run when EnvFlag is set behaves as the CLI, speaking
// the same stream-json protocol on stdin and stdout.
package claudetest

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/guilhermt/myspec/internal/claude"
)

// The environment variables that turn a test binary into the fake CLI and pick
// what it does.
const (
	// EnvFlag set to "1" makes the test binary run as the fake CLI.
	EnvFlag = "MYSPEC_FAKE_CLAUDE"
	// EnvScenario names the scenario played on every user message.
	EnvScenario = "MYSPEC_FAKE_SCENARIO"
	// EnvAuth set to "out" makes `auth status` report a logged out user.
	EnvAuth = "MYSPEC_FAKE_AUTH"
	// EnvWriterFix names the step file the writer scenario rewrites from its
	// second turn on, which is how a test drives the correction of a plan.
	EnvWriterFix = "MYSPEC_FAKE_WRITER_FIX"
	// EnvWriterRepo is the repository the rewritten step file carries.
	EnvWriterRepo = "MYSPEC_FAKE_WRITER_REPO"
	// EnvCatalog picks what the fake answers to list_models: "" for Catalog,
	// "unsupported" for the error an older CLI gives, "silent" for no answer.
	EnvCatalog = "MYSPEC_FAKE_CATALOG"
	// EnvGates is the folder the actions scenario waits in: after each of its
	// stages it waits for a file named "<turn>-<stage>" there before going on,
	// which is how a test holds a turn at a known point.
	EnvGates = "MYSPEC_FAKE_GATES"
)

// The effort levels every model of Catalog that takes one accepts.
var catalogEfforts = []string{"low", "medium", "high", "xhigh", "max"}

// Catalog is what the fake answers to list_models: the catalog of the
// reference machine, with the default alias and a disabled entry, so that the
// rules that pick what the app offers have something to leave out.
var Catalog = []claude.ModelEntry{
	{Value: "default", ResolvedModel: "claude-opus-5-5[1m]", SupportsEffort: true, SupportedEffortLevels: catalogEfforts},
	{Value: "opus[1m]", ResolvedModel: "claude-opus-5-5[1m]", SupportsEffort: true, SupportedEffortLevels: catalogEfforts},
	{Value: "claude-fable-5-1[1m]", ResolvedModel: "claude-fable-5-1", SupportsEffort: true, SupportedEffortLevels: catalogEfforts},
	{Value: "sonnet", ResolvedModel: "claude-sonnet-5", SupportsEffort: true, SupportedEffortLevels: catalogEfforts},
	{Value: "haiku", ResolvedModel: "claude-haiku-4-5-20251001"},
	{Value: "legacy", ResolvedModel: "claude-opus-5", SupportsEffort: true, SupportedEffortLevels: catalogEfforts, Disabled: true},
}

// The exit codes the fake uses.
const (
	exitOK    = 0
	exitCrash = 2
	exitUsage = 64
)

// Model is the model name every fake turn reports.
const Model = "claude-fake-1"

// ContextWindow is the window the fake reports in the result of a turn.
const ContextWindow = 200000

// ReadPath is the file the tool scenario pretends to read.
const ReadPath = "/tmp/fake/hello.txt"

// SecondReadPath is the file the actions scenario reads while ReadPath is
// still being read.
const SecondReadPath = "/tmp/fake/world.txt"

// BashCommand is the command the permission scenario asks to run.
const BashCommand = `echo "hi" > hello.txt`

// The Agent call of the subagent scenario and the Bash call of the bash_fail
// scenario.
const (
	SubagentType        = "general-purpose"
	SubagentDescription = "Inspect the folder"
	SubagentText        = "The folder holds hello.txt."
	SubagentReport      = "hello.txt says hi."
	FailingCommand      = "go test ./...\ngo vet ./..."
	FailingDescription  = "Run the tests"
)

// Capabilities is what the fake announces in system/init.
var Capabilities = []string{"interrupt_receipt_v1", "interrupt_cancel_queued_v1", "msg_lifecycle_v1"}

// deltaChunks is how many text deltas a streamed text block is cut into.
const deltaChunks = 3

// tickInterval is how often the slow scenario emits a text delta.
const tickInterval = 100 * time.Millisecond

// gatePoll is how often the actions scenario looks for its next gate.
const gatePoll = 5 * time.Millisecond

// queueSize buffers what the stdin reader hands to the scenario, so a slow
// scenario never stops the fake from reading its input.
const queueSize = 16

// maxLine is the largest stdin line the fake accepts.
const maxLine = 16 << 20

// Run plays the scenario named by EnvScenario against stdin and stdout and
// returns the exit code the fake CLI should end with.
func Run() int {
	args := os.Args[1:]
	if len(args) >= 2 && args[0] == "auth" && args[1] == "status" {
		return authStatus()
	}
	if err := validateArgs(args); err != nil {
		fail("%v", err)
		return exitUsage
	}

	fake := newFake(sessionID(args))
	go fake.read(os.Stdin)
	return fake.play(os.Getenv(EnvScenario))
}

// authStatus answers the preflight check.
func authStatus() int {
	if os.Getenv(EnvAuth) == "out" {
		_, _ = fmt.Fprintln(os.Stdout, `{"loggedIn":false}`)
		return 1
	}
	_, _ = fmt.Fprintln(os.Stdout, `{"loggedIn":true,"authMethod":"claudeai","subscriptionType":"max"}`)
	return exitOK
}

// fail writes a reason on stderr, the way the real CLI reports a bad usage.
func fail(format string, args ...any) {
	_, _ = fmt.Fprintf(os.Stderr, "fake claude: "+format+"\n", args...)
}

// validateArgs rejects a command line the app should never produce.
func validateArgs(args []string) error {
	if !slices.Contains(args, "-p") {
		return errors.New("missing -p")
	}
	for _, flag := range [][2]string{
		{"--output-format", "stream-json"},
		{"--input-format", "stream-json"},
		{"--permission-prompt-tool", "stdio"},
	} {
		if got := flagValue(args, flag[0]); got != flag[1] {
			return fmt.Errorf("%s is %q, want %q", flag[0], got, flag[1])
		}
	}
	// A session always names its model, by id for a new one and by resume for
	// an existing one; a catalog process names no session and no model. The
	// effort is on the command line only for a model that takes one.
	session, resume := flagValue(args, "--session-id"), flagValue(args, "--resume")
	if session != "" && resume != "" {
		return errors.New("at most one of --session-id and --resume is allowed")
	}
	if session != "" || resume != "" {
		if flagValue(args, "--model") == "" {
			return errors.New("--model is required")
		}
	}
	if slices.Contains(args, "--effort") && flagValue(args, "--effort") == "" {
		return errors.New("--effort is empty")
	}
	return nil
}

// flagValue returns the value following name, or "" when name is absent or last.
func flagValue(args []string, name string) string {
	for i, arg := range args {
		if arg == name && i+1 < len(args) {
			return args[i+1]
		}
	}
	return ""
}

// sessionID is the id the command line asked the session to have.
func sessionID(args []string) string {
	if id := flagValue(args, "--session-id"); id != "" {
		return id
	}
	return flagValue(args, "--resume")
}

// response is a control response read from stdin.
type response struct {
	requestID string
	body      json.RawMessage
}

// permission is the part of a control response the scenarios act on.
type permission struct {
	Behavior           string          `json:"behavior"`
	Message            string          `json:"message"`
	UpdatedInput       json.RawMessage `json:"updatedInput"`
	UpdatedPermissions json.RawMessage `json:"updatedPermissions"`
}

// fake is one run of the fake CLI.
type fake struct {
	encoder    *json.Encoder
	outMu      sync.Mutex
	sessionID  string
	users      chan string
	responses  chan response
	interrupts chan string
	seq        int
	turns      int
}

func newFake(id string) *fake {
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetEscapeHTML(false)
	return &fake{
		encoder:    encoder,
		sessionID:  id,
		users:      make(chan string, queueSize),
		responses:  make(chan response, queueSize),
		interrupts: make(chan string, queueSize),
	}
}

// stdinLine is every field of an input line the fake reacts to.
type stdinLine struct {
	Type      string `json:"type"`
	RequestID string `json:"request_id"`
	Message   struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
	} `json:"message"`
	Request struct {
		Subtype string `json:"subtype"`
	} `json:"request"`
	Response struct {
		RequestID string          `json:"request_id"`
		Response  json.RawMessage `json:"response"`
	} `json:"response"`
}

// read consumes stdin and dispatches every line to the channel of its kind.
// The channels close when the input ends, which is how a scenario waiting for
// an answer learns that none is coming.
func (f *fake) read(input *os.File) {
	defer close(f.users)
	defer close(f.responses)
	defer close(f.interrupts)

	scanner := bufio.NewScanner(input)
	scanner.Buffer(make([]byte, 0, bufio.MaxScanTokenSize), maxLine)
	for scanner.Scan() {
		var line stdinLine
		if err := json.Unmarshal(scanner.Bytes(), &line); err != nil {
			fail("undecodable input line: %v", err)
			continue
		}
		switch line.Type {
		case "user":
			text := make([]string, 0, len(line.Message.Content))
			for _, block := range line.Message.Content {
				text = append(text, block.Text)
			}
			f.users <- strings.Join(text, "")
		case "control_request":
			switch line.Request.Subtype {
			case "interrupt":
				f.interrupts <- line.RequestID
			case "list_models":
				f.answerListModels(line.RequestID)
			}
		case "control_response":
			f.responses <- response{requestID: line.Response.RequestID, body: line.Response.Response}
		default:
			fail("unexpected input line type %q", line.Type)
		}
	}
}

// answerListModels answers the catalog request the way EnvCatalog asks it to:
// with the catalog, with the error an older CLI gives, or with nothing.
func (f *fake) answerListModels(requestID string) {
	switch os.Getenv(EnvCatalog) {
	case "unsupported":
		f.emitRaw(map[string]any{
			"type": "control_response",
			"response": map[string]any{
				"subtype":    "error",
				"request_id": requestID,
				"error":      "Unsupported control request subtype: list_models",
			},
		})
	case "silent":
		// Answers nothing at all, so the reading waits until its deadline.
	default:
		f.emitRaw(map[string]any{
			"type": "control_response",
			"response": map[string]any{
				"subtype":    "success",
				"request_id": requestID,
				"response":   map[string]any{"models": Catalog},
			},
		})
	}
}

// play runs one turn of the scenario per user message, until stdin ends.
func (f *fake) play(scenario string) int {
	for text := range f.users {
		f.turns++
		switch scenario {
		case "echo":
			f.echoTurn(text, false)
		case "compact":
			f.echoTurn(text, true)
		case "tool":
			f.toolTurn(text)
		case "permission":
			f.permissionTurn()
		case "question":
			f.questionTurn()
		case "slow":
			f.slowTurn()
		case "actions":
			f.actionsTurn(text)
		case "subagent":
			f.subagentTurn(text)
		case "bash_fail":
			f.bashFailTurn(text)
		case "writer":
			f.writerTurn(text)
		case "turn_error":
			f.failedTurn(text)
		case "retry":
			f.retryTurn(text)
		case "crash":
			f.emitInit()
			_, _ = fmt.Fprintln(os.Stderr, "boom")
			return exitCrash
		case "noinit":
			// Writes nothing at all, so the app waits for an init that never
			// arrives.
		default:
			fail("unknown scenario %q", scenario)
			return exitUsage
		}
	}
	return exitOK
}

// echoTurn answers with the text it was given. With compact, a compaction
// boundary comes first.
func (f *fake) echoTurn(text string, compact bool) {
	f.emitInit()
	messageID := f.nextID("msg")
	f.messageStart(messageID)
	if compact {
		f.emitRaw(map[string]any{
			"type":    "system",
			"subtype": "compact_boundary",
			"compact_metadata": map[string]any{
				"trigger":    "auto",
				"pre_tokens": 120000,
			},
			"session_id": f.sessionID,
		})
	}
	f.streamText(0, text)
	f.endMessage()
	f.assistantText(messageID, text)
	f.result("success", false, text, "completed")
}

// failedTurn fails the first turn the way an overloaded API fails one, and
// answers every later one like echo: the CLI lives on after a failed turn.
func (f *fake) failedTurn(text string) {
	if f.turns > 1 {
		f.echoTurn(text, false)
		return
	}
	f.emitInit()
	f.result("error_during_execution", true, "API Error: overloaded", "")
}

// RetryAttempts is how many api_retry events the retry scenario emits before
// its turn, and RetryError the error they carry.
const (
	RetryAttempts = 2
	RetryError    = "overloaded"
)

// retryTurn has the API fail RetryAttempts times, the way an overloaded API
// fails, and then answers like echo.
func (f *fake) retryTurn(text string) {
	f.emitInit()
	for attempt := 1; attempt <= RetryAttempts; attempt++ {
		f.emitRaw(map[string]any{
			"type":           "system",
			"subtype":        "api_retry",
			"attempt":        attempt,
			"max_retries":    10,
			"retry_delay_ms": 500,
			"error_status":   529,
			"error":          RetryError,
			"session_id":     f.sessionID,
		})
	}
	messageID := f.nextID("msg")
	f.messageStart(messageID)
	f.streamText(0, text)
	f.endMessage()
	f.assistantText(messageID, text)
	f.result("success", false, text, "completed")
}

// The markers that wrap a file a writer message asks for.
const (
	writeMarker = "@@write "
	endMarker   = "@@end"
)

// The permissions the writer scenario leaves on what it writes.
const (
	writerDirPerm  = 0o755
	writerFilePerm = 0o644
)

// fixedStep is the step file the writer scenario leaves behind when it is
// asked to fix a plan.
const fixedStep = "---\nrepository: %s\n---\n\n# Step 1: Fixed\n"

// writerTurn writes the files the message asks for and then answers like echo.
func (f *fake) writerTurn(text string) {
	wrote := f.writeBlocks(text)
	if path := os.Getenv(EnvWriterFix); path != "" && f.turns > 1 {
		f.writeFile(path, fmt.Sprintf(fixedStep, os.Getenv(EnvWriterRepo)))
	}

	reply := text
	if wrote {
		reply = "written"
	}
	f.echoTurn(reply, false)
}

// writeBlocks writes every file the message carries between the markers,
// reporting whether it carried any.
func (f *fake) writeBlocks(text string) bool {
	wrote := false
	for rest := text; ; {
		_, after, found := strings.Cut(rest, writeMarker)
		if !found {
			return wrote
		}
		path, body, found := strings.Cut(after, "\n")
		if !found {
			return wrote
		}
		content, remainder, found := cutBlock(body)
		if !found {
			return wrote
		}
		f.writeFile(strings.TrimSpace(path), content)
		wrote = true
		rest = remainder
	}
}

// cutBlock takes the body of a write block up to the @@end that closes it,
// skipping the blocks nested in it: a file the fake writes may itself be a
// prompt carrying write blocks, which is what a step file is.
func cutBlock(body string) (content, remainder string, found bool) {
	depth, offset := 0, 0
	for {
		rest := body[offset:]
		end := strings.Index(rest, endMarker)
		if end < 0 {
			return "", "", false
		}
		if start := strings.Index(rest, writeMarker); start >= 0 && start < end {
			depth++
			offset += start + len(writeMarker)
			continue
		}
		if depth == 0 {
			return body[:offset+end], rest[end+len(endMarker):], true
		}
		depth--
		offset += end + len(endMarker)
	}
}

// writeFile puts content at path, creating the folders above it.
//
//nolint:gosec // G703: writing where the message says to is what this scenario is for
func (f *fake) writeFile(path, content string) {
	if err := os.MkdirAll(filepath.Dir(path), writerDirPerm); err != nil {
		fail("create %s: %v", filepath.Dir(path), err)
		return
	}
	if err := os.WriteFile(path, []byte(content), writerFilePerm); err != nil {
		fail("write %s: %v", path, err)
	}
}

// toolTurn reads a file before answering with the text it was given.
func (f *fake) toolTurn(text string) {
	f.emitInit()
	messageID := f.nextID("msg")
	f.messageStart(messageID)

	toolUseID := f.nextID("toolu")
	input := map[string]any{"file_path": ReadPath}
	f.streamToolUse(0, messageID, toolUseID, "Read", input)
	f.toolResult(toolUseID, "1\thi\n")

	f.streamText(1, text)
	f.endMessage()
	f.assistantText(messageID, text)
	f.result("success", false, text, "completed")
}

// permissionTurn asks to run a Bash command and reacts to the answer.
func (f *fake) permissionTurn() {
	f.emitInit()
	messageID := f.nextID("msg")
	f.messageStart(messageID)

	toolUseID := f.nextID("toolu")
	input := map[string]any{"command": BashCommand, "description": "Create hello.txt with the word hi"}
	f.streamToolUse(0, messageID, toolUseID, "Bash", input)

	requestID := f.nextID("req")
	f.emitRaw(map[string]any{
		"type":       "control_request",
		"request_id": requestID,
		"request": map[string]any{
			"subtype":      "can_use_tool",
			"tool_name":    "Bash",
			"display_name": "Bash",
			"input":        input,
			"description":  "Create hello.txt with the word hi",
			"permission_suggestions": []any{
				map[string]any{
					"type":        "addRules",
					"rules":       []any{map[string]any{"toolName": "Bash", "ruleContent": BashCommand}},
					"behavior":    "allow",
					"destination": "localSettings",
				},
				map[string]any{
					"type":        "addDirectories",
					"directories": []any{"/tmp/fake"},
					"destination": "session",
				},
			},
			"blocked_path": ReadPath,
			"tool_use_id":  toolUseID,
		},
	})

	answer, ok := f.awaitPermission()
	if !ok {
		return
	}

	reply := "done"
	if answer.Behavior == "allow" {
		f.silentBashResult(toolUseID)
		// The app's rewrite of the suggestions is echoed so a test can read it.
		if len(answer.UpdatedPermissions) > 0 {
			reply += " " + string(answer.UpdatedPermissions)
		}
	} else {
		reply = "denied: " + answer.Message
	}

	f.streamText(1, reply)
	f.endMessage()
	f.assistantText(messageID, reply)
	f.result("success", false, reply, "completed")
}

// questionsInput is what the question scenario asks the user.
var questionsInput = map[string]any{
	"questions": []any{
		map[string]any{
			"question": "Which colour do you prefer?",
			"header":   "Color",
			"options": []any{
				map[string]any{"label": "Red", "description": "A warm, vibrant color"},
				map[string]any{"label": "Blue", "description": "A cool, calming color"},
			},
			"multiSelect": false,
		},
		map[string]any{
			"question": "Which fruits do you like?",
			"header":   "Fruits",
			"options": []any{
				map[string]any{"label": "Apple", "description": "A crisp and sweet fruit"},
				map[string]any{"label": "Pear", "description": "A soft and juicy fruit"},
			},
			"multiSelect": true,
		},
	},
}

// questionTurn asks a structured question and answers with what it got back.
func (f *fake) questionTurn() {
	f.emitInit()
	messageID := f.nextID("msg")
	f.messageStart(messageID)

	toolUseID := f.nextID("toolu")
	f.streamToolUse(0, messageID, toolUseID, "AskUserQuestion", questionsInput)

	requestID := f.nextID("req")
	f.emitRaw(map[string]any{
		"type":       "control_request",
		"request_id": requestID,
		"request": map[string]any{
			"subtype":                   "can_use_tool",
			"tool_name":                 "AskUserQuestion",
			"display_name":              "AskUserQuestion",
			"input":                     questionsInput,
			"tool_use_id":               toolUseID,
			"requires_user_interaction": true,
		},
	})

	answer, ok := f.awaitPermission()
	if !ok {
		return
	}

	var updated struct {
		Answers map[string]string `json:"answers"`
	}
	_ = json.Unmarshal(answer.UpdatedInput, &updated)
	reply := string(mustMarshal(updated.Answers))

	f.toolResult(toolUseID, "Your questions have been answered")
	f.streamText(1, reply)
	f.endMessage()
	f.assistantText(messageID, reply)
	f.result("success", false, reply, "completed")
}

// slowTurn streams forever and only stops on an interrupt, which leaves the
// session alive for the next message.
func (f *fake) slowTurn() {
	f.emitInit()
	f.messageStart(f.nextID("msg"))
	f.blockStart(0, map[string]any{"type": "text", "text": ""})

	ticker := time.NewTicker(tickInterval)
	defer ticker.Stop()

	for {
		select {
		case requestID, ok := <-f.interrupts:
			if !ok {
				return
			}
			f.emitRaw(map[string]any{
				"type": "control_response",
				"response": map[string]any{
					"subtype":    "success",
					"request_id": requestID,
					"response":   map[string]any{"still_queued": []any{}},
				},
			})
			f.userText("[Request interrupted by user]")
			f.result("error_during_execution", true, "", "aborted_streaming")
			return
		case <-ticker.C:
			f.textDelta(0, "tick ")
		}
	}
}

// actionsTurn runs two overlapping reads, stopping at a gate after each stage:
// 1, the first read starts; 2, the second read starts; 3, the second read ends;
// 4, the first read ends. Gate N releases stage N+1, and gate 4 releases the
// answer with its text. An interrupt at a gate aborts the turn.
func (f *fake) actionsTurn(text string) {
	f.emitInit()
	messageID := f.nextID("msg")
	f.messageStart(messageID)

	first, second := f.nextID("toolu"), f.nextID("toolu")
	stages := []func(){
		func() { f.streamToolUse(0, messageID, first, "Read", map[string]any{"file_path": ReadPath}) },
		func() { f.streamToolUse(1, messageID, second, "Read", map[string]any{"file_path": SecondReadPath}) },
		func() { f.toolResult(second, "1\tworld\n") },
		func() { f.toolResult(first, "1\thi\n") },
	}
	for i, stage := range stages {
		stage()
		if !f.awaitGate(fmt.Sprintf("%d-%d", f.turns, i+1)) {
			return
		}
	}
	f.streamText(2, text)
	f.endMessage()
	f.assistantText(messageID, text)
	f.result("success", false, text, "completed")
}

// subagentTurn delegates to a subagent that reads a file, runs a command and
// says what it found, then answers with the text it was given. The subagent
// streams a text delta the app ignores; its blocks arrive whole.
func (f *fake) subagentTurn(text string) {
	f.emitInit()
	messageID := f.nextID("msg")
	f.messageStart(messageID)

	agentID := f.nextID("toolu")
	f.streamToolUse(0, messageID, agentID, "Agent", map[string]any{
		"subagent_type": SubagentType,
		"description":   SubagentDescription,
		"prompt":        "Inspect the folder and report.",
	})

	subMessageID := f.nextID("msg")
	readID, bashID := f.nextID("toolu"), f.nextID("toolu")
	f.emit(map[string]any{
		"type":               "stream_event",
		"event":              map[string]any{"type": "content_block_start", "index": 0, "content_block": map[string]any{"type": "text", "text": ""}},
		"parent_tool_use_id": agentID,
	})
	f.toolUseWithParent(subMessageID, readID, "Read", map[string]any{"file_path": ReadPath}, agentID)
	f.toolResultWithParent(readID, "1\thi\n", agentID)
	f.toolUseWithParent(subMessageID, bashID, "Bash", map[string]any{"command": "ls -1", "description": "List the files"}, agentID)
	f.toolResultWithParent(bashID, "hello.txt", agentID)
	f.assistantTextWithParent(subMessageID, SubagentText, agentID)
	f.subagentResult(agentID, SubagentReport)

	f.streamText(1, text)
	f.endMessage()
	f.assistantText(messageID, text)
	f.result("success", false, text, "completed")
}

// bashFailTurn runs a command that fails with exit code 2, then answers with
// the text it was given.
func (f *fake) bashFailTurn(text string) {
	f.emitInit()
	messageID := f.nextID("msg")
	f.messageStart(messageID)

	toolUseID := f.nextID("toolu")
	f.streamToolUse(0, messageID, toolUseID, "Bash", map[string]any{
		"command":     FailingCommand,
		"description": FailingDescription,
	})
	f.toolResultError(toolUseID, "Exit code 2\n--- FAIL: TestX")

	f.streamText(1, text)
	f.endMessage()
	f.assistantText(messageID, text)
	f.result("success", false, text, "completed")
}

// awaitGate waits for the named file in EnvGates, reporting false when an
// interrupt aborted the turn or stdin ended first.
//
//nolint:gosec // G703: the gate lives where the test says it does
func (f *fake) awaitGate(name string) bool {
	path := filepath.Join(os.Getenv(EnvGates), name)
	ticker := time.NewTicker(gatePoll)
	defer ticker.Stop()

	for {
		if _, err := os.Stat(path); err == nil {
			return true
		}
		select {
		case requestID, ok := <-f.interrupts:
			if !ok {
				return false
			}
			f.emitRaw(map[string]any{
				"type": "control_response",
				"response": map[string]any{
					"subtype":    "success",
					"request_id": requestID,
					"response":   map[string]any{"still_queued": []any{}},
				},
			})
			f.userText("[Request interrupted by user]")
			f.result("error_during_execution", true, "", "aborted_streaming")
			return false
		case <-ticker.C:
		}
	}
}

// awaitPermission blocks until the app answers, reporting false when stdin
// ended first.
func (f *fake) awaitPermission() (permission, bool) {
	resp, ok := <-f.responses
	if !ok {
		return permission{}, false
	}
	var answer permission
	if err := json.Unmarshal(resp.body, &answer); err != nil {
		fail("undecodable permission response: %v", err)
		return permission{}, false
	}
	return answer, true
}

// emitInit opens a turn, as the real CLI does on every one of them.
func (f *fake) emitInit() {
	f.emitRaw(map[string]any{
		"type":                "system",
		"subtype":             "init",
		"session_id":          f.sessionID,
		"model":               Model,
		"cwd":                 workingDir(),
		"tools":               []string{"Bash", "Read", "Write", "AskUserQuestion"},
		"capabilities":        Capabilities,
		"claude_code_version": "0.0.0-fake",
		"permissionMode":      "auto",
	})
}

// messageStart opens the streamed message of a turn.
func (f *fake) messageStart(messageID string) {
	f.streamEvent(map[string]any{
		"type": "message_start",
		"message": map[string]any{
			"id":    messageID,
			"model": Model,
			"usage": usage(0),
		},
	})
}

// endMessage closes the streamed message of a turn.
func (f *fake) endMessage() {
	f.streamEvent(map[string]any{
		"type":  "message_delta",
		"delta": map[string]any{"stop_reason": "end_turn"},
		"usage": usage(64),
	})
	f.streamEvent(map[string]any{"type": "message_stop"})
}

// streamText streams a text block in deltaChunks pieces.
func (f *fake) streamText(index int, text string) {
	f.blockStart(index, map[string]any{"type": "text", "text": ""})
	for _, chunk := range splitWords(text, deltaChunks) {
		f.textDelta(index, chunk)
	}
	f.blockStop(index)
}

// streamToolUse streams a tool_use block and the assistant event that closes it.
func (f *fake) streamToolUse(index int, messageID, toolUseID, name string, input map[string]any) {
	f.blockStart(index, map[string]any{
		"type":  "tool_use",
		"id":    toolUseID,
		"name":  name,
		"input": map[string]any{},
	})
	encoded := mustMarshal(input)
	f.streamEvent(map[string]any{
		"type":  "content_block_delta",
		"index": index,
		"delta": map[string]any{"type": "input_json_delta", "partial_json": string(encoded)},
	})
	f.blockStop(index)
	f.emit(map[string]any{
		"type": "assistant",
		"message": map[string]any{
			"id":      messageID,
			"model":   Model,
			"role":    "assistant",
			"type":    "message",
			"content": []any{map[string]any{"type": "tool_use", "id": toolUseID, "name": name, "input": input}},
		},
		"parent_tool_use_id": nil,
	})
}

// blockStart opens a content block.
func (f *fake) blockStart(index int, block map[string]any) {
	f.streamEvent(map[string]any{
		"type":          "content_block_start",
		"index":         index,
		"content_block": block,
	})
}

// blockStop closes a content block.
func (f *fake) blockStop(index int) {
	f.streamEvent(map[string]any{"type": "content_block_stop", "index": index})
}

// textDelta streams one piece of a text block.
func (f *fake) textDelta(index int, text string) {
	f.streamEvent(map[string]any{
		"type":  "content_block_delta",
		"index": index,
		"delta": map[string]any{"type": "text_delta", "text": text},
	})
}

// assistantText emits the authoritative version of a text block.
func (f *fake) assistantText(messageID, text string) {
	f.emit(map[string]any{
		"type": "assistant",
		"message": map[string]any{
			"id":      messageID,
			"model":   Model,
			"role":    "assistant",
			"type":    "message",
			"content": []any{map[string]any{"type": "text", "text": text}},
		},
		"parent_tool_use_id": nil,
	})
}

// toolUseWithParent emits a whole tool_use block of a subagent.
func (f *fake) toolUseWithParent(messageID, toolUseID, name string, input map[string]any, parent string) {
	f.emit(map[string]any{
		"type": "assistant",
		"message": map[string]any{
			"id":      messageID,
			"model":   Model,
			"role":    "assistant",
			"type":    "message",
			"content": []any{map[string]any{"type": "tool_use", "id": toolUseID, "name": name, "input": input}},
		},
		"parent_tool_use_id": parent,
	})
}

// assistantTextWithParent emits a whole text block of a subagent.
func (f *fake) assistantTextWithParent(messageID, text, parent string) {
	f.emit(map[string]any{
		"type": "assistant",
		"message": map[string]any{
			"id":      messageID,
			"model":   Model,
			"role":    "assistant",
			"type":    "message",
			"content": []any{map[string]any{"type": "text", "text": text}},
		},
		"parent_tool_use_id": parent,
	})
}

// toolResultError emits a tool that failed, as the CLI reports it.
func (f *fake) toolResultError(toolUseID, content string) {
	f.emit(map[string]any{
		"type": "user",
		"message": map[string]any{
			"role": "user",
			"content": []any{map[string]any{
				"type":        "tool_result",
				"tool_use_id": toolUseID,
				"content":     content,
				"is_error":    true,
			}},
		},
		"parent_tool_use_id": nil,
		"tool_use_result":    "Error: " + content,
	})
}

// toolResult emits what a tool returned to the agent.
func (f *fake) toolResult(toolUseID, content string) {
	f.emit(map[string]any{
		"type": "user",
		"message": map[string]any{
			"role": "user",
			"content": []any{map[string]any{
				"type":        "tool_result",
				"tool_use_id": toolUseID,
				"content":     content,
				"is_error":    false,
			}},
		},
		"parent_tool_use_id": nil,
		"tool_use_result":    map[string]any{"stdout": content, "stderr": ""},
	})
}

// silentBashResult emits a command that printed nothing, as the CLI reports
// it: a placeholder in the text and empty streams in the structured result.
func (f *fake) silentBashResult(toolUseID string) {
	f.emit(map[string]any{
		"type": "user",
		"message": map[string]any{
			"role": "user",
			"content": []any{map[string]any{
				"type":        "tool_result",
				"tool_use_id": toolUseID,
				"content":     "(Bash completed with no output)",
				"is_error":    false,
			}},
		},
		"parent_tool_use_id": nil,
		"tool_use_result":    map[string]any{"stdout": "", "stderr": "", "interrupted": false, "noOutputExpected": true},
	})
}

// toolResultWithParent emits what a tool of a subagent returned to it. The
// CLI gives no structured result off the main thread.
func (f *fake) toolResultWithParent(toolUseID, content, parent string) {
	f.emit(map[string]any{
		"type": "user",
		"message": map[string]any{
			"role": "user",
			"content": []any{map[string]any{
				"type":        "tool_result",
				"tool_use_id": toolUseID,
				"content":     content,
				"is_error":    false,
			}},
		},
		"parent_tool_use_id": parent,
	})
}

// subagentResult emits the hand-back of a subagent, as the CLI reports it: the
// report inside the harness frame in the text, and alone in the structured
// result.
func (f *fake) subagentResult(toolUseID, report string) {
	framed := "[Subagent hand-back] The report follows:\n  " + report +
		"\nagentId: a0fake (use SendMessage to continue this agent)\n<usage>tool_uses: 2</usage>"
	f.emit(map[string]any{
		"type": "user",
		"message": map[string]any{
			"role": "user",
			"content": []any{map[string]any{
				"type":        "tool_result",
				"tool_use_id": toolUseID,
				"content":     []any{map[string]any{"type": "text", "text": framed}},
			}},
		},
		"parent_tool_use_id": nil,
		"tool_use_result": map[string]any{
			"status":  "completed",
			"content": []any{map[string]any{"type": "text", "text": report}},
		},
	})
}

// userText emits a synthetic user message, as the CLI does on an interrupt.
func (f *fake) userText(text string) {
	f.emit(map[string]any{
		"type": "user",
		"message": map[string]any{
			"role":    "user",
			"content": []any{map[string]any{"type": "text", "text": text}},
		},
		"parent_tool_use_id": nil,
	})
}

// result closes a turn.
func (f *fake) result(subtype string, isError bool, text, terminalReason string) {
	f.emit(map[string]any{
		"type":               "result",
		"subtype":            subtype,
		"is_error":           isError,
		"result":             text,
		"stop_reason":        nil,
		"terminal_reason":    terminalReason,
		"num_turns":          f.turns,
		"total_cost_usd":     0.01,
		"usage":              usage(64),
		"modelUsage":         map[string]any{Model: map[string]any{"contextWindow": ContextWindow}},
		"permission_denials": []any{},
	})
}

// streamEvent wraps a partial message event in its envelope.
func (f *fake) streamEvent(event map[string]any) {
	f.emit(map[string]any{"type": "stream_event", "event": event})
}

// emit writes one line, adding the fields every session line carries.
func (f *fake) emit(line map[string]any) {
	line["session_id"] = f.sessionID
	line["uuid"] = f.nextID("uuid")
	f.emitRaw(line)
}

// emitRaw writes one line exactly as given, serialised against the read
// goroutine, which answers control requests of its own.
func (f *fake) emitRaw(line map[string]any) {
	f.outMu.Lock()
	defer f.outMu.Unlock()

	if err := f.encoder.Encode(line); err != nil {
		fail("encode line: %v", err)
	}
}

// nextID mints an id that is unique within this run and readable in a failure.
func (f *fake) nextID(prefix string) string {
	f.seq++
	return fmt.Sprintf("%s_fake_%d", prefix, f.seq)
}

// usage is a plausible token count for a turn.
func usage(output int) map[string]any {
	return map[string]any{
		"input_tokens":                10,
		"cache_creation_input_tokens": 100,
		"cache_read_input_tokens":     1000,
		"output_tokens":               output,
	}
}

// workingDir is the directory the fake was started in.
func workingDir() string {
	dir, err := os.Getwd()
	if err != nil {
		return ""
	}
	return dir
}

// splitWords cuts text into n chunks at word boundaries; joining the chunks
// back together gives text again.
func splitWords(text string, n int) []string {
	words := strings.SplitAfter(text, " ")
	chunks := make([]string, n)
	for i, word := range words {
		chunks[i*n/len(words)] += word
	}
	return chunks
}

// mustMarshal encodes a value the fake itself built, which json cannot fail on.
func mustMarshal(value any) []byte {
	encoded, err := json.Marshal(value)
	if err != nil {
		panic(fmt.Sprintf("claudetest: marshal: %v", err))
	}
	return encoded
}
