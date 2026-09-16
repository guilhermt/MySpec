package flow_test

import (
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

func TestAStageEndsOnlyWhenTheSessionIsIdle(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.add("task-1", task.StagePRD, task.Artifacts{PRD: true})
	f.sessions.setSummary("task-1", busy(task.StagePRD))

	f.service.Check("task-1")
	f.waitEvaluations(t, 1)
	if got, _ := f.tasks.Get("task-1"); got.Stage != task.StagePRD {
		t.Fatalf("stage = %q, want prd while the turn runs", got.Stage)
	}
	f.wantCalls(t)

	f.sessions.setSummary("task-1", idle(task.StagePRD))
	f.service.Check("task-1")
	f.waitStage(t, "task-1", task.StageTechSpec)

	f.waitCalls(t, "close:task-1:prd", "start:task-1:tech_spec:restarted=false")
	f.wantTaskCalls(t, "stage:task-1:tech_spec:revisiting=false")
}

func TestAFinishedPlanReachesImplementationAndStartsAStep(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.add("task-1", task.StagePlan, task.Artifacts{PRD: true, TechSpec: true, Plan: plan()})
	f.sessions.setSummary("task-1", idle(task.StagePlan))

	f.service.Check("task-1")
	f.waitStage(t, "task-1", task.StageImplementation)

	// The stage itself has no conversation: the first step of the plan does.
	f.waitCalls(t, "close:task-1:plan", "start:task-1:step:1:restarted=false")
	f.wantTaskCalls(t,
		"stage:task-1:implementation:revisiting=false",
		"step:task-1:1:preparing",
		"step:task-1:1:started",
		// The task was seeded without models and without a review mode, so the
		// step freezes the factory choice of implementation and the manual mode.
		"stepModel:task-1:1:claude-opus-5:high",
		"stepReviewMode:task-1:1:manual",
	)
}

func TestAnInvalidPlanIsCorrectedUpToThreeTimes(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.add("task-1", task.StagePlan, task.Artifacts{PRD: true, TechSpec: true, Plan: brokenPlan()})
	f.sessions.setSummary("task-1", idle(task.StagePlan))

	for attempt := 1; attempt <= flow.MaxCorrections; attempt++ {
		f.sessions.goIdle("task-1")
		f.service.Check("task-1")
		waitFor(t, "correction number "+strconv.Itoa(attempt), func() bool {
			return len(f.sessions.sent()) == attempt
		})
	}

	f.sessions.goIdle("task-1")
	before := f.tasks.inspectCount()
	f.service.Check("task-1")
	f.waitEvaluations(t, before+1)

	if got := len(f.sessions.sent()); got != flow.MaxCorrections {
		t.Errorf("corrections sent = %d, want %d", got, flow.MaxCorrections)
	}
	if got, _ := f.tasks.Get("task-1"); got.Stage != task.StagePlan {
		t.Errorf("stage = %q, want plan while the plan is broken", got.Stage)
	}
	if sent := f.sessions.sent(); len(sent) > 0 && !strings.Contains(sent[0], "1-first.md") {
		t.Errorf("correction = %q, want the broken file in it", sent[0])
	}
}

func TestAnEmptyStepsFolderIsNotCorrected(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.add("task-1", task.StagePlan, task.Artifacts{PRD: true, TechSpec: true})
	f.sessions.setSummary("task-1", idle(task.StagePlan))

	f.service.Check("task-1")
	f.waitEvaluations(t, 1)

	f.wantCalls(t)
	if got, _ := f.tasks.Get("task-1"); got.Stage != task.StagePlan {
		t.Errorf("stage = %q, want plan while the agent negotiates", got.Stage)
	}
}

func TestARevisitedStageWaitsForContinue(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.add("task-1", task.StagePRD, task.Artifacts{PRD: true})
	f.tasks.setRevisiting("task-1", true)
	f.sessions.setSummary("task-1", idle(task.StagePRD))

	f.service.Check("task-1")
	f.waitEvaluations(t, 1)
	f.wantCalls(t)

	if err := f.service.Continue(t.Context(), "task-1"); err != nil {
		t.Fatalf("Continue() = %v, want nil", err)
	}
	if got, _ := f.tasks.Get("task-1"); got.Stage != task.StageTechSpec {
		t.Errorf("stage = %q, want tech_spec", got.Stage)
	}
	f.wantCalls(t, "close:task-1:prd", "start:task-1:tech_spec:restarted=false")
}

func TestContinueNeedsAFinishedStage(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.add("task-1", task.StagePRD, task.Artifacts{})
	f.tasks.setRevisiting("task-1", true)
	f.sessions.setSummary("task-1", idle(task.StagePRD))

	wantErrIs(t, f.service.Continue(t.Context(), "task-1"), flow.ErrNotReady)

	f.tasks.setArtifacts("task-1", task.Artifacts{PRD: true})
	f.sessions.setSummary("task-1", busy(task.StagePRD))
	wantErrIs(t, f.service.Continue(t.Context(), "task-1"), flow.ErrNotReady)

	f.tasks.setRevisiting("task-1", false)
	f.sessions.setSummary("task-1", idle(task.StagePRD))
	wantErrIs(t, f.service.Continue(t.Context(), "task-1"), flow.ErrNotRevisiting)

	wantErrIs(t, f.service.Continue(t.Context(), "nobody"), task.ErrNotFound)
}

func TestBackToThePRDThrowsAwayWhatCameAfterIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.add("task-1", task.StagePlan, task.Artifacts{PRD: true, TechSpec: true, Plan: plan()})
	f.sessions.setSummary("task-1", idle(task.StagePlan))

	if err := f.service.Back(t.Context(), "task-1", task.StagePRD); err != nil {
		t.Fatalf("Back() = %v, want nil", err)
	}

	f.wantCalls(t, "discard:task-1:tech_spec,plan", "open:task-1:prd")
	f.wantTaskCalls(t, "remove:task-1:tech_spec", "stage:task-1:prd:revisiting=true")

	got, _ := f.tasks.Get("task-1")
	if got.Stage != task.StagePRD || !got.Revisiting {
		t.Errorf("task = %q revisiting=%t, want prd revisiting=true", got.Stage, got.Revisiting)
	}
	if a, _ := f.tasks.Inspect("task-1"); !a.PRD || a.TechSpec || a.Plan.Present {
		t.Errorf("artifacts = %+v, want the PRD alone", a)
	}
}

func TestBackRefusesAStageThatIsNotBehind(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.add("task-1", task.StagePlan, task.Artifacts{PRD: true, TechSpec: true})

	wantErrIs(t, f.service.Back(t.Context(), "task-1", task.StagePlan), flow.ErrInvalidTarget)
	wantErrIs(t, f.service.Back(t.Context(), "task-1", task.StageImplementation), flow.ErrInvalidTarget)
	wantErrIs(t, f.service.Back(t.Context(), "nobody", task.StagePRD), task.ErrNotFound)
	f.wantCalls(t)
}

func TestDiscardRestartsTheStage(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.add("task-1", task.StageTechSpec, task.Artifacts{PRD: true, TechSpec: true})
	f.sessions.setSummary("task-1", busy(task.StageTechSpec))

	if err := f.service.Discard(t.Context(), "task-1", task.StageTechSpec); err != nil {
		t.Fatalf("Discard() = %v, want nil", err)
	}

	f.wantCalls(t, "discard:task-1:tech_spec,plan", "start:task-1:tech_spec:restarted=true")
	f.wantTaskCalls(t, "remove:task-1:tech_spec", "stage:task-1:tech_spec:revisiting=false")
	if a, _ := f.tasks.Inspect("task-1"); !a.PRD || a.TechSpec {
		t.Errorf("artifacts = %+v, want the PRD alone", a)
	}
}

func TestDiscardOfAStageAlreadyPassed(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.add("task-1", task.StageImplementation, task.Artifacts{PRD: true, TechSpec: true, Plan: plan()})

	if err := f.service.Discard(t.Context(), "task-1", task.StagePlan); err != nil {
		t.Fatalf("Discard() = %v, want nil", err)
	}

	f.wantCalls(t, "discard:task-1:plan", "start:task-1:plan:restarted=true")
	f.wantTaskCalls(t, "remove:task-1:plan", "stage:task-1:plan:revisiting=false")
}

func TestDiscardRefusesAStageWithoutASession(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.add("task-1", task.StagePRD, task.Artifacts{})

	wantErrIs(t, f.service.Discard(t.Context(), "task-1", task.StageImplementation), flow.ErrInvalidTarget)
	wantErrIs(t, f.service.Discard(t.Context(), "task-1", task.StagePlan), flow.ErrInvalidTarget)
	wantErrIs(t, f.service.Discard(t.Context(), "nobody", task.StagePRD), task.ErrNotFound)
	f.wantCalls(t)
}

func TestStartTaskOpensTheFirstStage(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.tasks.add("task-1", task.StagePRD, task.Artifacts{})

	if err := f.service.StartTask(t.Context(), created); err != nil {
		t.Fatalf("StartTask() = %v, want nil", err)
	}
	f.wantCalls(t, "start:task-1:prd:restarted=false")

	// A Structured task has no document of its own to point to, and its
	// planning runs in the clone of its repository.
	info, _ := f.sessions.info(session.Key{TaskID: "task-1", Stage: string(task.StagePRD)})
	if info.OneShotPath != "" || info.Dir != repo.Path || info.Repository != repo.FullName() {
		t.Errorf("session = %+v, want no One-Shot document and the clone of %s", info, repo.FullName())
	}
}

func TestAOneShotTaskStartsItsPlanningInItsRepository(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.setTaskMode("task-1", task.ModeOneShot)
	created := f.tasks.add("task-1", task.StageOneShot, task.Artifacts{})

	if err := f.service.StartTask(t.Context(), created); err != nil {
		t.Fatalf("StartTask() = %v, want nil", err)
	}
	f.wantCalls(t, "start:task-1:one_shot:restarted=false")

	info, _ := f.sessions.info(session.Key{TaskID: "task-1", Stage: string(task.StageOneShot)})
	type planningInfo struct {
		Prompt      prompts.Stage
		Dir         string
		Repository  string
		OneShotPath string
		Choice      models.Choice
	}
	want := planningInfo{
		Prompt:      prompts.StageOneShot,
		Dir:         repo.Path,
		Repository:  "dev/web",
		OneShotPath: created.OneShotPath(),
		Choice:      created.Models.Stage(models.OneShot),
	}
	got := planningInfo{
		Prompt: info.Prompt, Dir: info.Dir, Repository: info.Repository, OneShotPath: info.OneShotPath, Choice: info.Choice,
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("planning info mismatch (-want +got):\n%s", diff)
	}
}

func TestContinueTakesARevisitedOneShotPlanningToItsStep(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.setTaskMode("task-1", task.ModeOneShot)
	f.tasks.add("task-1", task.StageOneShot, task.Artifacts{OneShot: true, Plan: oneShotPlan()})
	f.tasks.setRevisiting("task-1", true)
	f.sessions.setSummary("task-1", idle(task.StageOneShot))

	if err := f.service.Continue(t.Context(), "task-1"); err != nil {
		t.Fatalf("Continue() = %v, want nil", err)
	}
	if got, _ := f.tasks.Get("task-1"); got.Stage != task.StageImplementation {
		t.Errorf("stage = %q, want implementation", got.Stage)
	}
	f.waitCalls(t, "close:task-1:one_shot", "start:task-1:step:1:restarted=false")
}

func TestBackAndDiscardOfAOneShotTaskReachOnlyItsPlanning(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementingOneShot(f, "task-1")
	f.tasks.setTaskMode("task-2", task.ModeOneShot)
	f.tasks.add("task-2", task.StageOneShot, task.Artifacts{OneShot: true, Plan: oneShotPlan()})
	f.tasks.add("task-3", task.StageImplementation, task.Artifacts{PRD: true, TechSpec: true, Plan: plan()})

	wantErrIs(t, f.service.Back(t.Context(), "task-1", task.StagePRD), flow.ErrInvalidTarget)
	wantErrIs(t, f.service.Back(t.Context(), "task-1", task.StageTechSpec), flow.ErrInvalidTarget)
	wantErrIs(t, f.service.Discard(t.Context(), "task-1", task.StagePlan), flow.ErrInvalidTarget)
	// The planning is not behind a task that is still in it.
	wantErrIs(t, f.service.Back(t.Context(), "task-2", task.StageOneShot), flow.ErrInvalidTarget)
	// A Structured task has no One-Shot planning.
	wantErrIs(t, f.service.Back(t.Context(), "task-3", task.StageOneShot), flow.ErrInvalidTarget)
	wantErrIs(t, f.service.Discard(t.Context(), "task-3", task.StageOneShot), flow.ErrInvalidTarget)
	f.wantCalls(t)
}

func TestDiscardOfTheOneShotPlanningStartsItFromScratch(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementingOneShot(f, "task-1")

	if err := f.service.Discard(t.Context(), "task-1", task.StageOneShot); err != nil {
		t.Fatalf("Discard() = %v, want nil", err)
	}

	f.wantCalls(t, "discard:task-1:one_shot", "start:task-1:one_shot:restarted=true")
	f.wantTaskCalls(t, "remove:task-1:one_shot", "stage:task-1:one_shot:revisiting=false")
	if a, _ := f.tasks.Inspect("task-1"); a.OneShot || a.Plan.Present {
		t.Errorf("artifacts = %+v, want neither the document nor its step", a)
	}
}

func TestSyncOpensTheSessionsAndAdvancesWhatIsDone(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.add("task-1", task.StagePRD, task.Artifacts{PRD: true})
	f.tasks.add("task-2", task.StagePRD, task.Artifacts{})
	// A step already blocked keeps task-3 from starting anything of its own,
	// which the step tests cover on their own.
	f.tasks.add("task-3", task.StageImplementation, task.Artifacts{PRD: true, TechSpec: true, Plan: plan()})
	f.tasks.setStepRun("task-3", task.StepRun{
		Number: 1,
		Status: task.StepBlocked,
		Block:  &task.StepBlock{Reason: task.BlockDirty},
	})

	f.service.Sync(t.Context())
	f.waitStage(t, "task-1", task.StageTechSpec)

	f.waitCalls(t,
		"open:task-1:prd",
		"open:task-2:prd",
		"close:task-1:prd",
		"start:task-1:tech_spec:restarted=false",
	)
	if got, _ := f.tasks.Get("task-2"); got.Stage != task.StagePRD {
		t.Errorf("task-2 stage = %q, want prd", got.Stage)
	}
	if got, _ := f.tasks.Get("task-3"); got.Stage != task.StageImplementation {
		t.Errorf("task-3 stage = %q, want implementation", got.Stage)
	}
}

func TestChecksInABurstMakeOneEvaluationEach(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.add("task-1", task.StagePRD, task.Artifacts{PRD: true})
	// No session is open, so an evaluation stops right after reading the disk.
	release := f.tasks.blockInspect()

	f.service.Check("task-1")
	f.waitEvaluations(t, 1)
	for range 4 {
		f.service.Check("task-1")
	}
	close(release)

	f.waitEvaluations(t, 2)
	if got := f.tasks.inspectCount(); got != 2 {
		t.Errorf("evaluations = %d, want the running one and one coalesced", got)
	}
}

func TestAClosedFlowEvaluatesNothing(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.add("task-1", task.StagePRD, task.Artifacts{PRD: true})
	f.sessions.setSummary("task-1", idle(task.StagePRD))

	f.service.Close()
	f.service.Check("task-1")
	time.Sleep(20 * pollStep)

	if got := f.tasks.inspectCount(); got != 0 {
		t.Errorf("evaluations = %d, want none after Close", got)
	}
	f.wantCalls(t)
}

func TestAFailedStartLeavesTheStageWhereItIs(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.tasks.add("task-1", task.StagePRD, task.Artifacts{})
	f.sessions.failWith(errStart)

	wantErrIs(t, f.service.StartTask(t.Context(), created), errStart)
	if got, _ := f.tasks.Get("task-1"); got.Stage != task.StagePRD {
		t.Errorf("stage = %q, want prd", got.Stage)
	}
}

func TestAStageThatCannotBeRecordedIsNotStarted(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.add("task-1", task.StagePRD, task.Artifacts{PRD: true})
	f.sessions.setSummary("task-1", idle(task.StagePRD))
	f.tasks.failWith(errStore)

	f.service.Check("task-1")
	f.waitCalls(t, "close:task-1:prd")
	f.waitEvaluations(t, 1)

	if got, _ := f.tasks.Get("task-1"); got.Stage != task.StagePRD {
		t.Errorf("stage = %q, want prd, which is where the failure left it", got.Stage)
	}
	f.wantCalls(t, "close:task-1:prd")
}

func TestSummaryOfAnUnopenedSessionStopsTheEvaluation(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.add("task-1", task.StagePRD, task.Artifacts{PRD: true})

	f.service.Check("task-1")
	f.waitEvaluations(t, 1)

	f.wantCalls(t)
	if got, _ := f.tasks.Get("task-1"); got.Stage != task.StagePRD {
		t.Errorf("stage = %q, want prd", got.Stage)
	}
}
