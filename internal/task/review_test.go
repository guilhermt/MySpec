package task_test

import (
	"errors"
	"testing"

	"github.com/guilhermt/myspec/internal/reviewmode"
	"github.com/guilhermt/myspec/internal/task"
)

func TestTheModeOfAStepIsItsOwnOrTheOneOfTheTask(t *testing.T) {
	t.Parallel()

	m := task.ReviewModes{Task: reviewmode.Agent, Steps: map[int]reviewmode.Mode{2: reviewmode.Manual}}
	if got := m.Step(1); got != reviewmode.Agent {
		t.Errorf("Step(1) = %q, want %q", got, reviewmode.Agent)
	}
	if got := m.Step(2); got != reviewmode.Manual {
		t.Errorf("Step(2) = %q, want %q", got, reviewmode.Manual)
	}
	if !m.Adjusted(2) {
		t.Error("Adjusted(2) = false, want the step to carry a mode of its own")
	}
	if m.Adjusted(1) {
		t.Error("Adjusted(1) = true, want step 1 to follow the task")
	}

	// A task built by hand, without a mode, is reviewed by the user.
	var none task.ReviewModes
	if got := none.Default(); got != reviewmode.Manual {
		t.Errorf("Default() = %q, want %q", got, reviewmode.Manual)
	}
	if got := none.Step(3); got != reviewmode.Manual {
		t.Errorf("Step(3) = %q, want %q", got, reviewmode.Manual)
	}
}

func TestParseReviewFallback(t *testing.T) {
	t.Parallel()

	fallbacks := []task.ReviewFallback{
		"", task.FallbackTakenOver, task.FallbackRoundsExhausted, task.FallbackNoCommit,
	}
	for _, fallback := range fallbacks {
		got, err := task.ParseReviewFallback(string(fallback))
		if err != nil {
			t.Errorf("ParseReviewFallback(%q) = %v, want nil", fallback, err)
		}
		if got != fallback {
			t.Errorf("ParseReviewFallback(%q) = %q, want %q", fallback, got, fallback)
		}
	}

	if _, err := task.ParseReviewFallback("nope"); !errors.Is(err, task.ErrUnknownReviewFallback) {
		t.Errorf("ParseReviewFallback(%q) = %v, want ErrUnknownReviewFallback", "nope", err)
	}
}
