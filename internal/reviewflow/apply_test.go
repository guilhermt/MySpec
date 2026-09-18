package reviewflow_test

import (
	"slices"
	"strings"
	"testing"

	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/reviewflow"
	"github.com/guilhermt/myspec/internal/worktree"
)

// commitHash is the commit the agent leaves on the worktree when it commits
// the fixes.
const commitHash = "ccc3333"

// applyDecided is a review in apply mode whose first pass was recorded and
// whose findings the user decided on: two approved, one discarded.
func applyDecided(t *testing.T, f *fixture) string {
	t.Helper()

	f.pulls.seed(ownPR())
	id := f.startMode(t, prreview.ModeApply, "")
	f.sessions.goIdle(id)
	f.record(t, id, changesReport(1, "Three things to fix.",
		prreview.ParsedFinding{Number: 1, Path: "internal/board/service.go", Line: 12, Text: "The reading is never cached."},
		prreview.ParsedFinding{Number: 2, Text: "The cache has no test."},
		prreview.ParsedFinding{Number: 3, Text: "The name of the cache is vague."},
	), headHash)
	f.decide(t, id, 1, 1, prreview.DecisionApproved)
	f.decide(t, id, 1, 2, prreview.DecisionDiscarded)
	f.decide(t, id, 1, 3, prreview.DecisionApproved)
	return id
}

// fixed is a review whose approved findings the agent was asked to fix and
// whose changes the user staged, every one of them.
func fixed(t *testing.T, f *fixture) string {
	t.Helper()

	id := applyDecided(t, f)
	if err := f.service.Apply(t.Context(), id); err != nil {
		t.Fatalf("apply: %v", err)
	}
	f.sessions.goIdle(id)
	f.watch.setSnapshot(review.Snapshot{Head: headHash, Staged: 2, Total: 2})
	return id
}

// committing is a review whose changes the user approved.
func committing(t *testing.T, f *fixture) string {
	t.Helper()

	id := fixed(t, f)
	if err := f.service.Approve(t.Context(), id); err != nil {
		t.Fatalf("approve: %v", err)
	}
	return id
}

func TestApplyingAsksTheAgentToFixOnlyTheApprovedFindings(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := applyDecided(t, f)

	if got := f.state(t, id).Status; got != reviewflow.StatusReadyToApply {
		t.Fatalf("status = %q, want ready_to_apply", got)
	}
	if err := f.service.Apply(t.Context(), id); err != nil {
		t.Fatalf("apply: %v", err)
	}

	want := "The user decided on the findings of pass 1. Implement only the ones below, and only that: " +
		"no drive-by changes, no refactoring nobody asked for. Do not commit, do not run `git add` and do " +
		"not push: the user reviews the changes in the app. When you are done, say in a few lines what you " +
		"changed.\n\n## Approved findings\n" +
		"1. `internal/board/service.go:12` — The reading is never cached.\n" +
		"3. (general) — The name of the cache is vague."
	if got := lastMessage(t, f); got != want {
		t.Errorf("message =\n%s\n\nwant:\n%s", got, want)
	}
	if stored, _ := f.reviews.Get(id); stored.Phase != prreview.PhaseApplying {
		t.Errorf("phase = %q, want applying", stored.Phase)
	}
	if !slices.Contains(f.watch.recorded(), "track:"+id+":pr_42:true") {
		t.Errorf("watch calls = %v, want the worktree watched", f.watch.recorded())
	}
	if got := f.state(t, id).Status; got != reviewflow.StatusApplying {
		t.Errorf("status = %q, want applying while the agent works", got)
	}
}

func TestApplyRefusesAReviewThatIsNotReadyForIt(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name  string
		setup func(t *testing.T, f *fixture) string
	}{
		{"publish mode", decided},
		{"a finding still to decide", func(t *testing.T, f *fixture) string {
			t.Helper()
			id := applyDecided(t, f)
			f.decide(t, id, 1, 2, prreview.DecisionNone)
			return id
		}},
		{"nothing approved", func(t *testing.T, f *fixture) string {
			t.Helper()
			id := applyDecided(t, f)
			f.decide(t, id, 1, 1, prreview.DecisionDiscarded)
			f.decide(t, id, 1, 3, prreview.DecisionDiscarded)
			return id
		}},
		{"already applying", fixed},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			id := tc.setup(t, f)
			sent := len(f.sessions.sent())

			wantErrIs(t, f.service.Apply(t.Context(), id), reviewflow.ErrNotReady)
			if len(f.sessions.sent()) != sent {
				t.Errorf("messages = %v, want nothing sent", f.sessions.sent())
			}
		})
	}
}

func TestAnApplyThatNeverReachesTheAgentGivesTheFindingsBack(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := applyDecided(t, f)
	f.sessions.failWith(errGitHub)

	wantErrIs(t, f.service.Apply(t.Context(), id), errGitHub)

	if stored, _ := f.reviews.Get(id); stored.Phase != prreview.PhaseNone {
		t.Errorf("phase = %q, want none", stored.Phase)
	}
	if !slices.Contains(f.watch.recorded(), "forget:"+id) {
		t.Errorf("watch calls = %v, want the worktree forgotten", f.watch.recorded())
	}
	if got := f.state(t, id).Status; got != reviewflow.StatusReadyToApply {
		t.Errorf("status = %q, want ready_to_apply", got)
	}
}

func TestTheChangesOfTheAgentAreReviewedFileByFile(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := applyDecided(t, f)
	if err := f.service.Apply(t.Context(), id); err != nil {
		t.Fatalf("apply: %v", err)
	}

	f.settled(t, id)
	if !slices.Contains(f.watch.recorded(), "track:"+id+":pr_42:false") {
		t.Errorf("watch calls = %v, want the worktree watched quietly while the agent works", f.watch.recorded())
	}

	f.sessions.goIdle(id)
	f.watch.setSnapshot(review.Snapshot{Head: headHash, Staged: 1, Total: 2})
	f.settled(t, id)
	if got := f.watch.recorded(); got[len(got)-1] != "track:"+id+":pr_42:true" {
		t.Errorf("watch calls = %v, want the worktree watched for the user once the agent rests", got)
	}
	if got := f.state(t, id).Status; got != reviewflow.StatusInReview {
		t.Errorf("status = %q, want in_review", got)
	}
	wantErrIs(t, f.service.Approve(t.Context(), id), reviewflow.ErrNotReady)

	f.watch.setSnapshot(review.Snapshot{Head: headHash, Staged: 2, Total: 2})
	if got := f.state(t, id).Status; got != reviewflow.StatusReadyToApprove {
		t.Errorf("status = %q, want ready_to_approve", got)
	}
}

func TestApprovingAsksTheAgentToCommitAndPushToTheBranchOfThePullRequest(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := committing(t, f)

	stored, _ := f.reviews.Get(id)
	want := "Commit the work of dev/web#42 in " + stored.ArtifactsDir + ", push=true to cache-boards"
	if got := lastMessage(t, f); got != want {
		t.Errorf("message = %q, want %q", got, want)
	}
	if stored.Phase != prreview.PhaseCommitting {
		t.Errorf("phase = %q, want committing", stored.Phase)
	}
	if got := f.state(t, id).Status; got != reviewflow.StatusCommitting {
		t.Errorf("status = %q, want committing", got)
	}
}

func TestAnApprovalThatNeverReachesTheAgentGivesTheChangesBack(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := fixed(t, f)
	f.sessions.failWith(errGitHub)

	wantErrIs(t, f.service.Approve(t.Context(), id), errGitHub)

	if stored, _ := f.reviews.Get(id); stored.Phase != prreview.PhaseApplying {
		t.Errorf("phase = %q, want applying", stored.Phase)
	}
}

func TestACommitTurnThatLeavesNoCommitGivesTheChangesBack(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := committing(t, f)
	f.sessions.goIdle(id)

	f.evaluated(t, id, func(s reviewflow.State) bool {
		return s.CommitFailed
	}, "the commit to be found missing")

	state := f.state(t, id)
	if state.Review.Phase != prreview.PhaseApplying || state.Status != reviewflow.StatusReadyToApprove {
		t.Errorf("phase, status = %q, %q, want applying, ready_to_approve", state.Review.Phase, state.Status)
	}
	if !slices.Contains(f.watch.recorded(), "refresh:"+id) {
		t.Errorf("watch calls = %v, want a fresh reading of the worktree", f.watch.recorded())
	}
}

func TestACommitThatWentUpAsksForTheNextPass(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := committing(t, f)
	f.watch.setSnapshot(review.Snapshot{Head: commitHash})
	f.sessions.goIdle(id)

	f.evaluated(t, id, func(s reviewflow.State) bool {
		return s.Review.AskedPass == 2
	}, "the second pass to be asked for")

	state := f.state(t, id)
	if state.Review.Phase != prreview.PhaseNone || state.CommitFailed {
		t.Errorf("review = %+v, commit failed = %v, want the cycle over", state.Review, state.CommitFailed)
	}
	if !slices.Contains(f.watch.recorded(), "forget:"+id) {
		t.Errorf("watch calls = %v, want the worktree forgotten", f.watch.recorded())
	}
	if slices.ContainsFunc(f.worktrees.recorded(), func(c string) bool {
		return strings.HasPrefix(c, "updateDetached:")
	}) {
		t.Errorf("worktree calls = %v, want the worktree left on the commit that went up", f.worktrees.recorded())
	}

	want := "## Findings already applied\n" +
		"1. `internal/board/service.go:12` — The reading is never cached.\n" +
		"2. (general) — The name of the cache is vague.\n\n" +
		"## Review instructions\nnever change a published migration"
	if got := lastMessage(t, f); !strings.HasPrefix(got, "Review the pull request again") ||
		!strings.HasSuffix(got, want) {
		t.Errorf("message =\n%s\n\nwant a new pass ending with:\n%s", got, want)
	}
}

func TestACleanReportLeavesTheReviewReadyToMerge(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := committing(t, f)
	f.watch.setSnapshot(review.Snapshot{Head: commitHash})
	f.sessions.goIdle(id)
	f.evaluated(t, id, func(s reviewflow.State) bool {
		return s.Review.AskedPass == 2
	}, "the second pass to be asked for")

	f.worktrees.moveHead(commitHash)
	f.sessions.goIdle(id)
	f.writeReport(t, id, 2, reportFile("clean", "Everything was fixed."))

	f.evaluated(t, id, func(s reviewflow.State) bool {
		return s.Status == reviewflow.StatusReadyToMerge
	}, "the clean report to leave the review ready to merge")

	wantErrIs(t, f.service.Apply(t.Context(), id), reviewflow.ErrNotReady)
}

func TestAPassThatCannotBeAskedAfterACommitIsAskedAgain(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := committing(t, f)
	f.watch.setSnapshot(review.Snapshot{Head: commitHash})
	f.sessions.goIdle(id)
	f.sessions.failWith(errGitHub)

	f.settled(t, id)
	state := f.state(t, id)
	if state.Status != reviewflow.StatusCommitting || state.Review.AskedPass != 1 {
		t.Errorf("status = %q, asked pass = %d, want the review still committing on pass 1",
			state.Status, state.Review.AskedPass)
	}

	f.sessions.failWith(nil)
	f.evaluated(t, id, func(s reviewflow.State) bool {
		return s.Review.AskedPass == 2 && s.Review.Phase == prreview.PhaseNone
	}, "the second pass to be asked for on the next evaluation")
}

func TestANewPassDropsFixesTheUserDidNotKeep(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := fixed(t, f)
	f.watch.setSnapshot(review.Snapshot{Head: headHash})
	if got := f.state(t, id).Status; got != reviewflow.StatusInReview {
		t.Fatalf("status = %q, want in_review with nothing changed", got)
	}

	if err := f.service.ReviewAgain(t.Context(), id, ""); err != nil {
		t.Fatalf("review again: %v", err)
	}

	stored, _ := f.reviews.Get(id)
	if stored.Phase != prreview.PhaseNone || stored.AskedPass != 2 {
		t.Errorf("review = %+v, want the cycle over and the second pass asked for", stored)
	}
	if !slices.Contains(f.watch.recorded(), "forget:"+id) {
		t.Errorf("watch calls = %v, want the worktree forgotten", f.watch.recorded())
	}
}

func TestANewPassKeepsFixesTheWorktreeStillHolds(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := fixed(t, f)
	f.worktrees.failUpdate(worktree.ErrDirty, false)

	wantErrIs(t, f.service.ReviewAgain(t.Context(), id, ""), worktree.ErrDirty)

	stored, _ := f.reviews.Get(id)
	if stored.Phase != prreview.PhaseApplying || stored.AskedPass != 1 {
		t.Errorf("review = %+v, want the fixes still under review", stored)
	}
}

func TestANewPassThatNeverReachesTheAgentKeepsTheFixes(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := fixed(t, f)
	f.sessions.failWith(errGitHub)

	wantErrIs(t, f.service.ReviewAgain(t.Context(), id, ""), errGitHub)

	if stored, _ := f.reviews.Get(id); stored.Phase != prreview.PhaseApplying {
		t.Errorf("phase = %q, want applying", stored.Phase)
	}
	if got := f.watch.recorded(); got[len(got)-1] != "track:"+id+":pr_42:true" {
		t.Errorf("watch calls = %v, want the worktree watched again", got)
	}
}

func TestANewPassWaitsForTheCommit(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := committing(t, f)
	f.sessions.goIdle(id)

	wantErrIs(t, f.service.ReviewAgain(t.Context(), id, ""), reviewflow.ErrPassRunning)
}
