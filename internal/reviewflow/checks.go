package reviewflow

import (
	"context"
	"time"

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
	// The pass was asked for when the wait began; the reading that lets it
	// start is the one of the poll that just settled.
	if err = s.sendPass(ctx, stored, repo, wt, detail.Checks, s.checkedAtOf(id)); err != nil {
		return
	}
	if err = s.setPhase(ctx, id, prreview.PhaseNone); err != nil {
		s.log.Error("record review phase failed", "review", id, "error", err)
	}
	s.notify(id)
}

// recordBaseline keeps what the reading a pass starts from shows wrong: what
// the readings that follow the pass are measured against.
func (s *Service) recordBaseline(ctx context.Context, id string, checks gh.PRChecks) {
	_, err := s.reviews.Update(ctx, id, func(r *prreview.Review) {
		r.TroubleBaseline, r.Trouble = checks.Trouble(), gh.Trouble{}
	})
	if err != nil {
		s.log.Error("record review baseline failed", "review", id, "error", err)
	}
}

// recordTrouble measures a reading of a pull request whose review rests,
// published or ready to merge, against the reading its last pass started
// from, and records what went wrong since when that changed. A review
// anywhere else is left alone: its next pass reads GitHub anew.
func (s *Service) recordTrouble(
	ctx context.Context, stored prreview.Review, checks gh.PRChecks,
) (prreview.Review, bool) {
	state, ok := s.State(stored.ID)
	if !ok || !watchesTrouble(state.Status) {
		return stored, false
	}
	next := gh.NextTrouble(stored.TroubleBaseline, stored.Trouble, checks)
	if next.Equal(stored.Trouble) {
		return stored, false
	}
	updated, err := s.reviews.Update(ctx, stored.ID, func(r *prreview.Review) { r.Trouble = next })
	if err != nil {
		s.log.Error("record review trouble failed", "review", stored.ID, "error", err)
		return stored, false
	}
	s.log.Info("review trouble", "review", stored.ID,
		"failed", len(next.FailedChecks), "conflicting", next.Conflict)
	return updated, true
}

// watchesTrouble says whether a review rests where what goes wrong with its
// pull request is the user's to know: published, ready to merge, or already
// in trouble.
func watchesTrouble(status Status) bool {
	return status == StatusPublished || status == StatusReadyToMerge || status == StatusTrouble
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

// checkedAtOf is when the last good reading of the pull request of a review
// was made, zero before one since the app started.
func (s *Service) checkedAtOf(id string) time.Time {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	return l.checkedAt
}
