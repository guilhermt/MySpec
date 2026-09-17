// Package gh runs the gh binary. It reads from GitHub and clones repositories;
// the pull requests are opened by the agent, inside its own session.
package gh

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

// The ways a gh command fails without the app having anything to show.
var (
	ErrNotFound         = errors.New("gh: executable not found")
	ErrNotAuthenticated = errors.New("gh: not authenticated")
	ErrNoPR             = errors.New("gh: no pull request for this branch")
)

// waitDelay is how long a killed command has to release its pipes.
const waitDelay = 2 * time.Second

// prompts is what every command carries on top of the environment it runs in.
// Without a terminal gh is already non-interactive; the variables make sure it
// never waits for an answer, never paginates and never colours what the app
// is going to show as text.
var prompts = []string{
	"GH_PROMPT_DISABLED=1",
	"GH_PAGER=cat",
	"GH_NO_UPDATE_NOTIFIER=1",
	"NO_COLOR=1",
}

// Deps are what Runner needs from the outside.
type Deps struct {
	Log    *slog.Logger
	Env    []string // environment of every command; nil means the parent's
	Binary string   // overrides the lookup; tests use it
}

// Runner runs gh commands.
type Runner struct {
	log *slog.Logger
	env []string

	mu     sync.Mutex
	binary string // resolved on the first Run
}

// New builds a Runner from deps. It does not look for the gh binary: the app
// has to open without gh, and only a command that runs needs it.
func New(deps Deps) *Runner {
	env := deps.Env
	if env == nil {
		env = os.Environ()
	}
	env = append(append([]string(nil), env...), prompts...)

	log := deps.Log
	if log == nil {
		log = slog.New(slog.DiscardHandler)
	}
	return &Runner{log: log, env: env, binary: deps.Binary}
}

// Error is a gh command that failed, carrying what gh said.
type Error struct {
	Args     []string // the command line after "gh"
	Dir      string
	Output   string // stderr, or stdout when stderr is empty; trimmed
	Stdout   string // stdout, trimmed; gh api writes the answer of a failure there
	ExitCode int    // -1 when the process did not exit on its own
	Err      error  // the exec error, or the context error when it was cancelled
}

// Error reads "gh <args>: <output>", falling back to the exec error when gh
// said nothing.
func (e *Error) Error() string {
	detail := e.Output
	if detail == "" {
		detail = e.Err.Error()
	}
	return "gh " + strings.Join(e.Args, " ") + ": " + detail
}

// Unwrap gives up the exec or context error underneath.
func (e *Error) Unwrap() error { return e.Err }

// Run runs gh in dir and returns its trimmed stdout. A non-zero exit is an
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
	// Its own process group, so a cancellation also reaches the git or the
	// credential helper gh opened.
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
		"gh ran",
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
			Stdout:   strings.TrimSpace(stdout.String()),
			ExitCode: exitCode,
			Err:      runErr,
		}
	}
	return strings.TrimSpace(stdout.String()), nil
}

// resolve finds the gh binary once and remembers it. A Runner built with a
// binary of its own never looks.
func (r *Runner) resolve() (string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.binary != "" {
		return r.binary, nil
	}
	path, err := exec.LookPath("gh")
	if err != nil {
		return "", fmt.Errorf("%w: %w", ErrNotFound, err)
	}
	r.binary = path
	return path, nil
}

// output is what gh said about a failure: its stderr, or its stdout when it
// wrote nothing to stderr.
func output(stdout, stderr string) string {
	if out := strings.TrimSpace(stderr); out != "" {
		return out
	}
	return strings.TrimSpace(stdout)
}
