package reviewflow_test

import (
	"slices"
	"testing"

	"github.com/guilhermt/myspec/internal/prreview"
)

func TestDeletingAReviewTakesItsConversationAndItsWorktreeWithIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := decided(t, f)

	left, err := f.service.Delete(t.Context(), id)
	if err != nil {
		t.Fatalf("delete review: %v", err)
	}

	if left.WorktreePath != "" {
		t.Errorf("leftover = %+v, want nothing left behind", left)
	}
	if _, ok := f.reviews.Lookup(id); ok {
		t.Error("the review is still there after it was deleted")
	}
	if !slices.Contains(f.sessions.recorded(), "discardTask:"+id) {
		t.Errorf("session calls = %v, want the conversation thrown away", f.sessions.recorded())
	}
	if !slices.Contains(f.worktrees.recorded(), "remove:"+id) {
		t.Errorf("worktree calls = %v, want the worktree removed", f.worktrees.recorded())
	}
	if !slices.Contains(f.watch.recorded(), "forget:"+id) {
		t.Errorf("watcher calls = %v, want the worktree forgotten", f.watch.recorded())
	}
}

func TestAWorktreeGitKeepsNeverKeepsTheReview(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := decided(t, f)
	wt, _ := f.worktrees.Get(id)
	f.worktrees.failRemove(errGit)

	left, err := f.service.Delete(t.Context(), id)
	if err != nil {
		t.Fatalf("delete review: %v", err)
	}

	if left.WorktreePath != wt.Path || left.RepoPath != wt.RepoPath || left.Error != errGit.Error() {
		t.Errorf("leftover = %+v, want the folder, its clone and what git said", left)
	}
	if _, ok := f.reviews.Lookup(id); ok {
		t.Error("the review is still there after it was deleted")
	}
}

func TestAReviewInTheHistoryIsDeletedToo(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := decided(t, f)
	if _, err := f.reviews.Archive(t.Context(), id, prreview.End{State: prreview.PRMerged}); err != nil {
		t.Fatalf("archive review: %v", err)
	}

	if _, err := f.service.Delete(t.Context(), id); err != nil {
		t.Fatalf("delete review: %v", err)
	}
	if _, ok := f.reviews.Lookup(id); ok {
		t.Error("the archived review is still there after it was deleted")
	}
}

func TestDeletingAReviewNobodyStartedIsRefused(t *testing.T) {
	t.Parallel()

	f := newFixture(t)

	_, err := f.service.Delete(t.Context(), "review-9")
	wantErrIs(t, err, prreview.ErrNotFound)
}
