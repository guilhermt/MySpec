package reviewflow_test

import (
	"fmt"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

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
	if err := f.service.Publish(t.Context(), id, prreview.VerdictComment, true); err != nil {
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

func TestAReadingKeepsTheChecksTheMergeAndTheHourOfTheLastGoodReading(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := deciding(t, f)
	if got := f.state(t, id); len(got.Checks.Checks) != 0 || !got.CheckedAt.IsZero() {
		t.Fatalf("state = %+v, want no reading before the first one", got)
	}
	f.pulls.seed(withChecks(openPR(), gh.MergeableConflicting, passedCheck, failedCheck))

	f.polled(t, id, func(s reviewflow.State) bool { return !s.CheckedAt.IsZero() }, "the reading to reach the review")

	state := f.state(t, id)
	if diff := cmp.Diff([]gh.Check{passedCheck, failedCheck}, state.Checks.Checks); diff != "" {
		t.Errorf("checks (-want +got):\n%s", diff)
	}
	if state.Checks.Mergeable != gh.MergeableConflicting {
		t.Errorf("mergeable = %q, want conflicting", state.Checks.Mergeable)
	}
	if !slices.Contains(f.changed(), id) {
		t.Error("the app was not told the review changed")
	}
}

func TestAFailingReadingKeepsTheHourOfItsFirstFailureAndSaysItInTheWordsOfTheProduct(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := toPublish(t, f)
	f.pulls.failWith(unauthenticated)

	f.polled(t, id, func(s reviewflow.State) bool { return s.CheckError != "" }, "the failed reading to reach the review")

	first := f.state(t, id)
	if first.CheckError != unauthenticated.Message() || strings.HasPrefix(first.CheckError, "pulls: ") {
		t.Errorf("check error = %q, want %q", first.CheckError, unauthenticated.Message())
	}
	if first.CheckErrorAt.IsZero() {
		t.Fatal("checkErrorAt is zero after a failing reading")
	}

	f.pollOnce(t)
	if got := f.state(t, id).CheckErrorAt; !got.Equal(first.CheckErrorAt) {
		t.Errorf("checkErrorAt = %v, want the hour of the first failure, %v", got, first.CheckErrorAt)
	}

	f.pulls.failWith(nil)
	f.polled(t, id, func(s reviewflow.State) bool { return s.CheckError == "" }, "the reading that worked to settle the failure")
	if got := f.state(t, id).CheckErrorAt; !got.IsZero() {
		t.Errorf("checkErrorAt = %v, want it gone with the first good reading", got)
	}
}

func TestAMergedPullRequestArchivesItsReviewWithWhoMergedItAndWhen(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := toPublish(t, f)
	mergedAt := time.Date(2026, 9, 30, 12, 0, 0, 0, time.UTC)
	merged := openPR()
	merged.State = string(prreview.PRMerged)
	merged.MergedBy, merged.MergedAt, merged.ClosedAt = "rsouza", mergedAt, mergedAt
	f.pulls.seed(merged)

	f.service.Poll()
	waitFor(t, "the review to reach the history", func() bool {
		stored, ok := f.reviews.Lookup(id)
		return ok && stored.Archived()
	})

	stored, _ := f.reviews.Lookup(id)
	if stored.MergedBy != "rsouza" || !stored.MergedAt.Equal(mergedAt) || !stored.ClosedAt.Equal(mergedAt) {
		t.Errorf("review = %+v, want who merged it and when", stored)
	}
}

func TestAClosedPullRequestArchivesItsReviewWithWhenItClosed(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := toPublish(t, f)
	closedAt := time.Date(2026, 9, 30, 13, 0, 0, 0, time.UTC)
	closed := openPR()
	closed.State = string(prreview.PRClosed)
	closed.ClosedAt = closedAt
	f.pulls.seed(closed)

	f.service.Poll()
	waitFor(t, "the review to reach the history", func() bool {
		stored, ok := f.reviews.Lookup(id)
		return ok && stored.Archived()
	})

	stored, _ := f.reviews.Lookup(id)
	if stored.MergedBy != "" || !stored.MergedAt.IsZero() || !stored.ClosedAt.Equal(closedAt) {
		t.Errorf("review = %+v, want only when it closed", stored)
	}
}

func TestRefreshPRReadsTheReviewOutOfTheMinute(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := deciding(t, f)
	f.pulls.seed(withChecks(openPR(), gh.MergeableClean, passedCheck))
	before := f.pulls.readings()

	if err := f.service.RefreshPR(t.Context(), id); err != nil {
		t.Fatalf("refresh review: %v", err)
	}

	if got := f.pulls.readings(); got != before+1 {
		t.Errorf("readings = %d, want one more than %d", got, before)
	}
	if state := f.state(t, id); state.CheckedAt.IsZero() || len(state.Checks.Checks) != 1 {
		t.Errorf("state = %+v, want the reading the call made", state)
	}
}

func TestRefreshPRWaitsForTheReadingUnderWayWhenItBringsTheReview(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := deciding(t, f)
	f.pulls.seed(withChecks(openPR(), gh.MergeableClean, passedCheck))
	before := f.pulls.readings()
	release, entered := f.pulls.holdReadings()
	t.Cleanup(release)

	f.service.Poll()
	<-entered
	done := make(chan error, 1)
	go func() { done <- f.service.RefreshPR(t.Context(), id) }()

	select {
	case err := <-done:
		t.Fatalf("refresh review returned %v before the reading under way ended", err)
	case <-time.After(settleWait):
	}
	release()
	if err := <-done; err != nil {
		t.Fatalf("refresh review: %v", err)
	}

	if got := f.pulls.readings(); got != before+1 {
		t.Errorf("readings = %d, want only the one that was under way (%d)", got, before+1)
	}
	if f.state(t, id).CheckedAt.IsZero() {
		t.Error("the review has no reading after the refresh")
	}
}

func TestRefreshPRReadsOnlyTheReviewAfterAReadingThatDidNotBringIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := deciding(t, f)
	f.pulls.forget(prNumber)
	before := f.pulls.readings()
	release, entered := f.pulls.holdReadings()
	t.Cleanup(release)

	f.service.Poll()
	<-entered
	done := make(chan error, 1)
	go func() { done <- f.service.RefreshPR(t.Context(), id) }()
	time.Sleep(settleWait)
	f.pulls.seed(openPR())
	release()
	if err := <-done; err != nil {
		t.Fatalf("refresh review: %v", err)
	}

	if got := f.pulls.readings(); got != before+2 {
		t.Errorf("readings = %d, want the one under way and the one of the refresh (%d)", got, before+2)
	}
	if f.state(t, id).CheckedAt.IsZero() {
		t.Error("the review has no reading after the refresh")
	}
}

func TestRefreshPRRefusesAReviewThatIsGoneAndReadsNothingOnceClosed(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := deciding(t, f)

	wantErrIs(t, f.service.RefreshPR(t.Context(), "review-gone"), prreview.ErrNotFound)

	before := f.pulls.readings()
	f.service.Close()
	if err := f.service.RefreshPR(t.Context(), id); err != nil {
		t.Errorf("refresh review = %v, want nil on a closed flow", err)
	}
	if got := f.pulls.readings(); got != before {
		t.Errorf("readings = %d, want none after the flow closed", got-before)
	}
}

func TestANewHeadAfterThePublicationMarksTheCommitsBetweenTheTwoHeads(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := toPublish(t, f)
	if err := f.service.Publish(t.Context(), id, prreview.VerdictComment, true); err != nil {
		t.Fatalf("publish review: %v", err)
	}
	moved := openPR()
	moved.HeadCommit = otherHash
	moved.Commits = []pulls.Commit{
		{SHA: "0000000aaaa", Subject: "Before the review", Author: "rsouza"},
		{SHA: headHash, Subject: "The one reviewed", Author: "rsouza"},
		{SHA: "1111111bbbb", Subject: "Fix the time zone rule", Author: "rsouza"},
		{SHA: otherHash, Subject: "Cover the cache", Author: "tchen"},
	}
	f.pulls.seed(moved)

	f.polled(t, id, func(s reviewflow.State) bool {
		return s.Status == reviewflow.StatusNewCommits
	}, "the new commits of the pull request to be noticed")

	want := []session.MarkerEntry{{
		Type: session.MarkerNewCommits, Count: 2,
		Commits: []session.MarkerCommit{
			{SHA: "1111111", Subject: "Fix the time zone rule", Author: "rsouza"},
			{SHA: "bbb2222", Subject: "Cover the cache", Author: "tchen"},
		},
	}}
	if diff := cmp.Diff(want, f.sessions.markersOf(session.MarkerNewCommits)); diff != "" {
		t.Errorf("new_commits markers (-want +got):\n%s", diff)
	}
}

func TestANewHeadWhoseParentIsNotAmongTheRecentCommitsMarksTheLastTwentyAndCountsMinusOne(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := toPublish(t, f)
	if err := f.service.Publish(t.Context(), id, prreview.VerdictComment, true); err != nil {
		t.Fatalf("publish review: %v", err)
	}
	moved := openPR()
	moved.HeadCommit = otherHash
	for i := range 30 {
		moved.Commits = append(moved.Commits, pulls.Commit{
			SHA: fmt.Sprintf("%07d", i), Subject: fmt.Sprintf("Commit %d", i), Author: "rsouza",
		})
	}
	f.pulls.seed(moved)

	f.polled(t, id, func(s reviewflow.State) bool {
		return s.Status == reviewflow.StatusNewCommits
	}, "the new commits of the pull request to be noticed")

	got := f.sessions.markersOf(session.MarkerNewCommits)
	if len(got) != 1 || got[0].Count != -1 || len(got[0].Commits) != 20 {
		t.Fatalf("new_commits markers = %+v, want one with 20 commits and count -1", got)
	}
	if first := got[0].Commits[0]; first.Subject != "Commit 10" {
		t.Errorf("first commit = %+v, want the 11th of the thirty", first)
	}
}

func TestAHeadThatMovedBeforeAnyPublicationMarksNoCommits(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := deciding(t, f)
	moved := openPR()
	moved.HeadCommit = otherHash
	f.pulls.seed(moved)

	f.polled(t, id, func(reviewflow.State) bool {
		stored, _ := f.reviews.Get(id)
		return stored.HeadCommit == otherHash
	}, "the new head to be read")

	if got := f.sessions.markersOf(session.MarkerNewCommits); len(got) != 0 {
		t.Errorf("new_commits markers = %+v, want none before the review was published", got)
	}
}
