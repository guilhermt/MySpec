package flow_test

import (
	"slices"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

// rule is what a test expects of one stage: whether its model can still
// change and whether a session of it runs now.
type rule struct {
	Editable bool
	Live     bool
}

// rulesOf is what every stage allows, by stage.
func rulesOf(states []flow.StageModelState) map[models.Stage]rule {
	got := make(map[models.Stage]rule, len(states))
	for _, state := range states {
		got[state.Stage] = rule{Editable: state.Editable, Live: state.Live}
	}
	return got
}

// stepAt is one step of a plan in the state a test wants to read the stages
// against.
func stepAt(number int, status flow.StepStatus) flow.StepState {
	return flow.StepState{Step: task.Step{Number: number}, Status: status}
}

func TestStageModelsSayWhatCanStillChange(t *testing.T) {
	t.Parallel()

	tests := map[string]struct {
		stage task.Stage
		steps []flow.StepState
		repos []flow.RepoState
		want  map[models.Stage]rule
	}{
		"the prd, which starts with the task": {
			stage: task.StagePRD,
			want: map[models.Stage]rule{
				models.PRD:            {Live: true},
				models.TechSpec:       {Editable: true},
				models.Plan:           {Editable: true},
				models.Implementation: {Editable: true},
				models.StepReview:     {Editable: true},
				models.PR:             {Editable: true},
				models.PRReview:       {Editable: true},
			},
		},
		"the tech spec, whose session runs": {
			stage: task.StageTechSpec,
			want: map[models.Stage]rule{
				models.PRD:            {},
				models.TechSpec:       {Live: true},
				models.Plan:           {Editable: true},
				models.Implementation: {Editable: true},
				models.StepReview:     {Editable: true},
				models.PR:             {Editable: true},
				models.PRReview:       {Editable: true},
			},
		},
		"implementation with a step still to start": {
			stage: task.StageImplementation,
			steps: []flow.StepState{stepAt(1, flow.StepImplementing), stepAt(2, flow.StepNotStarted)},
			want: map[models.Stage]rule{
				models.PRD:            {},
				models.TechSpec:       {},
				models.Plan:           {},
				models.Implementation: {Editable: true, Live: true},
				models.StepReview:     {Editable: true},
				models.PR:             {Editable: true},
				models.PRReview:       {Editable: true},
			},
		},
		"implementation with every step started": {
			stage: task.StageImplementation,
			steps: []flow.StepState{stepAt(1, flow.StepDone), stepAt(2, flow.StepAwaitingReview)},
			want: map[models.Stage]rule{
				models.PRD:            {},
				models.TechSpec:       {},
				models.Plan:           {},
				models.Implementation: {Live: true},
				models.StepReview:     {Editable: true},
				models.PR:             {Editable: true},
				models.PRReview:       {Editable: true},
			},
		},
		"implementation with a reviewer at work": {
			stage: task.StageImplementation,
			steps: []flow.StepState{
				stepAt(1, flow.StepDone),
				{Step: task.Step{Number: 2}, Status: flow.StepAgentReview, ReviewerStage: session.StepReviewStage(2)},
			},
			want: map[models.Stage]rule{
				models.PRD:            {},
				models.TechSpec:       {},
				models.Plan:           {},
				models.Implementation: {Live: true},
				models.StepReview:     {Editable: true, Live: true},
				models.PR:             {Editable: true},
				models.PRReview:       {Editable: true},
			},
		},
		"a pull request being drafted, with a repository still to prepare": {
			stage: task.StagePR,
			repos: []flow.RepoState{
				{Slug: "api", Status: flow.RepoDrafting, SessionStage: session.PRStage("api")},
				{Slug: "web", Status: flow.RepoPreparing},
			},
			want: map[models.Stage]rule{
				models.PRD:            {},
				models.TechSpec:       {},
				models.Plan:           {},
				models.Implementation: {},
				models.StepReview:     {},
				models.PR:             {Editable: true, Live: true},
				models.PRReview:       {Editable: true},
			},
		},
		"every pull request under review": {
			stage: task.StagePR,
			repos: []flow.RepoState{
				{Slug: "api", Status: flow.RepoReviewing, SessionStage: session.PRReviewStage("api")},
				{Slug: "web", Status: flow.RepoReviewing, SessionStage: session.PRReviewStage("web")},
			},
			want: map[models.Stage]rule{
				models.PRD:            {},
				models.TechSpec:       {},
				models.Plan:           {},
				models.Implementation: {},
				models.StepReview:     {},
				models.PR:             {},
				models.PRReview:       {Live: true},
			},
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			tk := task.Task{ID: "task-1", Stage: tc.stage}
			got := rulesOf(flow.StageModels(tk, tc.steps, tc.repos))
			if diff := cmp.Diff(tc.want, got); diff != "" {
				t.Errorf("stage models mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestStageModelsCarryTheChoiceOfTheTask(t *testing.T) {
	t.Parallel()

	tk := task.Task{ID: "task-1", Stage: task.StagePRD, Models: task.Models{
		Stages: models.Set{models.PR: {Model: models.Sonnet5, Effort: models.Low}},
	}}
	got := flow.StageModels(tk, nil, nil)

	// The stage the task has a choice for brings it; the ones it lacks bring
	// the factory choice.
	want := models.Factory()
	want[models.PR] = models.Choice{Model: models.Sonnet5, Effort: models.Low}
	if len(got) != len(models.Stages) {
		t.Fatalf("stages = %d, want the %d of the workflow", len(got), len(models.Stages))
	}
	for i, state := range got {
		if state.Stage != models.Stages[i] {
			t.Errorf("stage %d = %q, want %q", i, state.Stage, models.Stages[i])
		}
		if diff := cmp.Diff(want[state.Stage], state.Choice); diff != "" {
			t.Errorf("choice of %s mismatch (-want +got):\n%s", state.Stage, diff)
		}
	}
}

func TestSessionsStartWithTheChoiceOfTheirStage(t *testing.T) {
	t.Parallel()

	t.Run("the prd of a new task", func(t *testing.T) {
		t.Parallel()

		f := newFixture(t)
		want := models.Choice{Model: models.Fable51, Effort: models.XHigh}
		f.tasks.setModels("task-1", task.Models{Stages: models.Set{models.PRD: want}})
		created := f.tasks.add("task-1", task.StagePRD, task.Artifacts{})

		if err := f.service.StartTask(t.Context(), created); err != nil {
			t.Fatalf("StartTask() = %v, want nil", err)
		}
		wantChoice(t, f, session.Key{TaskID: "task-1", Stage: string(task.StagePRD)}, want)
	})

	t.Run("the pull request of a repository", func(t *testing.T) {
		t.Parallel()

		f := newFixture(t)
		want := models.Choice{Model: models.Fable51, Effort: models.Low}
		f.tasks.setModels("task-1", task.Models{Stages: models.Set{models.PR: want}})
		startPR(t, f, plan())

		f.waitPRSession(t, "task-1", "api")
		wantChoice(t, f, prSession("task-1", "api"), want)
	})

	t.Run("the review of a pull request", func(t *testing.T) {
		t.Parallel()

		f := newFixture(t)
		want := models.Choice{Model: models.Sonnet5, Effort: models.High}
		f.tasks.setModels("task-1", task.Models{Stages: models.Set{models.PRReview: want}})
		underReview(t, f)

		wantChoice(t, f, reviewKeyOf, want)
	})
}

func TestAStepStartsWithTheChoiceOfImplementationAndKeepsIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	want := models.Choice{Model: models.Opus5, Effort: models.XHigh}
	f.tasks.setModels("task-1", task.Models{Stages: models.Set{models.Implementation: want}})
	f.tasks.add("task-1", task.StagePlan, task.Artifacts{PRD: true, TechSpec: true, Plan: twoStepPlan()})
	f.sessions.setSummary("task-1", idle(task.StagePlan))

	f.service.Check("task-1")
	f.waitStep(t, "task-1", 1, flow.StepImplementing)
	f.waitStepSession(t, "task-1", 1)

	wantChoice(t, f, session.Key{TaskID: "task-1", Stage: session.StepStage(1)}, want)
	// The choice is written on the step, so that a later change of
	// implementation no longer reaches it.
	if calls := f.tasks.recorded(); !slices.Contains(calls, "stepModel:task-1:1:claude-opus-5:xhigh") {
		t.Errorf("task calls = %v, want the model of step 1 recorded", calls)
	}
}

func TestAnAdjustedStepStartsWithItsOwnChoice(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	want := models.Choice{Model: models.Sonnet5, Effort: models.Low}
	f.tasks.setModels("task-1", task.Models{Steps: map[int]models.Choice{1: want}})
	f.tasks.add("task-1", task.StagePlan, task.Artifacts{PRD: true, TechSpec: true, Plan: twoStepPlan()})
	f.sessions.setSummary("task-1", idle(task.StagePlan))

	f.service.Check("task-1")
	f.waitStep(t, "task-1", 1, flow.StepImplementing)
	f.waitStepSession(t, "task-1", 1)

	wantChoice(t, f, session.Key{TaskID: "task-1", Stage: session.StepStage(1)}, want)
	// The step already had a choice of its own: there is nothing to freeze.
	recorded := f.tasks.recorded()
	if slices.ContainsFunc(recorded, func(call string) bool { return strings.HasPrefix(call, "stepModel:") }) {
		t.Errorf("task calls = %v, want no model recorded for a step that had one", recorded)
	}
}

func TestStepsCarryTheirChoice(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	frozen := models.Choice{Model: models.Sonnet5, Effort: models.XHigh}
	adjusted := models.Choice{Model: models.Fable51, Effort: models.Max}
	ofStage := models.Choice{Model: models.Opus5, Effort: models.High}
	f.tasks.setModels("task-1", task.Models{
		Stages: models.Set{models.Implementation: ofStage},
		Steps:  map[int]models.Choice{1: frozen, 2: adjusted},
	})
	implementing(f, "task-1", threeStepPlan())
	f.tasks.setStepRun("task-1", task.StepRun{Number: 1, Status: task.StepStarted, StartCommit: startCommit})

	type choiceOfStep struct {
		Number   int
		Choice   models.Choice
		Adjusted bool
	}
	got := make([]choiceOfStep, 0, 3)
	for _, state := range f.service.Steps("task-1") {
		got = append(got, choiceOfStep{Number: state.Step.Number, Choice: state.Choice, Adjusted: state.Adjusted})
	}
	// The step that started keeps what it ran with, and shows it plainly: only
	// a step still to start is the one a change of implementation reaches.
	want := []choiceOfStep{
		{Number: 1, Choice: frozen},
		{Number: 2, Choice: adjusted, Adjusted: true},
		{Number: 3, Choice: ofStage},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("steps mismatch (-want +got):\n%s", diff)
	}
}

func TestSetStageModelChangesAStageStillToStart(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.add("task-1", task.StagePRD, task.Artifacts{})

	if err := f.service.SetStageModel(t.Context(), "task-1", models.TechSpec, aChoice); err != nil {
		t.Fatalf("SetStageModel() = %v, want nil", err)
	}
	f.wantTaskCalls(t, "model:task-1:tech_spec:claude-sonnet-5:low")
}

func TestSetStageModelRefusesAStageThatStarted(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.add("task-1", task.StageTechSpec, task.Artifacts{PRD: true})

	// The session of the tech spec runs, and the one of the PRD is behind it.
	wantErrIs(t, f.service.SetStageModel(t.Context(), "task-1", models.TechSpec, aChoice), flow.ErrModelLocked)
	wantErrIs(t, f.service.SetStageModel(t.Context(), "task-1", models.PRD, aChoice), flow.ErrModelLocked)
	wantErrIs(t, f.service.SetStageModel(t.Context(), "nobody", models.PRD, aChoice), task.ErrNotFound)
	f.wantTaskCalls(t)
}

func TestSetStepModelChangesAStepThatHasNotStarted(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())

	if err := f.service.SetStepModel(t.Context(), "task-1", 2, aChoice); err != nil {
		t.Fatalf("SetStepModel() = %v, want nil", err)
	}
	f.wantTaskCalls(t, "stepModel:task-1:2:claude-sonnet-5:low")

	if state := f.stepState(t, "task-1", 2); !state.Adjusted {
		t.Errorf("step 2 = %+v, want it adjusted", state)
	}
}

func TestSetStepModelRefusesAStartedStep(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())
	f.tasks.setStepRun("task-1", task.StepRun{Number: 1, Status: task.StepStarted, StartCommit: startCommit})

	wantErrIs(t, f.service.SetStepModel(t.Context(), "task-1", 1, aChoice), flow.ErrStepStarted)
	f.wantTaskCalls(t)
}

func TestSetStepModelOfAStepThePlanDoesNotHave(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())

	wantErrIs(t, f.service.SetStepModel(t.Context(), "task-1", 7, aChoice), flow.ErrNoStep)
	wantErrIs(t, f.service.SetStepModel(t.Context(), "nobody", 1, aChoice), task.ErrNotFound)
	f.wantTaskCalls(t)
}

func TestSetSessionModelCarriesTheChangeToTheStageOrTheStep(t *testing.T) {
	t.Parallel()

	tests := map[string]struct {
		taskStage task.Stage
		stage     string
		wantTask  []string
	}{
		"a planning stage": {
			taskStage: task.StagePRD,
			stage:     string(task.StagePRD),
			wantTask:  []string{"model:task-1:prd:claude-sonnet-5:low"},
		},
		"a step": {
			taskStage: task.StageImplementation,
			stage:     session.StepStage(1),
			wantTask:  []string{"stepModel:task-1:1:claude-sonnet-5:low"},
		},
		// The choice of one repository is that repository's alone.
		"a repository": {taskStage: task.StagePR, stage: session.PRStage("api")},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			f.tasks.add("task-1", tc.taskStage, task.Artifacts{PRD: true, TechSpec: true, Plan: plan()})
			f.sessions.setSummary("task-1", session.Summary{
				Stage: tc.stage, Status: session.StatusWaiting, Idle: true,
			})

			if err := f.service.SetSessionModel(t.Context(), "task-1", tc.stage, aChoice); err != nil {
				t.Fatalf("SetSessionModel() = %v, want nil", err)
			}
			f.wantCalls(t, "choice:task-1:"+tc.stage+":claude-sonnet-5:low")
			f.wantTaskCalls(t, tc.wantTask...)
		})
	}
}

func TestSetSessionModelOfAnEndedConversationChangesNothing(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.add("task-1", task.StagePRD, task.Artifacts{})

	err := f.service.SetSessionModel(t.Context(), "task-1", string(task.StagePRD), aChoice)
	wantErrIs(t, err, session.ErrNotFound)
	f.wantTaskCalls(t)
}

// aChoice is the model and effort the operations of the flow are asked for.
var aChoice = models.Choice{Model: models.Sonnet5, Effort: models.Low}

// threeStepPlan is a plan whose steps all live in the first repository of the
// fake workspace.
func threeStepPlan() task.Plan {
	return task.Plan{
		Present: true,
		Steps: []task.Step{
			{Number: 1, File: "1-first.md", Title: "First", Repository: "api", RepoPath: repos[0].Path},
			{Number: 2, File: "2-second.md", Title: "Second", Repository: "api", RepoPath: repos[0].Path},
			{Number: 3, File: "3-third.md", Title: "Third", Repository: "api", RepoPath: repos[0].Path},
		},
	}
}

// wantChoice fails the test unless the session was started with a choice.
func wantChoice(t *testing.T, f *fixture, k session.Key, want models.Choice) {
	t.Helper()

	info, ok := f.sessions.info(k)
	if !ok {
		t.Fatalf("the session %s of %s was never started", k.Stage, k.TaskID)
	}
	if diff := cmp.Diff(want, info.Choice); diff != "" {
		t.Errorf("choice of %s mismatch (-want +got):\n%s", k.Stage, diff)
	}
}
