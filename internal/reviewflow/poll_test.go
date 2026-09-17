package reviewflow_test

import (
	"slices"
	"testing"

	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/reviewflow"
)

// polled reads the pull requests of the reviews and waits for what the
// reading settles.
func (f *fixture) polled(t *testing.T, id string, cond func(reviewflow.State) bool, subject string) {
	t.Helper()

	f.service.Poll()
	waitFor(t, subject, func() bool {
		state, ok := f.service.State(id)
		return ok && cond(state)
	})
}

func TestACommitOnAPublishedPullRequestBringsTheReviewBackToTheUser(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := toPublish(t, f)
	if err := f.service.Publish(t.Context(), id, prreview.VerdictComment); err != nil {
		t.Fatalf("publish review: %v", err)
	}
	moved := openPR()
	moved.HeadCommit = otherHash
	f.pulls.seed(moved)

	f.polled(t, id, func(s reviewflow.State) bool {
		return s.Status == reviewflow.StatusNewCommits
	}, "the new commits of the pull request to be noticed")

	if stored, _ := f.reviews.Get(id); stored.HeadCommit != otherHash || stored.PRCheckedAt.IsZero() {
		t.Errorf("review = %+v, want the head GitHub has now, with when it was read", stored)
	}
	if !slices.Contains(f.changed(), id) {
		t.Error("the app was not told the review changed")
	}
}

func TestAMergedPullRequestEndsItsReview(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := toPublish(t, f)
	merged := openPR()
	merged.State = string(prreview.PRMerged)
	f.pulls.seed(merged)

	f.service.Poll()
	waitFor(t, "the review to reach the history", func() bool {
		stored, ok := f.reviews.Lookup(id)
		return ok && stored.Archived()
	})

	if _, active := f.reviews.Get(id); active {
		t.Error("the review is still active after the pull request was merged")
	}
	if stored, _ := f.reviews.Lookup(id); stored.PRState != prreview.PRMerged {
		t.Errorf("review = %+v, want it archived as merged", stored)
	}
	if !slices.Contains(f.sessions.recorded(), "discardTask:"+id) {
		t.Errorf("session calls = %v, want the conversation of the review thrown away", f.sessions.recorded())
	}
	if !slices.Contains(f.worktrees.recorded(), "remove:"+id) {
		t.Errorf("worktree calls = %v, want the worktree of the review removed", f.worktrees.recorded())
	}
	if !slices.Contains(f.watch.recorded(), "forget:"+id) {
		t.Errorf("watcher calls = %v, want the worktree forgotten", f.watch.recorded())
	}
}

func TestAClosedPullRequestEndsItsReviewToo(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := toPublish(t, f)
	closed := openPR()
	closed.State = string(prreview.PRClosed)
	f.pulls.seed(closed)

	f.service.Poll()
	waitFor(t, "the review to reach the history", func() bool {
		stored, ok := f.reviews.Lookup(id)
		return ok && stored.Archived()
	})

	if stored, _ := f.reviews.Lookup(id); stored.PRState != prreview.PRClosed {
		t.Errorf("review = %+v, want it archived as closed", stored)
	}
}

func TestAReadingOfGitHubThatFailsSaysSoAndKeepsTheReview(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := toPublish(t, f)
	f.pulls.failWith(errGitHub)

	f.polled(t, id, func(s reviewflow.State) bool {
		return s.CheckError != ""
	}, "the failed reading to reach the review")

	if _, active := f.reviews.Get(id); !active {
		t.Error("the review is gone after a reading that failed")
	}

	f.pulls.failWith(nil)
	f.polled(t, id, func(s reviewflow.State) bool {
		return s.CheckError == ""
	}, "the reading that worked to settle the failure")
}

func TestSyncOpensTheConversationOfEveryReviewAgain(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := decided(t, f)
	f.sessions.forget(id)

	f.service.Sync(t.Context())

	info, ok := f.sessions.info(id)
	if !ok {
		t.Fatal("the conversation of the review was not opened again")
	}
	stored, _ := f.reviews.Get(id)
	if info.ReviewPath != stored.ReportPath(1) {
		t.Errorf("review path = %q, want the report of the pass the review is on", info.ReviewPath)
	}
	if !slices.Contains(f.sessions.recorded(), "open:"+id) {
		t.Errorf("session calls = %v, want the conversation opened", f.sessions.recorded())
	}
}

func TestSyncPointsTheConversationAtThePassItStillOwes(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(t)
	f.sessions.forget(id)

	f.service.Sync(t.Context())

	info, ok := f.sessions.info(id)
	if !ok {
		t.Fatal("the conversation of the review was not opened again")
	}
	stored, _ := f.reviews.Get(id)
	if info.ReviewPath != stored.ReportPath(1) {
		t.Errorf("review path = %q, want the report of the pass the agent still owes", info.ReviewPath)
	}
}
