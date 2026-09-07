package git_test

import (
	"errors"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/git/gittest"
)

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
	gittest.Commit(t, dir, "kept.txt", "kept\n", "Add kept")
	gittest.Commit(t, dir, "gone.txt", "gone\n", "Add gone")
	gittest.Commit(t, dir, ".gitignore", "ignored.txt\n", "Ignore ignored.txt")

	write(t, dir, "README.md", "# changed\n")
	write(t, dir, "staged.txt", "staged\n")
	gittest.Run(t, dir, "add", "staged.txt")
	gittest.Run(t, dir, "rm", "--quiet", "gone.txt")
	write(t, dir, "new/one.txt", "one\n")
	write(t, dir, "ignored.txt", "ignored\n")

	lines, err := runner.Status(t.Context(), dir)
	if err != nil {
		t.Fatalf("Status = %v, want nil", err)
	}
	// Run trims the whole output, so the first line comes without the leading
	// space git puts on a change that is only in the working tree.
	want := []string{"M README.md", "D  gone.txt", "A  staged.txt", "?? new/one.txt"}
	for _, entry := range want {
		if !slices.Contains(lines, entry) {
			t.Errorf("Status = %q, want it to list %q", lines, entry)
		}
	}
	for _, line := range lines {
		if strings.Contains(line, "ignored.txt") {
			t.Errorf("Status = %q, want nothing about an ignored file", lines)
		}
	}
}

func TestStatusIsEmptyInACleanWorkingTree(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)

	lines, err := runner.Status(t.Context(), dir)
	if err != nil {
		t.Fatalf("Status = %v, want nil", err)
	}
	if len(lines) != 0 {
		t.Errorf("Status = %q, want nothing", lines)
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

	lines, err := runner.Status(t.Context(), dir)
	if err != nil {
		t.Fatalf("Status = %v, want nil", err)
	}
	if len(lines) != 0 {
		t.Errorf("Status = %q, want nothing", lines)
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
