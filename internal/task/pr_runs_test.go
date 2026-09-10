package task_test

import (
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/task"
)

// prCheckedAt is the instant the fixtures say gh answered at.
var prCheckedAt = base.Add(time.Minute)

func TestSetPRRunRecordsAndUpdatesARepository(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	repo := f.repos[0]
	before := f.changeCount()

	run, err := f.service.SetPRRun(t.Context(), created.ID, repo, task.PRPreparing, nil)
	if err != nil {
		t.Fatalf("SetPRRun() = %v, want nil", err)
	}
	want := task.PRRun{
		TaskID: created.ID, RepoPath: repo, Status: task.PRPreparing,
		CreatedAt: base, UpdatedAt: base,
	}
	if diff := cmp.Diff(want, run); diff != "" {
		t.Errorf("SetPRRun() mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]task.PRRun{want}, f.repo.prRuns(created.ID)); diff != "" {
		t.Errorf("stored runs mismatch (-want +got):\n%s", diff)
	}
	if got := f.changeCount(); got != before+1 {
		t.Errorf("OnChange ran %d times, want 1", got-before)
	}

	block := &task.PRBlock{Reason: task.PRBlockGHAuth, Detail: "gh: You are not logged into any GitHub hosts"}
	blocked, err := f.service.SetPRRun(t.Context(), created.ID, repo, task.PRBlocked, block)
	if err != nil {
		t.Fatalf("SetPRRun(blocked) = %v, want nil", err)
	}
	want.Status, want.Block = task.PRBlocked, block
	if diff := cmp.Diff(want, blocked); diff != "" {
		t.Errorf("SetPRRun(blocked) mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]task.PRRun{want}, f.service.PRRuns(created.ID)); diff != "" {
		t.Errorf("PRRuns() mismatch (-want +got):\n%s", diff)
	}

	// A repository that is no longer blocked carries no reason.
	drafting, err := f.service.SetPRRun(t.Context(), created.ID, repo, task.PRDrafting, nil)
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
	created := f.create(t, "add-login", "")
	repo := f.repos[0]

	details := task.PRDetails{
		Number: 12, URL: "https://github.com/acme/api/pull/12",
		State: task.PRStateOpen, CheckedAt: prCheckedAt,
	}
	if _, err := f.service.SetPRDetails(t.Context(), created.ID, repo, details); err != nil {
		t.Fatalf("SetPRDetails() = %v, want nil", err)
	}
	if _, err := f.service.SetPRReviewed(t.Context(), created.ID, repo, "abc1234", 2); err != nil {
		t.Fatalf("SetPRReviewed() = %v, want nil", err)
	}

	// Moving to another status says nothing about the pull request, so the
	// record keeps it.
	run, err := f.service.SetPRRun(t.Context(), created.ID, repo, task.PRCommitting, nil)
	if err != nil {
		t.Fatalf("SetPRRun() = %v, want nil", err)
	}
	want := task.PRRun{
		TaskID: created.ID, RepoPath: repo, Status: task.PRCommitting, PR: details,
		ReviewedCommit: "abc1234", ReportedPass: 2, CreatedAt: base, UpdatedAt: base,
	}
	if diff := cmp.Diff(want, run); diff != "" {
		t.Errorf("SetPRRun() mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]task.PRRun{want}, f.repo.prRuns(created.ID)); diff != "" {
		t.Errorf("stored runs mismatch (-want +got):\n%s", diff)
	}
}

func TestSetPRClosedRecordsWhatTheClosingDid(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	repo := f.repos[0]
	details := task.PRDetails{
		Number: 12, URL: "https://github.com/acme/api/pull/12",
		State: task.PRStateMerged, Base: "dev", CheckedAt: prCheckedAt,
	}
	if _, err := f.service.SetPRDetails(t.Context(), created.ID, repo, details); err != nil {
		t.Fatalf("SetPRDetails() = %v, want nil", err)
	}
	if _, err := f.service.SetPRRun(t.Context(), created.ID, repo, task.PRClosing, nil); err != nil {
		t.Fatalf("SetPRRun(closing) = %v, want nil", err)
	}

	result := task.CloseResult{
		Worktree:     task.CloseStep{Outcome: task.OutcomeDone},
		Branch:       task.CloseStep{Outcome: task.OutcomeDone},
		Base:         task.CloseStep{Outcome: task.OutcomeSkipped, Reason: task.SkipDirty, Detail: " M main.go"},
		WorktreePath: "/ws/.myspec/worktrees/api/add-login",
		BranchName:   "add-login",
		BaseBranch:   "dev",
		ClosedAt:     prCheckedAt,
	}
	run, err := f.service.SetPRClosed(t.Context(), created.ID, repo, result)
	if err != nil {
		t.Fatalf("SetPRClosed() = %v, want nil", err)
	}
	want := task.PRRun{
		TaskID: created.ID, RepoPath: repo, Status: task.PRClosed, PR: details, Close: &result,
		CreatedAt: base, UpdatedAt: base,
	}
	if diff := cmp.Diff(want, run); diff != "" {
		t.Errorf("SetPRClosed() mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]task.PRRun{want}, f.repo.prRuns(created.ID)); diff != "" {
		t.Errorf("stored runs mismatch (-want +got):\n%s", diff)
	}

	// What a caller holds is its own, result included.
	runs := f.service.PRRuns(created.ID)
	runs[0].Close.Base.Reason = task.SkipDiverged
	result.BaseBranch = "rewritten by the caller"
	again := f.service.PRRuns(created.ID)
	if again[0].Close.Base.Reason != task.SkipDirty || again[0].Close.BaseBranch != "dev" {
		t.Errorf("Close = %+v, want it untouched by the caller", again[0].Close)
	}
}

func TestPRRunsAreKeptByRepository(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.repos = append(f.repos, filepath.Join(f.workspace, "apps", "web"))
	created := f.create(t, "add-login", "")

	for _, repo := range []string{f.repos[1], f.repos[0]} {
		if _, err := f.service.SetPRRun(t.Context(), created.ID, repo, task.PRDrafting, nil); err != nil {
			t.Fatalf("SetPRRun(%s) = %v, want nil", repo, err)
		}
	}

	runs := f.service.PRRuns(created.ID)
	if len(runs) != 2 {
		t.Fatalf("PRRuns() = %+v, want two runs", runs)
	}
	if runs[0].RepoPath != f.repos[0] || runs[1].RepoPath != f.repos[1] {
		t.Errorf("PRRuns() = %q, %q, want them by repository path", runs[0].RepoPath, runs[1].RepoPath)
	}
}

func TestPRRunsReturnCopies(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	block := &task.PRBlock{Reason: task.PRBlockGHMissing, Detail: "gh: executable not found"}
	if _, err := f.service.SetPRRun(t.Context(), created.ID, f.repos[0], task.PRBlocked, block); err != nil {
		t.Fatalf("SetPRRun() = %v, want nil", err)
	}

	runs := f.service.PRRuns(created.ID)
	runs[0].Status = task.PRDone
	runs[0].Block.Detail = "rewritten"
	block.Detail = "rewritten by the caller"

	again := f.service.PRRuns(created.ID)
	if again[0].Status != task.PRBlocked {
		t.Errorf("Status = %q, want it untouched by the caller", again[0].Status)
	}
	if again[0].Block.Detail != "gh: executable not found" {
		t.Errorf("Block.Detail = %q, want it untouched by the caller", again[0].Block.Detail)
	}
}

func TestSetPRRunRejectsAnUnknownTask(t *testing.T) {
	t.Parallel()

	f := newFixture(t)

	_, err := f.service.SetPRRun(t.Context(), "nope", "/repo", task.PRDrafting, nil)
	wantErrIs(t, err, task.ErrNotFound)

	_, err = f.service.SetPRDetails(t.Context(), "nope", "/repo", task.PRDetails{})
	wantErrIs(t, err, task.ErrNotFound)

	_, err = f.service.SetPRReviewed(t.Context(), "nope", "/repo", "abc1234", 1)
	wantErrIs(t, err, task.ErrNotFound)
}

func TestSetPRRunFailsWhenItCannotBeStored(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	boom := errors.New("database is locked")
	f.repo.updateErr = boom

	if _, err := f.service.SetPRRun(t.Context(), created.ID, f.repos[0], task.PRDrafting, nil); !errors.Is(err, boom) {
		t.Fatalf("SetPRRun() = %v, want the store error", err)
	}
	if got := f.service.PRRuns(created.ID); got != nil {
		t.Errorf("PRRuns() = %+v, want nothing recorded", got)
	}
}

func TestClearPRRunsForgetsEveryRepository(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	if _, err := f.service.SetPRRun(t.Context(), created.ID, f.repos[0], task.PRDrafting, nil); err != nil {
		t.Fatalf("SetPRRun() = %v, want nil", err)
	}
	before := f.changeCount()

	if err := f.service.ClearPRRuns(t.Context(), created.ID); err != nil {
		t.Fatalf("ClearPRRuns() = %v, want nil", err)
	}

	if got := f.service.PRRuns(created.ID); got != nil {
		t.Errorf("PRRuns() = %v, want nil", got)
	}
	if got := f.repo.prRuns(created.ID); got != nil {
		t.Errorf("stored runs = %v, want nil", got)
	}
	if got := f.changeCount(); got != before+1 {
		t.Errorf("OnChange ran %d times, want 1", got-before)
	}
}

func TestDeletingATaskForgetsItsPRRuns(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	if _, err := f.service.SetPRRun(t.Context(), created.ID, f.repos[0], task.PRDrafting, nil); err != nil {
		t.Fatalf("SetPRRun() = %v, want nil", err)
	}

	if err := f.service.Delete(t.Context(), created.ID); err != nil {
		t.Fatalf("Delete() = %v, want nil", err)
	}
	if got := f.service.PRRuns(created.ID); got != nil {
		t.Errorf("PRRuns() = %v, want nil", got)
	}
}

func TestSyncLoadsThePRRunsOfEveryTask(t *testing.T) {
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
	run := task.PRRun{
		TaskID: seeded.ID, RepoPath: f.repos[0], Status: task.PRReviewing,
		PR: task.PRDetails{
			Number: 7, URL: "https://github.com/acme/api/pull/7",
			State: task.PRStateOpen, CheckedAt: prCheckedAt,
		},
		ReviewedCommit: "abc1234", ReportedPass: 1,
		CreatedAt: base, UpdatedAt: prCheckedAt,
	}
	f.repo.seedPRRun(run)

	// A second workspace and back, because a repeated Sync of the same path is
	// a no-op.
	if err := f.service.Sync(t.Context(), t.TempDir()); err != nil {
		t.Fatalf("Sync(other) = %v, want nil", err)
	}
	if err := f.service.Sync(t.Context(), f.workspace); err != nil {
		t.Fatalf("Sync(back) = %v, want nil", err)
	}

	if diff := cmp.Diff([]task.PRRun{run}, f.service.PRRuns(seeded.ID)); diff != "" {
		t.Errorf("PRRuns() mismatch (-want +got):\n%s", diff)
	}
}

func TestSyncFailsWhenThePRRunsCannotBeRead(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.repo.seed(task.Task{
		ID:            "mine",
		WorkspacePath: f.workspace,
		Name:          "add-login",
		Stage:         task.StagePRD,
		ArtifactsDir:  task.ArtifactsDir(f.dataDir, f.workspace, "add-login"),
		CreatedAt:     base,
		UpdatedAt:     base,
	})
	if err := f.service.Sync(t.Context(), t.TempDir()); err != nil {
		t.Fatalf("Sync(other) = %v, want nil", err)
	}

	boom := errors.New("boom")
	f.repo.prRunsErr = boom
	if err := f.service.Sync(t.Context(), f.workspace); !errors.Is(err, boom) {
		t.Errorf("Sync() = %v, want the store error", err)
	}
}
