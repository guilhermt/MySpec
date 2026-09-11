package bindings_test

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/attention"
	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/claude"
	"github.com/guilhermt/myspec/internal/claude/claudetest"
	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/git/gittest"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/store"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/theme"
	"github.com/guilhermt/myspec/internal/workspace"
	"github.com/guilhermt/myspec/internal/worktree"
)

// TestMain lets the test binary stand in for the claude CLI: a child process
// started with EnvFlag set runs the fake instead of the tests.
func TestMain(m *testing.M) {
	if os.Getenv(claudetest.EnvFlag) == "1" {
		os.Exit(claudetest.Run())
	}
	os.Exit(m.Run())
}

// The bounds a fixture puts on the fake CLI, which runs as another process.
const (
	pollTimeout     = 10 * time.Second
	pollStep        = 10 * time.Millisecond
	shutdownTimeout = 10 * time.Second
)

// fakeLauncher runs this test binary as the fake CLI playing the writer
// scenario: every message comes back as the agent's answer, and the files the
// prompts of a fixture ask for are written along the way.
type fakeLauncher struct {
	env func() []string // what the fixture adds to the environment of a run
}

func (fakeLauncher) Locate() (string, error) { return os.Args[0], nil }

func (fakeLauncher) Preflight(context.Context, string) error { return nil }

func (l fakeLauncher) Start(ctx context.Context, cfg claude.Config) (session.Process, error) {
	cfg.Env = append(os.Environ(),
		claudetest.EnvFlag+"=1",
		claudetest.EnvScenario+"=writer",
	)
	cfg.Env = append(cfg.Env, l.env()...)
	proc, err := claude.Start(ctx, cfg, slog.New(slog.DiscardHandler))
	if err != nil {
		return nil, err
	}
	return proc, nil
}

// syncBuffer collects the log while the services behind it are still writing,
// which is what lets a test read it from a parallel subtest.
type syncBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *syncBuffer) Write(chunk []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	return b.buf.Write(chunk)
}

func (b *syncBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()

	return b.buf.String()
}

// fakeEditor stands in for VS Code, recording what it was asked to open.
type fakeEditor struct {
	mu    sync.Mutex
	paths []string
	err   error
}

func (e *fakeEditor) open(paths ...string) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.paths = append(e.paths, strings.Join(paths, " "))
	return e.err
}

// opened is what the editor was asked to open, in order, one entry per call.
func (e *fakeEditor) opened() []string {
	e.mu.Lock()
	defer e.mu.Unlock()

	return slices.Clone(e.paths)
}

// fakeSituationStore stands in for the table of situations. It remembers
// nothing, which is all a service that never loads a workspace needs.
type fakeSituationStore struct{}

func (fakeSituationStore) ListByTasks(context.Context, []string) ([]attention.Record, error) {
	return nil, nil
}

func (fakeSituationStore) Upsert(context.Context, attention.Record) error { return nil }

func (fakeSituationStore) Delete(context.Context, string, string) error { return nil }

// fakeNotifier stands in for the desktop notifications, recording what it is
// asked: send:<id> and withdraw:<id>.
type fakeNotifier struct {
	calls []string
}

func (n *fakeNotifier) Send(id, _, _ string) {
	n.calls = append(n.calls, "send:"+id)
}

func (n *fakeNotifier) Withdraw(id string) {
	n.calls = append(n.calls, "withdraw:"+id)
}

// fakeClock is a clock that moves only when the test moves it.
type fakeClock struct {
	now time.Time
}

func (c *fakeClock) Now() time.Time { return c.now }

// fakePicker stands in for the native folder chooser.
type fakePicker struct {
	path    string
	ok      bool
	err     error
	startIn string // what the service asked the dialog to open at
	calls   int
}

func (p *fakePicker) PickFolder(startIn string) (string, bool, error) {
	p.startIn = startIn
	p.calls++
	return p.path, p.ok, p.err
}

// fixture wires the services the way internal/app does, over an in-memory
// database and a scanner that answers with a fixed list.
type fixture struct {
	workspace *bindings.WorkspaceService
	settings  *bindings.SettingsService
	tasks     *bindings.TaskService
	ws        *workspace.Service
	theme     *theme.Service
	store     *store.Store
	taskSvc   *task.Service
	sessions  *session.Service
	worktrees *worktree.Service
	reviews   *review.Service
	flow      *flow.Service
	dataDir   string
	picker    *fakePicker
	editor    *fakeEditor
	logs      *syncBuffer

	mu          sync.Mutex
	repos       []string
	scanErr     error
	fakeEnv     []string
	events      []bindings.TranscriptEvent
	corrections map[string]int // the most the session of a task ever counted
}

func newFixture(t *testing.T) *fixture {
	t.Helper()

	logs := &syncBuffer{}
	log := slog.New(slog.NewJSONHandler(logs, nil))

	st, err := store.OpenMemory(t.Context(), log)
	if err != nil {
		t.Fatalf("OpenMemory() = %v, want nil", err)
	}
	t.Cleanup(func() { _ = st.Close() })

	f := &fixture{
		store:       st,
		picker:      &fakePicker{},
		editor:      &fakeEditor{},
		logs:        logs,
		corrections: map[string]int{},
	}

	f.theme, err = theme.New(t.Context(), st.Settings, false, log, func() {})
	if err != nil {
		t.Fatalf("theme.New() = %v, want nil", err)
	}
	f.ws = workspace.New(workspace.Deps{
		Recents: st.Recents,
		Scan:    f.scan,
		Log:     log,
	})

	f.dataDir = t.TempDir()
	if err = prompts.Seed(f.dataDir, log); err != nil {
		t.Fatalf("prompts.Seed() = %v, want nil", err)
	}
	f.sessions = session.New(session.Deps{
		Sessions: st.Sessions,
		Entries:  st.Entries,
		Launcher: fakeLauncher{env: f.env},
		RenderPrompt: func(stage prompts.Stage, vars prompts.Vars) (string, error) {
			return prompts.Render(f.dataDir, stage, vars)
		},
		Log:          log,
		OnState:      f.onState,
		OnTranscript: f.onTranscript,
	})
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()
		f.sessions.Shutdown(ctx)
	})
	f.taskSvc, err = task.New(task.Deps{
		Repo:    st.Tasks,
		DataDir: f.dataDir,
		Log:     log,
		Repos:   f.repoPaths,
		OnArtifact: func(t task.Task, changes []task.Change) {
			key := session.Key{TaskID: t.ID, Stage: string(t.Stage)}
			for _, c := range changes {
				f.sessions.MarkArtifact(context.Background(), key, session.ArtifactKind(c.Kind), c.First)
			}
			f.flow.Check(t.ID)
		},
	})
	if err != nil {
		t.Fatalf("task.New() = %v, want nil", err)
	}
	t.Cleanup(func() { _ = f.taskSvc.Close() })

	f.worktrees = worktree.New(worktree.Deps{
		Git:   git.New(git.Deps{Log: log, Env: gittest.Env(t)}),
		Store: st.Worktrees,
		Log:   log,
	})
	f.reviews, err = review.New(review.Deps{Worktrees: f.worktrees, Log: log})
	if err != nil {
		t.Fatalf("review.New() = %v, want nil", err)
	}
	t.Cleanup(func() { _ = f.reviews.Close() })

	f.flow = flow.New(flow.Deps{
		Tasks:     f.taskSvc,
		Sessions:  f.sessions,
		Worktrees: f.worktrees,
		Review:    f.reviews,
		Log:       log,
		RenderPrompt: func(stage prompts.Stage, vars prompts.Vars) (string, error) {
			return prompts.Render(f.dataDir, stage, vars)
		},
		OnChange: func(string) {},
	})
	t.Cleanup(f.flow.Close)

	f.workspace = bindings.NewWorkspaceService(f.ws, f.snapshot, f.picker, log)
	f.settings = bindings.NewSettingsService(f.theme, log)
	f.tasks = bindings.NewTaskService(f.taskSvc, f.sessions, f.flow, f.editor.open, log)
	return f
}

// onState is what internal/app does on every session change: it publishes the
// state, which the fixture reads on demand, and lets the flow decide.
func (f *fixture) onState(k session.Key) {
	if summary, ok := f.sessions.Summary(k); ok {
		f.mu.Lock()
		f.corrections[k.TaskID] = max(f.corrections[k.TaskID], summary.Corrections)
		f.mu.Unlock()
	}
	f.flow.Check(k.TaskID)
}

// onTranscript keeps every change of a conversation, the way internal/app
// emits them, so that a test can look at a stage that has since closed.
func (f *fixture) onTranscript(ev session.TranscriptEvent) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.events = append(f.events, bindings.FromTranscriptEvent(ev))
}

// entries are the entries of every conversation of the fixture, in the order
// they were emitted.
func (f *fixture) entries() []bindings.Entry {
	f.mu.Lock()
	defer f.mu.Unlock()

	entries := make([]bindings.Entry, 0, len(f.events))
	for _, ev := range f.events {
		if ev.Entry != nil {
			entries = append(entries, *ev.Entry)
		}
	}
	return entries
}

// correctionCount is the most corrections the session of a task ever counted,
// which outlives the session the stage closed.
func (f *fixture) correctionCount(id string) int {
	f.mu.Lock()
	defer f.mu.Unlock()

	return f.corrections[id]
}

// env is what the fixture adds to the environment of the fake CLI.
func (f *fixture) env() []string {
	f.mu.Lock()
	defer f.mu.Unlock()

	return slices.Clone(f.fakeEnv)
}

// fixStep makes the fake rewrite path as a valid step of repo from its second
// turn on, which is how a test drives the correction of a plan.
func (f *fixture) fixStep(path, repo string) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.fakeEnv = []string{
		claudetest.EnvWriterFix + "=" + path,
		claudetest.EnvWriterRepo + "=" + repo,
	}
}

// seedPrompt replaces the prompt of a stage with one the fake CLI acts on.
func (f *fixture) seedPrompt(t *testing.T, stage prompts.Stage, content string) {
	t.Helper()

	path := filepath.Join(prompts.Dir(f.dataDir), string(stage)+".md")
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("WriteFile(%s) = %v, want nil", path, err)
	}
}

// waitStage waits until a task reaches a stage, failing the test when it does
// not in time.
func (f *fixture) waitStage(t *testing.T, id, stage string) {
	t.Helper()

	deadline := time.Now().Add(pollTimeout)
	last := ""
	for time.Now().Before(deadline) {
		last = f.taskOf(t, id).Stage
		if last == stage {
			return
		}
		time.Sleep(pollStep)
	}
	t.Fatalf("stage of task %s = %q, want %q", id, last, stage)
}

// waitStep waits until a step of a task reaches status, failing the test when
// it does not in time.
func (f *fixture) waitStep(t *testing.T, id string, number int, status string) bindings.Step {
	t.Helper()

	return f.waitStepWhere(t, id, number, "status "+status, func(step bindings.Step) bool {
		return step.Status == status
	})
}

// waitReviewed waits until a step of a task is the user's to review: the agent
// has stopped and the reading of its worktree has landed with what it wrote.
// Waiting for the reading is what tells the turn of the step apart from the
// idle moment before it starts.
func (f *fixture) waitReviewed(t *testing.T, id string, number int) bindings.Step {
	t.Helper()

	return f.waitStepWhere(t, id, number, "the reading of its worktree", func(step bindings.Step) bool {
		return step.Status == "awaiting_review" && step.Review != nil && step.Review.Total > 0
	})
}

// waitStepWhere waits until a step of a task is what cond says, failing the
// test with subject when it never is.
func (f *fixture) waitStepWhere(
	t *testing.T, id string, number int, subject string, cond func(bindings.Step) bool,
) bindings.Step {
	t.Helper()

	deadline := time.Now().Add(pollTimeout)
	last := bindings.Step{}
	for time.Now().Before(deadline) {
		for _, step := range f.taskOf(t, id).Steps {
			if step.Number != number {
				continue
			}
			last = step
			if cond(step) {
				return step
			}
		}
		time.Sleep(pollStep)
	}
	t.Fatalf("step %d of task %s = %+v, want %s", number, id, last, subject)
	return bindings.Step{}
}

// open opens dir as the workspace and loads its tasks, the way internal/app
// does on every workspace change.
func (f *fixture) open(t *testing.T, dir string) {
	t.Helper()

	if err := f.ws.Open(t.Context(), dir); err != nil {
		t.Fatalf("Open(%s) = %v, want nil", dir, err)
	}
	if err := f.taskSvc.Sync(t.Context(), dir); err != nil {
		t.Fatalf("Sync(%s) = %v, want nil", dir, err)
	}
	loaded := f.taskSvc.List()
	ids := make([]string, len(loaded))
	for i, one := range loaded {
		ids[i] = one.ID
	}
	if err := f.worktrees.Sync(t.Context(), ids); err != nil {
		t.Fatalf("worktrees.Sync() = %v, want nil", err)
	}
	f.flow.Sync(t.Context())
}

// repoPaths are the repositories of the open workspace, as internal/app gives
// them to the task service.
func (f *fixture) repoPaths() []string {
	current := f.ws.Current()
	if current == nil {
		return nil
	}

	paths := make([]string, len(current.Repos))
	for i, repo := range current.Repos {
		paths[i] = repo.Path
	}
	return paths
}

// taskOf returns the task with the given id from the current state, failing
// the test when the state does not hold it.
// waitTranscript waits until the conversation of a stage of a task has been
// opened. The stage of the task is recorded before the session behind it writes
// its first entry, so a test that waits on the stage alone can read the
// conversation while it is still empty.
func (f *fixture) waitTranscript(t *testing.T, id, stage string) bindings.Transcript {
	t.Helper()

	deadline := time.Now().Add(pollTimeout)
	last := bindings.Transcript{}
	for time.Now().Before(deadline) {
		transcript, err := f.tasks.GetTranscript(id, stage)
		if err != nil {
			t.Fatalf("GetTranscript(%s, %s) = %v, want nil", id, stage, err)
		}
		last = transcript
		if transcript.Stage == stage && len(transcript.Entries) > 0 {
			return transcript
		}
		time.Sleep(pollStep)
	}
	t.Fatalf("conversation of task %s = stage %q with %d entries, want %q with entries",
		id, last.Stage, len(last.Entries), stage)
	return bindings.Transcript{}
}

func (f *fixture) taskOf(t *testing.T, id string) bindings.TaskSummary {
	t.Helper()

	for _, summary := range f.workspace.GetState().Tasks {
		if summary.ID == id {
			return summary
		}
	}
	t.Fatalf("task %s is not in the state", id)
	return bindings.TaskSummary{}
}

// waitForStatus waits until the session of a task reaches status, failing the
// test when it does not in time.
func (f *fixture) waitForStatus(t *testing.T, id, status string) {
	t.Helper()

	deadline := time.Now().Add(pollTimeout)
	last := ""
	for time.Now().Before(deadline) {
		last = f.taskOf(t, id).SessionStatus
		if last == status {
			return
		}
		time.Sleep(pollStep)
	}
	t.Fatalf("sessionStatus of task %s = %q, want %q", id, last, status)
}

// waitContinue waits until a revisited task is ready to move on, failing the
// test when it never is.
func (f *fixture) waitContinue(t *testing.T, id string) {
	t.Helper()

	deadline := time.Now().Add(pollTimeout)
	for time.Now().Before(deadline) {
		if f.taskOf(t, id).CanContinue {
			return
		}
		time.Sleep(pollStep)
	}
	t.Fatalf("task %s never became ready to continue", id)
}

// scan is the Scanner the workspace service uses.
func (f *fixture) scan(string) ([]string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.repos, f.scanErr
}

// setScan makes the next scan answer with repos, or fail with err.
func (f *fixture) setScan(repos []string, err error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.repos, f.scanErr = repos, err
}

// taskArtifacts is what the task service last saw in a task's folder, the way
// internal/app reads it for the snapshot.
func (f *fixture) taskArtifacts(id string) task.Artifacts {
	artifacts, _ := f.taskSvc.Artifacts(id)
	return artifacts
}

// snapshot is the same state internal/app publishes.
func (f *fixture) snapshot() bindings.State {
	recents, err := f.ws.Recents(context.Background())
	if err != nil {
		recents = nil
	}
	return bindings.State{
		Workspace:  bindings.FromWorkspace(f.ws.Current()),
		Recents:    bindings.FromRecents(recents),
		Theme:      string(f.theme.Preference()),
		SystemDark: f.theme.SystemDark(),
		Notice:     bindings.FromNotice(f.ws.Notice()),
		Tasks: bindings.FromTasks(
			f.taskSvc.List(), f.taskArtifacts, f.flow.Steps, f.flow.Repos, f.sessions.Summaries(), nil,
		),
		History: bindings.FromArchived(f.taskSvc.ListArchived(), f.taskArtifacts, f.taskSvc.PRRuns),
	}
}

// logged reports whether a record with the given message was written.
func (f *fixture) logged(t *testing.T, msg string) bool {
	t.Helper()

	for _, line := range strings.Split(strings.TrimSpace(f.logs.String()), "\n") {
		if line == "" {
			continue
		}
		var rec map[string]any
		if err := json.Unmarshal([]byte(line), &rec); err != nil {
			t.Fatalf("parse log line %q: %v", line, err)
		}
		if rec["msg"] == msg {
			return true
		}
	}
	return false
}
