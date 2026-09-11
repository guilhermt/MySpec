package task_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/task"
)

func TestTheModelOfAStageFallsBackToTheFactory(t *testing.T) {
	t.Parallel()

	if diff := cmp.Diff(models.Factory()[models.PR], task.Models{}.Stage(models.PR)); diff != "" {
		t.Errorf("Stage() of an empty task mismatch (-want +got):\n%s", diff)
	}

	want := models.Choice{Model: models.Sonnet5, Effort: models.Low}
	m := task.Models{Stages: models.Set{models.PR: want}}
	if diff := cmp.Diff(want, m.Stage(models.PR)); diff != "" {
		t.Errorf("Stage() mismatch (-want +got):\n%s", diff)
	}
}

func TestTheModelOfAStepIsItsOwnOrTheOneOfImplementation(t *testing.T) {
	t.Parallel()

	own := models.Choice{Model: models.Opus5, Effort: models.Max}
	implementation := models.Choice{Model: models.Sonnet5, Effort: models.Medium}
	m := task.Models{
		Stages: models.Set{models.Implementation: implementation},
		Steps:  map[int]models.Choice{2: own},
	}

	if !m.Adjusted(2) {
		t.Error("Adjusted(2) = false, want a step with a choice of its own")
	}
	if diff := cmp.Diff(own, m.Step(2)); diff != "" {
		t.Errorf("Step(2) mismatch (-want +got):\n%s", diff)
	}
	if m.Adjusted(1) {
		t.Error("Adjusted(1) = true, want a step that follows implementation")
	}
	if diff := cmp.Diff(implementation, m.Step(1)); diff != "" {
		t.Errorf("Step(1) mismatch (-want +got):\n%s", diff)
	}
}
