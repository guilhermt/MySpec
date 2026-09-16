package flow_test

import (
	"slices"
	"testing"

	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

// startCommit is the commit the worktree of a step is on when it starts, and
// commitSHA is the one the agent leaves behind.
const (
	startCommit = "1111111111111111111111111111111111111111"
	commitSHA   = "2222222222222222222222222222222222222222"
)

// staged is a reading of the worktree of a step that has not committed yet:
// the branch is where the step started, with staged of total files read.
func staged(count, total int) review.Snapshot {
	snap := reviewed(count, total)
	snap.Head = startCommit
	return snap
}

// readyToApprove brings a task to a step the user is reading: the agent has
// stopped, the worktree is on the commit the step started from, and the
// reading of it is what the test says.
func readyToApprove(t *testing.T, f *fixture, plan task.Plan, snap review.Snapshot) {
	t.Helper()

	f.worktrees.setStatus(git.Status{Head: startCommit})
	f.reviews.setSnapshot(snap)
	implementing(f, "task-1", plan)
	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepImplementing)
	f.waitStepSession(t, "task-1", 1)
	f.sessions.goIdle("task-1")
}

func TestAStepIsNotApprovedBeforeItIsWholeRead(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		snap review.Snapshot
		read bool
	}{
		{"part of it read", staged(2, 3), true},
		{"nothing read yet", staged(0, 3), true},
		{"the agent touched nothing", review.Snapshot{Head: startCommit}, true},
		{"the worktree could not be read", review.Snapshot{Err: "git status: no such file"}, true},
		{"no reading has landed", review.Snapshot{}, false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			if test.read {
				f.reviews.setSnapshot(test.snap)
			}
			f.worktrees.setStatus(git.Status{Head: startCommit})
			implementing(f, "task-1", twoStepPlan())
			f.service.Sync(t.Context())
			f.waitStep(t, "task-1", 1, flow.StepImplementing)
			f.waitStepSession(t, "task-1", 1)
			f.sessions.goIdle("task-1")

			wantErrIs(t, f.service.ApproveStep(t.Context(), "task-1"), flow.ErrStepNotReady)
			if sent := f.sessions.sent(); len(sent) != 0 {
				t.Errorf("messages = %q, want none: nothing was approved", sent)
			}
		})
	}
}

func TestAStepIsNotApprovedWhileTheAgentWorks(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	readyToApprove(t, f, twoStepPlan(), staged(3, 3))
	f.sessions.setSummary("task-1", session.Summary{
		Stage: session.StepStage(1), Status: session.StatusWorking, TurnRunning: true,
	})

	wantErrIs(t, f.service.ApproveStep(t.Context(), "task-1"), flow.ErrStepBusy)

	run, ok := f.tasks.stepRun("task-1", 1)
	if !ok || run.Status != task.StepStarted {
		t.Errorf("step run = %+v, want it still started", run)
	}
}

func TestAStepThatHasNotStartedIsNotApproved(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.reviews.setSnapshot(staged(3, 3))
	implementing(f, "task-1", twoStepPlan())
	f.tasks.setRun("task-1", task.StepRun{Number: 1, Status: task.StepPreparing})

	wantErrIs(t, f.service.ApproveStep(t.Context(), "task-1"), flow.ErrStepNotStarted)
}

func TestApprovingAStepSendsTheCommitPromptAsAMessageOfTheApp(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	readyToApprove(t, f, twoStepPlan(), staged(3, 3))

	if err := f.service.ApproveStep(t.Context(), "task-1"); err != nil {
		t.Fatalf("ApproveStep() = %v, want nil", err)
	}

	if want := []string{commitPrompt("task-1", false)}; !slices.Equal(f.sessions.sent(), want) {
		t.Errorf("messages = %q, want %q", f.sessions.sent(), want)
	}
	// The commit prompt is not a correction: it must not count against the
	// corrections the app allows itself.
	sum, _ := f.sessions.Summary(session.Key{TaskID: "task-1", Stage: session.StepStage(1)})
	if sum.Corrections != 0 {
		t.Errorf("corrections = %d, want 0: approving is not a correction", sum.Corrections)
	}
	if state := f.stepState(t, "task-1", 1); state.Status != flow.StepCommitting {
		t.Errorf("status = %q, want committing", state.Status)
	}
}

func TestAnApprovalThatCannotBeSentLeavesTheStepWhereItWas(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	readyToApprove(t, f, twoStepPlan(), staged(3, 3))
	f.sessions.failWith(errStart)

	wantErrIs(t, f.service.ApproveStep(t.Context(), "task-1"), errStart)

	// The button is still there for the user: the step is theirs again.
	if state := f.stepState(t, "task-1", 1); state.Status != flow.StepReadyToApprove {
		t.Errorf("status = %q, want ready_to_approve", state.Status)
	}
}

func TestApprovingAPausedTaskResumesItFirst(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	readyToApprove(t, f, twoStepPlan(), staged(3, 3))
	f.sessions.setSummary("task-1", session.Summary{Stage: session.StepStage(1), Status: session.StatusPaused})

	if err := f.service.ApproveStep(t.Context(), "task-1"); err != nil {
		t.Fatalf("ApproveStep() = %v, want nil", err)
	}

	calls := f.sessions.recorded()
	resume, send := slices.Index(calls, "resume:task-1:step:1"), slices.Index(calls, "send:task-1:step:1")
	if resume < 0 || send < 0 || resume > send {
		t.Errorf("session calls = %q, want the task resumed before the prompt goes out", calls)
	}
}

func TestAStepIsConcludedWhenItsBranchMovesAndTheNextOneIsPrepared(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	readyToApprove(t, f, twoStepPlan(), staged(3, 3))
	if err := f.service.ApproveStep(t.Context(), "task-1"); err != nil {
		t.Fatalf("ApproveStep() = %v, want nil", err)
	}

	// The agent commits and stops. Only the session of that step goes idle: the
	// evaluation Sync queued may still be waiting for the lock the approval
	// took, and if it runs between the commit and the stop it concludes the step
	// on the commit alone and opens the session of the next step, which is still
	// working.
	f.reviews.setSnapshot(review.Snapshot{Head: commitSHA})
	f.sessions.goIdleSession(session.Key{TaskID: "task-1", Stage: session.StepStage(1)})
	f.service.Check("task-1")

	f.waitStep(t, "task-1", 1, flow.StepDone)
	state := f.stepState(t, "task-1", 1)
	if state.CommitSHA != commitSHA || state.CommitSubject != "Do the work of the step" {
		t.Errorf("commit = %q %q, want the one the step produced", state.CommitSHA, state.CommitSubject)
	}
	// The commit is recorded before the worktree of the step is forgotten, so
	// the step reads done while the forget can still be on its way.
	waitFor(t, "the worktree of step 1 to be forgotten", func() bool {
		return slices.Contains(f.reviews.reviewCalls(), "forget:task-1")
	})

	// The step after it takes over, in the worktree of its own repository.
	f.waitStep(t, "task-1", 2, flow.StepImplementing)
	f.waitWorktreeCalls(
		t,
		"ensure:task-1:dev/web", "status:task-1:task-1",
		"commit:task-1:"+commitSHA,
		"ensure:task-1:dev/web", "status:task-1:task-1",
	)
}

func TestTheLastStepOfAPlanIsConcludedWithNothingAfterIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	readyToApprove(t, f, plan(), staged(3, 3))
	if err := f.service.ApproveStep(t.Context(), "task-1"); err != nil {
		t.Fatalf("ApproveStep() = %v, want nil", err)
	}

	f.reviews.setSnapshot(review.Snapshot{Head: commitSHA})
	f.sessions.goIdle("task-1")
	f.service.Check("task-1")

	f.waitStep(t, "task-1", 1, flow.StepDone)
	if runs := f.tasks.StepRuns("task-1"); len(runs) != 1 {
		t.Errorf("step runs = %d, want only the one the plan has", len(runs))
	}
	// The conversation of a step that is over takes no more messages. The
	// commit is recorded before the session is closed, so the step reads done
	// while the close can still be on its way.
	waitFor(t, "the session of step 1 to be closed", func() bool {
		return slices.Contains(f.sessions.recorded(), "close:task-1:step:1")
	})
}

func TestACommitTurnThatEndsWithoutACommitGivesTheStepBack(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	readyToApprove(t, f, twoStepPlan(), staged(3, 3))
	if err := f.service.ApproveStep(t.Context(), "task-1"); err != nil {
		t.Fatalf("ApproveStep() = %v, want nil", err)
	}

	// The agent stops with the branch exactly where it was.
	f.sessions.goIdle("task-1")
	f.service.Check("task-1")

	f.waitStep(t, "task-1", 1, flow.StepReadyToApprove)
	// The decision is taken on a reading newer than the turn, not on one the
	// debounce still owes.
	if !slices.Contains(f.reviews.reviewCalls(), "refresh:task-1") {
		t.Errorf("review calls = %q, want the worktree read again", f.reviews.reviewCalls())
	}
	// The step is given back before the missing commit is recorded, so it reads
	// ready to approve while the warning can still be on its way.
	waitFor(t, "the user to be told the commit did not happen", func() bool {
		return f.stepState(t, "task-1", 1).CommitFailed
	})

	// Approving again clears the warning.
	if err := f.service.ApproveStep(t.Context(), "task-1"); err != nil {
		t.Fatalf("ApproveStep() = %v, want nil", err)
	}
	if state := f.stepState(t, "task-1", 1); state.CommitFailed {
		t.Error("CommitFailed = true, want it cleared by the new approval")
	}
}
