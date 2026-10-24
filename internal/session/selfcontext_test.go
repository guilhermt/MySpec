package session_test

import (
	"bytes"
	"errors"
	"log/slog"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/claude"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/session"
)

const stateOfTheItem = "<myspec-state>S</myspec-state>"

// sentToTheCLI records what the service hands to every process it starts.
type sentToTheCLI struct {
	mu     sync.Mutex
	states []string
}

func (r *sentToTheCLI) wrap(p session.Process) session.Process {
	return &stateRecordingProcess{Process: p, sent: r}
}

func (r *sentToTheCLI) all() []string {
	r.mu.Lock()
	defer r.mu.Unlock()

	return append([]string(nil), r.states...)
}

// stateRecordingProcess keeps the state of every message sent through it.
type stateRecordingProcess struct {
	session.Process
	sent *sentToTheCLI
}

func (p *stateRecordingProcess) Send(state, text string, imgs []claude.Image) error {
	p.sent.mu.Lock()
	p.sent.states = append(p.sent.states, state)
	p.sent.mu.Unlock()
	return p.Process.Send(state, text, imgs)
}

// lastAnswer is the text of the last answer of the agent.
func lastAnswer(t *testing.T, f *fixture, k session.Key) string {
	t.Helper()

	assistants := f.entriesOf(t, k, session.KindAssistant)
	if len(assistants) == 0 {
		t.Fatal("no answer from the agent")
	}
	return assistants[len(assistants)-1].Assistant.Text
}

func constantState() func(session.Key) (string, error) {
	return func(session.Key) (string, error) { return stateOfTheItem, nil }
}

func TestEveryProcessOfASessionStartsWithItsIdentity(t *testing.T) {
	t.Parallel()

	f := newSelfContextFixture(t, &fakeLauncher{scenario: "echo"},
		func(i session.TaskInfo) string { return "identity of " + i.Stage }, nil, nil)
	f.start(t, taskInfo(t, "t1"))
	f.waitIdle(t, prd("t1"))

	other := models.Choice{Model: models.Sonnet5, Effort: models.High}
	if err := f.service.SetChoice(t.Context(), prd("t1"), other); err != nil {
		t.Fatalf("SetChoice() = %v, want nil", err)
	}
	f.send(t, prd("t1"), "again")
	waitFor(t, "the second process", func() bool { return len(f.launcher.started()) == 2 })

	for i, cfg := range f.launcher.started() {
		if want := "identity of prd"; cfg.AppendSystemPrompt != want {
			t.Errorf("process %d AppendSystemPrompt = %q, want %q", i+1, cfg.AppendSystemPrompt, want)
		}
	}
}

func TestTheStateOfTheItemGoesAheadOfTheMessageAndStaysOutOfTheTranscript(t *testing.T) {
	t.Parallel()

	f := newSelfContextFixture(t, &fakeLauncher{scenario: "echo"}, nil, constantState(), nil)
	f.start(t, taskInfo(t, "t1"))
	f.waitIdle(t, prd("t1"))

	f.send(t, prd("t1"), "hello")
	f.waitIdle(t, prd("t1"))
	waitFor(t, "the echo of the message", func() bool {
		return lastAnswer(t, f, prd("t1")) == stateOfTheItem+"hello"
	})

	users := f.entriesOf(t, prd("t1"), session.KindUser)
	if got := users[len(users)-1].User.Text; got != "hello" {
		t.Errorf("transcript text = %q, want %q", got, "hello")
	}
	for _, u := range users {
		if strings.Contains(u.User.Text, "myspec-state") || strings.Contains(u.User.Sent, "myspec-state") {
			t.Errorf("user entry %+v carries the state, want it out of the transcript", u.User)
		}
	}
}

func TestTheStateIsReadWhenTheMessageIsDelivered(t *testing.T) {
	t.Parallel()

	var mu sync.Mutex
	value, calls := "first", 0
	itemState := func(session.Key) (string, error) {
		mu.Lock()
		defer mu.Unlock()
		calls++
		return value, nil
	}
	sent := &sentToTheCLI{}
	f := newSelfContextFixture(t, &fakeLauncher{scenario: "slow", wrap: sent.wrap}, nil, itemState, nil)
	f.start(t, taskInfo(t, "t1"))
	waitStreaming(t, f, prd("t1"))

	f.send(t, prd("t1"), "second")
	mu.Lock()
	value = "later"
	got := calls
	mu.Unlock()
	if got != 1 {
		t.Fatalf("ItemState calls = %d while the message waits, want 1 (the prompt's)", got)
	}

	if err := f.service.Interrupt(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Interrupt() = %v, want nil", err)
	}
	f.waitStatus(t, prd("t1"), "the queued message to go out", func(s session.Summary) bool {
		return s.PendingCount == 0 && s.TurnRunning
	})

	if diff := strings.Join(sent.all(), ","); diff != "first,later" {
		t.Errorf("states delivered = %q, want first,later", diff)
	}
	mu.Lock()
	defer mu.Unlock()
	if calls != 2 {
		t.Errorf("ItemState calls = %d, want 2", calls)
	}
}

func TestTheStateIsReadWithoutTheMutexOfTheService(t *testing.T) {
	t.Parallel()

	var f *fixture
	itemState := func(k session.Key) (string, error) {
		f.service.Summary(k)
		return stateOfTheItem, nil
	}
	f = newSelfContextFixture(t, &fakeLauncher{scenario: "echo"}, nil, itemState, nil)
	f.start(t, taskInfo(t, "t1"))
	f.waitIdle(t, prd("t1"))

	waitFor(t, "the echo of the prompt", func() bool {
		return strings.HasPrefix(lastAnswer(t, f, prd("t1")), stateOfTheItem)
	})
}

// syncBuffer is a buffer the log handler and the test share.
type syncBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *syncBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	return b.buf.Write(p)
}

func (b *syncBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()

	return b.buf.String()
}

func TestAMessageGoesWithoutStateWhenTheStateCannotBeRead(t *testing.T) {
	t.Parallel()

	logs := &syncBuffer{}
	itemState := func(session.Key) (string, error) { return "", errors.New("no state today") }
	f := newSelfContextFixture(t, &fakeLauncher{scenario: "echo"}, nil, itemState,
		slog.New(slog.NewTextHandler(logs, nil)))
	f.start(t, taskInfo(t, "t1"))
	f.waitIdle(t, prd("t1"))

	f.send(t, prd("t1"), "hello")
	waitFor(t, "the echo of the message", func() bool {
		return lastAnswer(t, f, prd("t1")) == "hello"
	})

	out := logs.String()
	for _, want := range []string{"session state failed", "task=t1", "stage=prd", "no state today"} {
		if !strings.Contains(out, want) {
			t.Errorf("log = %q, want it to contain %q", out, want)
		}
	}
}

func TestTheProductPromptCarriesTheStateToo(t *testing.T) {
	t.Parallel()

	f := newSelfContextFixture(t, &fakeLauncher{scenario: "echo"}, nil, constantState(), nil)
	k := session.Key{TaskID: "t1", Stage: string(prompts.StageTechSpec)}
	f.start(t, atStage(taskInfo(t, "t1"), prompts.StageTechSpec))
	f.waitIdle(t, k)

	users := f.entriesOf(t, k, session.KindUser)
	if len(users) != 1 || users[0].User.Sent == "" {
		t.Fatalf("users = %+v, want the prompt with what was sent", users)
	}
	sent := users[0].User.Sent
	if strings.Contains(sent, "myspec-state") {
		t.Errorf("Sent = %q, want the rendered prompt only", sent)
	}
	if got, want := lastAnswer(t, f, k), stateOfTheItem+sent; got != want {
		t.Errorf("the CLI got %q, want %q", got, want)
	}
}

func TestAPausedSessionDropsTheStateItRead(t *testing.T) {
	t.Parallel()

	release := make(chan struct{})
	var mu sync.Mutex
	calls := 0
	itemState := func(session.Key) (string, error) {
		mu.Lock()
		calls++
		first := calls == 1
		mu.Unlock()
		if first {
			<-release
		}
		return stateOfTheItem, nil
	}
	sent := &sentToTheCLI{}
	f := newSelfContextFixture(t, &fakeLauncher{scenario: "echo", wrap: sent.wrap}, nil, itemState, nil)
	f.start(t, taskInfo(t, "t1"))
	waitFor(t, "the reading of the state", func() bool {
		mu.Lock()
		defer mu.Unlock()
		return calls == 1
	})

	if err := f.service.Pause(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Pause() = %v, want nil", err)
	}
	close(release)
	time.Sleep(100 * time.Millisecond)
	if got := sent.all(); len(got) != 0 {
		t.Fatalf("delivered while paused: %q, want nothing", got)
	}

	if err := f.service.Resume(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Resume() = %v, want nil", err)
	}
	f.waitIdle(t, prd("t1"))
	if got := sent.all(); len(got) != 1 || got[0] != stateOfTheItem {
		t.Errorf("states delivered = %q, want one with the state", got)
	}
	mu.Lock()
	defer mu.Unlock()
	if calls != 2 {
		t.Errorf("ItemState calls = %d, want 2 (a new reading after Resume)", calls)
	}
}
