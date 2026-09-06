package task

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// dirPerm keeps the artifact folders private to the user.
const dirPerm = 0o700

// settleTimeout bounds the database work the watcher triggers on its own,
// which has no caller to carry a context.
const settleTimeout = 5 * time.Second

// Repository persists the tasks of every workspace.
type Repository interface {
	ListByWorkspace(ctx context.Context, workspacePath string) ([]Task, error)
	Get(ctx context.Context, id string) (Task, error)
	Insert(ctx context.Context, t Task) error
	UpdateStage(ctx context.Context, id, stage string, artifactVersion int, updatedAt time.Time) error
	Delete(ctx context.Context, id string) error
}

// Deps are what Service needs from the outside.
type Deps struct {
	Repo       Repository
	DataDir    string
	Log        *slog.Logger
	Now        func() time.Time         // defaults to time.Now
	NewID      func() string            // defaults to uuid.NewString
	Repos      func() []string          // repository paths of the open workspace
	OnChange   func()                   // after any change to the list or a task; may be nil
	OnArtifact func(t Task, first bool) // PRD appeared (first) or was rewritten; may be nil
}

// Service owns the tasks of the open workspace and keeps their stage in step
// with the artifacts on disk.
type Service struct {
	repo       Repository
	dataDir    string
	log        *slog.Logger
	now        func() time.Time
	newID      func() string
	repos      func() []string
	onChange   func()
	onArtifact func(t Task, first bool)

	watcher *watcher

	mu            sync.Mutex
	workspacePath string
	tasks         []Task
}

// New builds a Service from deps, with the artifact watcher running.
func New(deps Deps) (*Service, error) {
	s := &Service{
		repo:       deps.Repo,
		dataDir:    deps.DataDir,
		log:        deps.Log,
		now:        deps.Now,
		newID:      deps.NewID,
		repos:      deps.Repos,
		onChange:   deps.OnChange,
		onArtifact: deps.OnArtifact,
	}
	if s.now == nil {
		s.now = time.Now
	}
	if s.newID == nil {
		s.newID = uuid.NewString
	}
	if s.repos == nil {
		s.repos = func() []string { return nil }
	}

	w, err := newWatcher(deps.Log, s.artifactSettled)
	if err != nil {
		return nil, err
	}
	s.watcher = w
	return s, nil
}

// Sync loads the tasks of workspacePath, reconciles each stage with the disk
// and watches their artifact folders. Calling it again with the same path is
// a no-op. It does not call OnChange.
func (s *Service) Sync(ctx context.Context, workspacePath string) error {
	s.mu.Lock()
	same := s.workspacePath == workspacePath
	s.mu.Unlock()
	if same {
		return nil
	}

	tasks, err := s.repo.ListByWorkspace(ctx, workspacePath)
	if err != nil {
		return fmt.Errorf("list tasks of %s: %w", workspacePath, err)
	}

	// The PRD may have been written, or thrown away, while the app was closed.
	for i, t := range tasks {
		stage := StagePRD
		if s.prdWritten(t) {
			stage = StagePRDDone
		}
		if stage == t.Stage {
			continue
		}
		t.Stage = stage
		t.UpdatedAt = s.now().UTC()
		if err := s.repo.UpdateStage(ctx, t.ID, string(t.Stage), t.ArtifactVersion, t.UpdatedAt); err != nil {
			return fmt.Errorf("reconcile stage of task %s: %w", t.ID, err)
		}
		tasks[i] = t
	}

	s.mu.Lock()
	previous := s.tasks
	s.workspacePath = workspacePath
	s.tasks = tasks
	s.mu.Unlock()

	for _, t := range previous {
		s.watcher.unwatch(t.ID, t.ArtifactsDir)
	}
	for _, t := range tasks {
		s.watch(t)
	}
	return nil
}

// List returns copies of the loaded tasks in creation order.
func (s *Service) List() []Task {
	s.mu.Lock()
	defer s.mu.Unlock()

	return slices.Clone(s.tasks)
}

// Get returns a loaded task by id.
func (s *Service) Get(id string) (Task, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	index := indexOf(s.tasks, id)
	if index < 0 {
		return Task{}, false
	}
	return s.tasks[index], true
}

// CreateParams is the task the user filled in the form. The node it was
// started from decides RepoPath; the form cannot change it.
type CreateParams struct {
	Name           string
	RepoPath       string // "" for root
	InitialContext string
}

// Create validates, creates the artifact folder, persists and watches the task.
func (s *Service) Create(ctx context.Context, p CreateParams) (Task, error) {
	name := strings.TrimSpace(p.Name)
	if err := ValidateName(name); err != nil {
		return Task{}, err
	}
	initialContext := strings.TrimSpace(p.InitialContext)
	if initialContext == "" {
		return Task{}, ErrEmptyContext
	}

	var repoPath string
	if p.RepoPath != "" {
		repoPath = filepath.Clean(p.RepoPath)
		if !slices.Contains(s.repos(), repoPath) {
			return Task{}, fmt.Errorf("create task %s in %s: %w", name, repoPath, ErrRepoOutside)
		}
	}

	s.mu.Lock()
	workspacePath := s.workspacePath
	s.mu.Unlock()
	if workspacePath == "" {
		return Task{}, fmt.Errorf("create task %s: no workspace is open", name)
	}

	now := s.now().UTC()
	t := Task{
		ID:             s.newID(),
		WorkspacePath:  workspacePath,
		Name:           name,
		RepoPath:       repoPath,
		InitialContext: initialContext,
		Stage:          StagePRD,
		ArtifactsDir:   ArtifactsDir(s.dataDir, workspacePath, name),
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	// A folder already there belongs to a task with this name, or is what a
	// create interrupted halfway left behind; either way it is not ours to
	// take back if the insert fails.
	if err := os.MkdirAll(filepath.Dir(t.ArtifactsDir), dirPerm); err != nil {
		return Task{}, fmt.Errorf("create artifacts directory %s: %w", t.ArtifactsDir, err)
	}
	ours := true
	if err := os.Mkdir(t.ArtifactsDir, dirPerm); err != nil {
		if !errors.Is(err, fs.ErrExist) {
			return Task{}, fmt.Errorf("create artifacts directory %s: %w", t.ArtifactsDir, err)
		}
		ours = false
	}

	if err := s.repo.Insert(ctx, t); err != nil {
		if ours {
			if rmErr := os.Remove(t.ArtifactsDir); rmErr != nil {
				s.log.Warn("remove artifacts directory failed", "path", t.ArtifactsDir, "error", rmErr)
			}
		}
		return Task{}, err
	}

	s.mu.Lock()
	s.tasks = append(s.tasks, t)
	s.mu.Unlock()

	s.watch(t)
	s.log.Info("task created", "task", t.ID, "name", t.Name, "repo", t.RepoPath)
	s.changed()
	return t, nil
}

// Delete unwatches, removes the artifact folder and the row. The caller stops
// the session of the task first.
func (s *Service) Delete(ctx context.Context, id string) error {
	t, ok := s.Get(id)
	if !ok {
		return fmt.Errorf("delete task %s: %w", id, ErrNotFound)
	}

	s.watcher.unwatch(t.ID, t.ArtifactsDir)

	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	// The row is gone, so the folder must go too, but a folder the user has
	// open elsewhere is not worth failing the delete over.
	if err := os.RemoveAll(t.ArtifactsDir); err != nil {
		s.log.Warn("remove artifacts directory failed", "path", t.ArtifactsDir, "error", err)
	}

	s.mu.Lock()
	if index := indexOf(s.tasks, id); index >= 0 {
		s.tasks = slices.Delete(s.tasks, index, index+1)
	}
	s.mu.Unlock()

	s.log.Info("task deleted", "task", t.ID, "name", t.Name)
	s.changed()
	return nil
}

// ReadArtifact returns the content of an artifact by file name. Only PRDFile
// is accepted in this version; anything else is ErrNotFound.
func (s *Service) ReadArtifact(id, name string) (string, error) {
	if name != PRDFile {
		return "", fmt.Errorf("read artifact %s of task %s: %w", name, id, ErrNotFound)
	}
	t, ok := s.Get(id)
	if !ok {
		return "", fmt.Errorf("read artifact of task %s: %w", id, ErrNotFound)
	}

	content, err := os.ReadFile(t.PRDPath())
	switch {
	case errors.Is(err, os.ErrNotExist):
		return "", fmt.Errorf("read artifact %s: %w", t.PRDPath(), ErrNotFound)
	case err != nil:
		return "", fmt.Errorf("read artifact %s: %w", t.PRDPath(), err)
	}
	return string(content), nil
}

// Close stops the watcher.
func (s *Service) Close() error {
	return s.watcher.close()
}

// artifactSettled reconciles a task with its artifact folder after the watcher
// saw the folder go quiet.
func (s *Service) artifactSettled(id string) {
	t, ok := s.Get(id)
	if !ok {
		return
	}

	next, first, changed := s.reconcile(t)
	if !changed {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), settleTimeout)
	defer cancel()

	if err := s.repo.UpdateStage(ctx, next.ID, string(next.Stage), next.ArtifactVersion, next.UpdatedAt); err != nil {
		s.log.Error("update task stage failed", "task", next.ID, "error", err)
		return
	}

	s.mu.Lock()
	if index := indexOf(s.tasks, id); index >= 0 {
		s.tasks[index] = next
	}
	s.mu.Unlock()

	s.log.Info("artifact changed",
		"task", next.ID,
		"stage", string(next.Stage),
		"artifact_version", next.ArtifactVersion,
	)
	if next.Stage == StagePRDDone && s.onArtifact != nil {
		s.onArtifact(next, first)
	}
	s.changed()
}

// reconcile returns the task its artifact folder implies: first says the PRD
// had not been seen before, changed says anything moved at all.
func (s *Service) reconcile(t Task) (next Task, first, changed bool) {
	if s.prdWritten(t) {
		t.ArtifactVersion++
		first = t.Stage != StagePRDDone
		t.Stage = StagePRDDone
		t.UpdatedAt = s.now().UTC()
		return t, first, true
	}
	if t.Stage == StagePRDDone {
		t.Stage = StagePRD
		t.UpdatedAt = s.now().UTC()
		return t, false, true
	}
	return t, false, false
}

// prdWritten reports whether the PRD of a task exists with content in it. An
// agent creating the file empty is not a finished stage.
func (s *Service) prdWritten(t Task) bool {
	info, err := os.Stat(t.PRDPath())
	switch {
	case err == nil:
		return info.Size() > 0
	case errors.Is(err, os.ErrNotExist):
		return false
	default:
		s.log.Warn("stat artifact failed", "path", t.PRDPath(), "error", err)
		return false
	}
}

// watch follows the artifact folder of a task. A task the watcher cannot
// follow still works; only the automatic detection of the PRD is lost.
func (s *Service) watch(t Task) {
	if err := s.watcher.watch(t.ID, t.ArtifactsDir); err != nil {
		s.log.Warn("watch artifacts directory failed", "task", t.ID, "error", err)
	}
}

// changed runs the OnChange callback outside the mutex.
func (s *Service) changed() {
	if s.onChange != nil {
		s.onChange()
	}
}

// indexOf finds a task by id, -1 when the list does not hold it.
func indexOf(tasks []Task, id string) int {
	return slices.IndexFunc(tasks, func(t Task) bool { return t.ID == id })
}
