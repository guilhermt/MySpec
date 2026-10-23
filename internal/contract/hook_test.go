package contract_test

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/contract"
)

const sessionID = "0a1b2c3d-0000-4000-8000-123456789abc"

func runHook(t *testing.T, dir, stdin string) (int, string) {
	t.Helper()
	var out bytes.Buffer
	code := contract.Hook(strings.NewReader(stdin), &out, dir)
	return code, out.String()
}

func hookInput(t *testing.T, id, tool, command string) string {
	t.Helper()
	in, err := json.Marshal(map[string]any{"session_id": id, "tool_name": tool, "tool_input": map[string]string{"command": command}})
	if err != nil {
		t.Fatal(err)
	}
	return string(in)
}

type askOutput struct {
	HookSpecificOutput struct {
		HookEventName            string `json:"hookEventName"`
		PermissionDecision       string `json:"permissionDecision"`
		PermissionDecisionReason string `json:"permissionDecisionReason"`
	} `json:"hookSpecificOutput"`
}

func decodeAsk(t *testing.T, out string) askOutput {
	t.Helper()
	var got askOutput
	if err := json.Unmarshal([]byte(out), &got); err != nil {
		t.Fatalf("output %q is not JSON: %v", out, err)
	}
	if got.HookSpecificOutput.HookEventName != "PreToolUse" || got.HookSpecificOutput.PermissionDecision != "ask" {
		t.Errorf("output = %+v, want a PreToolUse ask", got)
	}
	return got
}

func TestTheHookSaysNothingForACallInsideTheContract(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	if err := contract.WriteState(dir, sessionID, contract.State{Role: contract.RoleStep, Turn: contract.TurnCommit, Step: 1}); err != nil {
		t.Fatal(err)
	}

	for _, command := range []string{"git commit -m x", "git status", "ls -la", "git add -A && git commit -m x"} {
		code, out := runHook(t, dir, hookInput(t, sessionID, "Bash", command))
		if code != 0 || out != "" {
			t.Errorf("%q: exit %d, output %q, want 0 and nothing", command, code, out)
		}
	}
	if code, out := runHook(t, dir, `{"session_id":"`+sessionID+`","tool_name":"Read","tool_input":{}}`); code != 0 || out != "" {
		t.Errorf("Read: exit %d, output %q, want 0 and nothing", code, out)
	}
}

func TestTheHookAsksForACallOutsideTheContract(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	if err := contract.WriteState(dir, sessionID, contract.State{Role: contract.RoleStep, Branch: "task/x", Step: 3}); err != nil {
		t.Fatal(err)
	}

	code, out := runHook(t, dir, hookInput(t, sessionID, "Bash", "git status && git push origin task/x"))
	if code != 0 {
		t.Errorf("exit = %d, want 0", code)
	}
	got := decodeAsk(t, out)
	want := "This is outside what this stage does: MySpec pushes task/x itself when it opens the pull request."
	if got.HookSpecificOutput.PermissionDecisionReason != want {
		t.Errorf("reason = %q, want %q", got.HookSpecificOutput.PermissionDecisionReason, want)
	}
}

func TestTheHookFailsClosedWhenItCannotReadTheState(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	generic := "This is outside what this stage does: this stage only writes its document. Git and GitHub stay as they are."

	if err := os.WriteFile(filepath.Join(dir, sessionID+".json"), []byte("{broken"), 0o600); err != nil {
		t.Fatal(err)
	}
	cases := map[string]string{
		"no file":          hookInput(t, "ffffffff-0000-4000-8000-123456789abc", "Bash", "git commit -m x"),
		"a broken file":    hookInput(t, sessionID, "Bash", "git commit -m x"),
		"an id with dots":  hookInput(t, "../../etc/passwd-aaaaaaaaaaaaaaaaaaaaaaaa", "Bash", "git commit -m x"),
		"a short id":       hookInput(t, "abc", "Bash", "git commit -m x"),
		"no id":            hookInput(t, "", "Bash", "gh pr merge 1"),
		"a GitHub MCP":     `{"session_id":"x","tool_name":"mcp__github__merge_pull_request","tool_input":{}}`,
		"input not JSON":   "not json",
		"empty input":      "",
		"a command broken": hookInput(t, sessionID, "Bash", "if git push; then"),
	}
	for name, stdin := range cases {
		code, out := runHook(t, dir, stdin)
		if code != 0 {
			t.Errorf("%s: exit = %d, want 0", name, code)
		}
		if got := decodeAsk(t, out).HookSpecificOutput.PermissionDecisionReason; got != generic {
			t.Errorf("%s: reason = %q, want the generic one", name, got)
		}
	}
}

func TestTheHookStillSaysNothingForAReadWithoutAState(t *testing.T) {
	t.Parallel()

	code, out := runHook(t, t.TempDir(), hookInput(t, sessionID, "Bash", "git log"))
	if code != 0 || out != "" {
		t.Errorf("exit %d, output %q, want 0 and nothing", code, out)
	}
}

func TestHookFlag(t *testing.T) {
	t.Parallel()

	cases := []struct {
		args []string
		dir  string
		ok   bool
	}{
		{[]string{"--claude-hook", "/data/hooks"}, "/data/hooks", true},
		{[]string{"--claude-hook"}, "", false},
		{[]string{"--other", "x"}, "", false},
		{[]string{"x", "--claude-hook", "y"}, "", false},
		{nil, "", false},
	}
	for _, tc := range cases {
		dir, ok := contract.HookFlag(tc.args)
		if dir != tc.dir || ok != tc.ok {
			t.Errorf("HookFlag(%q) = (%q, %v), want (%q, %v)", tc.args, dir, ok, tc.dir, tc.ok)
		}
	}
}

func TestHookCommandQuotesForAPOSIXShell(t *testing.T) {
	t.Parallel()

	got := contract.HookCommand("/opt/my spec/myspec", "/home/o'neil/hooks")
	want := `'/opt/my spec/myspec' --claude-hook '/home/o'\''neil/hooks'`
	if got != want {
		t.Errorf("HookCommand = %s, want %s", got, want)
	}

	if runtime.GOOS == "windows" {
		got := contract.HookCommand(`C:\Users\Ana\MySpec\myspec.exe`, `C:\Users\Ana\data\hooks`)
		want := `'C:/Users/Ana/MySpec/myspec.exe' --claude-hook 'C:/Users/Ana/data/hooks'`
		if got != want {
			t.Errorf("HookCommand = %s, want %s", got, want)
		}
	}
}

func TestSettingsHooksTheShellAndMCPTools(t *testing.T) {
	t.Parallel()

	command := contract.HookCommand("/bin/myspec", "/data/hooks")
	var got map[string]any
	if err := json.Unmarshal([]byte(contract.Settings(command)), &got); err != nil {
		t.Fatal(err)
	}
	want := map[string]any{"hooks": map[string]any{"PreToolUse": []any{map[string]any{
		"matcher": "Bash|PowerShell|mcp__.*",
		"hooks":   []any{map[string]any{"type": "command", "command": command}},
	}}}}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("settings (-want +got):\n%s", diff)
	}
}

func TestAStateIsWrittenWholeAndReplaced(t *testing.T) {
	t.Parallel()
	dir := filepath.Join(t.TempDir(), "hooks")

	first := contract.State{Role: contract.RolePRFix, Turn: contract.TurnApply, Branch: "feat", Base: "dev", Step: 4}
	if err := contract.WriteState(dir, sessionID, first); err != nil {
		t.Fatal(err)
	}
	second := contract.State{Role: contract.RolePRFix, Turn: contract.TurnCommit}
	if err := contract.WriteState(dir, sessionID, second); err != nil {
		t.Fatal(err)
	}

	data, err := os.ReadFile(filepath.Join(dir, sessionID+".json"))
	if err != nil {
		t.Fatal(err)
	}
	var got contract.State
	if err = json.Unmarshal(data, &got); err != nil {
		t.Fatal(err)
	}
	if diff := cmp.Diff(second, got); diff != "" {
		t.Errorf("state (-want +got):\n%s", diff)
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 {
		t.Errorf("the folder has %d files, want only the state", len(entries))
	}
	if runtime.GOOS != "windows" {
		info, err := os.Stat(filepath.Join(dir, sessionID+".json"))
		if err != nil {
			t.Fatal(err)
		}
		if perm := info.Mode().Perm(); perm != 0o600 {
			t.Errorf("file mode = %o, want 600", perm)
		}
		dirInfo, err := os.Stat(dir)
		if err != nil {
			t.Fatal(err)
		}
		if perm := dirInfo.Mode().Perm(); perm != 0o700 {
			t.Errorf("folder mode = %o, want 700", perm)
		}
	}
}

func TestAStateIsNotWrittenOutsideItsFolder(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()

	for _, id := range []string{"", ".", "..", "../x", `a\b`, "a/b"} {
		if err := contract.WriteState(dir, id, contract.State{}); err == nil {
			t.Errorf("WriteState(%q) = nil, want an error", id)
		}
	}
}

func TestRemovingAndResettingStates(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	other := "ffffffff-0000-4000-8000-123456789abc"

	if err := contract.RemoveState(dir, sessionID); err != nil {
		t.Errorf("removing a state that isn't there: %v", err)
	}
	for _, id := range []string{sessionID, other} {
		if err := contract.WriteState(dir, id, contract.State{Role: contract.RoleStep}); err != nil {
			t.Fatal(err)
		}
	}
	if err := contract.RemoveState(dir, sessionID); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(dir, sessionID+".json")); !os.IsNotExist(err) {
		t.Errorf("the removed state is still there: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "keep.txt"), nil, 0o600); err != nil {
		t.Fatal(err)
	}

	if err := contract.ResetStates(dir); err != nil {
		t.Fatal(err)
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 || entries[0].Name() != "keep.txt" {
		t.Errorf("after the reset the folder has %v, want only keep.txt", entries)
	}

	if err := contract.ResetStates(filepath.Join(dir, "missing")); err != nil {
		t.Errorf("resetting a folder that isn't there: %v", err)
	}
}
