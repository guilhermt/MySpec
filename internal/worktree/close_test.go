package worktree_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/guilhermt/myspec/internal/git/gittest"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/worktree"
)

// checkoutBranch checks a branch out of the repository, creating it from the
// remote branch of the same name when it is not there yet.
func checkoutBranch(t *testing.T, repoPath, branch string) {
	t.Helper()
	gittest.Run(t, repoPath, "checkout", "--quiet", branch)
}

// pushToOrigin puts a commit on a branch of the origin of the repository, the
// way a pull request merged out of the app would.
func pushToOrigin(t *testing.T, repoPath, branch, file string) {
	t.Helper()

	origin := gittest.Run(t, repoPath, "remote", "get-url", "origin")
	clone := filepath.Join(t.TempDir(), "other")
	gittest.Run(t, filepath.Dir(clone), "clone", "--branch", branch, origin, clone)
	gittest.Commit(t, clone, file, "merged\n", "Add "+file)
	gittest.Run(t, clone, "push", "origin", branch)
}

// lockDir takes the write permission off a directory until the test ends, so
// that git cannot remove what is inside it.
func lockDir(t *testing.T, dir string) {
	t.Helper()

	if err := os.Chmod(dir, 0o500); err != nil {
		t.Fatalf("Chmod(%s) = %v, want nil", dir, err)
	}
	t.Cleanup(func() { _ = os.Chmod(dir, 0o750) })
}

// gone reports whether the service and the store both forgot a worktree.
func (f fixture) gone(t *testing.T, wt worktree.Worktree) bool {
	t.Helper()

	if _, ok := f.svc.Get(wt.TaskID); ok {
		return false
	}
	for _, item := range f.store.all() {
		if item.TaskID == wt.TaskID {
			return false
		}
	}
	return true
}

func TestCloseRemovesTheWorktreeAndFastForwardsTheBase(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)
	wt := f.ensure(t)
	checkoutBranch(t, f.repo.Path, "dev")
	pushToOrigin(t, f.repo.Path, "dev", "merged.txt")

	got := f.svc.Close(t.Context(), wt, "dev", worktree.DeleteBranch)

	if got.Worktree.Outcome != task.OutcomeDone {
		t.Errorf("Worktree = %+v, want it removed", got.Worktree)
	}
	if exists(t, wt.Path) {
		t.Errorf("%s is still on disk, want the worktree gone", wt.Path)
	}
	if got.Branch.Outcome != task.OutcomeDone {
		t.Errorf("Branch = %+v, want it deleted", got.Branch)
	}
	if branchExists(t, f.repo.Path, wt.Branch) {
		t.Errorf("branch %s is still there, want it deleted", wt.Branch)
	}
	if got.Base.Outcome != task.OutcomeDone {
		t.Errorf("Base = %+v, want it updated", got.Base)
	}
	if got.BaseCommits != 1 {
		t.Errorf("BaseCommits = %d, want the 1 commit the remote had", got.BaseCommits)
	}
	if head, up := headOf(t, f.repo.Path, "refs/heads/dev"), headOf(t, f.repo.Path, "refs/remotes/origin/dev"); head != up {
		t.Errorf("dev = %s, want it at origin/dev %s", head, up)
	}
	if got.WorktreePath != wt.Path || got.BranchName != wt.Branch || got.BaseBranch != "dev" {
		t.Errorf("result = %+v, want it to name the worktree, the branch and the base", got)
	}
	if got.ClosedAt.IsZero() {
		t.Error("ClosedAt is zero, want when the closing happened")
	}
	if !f.gone(t, wt) {
		t.Error("the worktree is still registered, want it forgotten")
	}
}

func TestCloseKeepsABranchGitDoesNotSeeInTheBase(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)
	wt := f.ensure(t)
	checkoutBranch(t, f.repo.Path, "dev")
	gittest.Commit(t, wt.Path, "one.txt", "one\n", "Add one")

	got := f.svc.Close(t.Context(), wt, "dev", worktree.DeleteBranchIfMerged)

	if got.Branch.Outcome != task.OutcomeSkipped || got.Branch.Reason != task.SkipNotMerged {
		t.Errorf("Branch = %+v, want it kept as not merged", got.Branch)
	}
	if got.Branch.Detail != wt.Branch {
		t.Errorf("Detail = %q, want the branch %q", got.Branch.Detail, wt.Branch)
	}
	if !branchExists(t, f.repo.Path, wt.Branch) {
		t.Errorf("branch %s is gone, want it kept", wt.Branch)
	}
	if got.Worktree.Outcome != task.OutcomeDone {
		t.Errorf("Worktree = %+v, want it removed anyway", got.Worktree)
	}
	if !f.gone(t, wt) {
		t.Error("the worktree is still registered, want it forgotten")
	}
}

func TestCloseDeletesABranchTheBaseAlreadyHolds(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)
	wt := f.ensure(t)
	checkoutBranch(t, f.repo.Path, "dev")

	got := f.svc.Close(t.Context(), wt, "dev", worktree.DeleteBranchIfMerged)

	if got.Branch.Outcome != task.OutcomeDone {
		t.Errorf("Branch = %+v, want it deleted", got.Branch)
	}
	if branchExists(t, f.repo.Path, wt.Branch) {
		t.Errorf("branch %s is still there, want it deleted", wt.Branch)
	}
}

func TestCloseLeavesTheBaseBranchAloneAndSaysWhy(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		base   string
		setup  func(t *testing.T, f fixture)
		reason string
		detail string // a part of what the result quotes; "" when it says nothing
	}{
		{
			name: "the repository has uncommitted changes",
			base: "dev",
			setup: func(t *testing.T, f fixture) {
				t.Helper()
				checkoutBranch(t, f.repo.Path, "dev")
				pushToOrigin(t, f.repo.Path, "dev", "merged.txt")
				write(t, f.repo.Path, "dirty.txt", "dirty\n")
			},
			reason: task.SkipDirty,
			detail: "?? dirty.txt",
		},
		{
			name: "another branch is checked out",
			base: "dev",
			setup: func(t *testing.T, f fixture) {
				t.Helper()
				gittest.Run(t, f.repo.Path, "branch", "dev", "origin/dev")
				pushToOrigin(t, f.repo.Path, "dev", "merged.txt")
			},
			reason: task.SkipNotCheckedOut,
			detail: "main",
		},
		{
			name: "the base branch has commits of its own",
			base: "dev",
			setup: func(t *testing.T, f fixture) {
				t.Helper()
				checkoutBranch(t, f.repo.Path, "dev")
				pushToOrigin(t, f.repo.Path, "dev", "merged.txt")
				gittest.Commit(t, f.repo.Path, "local.txt", "local\n", "Add local")
			},
			reason: task.SkipDiverged,
			detail: "1 commits not on origin/dev",
		},
		{
			name: "the base branch already matches the remote",
			base: "dev",
			setup: func(t *testing.T, f fixture) {
				t.Helper()
				checkoutBranch(t, f.repo.Path, "dev")
			},
			reason: task.SkipUpToDate,
		},
		{
			name: "the base branch tracks no remote branch",
			base: "solo",
			setup: func(t *testing.T, f fixture) {
				t.Helper()
				gittest.Run(t, f.repo.Path, "checkout", "--quiet", "-b", "solo", "--no-track", "origin/dev")
			},
			reason: task.SkipNoUpstream,
		},
		{
			name:   "the base branch is not there",
			base:   "release",
			setup:  func(_ *testing.T, _ fixture) {},
			reason: task.SkipMissing,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			f := newFixture(t, true)
			wt := f.ensure(t)
			test.setup(t, f)

			var before string
			if branchExists(t, f.repo.Path, test.base) {
				before = headOf(t, f.repo.Path, "refs/heads/"+test.base)
			}

			got := f.svc.Close(t.Context(), wt, test.base, worktree.DeleteBranch)

			if got.Base.Outcome != task.OutcomeSkipped || got.Base.Reason != test.reason {
				t.Errorf("Base = %+v, want it skipped for %q", got.Base, test.reason)
			}
			if test.detail != "" && !strings.Contains(got.Base.Detail, test.detail) {
				t.Errorf("Detail = %q, want it to carry %q", got.Base.Detail, test.detail)
			}
			if got.BaseCommits != 0 {
				t.Errorf("BaseCommits = %d, want none for a base left alone", got.BaseCommits)
			}
			var after string
			if branchExists(t, f.repo.Path, test.base) {
				after = headOf(t, f.repo.Path, "refs/heads/"+test.base)
			}
			if after != before {
				t.Errorf("%s = %s, want it left at %s", test.base, after, before)
			}
			if got.Worktree.Outcome != task.OutcomeDone {
				t.Errorf("Worktree = %+v, want it removed anyway", got.Worktree)
			}
			if !f.gone(t, wt) {
				t.Error("the worktree is still registered, want it forgotten")
			}
		})
	}
}

func TestCloseGoesOnWithTheFolderOfTheWorktreeGone(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)
	wt := f.ensure(t)
	if err := os.RemoveAll(wt.Path); err != nil {
		t.Fatalf("RemoveAll(%s) = %v, want nil", wt.Path, err)
	}
	checkoutBranch(t, f.repo.Path, "dev")

	got := f.svc.Close(t.Context(), wt, "dev", worktree.DeleteBranch)

	if got.Worktree.Outcome != task.OutcomeSkipped || got.Worktree.Reason != task.SkipMissing {
		t.Errorf("Worktree = %+v, want it skipped as missing", got.Worktree)
	}
	if got.Branch.Outcome != task.OutcomeDone {
		t.Errorf("Branch = %+v, want it deleted anyway", got.Branch)
	}
	if branchExists(t, f.repo.Path, wt.Branch) {
		t.Errorf("branch %s is still there, want it deleted", wt.Branch)
	}
	if !f.gone(t, wt) {
		t.Error("the worktree is still registered, want it forgotten")
	}
}

func TestCloseReportsAFetchItCouldNotDo(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)
	wt := f.ensure(t)
	checkoutBranch(t, f.repo.Path, "dev")
	f.breakOrigin(t)

	got := f.svc.Close(t.Context(), wt, "dev", worktree.DeleteBranch)

	if got.Base.Outcome != task.OutcomeFailed {
		t.Errorf("Base = %+v, want the failure of the fetch", got.Base)
	}
	if got.Base.Detail == "" {
		t.Error("Detail is empty, want what git said about the fetch")
	}
	if got.Worktree.Outcome != task.OutcomeDone || got.Branch.Outcome != task.OutcomeDone {
		t.Errorf("Worktree = %+v, Branch = %+v, want both done anyway", got.Worktree, got.Branch)
	}
	if !f.gone(t, wt) {
		t.Error("the worktree is still registered, want it forgotten")
	}
}

func TestPurgeRemovesTheWorktreeOfATask(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)
	wt := f.ensure(t)

	if left, kept := f.svc.Purge(t.Context(), f.task.ID); kept {
		t.Errorf("Purge() = %+v, want nothing left behind", left)
	}

	if exists(t, wt.Path) {
		t.Errorf("%s is still on disk, want it gone", wt.Path)
	}
	if !f.gone(t, wt) {
		t.Error("the worktree is still registered, want it forgotten")
	}
	if branchExists(t, f.repo.Path, wt.Branch) {
		t.Error("the branch of the task is still there, want it deleted")
	}
}

func TestPurgeOfATaskWithoutAWorktreeLeavesNothing(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)

	if left, kept := f.svc.Purge(t.Context(), "task-without-a-worktree"); kept {
		t.Errorf("Purge() = %+v, want nothing left behind", left)
	}
}

func TestPurgeReportsTheFolderGitCouldNotRemove(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)
	wt := f.ensure(t)
	lockDir(t, filepath.Dir(wt.Path))

	left, kept := f.svc.Purge(t.Context(), f.task.ID)

	if !kept {
		t.Fatal("Purge() left nothing behind, want the worktree that stayed")
	}
	if left.Path != wt.Path || !left.PathKept {
		t.Errorf("Path = %q, kept = %v, want the folder %q kept", left.Path, left.PathKept, wt.Path)
	}
	if left.PathError == "" {
		t.Error("PathError is empty, want what git said")
	}
	if !f.gone(t, wt) {
		t.Error("the worktree that stayed is still registered, want the record gone anyway")
	}
	if len(f.store.all()) != 0 {
		t.Errorf("the store has %d worktrees, want none", len(f.store.all()))
	}
}

func TestPurgeSaysWhatStayedOfEachPart(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		hold       func(t *testing.T, f fixture, wt worktree.Worktree)
		pathKept   bool
		branchKept bool
	}{
		{
			name: "both went",
			hold: func(*testing.T, fixture, worktree.Worktree) {},
		},
		{
			name: "the worktree and the branch stayed",
			hold: func(t *testing.T, f fixture, wt worktree.Worktree) {
				t.Helper()
				gittest.Run(t, wt.Path, "checkout", "--detach")
				gittest.Run(t, f.repo.Path, "checkout", wt.Branch)
				lockDir(t, filepath.Dir(wt.Path))
			},
			pathKept:   true,
			branchKept: true,
		},
		{
			name: "only the worktree stayed",
			hold: func(t *testing.T, _ fixture, wt worktree.Worktree) {
				t.Helper()
				lockDir(t, filepath.Dir(wt.Path))
			},
			pathKept: true,
		},
		{
			// The clone has the branch checked out, so git will not delete it.
			name: "only the branch stayed",
			hold: func(t *testing.T, f fixture, wt worktree.Worktree) {
				t.Helper()
				gittest.Run(t, wt.Path, "checkout", "--detach")
				gittest.Run(t, f.repo.Path, "checkout", wt.Branch)
			},
			branchKept: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			f := newFixture(t, true)
			wt := f.ensure(t)
			tt.hold(t, f, wt)

			left, kept := f.svc.Purge(t.Context(), f.task.ID)

			if kept != (tt.pathKept || tt.branchKept) {
				t.Fatalf("Purge() kept = %v, want %v", kept, tt.pathKept || tt.branchKept)
			}
			if !kept {
				return
			}
			if left.RepoPath != f.repo.Path || left.Path != wt.Path || left.Branch != wt.Branch {
				t.Errorf("Purge() = %+v, want the clone, the folder and the branch of the worktree", left)
			}
			if left.PathKept != tt.pathKept || (left.PathError != "") != tt.pathKept {
				t.Errorf("path kept = %v with %q, want kept = %v with what git said", left.PathKept, left.PathError, tt.pathKept)
			}
			if left.BranchKept != tt.branchKept || (left.BranchError != "") != tt.branchKept {
				t.Errorf("branch kept = %v with %q, want kept = %v with what git said", left.BranchKept, left.BranchError, tt.branchKept)
			}
		})
	}
}

func TestAheadCountsTheCommitsOfTheBranchOutsideTheBase(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)
	wt := f.ensure(t)

	if got, err := f.svc.Ahead(t.Context(), wt, wt.Base); err != nil || got != 0 {
		t.Fatalf("Ahead() = %d, %v, want 0 on a branch that just started", got, err)
	}

	gittest.Commit(t, wt.Path, "one.txt", "one\n", "Add one")
	gittest.Commit(t, wt.Path, "two.txt", "two\n", "Add two")

	if got, err := f.svc.Ahead(t.Context(), wt, wt.Base); err != nil || got != 2 {
		t.Errorf("Ahead() = %d, %v, want 2", got, err)
	}
}

func TestMergedAnswersForBothKindsOfBranch(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)
	wt := f.ensure(t)

	got, err := f.svc.Merged(t.Context(), wt, wt.Base)
	if err != nil {
		t.Fatalf("Merged(%s) = %v, want nil", wt.Base, err)
	}
	if !got {
		t.Errorf("Merged(%s) = false, want true for a branch with no commit of its own", wt.Base)
	}

	gittest.Commit(t, wt.Path, "one.txt", "one\n", "Add one")

	got, err = f.svc.Merged(t.Context(), wt, wt.Base)
	if err != nil {
		t.Fatalf("Merged(%s) = %v, want nil", wt.Base, err)
	}
	if got {
		t.Errorf("Merged(%s) = true, want false for a branch the base does not hold", wt.Base)
	}
}
