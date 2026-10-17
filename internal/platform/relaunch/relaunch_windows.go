package relaunch

import (
	"fmt"
	"os/exec"
	"syscall"
	"time"

	"golang.org/x/sys/windows"
)

func start(path string, pid int) error {
	//nolint:gosec // G204: it runs the executable of the app itself, which is the point
	cmd := exec.Command(path, fmt.Sprintf("%s=%d", Flag, pid))
	// A group of its own keeps the new process alive when this one exits.
	cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: windows.CREATE_NEW_PROCESS_GROUP}
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start %s: %w", path, err)
	}
	return cmd.Process.Release()
}

// wait waits on a handle of the process, which is signaled when it terminates;
// the mutex of the single instance is released before that.
func wait(pid int, timeout time.Duration) bool {
	h, err := windows.OpenProcess(windows.SYNCHRONIZE, false, uint32(pid))
	if err != nil {
		return true // the process no longer exists
	}
	defer func() { _ = windows.CloseHandle(h) }()
	event, _ := windows.WaitForSingleObject(h, uint32(timeout.Milliseconds()))
	return event == windows.WAIT_OBJECT_0
}
