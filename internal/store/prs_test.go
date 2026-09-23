package store_test

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/store"
	"github.com/guilhermt/myspec/internal/task"
)

// newPRRun builds the record of the PR stage of a task, ready to upsert.
func newPRRun(taskID string, status task.PRStatus) task.PRRun {
	return task.PRRun{
		TaskID:    taskID,
		Status:    status,
		CreatedAt: fixedTime,
		UpdatedAt: fixedTime,
	}
}

// getPRRun reads the PR run of a task, failing the test on error and when the
// store holds none.
func getPRRun(t *testing.T, s *store.Store, taskID string) task.PRRun {
	t.Helper()

	run, ok, err := s.Tasks.GetPRRun(t.Context(), taskID)
	if err != nil {
		t.Fatalf("GetPRRun() = %v, want nil", err)
	}
	if !ok {
		t.Fatalf("GetPRRun(%s) found nothing, want the run", taskID)
	}
	return run
}

func TestPRRunUpsertCreatesAndUpdates(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	taskID := seedTask(t, s)
	run := newPRRun(taskID, task.PRPreparing)
	if err := s.Tasks.UpsertPRRun(t.Context(), run); err != nil {
		t.Fatalf("UpsertPRRun() = %v, want nil", err)
	}
	if diff := cmp.Diff(run, getPRRun(t, s, taskID)); diff != "" {
		t.Errorf("GetPRRun() mismatch (-want +got):\n%s", diff)
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
	if diff := cmp.Diff(run, getPRRun(t, s, taskID)); diff != "" {
		t.Errorf("GetPRRun() after the update mismatch (-want +got):\n%s", diff)
	}
}

func TestPRRunCarriesTheBlockOnlyWhenBlocked(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	taskID := seedTask(t, s)
	blocked := newPRRun(taskID, task.PRBlocked)
	blocked.Block = &task.PRBlock{
		Reason: task.PRBlockGHAuth,
		Detail: "gh: You are not logged into any GitHub hosts",
	}
	if err := s.Tasks.UpsertPRRun(t.Context(), blocked); err != nil {
		t.Fatalf("UpsertPRRun() = %v, want nil", err)
	}
	if diff := cmp.Diff(blocked, getPRRun(t, s, taskID)); diff != "" {
		t.Errorf("GetPRRun() mismatch (-want +got):\n%s", diff)
	}

	// Starting the stage clears what blocked it.
	drafting := newPRRun(taskID, task.PRDrafting)
	if err := s.Tasks.UpsertPRRun(t.Context(), drafting); err != nil {
		t.Fatalf("UpsertPRRun(drafting) = %v, want nil", err)
	}
	got := getPRRun(t, s, taskID)
	if diff := cmp.Diff(drafting, got); diff != "" {
		t.Errorf("GetPRRun() after starting mismatch (-want +got):\n%s", diff)
	}
	if got.Block != nil {
		t.Errorf("Block = %+v, want nil", got.Block)
	}
}

func TestPRRunKeepsTheBaseAndWhatTheClosingDid(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	taskID := seedTask(t, s)
	run := newPRRun(taskID, task.PRClosed)
	run.PR = task.PRDetails{
		Number: 12, URL: "https://github.com/acme/api/pull/12",
		State: task.PRStateMerged, Base: "dev", CheckedAt: fixedTime.Add(time.Minute),
	}
	run.Close = &task.CloseResult{
		Worktree: task.CloseStep{Outcome: task.OutcomeDone},
		Branch: task.CloseStep{
			Outcome: task.OutcomeSkipped, Reason: task.SkipNotMerged, Detail: "add-login",
		},
		Base:         task.CloseStep{Outcome: task.OutcomeFailed, Detail: "git: could not fetch origin"},
		WorktreePath: "/data/worktrees/dev/web/add-login",
		BranchName:   "add-login",
		BaseBranch:   "dev",
		BaseCommits:  3,
		ClosedAt:     fixedTime.Add(2 * time.Minute),
	}
	if err := s.Tasks.UpsertPRRun(t.Context(), run); err != nil {
		t.Fatalf("UpsertPRRun() = %v, want nil", err)
	}

	if diff := cmp.Diff(run, getPRRun(t, s, taskID)); diff != "" {
		t.Errorf("GetPRRun() mismatch (-want +got):\n%s", diff)
	}

	// A task that never closed carries no result at all.
	other := seedNamedTask(t, s, "task-2", "two")
	if err := s.Tasks.UpsertPRRun(t.Context(), newPRRun(other, task.PRDone)); err != nil {
		t.Fatalf("UpsertPRRun(open) = %v, want nil", err)
	}
	got := getPRRun(t, s, other)
	if got.Close != nil {
		t.Errorf("Close = %+v, want nil", got.Close)
	}
	if got.PR.Base != "" {
		t.Errorf("PR.Base = %q, want empty", got.PR.Base)
	}
}

func TestPRRunKeepsItsTroubleAndTheBaselineItIsMeasuredAgainst(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	taskID := seedTask(t, s)
	run := newPRRun(taskID, task.PRDone)
	run.TroubleBaseline = gh.Trouble{FailedChecks: []string{"lint"}}
	run.Trouble = gh.Trouble{FailedChecks: []string{"build", "test"}, Conflict: true}
	if err := s.Tasks.UpsertPRRun(t.Context(), run); err != nil {
		t.Fatalf("UpsertPRRun() = %v, want nil", err)
	}
	if diff := cmp.Diff(run, getPRRun(t, s, taskID)); diff != "" {
		t.Errorf("GetPRRun() mismatch (-want +got):\n%s", diff)
	}

	// A trouble with nothing wrong is stored as nothing and read back as the
	// zero value.
	run.TroubleBaseline = gh.Trouble{FailedChecks: []string{}}
	run.Trouble = gh.Trouble{}
	if err := s.Tasks.UpsertPRRun(t.Context(), run); err != nil {
		t.Fatalf("UpsertPRRun() again = %v, want nil", err)
	}
	got := getPRRun(t, s, taskID)
	if diff := cmp.Diff(gh.Trouble{}, got.TroubleBaseline); diff != "" {
		t.Errorf("TroubleBaseline mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff(gh.Trouble{}, got.Trouble); diff != "" {
		t.Errorf("Trouble mismatch (-want +got):\n%s", diff)
	}
}

func TestPRRunWithoutAReadingCarriesNoInstant(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	taskID := seedTask(t, s)
	if err := s.Tasks.UpsertPRRun(t.Context(), newPRRun(taskID, task.PRDrafting)); err != nil {
		t.Fatalf("UpsertPRRun() = %v, want nil", err)
	}

	got := getPRRun(t, s, taskID)
	if !got.PR.CheckedAt.IsZero() {
		t.Errorf("PR.CheckedAt = %v, want the zero instant", got.PR.CheckedAt)
	}
	if got.PR.State != "" {
		t.Errorf("PR.State = %q, want no state", got.PR.State)
	}
}

func TestGetPRRunOfATaskWithoutOne(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	taskID := seedTask(t, s)
	run, ok, err := s.Tasks.GetPRRun(t.Context(), taskID)
	if err != nil {
		t.Fatalf("GetPRRun() = %v, want nil", err)
	}
	if ok {
		t.Errorf("GetPRRun() = %+v, true, want nothing before the PR stage", run)
	}
}

func TestPRRunDeleteTakesTheRunOfTheTask(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	taskID := seedTask(t, s)
	if err := s.Tasks.UpsertPRRun(t.Context(), newPRRun(taskID, task.PRDrafting)); err != nil {
		t.Fatalf("UpsertPRRun() = %v, want nil", err)
	}

	if err := s.Tasks.DeletePRRun(t.Context(), taskID); err != nil {
		t.Fatalf("DeletePRRun() = %v, want nil", err)
	}
	if _, ok, _ := s.Tasks.GetPRRun(t.Context(), taskID); ok {
		t.Error("GetPRRun() found a run, want it deleted")
	}
	// A task without a PR run is not an error either.
	if err := s.Tasks.DeletePRRun(t.Context(), taskID); err != nil {
		t.Errorf("DeletePRRun() again = %v, want nil", err)
	}
}

func TestPRRunGoesWithTheTask(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	taskID := seedTask(t, s)
	if err := s.Tasks.UpsertPRRun(t.Context(), newPRRun(taskID, task.PRDrafting)); err != nil {
		t.Fatalf("UpsertPRRun() = %v, want nil", err)
	}

	if err := s.Tasks.Delete(t.Context(), taskID); err != nil {
		t.Fatalf("Tasks.Delete() = %v, want nil", err)
	}
	if _, ok, _ := s.Tasks.GetPRRun(t.Context(), taskID); ok {
		t.Error("GetPRRun() found a run, want the cascade to have taken it")
	}
}

func TestPRRunRejectsAnUnknownTask(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	if err := s.Tasks.UpsertPRRun(t.Context(), newPRRun("nope", task.PRDrafting)); err == nil {
		t.Error("UpsertPRRun() = nil, want error")
	}
}

func TestPRRunRefusesAValueItCannotReadBack(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	taskID := seedTask(t, s)
	run := newPRRun(taskID, task.PRStatus("nonsense"))
	if err := s.Tasks.UpsertPRRun(t.Context(), run); err != nil {
		t.Fatalf("UpsertPRRun() = %v, want nil", err)
	}

	if _, _, err := s.Tasks.GetPRRun(t.Context(), taskID); err == nil {
		t.Error("GetPRRun() = nil, want the unknown status to be refused")
	}
}
