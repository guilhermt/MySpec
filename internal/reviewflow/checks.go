package reviewflow

import (
	"context"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/pulls"
)

// checksWait is one wait for the checks of the head of a pull request. It is
// the same policy the flow of a task follows, in internal/flow: no package
// below both owns it.
type checksWait struct {
	afterPush     bool // the head is a commit the app just pushed
	emptyReadings int  // readings that found no check at all
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

// continueWait goes on with a pass that waits for the checks, on a reading of
// the poll: while they are pending the review keeps waiting, and once they
// settle the worktree is brought to the head and the pass the app asked for
// starts. The caller holds the lock of the review.
func (s *Service) continueWait(ctx context.Context, stored prreview.Review, detail pulls.Detail) {
	id := stored.ID
	stored, repo, wt, err := s.active(id)
	if err != nil {
		s.log.Error("ask review pass failed", "review", id, "error", err)
		return
	}

	l := s.lockOf(id)
	s.mu.Lock()
	settled := l.wait.settled(detail.Checks)
	s.mu.Unlock()
	if !settled {
		s.log.Info("review checks pending", "review", id, "checks", len(detail.Checks.Checks))
		return
	}

	if err = s.updateWorktree(ctx, stored, wt); err != nil {
		s.blockPass(id, err.Error())
		return
	}
	if stored, err = s.writeContext(ctx, stored, repo, detail); err != nil {
		s.log.Error("ask review pass failed", "review", id, "error", err)
		return
	}
	// The pass was asked for when the wait began.
	if err = s.sendPass(ctx, stored, repo, wt, detail.Checks); err != nil {
		return
	}
	if err = s.setPhase(ctx, id, prreview.PhaseNone); err != nil {
		s.log.Error("record review phase failed", "review", id, "error", err)
	}
	s.notify(id)
}

// blockPass records why the pass a review waits for could not start, which
// stops the wait until the user asks for the pass again.
func (s *Service) blockPass(id, reason string) {
	s.log.Warn("review pass blocked", "review", id, "error", reason)
	if s.setPassBlocked(id, reason) {
		s.notify(id)
	}
}

// setPassBlocked records why the pass the app asked for could not start, and
// says whether that changed.
func (s *Service) setPassBlocked(id, reason string) bool {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	changed := l.passBlocked != reason
	l.passBlocked = reason
	return changed
}

// passBlockedOf is why the pass a review waits for could not start, "" when
// nothing blocks it.
func (s *Service) passBlockedOf(id string) string {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	return l.passBlocked
}
