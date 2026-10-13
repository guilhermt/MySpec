package procgroup_test

import (
	"errors"
	"syscall"
	"testing"
	"time"
)

// gone waits until the process pid no longer exists. An orphan is reaped by init.
func gone(t *testing.T, pid int) {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for !errors.Is(syscall.Kill(pid, 0), syscall.ESRCH) {
		if time.Now().After(deadline) {
			t.Fatalf("process %d still running", pid)
		}
		time.Sleep(5 * time.Millisecond)
	}
}
