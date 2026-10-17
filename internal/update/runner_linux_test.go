//go:build linux

package update_test

import (
	"context"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/update"
)

// writeScript writes an install script into a folder of its own.
func writeScript(t *testing.T, body string) string {
	t.Helper()

	path := filepath.Join(t.TempDir(), "install.sh")
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatalf("write script: %v", err)
	}
	return path
}

func TestScriptRunnerGivesTheScriptWhereToWriteItsResult(t *testing.T) {
	t.Parallel()

	script := writeScript(t, "echo installing\necho 'oops' >&2\nprintf 'result: installed\\n' >\"$MYSPEC_INSTALL_RESULT\"\n")
	result := filepath.Join(t.TempDir(), "result")

	output, err := update.NewScriptRunner().Run(t.Context(), script, result)
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if got := string(output); got != "installing\noops\n" {
		t.Errorf("output = %q", got)
	}
	data, err := os.ReadFile(result)
	if err != nil || string(data) != "result: installed\n" {
		t.Errorf("result = %q, %v", data, err)
	}
}

func TestScriptRunnerReportsAScriptThatFails(t *testing.T) {
	t.Parallel()

	script := writeScript(t, "echo bad\nexit 3\n")

	output, err := update.NewScriptRunner().Run(t.Context(), script, filepath.Join(t.TempDir(), "result"))

	if err == nil {
		t.Error("Run did not fail")
	}
	if got := string(output); got != "bad\n" {
		t.Errorf("output = %q", got)
	}
}

func TestScriptRunnerKillsTheWholeGroupAtTheDeadline(t *testing.T) {
	t.Parallel()

	pidFile := filepath.Join(t.TempDir(), "pid")
	script := writeScript(t, "sleep 30 &\necho $! >"+pidFile+"\nwait\n")
	ctx, cancel := context.WithTimeout(t.Context(), 100*time.Millisecond)
	defer cancel()

	start := time.Now()
	_, err := update.NewScriptRunner().Run(ctx, script, filepath.Join(t.TempDir(), "result"))

	if err == nil {
		t.Error("Run did not fail")
	}
	if took := time.Since(start); took > 5*time.Second {
		t.Errorf("Run took %v after the deadline", took)
	}
	data, readErr := os.ReadFile(pidFile)
	if readErr != nil {
		t.Fatalf("read pid: %v", readErr)
	}
	pid, convErr := strconv.Atoi(strings.TrimSpace(string(data)))
	if convErr != nil {
		t.Fatalf("pid %q: %v", data, convErr)
	}
	waitFor(t, "the child of the script to die", func() bool { return syscall.Kill(pid, 0) == syscall.ESRCH })
}
