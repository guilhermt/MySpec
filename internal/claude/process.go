package claude

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"slices"
	"strconv"
	"sync"
	"syscall"

	"github.com/google/uuid"
)

// Config is what Start needs.
type Config struct {
	Binary    string   // from Locate
	Dir       string   // working directory of the session
	SessionID string   // UUID chosen by the app
	Resume    bool     // false: --session-id; true: --resume
	Model     string   // full name of the model: --model
	Effort    string   // effort level: --effort
	Env       []string // nil means the parent environment
}

// Args are the fixed CLI flags every session gets.
var Args = []string{
	"-p",
	"--output-format", "stream-json",
	"--input-format", "stream-json",
	"--verbose",
	"--include-partial-messages",
	"--permission-mode", "auto",
	"--permission-prompt-tool", "stdio",
}

// ErrInputClosed reports a write to a process whose input is already closed.
var ErrInputClosed = errors.New("claude: input is closed")

const (
	// eventBuffer is how many decoded events wait for the consumer.
	eventBuffer = 256
	// scanBuffer is the room the stdout scanner starts with.
	scanBuffer = 64 << 10
	// maxLine is the largest stdout line accepted; a tool result can be big.
	maxLine = 16 << 20
	// stderrTail is how much of stderr is kept to explain an exit.
	stderrTail = 4 << 10
)

// ExitInfo describes how the process ended.
type ExitInfo struct {
	Code   int    // -1 when killed by a signal
	Signal string // "" when exited normally
	Stderr string // last 4 KiB of stderr
}

// Process is one running claude CLI.
type Process struct {
	log    *slog.Logger
	cmd    *exec.Cmd
	events chan Event
	stderr *tailBuffer

	inputMu     sync.Mutex
	stdin       io.WriteCloser
	inputClosed bool

	done chan struct{} // closed once exit holds the final status
	exit ExitInfo
}

// Start launches the CLI and begins reading its stdout. It returns once the
// process has started; the first event is read asynchronously. The context
// covers the start and nothing else: the process outlives it and is stopped
// through CloseInput, Terminate or Kill by whoever owns the session.
func Start(ctx context.Context, cfg Config, log *slog.Logger) (*Process, error) {
	if err := ctx.Err(); err != nil {
		return nil, fmt.Errorf("start claude: %w", err)
	}

	//nolint:gosec // G204: the binary path comes from Locate or an explicit override
	cmd := exec.Command(cfg.Binary, slices.Concat(Args, sessionArgs(cfg), choiceArgs(cfg))...)
	cmd.Dir = cfg.Dir
	cmd.Env = cfg.Env
	// Its own process group, so Terminate and Kill also reach the shells the
	// CLI spawns for the agent.
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	stderr := &tailBuffer{limit: stderrTail}
	cmd.Stderr = stderr

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, fmt.Errorf("open claude stdin: %w", err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("open claude stdout: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start claude %s: %w", cfg.Binary, err)
	}

	p := &Process{
		log:    log.With("session", cfg.SessionID),
		cmd:    cmd,
		events: make(chan Event, eventBuffer),
		stderr: stderr,
		stdin:  stdin,
		done:   make(chan struct{}),
	}

	ended := make(chan struct{})
	go func() {
		defer close(ended)
		p.read(stdout)
	}()
	go p.reap(ended)

	p.log.Debug("claude started", "pid", cmd.Process.Pid, "dir", cfg.Dir, "resume", cfg.Resume,
		"model", cfg.Model, "effort", cfg.Effort)
	return p, nil
}

// Events delivers decoded stdout lines in order. It is closed when stdout
// ends; call Wait afterwards for the exit information.
func (p *Process) Events() <-chan Event {
	return p.events
}

// Send writes a user message. It fails once the input is closed.
func (p *Process) Send(text string) error {
	if err := p.write(UserMessage(text)); err != nil {
		return fmt.Errorf("send user message: %w", err)
	}
	return nil
}

// Interrupt writes an interrupt control request and returns its request id.
func (p *Process) Interrupt() (string, error) {
	requestID := uuid.NewString()
	if err := p.write(InterruptRequest(requestID)); err != nil {
		return "", fmt.Errorf("send interrupt request: %w", err)
	}
	return requestID, nil
}

// Respond writes a control response to a can_use_tool request.
func (p *Process) Respond(requestID string, resp PermissionResponse) error {
	line, err := ControlResponse(requestID, resp)
	if err != nil {
		return err
	}
	if err := p.write(line); err != nil {
		return fmt.Errorf("send control response %s: %w", requestID, err)
	}
	return nil
}

// CloseInput closes stdin, which asks the CLI to exit once idle. Closing an
// input that is already closed does nothing.
func (p *Process) CloseInput() error {
	p.inputMu.Lock()
	defer p.inputMu.Unlock()

	if p.inputClosed {
		return nil
	}
	p.inputClosed = true
	if err := p.stdin.Close(); err != nil {
		return fmt.Errorf("close claude input: %w", err)
	}
	return nil
}

// Terminate sends SIGTERM.
func (p *Process) Terminate() error {
	return p.signal(syscall.SIGTERM)
}

// Kill sends SIGKILL.
func (p *Process) Kill() error {
	return p.signal(syscall.SIGKILL)
}

// Wait blocks until the process has exited and returns how.
func (p *Process) Wait() ExitInfo {
	<-p.done
	return p.exit
}

// Done is closed when the process has exited.
func (p *Process) Done() <-chan struct{} {
	return p.done
}

// write puts one line on stdin, serialised against the other writers.
func (p *Process) write(line []byte) error {
	p.inputMu.Lock()
	defer p.inputMu.Unlock()

	if p.inputClosed {
		return ErrInputClosed
	}
	// The pipe is unbuffered, so the line and its terminator go in one write.
	if _, err := p.stdin.Write(append(line, '\n')); err != nil {
		return fmt.Errorf("write to claude: %w", err)
	}
	return nil
}

// signal reaches the whole process group, so the children of the CLI go with
// it. A process that has already exited is not an error.
func (p *Process) signal(sig syscall.Signal) error {
	select {
	case <-p.done:
		return nil
	default:
	}

	err := syscall.Kill(-p.cmd.Process.Pid, sig)
	if err != nil && !errors.Is(err, syscall.ESRCH) {
		return fmt.Errorf("signal claude with %s: %w", signalName(sig), err)
	}
	return nil
}

// read decodes stdout line by line until it ends, closing the event channel on
// the way out. An undecodable line is dropped: one bad line must not take the
// session down.
func (p *Process) read(stdout io.Reader) {
	defer close(p.events)

	scanner := bufio.NewScanner(stdout)
	scanner.Buffer(make([]byte, 0, scanBuffer), maxLine)
	for scanner.Scan() {
		event, err := Decode(scanner.Bytes())
		if err != nil {
			p.log.Warn("claude line dropped", "err", err)
			continue
		}
		p.events <- event
	}
	if err := scanner.Err(); err != nil {
		p.log.Warn("claude stdout failed", "err", err)
	}
}

// reap waits for the process once its output has ended and publishes how it
// went to everyone blocked on Wait or Done.
func (p *Process) reap(ended <-chan struct{}) {
	<-ended

	err := p.cmd.Wait()
	p.exit = exitInfo(p.cmd.ProcessState, p.stderr.String())
	if p.cmd.ProcessState == nil {
		p.log.Warn("claude wait failed", "err", err)
	}
	close(p.done)
}

// exitInfo reads the exit status, with -1 and no signal when there is none.
func exitInfo(state *os.ProcessState, stderr string) ExitInfo {
	info := ExitInfo{Code: -1, Stderr: stderr}
	if state == nil {
		return info
	}

	info.Code = state.ExitCode()
	if status, ok := state.Sys().(syscall.WaitStatus); ok && status.Signaled() {
		info.Signal = signalName(status.Signal())
	}
	return info
}

// signalName names a signal the way an error message reads best: SIGTERM,
// not "terminated".
func signalName(sig syscall.Signal) string {
	switch sig {
	case syscall.SIGHUP:
		return "SIGHUP"
	case syscall.SIGINT:
		return "SIGINT"
	case syscall.SIGQUIT:
		return "SIGQUIT"
	case syscall.SIGABRT:
		return "SIGABRT"
	case syscall.SIGKILL:
		return "SIGKILL"
	case syscall.SIGSEGV:
		return "SIGSEGV"
	case syscall.SIGTERM:
		return "SIGTERM"
	default:
		return "signal " + strconv.Itoa(int(sig))
	}
}

// sessionArgs name the session on the command line: a new one by id, an
// existing one to resume.
func sessionArgs(cfg Config) []string {
	if cfg.Resume {
		return []string{"--resume", cfg.SessionID}
	}
	return []string{"--session-id", cfg.SessionID}
}

// choiceArgs name the model and the effort of the process. Both are always on
// the command line: the defaults of the machine never decide how a session runs.
func choiceArgs(cfg Config) []string {
	return []string{"--model", cfg.Model, "--effort", cfg.Effort}
}

// tailBuffer keeps the last limit bytes written to it, which is all the app
// needs from stderr to explain an exit.
type tailBuffer struct {
	limit int

	mu  sync.Mutex
	buf []byte
}

// Write keeps the tail of what it is given and reports the whole write done.
func (b *tailBuffer) Write(chunk []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.buf = append(b.buf, chunk...)
	if extra := len(b.buf) - b.limit; extra > 0 {
		b.buf = append(b.buf[:0], b.buf[extra:]...)
	}
	return len(chunk), nil
}

// String is what was kept, safe to call while the process still runs.
func (b *tailBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()

	return string(b.buf)
}
