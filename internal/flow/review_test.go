package flow_test

import (
	"slices"
	"testing"

	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/task"
)

// reviewed is a reading of a worktree with staged of total files under review.
func reviewed(staged, total int) review.Snapshot {
	snap := review.Snapshot{Staged: staged, Total: total, Head: "head-sha"}
	for i := range total {
		snap.Files = append(snap.Files, review.File{
			Path:   "file" + string(rune('a'+i)) + ".go",
			Kind:   git.KindModified,
			Staged: i < staged,
		})
	}
	return snap
}

// awaitingReview brings a task to a step whose agent has presented its
// summary, which is where every review test starts.
func awaitingReview(t *testing.T, f *fixture) {
	t.Helper()

	implementing(f, "task-1", twoStepPlan())
	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepImplementing)
	f.waitStepSession(t, "task-1", 1)
	f.sessions.goIdle("task-1")
}

func TestTheStateOfAStepUnderReviewComesFromTheLastReading(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		snap review.Snapshot
		want flow.StepStatus
	}{
		{"nothing staged yet", reviewed(0, 3), flow.StepAwaitingReview},
		{"part of it read", reviewed(1, 3), flow.StepInReview},
		{"everything staged", reviewed(3, 3), flow.StepReadyToApprove},
		{"the agent touched nothing", review.Snapshot{}, flow.StepNothingToCommit},
		{"the worktree could not be read", review.Snapshot{Err: "git status: no such file"}, flow.StepReviewFailed},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			f.reviews.setSnapshot(test.snap)
			awaitingReview(t, f)

			state := f.stepState(t, "task-1", 1)
			if state.Status != test.want {
				t.Errorf("status = %q, want %q", state.Status, test.want)
			}
			if state.Review == nil {
				t.Fatal("Review is nil, want the reading the state was derived from")
			}
			if state.Review.Staged != test.snap.Staged || state.Review.Total != test.snap.Total {
				t.Errorf("Review = %+v, want %+v", *state.Review, test.snap)
			}
		})
	}
}

func TestAStepWithNoReadingYetIsSimplyAwaitingReview(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	awaitingReview(t, f)

	state := f.stepState(t, "task-1", 1)
	if state.Status != flow.StepAwaitingReview {
		t.Errorf("status = %q, want awaiting_review", state.Status)
	}
	// No number is better than a zero one: the reading is on its way.
	if state.Review != nil {
		t.Errorf("Review = %+v, want nil until the worktree is read", *state.Review)
	}
}

func TestTheProgressIsNotShownWhileTheAgentWorks(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.reviews.setSnapshot(reviewed(2, 3))
	implementing(f, "task-1", twoStepPlan())

	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepImplementing)

	state := f.stepState(t, "task-1", 1)
	if state.Review != nil {
		t.Errorf("Review = %+v, want nil while the work is not stopped", *state.Review)
	}
}

func TestACommittedStepIsDoneWithItsCommit(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())
	f.tasks.setRun("task-1", task.StepRun{
		Number: 1, Status: task.StepDone,
		StartCommit: "1111111", CommitSHA: "2222222", CommitSubject: "Add the login screen",
	})

	state := f.stepState(t, "task-1", 1)
	if state.Status != flow.StepDone {
		t.Errorf("status = %q, want done", state.Status)
	}
	if state.CommitSHA != "2222222" || state.CommitSubject != "Add the login screen" {
		t.Errorf("commit = %q %q, want what the step produced", state.CommitSHA, state.CommitSubject)
	}
	if state.Review != nil {
		t.Errorf("Review = %+v, want nil on a step that is over", *state.Review)
	}

	// The step that runs next is the first one without a commit.
	current, ok := f.service.CurrentStep("task-1")
	if !ok || current.Step.Number != 2 {
		t.Errorf("CurrentStep() = %+v, %v, want step 2", current, ok)
	}
}

func TestAStepWaitingForItsCommitCarriesTheReading(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.reviews.setSnapshot(reviewed(3, 3))
	implementing(f, "task-1", twoStepPlan())
	f.tasks.setRun("task-1", task.StepRun{Number: 1, Status: task.StepCommitting, StartCommit: "1111111"})

	state := f.stepState(t, "task-1", 1)
	if state.Status != flow.StepCommitting {
		t.Errorf("status = %q, want committing", state.Status)
	}
	if state.Review == nil || state.Review.Total != 3 {
		t.Errorf("Review = %+v, want the reading of the worktree", state.Review)
	}
}

func TestAStartedStepRecordsTheCommitItsWorktreeIsOn(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.worktrees.setStatus(git.Status{Head: "1111111111111111111111111111111111111111"})
	implementing(f, "task-1", twoStepPlan())

	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepImplementing)

	runs := f.tasks.StepRuns("task-1")
	if len(runs) != 1 {
		t.Fatalf("step runs = %d, want the one that started", len(runs))
	}
	if want := "1111111111111111111111111111111111111111"; runs[0].StartCommit != want {
		t.Errorf("StartCommit = %q, want %q", runs[0].StartCommit, want)
	}
}

func TestTheWorktreeIsWatchedOnlyWhileItsNumbersMatter(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())

	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepImplementing)

	// Watched from the start, so no event of the review is missed, but read
	// only once the agent stops.
	f.service.Check("task-1")
	waitFor(t, "the worktree of task-1 to be watched", func() bool {
		active, watched := f.reviews.activeOf(reviewKey("task-1", 0))
		return watched && !active
	})

	f.waitStepSession(t, "task-1", 1)
	f.sessions.goIdle("task-1")
	f.service.Check("task-1")
	waitFor(t, "the review of task-1 to matter", func() bool {
		active, _ := f.reviews.activeOf(reviewKey("task-1", 0))
		return active
	})
}

func TestABlockedStepIsNotTheUsersToReview(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.worktrees.setStatus(git.Status{Changes: []git.Change{{X: '.', Y: 'M', Path: "main.go"}}})
	implementing(f, "task-1", twoStepPlan())

	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepBlocked)

	f.service.Check("task-1")
	waitFor(t, "the review of task-1 to be forgotten", func() bool {
		_, watched := f.reviews.activeOf(reviewKey("task-1", 0))
		return !watched && slices.Contains(f.reviews.reviewCalls(), "forget:task-1:api")
	})
}

func TestATaskWithEveryStepCommittedIsWatchedNoMore(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", plan())
	f.tasks.setRun("task-1", task.StepRun{Number: 1, Status: task.StepDone, CommitSHA: "2222222"})

	f.service.Check("task-1")
	waitFor(t, "the review of task-1 to be forgotten", func() bool {
		return slices.Contains(f.reviews.reviewCalls(), "forget-task:task-1")
	})
	if _, ok := f.service.CurrentStep("task-1"); ok {
		t.Error("CurrentStep() found a step, want none: every step is committed")
	}
}

func TestTearingDownTheStepsForgetsTheReview(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())
	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepImplementing)

	if _, err := f.service.Delete(t.Context(), "task-1"); err != nil {
		t.Fatalf("Delete() = %v, want nil", err)
	}
	if !slices.Contains(f.reviews.reviewCalls(), "forget-task:task-1") {
		t.Errorf("review calls = %q, want the review forgotten", f.reviews.reviewCalls())
	}
}

func TestTheReviewOfAStepIsKeyedByItsRepository(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	readyToApprove(t, f, twoStepPlan(), staged(3, 3))
	if err := f.service.ApproveStep(t.Context(), "task-1"); err != nil {
		t.Fatalf("ApproveStep() = %v, want nil", err)
	}

	// The agent commits and the step after it, of another repository, takes
	// over: what is watched is the worktree of that repository, under a key of
	// its own.
	f.reviews.setSnapshot(review.Snapshot{Head: commitSHA})
	f.sessions.goIdle("task-1")
	f.service.Check("task-1")
	f.waitStep(t, "task-1", 2, flow.StepImplementing)
	f.waitStepSession(t, "task-1", 2)
	f.service.Check("task-1")

	waitFor(t, "the worktree of the second repository to be watched", func() bool {
		_, watched := f.reviews.activeOf(reviewKey("task-1", 1))
		return watched
	})
	if _, watched := f.reviews.activeOf(reviewKey("task-1", 0)); watched {
		t.Error("the worktree of the first repository is still watched, want it forgotten with its step")
	}
}
