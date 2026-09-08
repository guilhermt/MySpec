package git_test

import (
	"errors"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/git/gittest"
)

// headOf is the commit HEAD points at in dir.
func headOf(t *testing.T, dir string) string {
	t.Helper()
	return gittest.Run(t, dir, "rev-parse", "HEAD")
}

// write puts content in a file of dir, creating the directories it needs.
func write(t *testing.T, dir, name, content string) {
	t.Helper()

	path := filepath.Join(dir, name)
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		t.Fatalf("MkdirAll(%s) = %v, want nil", filepath.Dir(path), err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("WriteFile(%s) = %v, want nil", path, err)
	}
}

func TestRefExistsAnswersForARefThatIsThere(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)

	got, err := runner.RefExists(t.Context(), dir, "refs/remotes/origin/dev")
	if err != nil {
		t.Fatalf("RefExists(origin/dev) = %v, want nil", err)
	}
	if !got {
		t.Error("RefExists(origin/dev) = false, want true")
	}
}

func TestRefExistsAnswersForARefThatIsNotThere(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)

	got, err := runner.RefExists(t.Context(), dir, "refs/remotes/origin/nope")
	if err != nil {
		t.Fatalf("RefExists(origin/nope) = %v, want nil", err)
	}
	if got {
		t.Error("RefExists(origin/nope) = true, want false")
	}
}

func TestRefExistsFailsOutsideARepository(t *testing.T) {
	t.Parallel()
	runner, _ := repo(t)

	_, err := runner.RefExists(t.Context(), t.TempDir(), "refs/heads/main")
	var gitErr *git.Error
	if !errors.As(err, &gitErr) {
		t.Fatalf("RefExists outside a repository = %v, want *git.Error", err)
	}
}

func TestBranchExistsAnswersForALocalBranch(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)

	got, err := runner.BranchExists(t.Context(), dir, "main")
	if err != nil {
		t.Fatalf("BranchExists(main) = %v, want nil", err)
	}
	if !got {
		t.Error("BranchExists(main) = false, want true")
	}

	got, err = runner.BranchExists(t.Context(), dir, "login-screen")
	if err != nil {
		t.Fatalf("BranchExists(login-screen) = %v, want nil", err)
	}
	if got {
		t.Error("BranchExists(login-screen) = true, want false")
	}
}

func TestFetchUpdatesTheRemoteBranches(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)

	if err := runner.Fetch(t.Context(), dir, "origin"); err != nil {
		t.Fatalf("Fetch(origin) = %v, want nil", err)
	}
}

func TestFetchFailsWithAnUnreachableRemote(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)
	gittest.Run(t, dir, "remote", "set-url", "origin", filepath.Join(t.TempDir(), "nonexistent"))

	err := runner.Fetch(t.Context(), dir, "origin")
	var gitErr *git.Error
	if !errors.As(err, &gitErr) {
		t.Fatalf("Fetch(origin) = %v, want *git.Error", err)
	}
	if gitErr.Output == "" {
		t.Error("Output is empty, want what git printed")
	}
}

func TestStatusReportsEveryKindOfChange(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)
	gittest.Commit(t, dir, "gone.txt", "gone\n", "Add gone")
	gittest.Commit(t, dir, "moved.txt", "moved\n", "Add moved")
	gittest.Commit(t, dir, ".gitignore", "ignored.txt\n", "Ignore ignored.txt")

	write(t, dir, "README.md", "# changed\n")
	write(t, dir, "staged.txt", "staged\n")
	gittest.Run(t, dir, "add", "staged.txt")
	gittest.Run(t, dir, "rm", "--quiet", "gone.txt")
	gittest.Run(t, dir, "mv", "moved.txt", "elsewhere.txt")
	write(t, dir, "new/one.txt", "one\n")
	write(t, dir, "ignored.txt", "ignored\n")

	got, err := runner.Status(t.Context(), dir)
	if err != nil {
		t.Fatalf("Status = %v, want nil", err)
	}
	if want := headOf(t, dir); got.Head != want {
		t.Errorf("Head = %q, want %q", got.Head, want)
	}

	byPath := map[string]git.Change{}
	for _, change := range got.Changes {
		byPath[change.Path] = change
	}
	want := []struct {
		path   string
		kind   git.Kind
		staged bool
		line   string
	}{
		{"README.md", git.KindModified, false, " M README.md"},
		{"staged.txt", git.KindAdded, true, "A  staged.txt"},
		{"gone.txt", git.KindDeleted, true, "D  gone.txt"},
		{"elsewhere.txt", git.KindRenamed, true, "R  moved.txt -> elsewhere.txt"},
		{"new/one.txt", git.KindUntracked, false, "?? new/one.txt"},
	}
	for _, w := range want {
		change, ok := byPath[w.path]
		if !ok {
			t.Errorf("Status = %q, want it to list %q", got.Lines(), w.path)
			continue
		}
		if change.Kind() != w.kind {
			t.Errorf("Kind(%s) = %q, want %q", w.path, change.Kind(), w.kind)
		}
		if change.Staged() != w.staged {
			t.Errorf("Staged(%s) = %t, want %t", w.path, change.Staged(), w.staged)
		}
		if change.Line() != w.line {
			t.Errorf("Line(%s) = %q, want %q", w.path, change.Line(), w.line)
		}
	}
	if len(got.Changes) != len(want) {
		t.Errorf("Status = %q, want %d changes", got.Lines(), len(want))
	}
	if _, ok := byPath["ignored.txt"]; ok {
		t.Errorf("Status = %q, want nothing about an ignored file", got.Lines())
	}
}

func TestStatusSeesAFileStagedAndThenChangedAgainAsPending(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)

	write(t, dir, "README.md", "# staged\n")
	gittest.Run(t, dir, "add", "README.md")
	write(t, dir, "README.md", "# and changed again\n")

	got, err := runner.Status(t.Context(), dir)
	if err != nil {
		t.Fatalf("Status = %v, want nil", err)
	}
	if len(got.Changes) != 1 {
		t.Fatalf("Status = %q, want the one file", got.Lines())
	}
	if change := got.Changes[0]; change.Staged() {
		t.Errorf("Staged(%s) = true, want false for a partly staged file", change.Path)
	}
	if want := "MM README.md"; got.Lines()[0] != want {
		t.Errorf("Lines = %q, want %q", got.Lines()[0], want)
	}
}

func TestStatusIsEmptyInACleanWorkingTree(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)

	got, err := runner.Status(t.Context(), dir)
	if err != nil {
		t.Fatalf("Status = %v, want nil", err)
	}
	if !got.Clean() {
		t.Errorf("Status = %q, want nothing", got.Lines())
	}
	if got.Head == "" {
		t.Error("Head is empty, want the commit HEAD points at")
	}
}

func TestStatusHasNoHeadBeforeTheFirstCommit(t *testing.T) {
	t.Parallel()
	runner, _ := repo(t)
	dir := t.TempDir()
	gittest.Run(t, dir, "init", "--initial-branch=main")
	write(t, dir, "one.txt", "one\n")

	got, err := runner.Status(t.Context(), dir)
	if err != nil {
		t.Fatalf("Status = %v, want nil", err)
	}
	if got.Head != "" {
		t.Errorf("Head = %q, want it empty on a branch with no commit", got.Head)
	}
	if len(got.Changes) != 1 || got.Changes[0].Kind() != git.KindUntracked {
		t.Errorf("Status = %q, want the untracked file", got.Lines())
	}
}

func TestStatusFailsOutsideARepository(t *testing.T) {
	t.Parallel()
	runner, _ := repo(t)

	_, err := runner.Status(t.Context(), t.TempDir())
	var gitErr *git.Error
	if !errors.As(err, &gitErr) {
		t.Fatalf("Status outside a repository = %v, want *git.Error", err)
	}
}

func TestStatusReadsAnUnmergedPathAsPending(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)
	gittest.Commit(t, dir, "conflict.txt", "base\n", "Add conflict")
	gittest.Run(t, dir, "checkout", "-b", "other")
	gittest.Commit(t, dir, "conflict.txt", "theirs\n", "Change conflict on other")
	gittest.Run(t, dir, "checkout", "main")
	gittest.Commit(t, dir, "conflict.txt", "ours\n", "Change conflict on main")
	// The merge leaves the conflict behind, which is what the parser is read on.
	_, _ = runner.Run(t.Context(), dir, "merge", "other")

	got, err := runner.Status(t.Context(), dir)
	if err != nil {
		t.Fatalf("Status = %v, want nil", err)
	}
	if len(got.Changes) != 1 || got.Changes[0].Path != "conflict.txt" {
		t.Fatalf("Status = %q, want the conflicting file", got.Lines())
	}
	if got.Changes[0].Staged() {
		t.Error("Staged(conflict.txt) = true, want false for an unmerged path")
	}
}

func TestGitDirPointsAtWhereTheIndexOfAWorktreeLives(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)
	path := filepath.Join(t.TempDir(), "login-screen")
	if err := runner.AddWorktree(t.Context(), dir, path, "login-screen", "refs/remotes/origin/dev"); err != nil {
		t.Fatalf("AddWorktree = %v, want nil", err)
	}

	got, err := runner.GitDir(t.Context(), path)
	if err != nil {
		t.Fatalf("GitDir = %v, want nil", err)
	}
	if want := filepath.Join(dir, ".git", "worktrees", "login-screen"); got != want {
		t.Errorf("GitDir = %q, want %q", got, want)
	}
	if _, err := os.Stat(filepath.Join(got, "index")); err != nil {
		t.Errorf("Stat(index) = %v, want the index of the worktree there", err)
	}
}

func TestTrackedFilesListsWhatGitTracks(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)
	gittest.Commit(t, dir, "src/main.go", "package main\n", "Add main")
	write(t, dir, "untracked.txt", "untracked\n")

	got, err := runner.TrackedFiles(t.Context(), dir)
	if err != nil {
		t.Fatalf("TrackedFiles = %v, want nil", err)
	}
	if want := []string{"README.md", "src/main.go"}; !slices.Equal(got, want) {
		t.Errorf("TrackedFiles = %q, want %q", got, want)
	}
}

func TestIsIgnoredAnswersForBothKindsOfPath(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)
	gittest.Commit(t, dir, ".gitignore", "ignored.txt\n", "Ignore ignored.txt")

	for _, tc := range []struct {
		path string
		want bool
	}{
		{"ignored.txt", true},
		{"README.md", false},
		{filepath.Join(dir, "ignored.txt"), true},
	} {
		got, err := runner.IsIgnored(t.Context(), dir, tc.path)
		if err != nil {
			t.Fatalf("IsIgnored(%s) = %v, want nil", tc.path, err)
		}
		if got != tc.want {
			t.Errorf("IsIgnored(%s) = %t, want %t", tc.path, got, tc.want)
		}
	}
}

func TestCommitReadsTheShaAndTheSubject(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)
	gittest.Commit(t, dir, "one.txt", "one\n", "Add the first file\n\nWith a body git must not return.")

	got, err := runner.Commit(t.Context(), dir, "HEAD")
	if err != nil {
		t.Fatalf("Commit(HEAD) = %v, want nil", err)
	}
	if want := headOf(t, dir); got.SHA != want {
		t.Errorf("SHA = %q, want %q", got.SHA, want)
	}
	if want := "Add the first file"; got.Subject != want {
		t.Errorf("Subject = %q, want %q", got.Subject, want)
	}
}

func TestCommitFailsForARevisionThatIsNotThere(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)

	_, err := runner.Commit(t.Context(), dir, "refs/heads/nope")
	var gitErr *git.Error
	if !errors.As(err, &gitErr) {
		t.Fatalf("Commit(nope) = %v, want *git.Error", err)
	}
}

func TestResetAndCleanRestoreTheWorkingTree(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)
	gittest.Commit(t, dir, ".gitignore", "ignored.txt\n", "Ignore ignored.txt")

	write(t, dir, "README.md", "# changed\n")
	write(t, dir, "new/one.txt", "one\n")
	write(t, dir, "ignored.txt", "ignored\n")

	if err := runner.Reset(t.Context(), dir); err != nil {
		t.Fatalf("Reset = %v, want nil", err)
	}
	if err := runner.Clean(t.Context(), dir); err != nil {
		t.Fatalf("Clean = %v, want nil", err)
	}

	got, err := runner.Status(t.Context(), dir)
	if err != nil {
		t.Fatalf("Status = %v, want nil", err)
	}
	if !got.Clean() {
		t.Errorf("Status = %q, want nothing", got.Lines())
	}
	if _, err := os.Stat(filepath.Join(dir, "ignored.txt")); err != nil {
		t.Errorf("Stat(ignored.txt) = %v, want the ignored file kept", err)
	}
}

func TestAddWorktreeCreatesABranchWithoutAnUpstream(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)
	path := filepath.Join(t.TempDir(), "login-screen")

	err := runner.AddWorktree(t.Context(), dir, path, "login-screen", "refs/remotes/origin/dev")
	if err != nil {
		t.Fatalf("AddWorktree = %v, want nil", err)
	}

	if got := gittest.Run(t, path, "rev-parse", "--abbrev-ref", "HEAD"); got != "login-screen" {
		t.Errorf("HEAD of the worktree = %q, want %q", got, "login-screen")
	}
	remote, err := runner.Run(t.Context(), dir, "config", "--default", "", "branch.login-screen.remote")
	if err != nil {
		t.Fatalf("Run(config) = %v, want nil", err)
	}
	if remote != "" {
		t.Errorf("branch.login-screen.remote = %q, want it unset", remote)
	}
}

func TestRemoveWorktreeAndDeleteBranchUndoAnAdd(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)
	path := filepath.Join(t.TempDir(), "login-screen")

	if err := runner.AddWorktree(t.Context(), dir, path, "login-screen", "refs/remotes/origin/dev"); err != nil {
		t.Fatalf("AddWorktree = %v, want nil", err)
	}
	write(t, path, "scratch.txt", "left behind\n")

	if err := runner.RemoveWorktree(t.Context(), dir, path); err != nil {
		t.Fatalf("RemoveWorktree = %v, want nil", err)
	}
	if err := runner.DeleteBranch(t.Context(), dir, "login-screen"); err != nil {
		t.Fatalf("DeleteBranch = %v, want nil", err)
	}
	if err := runner.PruneWorktrees(t.Context(), dir); err != nil {
		t.Fatalf("PruneWorktrees = %v, want nil", err)
	}

	if _, err := os.Stat(path); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("Stat(%s) = %v, want the worktree gone", path, err)
	}
	exists, err := runner.BranchExists(t.Context(), dir, "login-screen")
	if err != nil {
		t.Fatalf("BranchExists(login-screen) = %v, want nil", err)
	}
	if exists {
		t.Error("BranchExists(login-screen) = true, want the branch gone")
	}
}

func TestExcludePathPointsInsideTheGitDirectory(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)

	got, err := runner.ExcludePath(t.Context(), dir)
	if err != nil {
		t.Fatalf("ExcludePath = %v, want nil", err)
	}
	if !filepath.IsAbs(got) {
		t.Errorf("ExcludePath = %q, want an absolute path", got)
	}
	if want := filepath.Join(dir, ".git", "info", "exclude"); got != want {
		t.Errorf("ExcludePath = %q, want %q", got, want)
	}
}

func TestCountCommitsCountsWhatABranchHasPastItsBase(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)

	gittest.Run(t, dir, "checkout", "--quiet", "-b", "login-screen", "origin/dev")
	if got, err := runner.CountCommits(t.Context(), dir, "origin/dev", "login-screen"); err != nil || got != 0 {
		t.Fatalf("CountCommits() = %d, %v, want 0, nil on a branch that just started", got, err)
	}

	gittest.Commit(t, dir, "one.go", "package one\n", "Add one")
	gittest.Commit(t, dir, "two.go", "package two\n", "Add two")

	got, err := runner.CountCommits(t.Context(), dir, "origin/dev", "login-screen")
	if err != nil {
		t.Fatalf("CountCommits() = %v, want nil", err)
	}
	if got != 2 {
		t.Errorf("CountCommits() = %d, want the 2 commits of the branch", got)
	}
}

func TestCountCommitsReportsARefThatIsNotThere(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)

	_, err := runner.CountCommits(t.Context(), dir, "origin/dev", "no-such-branch")
	var gitErr *git.Error
	if !errors.As(err, &gitErr) {
		t.Errorf("CountCommits() = %v, want *git.Error", err)
	}
}
