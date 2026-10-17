package relaunch

import (
	"errors"
	"fmt"
	"os/exec"
	"syscall"
	"time"

	"golang.org/x/sys/unix"
)

func start(path string, pid int) error {
	//nolint:gosec // G204: it runs the executable of the app itself, which is the point
	cmd := exec.Command(path, fmt.Sprintf("%s=%d", Flag, pid))
	// A session of its own keeps the new process alive when this one exits.
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start %s: %w", path, err)
	}
	return cmd.Process.Release()
}

// wait polls a pidfd, which becomes readable when the process terminates, after
// it closes its descriptors and the D-Bus connection that holds the name of the
// single instance.
func wait(pid int, timeout time.Duration) bool {
	fd, err := unix.PidfdOpen(pid, 0)
	if err != nil {
		return errors.Is(err, unix.ESRCH)
	}
	defer func() { _ = unix.Close(fd) }()

	deadline := time.Now().Add(timeout)
	for {
		remaining := max(time.Until(deadline), 0)
		//nolint:gosec // G115: a file descriptor fits in int32
		fds := []unix.PollFd{{Fd: int32(fd), Events: unix.POLLIN}}
		n, err := unix.Poll(fds, int(remaining.Milliseconds()))
		if errors.Is(err, unix.EINTR) {
			continue
		}
		return err == nil && n > 0
	}
}
