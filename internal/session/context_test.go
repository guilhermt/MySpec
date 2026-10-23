package session_test

import (
	"fmt"
	"sync"
	"testing"

	"github.com/guilhermt/myspec/internal/claude"
	"github.com/guilhermt/myspec/internal/session"
)

// scriptedProcess is a Process whose events the test writes: it drops what the
// fake CLI says and answers no get_context_usage by itself.
type scriptedProcess struct {
	session.Process

	out chan claude.Event

	mu    sync.Mutex
	asked []string // the request ids of get_context_usage, in order
}

func newScriptedProcess(p session.Process) *scriptedProcess {
	s := &scriptedProcess{Process: p, out: make(chan claude.Event, 16)}
	go func() {
		for range p.Events() {
		}
		close(s.out)
	}()
	return s
}

func (p *scriptedProcess) Events() <-chan claude.Event { return p.out }

func (p *scriptedProcess) ContextUsage() (string, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	id := fmt.Sprintf("context-%d", len(p.asked)+1)
	p.asked = append(p.asked, id)
	return id, nil
}

// requests returns the ids of the get_context_usage requests sent so far.
func (p *scriptedProcess) requests() []string {
	p.mu.Lock()
	defer p.mu.Unlock()

	return append([]string(nil), p.asked...)
}

// emit delivers one line of the CLI to the service.
func (p *scriptedProcess) emit(t *testing.T, line string) {
	t.Helper()

	ev, err := claude.Decode([]byte(line))
	if err != nil {
		t.Fatalf("Decode(%s) = %v, want nil", line, err)
	}
	p.out <- ev
}

// answer delivers the answer of the CLI to the request with the given id.
func (p *scriptedProcess) answer(t *testing.T, id, body string) {
	t.Helper()

	p.emit(t, fmt.Sprintf(`{"type":"control_response","response":{"subtype":"success","request_id":%q,"response":%s}}`, id, body))
}

// messageStart delivers the start of a response of the main thread that read
// the given tokens.
func (p *scriptedProcess) messageStart(t *testing.T, tokens int) {
	t.Helper()

	p.emit(t, fmt.Sprintf(`{"type":"stream_event","event":{"type":"message_start","message":{"id":"m","model":"x","usage":{"input_tokens":%d}}}}`, tokens))
}

// scriptedFixture starts a session whose process the test scripts.
func scriptedFixture(t *testing.T) (*fixture, *scriptedProcess) {
	t.Helper()

	var proc *scriptedProcess
	f := newFixtureWith(t, &fakeLauncher{scenario: "echo", wrap: func(p session.Process) session.Process {
		proc = newScriptedProcess(p)
		return proc
	}}, 0)
	f.start(t, taskInfo(t, "t1"))
	waitFor(t, "the request of the context", func() bool { return len(proc.requests()) == 1 })
	return f, proc
}

func percentOf(t *testing.T, f *fixture) *int {
	t.Helper()

	return f.summary(t, prd("t1")).ContextPercent
}

func wantPercent(t *testing.T, f *fixture, want int) {
	t.Helper()

	waitFor(t, fmt.Sprintf("the context at %d%%", want), func() bool {
		got := percentOf(t, f)
		return got != nil && *got == want
	})
}

func TestStartedProcessAsksForTheContext(t *testing.T) {
	t.Parallel()
	f, proc := scriptedFixture(t)

	if got := percentOf(t, f); got != nil {
		t.Fatalf("ContextPercent = %d, want nil before the answer", *got)
	}
	proc.answer(t, proc.requests()[0], `{"totalTokens":20000,"rawMaxTokens":200000}`)

	wantPercent(t, f, 10)
}

func TestExactReadingSurvivesALateEstimate(t *testing.T) {
	t.Parallel()
	f, proc := scriptedFixture(t)

	proc.messageStart(t, 100000)
	proc.answer(t, proc.requests()[0], `{"totalTokens":20000,"rawMaxTokens":200000}`)

	wantPercent(t, f, 50)
}

func TestCompactionAsksForTheEstimateAfterIt(t *testing.T) {
	t.Parallel()
	f, proc := scriptedFixture(t)
	proc.answer(t, proc.requests()[0], `{"totalTokens":0,"rawMaxTokens":200000}`)
	proc.messageStart(t, 120000)
	wantPercent(t, f, 60)

	proc.emit(t, `{"type":"system","subtype":"compact_boundary","compact_metadata":{"trigger":"auto","pre_tokens":120000}}`)
	waitFor(t, "the second request", func() bool { return len(proc.requests()) == 2 })
	proc.answer(t, proc.requests()[1], `{"totalTokens":30000,"rawMaxTokens":200000}`)

	wantPercent(t, f, 15)
}

func TestResultDoesNotChangeTheWindow(t *testing.T) {
	t.Parallel()
	f, proc := scriptedFixture(t)
	proc.answer(t, proc.requests()[0], `{"totalTokens":0,"rawMaxTokens":200000}`)
	proc.messageStart(t, 100000)
	wantPercent(t, f, 50)

	proc.emit(t, `{"type":"result","subtype":"success","is_error":false,"result":"","terminal_reason":"completed","modelUsage":{"x":{"contextWindow":1000000}}}`)
	waitFor(t, "the turn to end", func() bool { return !f.summary(t, prd("t1")).TurnRunning })

	wantPercent(t, f, 50)
}

func TestRefusedContextUsageChangesNothing(t *testing.T) {
	t.Parallel()
	f, proc := scriptedFixture(t)
	proc.messageStart(t, 100000)
	proc.answer(t, proc.requests()[0], `{"totalTokens":0,"rawMaxTokens":200000}`)
	wantPercent(t, f, 50)

	proc.emit(t, `{"type":"system","subtype":"compact_boundary","compact_metadata":{"trigger":"auto","pre_tokens":120000}}`)
	waitFor(t, "the second request", func() bool { return len(proc.requests()) == 2 })
	proc.emit(t, fmt.Sprintf(`{"type":"control_response","response":{"subtype":"error","request_id":%q,"error":"nope"}}`, proc.requests()[1]))
	proc.messageStart(t, 40000)

	wantPercent(t, f, 20)
}

func TestContextPercent(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name           string
		tokens, window int
		want           *int
	}{
		{"no window", 5000, 0, nil},
		{"no tokens", 0, 200000, nil},
		{"a real zero", 1, 1000000, new(0)},
		{"rounds", 4400, 10000, new(44)},
		{"rounds up", 4450, 10000, new(45)},
		{"clamps at 100", 250000, 200000, new(100)},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := session.ContextPercent(tt.tokens, tt.window)
			switch {
			case got == nil && tt.want == nil:
			case got == nil || tt.want == nil || *got != *tt.want:
				t.Errorf("contextPercent(%d, %d) = %v, want %v", tt.tokens, tt.window, got, tt.want)
			}
		})
	}
}
