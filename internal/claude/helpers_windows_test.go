package claude_test

import (
	"testing"

	"golang.org/x/sys/windows"
)

// gone waits until the process pid no longer exists.
func gone(t *testing.T, pid int) {
	t.Helper()

	h, err := windows.OpenProcess(windows.SYNCHRONIZE, false, uint32(pid))
	if err != nil {
		return // already gone
	}
	defer func() { _ = windows.CloseHandle(h) }()
	if event, _ := windows.WaitForSingleObject(h, 10000); event != windows.WAIT_OBJECT_0 {
		t.Fatalf("process %d still running", pid)
	}
}
