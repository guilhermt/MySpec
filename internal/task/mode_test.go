package task_test

import (
	"errors"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/task"
)

func TestParseMode(t *testing.T) {
	t.Parallel()

	for _, mode := range task.Modes {
		got, err := task.ParseMode(string(mode))
		if err != nil {
			t.Errorf("ParseMode(%q) = %v, want nil", mode, err)
		}
		if got != mode {
			t.Errorf("ParseMode(%q) = %q, want %q", mode, got, mode)
		}
	}

	for _, value := range []string{"", "one-shot", "Structured", "prd"} {
		if _, err := task.ParseMode(value); !errors.Is(err, task.ErrUnknownMode) {
			t.Errorf("ParseMode(%q) = %v, want ErrUnknownMode", value, err)
		}
	}
}

func TestModesAreOfferedStructuredFirst(t *testing.T) {
	t.Parallel()

	want := []task.Mode{task.ModeStructured, task.ModeOneShot}
	if diff := cmp.Diff(want, task.Modes); diff != "" {
		t.Errorf("Modes mismatch (-want +got):\n%s", diff)
	}
}

func TestEachModeHasItsOrderOfStages(t *testing.T) {
	t.Parallel()

	structured := []task.Stage{
		task.StagePRD, task.StageTechSpec, task.StagePlan, task.StageImplementation, task.StagePR,
	}
	tests := map[string]struct {
		mode task.Mode
		want []task.Stage
	}{
		"structured": {mode: task.ModeStructured, want: structured},
		"one-shot":   {mode: task.ModeOneShot, want: []task.Stage{task.StageOneShot, task.StageImplementation, task.StagePR}},
		// A task built by hand in a test has no mode, and is Structured.
		"no mode": {mode: "", want: structured},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			if diff := cmp.Diff(tc.want, tc.mode.Stages()); diff != "" {
				t.Errorf("Stages() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestModeIndexIsThePositionOfAStageInTheMode(t *testing.T) {
	t.Parallel()

	tests := map[string]struct {
		mode  task.Mode
		stage task.Stage
		want  int
	}{
		"the plan of a structured task":          {mode: task.ModeStructured, stage: task.StagePlan, want: 2},
		"the tech spec of a task with no mode":   {mode: "", stage: task.StageTechSpec, want: 1},
		"the planning of a one-shot task":        {mode: task.ModeOneShot, stage: task.StageOneShot, want: 0},
		"the implementation of a one-shot task":  {mode: task.ModeOneShot, stage: task.StageImplementation, want: 1},
		"the prd, which a one-shot task lacks":   {mode: task.ModeOneShot, stage: task.StagePRD, want: -1},
		"the planning, which structured lacks":   {mode: task.ModeStructured, stage: task.StageOneShot, want: -1},
		"a stage no mode has":                    {mode: task.ModeStructured, stage: "nonsense", want: -1},
		"the pull request of a one-shot task":    {mode: task.ModeOneShot, stage: task.StagePR, want: 2},
		"the pull request of a structured task":  {mode: task.ModeStructured, stage: task.StagePR, want: 4},
		"the implementation of a structured one": {mode: task.ModeStructured, stage: task.StageImplementation, want: 3},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			if got := tc.mode.Index(tc.stage); got != tc.want {
				t.Errorf("%q.Index(%q) = %d, want %d", tc.mode, tc.stage, got, tc.want)
			}
		})
	}
}

func TestModeNextIsTheStageAfterInTheMode(t *testing.T) {
	t.Parallel()

	tests := []struct {
		mode  task.Mode
		stage task.Stage
		next  task.Stage
		ok    bool
	}{
		{task.ModeStructured, task.StagePRD, task.StageTechSpec, true},
		{task.ModeStructured, task.StageTechSpec, task.StagePlan, true},
		{task.ModeStructured, task.StagePlan, task.StageImplementation, true},
		{task.ModeStructured, task.StageImplementation, task.StagePR, true},
		{task.ModeStructured, task.StagePR, "", false},
		{task.ModeStructured, task.StageOneShot, "", false},
		{"", task.StagePlan, task.StageImplementation, true},
		{task.ModeOneShot, task.StageOneShot, task.StageImplementation, true},
		{task.ModeOneShot, task.StageImplementation, task.StagePR, true},
		{task.ModeOneShot, task.StagePR, "", false},
		{task.ModeOneShot, task.StagePRD, "", false},
		{task.ModeOneShot, "nonsense", "", false},
	}

	for _, test := range tests {
		next, ok := test.mode.Next(test.stage)
		if next != test.next || ok != test.ok {
			t.Errorf("%q.Next(%q) = %q, %t, want %q, %t", test.mode, test.stage, next, ok, test.next, test.ok)
		}
	}
}

func TestModeFromListsAStageAndTheOnesAfterIt(t *testing.T) {
	t.Parallel()

	tests := map[string]struct {
		mode  task.Mode
		stage task.Stage
		want  []task.Stage
	}{
		"the tech spec of a structured task": {
			mode:  task.ModeStructured,
			stage: task.StageTechSpec,
			want:  []task.Stage{task.StageTechSpec, task.StagePlan, task.StageImplementation, task.StagePR},
		},
		"the plan of a task with no mode": {
			mode:  "",
			stage: task.StagePlan,
			want:  []task.Stage{task.StagePlan, task.StageImplementation, task.StagePR},
		},
		"the planning of a one-shot task": {
			mode:  task.ModeOneShot,
			stage: task.StageOneShot,
			want:  []task.Stage{task.StageOneShot, task.StageImplementation, task.StagePR},
		},
		"the implementation of a one-shot task": {
			mode:  task.ModeOneShot,
			stage: task.StageImplementation,
			want:  []task.Stage{task.StageImplementation, task.StagePR},
		},
		"the prd, which a one-shot task lacks": {mode: task.ModeOneShot, stage: task.StagePRD},
		"the planning, which structured lacks": {mode: task.ModeStructured, stage: task.StageOneShot},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			if diff := cmp.Diff(tc.want, tc.mode.From(tc.stage)); diff != "" {
				t.Errorf("From() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestModeFromIsACopy(t *testing.T) {
	t.Parallel()

	from := task.ModeOneShot.From(task.StageOneShot)
	from[0] = task.StagePRD

	if got := task.ModeOneShot.Stages()[0]; got != task.StageOneShot {
		t.Errorf("Stages()[0] = %q after a change to From(), want %q", got, task.StageOneShot)
	}
}

func TestEachModeHasItsStagesWithAChoiceOfModel(t *testing.T) {
	t.Parallel()

	structured := []models.Stage{
		models.PRD, models.TechSpec, models.Plan, models.Implementation, models.StepReview, models.PR, models.PRReview,
	}
	tests := map[string]struct {
		mode task.Mode
		want []models.Stage
	}{
		"structured": {mode: task.ModeStructured, want: structured},
		"one-shot": {
			mode: task.ModeOneShot,
			want: []models.Stage{models.OneShot, models.Implementation, models.StepReview, models.PR, models.PRReview},
		},
		"no mode": {mode: "", want: structured},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			if diff := cmp.Diff(tc.want, tc.mode.ModelStages()); diff != "" {
				t.Errorf("ModelStages() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
