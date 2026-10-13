package worktree_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/guilhermt/myspec/internal/git/gittest"
	"github.com/guilhermt/myspec/internal/worktree"
)

// lockDir takes the write permission off a directory until the test ends, so
// that git cannot remove what is inside it.
func lockDir(t *testing.T, dir string) {
	t.Helper()

	if err := os.Chmod(dir, 0o500); err != nil {
		t.Fatalf("Chmod(%s) = %v, want nil", dir, err)
	}
	t.Cleanup(func() { _ = os.Chmod(dir, 0o750) })
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
	// Git forgets the worktree before it fails on the folder.
	if left.PathRegistered {
		t.Error("PathRegistered = true, want the folder git forgot")
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
		registered bool
		locked     bool
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
			// A locked worktree is one git refuses to remove and keeps listed,
			// with its branch checked out in it.
			name: "the worktree stayed registered, with its branch",
			hold: func(t *testing.T, f fixture, wt worktree.Worktree) {
				t.Helper()
				gittest.Run(t, f.repo.Path, "worktree", "lock", wt.Path)
			},
			pathKept:   true,
			registered: true,
			locked:     true,
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
			if left.PathRegistered != tt.registered || left.PathLocked != tt.locked {
				t.Errorf("path registered = %v, locked = %v, want %v, %v",
					left.PathRegistered, left.PathLocked, tt.registered, tt.locked)
			}
			if tt.pathKept && tt.branchKept &&
				(strings.Contains(left.PathError, left.BranchError) || strings.Contains(left.BranchError, left.PathError)) {
				t.Errorf("path error %q, branch error %q, want each part with only what git said of it", left.PathError, left.BranchError)
			}
		})
	}
}
