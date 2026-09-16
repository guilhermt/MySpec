package task_test

import (
	"errors"
	"testing"

	"github.com/guilhermt/myspec/internal/task"
)

func TestParsePRStatus(t *testing.T) {
	t.Parallel()

	statuses := []task.PRStatus{
		task.PRPreparing, task.PRBlocked, task.PRDrafting, task.PROpening,
		task.PRReviewing, task.PRCommitting, task.PRDone, task.PRClosing, task.PRClosed,
	}
	for _, status := range statuses {
		got, err := task.ParsePRStatus(string(status))
		if err != nil {
			t.Errorf("ParsePRStatus(%q) = %v, want nil", status, err)
		}
		if got != status {
			t.Errorf("ParsePRStatus(%q) = %q, want %q", status, got, status)
		}
	}

	for _, value := range []string{"", "Preparing", "started", "merged", "skipped"} {
		if _, err := task.ParsePRStatus(value); !errors.Is(err, task.ErrUnknownPRStatus) {
			t.Errorf("ParsePRStatus(%q) = %v, want ErrUnknownPRStatus", value, err)
		}
	}
}

func TestParsePRBlockReason(t *testing.T) {
	t.Parallel()

	reasons := []task.PRBlockReason{
		task.PRBlockGHMissing, task.PRBlockGHAuth, task.PRBlockGHFailed,
		task.PRBlockGitFailed, task.PRBlockNoWorktree,
	}
	for _, reason := range reasons {
		got, err := task.ParsePRBlockReason(string(reason))
		if err != nil {
			t.Errorf("ParsePRBlockReason(%q) = %v, want nil", reason, err)
		}
		if got != reason {
			t.Errorf("ParsePRBlockReason(%q) = %q, want %q", reason, got, reason)
		}
	}

	for _, value := range []string{"", "dirty_worktree", "gh"} {
		if _, err := task.ParsePRBlockReason(value); !errors.Is(err, task.ErrUnknownPRBlockReason) {
			t.Errorf("ParsePRBlockReason(%q) = %v, want ErrUnknownPRBlockReason", value, err)
		}
	}
}

func TestParsePRState(t *testing.T) {
	t.Parallel()

	for _, state := range []task.PRState{task.PRStateOpen, task.PRStateMerged, task.PRStateClosed} {
		got, err := task.ParsePRState(string(state))
		if err != nil {
			t.Errorf("ParsePRState(%q) = %v, want nil", state, err)
		}
		if got != state {
			t.Errorf("ParsePRState(%q) = %q, want %q", state, got, state)
		}
	}

	// A pull request nothing was read about yet has no state, which is stored
	// as the empty string.
	got, err := task.ParsePRState("")
	if err != nil || got != "" {
		t.Errorf(`ParsePRState("") = %q, %v, want "", nil`, got, err)
	}

	for _, value := range []string{"OPEN", "draft", "opened"} {
		if _, err := task.ParsePRState(value); !errors.Is(err, task.ErrUnknownPRState) {
			t.Errorf("ParsePRState(%q) = %v, want ErrUnknownPRState", value, err)
		}
	}
}
