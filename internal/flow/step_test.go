package flow_test

import (
	"errors"
	"fmt"
	"slices"
	"testing"

	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/worktree"
)

// twoStepPlan is a plan whose steps live in the two repositories of the fake
// workspace.
func twoStepPlan() task.Plan {
	return task.Plan{
		Present: true,
		Steps: []task.Step{
			{Number: 1, File: "1-first.md", Title: "First", Repository: "api", RepoPath: repos[0].Path},
			{Number: 2, File: "2-second.md", Title: "Second", Repository: "web", RepoPath: repos[1].Path},
		},
	}
}

// implementing puts a task straight in implementation with the given plan,
// which is where every step test starts.
func implementing(f *fixture, id string, plan task.Plan) task.Task {
	return f.tasks.add(id, task.StageImplementation, task.Artifacts{PRD: true, TechSpec: true, Plan: plan})
}

func TestAFinishedPlanStartsTheFirstStepInItsWorktree(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.add("task-1", task.StagePlan, task.Artifacts{PRD: true, TechSpec: true, Plan: twoStepPlan()})
	f.sessions.setSummary("task-1", idle(task.StagePlan))

	f.service.Check("task-1")
	f.waitStep(t, "task-1", 1, flow.StepImplementing)

	f.waitWorktreeCalls(t, "ensure:task-1:api", "status:task-1:task-1")
	f.waitCalls(t, "close:task-1", "start:task-1:step:1:restarted=false")

	state := f.stepState(t, "task-1", 1)
	if want := worktree.Path(workspace, "api", "task-1"); state.WorktreePath != want {
		t.Errorf("worktree path = %q, want %q", state.WorktreePath, want)
	}
	if state.Phase != "" || state.Block != nil {
		t.Errorf("state = %+v, want no phase and no block", state)
	}
	// Only the step that runs is touched; the rest of the plan waits.
	if second := f.stepState(t, "task-1", 2); second.Status != flow.StepNotStarted {
		t.Errorf("step 2 status = %q, want not_started", second.Status)
	}
}

func TestAnIdleStepSessionIsAwaitingReview(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())

	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepImplementing)
	f.waitStepSession(t, "task-1", 1)

	f.sessions.goIdle("task-1")
	if got := f.stepState(t, "task-1", 1).Status; got != flow.StepAwaitingReview {
		t.Errorf("status = %q, want awaiting_review", got)
	}

	// A session of another key never speaks for the step.
	f.sessions.setSummary("task-1", session.Summary{Stage: string(task.StagePlan), Idle: true})
	if got := f.stepState(t, "task-1", 1).Status; got != flow.StepImplementing {
		t.Errorf("status = %q, want implementing", got)
	}
}

func TestCurrentStepIsTheFirstOfThePlan(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())
	implementing(f, "task-2", task.Plan{Present: true})

	current, ok := f.service.CurrentStep("task-1")
	if !ok || current.Step.Number != 1 {
		t.Errorf("CurrentStep(task-1) = %+v, %v, want step 1", current, ok)
	}
	if _, ok := f.service.CurrentStep("task-2"); ok {
		t.Error("CurrentStep(task-2) = true, want false: the plan has no steps")
	}
}

func TestADirtyWorktreeBlocksTheStep(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.worktrees.setStatus(git.Status{Changes: []git.Change{
		{X: '.', Y: 'M', Path: "main.go"},
		{X: '?', Y: '?', Path: "notes.md"},
	}})
	implementing(f, "task-1", twoStepPlan())

	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepBlocked)

	block := f.stepState(t, "task-1", 1).Block
	if block == nil || block.Reason != task.BlockDirty {
		t.Fatalf("block = %+v, want a dirty worktree", block)
	}
	if block.Detail != " M main.go\n?? notes.md" || block.Files != 2 {
		t.Errorf("block = %+v, want the two status lines", block)
	}
	f.wantCalls(t)
}

func TestAFetchThatFailsBlocksTheStep(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.worktrees.failEnsure(fmt.Errorf("git fetch origin: no such remote: %w", worktree.ErrFetchFailed))
	implementing(f, "task-1", twoStepPlan())

	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepBlocked)

	block := f.stepState(t, "task-1", 1).Block
	if block == nil || block.Reason != task.BlockFetchFailed {
		t.Fatalf("block = %+v, want a failed fetch", block)
	}
	if block.Detail == "" || block.Files != 0 {
		t.Errorf("block = %+v, want what git said and no files", block)
	}
}

func TestAStepWithoutARepositoryBlocksBeforeAnyGit(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", brokenPlan())

	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepBlocked)

	block := f.stepState(t, "task-1", 1).Block
	if block == nil || block.Reason != task.BlockNoRepository {
		t.Fatalf("block = %+v, want no repository", block)
	}
	if want := `repository "cli" is not one of the repositories of this task`; block.Detail != want {
		t.Errorf("detail = %q, want %q", block.Detail, want)
	}
	if calls := f.worktrees.recorded(); len(calls) != 0 {
		t.Errorf("worktree calls = %v, want none", calls)
	}
}

func TestSyncStartsAStepTheAppNeverRecorded(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())

	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepImplementing)

	f.waitCalls(t, "start:task-1:step:1:restarted=false")
}

func TestSyncResumesAnInterruptedPreparationOnlyOnce(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())
	f.tasks.setStepRun("task-1", task.StepRun{Number: 1, Status: task.StepPreparing})
	release := f.worktrees.blockEnsure()

	f.service.Sync(t.Context())
	f.waitWorktreeCalls(t, "ensure:task-1:api")

	// The second sync finds a preparation under way and leaves it alone.
	f.service.Sync(t.Context())
	f.waitWorktreeCalls(t, "ensure:task-1:api")

	close(release)
	f.waitStep(t, "task-1", 1, flow.StepImplementing)
}

func TestSyncReportsThePhasesOfAPreparation(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())
	release := f.worktrees.blockEnsure()

	f.service.Sync(t.Context())
	waitFor(t, "the step to report that it is fetching", func() bool {
		state := f.stepState(t, "task-1", 1)
		return state.Status == flow.StepPreparing && state.Phase == flow.PhaseFetching
	})
	close(release)
	f.waitStep(t, "task-1", 1, flow.StepImplementing)
}

func TestSyncReopensTheSessionOfAStartedStep(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := implementing(f, "task-1", twoStepPlan())
	f.tasks.setStepRun("task-1", task.StepRun{Number: 1, Status: task.StepStarted})
	f.worktrees.seed(created, repos[0])

	f.service.Sync(t.Context())

	f.waitCalls(t, "open:task-1:step:1")
	if calls := f.worktrees.recorded(); len(calls) != 0 {
		t.Errorf("worktree calls = %v, want none", calls)
	}
}

func TestSyncBlocksAStartedStepWhoseWorktreeIsGone(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())
	f.tasks.setStepRun("task-1", task.StepRun{Number: 1, Status: task.StepStarted})

	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepBlocked)

	block := f.stepState(t, "task-1", 1).Block
	if block == nil || block.Reason != task.BlockGitFailed {
		t.Fatalf("block = %+v, want git_failed", block)
	}
}

func TestSyncLeavesABlockedStepAlone(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())
	f.tasks.setStepRun("task-1", task.StepRun{
		Number: 1,
		Status: task.StepBlocked,
		Block:  &task.StepBlock{Reason: task.BlockDirty, Detail: " M main.go", Files: 1},
	})

	f.service.Sync(t.Context())

	if got := f.stepState(t, "task-1", 1).Status; got != flow.StepBlocked {
		t.Errorf("status = %q, want blocked", got)
	}
	f.wantCalls(t)
	if calls := f.worktrees.recorded(); len(calls) != 0 {
		t.Errorf("worktree calls = %v, want none", calls)
	}
}

func TestClosingTheFlowCancelsAPreparation(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())
	release := f.worktrees.blockEnsure()
	defer close(release)

	f.service.Sync(t.Context())
	f.waitWorktreeCalls(t, "ensure:task-1:api")

	f.service.Close()

	// The cancelled preparation belongs to whoever cancelled it: the step is
	// left as it was, neither started nor blocked.
	waitFor(t, "the preparation to give up", func() bool {
		run, ok := f.tasks.stepRun("task-1", 1)
		return ok && run.Status == task.StepPreparing && len(f.sessions.recorded()) == 0
	})
	if _, ok := f.worktrees.Get("task-1", repos[0].Path); ok {
		t.Error("the cancelled preparation registered a worktree")
	}
}

func TestStepsOfATaskWithoutAPlanAreEmpty(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	if states := f.service.Steps("nobody"); len(states) != 0 {
		t.Errorf("Steps(nobody) = %+v, want none", states)
	}
}

func TestRetryStepPreparesABlockedStepAgain(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.worktrees.failEnsure(fmt.Errorf("git fetch origin: no such remote: %w", worktree.ErrFetchFailed))
	implementing(f, "task-1", twoStepPlan())

	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepBlocked)

	f.worktrees.failEnsure(nil)
	if err := f.service.RetryStep(t.Context(), "task-1"); err != nil {
		t.Fatalf("RetryStep: %v", err)
	}
	f.waitStep(t, "task-1", 1, flow.StepImplementing)

	f.waitWorktreeCalls(t, "ensure:task-1:api", "ensure:task-1:api", "status:task-1:task-1")
	f.waitCalls(t, "start:task-1:step:1:restarted=false")
}

func TestRetryStepOfAStepThatIsNotBlockedIsRefused(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())

	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepImplementing)

	wantErrIs(t, f.service.RetryStep(t.Context(), "task-1"), flow.ErrStepNotBlocked)
}

func TestRetryStepOutsideImplementationIsRefused(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.add("task-1", task.StagePlan, task.Artifacts{PRD: true, TechSpec: true, Plan: twoStepPlan()})

	wantErrIs(t, f.service.RetryStep(t.Context(), "task-1"), flow.ErrNotImplementing)
	wantErrIs(t, f.service.RetryStep(t.Context(), "nobody"), task.ErrNotFound)
}

func TestRetryStepOfATaskWithoutStepsIsRefused(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", task.Plan{Present: true})

	wantErrIs(t, f.service.RetryStep(t.Context(), "task-1"), flow.ErrNoStep)
}

func TestCleanAndStartStepDiscardsTheChangesAndStarts(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.worktrees.setStatus(git.Status{Changes: []git.Change{{X: '.', Y: 'M', Path: "main.go"}}})
	implementing(f, "task-1", twoStepPlan())

	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepBlocked)

	if err := f.service.CleanAndStartStep(t.Context(), "task-1"); err != nil {
		t.Fatalf("CleanAndStartStep: %v", err)
	}
	f.waitStep(t, "task-1", 1, flow.StepImplementing)

	f.waitWorktreeCalls(t,
		"ensure:task-1:api", "status:task-1:task-1",
		"ensure:task-1:api", "clean:task-1:task-1", "status:task-1:task-1",
	)
	f.waitCalls(t, "start:task-1:step:1:restarted=false")
}

func TestCleanAndStartStepOfABlockThatIsNotDirtIsRefused(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.worktrees.failEnsure(fmt.Errorf("git fetch origin: %w", worktree.ErrFetchFailed))
	implementing(f, "task-1", twoStepPlan())

	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepBlocked)

	wantErrIs(t, f.service.CleanAndStartStep(t.Context(), "task-1"), flow.ErrStepNotDirty)
}

func TestDiscardStepStartsTheStepOverInACleanWorktree(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())

	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepImplementing)
	f.waitStepSession(t, "task-1", 1)

	f.worktrees.setStatus(git.Status{Changes: []git.Change{{X: '?', Y: '?', Path: "scratch.md"}}})
	if err := f.service.DiscardStep(t.Context(), "task-1", true); err != nil {
		t.Fatalf("DiscardStep: %v", err)
	}
	f.waitStep(t, "task-1", 1, flow.StepImplementing)

	f.waitCalls(t,
		"start:task-1:step:1:restarted=false",
		"discard:task-1:step:1",
		"start:task-1:step:1:restarted=true",
	)
	f.waitWorktreeCalls(t,
		"ensure:task-1:api", "status:task-1:task-1",
		"ensure:task-1:api", "clean:task-1:task-1", "status:task-1:task-1",
	)
}

func TestDiscardStepWithoutCleaningLeavesADirtyWorktreeBlocked(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())

	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepImplementing)
	f.waitStepSession(t, "task-1", 1)

	f.worktrees.setStatus(git.Status{Changes: []git.Change{{X: '?', Y: '?', Path: "scratch.md"}}})
	if err := f.service.DiscardStep(t.Context(), "task-1", false); err != nil {
		t.Fatalf("DiscardStep: %v", err)
	}
	f.waitStep(t, "task-1", 1, flow.StepBlocked)

	block := f.stepState(t, "task-1", 1).Block
	if block == nil || block.Reason != task.BlockDirty || block.Files != 1 {
		t.Fatalf("block = %+v, want a dirty worktree of one file", block)
	}
	if calls := f.worktrees.recorded(); slices.Contains(calls, "clean:task-1:task-1") {
		t.Errorf("worktree calls = %v, want no cleaning", calls)
	}
}

func TestDiscardStepBeforeTheStepStartedIsRefused(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.worktrees.setStatus(git.Status{Changes: []git.Change{{X: '.', Y: 'M', Path: "main.go"}}})
	implementing(f, "task-1", twoStepPlan())

	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepBlocked)

	wantErrIs(t, f.service.DiscardStep(t.Context(), "task-1", false), flow.ErrStepNotStarted)
}

func TestDiscardStepCancelsAPreparationInFlight(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := implementing(f, "task-1", twoStepPlan())
	f.tasks.setStepRun("task-1", task.StepRun{Number: 1, Status: task.StepStarted})
	f.worktrees.seed(created, repos[0])

	f.service.Sync(t.Context())
	f.waitCalls(t, "open:task-1:step:1")

	// A discard restarts the step, and the preparation it spawns hangs.
	release := f.worktrees.blockEnsure()
	defer close(release)
	if err := f.service.DiscardStep(t.Context(), "task-1", false); err != nil {
		t.Fatalf("DiscardStep: %v", err)
	}
	f.waitWorktreeCalls(t, "ensure:task-1:api")

	// The second discard cancels it; the step is left preparing, not started.
	wantErrIs(t, f.service.DiscardStep(t.Context(), "task-1", false), flow.ErrStepNotStarted)
	run, ok := f.tasks.stepRun("task-1", 1)
	if !ok || run.Status != task.StepPreparing {
		t.Errorf("run = %+v, %v, want preparing", run, ok)
	}
}

func TestDiscardingThePlanTearsTheStepsDownFirst(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())

	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepImplementing)
	f.waitStepSession(t, "task-1", 1)

	if err := f.service.Discard(t.Context(), "task-1", task.StagePlan); err != nil {
		t.Fatalf("Discard: %v", err)
	}

	f.wantCalls(t,
		"start:task-1:step:1:restarted=false",
		"close:task-1",
		"discard:task-1:step:1",
		"discard:task-1:plan",
		"start:task-1:plan:restarted=true",
	)
	f.waitWorktreeCalls(t, "ensure:task-1:api", "status:task-1:task-1", "removeAll:task-1")
	if runs := f.tasks.StepRuns("task-1"); len(runs) != 0 {
		t.Errorf("step runs = %+v, want none", runs)
	}
}

func TestBackToTheTechSpecTearsTheStepsDownFirst(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())

	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepImplementing)
	f.waitStepSession(t, "task-1", 1)

	if err := f.service.Back(t.Context(), "task-1", task.StageTechSpec); err != nil {
		t.Fatalf("Back: %v", err)
	}

	f.wantCalls(t,
		"start:task-1:step:1:restarted=false",
		"close:task-1",
		"discard:task-1:step:1",
		"discard:task-1:plan",
		"open:task-1:tech_spec",
	)
	f.waitWorktreeCalls(t, "ensure:task-1:api", "status:task-1:task-1", "removeAll:task-1")
}

func TestAWorktreeThatCannotBeRemovedKeepsEverythingAndReopensTheSession(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())

	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepImplementing)
	f.waitStepSession(t, "task-1", 1)

	errRemove := errors.New("git worktree remove --force /ws: fatal: is dirty")
	f.worktrees.failRemoveAll(errRemove)

	wantErrIs(t, f.service.Discard(t.Context(), "task-1", task.StagePlan), errRemove)

	f.wantCalls(t,
		"start:task-1:step:1:restarted=false",
		"close:task-1",
		"open:task-1:step:1",
	)
	if runs := f.tasks.StepRuns("task-1"); len(runs) != 1 {
		t.Errorf("step runs = %+v, want the one that was there", runs)
	}
	if got, _ := f.tasks.Get("task-1"); got.Stage != task.StageImplementation {
		t.Errorf("stage = %q, want implementation", got.Stage)
	}
}

func TestDiscardingThePlanCancelsAPreparationInFlight(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())
	release := f.worktrees.blockEnsure()
	defer close(release)

	f.service.Sync(t.Context())
	f.waitWorktreeCalls(t, "ensure:task-1:api")

	if err := f.service.Discard(t.Context(), "task-1", task.StagePlan); err != nil {
		t.Fatalf("Discard: %v", err)
	}

	// The cancelled preparation never started the step.
	f.wantCalls(t,
		"discard:task-1:step:1",
		"discard:task-1:plan",
		"start:task-1:plan:restarted=true",
	)
	f.waitWorktreeCalls(t, "ensure:task-1:api", "removeAll:task-1")
}

func TestDeleteTearsTheStepsDownAndRemovesTheTask(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())

	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepImplementing)
	f.waitStepSession(t, "task-1", 1)

	if err := f.service.Delete(t.Context(), "task-1"); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	f.wantCalls(t,
		"start:task-1:step:1:restarted=false",
		"close:task-1",
		"discard:task-1:step:1",
		"close:task-1",
	)
	f.waitWorktreeCalls(t, "ensure:task-1:api", "status:task-1:task-1", "removeAll:task-1")
	if _, ok := f.tasks.Get("task-1"); ok {
		t.Error("the task is still there")
	}
}

func TestDeleteOfAPlannedTaskTouchesNoWorktree(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.add("task-1", task.StagePRD, task.Artifacts{})

	if err := f.service.Delete(t.Context(), "task-1"); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	f.wantCalls(t, "close:task-1")
	if calls := f.worktrees.recorded(); len(calls) != 0 {
		t.Errorf("worktree calls = %v, want none", calls)
	}
	wantErrIs(t, f.service.Delete(t.Context(), "nobody"), task.ErrNotFound)
}
