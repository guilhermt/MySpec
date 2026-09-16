package store_test

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/store"
	"github.com/guilhermt/myspec/internal/task"
)

// seedTask inserts one task and returns its id.
func seedTask(t *testing.T, s *store.Store) string {
	t.Helper()
	return seedNamedTask(t, s, "task-1", "one")
}

// seedNamedTask inserts a task of the web repository and returns its id.
func seedNamedTask(t *testing.T, s *store.Store, id, name string) string {
	t.Helper()

	if err := s.Tasks.Insert(t.Context(), newTask(id, webRepo, name, fixedTime)); err != nil {
		t.Fatalf("Tasks.Insert() = %v, want nil", err)
	}
	return id
}

// listStepRuns reads the steps of a task, failing the test on error.
func listStepRuns(t *testing.T, s *store.Store, taskID string) []task.StepRun {
	t.Helper()

	runs, err := s.Tasks.ListStepRuns(t.Context(), taskID)
	if err != nil {
		t.Fatalf("ListStepRuns() = %v, want nil", err)
	}
	return runs
}

func TestStepsUpsertCreatesAndUpdates(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	taskID := seedTask(t, s)
	run := newStepRun(taskID, 1, task.StepPreparing)
	if err := s.Tasks.UpsertStepRun(t.Context(), run); err != nil {
		t.Fatalf("UpsertStepRun() = %v, want nil", err)
	}
	if diff := cmp.Diff([]task.StepRun{run}, listStepRuns(t, s, taskID)); diff != "" {
		t.Errorf("ListStepRuns() mismatch (-want +got):\n%s", diff)
	}

	run.Status = task.StepStarted
	run.UpdatedAt = fixedTime.Add(time.Minute)
	if err := s.Tasks.UpsertStepRun(t.Context(), run); err != nil {
		t.Fatalf("UpsertStepRun() again = %v, want nil", err)
	}
	if diff := cmp.Diff([]task.StepRun{run}, listStepRuns(t, s, taskID)); diff != "" {
		t.Errorf("ListStepRuns() after the update mismatch (-want +got):\n%s", diff)
	}
}

func TestStepsCarryTheBlockOnlyWhenBlocked(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	taskID := seedTask(t, s)
	blocked := newBlockedStepRun(taskID, 1)
	if err := s.Tasks.UpsertStepRun(t.Context(), blocked); err != nil {
		t.Fatalf("UpsertStepRun() = %v, want nil", err)
	}
	if diff := cmp.Diff([]task.StepRun{blocked}, listStepRuns(t, s, taskID)); diff != "" {
		t.Errorf("ListStepRuns() mismatch (-want +got):\n%s", diff)
	}

	// Starting the step clears what blocked it.
	started := newStepRun(taskID, 1, task.StepStarted)
	if err := s.Tasks.UpsertStepRun(t.Context(), started); err != nil {
		t.Fatalf("UpsertStepRun(started) = %v, want nil", err)
	}
	got := listStepRuns(t, s, taskID)
	if diff := cmp.Diff([]task.StepRun{started}, got); diff != "" {
		t.Errorf("ListStepRuns() after starting mismatch (-want +got):\n%s", diff)
	}
	if got[0].Block != nil {
		t.Errorf("Block = %+v, want nil", got[0].Block)
	}
}

func TestStepsCarryTheCommitsOfTheStep(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	taskID := seedTask(t, s)
	run := newStepRun(taskID, 1, task.StepStarted)
	run.StartCommit = "1111111111111111111111111111111111111111"
	if err := s.Tasks.UpsertStepRun(t.Context(), run); err != nil {
		t.Fatalf("UpsertStepRun() = %v, want nil", err)
	}
	if diff := cmp.Diff([]task.StepRun{run}, listStepRuns(t, s, taskID)); diff != "" {
		t.Errorf("ListStepRuns() mismatch (-want +got):\n%s", diff)
	}

	run.Status = task.StepDone
	run.CommitSHA = "2222222222222222222222222222222222222222"
	run.CommitSubject = "Add the login screen"
	run.UpdatedAt = fixedTime.Add(time.Minute)
	if err := s.Tasks.UpsertStepRun(t.Context(), run); err != nil {
		t.Fatalf("UpsertStepRun(done) = %v, want nil", err)
	}
	if diff := cmp.Diff([]task.StepRun{run}, listStepRuns(t, s, taskID)); diff != "" {
		t.Errorf("ListStepRuns() after the commit mismatch (-want +got):\n%s", diff)
	}
}

func TestStepsCarryTheAgentReviewOfTheStep(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	taskID := seedTask(t, s)
	run := newStepRun(taskID, 1, task.StepStarted)
	run.ReviewPass, run.ReportedPass, run.Fallback = 4, 3, task.FallbackRoundsExhausted
	if err := s.Tasks.UpsertStepRun(t.Context(), run); err != nil {
		t.Fatalf("UpsertStepRun() = %v, want nil", err)
	}
	if diff := cmp.Diff([]task.StepRun{run}, listStepRuns(t, s, taskID)); diff != "" {
		t.Errorf("ListStepRuns() mismatch (-want +got):\n%s", diff)
	}
}

func TestStepsAreListedByNumber(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	taskID := seedTask(t, s)
	for _, number := range []int{3, 1, 2} {
		if err := s.Tasks.UpsertStepRun(t.Context(), newStepRun(taskID, number, task.StepStarted)); err != nil {
			t.Fatalf("UpsertStepRun(%d) = %v, want nil", number, err)
		}
	}

	runs := listStepRuns(t, s, taskID)
	numbers := make([]int, 0, len(runs))
	for _, run := range runs {
		numbers = append(numbers, run.Number)
	}
	if diff := cmp.Diff([]int{1, 2, 3}, numbers); diff != "" {
		t.Errorf("ListStepRuns() numbers mismatch (-want +got):\n%s", diff)
	}
}

func TestStepsDeleteTakesEveryStepOfTheTask(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	taskID := seedTask(t, s)
	if err := s.Tasks.UpsertStepRun(t.Context(), newStepRun(taskID, 1, task.StepStarted)); err != nil {
		t.Fatalf("UpsertStepRun() = %v, want nil", err)
	}

	if err := s.Tasks.DeleteStepRuns(t.Context(), taskID); err != nil {
		t.Fatalf("DeleteStepRuns() = %v, want nil", err)
	}
	if got := listStepRuns(t, s, taskID); len(got) != 0 {
		t.Errorf("ListStepRuns() returned %d steps, want none", len(got))
	}
	// A task without steps is not an error either.
	if err := s.Tasks.DeleteStepRuns(t.Context(), taskID); err != nil {
		t.Errorf("DeleteStepRuns() again = %v, want nil", err)
	}
}

func TestStepsGoWithTheTask(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	taskID := seedTask(t, s)
	if err := s.Tasks.UpsertStepRun(t.Context(), newStepRun(taskID, 1, task.StepStarted)); err != nil {
		t.Fatalf("UpsertStepRun() = %v, want nil", err)
	}

	if err := s.Tasks.Delete(t.Context(), taskID); err != nil {
		t.Fatalf("Tasks.Delete() = %v, want nil", err)
	}
	if got := listStepRuns(t, s, taskID); len(got) != 0 {
		t.Errorf("ListStepRuns() returned %d steps, want the cascade to have taken them", len(got))
	}
}

func TestStepsRejectAnUnknownTask(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	if err := s.Tasks.UpsertStepRun(t.Context(), newStepRun("nope", 1, task.StepStarted)); err == nil {
		t.Error("UpsertStepRun() = nil, want error")
	}
}
