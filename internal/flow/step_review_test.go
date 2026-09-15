package flow_test

import (
	"slices"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/reviewmode"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

func TestAStepStartsWithTheReviewModeOfTheTaskAndKeepsIt(t *testing.T) {
	t.Parallel()

	t.Run("a step that follows the task", func(t *testing.T) {
		t.Parallel()

		f := newFixture(t)
		f.tasks.setReviewModes("task-1", task.ReviewModes{Task: reviewmode.Agent})
		f.tasks.add("task-1", task.StagePlan, task.Artifacts{PRD: true, TechSpec: true, Plan: twoStepPlan()})
		f.sessions.setSummary("task-1", idle(task.StagePlan))

		f.service.Check("task-1")
		f.waitStep(t, "task-1", 1, flow.StepImplementing)
		f.waitStepSession(t, "task-1", 1)

		// The mode is written on the step, so that a later change of the task no
		// longer reaches it.
		if calls := f.tasks.recorded(); !slices.Contains(calls, "stepReviewMode:task-1:1:agent") {
			t.Errorf("task calls = %v, want the review mode of step 1 recorded", calls)
		}
		if err := f.service.SetReviewMode(t.Context(), "task-1", reviewmode.Manual); err != nil {
			t.Fatalf("SetReviewMode() = %v, want nil", err)
		}
		if got := f.stepState(t, "task-1", 1).ReviewMode; got != reviewmode.Agent {
			t.Errorf("review mode of step 1 = %q, want agent", got)
		}
		if got := f.stepState(t, "task-1", 2).ReviewMode; got != reviewmode.Manual {
			t.Errorf("review mode of step 2 = %q, want manual", got)
		}
	})

	t.Run("a step with a mode of its own", func(t *testing.T) {
		t.Parallel()

		f := newFixture(t)
		f.tasks.setReviewModes("task-1", task.ReviewModes{
			Task:  reviewmode.Agent,
			Steps: map[int]reviewmode.Mode{1: reviewmode.Manual},
		})
		f.tasks.add("task-1", task.StagePlan, task.Artifacts{PRD: true, TechSpec: true, Plan: twoStepPlan()})
		f.sessions.setSummary("task-1", idle(task.StagePlan))

		f.service.Check("task-1")
		f.waitStep(t, "task-1", 1, flow.StepImplementing)
		f.waitStepSession(t, "task-1", 1)

		// The step already had a mode of its own: there is nothing to freeze.
		recorded := f.tasks.recorded()
		if slices.ContainsFunc(recorded, func(call string) bool { return strings.HasPrefix(call, "stepReviewMode:") }) {
			t.Errorf("task calls = %v, want no review mode recorded for a step that had one", recorded)
		}
		if got := f.stepState(t, "task-1", 1).ReviewMode; got != reviewmode.Manual {
			t.Errorf("review mode of step 1 = %q, want manual", got)
		}
	})
}

func TestStepsCarryTheirReviewMode(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.setReviewModes("task-1", task.ReviewModes{
		Task:  reviewmode.Agent,
		Steps: map[int]reviewmode.Mode{1: reviewmode.Agent, 2: reviewmode.Manual},
	})
	implementing(f, "task-1", threeStepPlan())
	f.tasks.setStepRun("task-1", task.StepRun{
		Number: 1, Status: task.StepStarted, StartCommit: startCommit, Fallback: task.FallbackTakenOver,
	})

	type modeOfStep struct {
		Number       int
		ReviewMode   reviewmode.Mode
		ModeAdjusted bool
		Fallback     task.ReviewFallback
	}
	got := make([]modeOfStep, 0, 3)
	for _, state := range f.service.Steps("task-1") {
		got = append(got, modeOfStep{
			Number: state.Step.Number, ReviewMode: state.ReviewMode,
			ModeAdjusted: state.ModeAdjusted, Fallback: state.Fallback,
		})
	}
	// The step that started under the agent review and went back to the user is
	// reviewed by the user, and shows why; only a step still to start shows a
	// mode of its own as adjusted.
	want := []modeOfStep{
		{Number: 1, ReviewMode: reviewmode.Manual, Fallback: task.FallbackTakenOver},
		{Number: 2, ReviewMode: reviewmode.Manual, ModeAdjusted: true},
		{Number: 3, ReviewMode: reviewmode.Agent},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("steps mismatch (-want +got):\n%s", diff)
	}
}

func TestSetReviewModeChangesTheStepsStillToStart(t *testing.T) {
	t.Parallel()

	tests := map[string]struct {
		stage   task.Stage
		started []int
	}{
		"the plan, before any step":        {stage: task.StagePlan},
		"implementation with step 2 ahead": {stage: task.StageImplementation, started: []int{1}},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			f.tasks.add("task-1", tc.stage, task.Artifacts{PRD: true, TechSpec: true, Plan: twoStepPlan()})
			for _, number := range tc.started {
				f.tasks.setStepRun("task-1", task.StepRun{Number: number, Status: task.StepStarted, StartCommit: startCommit})
			}

			if err := f.service.SetReviewMode(t.Context(), "task-1", reviewmode.Agent); err != nil {
				t.Fatalf("SetReviewMode() = %v, want nil", err)
			}
			f.wantTaskCalls(t, "reviewMode:task-1:agent")
		})
	}
}

func TestSetReviewModeRefusesATaskWhoseStepsAllStarted(t *testing.T) {
	t.Parallel()

	t.Run("implementation with every step started", func(t *testing.T) {
		t.Parallel()

		f := newFixture(t)
		implementing(f, "task-1", twoStepPlan())
		f.tasks.setStepRun("task-1", task.StepRun{
			Number: 1, Status: task.StepDone, StartCommit: startCommit, CommitSHA: commitSHA,
		})
		f.tasks.setStepRun("task-1", task.StepRun{Number: 2, Status: task.StepStarted, StartCommit: startCommit})

		wantErrIs(t, f.service.SetReviewMode(t.Context(), "task-1", reviewmode.Agent), flow.ErrReviewModeLocked)
		f.wantTaskCalls(t)
	})

	t.Run("the pr stage", func(t *testing.T) {
		t.Parallel()

		f := newFixture(t)
		f.tasks.add("task-1", task.StagePR, task.Artifacts{PRD: true, TechSpec: true, Plan: twoStepPlan()})

		wantErrIs(t, f.service.SetReviewMode(t.Context(), "task-1", reviewmode.Agent), flow.ErrReviewModeLocked)
		wantErrIs(t, f.service.SetReviewMode(t.Context(), "nobody", reviewmode.Agent), task.ErrNotFound)
		f.wantTaskCalls(t)
	})
}

func TestSetStepReviewModeChangesAStepThatHasNotStarted(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())

	if err := f.service.SetStepReviewMode(t.Context(), "task-1", 2, reviewmode.Agent); err != nil {
		t.Fatalf("SetStepReviewMode() = %v, want nil", err)
	}
	f.wantTaskCalls(t, "stepReviewMode:task-1:2:agent")

	if state := f.stepState(t, "task-1", 2); state.ReviewMode != reviewmode.Agent || !state.ModeAdjusted {
		t.Errorf("step 2 = %+v, want it adjusted to agent", state)
	}
}

func TestSetStepReviewModeRefusesAStartedStep(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())
	f.tasks.setStepRun("task-1", task.StepRun{Number: 1, Status: task.StepStarted, StartCommit: startCommit})

	wantErrIs(t, f.service.SetStepReviewMode(t.Context(), "task-1", 1, reviewmode.Agent), flow.ErrStepStarted)
	f.wantTaskCalls(t)
}

func TestSetStepReviewModeOfAStepThePlanDoesNotHave(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())

	wantErrIs(t, f.service.SetStepReviewMode(t.Context(), "task-1", 7, reviewmode.Agent), flow.ErrNoStep)
	wantErrIs(t, f.service.SetStepReviewMode(t.Context(), "nobody", 1, reviewmode.Agent), task.ErrNotFound)
	f.wantTaskCalls(t)
}

func TestReviewModeEditable(t *testing.T) {
	t.Parallel()

	tests := map[string]struct {
		stage task.Stage
		steps []flow.StepState
		want  bool
	}{
		"the prd":  {stage: task.StagePRD, want: true},
		"the plan": {stage: task.StagePlan, want: true},
		"implementation with a step still to start": {
			stage: task.StageImplementation,
			steps: []flow.StepState{stepAt(1, flow.StepDone), stepAt(2, flow.StepNotStarted)},
			want:  true,
		},
		"implementation with every step started": {
			stage: task.StageImplementation,
			steps: []flow.StepState{stepAt(1, flow.StepDone), stepAt(2, flow.StepAgentReview)},
		},
		"the pr stage": {stage: task.StagePR, steps: []flow.StepState{stepAt(1, flow.StepDone)}},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			tk := task.Task{ID: "task-1", Stage: tc.stage}
			if got := flow.ReviewModeEditable(tk, tc.steps); got != tc.want {
				t.Errorf("ReviewModeEditable() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestSetSessionModelOfAReviewerKeepsTheChoiceToItself(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())
	stage := session.StepReviewStage(1)
	f.sessions.setSummary("task-1", session.Summary{Stage: stage, Status: session.StatusWaiting, Idle: true})

	if err := f.service.SetSessionModel(t.Context(), "task-1", stage, aChoice); err != nil {
		t.Fatalf("SetSessionModel() = %v, want nil", err)
	}
	f.wantCalls(t, "choice:task-1:step_review:1:claude-sonnet-5:low")
	// Neither the stage nor the step takes the choice of one reviewer.
	f.wantTaskCalls(t)
}
