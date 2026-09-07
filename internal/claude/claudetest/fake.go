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
	"time"
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
)

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

// BashCommand is the command the permission scenario asks to run.
const BashCommand = `echo "hi" > hello.txt`

// Capabilities is what the fake announces in system/init.
var Capabilities = []string{"interrupt_receipt_v1", "interrupt_cancel_queued_v1", "msg_lifecycle_v1"}

// deltaChunks is how many text deltas a streamed text block is cut into.
const deltaChunks = 3

// tickInterval is how often the slow scenario emits a text delta.
const tickInterval = 100 * time.Millisecond

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
	if (flagValue(args, "--session-id") == "") == (flagValue(args, "--resume") == "") {
		return errors.New("exactly one of --session-id and --resume is required")
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
			if line.Request.Subtype == "interrupt" {
				f.interrupts <- line.RequestID
			}
		case "control_response":
			f.responses <- response{requestID: line.Response.RequestID, body: line.Response.Response}
		default:
			fail("unexpected input line type %q", line.Type)
		}
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
		case "writer":
			f.writerTurn(text)
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
		content, remainder, found := strings.Cut(body, endMarker)
		if !found {
			return wrote
		}
		f.writeFile(strings.TrimSpace(path), content)
		wrote = true
		rest = remainder
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
	f.toolResult(toolUseID, "1\thi\n", false)

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
		f.toolResult(toolUseID, "(Bash completed with no output)", false)
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

	f.toolResult(toolUseID, "Your questions have been answered", false)
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

// toolResult emits what a tool returned to the agent.
func (f *fake) toolResult(toolUseID, content string, isError bool) {
	f.emit(map[string]any{
		"type": "user",
		"message": map[string]any{
			"role": "user",
			"content": []any{map[string]any{
				"type":        "tool_result",
				"tool_use_id": toolUseID,
				"content":     content,
				"is_error":    isError,
			}},
		},
		"parent_tool_use_id": nil,
		"tool_use_result":    map[string]any{"stdout": content, "stderr": ""},
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

// emitRaw writes one line exactly as given.
func (f *fake) emitRaw(line map[string]any) {
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
