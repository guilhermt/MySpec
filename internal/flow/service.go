package flow

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

// New builds a Service from deps.
func New(deps Deps) *Service {
	s := &Service{
		tasks:     deps.Tasks,
		sessions:  deps.Sessions,
		worktrees: deps.Worktrees,
		review:    deps.Review,
		gh:        deps.GH,
		log:       deps.Log,
		onChange:  deps.OnChange,

		renderPrompt: deps.RenderPrompt,
		locks:        map[string]*taskLock{},
	}
	if s.log == nil {
		s.log = slog.New(slog.DiscardHandler)
	}
	return s
}

// Check asks for an evaluation of a task and returns at once. The callbacks
// that call it run on goroutines of the session and of the artifact watcher,
// which must not wait for a process to stop; a burst of them is coalesced into
// one evaluation after the one under way.
func (s *Service) Check(id string) {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.closed || l.queued {
		return
	}
	l.queued = true
	go s.run(id, l)
}

// run evaluates a task, one evaluation at a time per task.
func (s *Service) run(id string, l *taskLock) {
	l.mu.Lock()
	defer l.mu.Unlock()

	s.mu.Lock()
	l.queued = false
	s.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), evaluateTimeout)
	defer cancel()

	s.evaluate(ctx, id)
}

// evaluate decides what the current stage of a task needs: a correction of its
// plan, the next stage, or nothing at all.
func (s *Service) evaluate(ctx context.Context, id string) {
	if s.isClosed() {
		return
	}

	t, ok := s.tasks.Get(id)
	if !ok {
		return
	}
	// Implementation has no conversation of its own: what it needs is decided
	// on the step that runs and the worktree it runs in.
	if t.Stage == task.StageImplementation {
		s.evaluateStep(ctx, t)
		return
	}
	// The PR stage has no conversation of its own either: each repository has
	// one, and what it needs is decided on its pull request.
	if t.Stage == task.StagePR {
		s.evaluatePR(t)
		return
	}
	if !t.Stage.HasSession() {
		return
	}
	a, err := s.tasks.Inspect(id)
	if err != nil {
		s.log.Error("inspect artifacts failed", "task", id, "stage", string(t.Stage), "error", err)
		return
	}
	// A task whose session is not open yet has nothing to decide on; Sync opens
	// them all before it checks anything.
	key := session.Key{TaskID: id, Stage: string(t.Stage)}
	sum, ok := s.sessions.Summary(key)
	if !ok {
		return
	}

	// Step files that are not a whole plan are the app's to point out, and the
	// stage stays where it is until the agent fixes them.
	if t.Stage == task.StagePlan && sum.Idle && a.Plan.Present && !a.Plan.Valid() {
		if sum.Corrections >= MaxCorrections {
			return
		}
		message := correctionMessage(t.StepsDir(), a.Plan.Problems, s.tasks.Repositories(t))
		if err := s.sessions.SendCorrection(ctx, key, message); err != nil {
			s.log.Error("send plan correction failed", "task", id, "stage", string(t.Stage), "error", err)
		}
		return
	}

	if !a.Done(t.Stage) || !sum.Idle {
		return
	}
	// A revisited stage moves on when the user says so, never on its own.
	if t.Revisiting {
		return
	}
	if err := s.advance(ctx, t); err != nil {
		s.log.Error("advance stage failed", "task", id, "stage", string(t.Stage), "error", err)
	}
}

// advance closes a finished stage and starts the one after it.
func (s *Service) advance(ctx context.Context, t task.Task) error {
	next, ok := t.Stage.Next()
	if !ok {
		return nil
	}

	// The conversation of a finished stage takes no more messages.
	if err := s.sessions.Close(ctx, session.Key{TaskID: t.ID, Stage: string(t.Stage)}); err != nil {
		return err
	}
	moved, err := s.tasks.SetStage(ctx, t.ID, next, false)
	if err != nil {
		return err
	}
	s.log.Info("stage advanced", "task", t.ID, "from", string(t.Stage), "to", string(next))

	if !next.HasSession() {
		// Implementation has no conversation of its own: its first step does.
		if next == task.StageImplementation {
			return s.beginStep(ctx, moved)
		}
		return nil
	}
	return s.start(ctx, moved, false)
}

// start opens the session of the stage a task is in and hands it the prompt. A
// start that fails leaves its error on the new session; the stage stays.
func (s *Service) start(ctx context.Context, t task.Task, restarted bool) error {
	a, err := s.tasks.Inspect(t.ID)
	if err != nil {
		return err
	}
	return s.sessions.Start(ctx, TaskInfo(t, a, s.tasks.Repositories(t)), restarted)
}

// Back reopens a finished stage of a task, throwing away the conversations and
// the artifacts of every stage after it. The target is the PRD or the tech
// spec, and the task waits for Continue from there on.
func (s *Service) Back(ctx context.Context, id string, target task.Stage) error {
	s.abortPrepare(id)

	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	t, ok := s.tasks.Get(id)
	if !ok {
		return fmt.Errorf("back to %s: %w", target, task.ErrNotFound)
	}
	revisitable := target == task.StagePRD || target == task.StageTechSpec
	if !revisitable || target.Index() >= t.Stage.Index() {
		return fmt.Errorf("back to %s from %s: %w", target, t.Stage, ErrInvalidTarget)
	}

	// The worktrees and the branches of the steps go before anything else, so
	// that one git cannot remove leaves the task exactly as it was.
	if err := s.tearDownSteps(ctx, t); err != nil {
		return err
	}
	after, _ := target.Next()
	if err := s.sessions.Discard(ctx, id, sessionStages(after)...); err != nil {
		return err
	}
	if err := s.tasks.RemoveArtifacts(ctx, id, after); err != nil {
		return err
	}
	reopened, err := s.tasks.SetStage(ctx, id, target, true)
	if err != nil {
		return err
	}
	s.log.Info("stage revisited", "task", id, "stage", string(target))

	a, err := s.tasks.Inspect(id)
	if err != nil {
		return err
	}
	return s.sessions.Open(ctx, TaskInfo(reopened, a, s.tasks.Repositories(reopened)))
}

// Discard throws away a stage of a task and everything after it, and starts
// the stage again from scratch.
func (s *Service) Discard(ctx context.Context, id string, stage task.Stage) error {
	s.abortPrepare(id)

	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	t, ok := s.tasks.Get(id)
	if !ok {
		return fmt.Errorf("discard %s: %w", stage, task.ErrNotFound)
	}
	if !stage.HasSession() || stage.Index() > t.Stage.Index() {
		return fmt.Errorf("discard %s of a task in %s: %w", stage, t.Stage, ErrInvalidTarget)
	}

	if err := s.tearDownSteps(ctx, t); err != nil {
		return err
	}
	if err := s.sessions.Discard(ctx, id, sessionStages(stage)...); err != nil {
		return err
	}
	if err := s.tasks.RemoveArtifacts(ctx, id, stage); err != nil {
		return err
	}
	restarted, err := s.tasks.SetStage(ctx, id, stage, false)
	if err != nil {
		return err
	}
	s.log.Info("stage discarded", "task", id, "stage", string(stage))

	return s.start(ctx, restarted, true)
}

// Continue moves a task that is revisiting a stage on to the next one, which
// is the confirmation a revisit waits for.
func (s *Service) Continue(ctx context.Context, id string) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	t, ok := s.tasks.Get(id)
	if !ok {
		return fmt.Errorf("continue task %s: %w", id, task.ErrNotFound)
	}
	if !t.Revisiting {
		return fmt.Errorf("continue task %s: %w", id, ErrNotRevisiting)
	}

	a, err := s.tasks.Inspect(id)
	if err != nil {
		return err
	}
	sum, ok := s.sessions.Summary(session.Key{TaskID: id, Stage: string(t.Stage)})
	if !ok || !a.Done(t.Stage) || !sum.Idle {
		return fmt.Errorf("continue task %s in %s: %w", id, t.Stage, ErrNotReady)
	}
	return s.advance(ctx, t)
}

// StartTask begins the first stage of a task the user has just created.
func (s *Service) StartTask(ctx context.Context, t task.Task) error {
	l := s.lockOf(t.ID)
	l.mu.Lock()
	defer l.mu.Unlock()

	return s.start(ctx, t, false)
}

// Sync opens the session of every loaded task at the stage it is in and then
// evaluates them all, which is how a stage that finished while the app was
// closed moves on by itself.
func (s *Service) Sync(ctx context.Context) {
	tasks := s.tasks.List()
	for _, t := range tasks {
		switch {
		case t.Stage.HasSession():
			a, err := s.tasks.Inspect(t.ID)
			if err != nil {
				s.log.Error("inspect artifacts failed", "task", t.ID, "stage", string(t.Stage), "error", err)
				continue
			}
			if err := s.sessions.Open(ctx, TaskInfo(t, a, s.tasks.Repositories(t))); err != nil {
				s.log.Error("open session failed", "task", t.ID, "stage", string(t.Stage), "error", err)
			}
		case t.Stage == task.StageImplementation:
			s.resumeSteps(ctx, t)
		case t.Stage == task.StagePR:
			s.resumePR(ctx, t)
		}
	}
	for _, t := range tasks {
		s.Check(t.ID)
	}
}

// Close stops the flow from evaluating anything else and cancels every
// preparation in flight. The evaluations under way end on their own.
func (s *Service) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.closed = true
	for _, l := range s.locks {
		if l.cancel != nil {
			l.cancel()
		}
		for _, w := range l.repos {
			if w.cancel != nil {
				w.cancel()
			}
		}
	}
}

// isClosed reports whether the flow was closed.
func (s *Service) isClosed() bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.closed
}

// lockOf is the lock of a task, created on the first call for it.
func (s *Service) lockOf(id string) *taskLock {
	s.mu.Lock()
	defer s.mu.Unlock()

	l, ok := s.locks[id]
	if !ok {
		l = &taskLock{}
		s.locks[id] = l
	}
	return l
}

// sessionStages names the stages from one on that have a conversation, which
// is what discarding sessions takes.
func sessionStages(from task.Stage) []string {
	stages := from.From()
	names := make([]string, 0, len(stages))
	for _, stage := range stages {
		if stage.HasSession() {
			names = append(names, string(stage))
		}
	}
	return names
}
