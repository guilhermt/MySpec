package procgroup

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"sync"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

// killedExitCode is the exit code the processes of a group the app killed end
// with.
const killedExitCode = 1

// Group is a command and everything it starts, held by a job object.
type Group struct {
	cmd *exec.Cmd

	mu     sync.Mutex
	job    windows.Handle // 0 until Started
	closed bool
}

// New prepares cmd, before it starts, to lead a group of its own. On Windows it
// also hides the console window, as Hide does.
func New(cmd *exec.Cmd) *Group {
	Hide(cmd)
	return &Group{cmd: cmd}
}

// Hide keeps a command from opening a console window on Windows; on Linux it
// does nothing.
func Hide(cmd *exec.Cmd) {
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	cmd.SysProcAttr.CreationFlags |= windows.CREATE_NO_WINDOW
}

// Started ties the started process to the group. It is called right after
// cmd.Start, before anything else. Every child of the process joins the job,
// and the job kills what still runs when it is closed.
func (g *Group) Started() error {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.closed {
		return nil
	}

	job, err := windows.CreateJobObject(nil, nil)
	if err != nil {
		return fmt.Errorf("create job object: %w", err)
	}
	info := windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION{}
	info.BasicLimitInformation.LimitFlags = windows.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
	_, err = windows.SetInformationJobObject(
		job,
		windows.JobObjectExtendedLimitInformation,
		uintptr(unsafe.Pointer(&info)),
		uint32(unsafe.Sizeof(info)),
	)
	if err != nil {
		_ = windows.CloseHandle(job)
		return fmt.Errorf("limit job object: %w", err)
	}

	pid := g.cmd.Process.Pid
	process, err := windows.OpenProcess(windows.PROCESS_SET_QUOTA|windows.PROCESS_TERMINATE, false, uint32(pid))
	if err != nil {
		_ = windows.CloseHandle(job)
		return fmt.Errorf("open process %d: %w", pid, err)
	}
	defer func() { _ = windows.CloseHandle(process) }()

	if err := windows.AssignProcessToJobObject(job, process); err != nil {
		_ = windows.CloseHandle(job)
		return fmt.Errorf("assign process %d to its job: %w", pid, err)
	}
	g.job = job
	return nil
}

// Terminate asks every process of the group to stop. Windows has no such
// request for a process without a visible console, so it kills, as Kill does.
func (g *Group) Terminate() error { return g.Kill() }

// Kill stops every process of the group at once. A group whose processes are
// already gone is not an error.
func (g *Group) Kill() error {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.closed {
		return nil
	}
	if g.job == 0 {
		// The cancellation came before Started.
		if g.cmd.Process == nil {
			return nil
		}
		if err := g.cmd.Process.Kill(); err != nil && !errors.Is(err, os.ErrProcessDone) {
			return err
		}
		return nil
	}
	if err := windows.TerminateJobObject(g.job, killedExitCode); err != nil {
		return fmt.Errorf("terminate job: %w", err)
	}
	return nil
}

// Close releases the group once cmd was waited for: every process of the group
// still running is killed with it.
func (g *Group) Close() error {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.closed {
		return nil
	}
	g.closed = true
	if g.job == 0 {
		return nil
	}
	if err := windows.CloseHandle(g.job); err != nil {
		return fmt.Errorf("close job: %w", err)
	}
	return nil
}
