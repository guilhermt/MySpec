package flow

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"slices"
	"strings"

	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/worktree"
)

// StepStatus is what the interface shows about a step.
type StepStatus string

// The states a step of a plan is shown in.
const (
	StepNotStarted     StepStatus = "not_started"
	StepPreparing      StepStatus = "preparing"
	StepBlocked        StepStatus = "blocked"
	StepImplementing   StepStatus = "implementing"
	StepAwaitingReview StepStatus = "awaiting_review"
)

// Phase is what the preparation of a step is doing.
type Phase string

// The phases of a preparation, in order.
const (
	PhaseFetching Phase = "fetching"
	PhaseCreating Phase = "creating"
	PhaseChecking Phase = "checking"
)

// StepState is a step of the plan with everything the app knows about it.
type StepState struct {
	Step         task.Step
	Status       StepStatus
	Phase        Phase           // preparing only
	Block        *task.StepBlock // blocked only
	WorktreePath string          // "" until the worktree of the repository of the step exists
}

// The ways the flow refuses to act on a step.
var (
	ErrNotImplementing = errors.New("flow: task is not implementing")
	ErrNoStep          = errors.New("flow: task has no step to run")
	ErrStepNotBlocked  = errors.New("flow: step is not blocked")
	ErrStepNotDirty    = errors.New("flow: step is not blocked by a dirty worktree")
	ErrStepNotStarted  = errors.New("flow: step has not started")
	ErrNoWorktree      = errors.New("flow: the worktree of the step does not exist yet")
)

// prepareOptions say how a step is (re)started.
type prepareOptions struct {
	clean     bool // discard every change of the worktree before checking it
	restarted bool // the step is started over, not reached for the first time
}

// Steps is every step of the plan of a task with its state, in order.
func (s *Service) Steps(id string) []StepState {
	a, _ := s.tasks.Artifacts(id)
	runs := s.tasks.StepRuns(id)
	sum, open := s.sessions.Summary(id)
	phase := s.phaseOf(id)

	states := make([]StepState, 0, len(a.Plan.Steps))
	for _, step := range a.Plan.Steps {
		state := StepState{Step: step, Status: StepNotStarted}
		if step.RepoPath != "" {
			if wt, ok := s.worktrees.Get(id, step.RepoPath); ok {
				state.WorktreePath = wt.Path
			}
		}
		if index := indexOfRun(runs, step.Number); index >= 0 {
			run := runs[index]
			switch run.Status {
			case task.StepPreparing:
				state.Status, state.Phase = StepPreparing, phase
			case task.StepBlocked:
				state.Status, state.Block = StepBlocked, run.Block
			case task.StepStarted:
				state.Status = StepImplementing
				if open && sum.Stage == session.StepStage(step.Number) && sum.Idle {
					state.Status = StepAwaitingReview
				}
			}
		}
		states = append(states, state)
	}
	return states
}

// CurrentStep is the step that runs or runs next: the first one not done. In
// this version no step is ever done, so it is step 1.
func (s *Service) CurrentStep(id string) (StepState, bool) {
	states := s.Steps(id)
	if len(states) == 0 {
		return StepState{}, false
	}
	return states[0], true
}

// currentStep is the step of a plan that runs or runs next.
func currentStep(plan task.Plan) (task.Step, bool) {
	if len(plan.Steps) == 0 {
		return task.Step{}, false
	}
	return plan.Steps[0], true
}

// beginStep records the first step of a task that has just reached
// implementation and hands it to a preparation. The caller holds the lock of
// the task, which the goroutine waits for.
func (s *Service) beginStep(ctx context.Context, t task.Task) error {
	a, err := s.tasks.Inspect(t.ID)
	if err != nil {
		return err
	}
	step, ok := currentStep(a.Plan)
	if !ok {
		s.log.Warn("no step to run", "task", t.ID)
		return nil
	}
	if _, err := s.tasks.SetStepRun(ctx, t.ID, step.Number, task.StepPreparing, nil); err != nil {
		return err
	}
	s.spawnPrepare(t.ID, prepareOptions{})
	return nil
}

// spawnPrepare starts the preparation of the current step of a task, unless
// the flow is closed or one is already under way. The context is born here,
// before the goroutine has the lock of the task, so that a cancellation
// between the spawn and the lock reaches it too.
func (s *Service) spawnPrepare(id string, opts prepareOptions) {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.closed || l.preparing {
		return
	}
	ctx, cancel := context.WithCancel(context.Background())
	l.preparing, l.cancel = true, cancel
	go s.prepare(ctx, id, opts)
}

// setPhase records what the preparation of a task is doing and tells the app.
func (s *Service) setPhase(id string, phase Phase) {
	l := s.lockOf(id)

	s.mu.Lock()
	l.phase = phase
	s.mu.Unlock()

	// The snapshot reads Steps, which takes the mutex this call just released.
	if s.onChange != nil {
		s.onChange(id)
	}
}

// phaseOf is what the preparation of a task is doing, "" when there is none.
func (s *Service) phaseOf(id string) Phase {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	return l.phase
}

// prepare fetches, creates and checks the worktree of the current step of a
// task and starts its session, or records what blocked it. It runs on a
// goroutine of its own, holding the lock of the task from end to end.
func (s *Service) prepare(ctx context.Context, id string, opts prepareOptions) {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	defer func() {
		s.mu.Lock()
		cancel := l.cancel
		l.preparing, l.cancel, l.phase = false, nil, ""
		s.mu.Unlock()

		if cancel != nil {
			cancel()
		}
	}()

	if ctx.Err() != nil || s.isClosed() {
		return
	}
	t, ok := s.tasks.Get(id)
	if !ok || t.Stage != task.StageImplementation {
		return
	}
	a, err := s.tasks.Inspect(id)
	if err != nil {
		s.log.Error("inspect artifacts failed", "task", id, "stage", string(t.Stage), "error", err)
		return
	}
	step, ok := currentStep(a.Plan)
	if !ok {
		return
	}
	// Someone may have changed the state of the step while the goroutine
	// waited for the lock, and then this preparation is not the current one.
	runs := s.tasks.StepRuns(id)
	index := indexOfRun(runs, step.Number)
	if index < 0 || runs[index].Status != task.StepPreparing {
		return
	}

	block := func(reason task.BlockReason, detail string, files int) {
		s.setPhase(id, "")
		dbCtx, cancel := context.WithTimeout(context.Background(), evaluateTimeout)
		defer cancel()

		blocked := &task.StepBlock{Reason: reason, Detail: detail, Files: files}
		if _, setErr := s.tasks.SetStepRun(dbCtx, id, step.Number, task.StepBlocked, blocked); setErr != nil {
			s.log.Error("record blocked step failed", "task", id, "step", step.Number, "error", setErr)
			return
		}
		s.log.Warn("step blocked", "task", id, "step", step.Number, "reason", string(reason))
	}

	if step.RepoPath == "" {
		block(task.BlockNoRepository, noRepositoryDetail(step), 0)
		return
	}
	repo := task.Repository{Rel: step.Repository, Path: step.RepoPath}

	s.setPhase(id, PhaseFetching)
	wt, err := s.worktrees.Ensure(ctx, t, repo, func(p worktree.Phase) { s.setPhase(id, Phase(p)) })
	if err != nil {
		// A cancelled preparation belongs to whoever cancelled it, and that is
		// who decides what the step becomes.
		if ctx.Err() == nil {
			block(reasonOf(err), err.Error(), 0)
		}
		return
	}
	if opts.clean {
		if cleanErr := s.worktrees.Clean(ctx, wt); cleanErr != nil {
			if ctx.Err() == nil {
				block(task.BlockGitFailed, cleanErr.Error(), 0)
			}
			return
		}
	}

	s.setPhase(id, PhaseChecking)
	status, err := s.worktrees.Status(ctx, wt)
	if err != nil {
		if ctx.Err() == nil {
			block(task.BlockGitFailed, err.Error(), 0)
		}
		return
	}
	if !status.Clean() {
		block(task.BlockDirty, strings.Join(status.Entries, "\n"), len(status.Entries))
		return
	}

	s.setPhase(id, "")
	dbCtx, cancel := context.WithTimeout(context.Background(), evaluateTimeout)
	defer cancel()

	if _, err := s.tasks.SetStepRun(dbCtx, id, step.Number, task.StepStarted, nil); err != nil {
		s.log.Error("record started step failed", "task", id, "step", step.Number, "error", err)
		return
	}
	info := stepInfo(t, step, wt, s.tasks.Repositories(t))
	if err := s.sessions.Start(dbCtx, info, opts.restarted); err != nil {
		// The session records a process that fails in the conversation itself.
		s.log.Error("start step session failed", "task", id, "step", step.Number, "error", err)
	}
	s.log.Info("step started", "task", id, "step", step.Number, "worktree", wt.Path, "restarted", opts.restarted)
}

// resumeSteps picks up the steps of a task that is implementing where the app
// left them. A preparation under way holds the lock, and then there is nothing
// to resume.
func (s *Service) resumeSteps(ctx context.Context, t task.Task) {
	l := s.lockOf(t.ID)
	if !l.mu.TryLock() {
		return
	}
	defer l.mu.Unlock()

	a, err := s.tasks.Inspect(t.ID)
	if err != nil {
		s.log.Error("inspect artifacts failed", "task", t.ID, "stage", string(t.Stage), "error", err)
		return
	}
	step, ok := currentStep(a.Plan)
	if !ok {
		return
	}
	runs := s.tasks.StepRuns(t.ID)
	index := indexOfRun(runs, step.Number)
	if index < 0 {
		// The app closed between the stage change and the first preparation.
		if _, err := s.tasks.SetStepRun(ctx, t.ID, step.Number, task.StepPreparing, nil); err != nil {
			s.log.Error("record preparing step failed", "task", t.ID, "step", step.Number, "error", err)
			return
		}
		s.spawnPrepare(t.ID, prepareOptions{})
		return
	}

	switch runs[index].Status {
	case task.StepPreparing:
		// A half-created worktree comes back as "path already exists".
		s.spawnPrepare(t.ID, prepareOptions{})
	case task.StepBlocked:
	case task.StepStarted:
		wt, ok := s.worktrees.Get(t.ID, step.RepoPath)
		if !ok {
			s.log.Error("the worktree of a started step is missing", "task", t.ID, "step", step.Number)
			blocked := &task.StepBlock{
				Reason: task.BlockGitFailed,
				Detail: "the worktree of this step is not registered; discard the plan to start over",
			}
			if _, err := s.tasks.SetStepRun(ctx, t.ID, step.Number, task.StepBlocked, blocked); err != nil {
				s.log.Error("record blocked step failed", "task", t.ID, "step", step.Number, "error", err)
			}
			return
		}
		if err := s.sessions.Open(ctx, stepInfo(t, step, wt, s.tasks.Repositories(t))); err != nil {
			s.log.Error("open step session failed", "task", t.ID, "step", step.Number, "error", err)
		}
	}
}

// stepInfo is what the session of a step needs to know: the worktree it runs
// in, the key it is stored under and the file it is opened with.
func stepInfo(t task.Task, step task.Step, wt worktree.Worktree, repos []task.Repository) session.TaskInfo {
	rels := make([]string, len(repos))
	for i, repo := range repos {
		rels[i] = repo.Rel
	}
	return session.TaskInfo{
		ID:           t.ID,
		Name:         t.Name,
		Dir:          wt.Path,
		ArtifactsDir: t.ArtifactsDir,
		Stage:        session.StepStage(step.Number),
		Prompt:       prompts.StageStep,
		Step:         step.Number,
		StepPath:     filepath.Join(t.StepsDir(), step.File),
		PRDPath:      t.PRDPath(),
		TechSpecPath: t.TechSpecPath(),
		StepsDir:     t.StepsDir(),
		Repositories: rels,
	}
}

// reasonOf is why a worktree could not be made ready.
func reasonOf(err error) task.BlockReason {
	switch {
	case errors.Is(err, worktree.ErrFetchFailed):
		return task.BlockFetchFailed
	case errors.Is(err, worktree.ErrNoBaseBranch):
		return task.BlockNoBase
	case errors.Is(err, worktree.ErrPathExists):
		return task.BlockPathExists
	case errors.Is(err, worktree.ErrBranchExists):
		return task.BlockBranchExists
	default:
		return task.BlockGitFailed
	}
}

// noRepositoryDetail says which repository of a step the workspace has none of.
func noRepositoryDetail(step task.Step) string {
	return fmt.Sprintf("repository %q is not one of the repositories of this task", step.Repository)
}

// indexOfRun finds the run of a step by number.
func indexOfRun(runs []task.StepRun, number int) int {
	return slices.IndexFunc(runs, func(r task.StepRun) bool { return r.Number == number })
}
