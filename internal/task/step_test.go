package task_test

import (
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/task"
)

func TestParseStepStatus(t *testing.T) {
	t.Parallel()

	statuses := []task.StepStatus{
		task.StepPreparing, task.StepBlocked, task.StepStarted, task.StepCommitting, task.StepDone,
	}
	for _, status := range statuses {
		got, err := task.ParseStepStatus(string(status))
		if err != nil {
			t.Errorf("ParseStepStatus(%q) = %v, want nil", status, err)
		}
		if got != status {
			t.Errorf("ParseStepStatus(%q) = %q, want %q", status, got, status)
		}
	}

	for _, value := range []string{"", "Preparing", "awaiting_review", "committed"} {
		if _, err := task.ParseStepStatus(value); !errors.Is(err, task.ErrUnknownStepStatus) {
			t.Errorf("ParseStepStatus(%q) = %v, want ErrUnknownStepStatus", value, err)
		}
	}
}

func TestParseBlockReason(t *testing.T) {
	t.Parallel()

	reasons := []task.BlockReason{
		task.BlockDirty, task.BlockFetchFailed, task.BlockNoBase, task.BlockPathExists,
		task.BlockBranchExists, task.BlockGitFailed, task.BlockNoRepository,
	}
	for _, reason := range reasons {
		got, err := task.ParseBlockReason(string(reason))
		if err != nil {
			t.Errorf("ParseBlockReason(%q) = %v, want nil", reason, err)
		}
		if got != reason {
			t.Errorf("ParseBlockReason(%q) = %q, want %q", reason, got, reason)
		}
	}

	for _, value := range []string{"", "dirty", "DIRTY_WORKTREE", "no_worktree"} {
		if _, err := task.ParseBlockReason(value); !errors.Is(err, task.ErrUnknownBlockReason) {
			t.Errorf("ParseBlockReason(%q) = %v, want ErrUnknownBlockReason", value, err)
		}
	}
}

func TestSetStepRunRecordsAndUpdatesAStep(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	before := f.changeCount()

	run, err := f.service.SetStepRun(t.Context(), created.ID, 1, task.StepPreparing, nil)
	if err != nil {
		t.Fatalf("SetStepRun() = %v, want nil", err)
	}
	want := task.StepRun{
		TaskID: created.ID, Number: 1, Status: task.StepPreparing,
		CreatedAt: base, UpdatedAt: base,
	}
	if diff := cmp.Diff(want, run); diff != "" {
		t.Errorf("SetStepRun() mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]task.StepRun{want}, f.repo.stepRuns(created.ID)); diff != "" {
		t.Errorf("stored runs mismatch (-want +got):\n%s", diff)
	}
	if got := f.changeCount(); got != before+1 {
		t.Errorf("OnChange ran %d times, want %d", got-before, 1)
	}

	block := &task.StepBlock{Reason: task.BlockDirty, Detail: " M main.go", Files: 1}
	blocked, err := f.service.SetStepRun(t.Context(), created.ID, 1, task.StepBlocked, block)
	if err != nil {
		t.Fatalf("SetStepRun(blocked) = %v, want nil", err)
	}
	want.Status = task.StepBlocked
	want.Block = block
	if diff := cmp.Diff(want, blocked); diff != "" {
		t.Errorf("SetStepRun(blocked) mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]task.StepRun{want}, f.service.StepRuns(created.ID)); diff != "" {
		t.Errorf("StepRuns() mismatch (-want +got):\n%s", diff)
	}
	if got := f.logs.count(t, "step run set"); got != 2 {
		t.Errorf("logged %d step run records, want 2", got)
	}
}

func TestSetStepRunKeepsWhatItDoesNotChange(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")

	const start = "1111111111111111111111111111111111111111"
	if _, err := f.service.SetStepStarted(t.Context(), created.ID, 1, start); err != nil {
		t.Fatalf("SetStepStarted() = %v, want nil", err)
	}

	// Going back to preparing says nothing about the commit the step began
	// from, so the record keeps it.
	run, err := f.service.SetStepRun(t.Context(), created.ID, 1, task.StepPreparing, nil)
	if err != nil {
		t.Fatalf("SetStepRun() = %v, want nil", err)
	}
	if run.StartCommit != start {
		t.Errorf("StartCommit = %q, want %q", run.StartCommit, start)
	}
	if diff := cmp.Diff([]task.StepRun{run}, f.repo.stepRuns(created.ID)); diff != "" {
		t.Errorf("stored runs mismatch (-want +got):\n%s", diff)
	}
}

func TestSetStepStartedRecordsTheCommitTheStepBeganFrom(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	before := f.changeCount()

	const start = "1111111111111111111111111111111111111111"
	run, err := f.service.SetStepStarted(t.Context(), created.ID, 1, start)
	if err != nil {
		t.Fatalf("SetStepStarted() = %v, want nil", err)
	}
	want := task.StepRun{
		TaskID: created.ID, Number: 1, Status: task.StepStarted,
		CreatedAt: base, UpdatedAt: base, StartCommit: start,
	}
	if diff := cmp.Diff(want, run); diff != "" {
		t.Errorf("SetStepStarted() mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]task.StepRun{want}, f.repo.stepRuns(created.ID)); diff != "" {
		t.Errorf("stored runs mismatch (-want +got):\n%s", diff)
	}
	if got := f.changeCount(); got != before+1 {
		t.Errorf("OnChange ran %d times, want 1", got-before)
	}
}

func TestSetStepCommittedIsWhatMakesAStepDone(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")

	const (
		start   = "1111111111111111111111111111111111111111"
		sha     = "2222222222222222222222222222222222222222"
		subject = "Add the login screen"
	)
	if _, err := f.service.SetStepStarted(t.Context(), created.ID, 1, start); err != nil {
		t.Fatalf("SetStepStarted() = %v, want nil", err)
	}
	if _, err := f.service.SetStepRun(t.Context(), created.ID, 1, task.StepCommitting, nil); err != nil {
		t.Fatalf("SetStepRun(committing) = %v, want nil", err)
	}

	run, err := f.service.SetStepCommitted(t.Context(), created.ID, 1, sha, subject)
	if err != nil {
		t.Fatalf("SetStepCommitted() = %v, want nil", err)
	}
	want := task.StepRun{
		TaskID: created.ID, Number: 1, Status: task.StepDone,
		CreatedAt: base, UpdatedAt: base,
		StartCommit: start, CommitSHA: sha, CommitSubject: subject,
	}
	if diff := cmp.Diff(want, run); diff != "" {
		t.Errorf("SetStepCommitted() mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]task.StepRun{want}, f.service.StepRuns(created.ID)); diff != "" {
		t.Errorf("StepRuns() mismatch (-want +got):\n%s", diff)
	}
	if got := f.logs.count(t, "step committed"); got != 1 {
		t.Errorf("logged %d commits, want 1", got)
	}
}

func TestTheAgentReviewOfAStepKeepsTheRestOfTheRun(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")

	const start = "1111111111111111111111111111111111111111"
	if _, err := f.service.SetStepStarted(t.Context(), created.ID, 1, start); err != nil {
		t.Fatalf("SetStepStarted() = %v, want nil", err)
	}
	want := task.StepRun{
		TaskID: created.ID, Number: 1, Status: task.StepStarted,
		CreatedAt: base, UpdatedAt: base, StartCommit: start,
	}

	run, err := f.service.SetStepPass(t.Context(), created.ID, 1, 2)
	if err != nil {
		t.Fatalf("SetStepPass() = %v, want nil", err)
	}
	want.ReviewPass = 2
	if diff := cmp.Diff(want, run); diff != "" {
		t.Errorf("SetStepPass() mismatch (-want +got):\n%s", diff)
	}

	run, err = f.service.SetStepReported(t.Context(), created.ID, 1, 1)
	if err != nil {
		t.Fatalf("SetStepReported() = %v, want nil", err)
	}
	want.ReportedPass = 1
	if diff := cmp.Diff(want, run); diff != "" {
		t.Errorf("SetStepReported() mismatch (-want +got):\n%s", diff)
	}

	run, err = f.service.SetStepFallback(t.Context(), created.ID, 1, task.FallbackRoundsExhausted)
	if err != nil {
		t.Fatalf("SetStepFallback() = %v, want nil", err)
	}
	want.Fallback = task.FallbackRoundsExhausted
	if diff := cmp.Diff(want, run); diff != "" {
		t.Errorf("SetStepFallback() mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]task.StepRun{want}, f.repo.stepRuns(created.ID)); diff != "" {
		t.Errorf("stored runs mismatch (-want +got):\n%s", diff)
	}
}

func TestSetStepStartedAndCommittedRejectAnUnknownTask(t *testing.T) {
	t.Parallel()

	f := newFixture(t)

	_, err := f.service.SetStepStarted(t.Context(), "nope", 1, "sha")
	wantErrIs(t, err, task.ErrNotFound)

	_, err = f.service.SetStepCommitted(t.Context(), "nope", 1, "sha", "subject")
	wantErrIs(t, err, task.ErrNotFound)
}

func TestSetStepRunKeepsTheStepsInOrder(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")

	for _, number := range []int{3, 1, 2} {
		if _, err := f.service.SetStepRun(t.Context(), created.ID, number, task.StepStarted, nil); err != nil {
			t.Fatalf("SetStepRun(%d) = %v, want nil", number, err)
		}
	}

	runs := f.service.StepRuns(created.ID)
	numbers := make([]int, 0, len(runs))
	for _, run := range runs {
		numbers = append(numbers, run.Number)
	}
	if diff := cmp.Diff([]int{1, 2, 3}, numbers); diff != "" {
		t.Errorf("StepRuns() numbers mismatch (-want +got):\n%s", diff)
	}
}

func TestSetStepRunRejectsAnUnknownTask(t *testing.T) {
	t.Parallel()

	f := newFixture(t)

	_, err := f.service.SetStepRun(t.Context(), "nope", 1, task.StepPreparing, nil)
	wantErrIs(t, err, task.ErrNotFound)
}

func TestStepRunsReturnsCopies(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	block := &task.StepBlock{Reason: task.BlockFetchFailed, Detail: "could not read from remote"}
	if _, err := f.service.SetStepRun(t.Context(), created.ID, 1, task.StepBlocked, block); err != nil {
		t.Fatalf("SetStepRun() = %v, want nil", err)
	}

	runs := f.service.StepRuns(created.ID)
	runs[0].Status = task.StepStarted
	runs[0].Block.Detail = "rewritten"
	block.Detail = "rewritten by the caller"

	again := f.service.StepRuns(created.ID)
	if again[0].Status != task.StepBlocked {
		t.Errorf("Status = %q, want it untouched by the caller", again[0].Status)
	}
	if again[0].Block.Detail != "could not read from remote" {
		t.Errorf("Block.Detail = %q, want it untouched by the caller", again[0].Block.Detail)
	}
}

func TestClearStepRunsForgetsEveryStep(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	if _, err := f.service.SetStepRun(t.Context(), created.ID, 1, task.StepStarted, nil); err != nil {
		t.Fatalf("SetStepRun() = %v, want nil", err)
	}
	before := f.changeCount()

	if err := f.service.ClearStepRuns(t.Context(), created.ID); err != nil {
		t.Fatalf("ClearStepRuns() = %v, want nil", err)
	}

	if got := f.service.StepRuns(created.ID); got != nil {
		t.Errorf("StepRuns() = %v, want nil", got)
	}
	if got := f.repo.stepRuns(created.ID); got != nil {
		t.Errorf("stored runs = %v, want nil", got)
	}
	if got := f.changeCount(); got != before+1 {
		t.Errorf("OnChange ran %d times, want 1", got-before)
	}
}

func TestDeletingATaskForgetsItsStepRuns(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	if _, err := f.service.SetStepRun(t.Context(), created.ID, 1, task.StepStarted, nil); err != nil {
		t.Fatalf("SetStepRun() = %v, want nil", err)
	}

	if err := f.service.Delete(t.Context(), created.ID); err != nil {
		t.Fatalf("Delete() = %v, want nil", err)
	}
	if got := f.service.StepRuns(created.ID); got != nil {
		t.Errorf("StepRuns() = %v, want nil", got)
	}
}

func TestSyncLoadsTheStepRunsOfEveryTask(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	seeded := task.Task{
		ID:            "mine",
		WorkspacePath: f.workspace,
		Name:          "add-login",
		Stage:         task.StageImplementation,
		ArtifactsDir:  task.ArtifactsDir(f.dataDir, f.workspace, "add-login"),
		CreatedAt:     base,
		UpdatedAt:     base,
	}
	f.repo.seed(seeded)
	run := task.StepRun{
		TaskID: seeded.ID, Number: 1, Status: task.StepBlocked,
		Block:     &task.StepBlock{Reason: task.BlockNoRepository, Detail: "steps/1-first.md"},
		CreatedAt: base, UpdatedAt: base.Add(time.Minute),
	}
	f.repo.seedRun(run)

	// A second workspace and back, because a repeated Sync of the same path is
	// a no-op.
	if err := f.service.Sync(t.Context(), t.TempDir()); err != nil {
		t.Fatalf("Sync(other) = %v, want nil", err)
	}
	if err := f.service.Sync(t.Context(), f.workspace); err != nil {
		t.Fatalf("Sync(back) = %v, want nil", err)
	}

	if diff := cmp.Diff([]task.StepRun{run}, f.service.StepRuns(seeded.ID)); diff != "" {
		t.Errorf("StepRuns() mismatch (-want +got):\n%s", diff)
	}
}

func TestSyncFailsWhenTheStepRunsCannotBeRead(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.repo.seed(task.Task{
		ID:            "mine",
		WorkspacePath: f.workspace,
		Name:          "add-login",
		Stage:         task.StagePRD,
		ArtifactsDir:  filepath.Join(f.dataDir, "add-login"),
		CreatedAt:     base,
		UpdatedAt:     base,
	})
	if err := f.service.Sync(t.Context(), t.TempDir()); err != nil {
		t.Fatalf("Sync(other) = %v, want nil", err)
	}

	boom := errors.New("boom")
	f.repo.runsErr = boom
	if err := f.service.Sync(t.Context(), f.workspace); !errors.Is(err, boom) {
		t.Errorf("Sync() = %v, want the store error", err)
	}
}
