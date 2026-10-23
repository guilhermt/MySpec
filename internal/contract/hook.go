package contract

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var sessionIDPattern = regexp.MustCompile(`^[0-9a-f-]{36}$`)

// hookInput is what the Claude Code hands a PreToolUse hook on the stdin.
type hookInput struct {
	SessionID string          `json:"session_id"`
	ToolName  string          `json:"tool_name"`
	ToolInput json.RawMessage `json:"tool_input"`
}

// HookFlag tells whether args, without the program name, ask for the hook:
// --claude-hook <dir>, the folder of the session states.
func HookFlag(args []string) (dir string, ok bool) {
	if len(args) >= 2 && args[0] == "--claude-hook" {
		return args[1], true
	}
	return "", false
}

// Hook is the PreToolUse hook of the Claude Code. It says nothing when the
// call is inside the contract of its session, and asks when it is not. It
// fails closed: what it can't read is asked. The result is the exit code.
func Hook(stdin io.Reader, stdout io.Writer, dir string) int {
	var in hookInput
	if err := json.NewDecoder(io.LimitReader(stdin, 16<<20)).Decode(&in); err != nil {
		writeAsk(stdout, reasonFor(State{}, Action{Kind: KindOther}))
		return 0
	}

	actions := Classify(in.ToolName, in.ToolInput)
	if len(actions) == 0 {
		return 0
	}

	reason, outside := Check(readState(dir, in.SessionID), actions)
	if outside {
		writeAsk(stdout, reason)
	}
	return 0
}

// readState reads the state of a session, State{} when there is none.
func readState(dir, sessionID string) State {
	if !sessionIDPattern.MatchString(sessionID) {
		return State{}
	}
	data, err := os.ReadFile(filepath.Join(dir, sessionID+".json"))
	if err != nil {
		return State{}
	}
	var st State
	if json.Unmarshal(data, &st) != nil {
		return State{}
	}
	return st
}

func writeAsk(w io.Writer, reason string) {
	out := map[string]any{"hookSpecificOutput": map[string]any{
		"hookEventName":            "PreToolUse",
		"permissionDecision":       "ask",
		"permissionDecisionReason": reason,
	}}
	_ = json.NewEncoder(w).Encode(out)
}

// HookCommand is the line of the settings that runs the hook: the executable
// and the folder, quoted for the POSIX shell the Claude Code runs it in, the
// bash on Linux and the Git Bash on Windows.
func HookCommand(executable, dir string) string {
	return shellQuote(executable) + " --claude-hook " + shellQuote(dir)
}

func shellQuote(p string) string {
	return "'" + strings.ReplaceAll(filepath.ToSlash(p), "'", `'\''`) + "'"
}

// Settings is the JSON of the --settings of a claude process that runs the
// hook command before every shell command and every MCP tool.
func Settings(command string) string {
	type hook struct {
		Type    string `json:"type"`
		Command string `json:"command"`
	}
	type matcher struct {
		Matcher string `json:"matcher"`
		Hooks   []hook `json:"hooks"`
	}
	settings := struct {
		Hooks map[string][]matcher `json:"hooks"`
	}{Hooks: map[string][]matcher{"PreToolUse": {{
		Matcher: "Bash|PowerShell|mcp__.*",
		Hooks:   []hook{{Type: "command", Command: command}},
	}}}}

	data, err := json.Marshal(settings)
	if err != nil {
		return "" // unreachable: strings only
	}
	return string(data)
}

// WriteState writes the state of a session to <dir>/<sessionID>.json,
// replacing the file whole so the hook never reads half of it.
func WriteState(dir, sessionID string, st State) error {
	if sessionID == "" || strings.ContainsAny(sessionID, `/\`) || sessionID == "." || sessionID == ".." {
		return fmt.Errorf("contract: invalid session id %q", sessionID)
	}
	data, err := json.Marshal(st)
	if err != nil {
		return fmt.Errorf("contract: encode state: %w", err)
	}
	if err = os.MkdirAll(dir, 0o700); err != nil {
		return fmt.Errorf("contract: create folder: %w", err)
	}

	tmp, err := os.CreateTemp(dir, ".state-*.tmp")
	if err != nil {
		return fmt.Errorf("contract: write state: %w", err)
	}
	_, werr := tmp.Write(data)
	cerr := tmp.Close()
	if err = errors.Join(werr, cerr); err != nil {
		_ = os.Remove(tmp.Name())
		return fmt.Errorf("contract: write state: %w", err)
	}
	if err = os.Chmod(tmp.Name(), 0o600); err != nil && !errors.Is(err, fs.ErrPermission) {
		_ = os.Remove(tmp.Name())
		return fmt.Errorf("contract: write state: %w", err)
	}
	if err = os.Rename(tmp.Name(), filepath.Join(dir, sessionID+".json")); err != nil {
		_ = os.Remove(tmp.Name())
		return fmt.Errorf("contract: write state: %w", err)
	}
	return nil
}

// RemoveState deletes the state of a session; one that isn't there is fine.
func RemoveState(dir, sessionID string) error {
	err := os.Remove(filepath.Join(dir, sessionID+".json"))
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		return fmt.Errorf("contract: remove state: %w", err)
	}
	return nil
}

// ResetStates deletes every state of dir, the ones of sessions that are gone.
func ResetStates(dir string) error {
	entries, err := os.ReadDir(dir)
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("contract: read folder: %w", err)
	}
	var errs []error
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".json" {
			continue
		}
		if err := os.Remove(filepath.Join(dir, e.Name())); err != nil && !errors.Is(err, fs.ErrNotExist) {
			errs = append(errs, err)
		}
	}
	if err := errors.Join(errs...); err != nil {
		return fmt.Errorf("contract: reset states: %w", err)
	}
	return nil
}
