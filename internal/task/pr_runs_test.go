package task_test

import (
	"errors"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/task"
)

// prCheckedAt is the instant the fixtures say gh answered at.
var prCheckedAt = base.Add(time.Minute)

// storedPRRun is the pr run the store holds for a task, failing the test when
// it holds none.
func storedPRRun(t *testing.T, f *fixture, taskID string) task.PRRun {
	t.Helper()

	run, ok := f.repo.prRun(taskID)
	if !ok {
		t.Fatalf("the store holds no pr run of task %s", taskID)
	}
	return run
}

func TestSetPRRunRecordsAndUpdatesTheStage(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")
	before := f.changeCount()

	run, err := f.service.SetPRRun(t.Context(), created.ID, task.PRPreparing, nil)
	if err != nil {
		t.Fatalf("SetPRRun() = %v, want nil", err)
	}
	want := task.PRRun{TaskID: created.ID, Status: task.PRPreparing, CreatedAt: base, UpdatedAt: base}
	if diff := cmp.Diff(want, run); diff != "" {
		t.Errorf("SetPRRun() mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff(want, storedPRRun(t, f, created.ID)); diff != "" {
		t.Errorf("stored run mismatch (-want +got):\n%s", diff)
	}
	if got := f.changeCount(); got != before+1 {
		t.Errorf("OnChange ran %d times, want 1", got-before)
	}

	block := &task.PRBlock{Reason: task.PRBlockGHAuth, Detail: "gh: You are not logged into any GitHub hosts"}
	blocked, err := f.service.SetPRRun(t.Context(), created.ID, task.PRBlocked, block)
	if err != nil {
		t.Fatalf("SetPRRun(blocked) = %v, want nil", err)
	}
	want.Status, want.Block = task.PRBlocked, block
	if diff := cmp.Diff(want, blocked); diff != "" {
		t.Errorf("SetPRRun(blocked) mismatch (-want +got):\n%s", diff)
	}
	got, ok := f.service.PRRun(created.ID)
	if !ok {
		t.Fatal("PRRun() = false, want the run")
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("PRRun() mismatch (-want +got):\n%s", diff)
	}

	// A stage that is no longer blocked carries no reason.
	drafting, err := f.service.SetPRRun(t.Context(), created.ID, task.PRDrafting, nil)
	if err != nil {
		t.Fatalf("SetPRRun(drafting) = %v, want nil", err)
	}
	if drafting.Block != nil {
		t.Errorf("Block = %+v, want nil", drafting.Block)
	}
	if got := f.logs.count(t, "pr run set"); got != 3 {
		t.Errorf("logged %d pr run records, want 3", got)
	}
}

func TestSetPRRunKeepsThePullRequestItDoesNotChange(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")

	details := task.PRDetails{
		Number: 12, URL: "https://github.com/acme/api/pull/12",
		State: task.PRStateOpen, CheckedAt: prCheckedAt,
	}
	if _, err := f.service.SetPRDetails(t.Context(), created.ID, details); err != nil {
		t.Fatalf("SetPRDetails() = %v, want nil", err)
	}
	if _, err := f.service.SetPRReviewed(t.Context(), created.ID, "abc1234", 2); err != nil {
		t.Fatalf("SetPRReviewed() = %v, want nil", err)
	}

	// Moving to another status says nothing about the pull request, so the
	// record keeps it.
	run, err := f.service.SetPRRun(t.Context(), created.ID, task.PRCommitting, nil)
	if err != nil {
		t.Fatalf("SetPRRun() = %v, want nil", err)
	}
	want := task.PRRun{
		TaskID: created.ID, Status: task.PRCommitting, PR: details,
		ReviewedCommit: "abc1234", ReportedPass: 2, CreatedAt: base, UpdatedAt: base,
	}
	if diff := cmp.Diff(want, run); diff != "" {
		t.Errorf("SetPRRun() mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff(want, storedPRRun(t, f, created.ID)); diff != "" {
		t.Errorf("stored run mismatch (-want +got):\n%s", diff)
	}
}

func TestSetPRClosedRecordsWhatTheClosingDid(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")
	details := task.PRDetails{
		Number: 12, URL: "https://github.com/acme/api/pull/12",
		State: task.PRStateMerged, Base: "dev", CheckedAt: prCheckedAt,
	}
	if _, err := f.service.SetPRDetails(t.Context(), created.ID, details); err != nil {
		t.Fatalf("SetPRDetails() = %v, want nil", err)
	}
	if _, err := f.service.SetPRRun(t.Context(), created.ID, task.PRClosing, nil); err != nil {
		t.Fatalf("SetPRRun(closing) = %v, want nil", err)
	}

	result := task.CloseResult{
		Worktree:     task.CloseStep{Outcome: task.OutcomeDone},
		Branch:       task.CloseStep{Outcome: task.OutcomeDone},
		Base:         task.CloseStep{Outcome: task.OutcomeSkipped, Reason: task.SkipDirty, Detail: " M main.go"},
		WorktreePath: "/data/worktrees/dev/web/add-login",
		BranchName:   "add-login",
		BaseBranch:   "dev",
		ClosedAt:     prCheckedAt,
	}
	run, err := f.service.SetPRClosed(t.Context(), created.ID, result)
	if err != nil {
		t.Fatalf("SetPRClosed() = %v, want nil", err)
	}
	want := task.PRRun{
		TaskID: created.ID, Status: task.PRClosed, PR: details, Close: &result,
		CreatedAt: base, UpdatedAt: base,
	}
	if diff := cmp.Diff(want, run); diff != "" {
		t.Errorf("SetPRClosed() mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff(want, storedPRRun(t, f, created.ID)); diff != "" {
		t.Errorf("stored run mismatch (-want +got):\n%s", diff)
	}

	// What a caller holds is its own, result included.
	held, _ := f.service.PRRun(created.ID)
	held.Close.Base.Reason = task.SkipDiverged
	result.BaseBranch = "rewritten by the caller"
	again, _ := f.service.PRRun(created.ID)
	if again.Close.Base.Reason != task.SkipDirty || again.Close.BaseBranch != "dev" {
		t.Errorf("Close = %+v, want it untouched by the caller", again.Close)
	}
}

func TestPRRunReturnsACopy(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")
	block := &task.PRBlock{Reason: task.PRBlockGHMissing, Detail: "gh: executable not found"}
	if _, err := f.service.SetPRRun(t.Context(), created.ID, task.PRBlocked, block); err != nil {
		t.Fatalf("SetPRRun() = %v, want nil", err)
	}

	held, _ := f.service.PRRun(created.ID)
	held.Status = task.PRDone
	held.Block.Detail = "rewritten"
	block.Detail = "rewritten by the caller"

	again, _ := f.service.PRRun(created.ID)
	if again.Status != task.PRBlocked {
		t.Errorf("Status = %q, want it untouched by the caller", again.Status)
	}
	if again.Block.Detail != "gh: executable not found" {
		t.Errorf("Block.Detail = %q, want it untouched by the caller", again.Block.Detail)
	}
}

func TestSetPRBaselineForgetsTheTroubleMeasuredBeforeIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")
	if _, err := f.service.SetPRRun(t.Context(), created.ID, task.PRDone, nil); err != nil {
		t.Fatalf("SetPRRun() = %v, want nil", err)
	}
	if _, err := f.service.SetPRTrouble(t.Context(), created.ID, gh.Trouble{Conflict: true}); err != nil {
		t.Fatalf("SetPRTrouble() = %v, want nil", err)
	}

	baseline := gh.Trouble{FailedChecks: []string{"lint"}}
	run, err := f.service.SetPRBaseline(t.Context(), created.ID, baseline)
	if err != nil {
		t.Fatalf("SetPRBaseline() = %v, want nil", err)
	}
	want := task.PRRun{
		TaskID: created.ID, Status: task.PRDone, TroubleBaseline: baseline,
		CreatedAt: base, UpdatedAt: base,
	}
	if diff := cmp.Diff(want, run); diff != "" {
		t.Errorf("SetPRBaseline() mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff(want, storedPRRun(t, f, created.ID)); diff != "" {
		t.Errorf("stored run mismatch (-want +got):\n%s", diff)
	}
}

func TestSetPRTroubleRecordsItAndKeepsTheRestOfTheRun(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")
	details := task.PRDetails{
		Number: 12, URL: "https://github.com/acme/api/pull/12",
		State: task.PRStateOpen, CheckedAt: prCheckedAt,
	}
	if _, err := f.service.SetPRDetails(t.Context(), created.ID, details); err != nil {
		t.Fatalf("SetPRDetails() = %v, want nil", err)
	}
	if _, err := f.service.SetPRReviewed(t.Context(), created.ID, "abc1234", 2); err != nil {
		t.Fatalf("SetPRReviewed() = %v, want nil", err)
	}
	baseline := gh.Trouble{FailedChecks: []string{"lint"}}
	if _, err := f.service.SetPRBaseline(t.Context(), created.ID, baseline); err != nil {
		t.Fatalf("SetPRBaseline() = %v, want nil", err)
	}

	trouble := gh.Trouble{FailedChecks: []string{"test"}, Conflict: true}
	run, err := f.service.SetPRTrouble(t.Context(), created.ID, trouble)
	if err != nil {
		t.Fatalf("SetPRTrouble() = %v, want nil", err)
	}
	want := task.PRRun{
		TaskID: created.ID, PR: details, ReviewedCommit: "abc1234", ReportedPass: 2,
		TroubleBaseline: baseline, Trouble: trouble, CreatedAt: base, UpdatedAt: base,
	}
	if diff := cmp.Diff(want, run); diff != "" {
		t.Errorf("SetPRTrouble() mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff(want, storedPRRun(t, f, created.ID)); diff != "" {
		t.Errorf("stored run mismatch (-want +got):\n%s", diff)
	}
}

func TestPRRunReturnsItsOwnListsOfFailedChecks(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")
	if _, err := f.service.SetPRBaseline(t.Context(), created.ID, gh.Trouble{FailedChecks: []string{"lint"}}); err != nil {
		t.Fatalf("SetPRBaseline() = %v, want nil", err)
	}
	if _, err := f.service.SetPRTrouble(t.Context(), created.ID, gh.Trouble{FailedChecks: []string{"test"}}); err != nil {
		t.Fatalf("SetPRTrouble() = %v, want nil", err)
	}

	held, _ := f.service.PRRun(created.ID)
	held.TroubleBaseline.FailedChecks[0] = "rewritten"
	held.Trouble.FailedChecks[0] = "rewritten"

	again, _ := f.service.PRRun(created.ID)
	if diff := cmp.Diff([]string{"lint"}, again.TroubleBaseline.FailedChecks); diff != "" {
		t.Errorf("TroubleBaseline.FailedChecks mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]string{"test"}, again.Trouble.FailedChecks); diff != "" {
		t.Errorf("Trouble.FailedChecks mismatch (-want +got):\n%s", diff)
	}
}

func TestPRRunAnswersNothingBeforeTheStage(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")

	if _, ok := f.service.PRRun(created.ID); ok {
		t.Error("PRRun() = true, want nothing before the PR stage")
	}
}

func TestSetPRRunRejectsAnUnknownTask(t *testing.T) {
	t.Parallel()

	f := newFixture(t)

	_, err := f.service.SetPRRun(t.Context(), "nope", task.PRDrafting, nil)
	wantErrIs(t, err, task.ErrNotFound)

	_, err = f.service.SetPRDetails(t.Context(), "nope", task.PRDetails{})
	wantErrIs(t, err, task.ErrNotFound)

	_, err = f.service.SetPRReviewed(t.Context(), "nope", "abc1234", 1)
	wantErrIs(t, err, task.ErrNotFound)

	_, err = f.service.SetPRBaseline(t.Context(), "nope", gh.Trouble{})
	wantErrIs(t, err, task.ErrNotFound)

	_, err = f.service.SetPRTrouble(t.Context(), "nope", gh.Trouble{})
	wantErrIs(t, err, task.ErrNotFound)
}

func TestSetPRRunFailsWhenItCannotBeStored(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")
	boom := errors.New("database is locked")
	f.repo.updateErr = boom

	if _, err := f.service.SetPRRun(t.Context(), created.ID, task.PRDrafting, nil); !errors.Is(err, boom) {
		t.Fatalf("SetPRRun() = %v, want the store error", err)
	}
	if _, ok := f.service.PRRun(created.ID); ok {
		t.Error("PRRun() = true, want nothing recorded")
	}
}

func TestClearPRRunForgetsTheStage(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")
	if _, err := f.service.SetPRRun(t.Context(), created.ID, task.PRDrafting, nil); err != nil {
		t.Fatalf("SetPRRun() = %v, want nil", err)
	}
	before := f.changeCount()

	if err := f.service.ClearPRRun(t.Context(), created.ID); err != nil {
		t.Fatalf("ClearPRRun() = %v, want nil", err)
	}

	if _, ok := f.service.PRRun(created.ID); ok {
		t.Error("PRRun() = true, want the stage forgotten")
	}
	if _, ok := f.repo.prRun(created.ID); ok {
		t.Error("the store still holds a run, want it deleted")
	}
	if got := f.changeCount(); got != before+1 {
		t.Errorf("OnChange ran %d times, want 1", got-before)
	}
}

func TestDeletingATaskForgetsItsPRRun(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")
	if _, err := f.service.SetPRRun(t.Context(), created.ID, task.PRDrafting, nil); err != nil {
		t.Fatalf("SetPRRun() = %v, want nil", err)
	}

	if err := f.service.Delete(t.Context(), created.ID); err != nil {
		t.Fatalf("Delete() = %v, want nil", err)
	}
	if _, ok := f.service.PRRun(created.ID); ok {
		t.Error("PRRun() = true, want the stage forgotten")
	}
}

func TestSyncLoadsThePRRunOfEveryTask(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	seeded := task.Task{
		ID:           "mine",
		RepositoryID: repoID,
		Name:         "add-login",
		Stage:        task.StageImplementation,
		ArtifactsDir: task.ArtifactsDir(f.dataDir, "dev", "web", "add-login"),
		CreatedAt:    base,
		UpdatedAt:    base,
	}
	f.repo.seed(seeded)
	run := task.PRRun{
		TaskID: seeded.ID, Status: task.PRReviewing,
		PR: task.PRDetails{
			Number: 7, URL: "https://github.com/acme/api/pull/7",
			State: task.PRStateOpen, CheckedAt: prCheckedAt,
		},
		ReviewedCommit: "abc1234", ReportedPass: 1,
		CreatedAt: base, UpdatedAt: prCheckedAt,
	}
	f.repo.seedPRRun(run)

	f.sync(t)

	got, ok := f.service.PRRun(seeded.ID)
	if !ok {
		t.Fatal("PRRun() = false, want the run Sync loaded")
	}
	if diff := cmp.Diff(run, got); diff != "" {
		t.Errorf("PRRun() mismatch (-want +got):\n%s", diff)
	}
}

func TestSyncFailsWhenThePRRunsCannotBeRead(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.repo.seed(task.Task{
		ID:           "mine",
		RepositoryID: repoID,
		Name:         "add-login",
		Stage:        task.StagePRD,
		ArtifactsDir: task.ArtifactsDir(f.dataDir, "dev", "web", "add-login"),
		CreatedAt:    base,
		UpdatedAt:    base,
	})

	boom := errors.New("boom")
	f.repo.prRunsErr = boom
	if err := f.service.Sync(t.Context()); !errors.Is(err, boom) {
		t.Errorf("Sync() = %v, want the store error", err)
	}
}

func TestCountsSeparatesActiveAndArchivedTasks(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.create(t, "add-login")
	archived := f.create(t, "fix-signup")
	if _, err := f.service.Archive(t.Context(), archived.ID); err != nil {
		t.Fatalf("Archive() = %v, want nil", err)
	}

	active, done := f.service.Counts(repoID)
	if active != 1 || done != 1 {
		t.Errorf("Counts() = %d, %d, want 1, 1", active, done)
	}
	if active, done = f.service.Counts("other"); active != 0 || done != 0 {
		t.Errorf("Counts(other) = %d, %d, want 0, 0", active, done)
	}
}
