// Package git runs the git binary. It knows the commands the app needs and
// nothing about tasks or worktrees.
package git

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"strings"
	"sync"
	"syscall"
	"time"
)

// ErrNotFound reports that no git executable is on the PATH.
var ErrNotFound = errors.New("git: executable not found")

// waitDelay is how long a killed command has to release its pipes.
const waitDelay = 2 * time.Second

// Deps are what Runner needs from the outside.
type Deps struct {
	Log *slog.Logger
	Env []string // environment of every command; nil means the parent's
}

// Runner runs git commands.
type Runner struct {
	log *slog.Logger
	env []string

	mu     sync.Mutex
	binary string // resolved on the first Run
}

// New builds a Runner from deps. It does not look for the git binary: the app
// has to open without git, and only a command that runs needs it.
func New(deps Deps) *Runner {
	env := deps.Env
	if env == nil {
		env = os.Environ()
	}
	// Without a terminal, a git asking for a password would hang until the
	// timeout; this way a missing credential fails at once, with git's message.
	env = append(append([]string(nil), env...), "GIT_TERMINAL_PROMPT=0")

	log := deps.Log
	if log == nil {
		log = slog.New(slog.DiscardHandler)
	}
	return &Runner{log: log, env: env}
}

// Error is a git command that failed, carrying what git said.
type Error struct {
	Args     []string // the command line after "git"
	Dir      string
	Output   string // stderr, or stdout when stderr is empty; trimmed
	ExitCode int    // -1 when the process did not exit on its own
	Err      error  // the exec error, or the context error when it was cancelled
}

// Error reads "git <args>: <output>", falling back to the exec error when git
// said nothing.
func (e *Error) Error() string {
	detail := e.Output
	if detail == "" {
		detail = e.Err.Error()
	}
	return "git " + strings.Join(e.Args, " ") + ": " + detail
}

// Unwrap gives up the exec or context error underneath.
func (e *Error) Unwrap() error { return e.Err }

// Run runs git in dir and returns its trimmed stdout. A non-zero exit is an
// *Error; a cancelled context is an *Error whose Err is the context error.
func (r *Runner) Run(ctx context.Context, dir string, args ...string) (string, error) {
	binary, err := r.resolve()
	if err != nil {
		return "", err
	}

	var stdout, stderr bytes.Buffer
	cmd := exec.CommandContext(ctx, binary, args...)
	cmd.Dir = dir
	cmd.Env = r.env
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	// Its own process group, so a cancellation also reaches the ssh or the
	// credential helper git opened.
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Cancel = func() error { return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL) }
	cmd.WaitDelay = waitDelay

	started := time.Now()
	runErr := cmd.Run()
	exitCode := -1
	if cmd.ProcessState != nil {
		exitCode = cmd.ProcessState.ExitCode()
	}
	r.log.Debug(
		"git ran",
		"args", args,
		"dir", dir,
		"duration_ms", time.Since(started).Milliseconds(),
		"exit_code", exitCode,
	)

	if runErr != nil {
		// A cancellation kills the process, so the exec error only says it was
		// signalled; the context says why.
		if ctxErr := ctx.Err(); ctxErr != nil {
			runErr = ctxErr
		}
		return "", &Error{
			Args:     args,
			Dir:      dir,
			Output:   output(stdout.String(), stderr.String()),
			ExitCode: exitCode,
			Err:      runErr,
		}
	}
	return strings.TrimSpace(stdout.String()), nil
}

// resolve finds the git binary once and remembers it.
func (r *Runner) resolve() (string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.binary != "" {
		return r.binary, nil
	}
	path, err := exec.LookPath("git")
	if err != nil {
		return "", fmt.Errorf("%w: %w", ErrNotFound, err)
	}
	r.binary = path
	return path, nil
}

// output is what git said about a failure: its stderr, or its stdout when it
// wrote nothing to stderr.
func output(stdout, stderr string) string {
	if out := strings.TrimSpace(stderr); out != "" {
		return out
	}
	return strings.TrimSpace(stdout)
}
