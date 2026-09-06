package bindings_test

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/claude"
	"github.com/guilhermt/myspec/internal/claude/claudetest"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/store"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/theme"
	"github.com/guilhermt/myspec/internal/workspace"
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

// fakeLauncher runs this test binary as the fake CLI playing the echo
// scenario, where every message comes back as the agent's answer.
type fakeLauncher struct{}

func (fakeLauncher) Locate() (string, error) { return os.Args[0], nil }

func (fakeLauncher) Preflight(context.Context, string) error { return nil }

func (fakeLauncher) Start(ctx context.Context, cfg claude.Config) (session.Process, error) {
	cfg.Env = append(os.Environ(),
		claudetest.EnvFlag+"=1",
		claudetest.EnvScenario+"=echo",
	)
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
	dataDir   string
	picker    *fakePicker
	logs      *syncBuffer

	mu      sync.Mutex
	repos   []string
	scanErr error
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

	f := &fixture{store: st, picker: &fakePicker{}, logs: logs}

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
		Sessions:     st.Sessions,
		Entries:      st.Entries,
		Launcher:     fakeLauncher{},
		RenderPrompt: func(vars prompts.Vars) (string, error) { return prompts.Render(f.dataDir, prompts.StagePRD, vars) },
		Log:          log,
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
		OnArtifact: func(t task.Task, first bool) {
			f.sessions.MarkArtifact(context.Background(), t.ID, first)
		},
	})
	if err != nil {
		t.Fatalf("task.New() = %v, want nil", err)
	}
	t.Cleanup(func() { _ = f.taskSvc.Close() })

	f.workspace = bindings.NewWorkspaceService(f.ws, f.snapshot, f.picker, log)
	f.settings = bindings.NewSettingsService(f.theme, log)
	f.tasks = bindings.NewTaskService(f.taskSvc, f.sessions, log)
	return f
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
		Tasks:      bindings.FromTasks(f.taskSvc.List(), f.sessions.Summaries()),
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
