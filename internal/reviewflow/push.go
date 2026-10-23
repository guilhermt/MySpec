package reviewflow

import (
	"context"
	"errors"
	"fmt"

	"github.com/guilhermt/myspec/internal/divergence"
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/task"
)

// ErrNotPushing is the refusal to retry a push the review is not at.
var ErrNotPushing = errors.New("reviewflow: the review is not pushing a commit")

// RetryPush pushes the commit of the fixes again, after a push that failed for
// a reason other than a rejection.
func (s *Service) RetryPush(_ context.Context, id string) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	stored, ok := s.reviews.Get(id)
	if !ok {
		return fmt.Errorf("retry push of review %s: %w", id, prreview.ErrNotFound)
	}
	if stored.Phase != prreview.PhasePushing {
		return fmt.Errorf("retry push of review %s: %w", id, ErrNotPushing)
	}
	s.setPassBlocked(id, "")
	s.notify(id)
	s.spawnPush(id)
	return nil
}

// spawnPush pushes the commit of the fixes of a review on a goroutine of its
// own, one at a time per review. Nothing in an evaluation talks to the network:
// the end of the commit turn, Sync and the ways out of a divergence start it.
func (s *Service) spawnPush(id string) {
	l := s.lockOf(id)

	s.mu.Lock()
	if s.closed || l.pushing {
		s.mu.Unlock()
		return
	}
	l.pushing = true
	// Counted before the lock is released, so that Close never misses it.
	s.spawned.Go(func() {
		defer func() {
			s.mu.Lock()
			l.pushing = false
			s.mu.Unlock()
		}()
		s.pushWork(s.ctx, id)
	})
	s.mu.Unlock()
}

// pushWork pushes HEAD of the worktree to the branch of the pull request. A
// push that lands asks for the next pass, which waits for the checks of the new
// head; a rejected one is a divergence; any other failure blocks the review
// until the user retries.
func (s *Service) pushWork(ctx context.Context, id string) {
	stored, ok := s.reviews.Get(id)
	if !ok || stored.Phase != prreview.PhasePushing {
		return
	}
	wt, ok := s.worktrees.Get(id)
	if !ok {
		s.blockPass(id, ErrNoWorktree.Error())
		return
	}
	head := s.headOf(ctx, wt)
	if err := s.worktrees.Push(ctx, wt, stored.HeadBranch); err != nil {
		switch {
		case ctx.Err() != nil:
			// The app is closing: Sync pushes again when it opens.
		case errors.Is(err, git.ErrPushRejected):
			s.diverge(ctx, stored, divergence.KindPushRejected, divergence.Facts{
				Branch: stored.HeadBranch, Commit: task.ShortSHA(head), Reason: gitSaid(err),
			})
		default:
			s.blockPass(id, err.Error())
		}
		return
	}

	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	s.clearDivergence(ctx, id, divergence.KindPushRejected)
	// The next pass waits for the checks of the commit that went up. The poll
	// brings the reading, and the pass starts from it.
	if _, err := s.reviews.AskPass(ctx, id, stored.ReportedPass+1, ""); err != nil {
		s.log.Error("ask review pass failed", "review", id, "error", err)
		return
	}
	s.mu.Lock()
	l.wait = checksWait{afterPush: true}
	l.passBlocked = ""
	s.mu.Unlock()
	if err := s.setPhase(ctx, id, prreview.PhaseWaitingChecks); err != nil {
		s.log.Error("record review phase failed", "review", id, "error", err)
		return
	}
	s.log.Info("review commit pushed", "review", id, "commit", task.ShortSHA(head))
	s.notify(id)
	s.Poll()
}

// gitSaid is what git said about a failure, or the error when it said nothing.
func gitSaid(err error) string {
	if gitErr, ok := errors.AsType[*git.Error](err); ok && gitErr.Output != "" {
		return gitErr.Output
	}
	return err.Error()
}
