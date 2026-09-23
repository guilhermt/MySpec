package reviewflow_test

import (
	"slices"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/pulls"
	"github.com/guilhermt/myspec/internal/reviewflow"
	"github.com/guilhermt/myspec/internal/session"
)

// polled reads the pull requests of the reviews until cond holds of what the
// readings settle. It reads again and again because a round of polling is
// skipped while another one is in flight, and a wait for the checks may take
// more than one reading.
func (f *fixture) polled(t *testing.T, id string, cond func(reviewflow.State) bool, subject string) {
	t.Helper()

	waitFor(t, subject, func() bool {
		f.service.Poll()
		state, ok := f.service.State(id)
		return ok && cond(state)
	})
}

// pollOnce reads the pull requests of the reviews once more and gives what
// the reading settles the time to run, for a test that checks nothing
// changed.
func (f *fixture) pollOnce(t *testing.T) {
	t.Helper()

	before := f.pulls.readings()
	waitFor(t, "a reading of GitHub", func() bool {
		f.service.Poll()
		return f.pulls.readings() > before
	})
	time.Sleep(settleWait)
}

// troubled polls until the review is in trouble.
func (f *fixture) troubled(t *testing.T, id string) {
	t.Helper()

	f.polled(t, id, func(s reviewflow.State) bool {
		return s.Status == reviewflow.StatusTrouble
	}, "the review to be in trouble")
}

func TestAPollRecordsWhatWentWrongWithAPullRequestWhoseReviewRests(t *testing.T) {
	t.Parallel()

	cases := map[string]struct {
		setup func(*testing.T, *fixture) string
		pr    func() pulls.Detail
	}{
		"a published review":   {setup: published, pr: openPR},
		"a ready to merge one": {setup: cleanApply, pr: ownPR},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			id := c.setup(t, f)
			f.pulls.seed(withChecks(c.pr(), gh.MergeableConflicting, passedCheck, failedCheck))

			f.troubled(t, id)

			want := gh.Trouble{FailedChecks: []string{"lint"}, Conflict: true}
			if got := f.state(t, id).Review.Trouble; !got.Equal(want) {
				t.Errorf("trouble = %+v, want %+v", got, want)
			}
			if !slices.Contains(f.changed(), id) {
				t.Error("the app was not told the review changed")
			}
		})
	}
}

func TestAPollLeavesTheTroubleOfAReviewThatIsNotRestingAlone(t *testing.T) {
	t.Parallel()

	cases := map[string]struct {
		setup func(*testing.T, *fixture) string
		want  reviewflow.Status
	}{
		"a review deciding its findings": {setup: deciding, want: reviewflow.StatusAwaitingDecision},
		"a review waiting for the checks": {
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				f.pulls.seed(withChecks(openPR(), gh.MergeableClean, pendingCheck))
				return f.start(t)
			},
			want: reviewflow.StatusWaitingChecks,
		},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			id := c.setup(t, f)
			f.pulls.seed(withChecks(openPR(), gh.MergeableConflicting, failedCheck, pendingCheck))

			f.pollOnce(t)

			state := f.state(t, id)
			if state.Status != c.want || state.Review.Trouble.Any() {
				t.Errorf("status = %q, trouble = %+v, want %q and no trouble",
					state.Status, state.Review.Trouble, c.want)
			}
		})
	}
}

func TestAPendingCheckKeepsTheTroubleUntilThePullRequestIsFine(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := published(t, f)
	f.pulls.seed(withChecks(openPR(), gh.MergeableConflicting, failedCheck))
	f.troubled(t, id)

	rerun := gh.Check{Name: failedCheck.Name, URL: checkURL, Pending: true}
	f.pulls.seed(withChecks(openPR(), gh.MergeableUnknown, rerun))
	f.pollOnce(t)

	want := gh.Trouble{FailedChecks: []string{"lint"}, Conflict: true}
	if state := f.state(t, id); state.Status != reviewflow.StatusTrouble || !state.Review.Trouble.Equal(want) {
		t.Errorf("status = %q, trouble = %+v, want the trouble kept while the check runs",
			state.Status, state.Review.Trouble)
	}

	f.pulls.seed(withChecks(openPR(), gh.MergeableClean, gh.Check{Name: "lint", URL: checkURL, Conclusion: "success"}))
	f.polled(t, id, func(s reviewflow.State) bool {
		return s.Status == reviewflow.StatusPublished
	}, "the review to rest published again")

	if got := f.state(t, id).Review.Trouble; got.Any() {
		t.Errorf("trouble = %+v, want none", got)
	}
}

func TestAPollThatFailsLeavesTheTroubleAsItWas(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := published(t, f)
	f.pulls.seed(withChecks(openPR(), gh.MergeableClean, failedCheck))
	f.troubled(t, id)

	f.pulls.failWith(errGitHub)
	f.polled(t, id, func(s reviewflow.State) bool {
		return s.CheckError != ""
	}, "the failed reading to reach the review")

	state := f.state(t, id)
	if state.Status != reviewflow.StatusTrouble || !state.Review.Trouble.Equal(lintFailed) {
		t.Errorf("status = %q, trouble = %+v, want the trouble kept", state.Status, state.Review.Trouble)
	}
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

func TestSyncLeavesAReviewWithoutAConversationAlone(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := decided(t, f)
	f.sessions.lose(id)
	before := len(f.sessions.recorded())

	f.service.Sync(t.Context())

	if slices.Contains(f.sessions.recorded()[before:], "open:"+id) {
		t.Errorf("session calls = %v, want no conversation created for the review", f.sessions.recorded())
	}
	if _, open := f.sessions.Summary(session.Key{TaskID: id, Stage: session.ReviewStage}); open {
		t.Error("the review has a conversation it never had")
	}
}
