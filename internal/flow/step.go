package flow

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"slices"
	"strings"

	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/worktree"
)

// StepStatus is what the interface shows about a step.
type StepStatus string

// The states a step of a plan is shown in.
const (
	StepNotStarted      StepStatus = "not_started"
	StepPreparing       StepStatus = "preparing"
	StepBlocked         StepStatus = "blocked"
	StepImplementing    StepStatus = "implementing"
	StepAwaitingReview  StepStatus = "awaiting_review"   // idle, nothing staged yet
	StepInReview        StepStatus = "in_review"         // something staged, something left
	StepReadyToApprove  StepStatus = "ready_to_approve"  // nothing left outside the index
	StepNothingToCommit StepStatus = "nothing_to_commit" // the worktree has no change at all
	StepReviewFailed    StepStatus = "review_failed"     // the worktree could not be read
	StepCommitting      StepStatus = "committing"
	StepDone            StepStatus = "done"
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
	Phase        Phase            // preparing only
	Block        *task.StepBlock  // blocked only
	WorktreePath string           // "" until the worktree of the repository of the step exists
	Review       *review.Snapshot // the review states and committing only

	CommitSHA     string // done only
	CommitSubject string
	CommitFailed  bool // the last approval ended without a commit
}

// The ways the flow refuses to act on a step.
var (
	ErrNotImplementing = errors.New("flow: task is not implementing")
	ErrNoStep          = errors.New("flow: task has no step to run")
	ErrStepNotBlocked  = errors.New("flow: step is not blocked")
	ErrStepNotDirty    = errors.New("flow: step is not blocked by a dirty worktree")
	ErrStepNotStarted  = errors.New("flow: step has not started")
	ErrNoWorktree      = errors.New("flow: the worktree of the step does not exist yet")
	ErrStepNotReady    = errors.New("flow: the review is not finished")
	ErrStepBusy        = errors.New("flow: the agent is still working")
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
	phase := s.phaseOf(id)
	snap, read := s.review.Snapshot(id)
	// The warning belongs to the step the user is on, which is the first one
	// without a commit; every other step is either done or still to come.
	noCommit := s.noCommitOf(id)

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
				// The progress only means something with the work stopped, so
				// it is read while the agent is not writing.
				if sum, open := s.sessions.Summary(stepKey(id, step.Number)); open && sum.Idle {
					state.Status = reviewStatus(snap, read)
					state.Review = reading(snap, read)
				}
			case task.StepCommitting:
				state.Status, state.Review = StepCommitting, reading(snap, read)
			case task.StepDone:
				state.Status = StepDone
				state.CommitSHA, state.CommitSubject = run.CommitSHA, run.CommitSubject
			}
		}
		if state.Status != StepDone && noCommit {
			state.CommitFailed, noCommit = true, false
		}
		states = append(states, state)
	}
	return states
}

// stepKey is the session of one step of a task.
func stepKey(taskID string, number int) session.Key {
	return session.Key{TaskID: taskID, Stage: session.StepStage(number)}
}

// reviewStatus turns the last reading of the worktree into the state the step
// is shown in. Without a reading the step is simply awaiting review: the
// numbers are on their way.
func reviewStatus(snap review.Snapshot, ok bool) StepStatus {
	switch {
	case !ok:
		return StepAwaitingReview
	case snap.Err != "":
		return StepReviewFailed
	case snap.Total == 0:
		return StepNothingToCommit
	case snap.Staged == 0:
		return StepAwaitingReview
	case snap.Staged < snap.Total:
		return StepInReview
	default:
		return StepReadyToApprove
	}
}

// reading is the snapshot a step state carries, nil while the worktree has not
// been read: an absent number is not a zero one.
func reading(snap review.Snapshot, ok bool) *review.Snapshot {
	if !ok {
		return nil
	}
	return &snap
}

// CurrentStep is the step that runs or runs next: the first one that has not
// been committed.
func (s *Service) CurrentStep(id string) (StepState, bool) {
	runs := s.tasks.StepRuns(id)
	states := s.Steps(id)
	for _, state := range states {
		if index := indexOfRun(runs, state.Step.Number); index >= 0 && runs[index].CommitSHA != "" {
			continue
		}
		return state, true
	}
	return StepState{}, false
}

// currentStep is the step of a plan that runs or runs next: the first one
// that has not been committed.
func currentStep(plan task.Plan, runs []task.StepRun) (task.Step, bool) {
	for _, step := range plan.Steps {
		if index := indexOfRun(runs, step.Number); index >= 0 && runs[index].CommitSHA != "" {
			continue
		}
		return step, true
	}
	return task.Step{}, false
}

// beginStep records the first step of a task that has just reached
// implementation and hands it to a preparation. The caller holds the lock of
// the task, which the goroutine waits for.
func (s *Service) beginStep(ctx context.Context, t task.Task) error {
	a, err := s.tasks.Inspect(t.ID)
	if err != nil {
		return err
	}
	step, ok := currentStep(a.Plan, s.tasks.StepRuns(t.ID))
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

// setNoCommit records whether the last approval of the current step of a task
// ended without a commit.
func (s *Service) setNoCommit(id string, v bool) {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	l.noCommit = v
}

// noCommitOf reports whether the last approval of the current step of a task
// ended without a commit.
func (s *Service) noCommitOf(id string) bool {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	return l.noCommit
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
	// Someone may have changed the state of the step while the goroutine
	// waited for the lock, and then this preparation is not the current one.
	runs := s.tasks.StepRuns(id)
	step, ok := currentStep(a.Plan, runs)
	if !ok {
		return
	}
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
		block(task.BlockDirty, strings.Join(status.Lines(), "\n"), len(status.Changes))
		return
	}

	s.setPhase(id, "")
	dbCtx, cancel := context.WithTimeout(context.Background(), evaluateTimeout)
	defer cancel()

	// The commit the worktree is on is what says later whether the step
	// produced one; the status reading above already gives it.
	if _, err := s.tasks.SetStepStarted(dbCtx, id, step.Number, status.Head); err != nil {
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
	runs := s.tasks.StepRuns(t.ID)
	step, ok := currentStep(a.Plan, runs)
	if !ok {
		return
	}
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
	case task.StepStarted, task.StepCommitting:
		// A step left committing reopens like a started one; what to do about
		// the commit is for the evaluation that follows.
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
	case task.StepDone:
		// currentStep never returns a step that is already committed.
	}
}

// evaluateStep keeps the review of the current step in step with the session
// and the worktree: it watches while the numbers matter, concludes the step
// when a commit appears, and starts the next one.
func (s *Service) evaluateStep(ctx context.Context, t task.Task) {
	a, err := s.tasks.Inspect(t.ID)
	if err != nil {
		s.log.Error("inspect artifacts failed", "task", t.ID, "stage", string(t.Stage), "error", err)
		return
	}
	runs := s.tasks.StepRuns(t.ID)
	step, ok := currentStep(a.Plan, runs)
	if !ok {
		// Every step is committed: nothing left to watch.
		s.review.Forget(t.ID)
		return
	}
	index := indexOfRun(runs, step.Number)
	if index < 0 {
		// beginStep records the first one; there is nothing to watch yet.
		return
	}
	run := runs[index]
	if run.Status != task.StepStarted && run.Status != task.StepCommitting {
		// Preparing or blocked: the worktree is not the user's to review.
		s.review.Forget(t.ID)
		return
	}
	wt, ok := s.worktrees.Get(t.ID, step.RepoPath)
	if !ok {
		return
	}

	sum, open := s.sessions.Summary(stepKey(t.ID, step.Number))
	idle := open && sum.Idle
	committing := run.Status == task.StepCommitting
	s.review.Track(t.ID, wt, idle || committing)
	if !idle && !committing {
		return
	}

	snap, read := s.review.Snapshot(t.ID)
	if committing && idle {
		// The commit turn is over: decide on a reading newer than it, not on
		// one the debounce still owes.
		snap, read = s.review.Refresh(t.ID)
	}
	if !read || snap.Err != "" {
		return
	}

	if snap.Head != "" && snap.Head != run.StartCommit {
		s.completeStep(ctx, t, a.Plan, step, wt, snap.Head)
		return
	}
	if committing && idle {
		// The agent finished its turn and the branch is where it was: whatever
		// it did, it did not commit, and the step goes back to the user.
		if _, err := s.tasks.SetStepRun(ctx, t.ID, step.Number, task.StepStarted, nil); err != nil {
			s.log.Error("record started step failed", "task", t.ID, "step", step.Number, "error", err)
			return
		}
		s.setNoCommit(t.ID, true)
		s.log.Warn("commit did not happen", "task", t.ID, "step", step.Number)
	}
}

// completeStep records the commit a step produced, closes its session and
// starts the next one. A task whose last step is committed simply stops here:
// the PR stage does not exist in this version.
func (s *Service) completeStep(
	ctx context.Context, t task.Task, plan task.Plan, step task.Step, wt worktree.Worktree, head string,
) {
	commit, err := s.worktrees.Commit(ctx, wt, head)
	if err != nil {
		// The commit is a fact of the branch; its subject is a nicety.
		s.log.Warn("read commit failed", "task", t.ID, "step", step.Number, "error", err)
		commit = git.Commit{SHA: head}
	}
	if _, err := s.tasks.SetStepCommitted(ctx, t.ID, step.Number, commit.SHA, commit.Subject); err != nil {
		s.log.Error("record committed step failed", "task", t.ID, "step", step.Number, "error", err)
		return
	}
	s.review.Forget(t.ID)
	s.setNoCommit(t.ID, false)
	if err := s.sessions.Close(ctx, stepKey(t.ID, step.Number)); err != nil {
		s.log.Error("close step session failed", "task", t.ID, "step", step.Number, "error", err)
	}

	next, ok := nextStep(plan, step.Number)
	if !ok {
		s.log.Info("implementation complete", "task", t.ID, "steps", len(plan.Steps))
		return
	}
	if _, err := s.tasks.SetStepRun(ctx, t.ID, next.Number, task.StepPreparing, nil); err != nil {
		s.log.Error("record preparing step failed", "task", t.ID, "step", next.Number, "error", err)
		return
	}
	s.spawnPrepare(t.ID, prepareOptions{})
}

// nextStep is the step after number, if the plan has one.
func nextStep(plan task.Plan, number int) (task.Step, bool) {
	index := slices.IndexFunc(plan.Steps, func(step task.Step) bool { return step.Number == number })
	if index < 0 || index+1 >= len(plan.Steps) {
		return task.Step{}, false
	}
	return plan.Steps[index+1], true
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

// currentStepOf is the task a user operation acts on with the step it is on,
// and the run the app recorded for it. The caller holds the lock of the task.
func (s *Service) currentStepOf(id string) (task.Task, task.Step, *task.StepRun, error) {
	t, ok := s.tasks.Get(id)
	if !ok {
		return task.Task{}, task.Step{}, nil, fmt.Errorf("step of task %s: %w", id, task.ErrNotFound)
	}
	if t.Stage != task.StageImplementation {
		return task.Task{}, task.Step{}, nil, fmt.Errorf("step of task %s in %s: %w", id, t.Stage, ErrNotImplementing)
	}
	a, err := s.tasks.Inspect(id)
	if err != nil {
		return task.Task{}, task.Step{}, nil, err
	}
	runs := s.tasks.StepRuns(id)
	step, ok := currentStep(a.Plan, runs)
	if !ok {
		return task.Task{}, task.Step{}, nil, fmt.Errorf("step of task %s: %w", id, ErrNoStep)
	}
	var run *task.StepRun
	if index := indexOfRun(runs, step.Number); index >= 0 {
		run = &runs[index]
	}
	return t, step, run, nil
}

// ApproveStep approves the review of the current step and asks the agent that
// implemented it to commit what is staged. A paused task is resumed first: the
// user should not have to think about processes to approve what they read.
func (s *Service) ApproveStep(ctx context.Context, id string) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	t, step, run, err := s.currentStepOf(id)
	if err != nil {
		return err
	}
	if run == nil || run.Status != task.StepStarted {
		return fmt.Errorf("approve step %d of task %s: %w", step.Number, id, ErrStepNotStarted)
	}
	snap, read := s.review.Snapshot(id)
	if !read || snap.Err != "" || !snap.Ready() {
		return fmt.Errorf("approve step %d of task %s: %w", step.Number, id, ErrStepNotReady)
	}

	key := stepKey(id, step.Number)
	sum, open := s.sessions.Summary(key)
	if !open {
		return fmt.Errorf("approve step %d of task %s: %w", step.Number, id, session.ErrNotFound)
	}
	if sum.Status == session.StatusPaused {
		if resumeErr := s.sessions.Resume(ctx, key); resumeErr != nil {
			return resumeErr
		}
		sum, open = s.sessions.Summary(key)
		if !open {
			return fmt.Errorf("approve step %d of task %s: %w", step.Number, id, session.ErrNotFound)
		}
	}
	if !sum.Idle {
		return fmt.Errorf("approve step %d of task %s: %w", step.Number, id, ErrStepBusy)
	}

	message, err := s.renderPrompt(prompts.StageCommit, commitVars(t, s.tasks.Repositories(t)))
	if err != nil {
		return err
	}
	if _, err := s.tasks.SetStepRun(ctx, id, step.Number, task.StepCommitting, nil); err != nil {
		return err
	}
	s.setNoCommit(id, false)
	if err := s.sessions.SendFromApp(ctx, key, message); err != nil {
		// The button stays where the user left it: the step is theirs again.
		if _, setErr := s.tasks.SetStepRun(ctx, id, step.Number, task.StepStarted, nil); setErr != nil {
			s.log.Error("record started step failed", "task", id, "step", step.Number, "error", setErr)
		}
		return err
	}
	s.log.Info("step approved", "task", id, "step", step.Number, "files", snap.Total)
	return nil
}

// commitVars are the placeholders the commit prompt may use.
func commitVars(t task.Task, repos []task.Repository) prompts.Vars {
	rels := make([]string, len(repos))
	for i, repo := range repos {
		rels[i] = repo.Rel
	}
	return prompts.Vars{
		TaskName:     t.Name,
		ArtifactsDir: t.ArtifactsDir,
		PRDPath:      t.PRDPath(),
		TechSpecPath: t.TechSpecPath(),
		StepsDir:     t.StepsDir(),
		Repositories: rels,
	}
}

// RetryStep prepares a blocked step again, from the fetch on, which is what
// the user asks for after fixing whatever git complained about.
func (s *Service) RetryStep(ctx context.Context, id string) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	_, step, run, err := s.currentStepOf(id)
	if err != nil {
		return err
	}
	if run == nil || run.Status != task.StepBlocked {
		return fmt.Errorf("retry step %d of task %s: %w", step.Number, id, ErrStepNotBlocked)
	}
	if _, err := s.tasks.SetStepRun(ctx, id, step.Number, task.StepPreparing, nil); err != nil {
		return err
	}
	s.log.Info("step retried", "task", id, "step", step.Number)
	s.spawnPrepare(id, prepareOptions{})
	return nil
}

// CleanAndStartStep throws away every change of the worktree of a step blocked
// by a dirty one and prepares it again. The cleaning runs on the preparation,
// so the call returns at once.
func (s *Service) CleanAndStartStep(ctx context.Context, id string) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	_, step, run, err := s.currentStepOf(id)
	if err != nil {
		return err
	}
	if run == nil || run.Status != task.StepBlocked || run.Block == nil || run.Block.Reason != task.BlockDirty {
		return fmt.Errorf("clean and start step %d of task %s: %w", step.Number, id, ErrStepNotDirty)
	}
	if _, err := s.tasks.SetStepRun(ctx, id, step.Number, task.StepPreparing, nil); err != nil {
		return err
	}
	s.log.Info("step cleaned and started", "task", id, "step", step.Number)
	s.spawnPrepare(id, prepareOptions{clean: true})
	return nil
}

// DiscardStep ends the session of a started step, deletes its conversation and
// starts the step over, optionally cleaning the worktree first.
func (s *Service) DiscardStep(ctx context.Context, id string, cleanWorktree bool) error {
	s.abortPrepare(id)

	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	_, step, run, err := s.currentStepOf(id)
	if err != nil {
		return err
	}
	if run == nil || run.Status != task.StepStarted {
		return fmt.Errorf("discard step %d of task %s: %w", step.Number, id, ErrStepNotStarted)
	}
	if err := s.sessions.Discard(ctx, id, session.StepStage(step.Number)); err != nil {
		return err
	}
	if _, err := s.tasks.SetStepRun(ctx, id, step.Number, task.StepPreparing, nil); err != nil {
		return err
	}
	s.log.Info("step discarded", "task", id, "step", step.Number, "clean_worktree", cleanWorktree)
	s.spawnPrepare(id, prepareOptions{clean: cleanWorktree, restarted: true})
	return nil
}

// abortPrepare cancels the preparation of a task, if there is one. It does not
// wait: whoever calls it takes the lock of the task next, and that lock is
// what the preparation holds until it gives up.
func (s *Service) abortPrepare(id string) {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	if l.cancel != nil {
		l.cancel()
	}
}

// tearDownSteps stops the step session, removes the worktrees and the branches
// of a task and forgets its steps. It is what discarding the plan, going back
// and deleting the task have in common, and it fails whole: a worktree git
// cannot remove leaves everything as it was, with the session open again.
func (s *Service) tearDownSteps(ctx context.Context, t task.Task) error {
	runs := s.tasks.StepRuns(t.ID)
	if len(runs) == 0 {
		return nil
	}
	s.review.Forget(t.ID)

	// A step session is stopped before the worktree it runs in goes away.
	stepOpen := false
	for _, run := range runs {
		if _, open := s.sessions.Summary(stepKey(t.ID, run.Number)); open {
			stepOpen = true
			break
		}
	}
	if stepOpen {
		if err := s.sessions.CloseTask(ctx, t.ID); err != nil {
			return err
		}
	}

	if err := s.worktrees.RemoveAll(ctx, t.ID); err != nil {
		// Nothing was removed, so the user is left where they were.
		if stepOpen {
			s.reopenStep(ctx, t)
		}
		return err
	}

	if err := s.sessions.Discard(ctx, t.ID, stepStages(runs)...); err != nil {
		return err
	}
	if err := s.tasks.ClearStepRuns(ctx, t.ID); err != nil {
		return err
	}
	s.log.Info("steps torn down", "task", t.ID, "steps", len(runs))
	return nil
}

// stepStages names the session of every step the app recorded, which is what
// discarding them takes.
func stepStages(runs []task.StepRun) []string {
	stages := make([]string, len(runs))
	for i, run := range runs {
		stages[i] = session.StepStage(run.Number)
	}
	return stages
}

// reopenStep brings back the session of the current step after a teardown that
// could not go through. It is best effort: a failure only reaches the log.
func (s *Service) reopenStep(ctx context.Context, t task.Task) {
	a, err := s.tasks.Inspect(t.ID)
	if err != nil {
		s.log.Error("inspect artifacts failed", "task", t.ID, "stage", string(t.Stage), "error", err)
		return
	}
	step, ok := currentStep(a.Plan, s.tasks.StepRuns(t.ID))
	if !ok {
		return
	}
	wt, ok := s.worktrees.Get(t.ID, step.RepoPath)
	if !ok {
		return
	}
	if err := s.sessions.Open(ctx, stepInfo(t, step, wt, s.tasks.Repositories(t))); err != nil {
		s.log.Error("reopen step session failed", "task", t.ID, "step", step.Number, "error", err)
	}
}

// Delete removes a task with its worktrees, its branches and its artifacts. A
// worktree git cannot remove keeps the task, and the reason reaches the user.
func (s *Service) Delete(ctx context.Context, id string) error {
	s.abortPrepare(id)

	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	t, ok := s.tasks.Get(id)
	if !ok {
		return fmt.Errorf("delete task %s: %w", id, task.ErrNotFound)
	}
	// A task still being planned has no steps, and no worktrees either.
	if t.Stage == task.StageImplementation {
		if err := s.tearDownSteps(ctx, t); err != nil {
			return err
		}
	}
	if err := s.sessions.CloseTask(ctx, id); err != nil {
		return err
	}
	if err := s.tasks.Delete(ctx, id); err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.locks, id)
	return nil
}
