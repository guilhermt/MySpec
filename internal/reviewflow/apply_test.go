package reviewflow_test

import (
	"slices"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/prreport"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/reviewflow"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/worktree"
)

// commitHash is the commit the agent leaves on the worktree when it commits
// the fixes.
const commitHash = "ccc3333"

// applyDecided is a review in apply mode whose first pass was recorded and
// whose findings the user decided on: two approved, one discarded.
func applyDecided(t *testing.T, f *fixture) string {
	t.Helper()

	return applyDecidedOn(t, f, headHash)
}

// applyDecidedOn is applyDecided with the pass recorded on commit, "" for a
// pass whose commit git could not say.
func applyDecidedOn(t *testing.T, f *fixture, commit string) string {
	t.Helper()

	f.pulls.seed(ownPR())
	id := f.startMode(t, prreview.ModeApply, "")
	f.sessions.goIdle(id)
	f.record(t, id, changesReport(1, "Three things to fix.",
		prreport.ParsedFinding{Number: 1, Path: "internal/board/service.go", Line: 12, Text: "The reading is never cached."},
		prreport.ParsedFinding{Number: 2, Text: "The cache has no test."},
		prreport.ParsedFinding{Number: 3, Text: "The name of the cache is vague."},
	), commit)
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
		"changed.\n\n## Approved findings\n\n" +
		"### 1\nLocation: internal/board/service.go:12\n\nThe reading is never cached.\n\n" +
		"### 3\nLocation: general\n\nThe name of the cache is vague.\n\n" +
		"## Discarded findings\n\n" +
		"The user decided not to act on these. Do not report them again in a later pass unless the code " +
		"they point at changes.\n\n- 2 · general"
	if got := lastMessage(t, f); got != want {
		t.Errorf("message =\n%s\n\nwant:\n%s", got, want)
	}
	wantLastApp(t, f, session.AppMessage{Kind: session.AppApply, Count: 2})
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
	wantLastApp(t, f, session.AppMessage{Kind: session.AppCommitPush})
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

// committingWithoutPassCommit is a review whose changes the user approved,
// fixing a pass whose commit git could not say.
func committingWithoutPassCommit(t *testing.T, f *fixture) string {
	t.Helper()

	id := applyDecidedOn(t, f, "")
	if err := f.service.Apply(t.Context(), id); err != nil {
		t.Fatalf("apply: %v", err)
	}
	f.sessions.goIdle(id)
	f.watch.setSnapshot(review.Snapshot{Head: headHash, Staged: 2, Total: 2})
	if err := f.service.Approve(t.Context(), id); err != nil {
		t.Fatalf("approve: %v", err)
	}
	return id
}

func TestACommitTurnThatLeavesNoCommitIsToldWhenThePassRecordedNoCommit(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := committingWithoutPassCommit(t, f)
	f.sessions.goIdle(id)

	f.evaluated(t, id, func(s reviewflow.State) bool {
		return s.CommitFailed
	}, "the commit to be found missing against the head read at the approval")

	state := f.state(t, id)
	if state.Review.Phase != prreview.PhaseApplying || state.Review.AskedPass != 1 {
		t.Errorf("review = %+v, want the changes given back and no pass asked for", state.Review)
	}
	if passes := f.reviews.Passes(id); passes[0].Applied {
		t.Errorf("passes = %+v, want the fixes of the first one not counted as applied", passes)
	}
}

func TestACommitIsToldAgainstTheHeadReadAtTheApprovalWhenThePassRecordedNoCommit(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := committingWithoutPassCommit(t, f)
	f.watch.setSnapshot(review.Snapshot{Head: commitHash})
	f.sessions.goIdle(id)

	f.evaluated(t, id, func(s reviewflow.State) bool {
		return s.Review.AskedPass == 2
	}, "the second pass to be asked for")

	if passes := f.reviews.Passes(id); !passes[0].Applied {
		t.Errorf("passes = %+v, want the first one applied", passes)
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
	f.pulls.seed(withChecks(ownPR(), gh.MergeableClean, passedCheck))
	f.polled(t, id, func(s reviewflow.State) bool {
		return s.Review.Phase == prreview.PhaseNone
	}, "the second pass to start once the checks passed")

	state := f.state(t, id)
	if state.Review.Phase != prreview.PhaseNone || state.CommitFailed {
		t.Errorf("review = %+v, commit failed = %v, want the cycle over", state.Review, state.CommitFailed)
	}
	if passes := f.reviews.Passes(id); !passes[0].Applied || passes[1].Applied {
		t.Errorf("passes = %+v, want the first one applied and the second one not", passes)
	}
	if !slices.Contains(f.watch.recorded(), "forget:"+id) {
		t.Errorf("watch calls = %v, want the worktree forgotten", f.watch.recorded())
	}

	want := "## Findings already applied\n" +
		"1. `internal/board/service.go:12` — The reading is never cached.\n" +
		"2. (general) — The name of the cache is vague.\n\n" +
		"## GitHub status\n- Checks: 1 check passed.\n- Base: the branch merges clean into `main`.\n\n" +
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
	f.pulls.seed(withChecks(ownPR(), gh.MergeableClean, passedCheck))
	f.polled(t, id, func(s reviewflow.State) bool {
		return s.Review.Phase == prreview.PhaseNone
	}, "the second pass to start once the checks passed")

	f.worktrees.moveHead(commitHash)
	f.sessions.goIdle(id)
	f.writeReport(t, id, 2, reportFile("clean", "Everything was fixed."))

	f.evaluated(t, id, func(s reviewflow.State) bool {
		return s.Status == reviewflow.StatusReadyToMerge
	}, "the clean report to leave the review ready to merge")

	wantErrIs(t, f.service.Apply(t.Context(), id), reviewflow.ErrNotReady)
}

func TestAPassThatCannotBeSentAfterACommitIsBlockedUntilAskedAgain(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := committing(t, f)
	f.watch.setSnapshot(review.Snapshot{Head: commitHash})
	f.sessions.goIdle(id)
	f.evaluated(t, id, func(s reviewflow.State) bool {
		return s.Status == reviewflow.StatusWaitingChecks
	}, "the second pass to wait for the checks")

	f.sessions.failWith(errGitHub)
	f.pulls.seed(withChecks(ownPR(), gh.MergeableClean, passedCheck))
	f.polled(t, id, func(s reviewflow.State) bool {
		return s.Status == reviewflow.StatusPassBlocked
	}, "the pass that never reached the agent to be blocked")
	if state := f.state(t, id); state.Review.AskedPass != 2 || state.PassBlocked == "" {
		t.Errorf("review = %+v, blocked = %q, want the second pass still asked for, with the reason",
			state.Review, state.PassBlocked)
	}

	f.sessions.failWith(nil)
	if err := f.service.ReviewAgain(t.Context(), id, ""); err != nil {
		t.Fatalf("review again: %v", err)
	}
	state := f.state(t, id)
	if state.Review.AskedPass != 2 || state.Review.Phase != prreview.PhaseNone || state.PassBlocked != "" {
		t.Errorf("review = %+v, blocked = %q, want the second pass sent", state.Review, state.PassBlocked)
	}
	if got := lastMessage(t, f); !strings.Contains(got, "It is pass 2.") {
		t.Errorf("message =\n%s\n\nwant the second pass", got)
	}
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

// secondPass is a review whose first pass went through the cycle that fixes
// the approved findings and whose second pass, on the commit that went up,
// was recorded with one finding approved.
func secondPass(t *testing.T, f *fixture) string {
	t.Helper()

	return secondPassOn(t, f, commitHash)
}

// secondPassOn is secondPass with the second pass recorded on the commit
// given, which is "" when git could not say the head of the worktree.
func secondPassOn(t *testing.T, f *fixture, commit string) string {
	t.Helper()

	id := committing(t, f)
	f.watch.setSnapshot(review.Snapshot{Head: commitHash})
	f.sessions.goIdle(id)
	f.evaluated(t, id, func(s reviewflow.State) bool {
		return s.Review.AskedPass == 2
	}, "the second pass to be asked for")
	f.pulls.seed(withChecks(ownPR(), gh.MergeableClean, passedCheck))
	f.polled(t, id, func(s reviewflow.State) bool {
		return s.Review.Phase == prreview.PhaseNone
	}, "the second pass to start once the checks passed")
	f.sessions.goIdle(id)
	f.record(t, id, changesReport(2, "One thing left.",
		prreport.ParsedFinding{Number: 1, Text: "The cache is never emptied."},
	), commit)
	f.decide(t, id, 2, 1, prreview.DecisionApproved)
	return id
}

func TestOnlyTheFindingsWhoseFixesWentUpAreListedAsApplied(t *testing.T) {
	t.Parallel()

	appliedFirst := "## Findings already applied\n" +
		"1. `internal/board/service.go:12` — The reading is never cached.\n" +
		"2. (general) — The name of the cache is vague.\n\n"
	cases := map[string]struct {
		setup func(t *testing.T, f *fixture) string
		want  string
	}{
		"approved but never applied": {
			setup: applyDecided,
			want:  "## Findings already applied\nNone.\n\n",
		},
		"fixes the user dropped": {
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()

				id := fixed(t, f)
				f.watch.setSnapshot(review.Snapshot{Head: headHash})
				return id
			},
			want: "## Findings already applied\nNone.\n\n",
		},
		"a pass never applied, before another": {
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()

				id := applyDecided(t, f)
				if err := f.service.ReviewAgain(t.Context(), id, ""); err != nil {
					t.Fatalf("review again: %v", err)
				}
				f.sessions.goIdle(id)
				f.record(t, id, cleanReport(2, "Nothing left."), headHash)
				return id
			},
			want: "## Findings already applied\nNone.\n\n",
		},
		"fixes committed, and a pass after them not applied": {
			setup: secondPass,
			want:  appliedFirst,
		},
		"a commit the user pushed between passes": {
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()

				id := applyDecided(t, f)
				f.worktrees.moveHead(otherHash)
				if err := f.service.ReviewAgain(t.Context(), id, ""); err != nil {
					t.Fatalf("review again: %v", err)
				}
				f.sessions.goIdle(id)
				f.record(t, id, cleanReport(2, "Nothing left."), otherHash)
				return id
			},
			want: "## Findings already applied\nNone.\n\n",
		},
		"fixes committed, and a pass after them git could not say the head of": {
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()

				return secondPassOn(t, f, "")
			},
			want: appliedFirst,
		},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			id := c.setup(t, f)

			if err := f.service.ReviewAgain(t.Context(), id, ""); err != nil {
				t.Fatalf("review again: %v", err)
			}
			if got := lastMessage(t, f); !strings.Contains(got, c.want) {
				t.Errorf("message =\n%s\n\nwant it to hold:\n%s", got, c.want)
			}
		})
	}
}

func TestApplyingRecordsWhenTheApprovedFindingsWentToTheAgent(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := applyDecided(t, f)
	if !f.pass(t, id, 1).SentAt.IsZero() {
		t.Fatal("the pass has an hour of sending before it was sent")
	}

	if err := f.service.Apply(t.Context(), id); err != nil {
		t.Fatalf("apply: %v", err)
	}

	if f.pass(t, id, 1).SentAt.IsZero() {
		t.Error("the pass kept no hour for the moment the findings went")
	}
}

func TestApplyingMarksHowManyFindingsTheUserApprovedAndDiscarded(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := applyDecided(t, f)

	if err := f.service.Apply(t.Context(), id); err != nil {
		t.Fatalf("apply: %v", err)
	}

	pass := f.pass(t, id, 1)
	var approved, discarded int
	for _, finding := range pass.Findings {
		switch finding.Decision {
		case prreview.DecisionApproved:
			approved++
		case prreview.DecisionDiscarded:
			discarded++
		case prreview.DecisionNone:
		}
	}
	want := []session.MarkerEntry{
		{Type: session.MarkerFindingsDecided, Pass: 1, Approved: approved, Discarded: discarded},
	}
	if diff := cmp.Diff(want, f.sessions.markersOf(session.MarkerFindingsDecided)); diff != "" {
		t.Errorf("findings_decided markers (-want +got):\n%s", diff)
	}
}

func TestApprovingMarksTheChangesApproved(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := committing(t, f)

	total := f.state(t, id).Watch.Total
	want := []session.MarkerEntry{{Type: session.MarkerChangesApproved, Files: total}}
	if diff := cmp.Diff(want, f.sessions.markersOf(session.MarkerChangesApproved)); diff != "" {
		t.Errorf("changes_approved markers (-want +got):\n%s", diff)
	}
}

func TestACommitThatWentUpIsMarkedWithItsSubjectAndThePullRequest(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name      string
		commitErr error
		subject   string
	}{
		{"read", nil, "Fix the time zone rule"},
		// The commit is a fact of the branch; its subject is a nicety.
		{"unreadable", errGit, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			id := committing(t, f)
			f.worktrees.commitErr = c.commitErr
			f.watch.setSnapshot(review.Snapshot{Head: commitHash})
			f.sessions.goIdle(id)

			f.evaluated(t, id, func(s reviewflow.State) bool {
				return s.Review.AskedPass == 2
			}, "the second pass to be asked for")
			f.committedMarked(t, 1)

			want := []session.MarkerEntry{{
				Type: session.MarkerCommitted, SHA: task.ShortSHA(commitHash), Subject: c.subject, Pushed: true, Number: 42,
			}}
			if diff := cmp.Diff(want, f.sessions.markersOf(session.MarkerCommitted)); diff != "" {
				t.Errorf("committed markers (-want +got):\n%s", diff)
			}
		})
	}
}

func TestACommitIsMarkedOnlyOnceThePassAfterItIsRecorded(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		fail func(*memReviewStore, error)
	}{
		{"the pass is not marked applied", (*memReviewStore).failUpsertPass},
		{"the next pass is not asked for", (*memReviewStore).failUpdate},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			id := committing(t, f)
			f.watch.setSnapshot(review.Snapshot{Head: commitHash})
			f.sessions.goIdle(id)
			c.fail(f.store, errStore)

			f.settled(t, id)
			if got := f.sessions.markersOf(session.MarkerCommitted); len(got) != 0 {
				t.Fatalf("committed markers = %+v, want none while the store fails", got)
			}

			c.fail(f.store, nil)
			f.evaluated(t, id, func(s reviewflow.State) bool {
				return s.Review.Phase == prreview.PhaseWaitingChecks
			}, "the second pass to wait for the checks")
			f.committedMarked(t, 1)
			if got := f.sessions.markersOf(session.MarkerCommitted); len(got) != 1 {
				t.Errorf("committed markers = %+v, want one", got)
			}
		})
	}
}
