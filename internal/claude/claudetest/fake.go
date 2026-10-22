// Package claudetest is a fake Claude Code CLI. The tests of the packages that
// drive the real one run it as an auxiliary process: a test binary whose
// TestMain hands over to Run when EnvFlag is set behaves as the CLI, speaking
// the same stream-json protocol on stdin and stdout.
package claudetest

import (
	"bufio"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strconv"
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
	// EnvVersion is what `--version` prints; empty prints MinVersion as the CLI
	// writes it, "2.1.291 (Claude Code)".
	EnvVersion = "MYSPEC_FAKE_VERSION"
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
	// EnvArgv set to "1" makes the fake print its command line on stderr, one
	// argument per line, and exit, which is how a test sees the flags a process
	// got.
	EnvArgv = "MYSPEC_FAKE_ARGV"
	// EnvSleep set to "1" makes the fake sleep until it is killed, which is the
	// process the spawn scenario starts.
	EnvSleep = "MYSPEC_FAKE_SLEEP"
	// EnvPidFile is the file the spawn scenario writes the pid of the process it
	// started to.
	EnvPidFile = "MYSPEC_FAKE_PIDFILE"
	// EnvStop set to "refuse" makes the fake refuse every stop_task.
	EnvStop = "MYSPEC_FAKE_STOP"
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
	SubagentNarration   = "Let me look at the folder first."
	SubagentText        = "The folder holds hello.txt."
	SubagentReport      = "hello.txt says hi."
	FailingCommand      = "go test ./...\ngo vet ./..."
	FailingDescription  = "Run the tests"
)

// The narration scenario: what the agent narrates, then says.
const (
	Narration       = "Two things don't match: the card says weekly, the spec says daily."
	NarrationAnswer = "Which one is right?"
)

// BackgroundOutput is the whole output the fake keeps on disk for a command or
// monitor that ends, which the task_notification names in output_file.
const BackgroundOutput = "line 1\nline 2\n"

// taskTail is what get_task_output answers for a task the fake knows.
const taskTail = "tick 1\ntick 2\n"

// fakeSignature is the signature the thinking blocks of the fake carry.
const fakeSignature = "c2lnbmF0dXJl"

// The background scenario: a command and a subagent it leaves running, a
// command in the foreground, and what the agent says when it resumes.
const (
	BackgroundCommandDescription = "Run the tests"
	BackgroundAgentDescription   = "Survey the repository"
	ForegroundDescription        = "List the files"
	BackgroundExitCode           = 1
	BackgroundResumeText         = "Looking at the failed tests."
	BackgroundAgentText          = "The repository holds one module."
)

// The scenarios of the work in the background.
const (
	BackgroundAgentA     = "Survey the API"
	BackgroundAgentB     = "Survey the store"
	BackgroundAgentAText = "The API is done."
	BackgroundAgentBText = "Both surveys are done."
	BackgroundServer     = "Start the dev server"
	MonitorTimed         = "Wait for CI"
	MonitorTimedMS       = 1000
	MonitorPersistent    = "Watch the logs"
	MonitorEventText     = "CI moved on."
	MonitorDoneText      = "CI is green."
	PromotedDescription  = "Run the long build"
)

// Capabilities is what the fake announces in system/init.
var Capabilities = []string{"interrupt_receipt_v1", "interrupt_cancel_queued_v1", "msg_lifecycle_v1"}

// deltaChunks is how many text deltas a streamed text block is cut into.
const deltaChunks = 3

// tickInterval is how often the slow scenarios emit a delta.
const tickInterval = 100 * time.Millisecond

// gatePoll is how often the actions scenario looks for its next gate.
const gatePoll = 5 * time.Millisecond

// queueSize buffers what the stdin reader hands to the scenario, so a slow
// scenario never stops the fake from reading its input.
const queueSize = 16

// maxLine is the largest stdin line the fake accepts.
const maxLine = 64 << 20

// Run plays the scenario named by EnvScenario against stdin and stdout and
// returns the exit code the fake CLI should end with.
func Run() int {
	if os.Getenv(EnvSleep) == "1" {
		select {}
	}

	args := os.Args[1:]
	if os.Getenv(EnvArgv) == "1" {
		for _, arg := range args {
			_, _ = fmt.Fprintln(os.Stderr, arg)
		}
		return exitOK
	}
	if len(args) >= 1 && args[0] == "--version" {
		return version()
	}
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

// version answers `--version`.
func version() int {
	out := os.Getenv(EnvVersion)
	if out == "" {
		out = claude.MinVersion + " (Claude Code)"
	}
	_, _ = fmt.Fprintln(os.Stdout, out)
	return exitOK
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
	seqMu      sync.Mutex
	turns      int
	liveMu     sync.Mutex
	live       map[string]liveTask
}

// liveTask is a task in the background the fake launched and has not ended.
type liveTask struct {
	runID       string
	toolUseID   string
	description string
	taskType    string
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
		live:       map[string]liveTask{},
	}
}

// stdinLine is every field of an input line the fake reacts to.
type stdinLine struct {
	Type      string `json:"type"`
	RequestID string `json:"request_id"`
	Message   struct {
		Content []struct {
			Type   string `json:"type"`
			Text   string `json:"text"`
			Source struct {
				MediaType string `json:"media_type"`
				Data      string `json:"data"`
			} `json:"source"`
		} `json:"content"`
	} `json:"message"`
	Request struct {
		Subtype string `json:"subtype"`
		TaskID  string `json:"task_id"`
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
				if block.Type == "image" {
					size := base64.StdEncoding.DecodedLen(len(block.Source.Data))
					if decoded, err := base64.StdEncoding.DecodeString(block.Source.Data); err == nil {
						size = len(decoded)
					}
					text = append(text, fmt.Sprintf("[image %s %d]", block.Source.MediaType, size))
					continue
				}
				text = append(text, block.Text)
			}
			f.users <- strings.Join(text, "")
		case "control_request":
			switch line.Request.Subtype {
			case "interrupt":
				f.interrupts <- line.RequestID
			case "list_models":
				f.answerListModels(line.RequestID)
			case "initialize":
				f.answer(line.RequestID, map[string]any{})
			case "stop_task":
				f.stopTask(line.RequestID, line.Request.TaskID)
			case "get_task_output":
				f.taskOutput(line.RequestID, line.Request.TaskID)
			}
		case "control_response":
			f.responses <- response{requestID: line.Response.RequestID, body: line.Response.Response}
		default:
			fail("unexpected input line type %q", line.Type)
		}
	}
}

// answer emits a successful control response.
func (f *fake) answer(requestID string, body map[string]any) {
	f.emitRaw(map[string]any{
		"type": "control_response",
		"response": map[string]any{
			"subtype":    "success",
			"request_id": requestID,
			"response":   body,
		},
	})
}

// answerError emits a failed control response.
func (f *fake) answerError(requestID, message string) {
	f.emitRaw(map[string]any{
		"type": "control_response",
		"response": map[string]any{
			"subtype":    "error",
			"request_id": requestID,
			"error":      message,
		},
	})
}

// stopTask stops a task the way the CLI does: the task is killed and reported
// stopped, the set of background tasks loses it, and only then comes the answer.
// EnvStop "refuse" refuses instead.
func (f *fake) stopTask(requestID, taskID string) {
	if os.Getenv(EnvStop) == "refuse" {
		f.answerError(requestID, "Task cannot be stopped")
		return
	}
	f.liveMu.Lock()
	task, ok := f.live[taskID]
	f.liveMu.Unlock()
	if !ok {
		f.answerError(requestID, "No task found with ID: "+taskID)
		return
	}
	f.emit(map[string]any{
		"type":    "system",
		"subtype": "task_updated",
		"task_id": taskID,
		"run_id":  task.runID,
		"patch":   map[string]any{"status": "killed"},
	})
	f.taskNotification(taskID, task.runID, task.toolUseID, "stopped", task.description)
	f.liveMu.Lock()
	rest := make([]string, 0, len(f.live))
	for id := range f.live {
		rest = append(rest, id)
	}
	f.liveMu.Unlock()
	slices.Sort(rest)
	f.backgroundTasks(rest...)
	f.answer(requestID, map[string]any{})
}

// taskOutput answers the end of the output of a task the fake launched.
func (f *fake) taskOutput(requestID, taskID string) {
	f.liveMu.Lock()
	_, ok := f.live[taskID]
	f.liveMu.Unlock()
	if !ok {
		f.answerError(requestID, "No task found with ID: "+taskID)
		return
	}
	f.answer(requestID, map[string]any{"output": taskTail, "total_bytes": len(taskTail), "truncated": false})
}

// outputFile is where the fake keeps the whole output of a task.
func (f *fake) outputFile(taskID string) string {
	return filepath.Join(os.TempDir(), fmt.Sprintf("myspec-fake-%d-%s.output", os.Getpid(), taskID))
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
//
// The bg_* scenarios leave work in the background; each gate is a file named
// "<turn>-<k>" in EnvGates:
//   - bg_agents: two subagents, A and B; gate 1 returns A and the agent resumes
//     for it, gate 2 returns B, then the CLI runs an empty turn. Each return
//     comes after the set of background tasks without the task.
//   - bg_command: a command that never ends; no gates.
//   - bg_monitor: a monitor with a timeout and a persistent one; gate 1 is an
//     event of a monitor, gate 2 the end of the timed one and its empty turn.
//   - bg_permission: a subagent; gate 1 opens a turn that asks permission for
//     a command, gate 2 returns the subagent and its empty turn.
//   - bg_silent: a subagent; gate 1 ends it with no turn after, gate 2 is the
//     empty turn alone.
//   - bg_level: a command; gate 1 reports the set of background tasks empty,
//     with no task_notification.
//   - bg_promoted: a command that starts in the foreground and is moved to the
//     background; gate 1 ends it and the agent resumes for it.
//   - bg_live_agent: a subagent and a command that never ends; gate 1 is the
//     narration and a Read of the subagent, gate 2 its report and its end.
//   - bg_permission_sub: a subagent that asks permission for a command, in the
//     turn that launched it; no gates.
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
			f.slowTurn(false)
		case "slow_narration":
			f.slowTurn(true)
		case "narration":
			f.narrationTurn()
		case "spawn":
			f.spawnTurn()
		case "actions":
			f.actionsTurn(text)
		case "subagent":
			f.subagentTurn(text)
		case "background":
			f.backgroundTurn(text)
		case "bg_agents":
			f.bgAgentsTurn(text)
		case "bg_command":
			f.bgCommandTurn(text)
		case "bg_monitor":
			f.bgMonitorTurn(text)
		case "bg_permission":
			f.bgPermissionTurn(text)
		case "bg_silent":
			f.bgSilentTurn(text)
		case "bg_level":
			f.bgLevelTurn(text)
		case "bg_promoted":
			f.bgPromotedTurn(text)
		case "bg_live_agent":
			f.bgLiveAgentTurn(text)
		case "bg_permission_sub":
			f.bgPermissionSubTurn(text)
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

	f.askBash(toolUseID, input)

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

// askBash asks the app to allow a Bash call, with the suggestions of a rule for
// the command and of access to the folder.
func (f *fake) askBash(toolUseID string, input map[string]any) {
	f.askBashAs(toolUseID, input, "")
}

// askBashAs is askBash for a subagent, named by its task id; "" asks as the
// main thread.
func (f *fake) askBashAs(toolUseID string, input map[string]any, agentID string) {
	requestID := f.nextID("req")
	request := map[string]any{
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
	}
	if agentID != "" {
		request["agent_id"] = agentID
	}
	f.emitRaw(map[string]any{
		"type":       "control_request",
		"request_id": requestID,
		"request":    request,
	})
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

// narrationTurn narrates, then asks, in one message: block 0 is internal
// reasoning, with only its signature; block 1 is a thinking block of blanks;
// block 2 is redacted; block 3 is the narration and block 4 the text.
func (f *fake) narrationTurn() {
	f.emitInit()
	messageID := f.nextID("msg")
	f.messageStart(messageID)
	f.streamThinking(0, messageID, "")
	f.streamThinking(1, messageID, " \n\t ")
	f.redactedThinking(2, messageID)
	f.streamThinking(3, messageID, Narration)
	f.streamText(4, NarrationAnswer)
	f.endMessage()
	f.assistantText(messageID, NarrationAnswer)
	f.result("success", false, NarrationAnswer, "completed")
}

// slowTurn streams forever and only stops on an interrupt, which leaves the
// session alive for the next message. With thinking, what grows is a
// narration instead of a text.
func (f *fake) slowTurn(thinking bool) {
	f.emitInit()
	f.messageStart(f.nextID("msg"))
	if thinking {
		f.blockStart(0, map[string]any{"type": "thinking", "thinking": "", "signature": ""})
	} else {
		f.blockStart(0, map[string]any{"type": "text", "text": ""})
	}

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
			if thinking {
				f.thinkingDelta(0, "tick ")
			} else {
				f.textDelta(0, "tick ")
			}
		}
	}
}

// spawnTurn starts a process of its own, as the shells of the real CLI are,
// records its pid in EnvPidFile and streams a text delta, then waits without
// ending the turn until it is killed.
func (f *fake) spawnTurn() {
	//nolint:gosec // G204: it runs this very binary, as the fake CLI does everywhere
	child := exec.Command(os.Args[0])
	child.Env = append(os.Environ(), EnvFlag+"=1", EnvSleep+"=1")
	if err := child.Start(); err != nil {
		fail("start the spawned process: %v", err)
		return
	}
	pid := strconv.Itoa(child.Process.Pid)
	//nolint:gosec // G703: the path is the test's own pid file
	if err := os.WriteFile(os.Getenv(EnvPidFile), []byte(pid), 0o600); err != nil {
		fail("write the pid file: %v", err)
		return
	}

	f.emitInit()
	f.messageStart(f.nextID("msg"))
	f.blockStart(0, map[string]any{"type": "text", "text": ""})
	f.textDelta(0, "spawned ")
	select {}
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

// subagentTurn delegates to a subagent that reads a file, runs a command,
// narrates and then says what it found, then answers with the text it was given. The subagent
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
	f.assistantThinkingWithParent(subMessageID, SubagentNarration, agentID)
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

// backgroundTurn leaves a command and a subagent running in the background and
// runs a command in the foreground, then plays what comes of them, stopping at
// a gate after each stage: 1, the command fails while the turn is open and the
// turn answers; 2, the agent resumes on its own, with no return waiting; 3, that
// turn ends, its origin naming the command; 4, the subagent reports back and
// the agent resumes for it; 5, that turn ends, and the CLI runs an empty turn
// of its own. An interrupt at a gate aborts the scenario.
func (f *fake) backgroundTurn(text string) {
	n := f.turns
	cmd, agent, fg := fmt.Sprintf("task-%d-cmd", n), fmt.Sprintf("task-%d-agent", n), fmt.Sprintf("task-%d-fg", n)
	cmdRun, agentRun, fgRun := fmt.Sprintf("run-%d-cmd", n), fmt.Sprintf("run-%d-agent", n), fmt.Sprintf("run-%d-fg", n)
	gate := func(k int) bool { return f.awaitGate(fmt.Sprintf("%d-%d", n, k)) }

	f.emitInit()
	f.status()
	m1 := f.nextID("msg")
	f.messageStart(m1)

	cmdUse := f.nextID("toolu")
	f.streamToolUse(0, m1, cmdUse, "Bash", map[string]any{
		"command":           "go test ./...",
		"description":       BackgroundCommandDescription,
		"run_in_background": true,
	})
	f.taskStarted(cmd, cmdRun, cmdUse, BackgroundCommandDescription, "local_bash", true)
	f.toolResult(cmdUse, "Command running in background with ID: "+cmd+".")

	agentUse := f.nextID("toolu")
	f.streamToolUse(1, m1, agentUse, "Agent", map[string]any{
		"description":       BackgroundAgentDescription,
		"subagent_type":     SubagentType,
		"prompt":            "Survey the repository.",
		"run_in_background": true,
	})
	f.taskStarted(agent, agentRun, agentUse, BackgroundAgentDescription, "local_agent", true)
	f.toolResult(agentUse, "Async agent launched successfully.")

	fgUse := f.nextID("toolu")
	f.streamToolUse(2, m1, fgUse, "Bash", map[string]any{"command": "ls -1", "description": ForegroundDescription})
	f.taskStarted(fg, fgRun, fgUse, ForegroundDescription, "local_bash", false)
	f.taskNotification(fg, fgRun, fgUse, "completed", ForegroundDescription)
	f.toolResult(fgUse, "hello.txt")
	if !gate(1) {
		return
	}

	f.taskNotification(cmd, cmdRun, cmdUse, "failed",
		fmt.Sprintf("Background command %q failed with exit code %d", BackgroundCommandDescription, BackgroundExitCode))
	f.streamText(3, text)
	f.endMessage()
	f.assistantText(m1, text)
	f.result("success", false, text, "completed")

	if !gate(2) {
		return
	}
	f.emitInit()
	f.status()
	m2 := f.nextID("msg")
	f.messageStart(m2)
	f.streamText(0, BackgroundResumeText)
	f.endMessage()
	f.assistantText(m2, BackgroundResumeText)
	if !gate(3) {
		return
	}
	f.originResult(BackgroundResumeText, 1, map[string]any{"kind": "task-notification", "producer": "session-task", "runId": cmdRun})

	if !gate(4) {
		return
	}
	f.taskNotification(agent, agentRun, agentUse, "completed", "This agent's report was delivered to you as a message.")
	f.emitInit()
	f.status()
	m3 := f.nextID("msg")
	f.messageStart(m3)
	f.streamText(0, BackgroundAgentText)
	f.endMessage()
	f.assistantText(m3, BackgroundAgentText)
	if !gate(5) {
		return
	}
	f.originResult(BackgroundAgentText, 1, map[string]any{"kind": "peer", "from": agent, "senderTaskId": agent})

	f.emitInit()
	f.originResult("", 0, map[string]any{"kind": "task-notification", "producer": "session-task", "runId": agentRun})
}

// bgLaunchAgent starts a subagent in the background from the tool call at the
// given block index of the message, and returns its task and run ids.
func (f *fake) bgLaunchAgent(index int, messageID, description, name string) (taskID, runID, toolUseID string) {
	taskID, runID = fmt.Sprintf("task-%d-%s", f.turns, name), fmt.Sprintf("run-%d-%s", f.turns, name)
	toolUseID = f.nextID("toolu")
	f.streamToolUse(index, messageID, toolUseID, "Agent", map[string]any{
		"description":       description,
		"subagent_type":     SubagentType,
		"prompt":            description + ".",
		"run_in_background": true,
	})
	f.taskStarted(taskID, runID, toolUseID, description, "local_agent", true)
	f.toolResult(toolUseID, "Async agent launched successfully.")
	return taskID, runID, toolUseID
}

// bgLaunchCommand starts a command in the background, as bgLaunchAgent does a
// subagent.
func (f *fake) bgLaunchCommand(index int, messageID string) (taskID string) {
	taskID = fmt.Sprintf("task-%d-cmd", f.turns)
	runID := fmt.Sprintf("run-%d-cmd", f.turns)
	toolUseID := f.nextID("toolu")
	f.streamToolUse(index, messageID, toolUseID, "Bash", map[string]any{
		"command":           "npm run dev",
		"description":       BackgroundServer,
		"run_in_background": true,
	})
	f.taskStarted(taskID, runID, toolUseID, BackgroundServer, "local_bash", true)
	f.toolResult(toolUseID, "Command running in background with ID: "+taskID+".")
	return taskID
}

// bgClose says the text of the turn and closes it.
func (f *fake) bgClose(messageID string, index int, text string) {
	f.streamText(index, text)
	f.endMessage()
	f.assistantText(messageID, text)
	f.result("success", false, text, "completed")
}

// bgResume is a turn the agent opens on its own: it says the text, and the
// result names what opened it.
func (f *fake) bgResume(text string, origin map[string]any) {
	f.emitInit()
	f.status()
	messageID := f.nextID("msg")
	f.messageStart(messageID)
	f.streamText(0, text)
	f.endMessage()
	f.assistantText(messageID, text)
	f.originResult(text, 1, origin)
}

// bgReturn is the end of a task and the turn the agent opens for it.
func (f *fake) bgReturn(taskID, runID, toolUseID, text string) {
	f.taskNotification(taskID, runID, toolUseID, "completed", "The task is done.")
	f.bgResume(text, map[string]any{"kind": "task-notification", "producer": "session-task", "runId": runID})
}

// bgEmptyTurn is the turn the CLI runs on its own after a task ends, with
// nothing to say.
func (f *fake) bgEmptyTurn(runID string) {
	f.emitInit()
	f.originResult("", 0, map[string]any{"kind": "task-notification", "producer": "session-task", "runId": runID})
}

// bgAgentsTurn launches two subagents and ends. Gate 1: A leaves the set of
// background tasks, returns, and the agent resumes for it. Gate 2: B leaves the
// set, returns, and the CLI runs an empty turn.
func (f *fake) bgAgentsTurn(text string) {
	n := f.turns
	gate := func(k int) bool { return f.awaitGate(fmt.Sprintf("%d-%d", n, k)) }

	f.emitInit()
	f.status()
	m1 := f.nextID("msg")
	f.messageStart(m1)
	a, aRun, aUse := f.bgLaunchAgent(0, m1, BackgroundAgentA, "a")
	b, bRun, bUse := f.bgLaunchAgent(1, m1, BackgroundAgentB, "b")
	f.bgClose(m1, 2, text)

	if !gate(1) {
		return
	}
	f.backgroundTasks(b)
	f.bgReturn(a, aRun, aUse, BackgroundAgentAText)

	if !gate(2) {
		return
	}
	f.backgroundTasks()
	f.bgReturn(b, bRun, bUse, BackgroundAgentBText)
	f.bgEmptyTurn(bRun)
}

// bgCommandTurn launches a command that never ends and ends the turn.
func (f *fake) bgCommandTurn(text string) {
	f.emitInit()
	f.status()
	m1 := f.nextID("msg")
	f.messageStart(m1)
	f.bgLaunchCommand(0, m1)
	f.bgClose(m1, 1, text)
}

// bgMonitorTurn starts a monitor with a timeout and a persistent one and ends
// the turn. Gate 1: an event of a monitor opens a turn. Gate 2: the timed one
// ends, the agent resumes for it, and the CLI runs an empty turn.
func (f *fake) bgMonitorTurn(text string) {
	n := f.turns
	gate := func(k int) bool { return f.awaitGate(fmt.Sprintf("%d-%d", n, k)) }

	f.emitInit()
	f.status()
	m1 := f.nextID("msg")
	f.messageStart(m1)

	timed, timedRun := fmt.Sprintf("task-%d-timed", n), fmt.Sprintf("run-%d-timed", n)
	timedUse := f.nextID("toolu")
	f.streamToolUse(0, m1, timedUse, "Monitor", map[string]any{
		"description": MonitorTimed,
		"timeout_ms":  MonitorTimedMS,
		"command":     "gh run watch",
	})
	f.taskStarted(timed, timedRun, timedUse, MonitorTimed, "local_bash", true)
	f.toolResult(timedUse, "Monitor started with ID: "+timed+".")

	persistent, persistentRun := fmt.Sprintf("task-%d-persistent", n), fmt.Sprintf("run-%d-persistent", n)
	persistentUse := f.nextID("toolu")
	f.streamToolUse(1, m1, persistentUse, "Monitor", map[string]any{
		"description": MonitorPersistent,
		"persistent":  true,
		"command":     "tail -f app.log",
	})
	f.taskStarted(persistent, persistentRun, persistentUse, MonitorPersistent, "local_bash", true)
	f.toolResult(persistentUse, "Monitor started with ID: "+persistent+".")
	f.bgClose(m1, 2, text)

	if !gate(1) {
		return
	}
	f.bgResume(MonitorEventText, map[string]any{"kind": "task-notification"})

	if !gate(2) {
		return
	}
	f.bgReturn(timed, timedRun, timedUse, MonitorDoneText)
	f.bgEmptyTurn(timedRun)
}

// bgPermissionTurn launches a subagent and ends the turn. Gate 1: a turn the
// agent opens asks permission to run a command. Gate 2: the subagent returns,
// and the CLI runs an empty turn.
func (f *fake) bgPermissionTurn(text string) {
	n := f.turns
	gate := func(k int) bool { return f.awaitGate(fmt.Sprintf("%d-%d", n, k)) }

	f.emitInit()
	f.status()
	m1 := f.nextID("msg")
	f.messageStart(m1)
	a, aRun, aUse := f.bgLaunchAgent(0, m1, BackgroundAgentA, "a")
	f.bgClose(m1, 1, text)

	if !gate(1) {
		return
	}
	f.emitInit()
	f.status()
	m2 := f.nextID("msg")
	f.messageStart(m2)
	toolUseID := f.nextID("toolu")
	input := map[string]any{"command": BashCommand, "description": "Create hello.txt with the word hi"}
	f.streamToolUse(0, m2, toolUseID, "Bash", input)
	f.askBash(toolUseID, input)

	answer, ok := f.awaitPermission()
	if !ok {
		return
	}
	reply := "done"
	if answer.Behavior == "allow" {
		f.silentBashResult(toolUseID)
	} else {
		reply = "denied: " + answer.Message
	}
	f.streamText(1, reply)
	f.endMessage()
	f.assistantText(m2, reply)
	f.result("success", false, reply, "completed")

	if !gate(2) {
		return
	}
	f.bgReturn(a, aRun, aUse, BackgroundAgentAText)
	f.bgEmptyTurn(aRun)
}

// bgLiveAgentTurn launches a subagent and a command and ends the turn. Gate 1:
// the subagent narrates and reads a file. Gate 2: it reports and returns, and
// the agent resumes for it. The command lives until a stop_task.
func (f *fake) bgLiveAgentTurn(text string) {
	n := f.turns
	gate := func(k int) bool { return f.awaitGate(fmt.Sprintf("%d-%d", n, k)) }

	f.emitInit()
	f.status()
	m1 := f.nextID("msg")
	f.messageStart(m1)
	a, aRun, aUse := f.bgLaunchAgent(0, m1, BackgroundAgentA, "a")
	cmd := f.bgLaunchCommand(1, m1)
	f.bgClose(m1, 2, text)

	if !gate(1) {
		return
	}
	subMessageID := f.nextID("msg")
	readID := f.nextID("toolu")
	f.assistantTextWithParent(subMessageID, SubagentNarration, aUse)
	f.toolUseWithParent(subMessageID, readID, "Read", map[string]any{"file_path": ReadPath}, aUse)
	f.toolResultWithParent(readID, "1\thi\n", aUse)

	if !gate(2) {
		return
	}
	f.assistantTextWithParent(f.nextID("msg"), SubagentReport, aUse)
	f.backgroundTasks(cmd)
	f.bgReturn(a, aRun, aUse, BackgroundAgentAText)
}

// bgPermissionSubTurn launches a subagent whose Bash call asks permission in the
// turn that launched it, and ends the turn with the answer.
func (f *fake) bgPermissionSubTurn(text string) {
	f.emitInit()
	f.status()
	m1 := f.nextID("msg")
	f.messageStart(m1)
	a, _, aUse := f.bgLaunchAgent(0, m1, BackgroundAgentA, "a")

	toolUseID := f.nextID("toolu")
	input := map[string]any{"command": BashCommand, "description": "Create hello.txt with the word hi"}
	f.toolUseWithParent(f.nextID("msg"), toolUseID, "Bash", input, aUse)
	f.askBashAs(toolUseID, input, a)

	answer, ok := f.awaitPermission()
	if !ok {
		return
	}
	reply := text
	if answer.Behavior == "allow" {
		f.toolResultWithParent(toolUseID, "(Bash completed with no output)", aUse)
	} else {
		reply = "denied: " + answer.Message
	}
	f.bgClose(m1, 1, reply)
}

// bgSilentTurn launches a subagent and ends the turn. Gate 1: the subagent
// ends and nothing follows. Gate 2: the CLI runs an empty turn.
func (f *fake) bgSilentTurn(text string) {
	n := f.turns
	gate := func(k int) bool { return f.awaitGate(fmt.Sprintf("%d-%d", n, k)) }

	f.emitInit()
	f.status()
	m1 := f.nextID("msg")
	f.messageStart(m1)
	a, aRun, aUse := f.bgLaunchAgent(0, m1, BackgroundAgentA, "a")
	f.bgClose(m1, 1, text)

	if !gate(1) {
		return
	}
	f.taskNotification(a, aRun, aUse, "completed", "The task is done.")

	if !gate(2) {
		return
	}
	f.bgEmptyTurn(aRun)
}

// bgLevelTurn launches a command and ends the turn. Gate 1: the CLI reports no
// task in the background, and sends no task_notification.
func (f *fake) bgLevelTurn(text string) {
	n := f.turns

	f.emitInit()
	f.status()
	m1 := f.nextID("msg")
	f.messageStart(m1)
	f.bgLaunchCommand(0, m1)
	f.bgClose(m1, 1, text)

	if !f.awaitGate(fmt.Sprintf("%d-1", n)) {
		return
	}
	f.backgroundTasks()
}

// bgPromotedTurn runs a command in the foreground that the CLI moves to the
// background, and ends the turn. Gate 1: the command ends and the agent resumes
// for it, then the CLI runs an empty turn.
func (f *fake) bgPromotedTurn(text string) {
	n := f.turns
	cmd, cmdRun := fmt.Sprintf("task-%d-cmd", n), fmt.Sprintf("run-%d-cmd", n)

	f.emitInit()
	f.status()
	m1 := f.nextID("msg")
	f.messageStart(m1)
	cmdUse := f.nextID("toolu")
	f.streamToolUse(0, m1, cmdUse, "Bash", map[string]any{"command": "make build", "description": PromotedDescription})
	f.taskStarted(cmd, cmdRun, cmdUse, PromotedDescription, "local_bash", false)
	f.taskUpdated(cmd, cmdRun, true)
	f.toolResult(cmdUse, "Command was moved to the background with ID: "+cmd+".")
	f.bgClose(m1, 1, text)

	if !f.awaitGate(fmt.Sprintf("%d-1", n)) {
		return
	}
	f.bgReturn(cmd, cmdRun, cmdUse, text)
	f.bgEmptyTurn(cmdRun)
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

// streamThinking streams a thinking block in deltaChunks pieces, in the order
// of the real CLI: the assistant event of the block comes before its stop.
func (f *fake) streamThinking(index int, messageID, text string) {
	f.blockStart(index, map[string]any{"type": "thinking", "thinking": "", "signature": ""})
	for _, chunk := range splitWords(text, deltaChunks) {
		f.thinkingDelta(index, chunk)
	}
	f.signatureDelta(index)
	f.assistantBlock(messageID, map[string]any{"type": "thinking", "thinking": text, "signature": fakeSignature})
	f.blockStop(index)
}

// redactedThinking streams a redacted thinking block, which has no text.
func (f *fake) redactedThinking(index int, messageID string) {
	block := map[string]any{"type": "redacted_thinking", "data": fakeSignature}
	f.blockStart(index, block)
	f.assistantBlock(messageID, block)
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

// thinkingDelta streams one piece of a thinking block.
func (f *fake) thinkingDelta(index int, text string) {
	f.streamEvent(map[string]any{
		"type":  "content_block_delta",
		"index": index,
		"delta": map[string]any{"type": "thinking_delta", "thinking": text},
	})
}

// signatureDelta streams the signature of a thinking block.
func (f *fake) signatureDelta(index int) {
	f.streamEvent(map[string]any{
		"type":  "content_block_delta",
		"index": index,
		"delta": map[string]any{"type": "signature_delta", "signature": fakeSignature},
	})
}

// assistantText emits the authoritative version of a text block.
func (f *fake) assistantText(messageID, text string) {
	f.assistantBlock(messageID, map[string]any{"type": "text", "text": text})
}

// assistantBlock emits the authoritative version of one block of the main
// thread.
func (f *fake) assistantBlock(messageID string, block map[string]any) {
	f.emit(map[string]any{
		"type": "assistant",
		"message": map[string]any{
			"id":      messageID,
			"model":   Model,
			"role":    "assistant",
			"type":    "message",
			"content": []any{block},
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

// assistantThinkingWithParent emits a whole thinking block of a subagent.
func (f *fake) assistantThinkingWithParent(messageID, text, parent string) {
	f.emit(map[string]any{
		"type": "assistant",
		"message": map[string]any{
			"id":      messageID,
			"model":   Model,
			"role":    "assistant",
			"type":    "message",
			"content": []any{map[string]any{"type": "thinking", "thinking": text, "signature": fakeSignature}},
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
	f.emit(f.resultLine(subtype, isError, text, terminalReason, f.turns))
}

// originResult closes a turn the agent opened, saying what opened it.
func (f *fake) originResult(text string, numTurns int, origin map[string]any) {
	line := f.resultLine("success", false, text, "completed", numTurns)
	line["origin"] = origin
	f.emit(line)
}

// resultLine is the result of a turn, before the fields every line carries.
func (f *fake) resultLine(subtype string, isError bool, text, terminalReason string, numTurns int) map[string]any {
	return map[string]any{
		"type":               "result",
		"subtype":            subtype,
		"is_error":           isError,
		"result":             text,
		"stop_reason":        nil,
		"terminal_reason":    terminalReason,
		"num_turns":          numTurns,
		"total_cost_usd":     0.01,
		"usage":              usage(64),
		"modelUsage":         map[string]any{Model: map[string]any{"contextWindow": ContextWindow}},
		"permission_denials": []any{},
	}
}

// status announces that the CLI is calling the API, as it does after an init.
func (f *fake) status() {
	f.emit(map[string]any{"type": "system", "subtype": "status", "status": "requesting"})
}

// taskStarted announces a task the agent launched.
func (f *fake) taskStarted(taskID, runID, toolUseID, description, taskType string, backgrounded bool) {
	if backgrounded {
		f.liveMu.Lock()
		f.live[taskID] = liveTask{runID: runID, toolUseID: toolUseID, description: description, taskType: taskType}
		f.liveMu.Unlock()
	}
	f.emit(map[string]any{
		"type":            "system",
		"subtype":         "task_started",
		"task_id":         taskID,
		"run_id":          runID,
		"tool_use_id":     toolUseID,
		"description":     description,
		"task_type":       taskType,
		"is_backgrounded": backgrounded,
	})
}

// taskNotification announces the end of a task.
// A command or monitor in the background leaves its whole output in a file.
func (f *fake) taskNotification(taskID, runID, toolUseID, status, summary string) {
	f.liveMu.Lock()
	task, ok := f.live[taskID]
	delete(f.live, taskID)
	f.liveMu.Unlock()

	outputFile := ""
	if ok && task.taskType == "local_bash" {
		outputFile = f.outputFile(taskID)
		//nolint:gosec // G703: the path is the fake's own, under the temp dir
		if err := os.WriteFile(outputFile, []byte(BackgroundOutput), 0o600); err != nil {
			fail("write task output: %v", err)
			outputFile = ""
		}
	}
	f.emit(map[string]any{
		"type":        "system",
		"subtype":     "task_notification",
		"task_id":     taskID,
		"run_id":      runID,
		"tool_use_id": toolUseID,
		"status":      status,
		"summary":     summary,
		"output_file": outputFile,
	})
}

// taskUpdated announces a change of a task: its move to or from the background.
func (f *fake) taskUpdated(taskID, runID string, backgrounded bool) {
	f.emit(map[string]any{
		"type":    "system",
		"subtype": "task_updated",
		"task_id": taskID,
		"run_id":  runID,
		"patch":   map[string]any{"is_backgrounded": backgrounded},
	})
}

// backgroundTasks announces every task running in the background; with no id,
// none.
func (f *fake) backgroundTasks(taskIDs ...string) {
	tasks := make([]any, 0, len(taskIDs))
	for _, id := range taskIDs {
		tasks = append(tasks, map[string]any{"task_id": id, "task_type": "local_bash", "description": ""})
	}
	f.emit(map[string]any{"type": "system", "subtype": "background_tasks_changed", "tasks": tasks})
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
	f.seqMu.Lock()
	defer f.seqMu.Unlock()

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
