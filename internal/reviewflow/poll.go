package reviewflow

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/pulls"
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
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

		s.read(ctx, s.reviews.List())
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
	s.pollDone = make(chan struct{})
	return true
}

// stopPolling lets the next round of polling through.
func (s *Service) stopPolling() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.polling = false
	close(s.pollDone)
	s.pollDone = nil
}

// pollingDone is the channel the reading under way closes when it ends; false
// when none is under way, or the flow was closed.
func (s *Service) pollingDone() (<-chan struct{}, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.closed || s.pollDone == nil {
		return nil, false
	}
	return s.pollDone, true
}

// RefreshPR reads the pull request of a review now, out of the minute: after a
// reading already under way, which it waits for, when that reading did not
// bring the review.
func (s *Service) RefreshPR(ctx context.Context, id string) error {
	stored, ok := s.reviews.Get(id)
	if !ok {
		return fmt.Errorf("refresh review %s: %w", id, prreview.ErrNotFound)
	}
	asked := time.Now().UTC()
	for {
		if s.startPolling() {
			defer s.stopPolling()

			readCtx, cancel := context.WithTimeout(ctx, prCheckTimeout)
			defer cancel()

			s.read(readCtx, []prreview.Review{stored})
			return nil
		}
		done, reading := s.pollingDone()
		if !reading {
			if s.isClosed() {
				return nil
			}
			continue
		}
		select {
		case <-done:
		case <-ctx.Done():
			return ctx.Err()
		}
		if s.readAtOf(id).After(asked) {
			return nil
		}
	}
}

// readAtOf is when the pull request of a review was last read, good or not.
func (s *Service) readAtOf(id string) time.Time {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	return l.readAt
}

// read reads the pull requests of the reviews in one call and settles what
// each review makes of it.
func (s *Service) read(ctx context.Context, active []prreview.Review) {
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
			if s.setCheckError(stored.ID, message) {
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
	changed = s.setReading(id, detail) || changed

	state := prreview.PRState(detail.State)
	// The marker of new commits goes in only once the new head is stored, so
	// that a failed write marks them again on the next reading, not twice.
	headMoved := stored.PublishedPass > 0 && stored.HeadCommit != "" && stored.HeadCommit != detail.HeadCommit
	if stored.HeadCommit != detail.HeadCommit || stored.Title != detail.Title || stored.PRState != state {
		updated, err := s.reviews.Update(ctx, id, func(r *prreview.Review) {
			r.HeadCommit, r.Title, r.PRState = detail.HeadCommit, detail.Title, state
			r.PRCheckedAt = time.Now().UTC()
		})
		if err != nil {
			s.log.Error("update review failed", "review", id, "error", err)
			return
		}
		if headMoved {
			s.markNewCommits(ctx, stored, detail)
		}
		stored, changed = updated, true
	}

	if state == prreview.PRMerged || state == prreview.PRClosed {
		s.end(ctx, stored, detail)
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

// markNewCommits records in the conversation the commits that reached the
// pull request after its review was published: the ones after the head the
// review was made on, or the last twenty when that head is not among the
// recent ones, which count -1.
func (s *Service) markNewCommits(ctx context.Context, stored prreview.Review, detail pulls.Detail) {
	news, count := detail.Commits, -1
	if i := slices.IndexFunc(detail.Commits, func(c pulls.Commit) bool { return c.SHA == stored.HeadCommit }); i >= 0 {
		news = detail.Commits[i+1:]
		count = len(news)
	} else if len(news) > newCommitsKept {
		news = news[len(news)-newCommitsKept:]
	}
	commits := make([]session.MarkerCommit, 0, len(news))
	for _, c := range news {
		commits = append(commits, session.MarkerCommit{SHA: task.ShortSHA(c.SHA), Subject: c.Subject, Author: c.Author})
	}
	s.sessions.MarkNewCommits(ctx, sessionKey(stored.ID), commits, count)
}

// newCommitsKept is how many commits the marker of new commits keeps when the
// head the review was made on is not among the ones read.
const newCommitsKept = 20

// end closes a review whose pull request is over: the conversation and the
// worktree go, and the review moves to the history. It waits for nobody, so
// it raises no situation and rings no bell.
func (s *Service) end(ctx context.Context, stored prreview.Review, detail pulls.Detail) {
	state := prreview.PRState(detail.State)
	if err := s.sessions.DiscardTask(ctx, stored.ID); err != nil {
		s.log.Error("discard review session failed", "review", stored.ID, "error", err)
	}
	s.watch.Forget(stored.ID)
	if err := s.worktrees.Remove(ctx, stored.ID); err != nil {
		s.log.Warn("remove review worktree failed", "review", stored.ID, "error", err)
	}
	if _, err := s.reviews.Archive(ctx, stored.ID, prreview.End{
		State: state, MergedBy: detail.MergedBy, MergedAt: detail.MergedAt, ClosedAt: detail.ClosedAt,
	}); err != nil {
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
// failed, "" when it worked, and says whether that changed. The hour of a
// failure is the first of its run.
func (s *Service) setCheckError(id, reason string) bool {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now().UTC()
	l.readAt = now
	changed := l.checkError != reason
	l.checkError = reason
	switch {
	case reason == "":
		l.checkErrorAt = time.Time{}
	case l.checkErrorAt.IsZero():
		l.checkErrorAt = now
	}
	return changed
}

// setReading keeps what a good reading of a pull request said: the checks and
// the merge, the recent commits and when it was made. It always changes
// something, since the interface shows how long ago the reading was.
func (s *Service) setReading(id string, detail pulls.Detail) bool {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	l.checks = detail.Checks
	l.recent = detail.Commits
	l.checkedAt = time.Now().UTC()
	return true
}
