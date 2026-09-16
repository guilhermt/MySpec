package task

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"maps"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/reviewmode"
)

// dirPerm keeps the artifact folders private to the user.
const dirPerm = 0o700

// settleTimeout bounds the database work the watcher triggers on its own,
// which has no caller to carry a context.
const settleTimeout = 5 * time.Second

// Store persists the tasks.
type Store interface {
	ListActive(ctx context.Context) ([]Task, error)
	ListArchived(ctx context.Context) ([]Task, error)
	Get(ctx context.Context, id string) (Task, error)
	Insert(ctx context.Context, t Task) error
	UpdateStage(ctx context.Context, id, stage string, revisiting bool, updatedAt time.Time) error
	UpdateArtifactVersion(ctx context.Context, id string, version int, updatedAt time.Time) error
	UpdateArchived(ctx context.Context, id string, archivedAt, updatedAt time.Time) error
	UpdateModels(ctx context.Context, id string, m Models, updatedAt time.Time) error
	UpdateReviewModes(ctx context.Context, id string, m ReviewModes, updatedAt time.Time) error
	Delete(ctx context.Context, id string) error
	ListStepRuns(ctx context.Context, taskID string) ([]StepRun, error)
	UpsertStepRun(ctx context.Context, run StepRun) error
	DeleteStepRuns(ctx context.Context, taskID string) error
	GetPRRun(ctx context.Context, taskID string) (PRRun, bool, error)
	UpsertPRRun(ctx context.Context, run PRRun) error
	DeletePRRun(ctx context.Context, taskID string) error
}

// Deps are what Service needs from the outside.
type Deps struct {
	Repo    Store
	DataDir string
	Log     *slog.Logger
	Now     func() time.Time // defaults to time.Now
	NewID   func() string    // defaults to uuid.NewString
	// Repositories is the registered repository of an id. Without it, no
	// repository exists.
	Repositories func(id string) (repository.Repository, bool)
	OnChange     func()                         // after any change to the list or a task; may be nil
	OnArtifact   func(t Task, changes []Change) // the artifact folder went quiet; may be nil
}

// Service owns the tasks, active and archived, and what their artifact folders
// hold.
type Service struct {
	repo         Store
	dataDir      string
	log          *slog.Logger
	now          func() time.Time
	newID        func() string
	repositories func(id string) (repository.Repository, bool)
	onChange     func()
	onArtifact   func(t Task, changes []Change)

	watcher *watcher

	mu        sync.Mutex
	tasks     []Task
	archived  []Task               // by archived_at, newest first
	artifacts map[string]Artifacts // by task id, archived included, what the last inspection saw
	stepRuns  map[string][]StepRun // by task id, archived included, ordered by number
	prRuns    map[string]PRRun     // by task id, archived included; absent before the PR stage
}

// New builds a Service from deps, with the artifact watcher running.
func New(deps Deps) (*Service, error) {
	s := &Service{
		repo:         deps.Repo,
		dataDir:      deps.DataDir,
		log:          deps.Log,
		now:          deps.Now,
		newID:        deps.NewID,
		repositories: deps.Repositories,
		onChange:     deps.OnChange,
		onArtifact:   deps.OnArtifact,
		artifacts:    map[string]Artifacts{},
		stepRuns:     map[string][]StepRun{},
		prRuns:       map[string]PRRun{},
	}
	if s.now == nil {
		s.now = time.Now
	}
	if s.newID == nil {
		s.newID = uuid.NewString
	}
	if s.repositories == nil {
		s.repositories = func(string) (repository.Repository, bool) { return repository.Repository{}, false }
	}

	w, err := newWatcher(deps.Log, s.artifactSettled)
	if err != nil {
		return nil, err
	}
	s.watcher = w
	return s, nil
}

// Sync loads every task, archived ones included, reads their artifact folders
// and watches the active ones. It does not call OnChange.
func (s *Service) Sync(ctx context.Context) error {
	tasks, err := s.repo.ListActive(ctx)
	if err != nil {
		return fmt.Errorf("list tasks: %w", err)
	}
	archived, err := s.repo.ListArchived(ctx)
	if err != nil {
		return fmt.Errorf("list archived tasks: %w", err)
	}

	// The history reads the same artifacts and records as the active tasks do,
	// so both lists fill the maps; only the active ones are watched.
	loaded := slices.Concat(tasks, archived)
	artifacts := make(map[string]Artifacts, len(loaded))
	stepRuns := make(map[string][]StepRun, len(loaded))
	prRuns := make(map[string]PRRun, len(loaded))
	for _, t := range loaded {
		artifacts[t.ID] = s.inspect(t)
		runs, err := s.repo.ListStepRuns(ctx, t.ID)
		if err != nil {
			return fmt.Errorf("list step runs of task %s: %w", t.ID, err)
		}
		stepRuns[t.ID] = runs

		run, ok, err := s.repo.GetPRRun(ctx, t.ID)
		if err != nil {
			return fmt.Errorf("get pr run of task %s: %w", t.ID, err)
		}
		if ok {
			prRuns[t.ID] = run
		}
	}

	s.mu.Lock()
	previous := s.tasks
	s.tasks = tasks
	s.archived = archived
	s.artifacts = artifacts
	s.stepRuns = stepRuns
	s.prRuns = prRuns
	s.mu.Unlock()

	for _, t := range previous {
		s.watcher.unwatch(t.ID, t.ArtifactsDir)
	}
	for _, t := range tasks {
		s.watch(t)
	}
	return nil
}

// List returns copies of the loaded tasks in creation order. The archived ones
// are not among them.
func (s *Service) List() []Task {
	s.mu.Lock()
	defer s.mu.Unlock()

	return slices.Clone(s.tasks)
}

// ListArchived returns copies of the archived tasks, the most recently
// archived first.
func (s *Service) ListArchived() []Task {
	s.mu.Lock()
	defer s.mu.Unlock()

	return slices.Clone(s.archived)
}

// Get returns an active task by id. An archived task is not one of them;
// Lookup finds both.
func (s *Service) Get(id string) (Task, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	index := indexOf(s.tasks, id)
	if index < 0 {
		return Task{}, false
	}
	return s.tasks[index], true
}

// Lookup returns a loaded task by id, whether it is active or in the history.
func (s *Service) Lookup(id string) (Task, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if index := indexOf(s.tasks, id); index >= 0 {
		return s.tasks[index], true
	}
	if index := indexOf(s.archived, id); index >= 0 {
		return s.archived[index], true
	}
	return Task{}, false
}

// CreateParams is the task the user filled in the form.
type CreateParams struct {
	Name           string
	RepositoryID   string
	InitialContext string
	Models         models.Set      // a choice for every stage: the defaults with what the user adjusted
	ReviewMode     reviewmode.Mode // the mode of the task: the default, or what the user picked
	Mode           Mode            // the mode of the task; "" is Structured
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

	mode := cmp.Or(p.Mode, ModeStructured)
	if _, err := ParseMode(string(mode)); err != nil {
		return Task{}, err
	}

	repo, ok := s.repositories(p.RepositoryID)
	if !ok {
		return Task{}, fmt.Errorf("create task %s: %w", name, ErrUnknownRepository)
	}

	now := s.now().UTC()
	t := Task{
		ID:             s.newID(),
		RepositoryID:   repo.ID,
		Name:           name,
		Mode:           mode,
		InitialContext: initialContext,
		Stage:          mode.Stages()[0],
		ArtifactsDir:   ArtifactsDir(s.dataDir, repo.Owner, repo.Name, name),
		Models:         Models{Stages: maps.Clone(p.Models)},
		ReviewModes:    ReviewModes{Task: cmp.Or(p.ReviewMode, reviewmode.Manual)},
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
	s.artifacts[t.ID] = Artifacts{StepReports: map[int][]ReviewReport{}}
	s.stepRuns[t.ID] = nil
	s.mu.Unlock()

	s.watch(t)
	s.log.Info("task created", "task", t.ID, "name", t.Name, "repository", repo.FullName(), "mode", string(t.Mode))
	s.changed()
	return t, nil
}

// Archive takes a task out of the active list and into the history. Only an
// active task is archived, and there is no way back.
func (s *Service) Archive(ctx context.Context, id string) (Task, error) {
	t, ok := s.Get(id)
	if !ok {
		return Task{}, fmt.Errorf("archive task %s: %w", id, ErrNotFound)
	}

	t.ArchivedAt = s.now().UTC()
	t.UpdatedAt = t.ArchivedAt
	if err := s.repo.UpdateArchived(ctx, t.ID, t.ArchivedAt, t.UpdatedAt); err != nil {
		return Task{}, err
	}
	// The artifacts of an archived task are read, never written, so nothing is
	// left to follow.
	s.watcher.unwatch(t.ID, t.ArtifactsDir)

	s.mu.Lock()
	if index := indexOf(s.tasks, id); index >= 0 {
		s.tasks = slices.Delete(s.tasks, index, index+1)
	}
	s.archived = slices.Insert(s.archived, 0, t)
	s.mu.Unlock()

	s.log.Info("task archived", "task", t.ID, "name", t.Name)
	s.changed()
	return t, nil
}

// Delete unwatches, removes the artifact folder and the row, of an active task
// or of one in the history. The caller stops the session of the task first.
func (s *Service) Delete(ctx context.Context, id string) error {
	t, ok := s.Lookup(id)
	if !ok {
		return fmt.Errorf("delete task %s: %w", id, ErrNotFound)
	}

	if !t.Archived() {
		s.watcher.unwatch(t.ID, t.ArtifactsDir)
	}

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
	if index := indexOf(s.archived, id); index >= 0 {
		s.archived = slices.Delete(s.archived, index, index+1)
	}
	delete(s.artifacts, id)
	delete(s.stepRuns, id)
	delete(s.prRuns, id)
	s.mu.Unlock()

	s.log.Info("task deleted", "task", t.ID, "name", t.Name)
	s.changed()
	return nil
}

// Artifacts is what the last inspection of a task's folder found.
func (s *Service) Artifacts(id string) (Artifacts, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	a, ok := s.artifacts[id]
	return a, ok
}

// Inspect reads the artifact folder of a task now and refreshes the cache with
// what it found. It is the fresh reading a decision is made on, so it moves
// neither the artifact version nor the callbacks.
func (s *Service) Inspect(id string) (Artifacts, error) {
	t, ok := s.Get(id)
	if !ok {
		return Artifacts{}, fmt.Errorf("inspect task %s: %w", id, ErrNotFound)
	}

	a := s.inspect(t)

	s.mu.Lock()
	s.artifacts[id] = a
	s.mu.Unlock()
	return a, nil
}

// SetStage records the stage of a task and whether it is being revisited.
func (s *Service) SetStage(ctx context.Context, id string, stage Stage, revisiting bool) (Task, error) {
	if _, err := ParseStage(string(stage)); err != nil {
		return Task{}, fmt.Errorf("set stage of task %s: %w", id, err)
	}
	t, ok := s.Get(id)
	if !ok {
		return Task{}, fmt.Errorf("set stage of task %s: %w", id, ErrNotFound)
	}

	t.Stage = stage
	t.Revisiting = revisiting
	t.UpdatedAt = s.now().UTC()
	if err := s.repo.UpdateStage(ctx, t.ID, string(t.Stage), t.Revisiting, t.UpdatedAt); err != nil {
		return Task{}, err
	}

	s.mu.Lock()
	if index := indexOf(s.tasks, id); index >= 0 {
		s.tasks[index] = t
	}
	s.mu.Unlock()

	s.log.Info("task stage set", "task", t.ID, "stage", string(t.Stage), "revisiting", t.Revisiting)
	s.changed()
	return t, nil
}

// SetStageModel records the model and effort a stage of a task runs its
// sessions with from now on.
func (s *Service) SetStageModel(ctx context.Context, id string, stage models.Stage, c models.Choice) (Task, error) {
	t, err := s.updateModels(ctx, id, func(m *Models) {
		if m.Stages == nil {
			m.Stages = models.Set{}
		}
		m.Stages[stage] = c
	})
	if err != nil {
		return Task{}, err
	}

	s.log.Info("task model set", "task", id, "stage", string(stage), "model", string(c.Model), "effort", string(c.Effort))
	return t, nil
}

// SetStepModel records the model and effort a step runs with, which makes the
// choice its own.
func (s *Service) SetStepModel(ctx context.Context, id string, number int, c models.Choice) (Task, error) {
	t, err := s.updateModels(ctx, id, func(m *Models) {
		if m.Steps == nil {
			m.Steps = map[int]models.Choice{}
		}
		m.Steps[number] = c
	})
	if err != nil {
		return Task{}, err
	}

	s.log.Info("task step model set", "task", id, "step", number, "model", string(c.Model), "effort", string(c.Effort))
	return t, nil
}

// updateModels rewrites the models of a task on a copy of them, persists it
// and tells the app.
func (s *Service) updateModels(ctx context.Context, id string, mutate func(*Models)) (Task, error) {
	t, ok := s.Get(id)
	if !ok {
		return Task{}, fmt.Errorf("set models of task %s: %w", id, ErrNotFound)
	}

	m := t.Models.clone()
	mutate(&m)
	t.Models = m
	t.UpdatedAt = s.now().UTC()
	if err := s.repo.UpdateModels(ctx, t.ID, t.Models, t.UpdatedAt); err != nil {
		return Task{}, err
	}

	s.mu.Lock()
	if index := indexOf(s.tasks, id); index >= 0 {
		s.tasks[index] = t
	}
	s.mu.Unlock()

	s.changed()
	return t, nil
}

// SetReviewMode records the mode of a task, which the steps without a mode of
// their own take.
func (s *Service) SetReviewMode(ctx context.Context, id string, mode reviewmode.Mode) (Task, error) {
	t, err := s.updateReviewModes(ctx, id, func(m *ReviewModes) {
		m.Task = mode
	})
	if err != nil {
		return Task{}, err
	}

	s.log.Info("task review mode set", "task", id, "mode", string(mode))
	return t, nil
}

// SetStepReviewMode records the mode a step runs with, which makes the mode
// its own.
func (s *Service) SetStepReviewMode(ctx context.Context, id string, number int, mode reviewmode.Mode) (Task, error) {
	t, err := s.updateReviewModes(ctx, id, func(m *ReviewModes) {
		if m.Steps == nil {
			m.Steps = map[int]reviewmode.Mode{}
		}
		m.Steps[number] = mode
	})
	if err != nil {
		return Task{}, err
	}

	s.log.Info("task step review mode set", "task", id, "step", number, "mode", string(mode))
	return t, nil
}

// updateReviewModes rewrites the review modes of a task on a copy of them,
// persists it and tells the app.
func (s *Service) updateReviewModes(ctx context.Context, id string, mutate func(*ReviewModes)) (Task, error) {
	t, ok := s.Get(id)
	if !ok {
		return Task{}, fmt.Errorf("set review modes of task %s: %w", id, ErrNotFound)
	}

	m := t.ReviewModes.clone()
	mutate(&m)
	t.ReviewModes = m
	t.UpdatedAt = s.now().UTC()
	if err := s.repo.UpdateReviewModes(ctx, t.ID, t.ReviewModes, t.UpdatedAt); err != nil {
		return Task{}, err
	}

	s.mu.Lock()
	if index := indexOf(s.tasks, id); index >= 0 {
		s.tasks[index] = t
	}
	s.mu.Unlock()

	s.changed()
	return t, nil
}

// StepRuns is what the app recorded about the steps of a task, by number.
func (s *Service) StepRuns(id string) []StepRun {
	s.mu.Lock()
	defer s.mu.Unlock()

	return cloneStepRuns(s.stepRuns[id])
}

// updateStepRun rewrites the run of a step from what the cache holds, so that
// a change of status never drops the commits the run carries.
func (s *Service) updateStepRun(
	ctx context.Context, id string, number int, mutate func(*StepRun),
) (StepRun, error) {
	if _, ok := s.Get(id); !ok {
		return StepRun{}, fmt.Errorf("set step %d of task %s: %w", number, id, ErrNotFound)
	}

	now := s.now().UTC()
	run := StepRun{TaskID: id, Number: number, CreatedAt: now}

	s.mu.Lock()
	// A step keeps everything it recorded before, and the instant it was first
	// recorded at, across every retry.
	if index := indexOfRun(s.stepRuns[id], number); index >= 0 {
		run = s.stepRuns[id][index]
	}
	s.mu.Unlock()

	run.Block = nil
	run.UpdatedAt = now
	mutate(&run)

	if err := s.repo.UpsertStepRun(ctx, run); err != nil {
		return StepRun{}, err
	}

	s.mu.Lock()
	runs := s.stepRuns[id]
	if index := indexOfRun(runs, number); index >= 0 {
		runs[index] = run
	} else {
		position, _ := slices.BinarySearchFunc(runs, run, func(a, b StepRun) int { return cmp.Compare(a.Number, b.Number) })
		runs = slices.Insert(runs, position, run)
	}
	s.stepRuns[id] = runs
	s.mu.Unlock()

	reason := ""
	if run.Block != nil {
		reason = string(run.Block.Reason)
	}
	s.log.Info("step run set", "task", id, "step", number, "status", string(run.Status), "reason", reason)
	s.changed()
	return run, nil
}

// SetStepRun records the state of a step, creating the record on the first
// call for it. block is nil unless status is StepBlocked.
func (s *Service) SetStepRun(
	ctx context.Context, id string, number int, status StepStatus, block *StepBlock,
) (StepRun, error) {
	return s.updateStepRun(ctx, id, number, func(run *StepRun) {
		run.Status = status
		if block != nil {
			copied := *block
			run.Block = &copied
		}
	})
}

// SetStepStarted records a step whose session is about to open, with the
// commit its worktree is on.
func (s *Service) SetStepStarted(ctx context.Context, id string, number int, startCommit string) (StepRun, error) {
	return s.updateStepRun(ctx, id, number, func(run *StepRun) {
		run.Status = StepStarted
		run.StartCommit = startCommit
	})
}

// SetStepCommitted records the commit a step produced, which is what makes it
// done.
func (s *Service) SetStepCommitted(ctx context.Context, id string, number int, sha, subject string) (StepRun, error) {
	run, err := s.updateStepRun(ctx, id, number, func(run *StepRun) {
		run.Status = StepDone
		run.CommitSHA, run.CommitSubject = sha, subject
	})
	if err != nil {
		return StepRun{}, err
	}

	s.log.Info("step committed", "task", id, "step", number, "commit", shortSHA(sha), "subject", subject)
	return run, nil
}

// SetStepPass records the pass of the agent review of a step the app asked for.
func (s *Service) SetStepPass(ctx context.Context, id string, number, pass int) (StepRun, error) {
	return s.updateStepRun(ctx, id, number, func(run *StepRun) {
		run.ReviewPass = pass
	})
}

// SetStepReported records the pass of the agent review of a step whose report
// the app acted on.
func (s *Service) SetStepReported(ctx context.Context, id string, number, pass int) (StepRun, error) {
	return s.updateStepRun(ctx, id, number, func(run *StepRun) {
		run.ReportedPass = pass
	})
}

// SetStepFallback records why a step that started under the agent review is
// reviewed by the user from now on.
func (s *Service) SetStepFallback(ctx context.Context, id string, number int, fallback ReviewFallback) (StepRun, error) {
	return s.updateStepRun(ctx, id, number, func(run *StepRun) {
		run.Fallback = fallback
	})
}

// ClearStepReview forgets the agent review of a step: the reports it wrote and
// how far its loop got. It is what starting the step over means for its
// review.
func (s *Service) ClearStepReview(ctx context.Context, id string, number int) error {
	t, ok := s.Get(id)
	if !ok {
		return fmt.Errorf("clear the review of step %d of task %s: %w", number, id, ErrNotFound)
	}
	if err := removeStepReports(t.StepReviewsDir(), number); err != nil {
		return fmt.Errorf("clear the review of step %d of task %s: %w", number, id, err)
	}

	s.mu.Lock()
	recorded := indexOfRun(s.stepRuns[id], number) >= 0
	s.mu.Unlock()
	// A run without a status does not read back, so a step the app never
	// recorded has nothing to forget.
	if recorded {
		if _, err := s.updateStepRun(ctx, id, number, func(run *StepRun) {
			run.ReviewPass, run.ReportedPass, run.Fallback = 0, 0, ""
		}); err != nil {
			return err
		}
	}

	a := s.inspect(t)
	t.ArtifactVersion++
	t.UpdatedAt = s.now().UTC()
	if err := s.repo.UpdateArtifactVersion(ctx, t.ID, t.ArtifactVersion, t.UpdatedAt); err != nil {
		return err
	}

	s.mu.Lock()
	if index := indexOf(s.tasks, id); index >= 0 {
		s.tasks[index] = t
	}
	s.artifacts[id] = a
	s.mu.Unlock()

	s.log.Info("step review cleared", "task", id, "step", number)
	s.changed()
	return nil
}

// ClearStepRuns forgets every step of a task, which is what discarding the
// plan means for them.
func (s *Service) ClearStepRuns(ctx context.Context, id string) error {
	if err := s.repo.DeleteStepRuns(ctx, id); err != nil {
		return err
	}

	s.mu.Lock()
	delete(s.stepRuns, id)
	s.mu.Unlock()

	s.log.Info("step runs cleared", "task", id)
	s.changed()
	return nil
}

// PRRun is what the app recorded about the PR stage of a task, false before it.
func (s *Service) PRRun(id string) (PRRun, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	run, ok := s.prRuns[id]
	if !ok {
		return PRRun{}, false
	}
	return clonePRRun(run), true
}

// updatePRRun rewrites the PR run of a task from what the cache holds, so that
// a change of status never drops the pull request the run carries.
func (s *Service) updatePRRun(ctx context.Context, id string, mutate func(*PRRun)) (PRRun, error) {
	if _, ok := s.Get(id); !ok {
		return PRRun{}, fmt.Errorf("set pr run of task %s: %w", id, ErrNotFound)
	}

	now := s.now().UTC()
	run := PRRun{TaskID: id, CreatedAt: now}

	s.mu.Lock()
	// A task keeps everything it recorded before, and the instant it was first
	// recorded at, across every retry.
	if recorded, ok := s.prRuns[id]; ok {
		run = recorded
	}
	s.mu.Unlock()

	run.UpdatedAt = now
	mutate(&run)

	if err := s.repo.UpsertPRRun(ctx, run); err != nil {
		return PRRun{}, err
	}

	s.mu.Lock()
	s.prRuns[id] = run
	s.mu.Unlock()

	reason := ""
	if run.Block != nil {
		reason = string(run.Block.Reason)
	}
	s.log.Info("pr run set", "task", id, "status", string(run.Status), "reason", reason)
	s.changed()
	return run, nil
}

// SetPRRun records the state of the PR stage of a task, creating the record on
// the first call for it. block is nil unless status is PRBlocked.
func (s *Service) SetPRRun(ctx context.Context, id string, status PRStatus, block *PRBlock) (PRRun, error) {
	return s.updatePRRun(ctx, id, func(run *PRRun) {
		run.Status = status
		run.Block = nil
		if block != nil {
			copied := *block
			run.Block = &copied
		}
	})
}

// SetPRDetails records the pull request of a task as gh reported it.
func (s *Service) SetPRDetails(ctx context.Context, id string, pr PRDetails) (PRRun, error) {
	return s.updatePRRun(ctx, id, func(run *PRRun) {
		run.PR = pr
	})
}

// SetPRClosed records that the closing of a task is over, with what it did to
// the worktree, the branch and the base branch.
func (s *Service) SetPRClosed(ctx context.Context, id string, result CloseResult) (PRRun, error) {
	return s.updatePRRun(ctx, id, func(run *PRRun) {
		run.Status = PRClosed
		run.Block = nil
		copied := result
		run.Close = &copied
	})
}

// SetPRReviewed records the pass a report closed and the commit it covered,
// which is what makes the next pass wait for a new commit.
func (s *Service) SetPRReviewed(ctx context.Context, id, commit string, pass int) (PRRun, error) {
	return s.updatePRRun(ctx, id, func(run *PRRun) {
		run.ReviewedCommit, run.ReportedPass = commit, pass
	})
}

// ClearPRRun forgets the PR stage of a task.
func (s *Service) ClearPRRun(ctx context.Context, id string) error {
	if err := s.repo.DeletePRRun(ctx, id); err != nil {
		return err
	}

	s.mu.Lock()
	delete(s.prRuns, id)
	s.mu.Unlock()

	s.log.Info("pr run cleared", "task", id)
	s.changed()
	return nil
}

// Counts is how many active and archived tasks a repository holds.
func (s *Service) Counts(repositoryID string) (active, archived int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, t := range s.tasks {
		if t.RepositoryID == repositoryID {
			active++
		}
	}
	for _, t := range s.archived {
		if t.RepositoryID == repositoryID {
			archived++
		}
	}
	return active, archived
}

// RemoveArtifacts throws away the artifact of a stage and of every stage after
// it, which is what going back to that stage means.
func (s *Service) RemoveArtifacts(ctx context.Context, id string, from Stage) error {
	t, ok := s.Get(id)
	if !ok {
		return fmt.Errorf("remove artifacts of task %s: %w", id, ErrNotFound)
	}

	for _, stage := range t.Mode.From(from) {
		var err error
		switch stage {
		case StagePRD:
			err = removePath(t.PRDPath(), false)
		case StageTechSpec:
			err = removePath(t.TechSpecPath(), false)
		case StagePlan:
			err = removePath(t.StepsDir(), true)
		case StageOneShot:
			err = removePath(t.OneShotPath(), false)
		case StageImplementation:
			// The reports of the agent review belong to the steps, and go with
			// them.
			err = removePath(t.StepReviewsDir(), true)
		case StagePR:
			// The drafts and the reports are about the commits the steps
			// produced; going back to them leaves nothing to open a PR from.
			err = removePath(t.PRDir(), true)
		}
		if err != nil {
			return fmt.Errorf("remove artifacts of task %s: %w", id, err)
		}
	}

	// The choices of the steps belong to the planning: a plan or a document
	// written again starts from the model of implementation and from the mode of
	// the task.
	planning := t.Mode.Index(from) < t.Mode.Index(StageImplementation)
	if planning && len(t.Models.Steps) > 0 {
		t.Models = Models{Stages: t.Models.Stages}
		if err := s.repo.UpdateModels(ctx, t.ID, t.Models, s.now().UTC()); err != nil {
			return err
		}
	}
	if planning && len(t.ReviewModes.Steps) > 0 {
		t.ReviewModes = ReviewModes{Task: t.ReviewModes.Task}
		if err := s.repo.UpdateReviewModes(ctx, t.ID, t.ReviewModes, s.now().UTC()); err != nil {
			return err
		}
	}

	a := s.inspect(t)
	t.ArtifactVersion++
	t.UpdatedAt = s.now().UTC()
	if err := s.repo.UpdateArtifactVersion(ctx, t.ID, t.ArtifactVersion, t.UpdatedAt); err != nil {
		return err
	}

	s.mu.Lock()
	if index := indexOf(s.tasks, id); index >= 0 {
		s.tasks[index] = t
	}
	s.artifacts[id] = a
	s.mu.Unlock()

	s.log.Info("artifacts removed", "task", t.ID, "stage", string(from), "artifact_version", t.ArtifactVersion)
	s.changed()
	return nil
}

// ReadArtifact returns the content of an artifact by file name: the PRD, the
// tech spec, the One-Shot document, a step file under the steps folder,
// pr/draft.md or pr/review-<n>.md under the pr folder, or a report of the agent
// review of a step under the step-reviews folder. Anything else is ErrNotFound.
// An archived task is read the same way, which is what the history shows.
func (s *Service) ReadArtifact(id, name string) (string, error) {
	if !readableArtifact(name) {
		return "", fmt.Errorf("read artifact %s of task %s: %w", name, id, ErrNotFound)
	}
	t, ok := s.Lookup(id)
	if !ok {
		return "", fmt.Errorf("read artifact of task %s: %w", id, ErrNotFound)
	}

	path := filepath.Join(t.ArtifactsDir, name)
	content, err := os.ReadFile(path)
	switch {
	case errors.Is(err, os.ErrNotExist):
		return "", fmt.Errorf("read artifact %s: %w", path, ErrNotFound)
	case err != nil:
		return "", fmt.Errorf("read artifact %s: %w", path, err)
	}
	return string(content), nil
}

// readableArtifact reports whether a name is one of the artifacts the app
// shows. The files of a folder are matched by their own pattern, which no path
// can slip through.
func readableArtifact(name string) bool {
	if name == PRDFile || name == TechSpecFile || name == OneShotFile {
		return true
	}
	if step, found := strings.CutPrefix(name, StepsDirName+"/"); found {
		return stepFilePattern.MatchString(step)
	}
	if report, found := strings.CutPrefix(name, StepReviewsDirName+"/"); found {
		return stepReportFilePattern.MatchString(report)
	}
	pr, found := strings.CutPrefix(name, PRDirName+"/")
	return found && prArtifactName(pr)
}

// removeStepReports deletes the reports of the agent review of one step. A
// missing folder holds none.
func removeStepReports(dir string, number int) error {
	entries, err := os.ReadDir(dir)
	switch {
	case errors.Is(err, os.ErrNotExist):
		return nil
	case err != nil:
		return fmt.Errorf("read %s: %w", dir, err)
	}

	for _, entry := range entries {
		step, _, ok := parseStepReportName(entry.Name())
		if entry.IsDir() || !ok || step != number {
			continue
		}
		if err := removePath(filepath.Join(dir, entry.Name()), false); err != nil {
			return err
		}
	}
	return nil
}

// removePath deletes an artifact that may not be there, which is not a failure.
func removePath(path string, dir bool) error {
	var err error
	if dir {
		err = os.RemoveAll(path)
	} else {
		err = os.Remove(path)
	}
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("remove %s: %w", path, err)
	}
	return nil
}

// Close stops the watcher.
func (s *Service) Close() error {
	return s.watcher.close()
}

// artifactSettled reports what the artifact folder of a task holds after the
// watcher saw it go quiet. The kinds are the artifacts that had events; what
// they mean for the stage is not this package's call.
func (s *Service) artifactSettled(id string, kinds []ArtifactKind) {
	t, ok := s.Get(id)
	if !ok {
		return
	}

	s.mu.Lock()
	before := s.artifacts[id]
	s.mu.Unlock()

	after := s.inspect(t)
	changes := make([]Change, 0, len(kinds))
	for _, kind := range kinds {
		// A plan only counts once it is whole; a half-written steps folder is
		// not a change anyone can act on.
		if kind == ArtifactPlan {
			if after.Plan.Valid() {
				changes = append(changes, Change{Kind: kind, First: !before.Plan.Valid()})
			}
			continue
		}
		if after.Has(kind) {
			changes = append(changes, Change{Kind: kind, First: !before.Has(kind)})
		}
	}

	t.ArtifactVersion++
	t.UpdatedAt = s.now().UTC()

	ctx, cancel := context.WithTimeout(context.Background(), settleTimeout)
	defer cancel()

	if err := s.repo.UpdateArtifactVersion(ctx, t.ID, t.ArtifactVersion, t.UpdatedAt); err != nil {
		s.log.Error("update artifact version failed", "task", t.ID, "error", err)
		return
	}

	s.mu.Lock()
	if index := indexOf(s.tasks, id); index >= 0 {
		s.tasks[index] = t
	}
	s.artifacts[id] = after
	s.mu.Unlock()

	s.log.Info("artifact changed", "task", t.ID, "artifact_version", t.ArtifactVersion, "kinds", kinds)
	if s.onArtifact != nil {
		s.onArtifact(t, changes)
	}
	s.changed()
}

// inspect reads the artifacts of a task off the disk.
func (s *Service) inspect(t Task) Artifacts {
	plan := ReadPlan(t.StepsDir())
	if t.Mode == ModeOneShot {
		plan = OneShotPlan(t.OneShotPath(), t.Name)
	}

	return Artifacts{
		PRD:      s.fileWritten(t.PRDPath()),
		TechSpec: s.fileWritten(t.TechSpecPath()),
		OneShot:  s.fileWritten(t.OneShotPath()),
		Plan:     plan,
		PR:       ReadPRArtifacts(t.PRDir()),

		StepReports: ReadStepReports(t.StepReviewsDir()),
	}
}

// fileWritten reports whether an artifact exists with content in it. An agent
// creating the file empty is not a finished stage.
func (s *Service) fileWritten(path string) bool {
	info, err := os.Stat(path)
	switch {
	case err == nil:
		return info.Size() > 0
	case errors.Is(err, os.ErrNotExist):
		return false
	default:
		s.log.Warn("stat artifact failed", "path", path, "error", err)
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

// indexOfRun finds a step run by number, -1 when the list does not hold it.
func indexOfRun(runs []StepRun, number int) int {
	return slices.IndexFunc(runs, func(r StepRun) bool { return r.Number == number })
}

// clonePRRun copies the block and the close result a run carries, so that what
// a caller holds never changes under it.
func clonePRRun(run PRRun) PRRun {
	if run.Block != nil {
		block := *run.Block
		run.Block = &block
	}
	if run.Close != nil {
		result := *run.Close
		run.Close = &result
	}
	return run
}

// cloneStepRuns copies the runs and the block each one carries, so that what
// a caller holds never changes under it.
func cloneStepRuns(runs []StepRun) []StepRun {
	if len(runs) == 0 {
		return nil
	}
	out := make([]StepRun, len(runs))
	for i, run := range runs {
		if run.Block != nil {
			block := *run.Block
			run.Block = &block
		}
		out[i] = run
	}
	return out
}
