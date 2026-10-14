package procgroup_test

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/platform/procgroup"
)

const (
	envRole    = "PROCGROUP_TEST_ROLE"
	envPidFile = "PROCGROUP_TEST_PIDFILE"
)

// TestMain makes the test binary the processes the tests start: with a role in
// the environment it plays that role instead of running the tests.
func TestMain(m *testing.M) {
	switch os.Getenv(envRole) {
	case "":
		os.Exit(m.Run())
	case "parent", "parent-exits":
		child := exec.Command(os.Args[0])
		child.Env = append(os.Environ(), envRole+"=child")
		if err := child.Start(); err != nil {
			os.Exit(2)
		}
		if err := os.WriteFile(os.Getenv(envPidFile), []byte(strconv.Itoa(child.Process.Pid)), 0o600); err != nil {
			os.Exit(2)
		}
		if os.Getenv(envRole) == "parent-exits" {
			os.Exit(0)
		}
		select {}
	case "child":
		select {}
	case "exit3":
		os.Exit(3)
	case "exit0":
		os.Exit(0)
	}
}

// command builds the test binary playing role, with the file where it writes
// the pid of what it starts.
func command(ctx context.Context, t *testing.T, role string) (*exec.Cmd, string) {
	t.Helper()
	pidFile := filepath.Join(t.TempDir(), "pid")
	cmd := exec.CommandContext(ctx, os.Args[0])
	cmd.Env = append(os.Environ(), envRole+"="+role, envPidFile+"="+pidFile)
	return cmd, pidFile
}

// waitPid waits for the pid the parent writes once it started its child.
func waitPid(t *testing.T, pidFile string) int {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for {
		if data, err := os.ReadFile(pidFile); err == nil {
			if pid, err := strconv.Atoi(strings.TrimSpace(string(data))); err == nil {
				return pid
			}
		}
		if time.Now().After(deadline) {
			t.Fatal("the parent never wrote the pid of its child")
		}
		time.Sleep(5 * time.Millisecond)
	}
}

// startParent starts the parent in a group and returns it with the pid of the
// process it started.
func startParent(t *testing.T) (*exec.Cmd, *procgroup.Group, int) {
	t.Helper()
	cmd, pidFile := command(t.Context(), t, "parent")
	g := procgroup.New(cmd)
	if err := cmd.Start(); err != nil {
		t.Fatalf("start: %v", err)
	}
	if err := g.Started(); err != nil {
		_ = cmd.Process.Kill()
		_ = cmd.Wait()
		t.Fatalf("started: %v", err)
	}
	return cmd, g, waitPid(t, pidFile)
}

func TestKillStopsTheProcessAndWhatItStarted(t *testing.T) {
	t.Parallel()
	cmd, g, grandchild := startParent(t)

	if err := g.Kill(); err != nil {
		t.Fatalf("Kill: %v", err)
	}
	_ = cmd.Wait()
	if err := g.Close(); err != nil {
		t.Errorf("Close: %v", err)
	}
	gone(t, grandchild)
}

func TestTerminateStopsTheProcessAndWhatItStarted(t *testing.T) {
	t.Parallel()
	cmd, g, grandchild := startParent(t)

	if err := g.Terminate(); err != nil {
		t.Fatalf("Terminate: %v", err)
	}
	_ = cmd.Wait()
	if err := g.Close(); err != nil {
		t.Errorf("Close: %v", err)
	}
	gone(t, grandchild)
}

func TestKillAfterTheGroupEndedIsNotAnError(t *testing.T) {
	t.Parallel()
	cmd, g, grandchild := startParent(t)
	_ = g.Kill()
	_ = cmd.Wait()
	_ = g.Close()
	gone(t, grandchild)

	if err := g.Kill(); err != nil {
		t.Errorf("Kill after the group ended: %v", err)
	}
}

func TestRunKillsWhatTheCommandStartedWhenTheContextIsCancelled(t *testing.T) {
	t.Parallel()
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	cmd, pidFile := command(ctx, t, "parent")

	done := make(chan error, 1)
	go func() { done <- procgroup.Run(cmd) }()

	grandchild := waitPid(t, pidFile)
	cancel()
	if err := <-done; err == nil {
		t.Error("Run after a cancellation returned nil")
	}
	gone(t, grandchild)
}

func TestRunReportsTheExitOfTheCommand(t *testing.T) {
	t.Parallel()
	cmd, _ := command(t.Context(), t, "exit3")

	err := procgroup.Run(cmd)

	var exitErr *exec.ExitError
	if !errors.As(err, &exitErr) {
		t.Fatalf("Run = %v, want an *exec.ExitError", err)
	}
	if got := exitErr.ExitCode(); got != 3 {
		t.Errorf("exit code = %d, want 3", got)
	}
}

func TestRunReportsACommandThatCannotStart(t *testing.T) {
	t.Parallel()
	cmd := exec.CommandContext(t.Context(), filepath.Join(t.TempDir(), "missing"))

	err := procgroup.Run(cmd)

	if !errors.Is(err, os.ErrNotExist) {
		t.Errorf("Run = %v, want an error wrapping os.ErrNotExist", err)
	}
}

func TestHideLeavesTheCommandRunnable(t *testing.T) {
	t.Parallel()
	cmd, _ := command(t.Context(), t, "exit0")
	procgroup.Hide(cmd)

	if err := cmd.Run(); err != nil {
		t.Errorf("run: %v", err)
	}
}
