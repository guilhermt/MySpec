package store_test

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/store"
	"github.com/guilhermt/myspec/internal/task"
)

// newPRRun builds the record of the PR stage of a repository, ready to upsert.
func newPRRun(taskID, repoPath string, status task.PRStatus) task.PRRun {
	return task.PRRun{
		TaskID:    taskID,
		RepoPath:  repoPath,
		Status:    status,
		CreatedAt: fixedTime,
		UpdatedAt: fixedTime,
	}
}

// listPRRuns reads the PR runs of a task, failing the test on error.
func listPRRuns(t *testing.T, s *store.Store, taskID string) []task.PRRun {
	t.Helper()

	runs, err := s.Tasks.ListPRRuns(t.Context(), taskID)
	if err != nil {
		t.Fatalf("ListPRRuns() = %v, want nil", err)
	}
	return runs
}

func TestPRRunsUpsertCreatesAndUpdates(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	taskID := seedTask(t, s)
	run := newPRRun(taskID, "/ws/api", task.PRPreparing)
	if err := s.Tasks.UpsertPRRun(t.Context(), run); err != nil {
		t.Fatalf("UpsertPRRun() = %v, want nil", err)
	}
	if diff := cmp.Diff([]task.PRRun{run}, listPRRuns(t, s, taskID)); diff != "" {
		t.Errorf("ListPRRuns() mismatch (-want +got):\n%s", diff)
	}

	run.Status = task.PRReviewing
	run.PR = task.PRDetails{
		Number: 12, URL: "https://github.com/acme/api/pull/12",
		State: task.PRStateOpen, CheckedAt: fixedTime.Add(time.Minute),
	}
	run.ReviewedCommit = "abc1234"
	run.ReportedPass = 2
	run.UpdatedAt = fixedTime.Add(time.Minute)
	if err := s.Tasks.UpsertPRRun(t.Context(), run); err != nil {
		t.Fatalf("UpsertPRRun() again = %v, want nil", err)
	}
	if diff := cmp.Diff([]task.PRRun{run}, listPRRuns(t, s, taskID)); diff != "" {
		t.Errorf("ListPRRuns() after the update mismatch (-want +got):\n%s", diff)
	}
}

func TestPRRunsCarryTheBlockOnlyWhenBlocked(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	taskID := seedTask(t, s)
	blocked := newPRRun(taskID, "/ws/api", task.PRBlocked)
	blocked.Block = &task.PRBlock{
		Reason: task.PRBlockGHAuth,
		Detail: "gh: You are not logged into any GitHub hosts",
	}
	if err := s.Tasks.UpsertPRRun(t.Context(), blocked); err != nil {
		t.Fatalf("UpsertPRRun() = %v, want nil", err)
	}
	if diff := cmp.Diff([]task.PRRun{blocked}, listPRRuns(t, s, taskID)); diff != "" {
		t.Errorf("ListPRRuns() mismatch (-want +got):\n%s", diff)
	}

	// Starting the stage clears what blocked it.
	drafting := newPRRun(taskID, "/ws/api", task.PRDrafting)
	if err := s.Tasks.UpsertPRRun(t.Context(), drafting); err != nil {
		t.Fatalf("UpsertPRRun(drafting) = %v, want nil", err)
	}
	got := listPRRuns(t, s, taskID)
	if diff := cmp.Diff([]task.PRRun{drafting}, got); diff != "" {
		t.Errorf("ListPRRuns() after starting mismatch (-want +got):\n%s", diff)
	}
	if got[0].Block != nil {
		t.Errorf("Block = %+v, want nil", got[0].Block)
	}
}

func TestPRRunsWithoutAReadingCarryNoInstant(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	taskID := seedTask(t, s)
	if err := s.Tasks.UpsertPRRun(t.Context(), newPRRun(taskID, "/ws/api", task.PRDrafting)); err != nil {
		t.Fatalf("UpsertPRRun() = %v, want nil", err)
	}

	got := listPRRuns(t, s, taskID)
	if !got[0].PR.CheckedAt.IsZero() {
		t.Errorf("PR.CheckedAt = %v, want the zero instant", got[0].PR.CheckedAt)
	}
	if got[0].PR.State != "" {
		t.Errorf("PR.State = %q, want no state", got[0].PR.State)
	}
}

func TestPRRunsAreListedByRepository(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	taskID := seedTask(t, s)
	for _, repo := range []string{"/ws/web", "/ws/api", "/ws/core"} {
		if err := s.Tasks.UpsertPRRun(t.Context(), newPRRun(taskID, repo, task.PRDrafting)); err != nil {
			t.Fatalf("UpsertPRRun(%s) = %v, want nil", repo, err)
		}
	}

	runs := listPRRuns(t, s, taskID)
	paths := make([]string, 0, len(runs))
	for _, run := range runs {
		paths = append(paths, run.RepoPath)
	}
	if diff := cmp.Diff([]string{"/ws/api", "/ws/core", "/ws/web"}, paths); diff != "" {
		t.Errorf("ListPRRuns() paths mismatch (-want +got):\n%s", diff)
	}
}

func TestPRRunsDeleteTakesEveryRepositoryOfTheTask(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	taskID := seedTask(t, s)
	if err := s.Tasks.UpsertPRRun(t.Context(), newPRRun(taskID, "/ws/api", task.PRDrafting)); err != nil {
		t.Fatalf("UpsertPRRun() = %v, want nil", err)
	}

	if err := s.Tasks.DeletePRRuns(t.Context(), taskID); err != nil {
		t.Fatalf("DeletePRRuns() = %v, want nil", err)
	}
	if got := listPRRuns(t, s, taskID); len(got) != 0 {
		t.Errorf("ListPRRuns() returned %d runs, want none", len(got))
	}
	// A task without PR runs is not an error either.
	if err := s.Tasks.DeletePRRuns(t.Context(), taskID); err != nil {
		t.Errorf("DeletePRRuns() again = %v, want nil", err)
	}
}

func TestPRRunsGoWithTheTask(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	taskID := seedTask(t, s)
	if err := s.Tasks.UpsertPRRun(t.Context(), newPRRun(taskID, "/ws/api", task.PRDrafting)); err != nil {
		t.Fatalf("UpsertPRRun() = %v, want nil", err)
	}

	if err := s.Tasks.Delete(t.Context(), taskID); err != nil {
		t.Fatalf("Tasks.Delete() = %v, want nil", err)
	}
	if got := listPRRuns(t, s, taskID); len(got) != 0 {
		t.Errorf("ListPRRuns() returned %d runs, want the cascade to have taken them", len(got))
	}
}

func TestPRRunsRejectAnUnknownTask(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	if err := s.Tasks.UpsertPRRun(t.Context(), newPRRun("nope", "/ws/api", task.PRDrafting)); err == nil {
		t.Error("UpsertPRRun() = nil, want error")
	}
}

func TestPRRunsRefuseAValueTheyCannotReadBack(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	taskID := seedTask(t, s)
	run := newPRRun(taskID, "/ws/api", task.PRStatus("nonsense"))
	if err := s.Tasks.UpsertPRRun(t.Context(), run); err != nil {
		t.Fatalf("UpsertPRRun() = %v, want nil", err)
	}

	if _, err := s.Tasks.ListPRRuns(t.Context(), taskID); err == nil {
		t.Error("ListPRRuns() = nil, want the unknown status to be refused")
	}
}
