package flow

import (
	"context"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

// checksWait is one wait for the checks of the head of a pull request.
type checksWait struct {
	afterPush     bool // the head is a commit the app just pushed, or the pull request it just opened
	emptyReadings int  // readings that found no check at all
	read          bool // a reading of this wait came back
}

// emptyReadingsToSettle is how many readings without a check a wait that
// follows a push takes before it believes the pull request has no checks:
// GitHub takes a few seconds to register the checks of a new head, and the
// first reading may find none.
const emptyReadingsToSettle = 2

// settled says whether a reading ends the wait: nothing is pending, the merge
// state is known, and a reading without checks right after a push was seen
// twice.
func (w *checksWait) settled(checks gh.PRChecks) bool {
	if checks.Pending() {
		return false
	}
	if len(checks.Checks) == 0 && w.afterPush {
		w.emptyReadings++
		return w.emptyReadings >= emptyReadingsToSettle
	}
	return true
}

// beginChecksWait puts the review of a pull request on hold until GitHub has
// read the checks of its head and the merge state, and reads them now. The
// caller holds the lock of the task.
func (s *Service) beginChecksWait(ctx context.Context, id string, afterPush bool) error {
	if _, err := s.tasks.SetPRRun(ctx, id, task.PRWaitingChecks, nil); err != nil {
		s.log.Error("record waiting pull request failed", "task", id, "error", err)
		return err
	}
	l := s.lockOf(id)
	s.mu.Lock()
	l.checks = nil
	l.checksWait = checksWait{afterPush: afterPush}
	s.mu.Unlock()

	s.log.Info("pr checks wait started", "task", id)
	s.spawnPRWork(id, s.readChecks)
	return nil
}

// readChecks reads the checks of the head of a pull request under a wait, and
// ends the wait once they settle. It runs on the goroutine of the stage; the
// poll reads again while they do not.
func (s *Service) readChecks(ctx context.Context, id string) {
	if _, ok := s.prTask(ctx, id); !ok {
		return
	}
	wt, ok := s.worktrees.Get(id)
	if !ok {
		return
	}
	if run, ok := s.tasks.PRRun(id); !ok || run.Status != task.PRWaitingChecks {
		// The wait ended while the reading waited for its turn.
		return
	}

	pr, err := s.viewPR(ctx, wt)
	if err != nil {
		// The pull request exists: a gh that does not find it failed too.
		s.log.Warn("read pull request checks failed", "task", id, "error", err)
		s.blockPRUnlessCancelled(ctx, id, ghReason(err), err)
		return
	}

	dbCtx, cancel := context.WithTimeout(context.Background(), evaluateTimeout)
	defer cancel()

	if _, err := s.tasks.SetPRDetails(dbCtx, id, prDetails(pr)); err != nil {
		s.log.Error("record pull request failed", "task", id, "error", err)
		return
	}
	if state := task.PRState(pr.State); state == task.PRStateMerged || state == task.PRStateClosed {
		s.endWaitForClosedPR(dbCtx, id, state)
		return
	}

	l := s.lockOf(id)
	s.mu.Lock()
	l.checksWait.read = true
	settled := l.checksWait.settled(pr.Checks)
	if settled {
		l.checks = &pr.Checks
	}
	s.mu.Unlock()
	if !settled {
		s.log.Info("pr checks pending", "task", id, "checks", len(pr.Checks.Checks))
		return
	}

	if _, err := s.tasks.SetPRRun(dbCtx, id, task.PRReviewing, nil); err != nil {
		s.log.Error("record reviewing pull request failed", "task", id, "error", err)
		return
	}
	s.log.Info("pr checks read", "task", id,
		"failed", len(pr.Checks.Failed()), "conflicting", pr.Checks.Conflicting())
	s.Check(id)
}

// endWaitForClosedPR ends the review of a pull request that was merged or
// closed while its pass waited for the checks. With the stage done and the
// state recorded, the task is shown as merged or closed.
func (s *Service) endWaitForClosedPR(ctx context.Context, id string, state task.PRState) {
	if _, err := s.tasks.SetPRRun(ctx, id, task.PRDone, nil); err != nil {
		s.log.Error("record done pull request failed", "task", id, "error", err)
		return
	}
	s.review.Forget(id)
	if err := s.sessions.Close(ctx, session.Key{TaskID: id, Stage: session.PRReviewStage}); err != nil {
		s.log.Error("close pr review session failed", "task", id, "error", err)
	}
	s.setPassAsked(id, "")
	s.log.Info("pull request over before the pass", "task", id, "state", string(state))
	s.Check(id)
}

// checksUnread says whether the wait for checks of a task still owes its first
// reading: the one it asked for when it began may have been refused while other
// work of the stage ran.
func (s *Service) checksUnread(id string) bool {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	return !l.checksWait.read
}

// takeChecks hands over the reading that settled the last wait for checks, and
// forgets it: one reading is for one pass.
func (s *Service) takeChecks(id string) *gh.PRChecks {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	checks := l.checks
	l.checks = nil
	return checks
}

// resumeChecksWait picks up a wait for checks the app was closed in: the
// conversation of the review comes back only when there is one, and the checks
// are read again. The caller holds the lock of the task.
func (s *Service) resumeChecksWait(ctx context.Context, t task.Task, run task.PRRun) {
	// Reopening a conversation that does not exist would create an empty one,
	// which the evaluation would take for a pass already under way.
	exists, err := s.sessions.Exists(ctx, session.Key{TaskID: t.ID, Stage: session.PRReviewStage})
	switch {
	case err != nil:
		s.log.Error("open pr session failed", "task", t.ID, "error", err)
	case exists:
		s.reopenPRSession(ctx, t, run, true)
	}

	// The tolerance to a reading without checks dies with the app.
	l := s.lockOf(t.ID)
	s.mu.Lock()
	l.checksWait = checksWait{}
	s.mu.Unlock()

	s.spawnPRWork(t.ID, s.readChecks)
}

// forgetChecks drops the wait for checks of a task and the reading that
// settled it.
func (s *Service) forgetChecks(id string) {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	l.checks = nil
	l.checksWait = checksWait{}
}

// recordBaseline keeps what the reading a review pass starts from shows
// wrong: what the readings that follow the pass are measured against.
func (s *Service) recordBaseline(ctx context.Context, id string, checks *gh.PRChecks) {
	if _, err := s.tasks.SetPRBaseline(ctx, id, checks.Trouble()); err != nil {
		s.log.Error("record pull request baseline failed", "task", id, "error", err)
	}
}

// recordTrouble measures a reading of a pull request that waits for the merge
// against the reading its last review pass started from, and records what
// went wrong since when that changed.
func (s *Service) recordTrouble(ctx context.Context, id string, run task.PRRun, checks gh.PRChecks) {
	next := gh.NextTrouble(run.TroubleBaseline, run.Trouble, checks)
	if next.Equal(run.Trouble) {
		return
	}
	if _, err := s.tasks.SetPRTrouble(ctx, id, next); err != nil {
		s.log.Error("record pull request trouble failed", "task", id, "error", err)
		return
	}
	s.log.Info("pull request trouble", "task", id,
		"failed", len(next.FailedChecks), "conflicting", next.Conflict)
}
