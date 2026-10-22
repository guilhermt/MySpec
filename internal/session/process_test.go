package session_test

import (
	"sync"
	"testing"

	"github.com/guilhermt/myspec/internal/claude"
	"github.com/guilhermt/myspec/internal/session"
)

// The real process declares the per-task methods of the interface.
var _ session.Process = (*claude.Process)(nil)

// recordingProcess is a Process that records the calls the tests look at and
// hands the rest to the process it wraps.
type recordingProcess struct {
	session.Process

	mu    sync.Mutex
	calls []string
}

func (p *recordingProcess) Initialize() error {
	p.record("Initialize")
	return p.Process.Initialize()
}

func (p *recordingProcess) StopTask(taskID string) (string, error) {
	p.record("StopTask " + taskID)
	return p.Process.StopTask(taskID)
}

func (p *recordingProcess) TaskOutput(taskID string) (string, error) {
	p.record("TaskOutput " + taskID)
	return p.Process.TaskOutput(taskID)
}

func (p *recordingProcess) record(call string) {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.calls = append(p.calls, call)
}

func (p *recordingProcess) recorded() []string {
	p.mu.Lock()
	defer p.mu.Unlock()

	return append([]string(nil), p.calls...)
}

func TestEveryProcessDeclaresThePerTaskStop(t *testing.T) {
	t.Parallel()

	var (
		mu   sync.Mutex
		proc *recordingProcess
	)
	f := newFixtureWith(t, &fakeLauncher{scenario: "echo", wrap: func(p session.Process) session.Process {
		mu.Lock()
		defer mu.Unlock()

		proc = &recordingProcess{Process: p}
		return proc
	}}, 0)
	f.start(t, taskInfo(t, "t1"))
	f.waitStatus(t, prd("t1"), "the process", func(s session.Summary) bool { return s.ProcessRunning })

	mu.Lock()
	got := proc.recorded()
	mu.Unlock()
	if len(got) != 1 || got[0] != "Initialize" {
		t.Errorf("calls = %v, want one Initialize at the start of the process", got)
	}
}
