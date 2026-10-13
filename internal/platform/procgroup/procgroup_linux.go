package procgroup

import (
	"errors"
	"fmt"
	"os/exec"
	"syscall"
)

// Group is a command and everything it starts, led by the command.
type Group struct {
	cmd *exec.Cmd
}

// New prepares cmd, before it starts, to lead a group of its own. On Windows it
// also hides the console window, as Hide does.
func New(cmd *exec.Cmd) *Group {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	return &Group{cmd: cmd}
}

// Started ties the started process to the group. It is called right after
// cmd.Start, before anything else; on Linux it does nothing.
func (g *Group) Started() error { return nil }

// Terminate asks every process of the group to stop: SIGTERM on Linux. Windows
// has no such request for a process without a visible console, so there it
// kills, as Kill does.
func (g *Group) Terminate() error { return g.signal(syscall.SIGTERM) }

// Kill stops every process of the group at once. A group whose processes are
// already gone is not an error.
func (g *Group) Kill() error { return g.signal(syscall.SIGKILL) }

// Close releases the group once cmd was waited for. On Windows every process of
// the group still running is killed with it; on Linux it does nothing.
func (g *Group) Close() error { return nil }

// Hide keeps a command from opening a console window on Windows; on Linux it
// does nothing.
func Hide(*exec.Cmd) {}

// signal reaches the whole process group. A group already gone is not an error.
func (g *Group) signal(sig syscall.Signal) error {
	if g.cmd.Process == nil {
		return nil
	}
	err := syscall.Kill(-g.cmd.Process.Pid, sig)
	if err != nil && !errors.Is(err, syscall.ESRCH) {
		return fmt.Errorf("signal process group %d with %v: %w", g.cmd.Process.Pid, sig, err)
	}
	return nil
}
