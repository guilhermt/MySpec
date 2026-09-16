package worktree_test

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/git/gittest"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/worktree"
)

func TestAWorktreeLivesInTheDataDirectoryUnderItsRepository(t *testing.T) {
	t.Parallel()

	got := worktree.Path("/data", "dev", "web", taskName)
	want := filepath.Join("/data", "worktrees", "dev", "web", taskName)
	if got != want {
		t.Errorf("Path() = %q, want %q", got, want)
	}
}

func TestEnsureCreatesTheWorktreeOfATaskFromDev(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)

	var phases []worktree.Phase
	wt, err := f.svc.Ensure(t.Context(), f.task, f.repo, func(p worktree.Phase) {
		phases = append(phases, p)
	})
	if err != nil {
		t.Fatalf("Ensure() = %v, want nil", err)
	}

	want := worktree.Path(f.dataDir, "dev", "web", taskName)
	if wt.Path != want {
		t.Errorf("Path = %q, want %q", wt.Path, want)
	}
	if !exists(t, wt.Path) {
		t.Errorf("%s is not on disk", wt.Path)
	}
	if wt.Branch != taskName {
		t.Errorf("Branch = %q, want %q", wt.Branch, taskName)
	}
	if head, base := headOf(t, wt.Path, "HEAD"), headOf(t, f.repo.Path, "refs/remotes/origin/dev"); head != base {
		t.Errorf("HEAD = %s, want origin/dev at %s", head, base)
	}
	// The upstream belongs to the PR stage, not to the creation.
	if up := upstreamOf(t, f.repo.Path, taskName); up != "" {
		t.Errorf("upstream of %s = %q, want none", taskName, up)
	}
	if diff := cmp.Diff([]worktree.Worktree{wt}, f.store.all()); diff != "" {
		t.Errorf("registry mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]worktree.Phase{worktree.PhaseFetching, worktree.PhaseCreating}, phases); diff != "" {
		t.Errorf("phases mismatch (-want +got):\n%s", diff)
	}
}

func TestEnsureFallsBackToMainWithoutADevBranch(t *testing.T) {
	t.Parallel()
	f := newFixture(t, false)

	wt := f.ensure(t)
	if head, base := headOf(t, wt.Path, "HEAD"), headOf(t, f.repo.Path, "refs/remotes/origin/main"); head != base {
		t.Errorf("HEAD = %s, want origin/main at %s", head, base)
	}
}

func TestEnsureRefusesWithoutABaseBranch(t *testing.T) {
	t.Parallel()

	f := newFixtureOf(t, repoWithoutBase(t))

	_, err := f.svc.Ensure(t.Context(), f.task, f.repo, nil)
	if !errors.Is(err, worktree.ErrNoBaseBranch) {
		t.Fatalf("Ensure() = %v, want ErrNoBaseBranch", err)
	}
	if got := f.store.all(); len(got) != 0 {
		t.Errorf("registry has %d worktrees, want none", len(got))
	}
}

func TestEnsureRefusesAPathThatIsAlreadyThere(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)

	path := worktree.Path(f.dataDir, "dev", "web", taskName)
	if err := os.MkdirAll(path, 0o750); err != nil {
		t.Fatalf("MkdirAll(%s) = %v, want nil", path, err)
	}

	_, err := f.svc.Ensure(t.Context(), f.task, f.repo, nil)
	if !errors.Is(err, worktree.ErrPathExists) {
		t.Fatalf("Ensure() = %v, want ErrPathExists", err)
	}
	if !strings.Contains(err.Error(), path) {
		t.Errorf("Ensure() = %q, want it to name %s", err, path)
	}
}

func TestEnsureRefusesABranchThatIsAlreadyThere(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)

	gittest.Run(t, f.repo.Path, "branch", taskName)

	_, err := f.svc.Ensure(t.Context(), f.task, f.repo, nil)
	if !errors.Is(err, worktree.ErrBranchExists) {
		t.Fatalf("Ensure() = %v, want ErrBranchExists", err)
	}
	if got := f.store.all(); len(got) != 0 {
		t.Errorf("registry has %d worktrees, want none", len(got))
	}
}

func TestEnsureReportsWhatGitSaidWhenTheFetchFails(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)

	f.breakOrigin(t)

	_, err := f.svc.Ensure(t.Context(), f.task, f.repo, nil)
	if !errors.Is(err, worktree.ErrFetchFailed) {
		t.Fatalf("Ensure() = %v, want ErrFetchFailed", err)
	}
	var gitErr *git.Error
	if !errors.As(err, &gitErr) {
		t.Fatalf("Ensure() = %v, want a *git.Error underneath", err)
	}
	if gitErr.Output == "" {
		t.Error("the git error carries no output, want what git said")
	}
}

func TestEnsureReturnsTheWorktreeItAlreadyHasWithoutFetching(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)

	first := f.ensure(t)
	// Any fetch from here on would fail, so a second Ensure that works is a
	// second Ensure that did not fetch.
	f.breakOrigin(t)

	second, err := f.svc.Ensure(t.Context(), f.task, f.repo, func(worktree.Phase) {
		t.Error("Ensure() reported a phase, want no creation at all")
	})
	if err != nil {
		t.Fatalf("Ensure() again = %v, want nil", err)
	}
	if diff := cmp.Diff(first, second); diff != "" {
		t.Errorf("Ensure() again mismatch (-want +got):\n%s", diff)
	}
}

func TestEnsureRecreatesAWorktreeDeletedByHand(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)

	first := f.ensure(t)
	if err := os.RemoveAll(first.Path); err != nil {
		t.Fatalf("RemoveAll(%s) = %v, want nil", first.Path, err)
	}

	second := f.ensure(t)
	if !exists(t, second.Path) {
		t.Errorf("%s is not on disk", second.Path)
	}
	if got := f.store.all(); len(got) != 1 {
		t.Errorf("registry has %d worktrees, want 1", len(got))
	}
	// The branch of the worktree that is gone was the app's, so it went too and
	// the new one took its name.
	if !branchExists(t, f.repo.Path, taskName) {
		t.Errorf("branch %s is missing", taskName)
	}
}

func TestEnsureRegistersNothingWhenTheContextIsAlreadyDone(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)

	ctx, cancel := context.WithCancel(t.Context())
	cancel()

	if _, err := f.svc.Ensure(ctx, f.task, f.repo, nil); err == nil {
		t.Fatal("Ensure() = nil, want the context error")
	}
	if got := f.store.all(); len(got) != 0 {
		t.Errorf("registry has %d worktrees, want none", len(got))
	}
	if exists(t, worktree.Path(f.dataDir, "dev", "web", taskName)) {
		t.Error("the worktree folder is on disk, want nothing left behind")
	}
}

func TestEnsureLeavesNothingBehindWhenTheCreationIsCancelled(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	// Cancelling as the creation starts is what discarding a step in the middle
	// of the preparation does.
	_, err := f.svc.Ensure(ctx, f.task, f.repo, func(p worktree.Phase) {
		if p == worktree.PhaseCreating {
			cancel()
		}
	})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("Ensure() = %v, want a cancelled context", err)
	}
	if got := f.store.all(); len(got) != 0 {
		t.Errorf("registry has %d worktrees, want none", len(got))
	}
	if exists(t, worktree.Path(f.dataDir, "dev", "web", taskName)) {
		t.Error("the worktree folder is on disk, want nothing left behind")
	}
	if branchExists(t, f.repo.Path, taskName) {
		t.Errorf("branch %s is still there", taskName)
	}
}

func TestStatusIsCleanInAWorktreeNobodyTouched(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)

	wt := f.ensure(t)
	got := f.status(t, wt)
	if !got.Clean() {
		t.Errorf("Status() = %v, want clean", got.Lines())
	}
}

func TestStatusListsWhatChangedAndIgnoresWhatGitIgnores(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)

	wt := f.ensure(t)
	gittest.Commit(t, wt.Path, ".gitignore", "ignored.txt\n", "Ignore the scratch file")
	write(t, wt.Path, "README.md", "# changed\n")
	write(t, wt.Path, "new.go", "package new\n")
	write(t, wt.Path, "ignored.txt", "scratch\n")

	got := f.status(t, wt)
	if got.Clean() {
		t.Fatal("Status() is clean, want the changes")
	}
	if len(got.Changes) != 2 {
		t.Errorf("Status() = %v, want the modified and the untracked file only", got.Lines())
	}
}

func TestStatusReadsTheHeadOfTheWorktreeBranch(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)

	wt := f.ensure(t)
	if got, want := f.status(t, wt).Head, headOf(t, wt.Path, "HEAD"); got != want {
		t.Errorf("Status().Head = %q, want %q", got, want)
	}
}

func TestGitDirPointsInsideTheRepositoryOfTheWorktree(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)

	wt := f.ensure(t)
	got, err := f.svc.GitDir(t.Context(), wt)
	if err != nil {
		t.Fatalf("GitDir() = %v, want nil", err)
	}
	if want := filepath.Join(f.repo.Path, ".git", "worktrees", taskName); got != want {
		t.Errorf("GitDir() = %q, want %q", got, want)
	}
}

func TestTrackedFilesListsWhatTheWorktreeHasFromGit(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)

	wt := f.ensure(t)
	write(t, wt.Path, "untracked.txt", "untracked\n")

	got, err := f.svc.TrackedFiles(t.Context(), wt)
	if err != nil {
		t.Fatalf("TrackedFiles() = %v, want nil", err)
	}
	if want := []string{"README.md"}; !slices.Equal(got, want) {
		t.Errorf("TrackedFiles() = %q, want %q", got, want)
	}
}

func TestIsIgnoredAnswersForAPathOfTheWorktree(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)

	wt := f.ensure(t)
	gittest.Commit(t, wt.Path, ".gitignore", "ignored.txt\n", "Ignore the scratch file")

	for path, want := range map[string]bool{"ignored.txt": true, "README.md": false} {
		got, err := f.svc.IsIgnored(t.Context(), wt, path)
		if err != nil {
			t.Fatalf("IsIgnored(%s) = %v, want nil", path, err)
		}
		if got != want {
			t.Errorf("IsIgnored(%s) = %t, want %t", path, got, want)
		}
	}
}

func TestCommitReadsWhatTheWorktreeCommitted(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)

	wt := f.ensure(t)
	gittest.Commit(t, wt.Path, "one.txt", "one\n", "Add the first file")

	got, err := f.svc.Commit(t.Context(), wt, "HEAD")
	if err != nil {
		t.Fatalf("Commit() = %v, want nil", err)
	}
	if want := headOf(t, wt.Path, "HEAD"); got.SHA != want {
		t.Errorf("Commit().SHA = %q, want %q", got.SHA, want)
	}
	if want := "Add the first file"; got.Subject != want {
		t.Errorf("Commit().Subject = %q, want %q", got.Subject, want)
	}
}

func TestCleanThrowsAwayEveryChangeButTheIgnoredFiles(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)

	wt := f.ensure(t)
	gittest.Commit(t, wt.Path, ".gitignore", "ignored.txt\n", "Ignore the scratch file")
	write(t, wt.Path, "README.md", "# changed\n")
	write(t, wt.Path, "new.go", "package new\n")
	write(t, wt.Path, "ignored.txt", "scratch\n")

	if err := f.svc.Clean(t.Context(), wt); err != nil {
		t.Fatalf("Clean() = %v, want nil", err)
	}

	if got := f.status(t, wt); !got.Clean() {
		t.Errorf("Status() = %v, want clean", got.Lines())
	}
	if got := read(t, filepath.Join(wt.Path, "README.md")); got != "# seed\n" {
		t.Errorf("README.md = %q, want it restored", got)
	}
	if exists(t, filepath.Join(wt.Path, "new.go")) {
		t.Error("new.go is still there, want it removed")
	}
	if !exists(t, filepath.Join(wt.Path, "ignored.txt")) {
		t.Error("ignored.txt is gone, want ignored files kept")
	}
}

func TestRemoveTakesTheWorktreeAndItsBranch(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)

	wt := f.ensure(t)
	if err := f.svc.Remove(t.Context(), f.task.ID); err != nil {
		t.Fatalf("Remove() = %v, want nil", err)
	}

	if exists(t, wt.Path) {
		t.Errorf("%s is still on disk", wt.Path)
	}
	if branchExists(t, f.repo.Path, taskName) {
		t.Errorf("branch %s is still there", taskName)
	}
	if got := f.store.all(); len(got) != 0 {
		t.Errorf("registry has %d worktrees, want none", len(got))
	}
	if _, ok := f.svc.Get(f.task.ID); ok {
		t.Error("Get() still answers, want the worktree forgotten")
	}
}

func TestRemoveToleratesAFolderThatIsAlreadyGone(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)

	wt := f.ensure(t)
	if err := os.RemoveAll(wt.Path); err != nil {
		t.Fatalf("RemoveAll(%s) = %v, want nil", wt.Path, err)
	}

	if err := f.svc.Remove(t.Context(), f.task.ID); err != nil {
		t.Fatalf("Remove() = %v, want nil", err)
	}
	if branchExists(t, f.repo.Path, taskName) {
		t.Errorf("branch %s is still there", taskName)
	}
}

func TestRemoveOfATaskWithoutAWorktreeDoesNothing(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)

	if err := f.svc.Remove(t.Context(), "task-without-a-worktree"); err != nil {
		t.Errorf("Remove() = %v, want nil", err)
	}
}

func TestSyncLoadsTheRegistryOfTheGivenTasks(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)

	wt := f.ensure(t)
	// A service of its own, over the same registry, is what reopening the app
	// looks like.
	other := worktree.New(worktree.Deps{
		Git:     git.New(git.Deps{Env: gittest.Env(t)}),
		Store:   f.store,
		DataDir: f.dataDir,
	})
	if err := other.Sync(t.Context(), []string{f.task.ID}); err != nil {
		t.Fatalf("Sync() = %v, want nil", err)
	}

	got, ok := other.Get(f.task.ID)
	if !ok {
		t.Fatal("Get() = false, want the worktree Sync loaded")
	}
	if diff := cmp.Diff(wt, got); diff != "" {
		t.Errorf("Get() mismatch (-want +got):\n%s", diff)
	}
}

func TestTwoTasksCreateTheirWorktreesInTheSameRepository(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)

	tasks := []task.Task{
		newTask("task-1", "first-task"),
		newTask("task-2", "second-task"),
	}
	var wg sync.WaitGroup
	errs := make([]error, len(tasks))
	for i, tsk := range tasks {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, errs[i] = f.svc.Ensure(t.Context(), tsk, f.repo, nil)
		}()
	}
	wg.Wait()

	for i, err := range errs {
		if err != nil {
			t.Fatalf("Ensure(%s) = %v, want nil", tasks[i].Name, err)
		}
	}
	for _, tsk := range tasks {
		path := worktree.Path(f.dataDir, "dev", "web", tsk.Name)
		if !exists(t, path) {
			t.Errorf("%s is not on disk", path)
		}
		if !branchExists(t, f.repo.Path, tsk.Name) {
			t.Errorf("branch %s is missing", tsk.Name)
		}
	}
	if got := f.store.all(); len(got) != 2 {
		t.Errorf("registry has %d worktrees, want 2", len(got))
	}
}

func TestEnsureRecordsTheBaseTheBranchWasCreatedFrom(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)

	wt := f.ensure(t)
	if wt.Base != "origin/dev" {
		t.Errorf("Base = %q, want origin/dev", wt.Base)
	}

	got, err := f.svc.Base(t.Context(), wt)
	if err != nil {
		t.Fatalf("Base() = %v, want nil", err)
	}
	if got != "origin/dev" {
		t.Errorf("Base() = %q, want what the worktree was registered with", got)
	}
}

func TestBaseAppliesTheRuleAgainForAWorktreeRegisteredBeforeTheColumn(t *testing.T) {
	t.Parallel()
	f := newFixture(t, false)

	wt := f.ensure(t)
	wt.Base = ""

	got, err := f.svc.Base(t.Context(), wt)
	if err != nil {
		t.Fatalf("Base() = %v, want nil", err)
	}
	// The origin of this fixture has no dev, so the rule falls back to main.
	if got != "origin/main" {
		t.Errorf("Base() = %q, want origin/main", got)
	}
}

func TestBaseFailsForARepositoryWithNoBaseBranchLeft(t *testing.T) {
	t.Parallel()

	f := newFixtureOf(t, repoWithoutBase(t))

	wt := worktree.Worktree{TaskID: "task-1", RepoPath: f.repo.Path, Path: f.repo.Path, Branch: taskName}
	if _, err := f.svc.Base(t.Context(), wt); !errors.Is(err, worktree.ErrNoBaseBranch) {
		t.Errorf("Base() = %v, want ErrNoBaseBranch", err)
	}
}

func TestGetAnswersNothingForATaskWithoutAWorktree(t *testing.T) {
	t.Parallel()
	f := newFixture(t, true)

	if _, ok := f.svc.Get("task-without-a-worktree"); ok {
		t.Error("Get() = true, want nothing for a task with no worktree")
	}
}
