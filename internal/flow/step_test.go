package flow_test

import (
	"errors"
	"fmt"
	"slices"
	"testing"

	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/worktree"
)

// twoStepPlan is a plan of two steps, which is what a test that needs a step
// after the first one uses.
func twoStepPlan() task.Plan {
	return task.Plan{
		Present: true,
		Steps: []task.Step{
			{Number: 1, File: "1-first.md", Title: "First"},
			{Number: 2, File: "2-second.md", Title: "Second"},
		},
	}
}

// implementing puts a task straight in implementation with the given plan,
// which is where every step test starts.
func implementing(f *fixture, id string, plan task.Plan) task.Task {
	return f.tasks.add(id, task.StageImplementation, task.Artifacts{PRD: true, TechSpec: true, Plan: plan})
}

// implementingOneShot puts a One-Shot task straight in implementation, with its
// document written and the single step it is.
func implementingOneShot(f *fixture, id string) task.Task {
	f.tasks.setTaskMode(id, task.ModeOneShot)
	return f.tasks.add(id, task.StageImplementation, task.Artifacts{OneShot: true, Plan: oneShotPlan()})
}

func TestAFinishedOneShotDocumentStartsItsStepInTheRepository(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.setTaskMode("task-1", task.ModeOneShot)
	tk := f.tasks.add("task-1", task.StageOneShot, task.Artifacts{OneShot: true, Plan: oneShotPlan()})
	f.sessions.setSummary("task-1", idle(task.StageOneShot))

	f.service.Check("task-1")
	f.waitStep(t, "task-1", 1, flow.StepImplementing)

	f.waitWorktreeCalls(t, "ensure:task-1:dev/web", "status:task-1:task-1")
	f.waitCalls(t, "close:task-1:one_shot", "start:task-1:step:1:restarted=false")

	// The document is the prompt of the step, as a step file is.
	info, _ := f.sessions.info(implementerKey("task-1", 1))
	if info.Prompt != prompts.StageStep || info.StepPath != tk.OneShotPath() || info.OneShotPath != tk.OneShotPath() {
		t.Errorf("step session = %+v, want the step prompt read from %s", info, tk.OneShotPath())
	}
	if want := worktree.Path(dataDir, "dev", "web", "task-1"); info.Dir != want {
		t.Errorf("session dir = %q, want %q", info.Dir, want)
	}
}

func TestAFinishedPlanStartsTheFirstStepInItsWorktree(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.add("task-1", task.StagePlan, task.Artifacts{PRD: true, TechSpec: true, Plan: twoStepPlan()})
	f.sessions.setSummary("task-1", idle(task.StagePlan))

	f.service.Check("task-1")
	f.waitStep(t, "task-1", 1, flow.StepImplementing)

	f.waitWorktreeCalls(t, "ensure:task-1:dev/web", "status:task-1:task-1")
	f.waitCalls(t, "close:task-1:plan", "start:task-1:step:1:restarted=false")

	state := f.stepState(t, "task-1", 1)
	if want := worktree.Path(dataDir, "dev", "web", "task-1"); state.WorktreePath != want {
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

	// A session of another stage of the same task never speaks for the step.
	f.sessions.setSummary("task-1", session.Summary{Stage: string(task.StagePlan), Idle: true})
	if got := f.stepState(t, "task-1", 1).Status; got != flow.StepAwaitingReview {
		t.Errorf("status = %q, want awaiting_review: the plan session is not the step's", got)
	}

	// Without a session of its own, the step is simply implementing.
	stepSession := session.Key{TaskID: "task-1", Stage: session.StepStage(1)}
	if err := f.sessions.Close(t.Context(), stepSession); err != nil {
		t.Fatalf("Close: %v", err)
	}
	if got := f.stepState(t, "task-1", 1).Status; got != flow.StepImplementing {
		t.Errorf("status = %q, want implementing", got)
	}
}

func TestTheWorktreePathIsEmptyUntilTheWorktreeExists(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	tk := implementing(f, "task-1", twoStepPlan())

	if got := f.service.WorktreePath("task-1"); got != "" {
		t.Errorf("WorktreePath() = %q, want it empty before the worktree", got)
	}

	wt := f.worktrees.seed(tk)
	if got := f.service.WorktreePath("task-1"); got != wt.Path {
		t.Errorf("WorktreePath() = %q, want %q", got, wt.Path)
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

func TestAFirstStepIsBlockedWhenTheCloneIsMissing(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.repositories.setMissing(true)
	implementing(f, "task-1", twoStepPlan())

	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepBlocked)

	block := f.stepState(t, "task-1", 1).Block
	if block == nil || block.Reason != task.BlockCloneMissing {
		t.Fatalf("block = %+v, want the clone missing", block)
	}
	if want := "The clone at " + repo.Path + " is missing."; block.Detail != want {
		t.Errorf("detail = %q, want %q", block.Detail, want)
	}
	if calls := f.worktrees.recorded(); len(calls) != 0 {
		t.Errorf("worktree calls = %v, want none", calls)
	}
}

func TestAStepWithAWorktreeRunsWithoutTheClone(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	tk := implementing(f, "task-1", twoStepPlan())
	f.worktrees.seed(tk)
	f.repositories.setMissing(true)

	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepImplementing)

	// A worktree that exists goes on being used wherever the clone is.
	if state := f.stepState(t, "task-1", 1); state.Block != nil {
		t.Errorf("block = %+v, want none", state.Block)
	}
}

func TestRetryingAStepBlockedByAMissingCloneStartsItOnceTheCloneIsBack(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.repositories.setMissing(true)
	implementing(f, "task-1", twoStepPlan())

	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepBlocked)

	f.repositories.setMissing(false)
	if err := f.service.RetryStep(t.Context(), "task-1"); err != nil {
		t.Fatalf("RetryStep() = %v, want nil", err)
	}
	f.waitStep(t, "task-1", 1, flow.StepImplementing)
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
	f.waitWorktreeCalls(t, "ensure:task-1:dev/web")

	// The second sync finds a preparation under way and leaves it alone.
	f.service.Sync(t.Context())
	f.waitWorktreeCalls(t, "ensure:task-1:dev/web")

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
	f.worktrees.seed(created)

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
	f.waitWorktreeCalls(t, "ensure:task-1:dev/web")

	f.service.Close()

	// The cancelled preparation belongs to whoever cancelled it: the step is
	// left as it was, neither started nor blocked.
	waitFor(t, "the preparation to give up", func() bool {
		run, ok := f.tasks.stepRun("task-1", 1)
		return ok && run.Status == task.StepPreparing && len(f.sessions.recorded()) == 0
	})
	if _, ok := f.worktrees.Get("task-1"); ok {
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

	f.waitWorktreeCalls(t, "ensure:task-1:dev/web", "ensure:task-1:dev/web", "status:task-1:task-1")
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
		"ensure:task-1:dev/web", "status:task-1:task-1",
		"ensure:task-1:dev/web", "clean:task-1:task-1", "status:task-1:task-1",
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
		"discard:task-1:step:1,step_review:1",
		"start:task-1:step:1:restarted=true",
	)
	f.waitWorktreeCalls(t,
		"ensure:task-1:dev/web", "status:task-1:task-1",
		"ensure:task-1:dev/web", "clean:task-1:task-1", "status:task-1:task-1",
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
	f.worktrees.seed(created)

	f.service.Sync(t.Context())
	f.waitCalls(t, "open:task-1:step:1")

	// A discard restarts the step, and the preparation it spawns hangs.
	release := f.worktrees.blockEnsure()
	defer close(release)
	if err := f.service.DiscardStep(t.Context(), "task-1", false); err != nil {
		t.Fatalf("DiscardStep: %v", err)
	}
	f.waitWorktreeCalls(t, "ensure:task-1:dev/web")

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
		"closeTask:task-1",
		"discard:task-1:step:1,step_review:1",
		"discard:task-1:plan",
		"start:task-1:plan:restarted=true",
	)
	f.waitWorktreeCalls(t, "ensure:task-1:dev/web", "status:task-1:task-1", "remove:task-1")
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
		"closeTask:task-1",
		"discard:task-1:step:1,step_review:1",
		"discard:task-1:plan",
		"open:task-1:tech_spec",
	)
	f.waitWorktreeCalls(t, "ensure:task-1:dev/web", "status:task-1:task-1", "remove:task-1")
}

func TestBackToTheOneShotPlanningTearsItsStepDown(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementingOneShot(f, "task-1")

	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepImplementing)
	f.waitStepSession(t, "task-1", 1)
	f.tasks.setStepReports("task-1", 1, stepReport(1, 1, false))

	if err := f.service.Back(t.Context(), "task-1", task.StageOneShot); err != nil {
		t.Fatalf("Back: %v", err)
	}

	// Implementation and PR have no conversation of the task's own: the ones
	// that go are the step's.
	f.wantCalls(t,
		"start:task-1:step:1:restarted=false",
		"closeTask:task-1",
		"discard:task-1:step:1,step_review:1",
		"discard:task-1:",
		"open:task-1:one_shot",
	)
	f.waitWorktreeCalls(t, "ensure:task-1:dev/web", "status:task-1:task-1", "remove:task-1")
	if runs := f.tasks.StepRuns("task-1"); len(runs) != 0 {
		t.Errorf("step runs = %+v, want none", runs)
	}
	if calls := f.tasks.recorded(); !slices.Contains(calls, "remove:task-1:implementation") {
		t.Errorf("task calls = %q, want the artifacts of the implementation removed", calls)
	}

	got, _ := f.tasks.Get("task-1")
	if got.Stage != task.StageOneShot || !got.Revisiting {
		t.Errorf("task = %q revisiting=%t, want one_shot revisiting=true", got.Stage, got.Revisiting)
	}
	// The document stays, and with it the step it is; the reports of its review
	// go.
	if a, _ := f.tasks.Inspect("task-1"); !a.OneShot || !a.Plan.Present || len(a.StepReports) != 0 {
		t.Errorf("artifacts = %+v, want the document and its step without reports", a)
	}
}

func TestAWorktreeThatCannotBeRemovedKeepsEverythingAndReopensTheSession(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())

	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepImplementing)
	f.waitStepSession(t, "task-1", 1)

	errRemove := errors.New("git worktree remove --force /ws: fatal: is dirty")
	f.worktrees.failRemove(errRemove)

	wantErrIs(t, f.service.Discard(t.Context(), "task-1", task.StagePlan), errRemove)

	f.wantCalls(t,
		"start:task-1:step:1:restarted=false",
		"closeTask:task-1",
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
	f.waitWorktreeCalls(t, "ensure:task-1:dev/web")

	if err := f.service.Discard(t.Context(), "task-1", task.StagePlan); err != nil {
		t.Fatalf("Discard: %v", err)
	}

	// The cancelled preparation never started the step.
	f.wantCalls(t,
		"discard:task-1:step:1,step_review:1",
		"discard:task-1:plan",
		"start:task-1:plan:restarted=true",
	)
	f.waitWorktreeCalls(t, "ensure:task-1:dev/web", "remove:task-1")
}

func TestDeleteStopsTheSessionsAndPurgesTheWorktree(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())

	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepImplementing)
	f.waitStepSession(t, "task-1", 1)

	result, err := f.service.Delete(t.Context(), "task-1")
	if err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if result.Leftover != nil {
		t.Errorf("leftover = %+v, want none", result.Leftover)
	}

	// The conversation of the step stops before the worktree it runs in.
	f.wantCalls(t, "start:task-1:step:1:restarted=false", "closeTask:task-1")
	f.waitWorktreeCalls(t, "ensure:task-1:dev/web", "status:task-1:task-1", "purge:task-1")
	if _, ok := f.tasks.Get("task-1"); ok {
		t.Error("the task is still there")
	}
}

func TestDeleteOfAnArchivedTaskTouchesNoWorktree(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.add("task-1", task.StagePR, task.Artifacts{})
	if _, err := f.tasks.Archive(t.Context(), "task-1"); err != nil {
		t.Fatalf("Archive: %v", err)
	}

	if _, err := f.service.Delete(t.Context(), "task-1"); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	// The closing of its last repository already took the worktrees and the
	// conversations; only the records are left to remove.
	f.wantCalls(t)
	if calls := f.worktrees.recorded(); len(calls) != 0 {
		t.Errorf("worktree calls = %v, want none", calls)
	}
	if archived := f.tasks.ListArchived(); len(archived) != 0 {
		t.Errorf("archived = %+v, want the task gone from the history", archived)
	}
	_, err := f.service.Delete(t.Context(), "nobody")
	wantErrIs(t, err, task.ErrNotFound)
}
