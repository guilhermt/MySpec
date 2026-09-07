package task_test

import (
	"bytes"
	"cmp"
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

	"github.com/guilhermt/myspec/internal/task"
)

// base is the fixed instant the tests build their timestamps from.
var base = time.Date(2026, time.September, 6, 12, 0, 0, 0, time.UTC)

// pollTimeout and pollStep bound how long a test waits for the watcher, which
// works on its own goroutine and its own timer.
const (
	pollTimeout = 2 * time.Second
	pollStep    = 10 * time.Millisecond
)

// logCapture is a logger writing JSON records into a buffer.
type logCapture struct {
	log *slog.Logger
	buf *syncBuffer
}

func newLogCapture() logCapture {
	buf := &syncBuffer{}
	return logCapture{log: slog.New(slog.NewJSONHandler(buf, nil)), buf: buf}
}

// count returns how many records carry the given message.
func (c logCapture) count(t *testing.T, msg string) int {
	t.Helper()

	total := 0
	for _, line := range strings.Split(strings.TrimSpace(c.buf.String()), "\n") {
		if line == "" {
			continue
		}
		var rec map[string]any
		if err := json.Unmarshal([]byte(line), &rec); err != nil {
			t.Fatalf("parse log line %q: %v", line, err)
		}
		if rec["msg"] == msg {
			total++
		}
	}
	return total
}

// syncBuffer is a buffer the watcher goroutine and the test can share.
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

// memRepo is an in-memory task.Store.
type memRepo struct {
	mu        sync.Mutex
	items     []task.Task
	runs      map[string][]task.StepRun // step runs by task id
	listErr   error
	runsErr   error
	insertErr error
	updateErr error
	deleteErr error
}

func (r *memRepo) ListByWorkspace(_ context.Context, workspacePath string) ([]task.Task, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.listErr != nil {
		return nil, r.listErr
	}

	var out []task.Task
	for _, t := range r.items {
		if t.WorkspacePath == workspacePath {
			out = append(out, t)
		}
	}
	slices.SortStableFunc(out, func(a, b task.Task) int {
		if !a.CreatedAt.Equal(b.CreatedAt) {
			return a.CreatedAt.Compare(b.CreatedAt)
		}
		return strings.Compare(a.Name, b.Name)
	})
	return out, nil
}

func (r *memRepo) Get(_ context.Context, id string) (task.Task, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if index := r.indexOf(id); index >= 0 {
		return r.items[index], nil
	}
	return task.Task{}, task.ErrNotFound
}

func (r *memRepo) Insert(_ context.Context, t task.Task) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.insertErr != nil {
		return r.insertErr
	}
	for _, item := range r.items {
		if item.WorkspacePath == t.WorkspacePath && item.Name == t.Name {
			return task.ErrNameTaken
		}
	}
	r.items = append(r.items, t)
	return nil
}

func (r *memRepo) UpdateStage(_ context.Context, id, stage string, revisiting bool, updatedAt time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.updateErr != nil {
		return r.updateErr
	}
	index := r.indexOf(id)
	if index < 0 {
		return task.ErrNotFound
	}
	r.items[index].Stage = task.Stage(stage)
	r.items[index].Revisiting = revisiting
	r.items[index].UpdatedAt = updatedAt
	return nil
}

func (r *memRepo) UpdateArtifactVersion(_ context.Context, id string, version int, updatedAt time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.updateErr != nil {
		return r.updateErr
	}
	index := r.indexOf(id)
	if index < 0 {
		return task.ErrNotFound
	}
	r.items[index].ArtifactVersion = version
	r.items[index].UpdatedAt = updatedAt
	return nil
}

func (r *memRepo) Delete(_ context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.deleteErr != nil {
		return r.deleteErr
	}
	if index := r.indexOf(id); index >= 0 {
		r.items = slices.Delete(r.items, index, index+1)
	}
	return nil
}

func (r *memRepo) ListStepRuns(_ context.Context, taskID string) ([]task.StepRun, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.runsErr != nil {
		return nil, r.runsErr
	}
	return slices.Clone(r.runs[taskID]), nil
}

func (r *memRepo) UpsertStepRun(_ context.Context, run task.StepRun) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.updateErr != nil {
		return r.updateErr
	}
	if r.runs == nil {
		r.runs = map[string][]task.StepRun{}
	}
	runs := r.runs[run.TaskID]
	index := slices.IndexFunc(runs, func(stored task.StepRun) bool { return stored.Number == run.Number })
	if index >= 0 {
		runs[index] = run
	} else {
		runs = append(runs, run)
		slices.SortFunc(runs, func(a, b task.StepRun) int { return cmp.Compare(a.Number, b.Number) })
	}
	r.runs[run.TaskID] = runs
	return nil
}

func (r *memRepo) DeleteStepRuns(_ context.Context, taskID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.deleteErr != nil {
		return r.deleteErr
	}
	delete(r.runs, taskID)
	return nil
}

// seedRun stores a step run directly, bypassing the service.
func (r *memRepo) seedRun(run task.StepRun) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.runs == nil {
		r.runs = map[string][]task.StepRun{}
	}
	r.runs[run.TaskID] = append(r.runs[run.TaskID], run)
}

// stepRuns returns the stored runs of a task, by number.
func (r *memRepo) stepRuns(taskID string) []task.StepRun {
	r.mu.Lock()
	defer r.mu.Unlock()

	return slices.Clone(r.runs[taskID])
}

// get returns a stored task by id, failing the test when it is gone.
func (r *memRepo) get(t *testing.T, id string) task.Task {
	t.Helper()

	stored, err := r.Get(t.Context(), id)
	if err != nil {
		t.Fatalf("Get(%s) = %v, want nil", id, err)
	}
	return stored
}

// seed stores a task directly, bypassing the service.
func (r *memRepo) seed(t task.Task) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.items = append(r.items, t)
}

// indexOf finds a stored task. The caller holds the mutex.
func (r *memRepo) indexOf(id string) int {
	return slices.IndexFunc(r.items, func(t task.Task) bool { return t.ID == id })
}

// artifactCall is one OnArtifact callback the fixture recorded.
type artifactCall struct {
	Task    task.Task
	Changes []task.Change
}

// change returns the recorded change of a kind, if the call carried one.
func (c artifactCall) change(kind task.ArtifactKind) (task.Change, bool) {
	for _, ch := range c.Changes {
		if ch.Kind == kind {
			return ch, true
		}
	}
	return task.Change{}, false
}

// fixture is a Service with its collaborators, ready to assert on.
type fixture struct {
	service   *task.Service
	repo      *memRepo
	logs      logCapture
	dataDir   string
	workspace string
	repos     []string

	mu        sync.Mutex
	changes   int
	artifacts []artifactCall
}

// newFixture builds a synced Service over a temporary data directory, with a
// workspace holding one repository.
func newFixture(t *testing.T) *fixture {
	t.Helper()

	dataDir := t.TempDir()
	workspace := t.TempDir()
	f := &fixture{
		repo:      &memRepo{},
		logs:      newLogCapture(),
		dataDir:   dataDir,
		workspace: workspace,
		repos:     []string{filepath.Join(workspace, "api")},
	}

	ids := 0
	service, err := task.New(task.Deps{
		Repo:    f.repo,
		DataDir: dataDir,
		Log:     f.logs.log,
		Now:     func() time.Time { return base },
		NewID: func() string {
			ids++
			return "task-" + strconv.Itoa(ids)
		},
		Repos:      func() []string { return f.repos },
		OnChange:   f.onChange,
		OnArtifact: f.onArtifact,
	})
	if err != nil {
		t.Fatalf("New() = %v, want nil", err)
	}
	t.Cleanup(func() {
		if err := service.Close(); err != nil {
			t.Errorf("Close() = %v, want nil", err)
		}
	})

	f.service = service
	f.sync(t)
	return f
}

// sync loads the workspace of the fixture into the service.
func (f *fixture) sync(t *testing.T) {
	t.Helper()

	if err := f.service.Sync(t.Context(), f.workspace); err != nil {
		t.Fatalf("Sync() = %v, want nil", err)
	}
}

func (f *fixture) onChange() {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.changes++
}

func (f *fixture) onArtifact(t task.Task, changes []task.Change) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.artifacts = append(f.artifacts, artifactCall{Task: t, Changes: changes})
}

// changeCount returns how many times OnChange ran.
func (f *fixture) changeCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()

	return f.changes
}

// artifactCalls returns the OnArtifact callbacks so far, in order.
func (f *fixture) artifactCalls() []artifactCall {
	f.mu.Lock()
	defer f.mu.Unlock()

	return slices.Clone(f.artifacts)
}

// create adds a task through the service, failing the test on error.
func (f *fixture) create(t *testing.T, name, repoPath string) task.Task {
	t.Helper()

	created, err := f.service.Create(t.Context(), task.CreateParams{
		Name:           name,
		RepoPath:       repoPath,
		InitialContext: "a login screen",
	})
	if err != nil {
		t.Fatalf("Create(%s) = %v, want nil", name, err)
	}
	return created
}

// writePRD writes the PRD of a task, as the agent would.
func writePRD(t *testing.T, tk task.Task, content string) {
	t.Helper()

	writeFile(t, tk.PRDPath(), content)
}

// writeTechSpec writes the tech spec of a task, as the agent would.
func writeTechSpec(t *testing.T, tk task.Task, content string) {
	t.Helper()

	writeFile(t, tk.TechSpecPath(), content)
}

// writeStep writes one step file of the plan of a task, with the front matter
// the parser asks for.
func writeStep(t *testing.T, tk task.Task, file, repository, title string) {
	t.Helper()

	if err := os.MkdirAll(tk.StepsDir(), 0o700); err != nil {
		t.Fatalf("create steps directory: %v", err)
	}
	writeFile(t, filepath.Join(tk.StepsDir(), file), "---\nrepository: "+repository+"\n---\n\n# "+title+"\n")
}

// writeFile puts content at path, failing the test on error.
func writeFile(t *testing.T, path, content string) {
	t.Helper()

	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

// waitFor polls until cond holds, failing the test with subject when it never
// does. The watcher debounces on its own timer, so tests wait instead of sleep.
func waitFor(t *testing.T, subject string, cond func() bool) {
	t.Helper()

	deadline := time.Now().Add(pollTimeout)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(pollStep)
	}
	t.Fatalf("timed out waiting for %s", subject)
}

// wantErrIs fails the test unless err matches want.
func wantErrIs(t *testing.T, err, want error) {
	t.Helper()

	if !errors.Is(err, want) {
		t.Fatalf("error = %v, want %v", err, want)
	}
}

// exists reports whether a path is on disk.
func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
