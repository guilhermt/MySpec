package flow_test

import (
	"errors"
	"fmt"
	"slices"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/divergence"
	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

// unpushed puts task-1 under a review whose commit is not on the remote.
func unpushed(t *testing.T, f *fixture) {
	t.Helper()

	structured(t, f, sentPass(decidedPass(1, approved)))
	f.worktrees.setNotPushed(true)
}

// pushRejected is what git says when the remote refuses a push.
func pushRejected() error {
	return fmt.Errorf("%w: ! [rejected] HEAD -> task-1 (fetch first)", git.ErrPushRejected)
}

func TestACommitOfTheReviewThatIsNotOnThePullRequestIsPushed(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	unpushed(t, f)

	f.service.Check("task-1")

	waitFor(t, "the push", func() bool { return len(f.worktrees.pushed()) == 1 })
	f.waitPRStatus(t, "task-1", task.PRReviewing)
	if diff := cmp.Diff([]string{"task-1"}, f.worktrees.pushed()); diff != "" {
		t.Errorf("pushes mismatch (-want +got):\n%s", diff)
	}
	f.wantNoDivergence(t)
}

func TestTheReviewPushesToTheBranchOfThePullRequest(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	unpushed(t, f)
	run, _ := f.tasks.prRun("task-1")
	run.PR.Head = "feature/login"
	f.tasks.setPRRun("task-1", run)

	f.service.Check("task-1")

	waitFor(t, "the push", func() bool { return len(f.worktrees.pushed()) == 1 })
	if diff := cmp.Diff([]string{"feature/login"}, f.worktrees.pushed()); diff != "" {
		t.Errorf("pushes mismatch (-want +got):\n%s", diff)
	}
}

func TestAPushedCommitIsNotPushedAgain(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, sentPass(decidedPass(1, approved)))

	f.service.Check("task-1")
	f.waitEvaluations(t, 1)

	if pushed := f.worktrees.pushed(); len(pushed) != 0 {
		t.Errorf("pushes = %q, want none", pushed)
	}
}

func TestAReadingOfTheRemoteThatFailsPushesNothing(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	unpushed(t, f)
	f.worktrees.failPushed(errors.New("git: not a repository"))

	f.service.Check("task-1")
	f.waitEvaluations(t, 1)

	if pushed := f.worktrees.pushed(); len(pushed) != 0 {
		t.Errorf("pushes = %q, want none", pushed)
	}
}

func TestAPushTheRemoteRefusesIsADivergenceOfTheReview(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	unpushed(t, f)
	f.worktrees.failPush(pushRejected())

	f.service.Check("task-1")

	d := f.waitDivergence(t, divergence.KindPushRejected)
	f.waitPRStatus(t, "task-1", task.PRReviewing)
	f.wantDivergence(t, session.PRReviewStage, divergence.KindPushRejected, divergence.Facts{
		Branch: "task-1", Commit: task.ShortSHA(startCommit), Reason: d.Facts.Reason,
	})
	if d.Facts.Reason == "" {
		t.Error("the divergence says nothing of what git said")
	}

	// The same commit is not offered to the remote again by itself.
	f.service.Check("task-1")
	f.waitEvaluations(t, 2)
	if got := countCalls(f.worktrees.recorded(), "push:task-1:task-1"); got != 1 {
		t.Errorf("pushes = %d, want the refused one only", got)
	}
}

func TestCheckingAgainAfterARefusedPushTriesItOnce(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	unpushed(t, f)
	f.worktrees.failPush(pushRejected())
	f.service.Check("task-1")
	f.waitDivergence(t, divergence.KindPushRejected)
	f.waitPRStatus(t, "task-1", task.PRReviewing)

	// The remote takes the commit now.
	f.worktrees.failPush(nil)
	if err := f.service.CheckAgain(t.Context(), "task-1"); err != nil {
		t.Fatalf("CheckAgain() = %v, want nil", err)
	}

	waitFor(t, "the push", func() bool { return len(f.worktrees.pushed()) == 1 })
	waitFor(t, "the divergence to end", func() bool {
		_, ok := f.divergences.Get("task-1")
		return !ok
	})
}

func TestAPushThatFailsBlocksThePullRequestAndRetryingPushesAgain(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	unpushed(t, f)
	f.worktrees.failPush(errors.New("git: network is unreachable"))

	f.service.Check("task-1")

	f.waitPRStatus(t, "task-1", task.PRBlocked)
	if run, _ := f.tasks.prRun("task-1"); run.Block == nil || run.Block.Reason != task.PRBlockPushFailed {
		t.Fatalf("block = %+v, want push_failed", run.Block)
	}

	f.worktrees.failPush(nil)
	if err := f.service.RetryPR(t.Context(), "task-1"); err != nil {
		t.Fatalf("RetryPR() = %v, want nil", err)
	}

	waitFor(t, "the push", func() bool { return len(f.worktrees.pushed()) == 1 })
	f.waitPRStatus(t, "task-1", task.PRReviewing)
	if calls := f.tasks.recorded(); !slices.Contains(calls, "pr:pushing:task-1") {
		t.Errorf("task calls = %q, want the pushing recorded", calls)
	}
}

func TestAPullRequestBeingPushedIsShownAsPushingInTheReviewConversation(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, sentPass(decidedPass(1, approved)))
	f.tasks.setPRRun("task-1", task.PRRun{
		Status: task.PRPushing, PR: openPR(), ReportedPass: 1, ReviewedCommit: startCommit,
	})

	got := f.prState(t, "task-1")

	if got.Status != flow.PRPushing || got.SessionStage != session.PRReviewStage {
		t.Errorf("status = %q in %q, want pushing in the review conversation", got.Status, got.SessionStage)
	}
}

func TestAPushTheAppWasClosedInTheMiddleOfIsDoneAgain(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	unpushed(t, f)
	f.tasks.setPRRun("task-1", task.PRRun{
		Status: task.PRPushing, PR: openPR(), ReportedPass: 1, ReviewedCommit: startCommit,
	})

	f.service.Sync(t.Context())

	waitFor(t, "the push", func() bool { return len(f.worktrees.pushed()) == 1 })
	f.waitPRStatus(t, "task-1", task.PRReviewing)
}

func TestACommitTurnThatCommitsNothingAsksAgainWithTheCommitPrompt(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, sentPass(decidedPass(1, approved)))
	f.tasks.setPRRun("task-1", task.PRRun{
		Status: task.PRCommitting, PR: openPR(), ReportedPass: 1, ReviewedCommit: startCommit,
	})
	implementerAtRest(f)
	f.reviews.setSnapshot(staged(3, 3))

	f.service.Check("task-1")

	f.waitDivergence(t, divergence.KindCommitMissing)
	f.wantDivergence(t, session.PRFixStage, divergence.KindCommitMissing, divergence.Facts{
		Branch: "task-1", Commit: task.ShortSHA(startCommit), Files: 3,
	})
	if err := f.service.AskAgain(t.Context(), "task-1"); err != nil {
		t.Fatalf("AskAgain() = %v, want nil", err)
	}

	f.wantNoDivergence(t)
	if run, _ := f.tasks.prRun("task-1"); run.Status != task.PRCommitting {
		t.Errorf("status = %q, want committing", run.Status)
	}
	if diff := cmp.Diff([]session.AppMessage{{Kind: session.AppCommit}}, f.sessions.sentApps()); diff != "" {
		t.Errorf("app messages mismatch (-want +got):\n%s", diff)
	}
}

func TestAskingForTheCommitAgainNeedsTheChangesStaged(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, sentPass(decidedPass(1, approved)))
	implementerAtRest(f)
	f.reviews.setSnapshot(staged(1, 3))
	if _, err := f.divergences.Open(t.Context(), divergence.Divergence{
		ItemID: "task-1", Stage: session.PRFixStage, Kind: divergence.KindCommitMissing,
		Facts: divergence.Facts{Branch: "task-1", Files: 3},
	}); err != nil {
		t.Fatalf("open divergence: %v", err)
	}

	wantErrIs(t, f.service.AskAgain(t.Context(), "task-1"), flow.ErrStepNotReady)

	if sent := f.sessions.sent(); len(sent) != 0 {
		t.Errorf("sent = %q, want nothing", sent)
	}
}

func TestAskingForTheCommitAgainInTheAgentReviewCommitsEverything(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	agentReview(t, f, cleanPass(1))
	f.tasks.setPRRun("task-1", task.PRRun{
		Status: task.PRCommitting, PR: openPR(), ReportedPass: 1, ReviewedCommit: startCommit,
	})
	implementerAtRest(f)
	dirtyWorktree(f)
	unmoved := reviewed(1, 1)
	unmoved.Head = startCommit
	f.reviews.setSnapshot(unmoved)
	f.service.Check("task-1")
	f.waitDivergence(t, divergence.KindCommitMissing)

	if err := f.service.AskAgain(t.Context(), "task-1"); err != nil {
		t.Fatalf("AskAgain() = %v, want nil", err)
	}

	if diff := cmp.Diff([]session.AppMessage{{Kind: session.AppCommitAll}}, f.sessions.sentApps()); diff != "" {
		t.Errorf("app messages mismatch (-want +got):\n%s", diff)
	}
}
