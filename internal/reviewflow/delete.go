package reviewflow

import (
	"context"
	"fmt"

	"github.com/guilhermt/myspec/internal/prreview"
)

// Leftover is what deleting a review left on disk: a worktree git would not
// remove, with what git said and the clone it belongs to.
type Leftover struct {
	RepoPath     string // the clone of the repository of the review
	WorktreePath string // "" when everything went
	Error        string // what git said
}

// Delete removes a review for good, active or in the history: its
// conversation, its worktree and its reports go. What was already published on
// GitHub stays there, and the pull request goes back to being one the user can
// review again.
func (s *Service) Delete(ctx context.Context, id string) (Leftover, error) {
	stored, ok := s.reviews.Lookup(id)
	if !ok {
		return Leftover{}, fmt.Errorf("delete review %s: %w", id, prreview.ErrNotFound)
	}

	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	// The conversation runs inside the worktree, so it stops first.
	if err := s.sessions.DiscardTask(ctx, id); err != nil {
		return Leftover{}, fmt.Errorf("delete review %s: %w", id, err)
	}
	s.watch.Forget(id)

	var left Leftover
	if wt, found := s.worktrees.Get(id); found {
		if err := s.worktrees.Remove(ctx, id); err != nil {
			// A folder git could not remove never keeps the review: the user
			// is told where it is instead.
			s.log.Warn("remove review worktree failed", "review", id, "path", wt.Path, "error", err)
			left.RepoPath, left.WorktreePath, left.Error = wt.RepoPath, wt.Path, err.Error()
		}
	}
	if err := s.reviews.Delete(ctx, id); err != nil {
		return Leftover{}, err
	}

	s.mu.Lock()
	delete(s.locks, id)
	s.mu.Unlock()

	s.log.Info("review deleted", "review", id, "number", stored.Number)
	s.notify(id)
	return left, nil
}
