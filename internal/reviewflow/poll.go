package reviewflow

import (
	"context"
	"errors"
	"time"

	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/pulls"
	"github.com/guilhermt/myspec/internal/repository"
)

// prCheckTimeout bounds the one reading of GitHub a round of polling makes,
// which asks about every review at once.
const prCheckTimeout = 30 * time.Second

// Poll asks GitHub about the pull request of every active review, so that a
// new commit, a merge and a close are noticed without the user opening
// anything. internal/app calls it on a timer; the reading goes out on a
// goroutine of its own and never blocks the caller.
func (s *Service) Poll() {
	if !s.startPolling() {
		return
	}
	go func() {
		defer s.stopPolling()

		ctx, cancel := context.WithTimeout(context.Background(), prCheckTimeout)
		defer cancel()

		s.poll(ctx)
	}()
}

// startPolling says whether this round of polling is the one that runs: only
// one reading is in flight at a time.
func (s *Service) startPolling() bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.closed || s.polling {
		return false
	}
	s.polling = true
	return true
}

// stopPolling lets the next round of polling through.
func (s *Service) stopPolling() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.polling = false
}

// poll reads every pull request under review in one call and settles what
// each review makes of it.
func (s *Service) poll(ctx context.Context) {
	active := s.reviews.List()
	refs := make([]pulls.Ref, 0, len(active))
	of := map[pulls.Ref]prreview.Review{}
	for _, stored := range active {
		repo, ok := s.repositories.Get(stored.RepositoryID)
		if !ok {
			continue
		}
		ref := pulls.Ref{Owner: repo.Owner, Name: repo.Name, Number: stored.Number}
		refs = append(refs, ref)
		of[ref] = stored
	}
	if len(refs) == 0 {
		return
	}

	details, err := s.pulls.ReadDetails(ctx, refs)
	if err != nil {
		s.log.Warn("read pull requests of reviews failed", "error", err)
		message := err.Error()
		if failure := (*pulls.Failure)(nil); errors.As(err, &failure) {
			message = failure.Message()
		}
		for _, stored := range of {
			if s.setCheckError(stored.ID, err.Error()) {
				s.notify(stored.ID)
			}
			if stored.Phase == prreview.PhaseWaitingChecks {
				// A pass that waits on a reading that fails waits for the user.
				s.blockPass(stored.ID, message)
			}
		}
		return
	}
	for ref, stored := range of {
		detail, found := details[ref]
		if !found {
			continue
		}
		s.settle(ctx, stored.ID, detail)
	}
}

// settle records what GitHub said about one pull request, ends the review when
// the pull request is over, and goes on with a pass that waits for the checks.
func (s *Service) settle(ctx context.Context, id string, detail pulls.Detail) {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	stored, ok := s.reviews.Get(id)
	if !ok {
		return
	}
	changed := s.setCheckError(id, "")

	state := prreview.PRState(detail.State)
	if stored.HeadCommit != detail.HeadCommit || stored.Title != detail.Title || stored.PRState != state {
		updated, err := s.reviews.Update(ctx, id, func(r *prreview.Review) {
			r.HeadCommit, r.Title, r.PRState = detail.HeadCommit, detail.Title, state
			r.PRCheckedAt = time.Now().UTC()
		})
		if err != nil {
			s.log.Error("update review failed", "review", id, "error", err)
			return
		}
		stored, changed = updated, true
	}

	if state == prreview.PRMerged || state == prreview.PRClosed {
		s.end(ctx, stored, state)
		return
	}
	if updated, moved := s.recordTrouble(ctx, stored, detail.Checks); moved {
		stored, changed = updated, true
	}
	if changed {
		s.notify(id)
	}
	if stored.Phase == prreview.PhaseWaitingChecks && s.passBlockedOf(id) == "" {
		s.continueWait(ctx, stored, detail)
	}
}

// end closes a review whose pull request is over: the conversation and the
// worktree go, and the review moves to the history. It waits for nobody, so
// it raises no situation and rings no bell.
func (s *Service) end(ctx context.Context, stored prreview.Review, state prreview.PRState) {
	if err := s.sessions.DiscardTask(ctx, stored.ID); err != nil {
		s.log.Error("discard review session failed", "review", stored.ID, "error", err)
	}
	s.watch.Forget(stored.ID)
	if err := s.worktrees.Remove(ctx, stored.ID); err != nil {
		s.log.Warn("remove review worktree failed", "review", stored.ID, "error", err)
	}
	if _, err := s.reviews.Archive(ctx, stored.ID, prreview.End{State: state}); err != nil {
		s.log.Error("archive review failed", "review", stored.ID, "error", err)
		return
	}
	s.log.Info("review ended", "review", stored.ID, "number", stored.Number, "state", string(state))
	s.notify(stored.ID)
}

// Sync brings the reviews the app loaded back to life: each one with a
// conversation gets it open again, and the reading of GitHub says what
// happened while the app was closed. A review without one is left alone:
// opening it here would create a conversation with no model nobody writes to.
func (s *Service) Sync(ctx context.Context) {
	active := s.reviews.List()
	for _, stored := range active {
		exists, err := s.sessions.Exists(ctx, sessionKey(stored.ID))
		if err != nil {
			s.log.Error("open review session failed", "review", stored.ID, "error", err)
			continue
		}
		if !exists {
			continue
		}
		repo, ok := s.repositories.Get(stored.RepositoryID)
		if !ok {
			s.log.Error("open review session failed", "review", stored.ID,
				"repository", stored.RepositoryID, "error", repository.ErrNotFound)
			continue
		}
		wt, found := s.worktrees.Get(stored.ID)
		if !found {
			s.log.Error("open review session failed", "review", stored.ID, "error", ErrNoWorktree)
			continue
		}

		pass := stored.ReportedPass
		if stored.AskedPass > stored.ReportedPass {
			// The pass the agent still owes a report for is the one it writes.
			pass = stored.ReportedPass + 1
		}
		if err := s.sessions.Open(ctx, info(stored, wt, repo, pass, "", models.Choice{}, nil)); err != nil {
			s.log.Error("open review session failed", "review", stored.ID, "error", err)
			continue
		}
		if stored.Phase == prreview.PhaseApplying || stored.Phase == prreview.PhaseCommitting {
			// Only the cycle of the fixes reads the worktree; the evaluation that
			// follows says whether the numbers matter now.
			s.watch.Track(stored.ID, wt, false)
		}
	}
	for _, stored := range active {
		s.Check(stored.ID)
	}
	s.Poll()
}

// setCheckError records what the last reading of a pull request said when it
// failed, "" when it worked, and says whether that changed.
func (s *Service) setCheckError(id, reason string) bool {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	changed := l.checkError != reason
	l.checkError = reason
	return changed
}
