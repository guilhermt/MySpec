package models_test

import (
	"errors"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/models"
)

func TestParseChoiceKeepsWhatItIsGiven(t *testing.T) {
	t.Parallel()

	tests := map[string]struct {
		model, effort string
	}{
		"a model of the catalog":    {model: "claude-opus-5-5[1m]", effort: "high"},
		"a model that takes none":   {model: "claude-haiku-4-5-20251001", effort: ""},
		"neither one nor the other": {model: "gpt", effort: "ultra"},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			got, err := models.ParseChoice(tc.model, tc.effort)
			if err != nil {
				t.Fatalf("ParseChoice(%q, %q) = %v, want nil", tc.model, tc.effort, err)
			}
			want := models.Choice{Model: models.Model(tc.model), Effort: models.Effort(tc.effort)}
			if diff := cmp.Diff(want, got); diff != "" {
				t.Errorf("ParseChoice() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestParseChoiceRejectsAnEmptyModel(t *testing.T) {
	t.Parallel()

	for _, effort := range []string{"high", ""} {
		t.Run("effort "+effort, func(t *testing.T) {
			t.Parallel()

			if _, err := models.ParseChoice("", effort); !errors.Is(err, models.ErrEmptyModel) {
				t.Errorf("ParseChoice(%q, %q) = %v, want models.ErrEmptyModel", "", effort, err)
			}
		})
	}
}

func TestParseStage(t *testing.T) {
	t.Parallel()

	for _, stage := range models.Stages {
		got, err := models.ParseStage(string(stage))
		if err != nil {
			t.Errorf("ParseStage(%q) = %v, want nil", stage, err)
		}
		if got != stage {
			t.Errorf("ParseStage(%q) = %q, want %q", stage, got, stage)
		}
	}

	for _, value := range []string{"commit", "step:1"} {
		if _, err := models.ParseStage(value); !errors.Is(err, models.ErrUnknownStage) {
			t.Errorf("ParseStage(%q) = %v, want models.ErrUnknownStage", value, err)
		}
	}
}

func TestStagesAreInTheOrderOfTheSettings(t *testing.T) {
	t.Parallel()

	want := []models.Stage{
		models.PRD, models.TechSpec, models.Plan, models.OneShot,
		models.Implementation, models.StepReview, models.PR, models.PRReview, models.Discussion,
	}
	if diff := cmp.Diff(want, models.Stages); diff != "" {
		t.Errorf("Stages mismatch (-want +got):\n%s", diff)
	}
}

func TestFactoryIsTheTableOfThePRD(t *testing.T) {
	t.Parallel()

	want := models.Set{
		models.PRD:            {Model: models.Fable51, Effort: models.High},
		models.TechSpec:       {Model: models.Fable51, Effort: models.High},
		models.Plan:           {Model: models.Fable51, Effort: models.High},
		models.OneShot:        {Model: models.Fable51, Effort: models.High},
		models.Implementation: {Model: models.Opus55, Effort: models.High},
		models.StepReview:     {Model: models.Opus55, Effort: models.High},
		models.PR:             {Model: models.Opus55, Effort: models.Medium},
		models.PRReview:       {Model: models.Opus55, Effort: models.High},
		models.Discussion:     {Model: models.Fable51, Effort: models.High},
	}
	if diff := cmp.Diff(want, models.Factory()); diff != "" {
		t.Errorf("Factory() mismatch (-want +got):\n%s", diff)
	}

	// Each call gives a set of its own, so a caller that writes on one never
	// changes what the next call returns.
	touched := models.Factory()
	touched[models.PRD] = models.Choice{Model: models.Sonnet5, Effort: models.Low}
	if diff := cmp.Diff(want, models.Factory()); diff != "" {
		t.Errorf("Factory() after a change mismatch (-want +got):\n%s", diff)
	}
}

func TestCompleteFillsWhatIsMissingOrEmpty(t *testing.T) {
	t.Parallel()

	set := models.Set{
		models.PRD:      {Model: models.Opus55, Effort: models.Max},
		models.Plan:     {Model: "gpt", Effort: models.High},
		models.TechSpec: {Model: "", Effort: models.High},
	}
	want := models.Factory()
	want[models.PRD] = models.Choice{Model: models.Opus55, Effort: models.Max}
	// A model the catalog does not know is not an empty one: it is kept.
	want[models.Plan] = models.Choice{Model: "gpt", Effort: models.High}

	if diff := cmp.Diff(want, models.Complete(set)); diff != "" {
		t.Errorf("Complete() mismatch (-want +got):\n%s", diff)
	}

	argument := models.Set{
		models.PRD:      {Model: models.Opus55, Effort: models.Max},
		models.Plan:     {Model: "gpt", Effort: models.High},
		models.TechSpec: {Model: "", Effort: models.High},
	}
	if diff := cmp.Diff(argument, set); diff != "" {
		t.Errorf("Complete() changed its argument (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff(models.Factory(), models.Complete(nil)); diff != "" {
		t.Errorf("Complete(nil) mismatch (-want +got):\n%s", diff)
	}
}

func TestCompleteGivesTheOneShotPlanningToDefaultsSavedBeforeIt(t *testing.T) {
	t.Parallel()

	saved := models.Factory()
	delete(saved, models.OneShot)
	saved[models.Plan] = models.Choice{Model: models.Opus55, Effort: models.Max}

	want := models.Factory()
	want[models.Plan] = models.Choice{Model: models.Opus55, Effort: models.Max}
	if diff := cmp.Diff(want, models.Complete(saved)); diff != "" {
		t.Errorf("Complete() mismatch (-want +got):\n%s", diff)
	}
}
