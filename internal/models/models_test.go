package models_test

import (
	"errors"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/models"
)

func TestParseChoiceAcceptsEveryModelAndEffort(t *testing.T) {
	t.Parallel()

	for _, model := range models.Models {
		for _, effort := range models.Efforts {
			t.Run(string(model)+" "+string(effort), func(t *testing.T) {
				t.Parallel()

				got, err := models.ParseChoice(string(model), string(effort))
				if err != nil {
					t.Fatalf("ParseChoice(%q, %q) = %v, want nil", model, effort, err)
				}
				want := models.Choice{Model: model, Effort: effort}
				if diff := cmp.Diff(want, got); diff != "" {
					t.Errorf("ParseChoice() mismatch (-want +got):\n%s", diff)
				}
				if !got.Valid() {
					t.Error("Valid() = false, want a parsed choice to be valid")
				}
			})
		}
	}
}

func TestParseChoiceRejectsWhatTheAppDoesNotOffer(t *testing.T) {
	t.Parallel()

	tests := map[string]struct {
		model, effort string
		want          error
	}{
		"unknown model":  {model: "claude-haiku-4-5", effort: "high", want: models.ErrUnknownModel},
		"unknown effort": {model: "claude-opus-5", effort: "ultra", want: models.ErrUnknownEffort},
		// The model is checked first, so an empty pair fails on it.
		"neither": {model: "", effort: "", want: models.ErrUnknownModel},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			if _, err := models.ParseChoice(tc.model, tc.effort); !errors.Is(err, tc.want) {
				t.Errorf("ParseChoice(%q, %q) = %v, want %v", tc.model, tc.effort, err, tc.want)
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
		models.Implementation: {Model: models.Opus5, Effort: models.High},
		models.StepReview:     {Model: models.Opus5, Effort: models.High},
		models.PR:             {Model: models.Opus5, Effort: models.Medium},
		models.PRReview:       {Model: models.Opus5, Effort: models.High},
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

func TestCompleteFillsWhatIsMissingOrInvalid(t *testing.T) {
	t.Parallel()

	set := models.Set{
		models.PRD:  {Model: models.Opus5, Effort: models.Max},
		models.Plan: {Model: "gpt", Effort: models.High},
	}
	want := models.Factory()
	want[models.PRD] = models.Choice{Model: models.Opus5, Effort: models.Max}

	if diff := cmp.Diff(want, models.Complete(set)); diff != "" {
		t.Errorf("Complete() mismatch (-want +got):\n%s", diff)
	}

	argument := models.Set{
		models.PRD:  {Model: models.Opus5, Effort: models.Max},
		models.Plan: {Model: "gpt", Effort: models.High},
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
	saved[models.Plan] = models.Choice{Model: models.Opus5, Effort: models.Max}

	want := models.Factory()
	want[models.Plan] = models.Choice{Model: models.Opus5, Effort: models.Max}
	if diff := cmp.Diff(want, models.Complete(saved)); diff != "" {
		t.Errorf("Complete() mismatch (-want +got):\n%s", diff)
	}
}
