//go:build linux

package relaunch_test

import (
	"os"
	"os/exec"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/platform/relaunch"
)

func TestWait(t *testing.T) {
	t.Run("a process that exits", func(t *testing.T) {
		cmd := exec.Command("sleep", "0.2")
		if err := cmd.Start(); err != nil {
			t.Fatal(err)
		}
		go func() { _ = cmd.Wait() }()
		if !relaunch.Wait(cmd.Process.Pid, 5*time.Second) {
			t.Error("Wait = false for a process that exits")
		}
	})

	t.Run("a process that is gone", func(t *testing.T) {
		cmd := exec.Command("true")
		if err := cmd.Run(); err != nil {
			t.Fatal(err)
		}
		if !relaunch.Wait(cmd.Process.Pid, time.Second) {
			t.Error("Wait = false for a process that is gone")
		}
	})

	t.Run("a process that keeps running", func(t *testing.T) {
		cmd := exec.Command("sleep", "30")
		if err := cmd.Start(); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() {
			_ = cmd.Process.Kill()
			_ = cmd.Wait()
		})
		if relaunch.Wait(cmd.Process.Pid, 50*time.Millisecond) {
			t.Error("Wait = true for a process that keeps running")
		}
	})
}

func TestStart(t *testing.T) {
	if err := relaunch.Start("/bin/true", os.Getpid()); err != nil {
		t.Errorf("Start of an executable: %v", err)
	}
	if err := relaunch.Start("/nonexistent/myspec", os.Getpid()); err == nil {
		t.Error("Start of a missing path: want an error")
	}
}
