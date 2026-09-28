package bindings_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/attention"
	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/claude"
	"github.com/guilhermt/myspec/internal/claude/claudetest"
	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/discussionflow"
	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/git/gittest"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/pulls"
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/reviewflow"
	"github.com/guilhermt/myspec/internal/reviewmode"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/store"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/theme"
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

// testRepoID is the id of the repository every fixture registers.
const testRepoID = "repo-1"

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
// nothing, which is all a service that never loads a task needs.
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
	mu      sync.Mutex
	path    string
	ok      bool
	err     error
	title   string // what the service put on the dialog
	startIn string // what the service asked the dialog to open at
	calls   int
}

func (p *fakePicker) PickFolder(title, startIn string) (string, bool, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.title, p.startIn = title, startIn
	p.calls++
	return p.path, p.ok, p.err
}

// answer is what the picker hands back from now on.
func (p *fakePicker) answer(path string, ok bool, err error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.path, p.ok, p.err = path, ok, err
}

// asked is the title, the starting folder and how many times the picker was
// opened.
func (p *fakePicker) asked() (title, startIn string, calls int) {
	p.mu.Lock()
	defer p.mu.Unlock()

	return p.title, p.startIn, p.calls
}

// fakeGitHub stands in for gh api graphql: every query answers the same.
type fakeGitHub struct {
	mu   sync.Mutex
	resp gh.Response
	err  error
}

func (g *fakeGitHub) GraphQL(context.Context, string, gh.Vars) (gh.Response, error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	return g.resp, g.err
}

// fail makes every query fail with err from now on.
func (g *fakeGitHub) fail(err error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	g.resp, g.err = gh.Response{}, err
}

// reply makes every query answer with data from now on. One document answers
// them all: a query reads the fields it asked for and ignores the rest.
func (g *fakeGitHub) reply(data string) {
	g.mu.Lock()
	defer g.mu.Unlock()

	g.resp, g.err = gh.Response{Data: json.RawMessage(data)}, nil
}

// offlineGH stands in for the writes of the app on GitHub: a test of the
// bindings never reaches it, and one that does fails here instead of running
// gh.
type offlineGH struct{}

// errOffline is what every write of offlineGH answers.
var errOffline = errors.New("bindings_test: GitHub is not reachable in a test")

func (offlineGH) LookupIssues(context.Context, []gh.IssueRef) (map[gh.IssueRef]gh.IssueNode, error) {
	return nil, errOffline
}

func (offlineGH) LookupRepositories(context.Context, []string) (map[string]string, error) {
	return nil, errOffline
}

func (offlineGH) CreateIssue(context.Context, string, string, string) (gh.IssueNode, error) {
	return gh.IssueNode{}, errOffline
}

func (offlineGH) UpdateIssue(context.Context, string, string, string) error { return errOffline }

func (offlineGH) AddProjectItem(context.Context, string, string) (string, error) {
	return "", errOffline
}

func (offlineGH) SetProjectSingleSelect(context.Context, string, string, string, string) error {
	return errOffline
}

func (offlineGH) AddSubIssue(context.Context, string, string) error { return errOffline }

func (offlineGH) AddBlockedBy(context.Context, string, string) error { return errOffline }

// fixture wires the services the way internal/app does, over an in-memory
// database and a folder picker the test answers for.
type fixture struct {
	state          *bindings.StateService
	repoService    *bindings.RepositoryService
	settings       *bindings.SettingsService
	tasks          *bindings.TaskService
	boardService   *bindings.BoardService
	reviewSvc      *bindings.ReviewService
	discussionSvc  *bindings.DiscussionService
	repositories   *repository.Service
	boards         *board.Service
	github         *fakeGitHub
	theme          *theme.Service
	models         *models.Service
	reviewModes    *reviewmode.Service
	store          *store.Store
	taskSvc        *task.Service
	sessions       *session.Service
	worktrees      *worktree.Service
	reviews        *review.Service
	flow           *flow.Service
	pullRequests   *pulls.Service
	prReviews      *prreview.Service
	reviewFlow     *reviewflow.Service
	discussions    *discussion.Service
	discussionFlow *discussionflow.Service
	dataDir        string
	picker         *fakePicker
	scanRoot       string // the folder the repository scan starts at
	editor         *fakeEditor
	logs           *syncBuffer

	mu          sync.Mutex
	identities  map[string]repository.Identity // by clone path
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
		github:      &fakeGitHub{},
		scanRoot:    t.TempDir(),
		editor:      &fakeEditor{},
		logs:        logs,
		identities:  map[string]repository.Identity{},
		corrections: map[string]int{},
	}

	f.theme, err = theme.New(t.Context(), st.Settings, false, log, func() {})
	if err != nil {
		t.Fatalf("theme.New() = %v, want nil", err)
	}

	f.dataDir = t.TempDir()
	if err = prompts.Prepare(f.dataDir, log); err != nil {
		t.Fatalf("prompts.Prepare() = %v, want nil", err)
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
	f.repositories = repository.New(repository.Deps{
		Store:    st.Repositories,
		Settings: st.Settings,
		Identify: f.identify,
		Counts:   func(id string) (int, int) { return f.taskSvc.Counts(id) },
		Reviews:  func(id string) (int, int) { return f.prReviews.Counts(id) },
		Log:      log,
		NewID:    func() string { return testRepoID },
		ScanRoot: f.scanRoot,
	})
	f.taskSvc, err = task.New(task.Deps{
		Repo:         st.Tasks,
		DataDir:      f.dataDir,
		Log:          log,
		Repositories: f.repositories.Get,
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

	f.boards = board.New(board.Deps{
		Store:        st.Boards,
		GitHub:       f.github,
		Repositories: f.repositories,
		Identify:     f.identify,
		Counts:       func(id string) (int, int) { return f.taskSvc.Counts(id) },
		Log:          log,
	})

	f.worktrees = worktree.New(worktree.Deps{
		Git:     git.New(git.Deps{Log: log, Env: gittest.Env(t)}),
		Store:   st.Worktrees,
		DataDir: f.dataDir,
		Log:     log,
	})
	f.reviews, err = review.New(review.Deps{Worktrees: f.worktrees, Log: log})
	if err != nil {
		t.Fatalf("review.New() = %v, want nil", err)
	}
	t.Cleanup(func() { _ = f.reviews.Close() })

	f.flow = flow.New(flow.Deps{
		Tasks:        f.taskSvc,
		Sessions:     f.sessions,
		Worktrees:    f.worktrees,
		Repositories: f.repositories,
		Review:       f.reviews,
		Log:          log,
		RenderPrompt: func(stage prompts.Stage, vars prompts.Vars) (string, error) {
			return prompts.Render(f.dataDir, stage, vars)
		},
		OnChange: func(string) {},
	})
	t.Cleanup(f.flow.Close)

	f.pullRequests = pulls.New(pulls.Deps{
		GitHub:       f.github,
		Repositories: f.repositories.List,
		Settings:     st.Settings,
		Log:          log,
	})
	t.Cleanup(f.pullRequests.Close)
	f.prReviews = prreview.New(prreview.Deps{
		Store:        st.Reviews,
		DataDir:      f.dataDir,
		Repositories: f.repositories.Get,
		Log:          log,
	})
	f.reviewFlow = reviewflow.New(reviewflow.Deps{
		Reviews:      f.prReviews,
		Pulls:        f.pullRequests,
		Sessions:     f.sessions,
		Worktrees:    f.worktrees,
		Repositories: f.repositories,
		Boards:       f.boards,
		Watch:        f.reviews,
		GH:           gh.New(gh.Deps{Log: log}),
		Log:          log,
		RenderPrompt: func(stage prompts.Stage, vars prompts.Vars) (string, error) {
			return prompts.Render(f.dataDir, stage, vars)
		},
	})
	t.Cleanup(f.reviewFlow.Close)

	f.discussions = discussion.New(discussion.Deps{Store: st.Discussions, DataDir: f.dataDir, Log: log})
	f.discussionFlow = discussionflow.New(discussionflow.Deps{
		Discussions:  f.discussions,
		Sessions:     f.sessions,
		Boards:       f.boards,
		Repositories: f.repositories,
		GH:           offlineGH{},
		Log:          log,
	})
	t.Cleanup(f.discussionFlow.Close)

	f.models, err = models.New(t.Context(), st.Settings, log, func() {})
	if err != nil {
		t.Fatalf("models.New() = %v, want nil", err)
	}
	f.reviewModes, err = reviewmode.New(t.Context(), st.Settings, log, func() {})
	if err != nil {
		t.Fatalf("reviewmode.New() = %v, want nil", err)
	}

	f.state = bindings.NewStateService(f.snapshot)
	f.repoService = bindings.NewRepositoryService(f.repositories, f.picker, log)
	f.settings = bindings.NewSettingsService(f.theme, f.models, f.reviewModes, f.dataDir, log)
	f.tasks = bindings.NewTaskService(
		f.taskSvc, f.sessions, f.flow, f.models, f.reviewModes, f.repositories, f.boards, f.editor.open,
		f.discussions.DocumentOfCard, f.hasConversation, log,
	)
	f.boardService = bindings.NewBoardService(f.boards, f.discussions.DocumentOfCard, log)
	f.reviewSvc = bindings.NewReviewService(
		f.reviewFlow, f.prReviews, f.pullRequests, f.worktrees, f.editor.open, log,
	)
	f.discussionSvc = bindings.NewDiscussionService(
		f.discussionFlow, f.discussions, f.repositories, log,
	)
	return f
}

// hasConversation says whether an id names a review of a pull request or a
// discussion, the way internal/app tells those conversations from the one of a
// task.
func (f *fixture) hasConversation(id string) bool {
	if _, ok := f.prReviews.Get(id); ok {
		return true
	}
	_, ok := f.discussions.Lookup(id)
	return ok
}

// identify is the Identifier of the fixture: a clone the test registered
// answers with its identity, and anything else is refused as not a clone.
func (f *fixture) identify(_ context.Context, path string) (repository.Identity, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	identity, ok := f.identities[path]
	if !ok {
		return repository.Identity{}, &repository.Refusal{Reason: repository.ReasonNotGitRoot, Path: path}
	}
	return identity, nil
}

// setIdentity says what the clone at path is a clone of.
func (f *fixture) setIdentity(path string, identity repository.Identity) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.identities[path] = identity
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

// fixStep makes the fake rewrite path as a valid step from its second turn on,
// which is how a test drives the correction of a plan.
func (f *fixture) fixStep(path string) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.fakeEnv = []string{claudetest.EnvWriterFix + "=" + path}
}

// seedPrompt replaces the prompt of a stage with one the fake CLI acts on, as
// an edit of the user.
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

// register registers the clone at dir as dev/web and loads what the app loads
// at startup. It answers with the id of the repository.
func (f *fixture) register(t *testing.T, dir string) string {
	t.Helper()

	// The app checks the clone before it acts on it, so a folder the test did
	// not clone is given the .git directory that makes it one.
	if err := os.MkdirAll(filepath.Join(dir, ".git"), 0o750); err != nil {
		t.Fatalf("MkdirAll(%s) = %v, want nil", dir, err)
	}
	f.setIdentity(dir, repository.Identity{Owner: "dev", Name: "web"})
	repo, err := f.repositories.Add(t.Context(), dir)
	if err != nil {
		t.Fatalf("Add(%s) = %v, want nil", dir, err)
	}
	f.load(t)
	return repo.ID
}

// load reads the repositories and the tasks, the way internal/app does at
// startup.
func (f *fixture) load(t *testing.T) {
	t.Helper()

	if err := f.repositories.Sync(t.Context()); err != nil {
		t.Fatalf("repositories.Sync() = %v, want nil", err)
	}
	if err := f.boards.Sync(t.Context()); err != nil {
		t.Fatalf("boards.Sync() = %v, want nil", err)
	}
	if err := f.taskSvc.Sync(t.Context()); err != nil {
		t.Fatalf("tasks.Sync() = %v, want nil", err)
	}
	loaded := f.taskSvc.List()
	ids := make([]string, len(loaded))
	for i, one := range loaded {
		ids[i] = one.ID
	}
	if err := f.worktrees.Sync(t.Context(), ids); err != nil {
		t.Fatalf("worktrees.Sync() = %v, want nil", err)
	}
	if err := f.pullRequests.Sync(t.Context()); err != nil {
		t.Fatalf("pulls.Sync() = %v, want nil", err)
	}
	if err := f.prReviews.Sync(t.Context()); err != nil {
		t.Fatalf("prreview.Sync() = %v, want nil", err)
	}
	if err := f.discussions.Sync(t.Context()); err != nil {
		t.Fatalf("discussion.Sync() = %v, want nil", err)
	}
	f.flow.Sync(t.Context())
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

	for _, summary := range f.state.GetState().Tasks {
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

// taskArtifacts is what the task service last saw in a task's folder, the way
// internal/app reads it for the snapshot.
func (f *fixture) taskArtifacts(id string) task.Artifacts {
	artifacts, _ := f.taskSvc.Artifacts(id)
	return artifacts
}

// snapshot is the same state internal/app publishes.
func (f *fixture) snapshot() bindings.State {
	repositories := bindings.FromRepositories(
		f.repositories.List(), f.repositories.Missing, f.taskSvc.Counts, f.prReviews.Counts,
		f.repositories.Cloning,
	)
	return bindings.State{
		Repositories:      repositories,
		RepositoryFilter:  f.repositories.Filter(),
		Theme:             string(f.theme.Preference()),
		SystemDark:        f.theme.SystemDark(),
		ModelDefaults:     bindings.FromModelSet(f.models.Defaults()),
		ReviewModeDefault: string(f.reviewModes.Default()),
		Tasks: bindings.FromTasks(
			f.taskSvc.List(), f.taskArtifacts, f.flow.Steps, f.flow.PullRequest, f.flow.Worktree, f.sessions.Conversations,
			f.repositories.Get, f.sessions.Summaries(), nil,
		),
		History: bindings.FromArchived(
			f.taskSvc.ListArchived(), f.taskArtifacts, f.taskSvc.PRRun, f.repositories.Get,
		),
		Boards: bindings.FromBoards(
			f.boards.List(), f.boards.Stored, f.boards.Reading,
			f.repositories.List(), f.repositories.Missing, f.taskSvc.CardTasks(),
		),
		ReviewCenter: bindings.FromReviewCenter(
			f.pullRequests.Readings(), f.pullRequests.Reading(), f.pullRequests.ReadAt(),
			f.pullRequests.Viewer(), f.pullRequests.Filters(), repositories, nil,
			f.prReviews.ActiveOf, f.boards.CardOfPullRequest,
		),
		Reviews: bindings.FromReviews(f.reviewStates(), nil, repositories),
		ReviewHistory: bindings.FromArchivedReviews(
			f.prReviews.ListArchived(), f.prReviews.Passes, repositories,
		),
		Discussions: bindings.FromDiscussions(
			f.discussionStates(), nil, f.boards.Get, f.boards.Stored, repositories, f.repositories.Missing,
		),
		DiscussionHistory: bindings.FromArchivedDiscussions(
			f.discussions.ListArchived(), f.discussions.Drafts, repositories,
		),
		CloneFolder: f.repositories.CloneFolder(),
	}
}

// reviewStates is what the app knows about every active review, the way
// internal/app reads it for the snapshot.
func (f *fixture) reviewStates() []reviewflow.State {
	list := f.prReviews.List()
	states := make([]reviewflow.State, 0, len(list))
	for _, stored := range list {
		if state, ok := f.reviewFlow.State(stored.ID); ok {
			states = append(states, state)
		}
	}
	return states
}

// discussionStates is what the app knows about every active discussion, the
// way internal/app reads it for the snapshot.
func (f *fixture) discussionStates() []discussionflow.State {
	list := f.discussions.List()
	states := make([]discussionflow.State, 0, len(list))
	for _, stored := range list {
		if state, ok := f.discussionFlow.State(stored.ID); ok {
			states = append(states, state)
		}
	}
	return states
}

// discussionOf returns the discussion with the given id from the current
// state, failing the test when the state does not hold it.
func (f *fixture) discussionOf(t *testing.T, id string) bindings.DiscussionSummary {
	t.Helper()

	for _, summary := range f.state.GetState().Discussions {
		if summary.ID == id {
			return summary
		}
	}
	t.Fatalf("discussion %s is not in the state", id)
	return bindings.DiscussionSummary{}
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

// seedReview registers a review of dev/web#7 with the report of its first pass
// recorded, without the conversation and the worktree a real one goes through:
// what drives a review belongs to internal/reviewflow.
func (f *fixture) seedReview(t *testing.T, repositoryID string) prreview.Review {
	t.Helper()

	created, err := f.prReviews.Create(t.Context(), prreview.CreateParams{
		RepositoryID: repositoryID,
		Number:       7,
		Title:        "Add the login screen",
		Author:       "alice",
		URL:          "https://github.com/dev/web/pull/7",
		HeadBranch:   "login",
		BaseBranch:   "main",
		HeadCommit:   "abc123",
		Mode:         prreview.ModePublish,
	})
	if err != nil {
		t.Fatalf("prreview.Create() = %v, want nil", err)
	}
	if _, err = f.prReviews.AskPass(t.Context(), created.ID, 1, "Look at the error handling."); err != nil {
		t.Fatalf("AskPass() = %v, want nil", err)
	}
	report := prreview.Report{
		Pass:    1,
		Summary: "Two things to look at.",
		Findings: []prreview.ParsedFinding{
			{Number: 1, Path: "main.go", Line: 12, Text: "Handle the error."},
			{Number: 2, Text: "The pull request has no tests."},
		},
	}
	if _, _, err = f.prReviews.RecordReport(t.Context(), created.ID, report, "abc123"); err != nil {
		t.Fatalf("RecordReport() = %v, want nil", err)
	}
	// The report on disk is what the agent wrote and the panel reads back.
	if err = os.WriteFile(created.ReportPath(1), []byte("# Review 1\n"), 0o600); err != nil {
		t.Fatalf("WriteFile(%s) = %v, want nil", created.ReportPath(1), err)
	}
	return created
}

// seedDiscussion records a discussion of the board of the fixture with the
// drafts the agent would have written, without the conversation a real one
// goes through: what drives a discussion belongs to internal/discussionflow.
func (f *fixture) seedDiscussion(t *testing.T, drafts ...discussion.ParsedDraft) discussion.Discussion {
	t.Helper()

	created, err := f.discussions.Create(t.Context(), discussion.CreateParams{
		BoardID:        testBoardID,
		BoardTitle:     "Roadmap",
		BoardOwner:     "acme",
		BoardNumber:    3,
		Title:          "Invoices",
		Text:           "The invoices of the month.",
		InitialContext: "# Invoices\n",
	})
	if err != nil {
		t.Fatalf("discussion.Create() = %v, want nil", err)
	}
	if len(drafts) > 0 {
		artifact := discussion.Artifact{Drafts: drafts}
		if _, err = f.discussions.RecordDrafts(t.Context(), created.ID, artifact); err != nil {
			t.Fatalf("RecordDrafts() = %v, want nil", err)
		}
	}
	return created
}

// webDraft is a new card of dev/web as the agent wrote it.
func webDraft(id, title string) discussion.ParsedDraft {
	return discussion.ParsedDraft{
		ID:         id,
		Kind:       discussion.KindNew,
		Repository: "dev/web",
		Title:      title,
		Body:       "What the card asks for.",
	}
}

// discussionDocument is the understanding a seeded discussion reached, which
// a card it published carries into the task created from it.
const discussionDocument = "# Invoices\n\nThe invoices of the month.\n"

// seedPublication records that a draft of a discussion created an issue of
// dev/web, with the document the discussion reached on disk, which is what a
// task created from that card starts with.
func (f *fixture) seedPublication(t *testing.T, d discussion.Discussion, draftID string, number int) {
	t.Helper()

	err := f.discussions.RecordPublication(t.Context(), d.ID, draftID, func(draft *discussion.Draft) {
		draft.Published = discussion.Publication{
			Outcome: discussion.OutcomeCreated,
			Number:  number,
			URL:     "https://github.com/dev/web/issues/" + strconv.Itoa(number),
			At:      time.Now().UTC(),
		}
	})
	if err != nil {
		t.Fatalf("RecordPublication() = %v, want nil", err)
	}
	if err = os.WriteFile(d.DocumentPath(), []byte(discussionDocument), 0o600); err != nil {
		t.Fatalf("WriteFile(%s) = %v, want nil", d.DocumentPath(), err)
	}
}

// draftOf returns the draft with the given id of a discussion of the state,
// failing the test when it is not there.
func (f *fixture) draftOf(t *testing.T, id, draftID string) bindings.Draft {
	t.Helper()

	for _, draft := range f.discussionOf(t, id).Drafts {
		if draft.ID == draftID {
			return draft
		}
	}
	t.Fatalf("draft %s of discussion %s is not in the state", draftID, id)
	return bindings.Draft{}
}

// seedWorktree registers a worktree for an item, the way a start would leave
// it, so that what opens the editor has a folder to open.
func (f *fixture) seedWorktree(t *testing.T, itemID, path string) {
	t.Helper()

	wt := worktree.Worktree{TaskID: itemID, RepoPath: f.dataDir, Path: path, CreatedAt: time.Now().UTC()}
	if err := f.store.Worktrees.Insert(t.Context(), wt); err != nil {
		t.Fatalf("Insert(worktree) = %v, want nil", err)
	}
	if err := f.worktrees.Sync(t.Context(), []string{itemID}); err != nil {
		t.Fatalf("worktrees.Sync() = %v, want nil", err)
	}
}

// reviewOf returns the review with the given id from the current state,
// failing the test when the state does not hold it.
func (f *fixture) reviewOf(t *testing.T, id string) bindings.ReviewSummary {
	t.Helper()

	for _, summary := range f.state.GetState().Reviews {
		if summary.ID == id {
			return summary
		}
	}
	t.Fatalf("review %s is not in the state", id)
	return bindings.ReviewSummary{}
}

// waitReviewCenter waits until a reading of the pull requests has landed,
// failing the test when none does in time.
func (f *fixture) waitReviewCenter(t *testing.T) bindings.ReviewCenter {
	t.Helper()

	deadline := time.Now().Add(pollTimeout)
	for time.Now().Before(deadline) {
		center := f.state.GetState().ReviewCenter
		if center.ReadAt != "" {
			return center
		}
		time.Sleep(pollStep)
	}
	t.Fatal("the pull requests were never read")
	return bindings.ReviewCenter{}
}

// testBoardID is the id of the board registerBoard registers.
const testBoardID = "board-1"

// registerBoard registers the board acme/3, Roadmap, managing the repository of
// the fixture when managed is set, with a reading of cards, and loads it.
func (f *fixture) registerBoard(t *testing.T, managed bool, cards ...board.Card) {
	t.Helper()

	var links []board.Link
	if managed {
		links = []board.Link{{RepositoryID: testRepoID}}
	}
	b := board.Board{
		ID: testBoardID, Owner: "acme", OwnerType: board.OwnerOrganization, Number: 3,
		Title: "Roadmap", URL: "https://github.com/orgs/acme/projects/3", FinalStatuses: []string{},
	}
	if err := f.store.Boards.InsertBoard(t.Context(), b, links); err != nil {
		t.Fatalf("InsertBoard() = %v, want nil", err)
	}
	reading := board.Reading{Title: "Roadmap", Viewer: "dev", Cards: cards}
	if err := f.store.Boards.SaveReading(t.Context(), testBoardID, "Roadmap", reading, time.Now()); err != nil {
		t.Fatalf("SaveReading() = %v, want nil", err)
	}
	f.load(t)
}

// webCard is the open card dev/web#number, with an epic.
func webCard(number int) board.Card {
	return board.Card{
		Issue: board.Issue{
			Owner: "dev", Name: "web", Number: number, Title: "Add the login screen",
			URL: "https://github.com/dev/web/issues/12", State: task.IssueOpen,
		},
		Body:   "Email and password.",
		Status: "Todo",
		Epic: &board.Epic{Issue: board.Issue{
			Owner: "dev", Name: "web", Number: 1, Title: "Auth", URL: "https://github.com/dev/web/issues/1",
			State: task.IssueOpen,
		}},
		ReadAt: time.Date(2026, time.September, 16, 12, 0, 0, 0, time.UTC),
	}
}
