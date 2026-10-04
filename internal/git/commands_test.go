package git_test

import (
	"errors"
	"os"
	"path/filepath"
	"slices"
	"testing"
	"time"

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
	if change := got.Changes[0]; !change.Partial() {
		t.Errorf("Partial(%s) = false, want true for a partly staged file", change.Path)
	}
	if want := "MM README.md"; got.Lines()[0] != want {
		t.Errorf("Lines = %q, want %q", got.Lines()[0], want)
	}
}

func TestPartialIsAPathStagedAndChangedAgain(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		x, y byte
		want bool
	}{
		{"modified in both", 'M', 'M', true},
		{"added and changed again", 'A', 'M', true},
		{"renamed and changed again", 'R', 'M', true},
		{"staged, then deleted", 'M', 'D', true},
		{"only staged", 'M', '.', false},
		{"only in the working tree", '.', 'M', false},
		{"untracked", '?', '?', false},
		{"unmerged", 'U', 'U', true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			change := git.Change{X: tt.x, Y: tt.y, Path: "a.go"}
			if got := change.Partial(); got != tt.want {
				t.Errorf("Partial(%c%c) = %t, want %t", tt.x, tt.y, got, tt.want)
			}
		})
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

func TestCommitReadsTheShaTheSubjectAndTheCommitterDate(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)
	when := time.Date(2026, 9, 20, 11, 30, 0, 0, time.FixedZone("BRT", -3*60*60))
	gittest.CommitAt(t, dir, "one.txt", "one\n", "Add the first file\n\nWith a body git must not return.", when)

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
	if !got.CommittedAt.Equal(when) || got.CommittedAt.Location() != time.UTC {
		t.Errorf("CommittedAt = %v, want %v", got.CommittedAt, when.UTC())
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

func TestWorktreesListsTheWorktreesOfTheCloneAndWhatGitWouldPrune(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)
	kept := filepath.Join(t.TempDir(), "login-screen")
	gone := filepath.Join(t.TempDir(), "sign-up")
	for _, path := range []string{kept, gone} {
		if err := runner.AddWorktree(t.Context(), dir, path, filepath.Base(path), "refs/remotes/origin/dev"); err != nil {
			t.Fatalf("AddWorktree(%s) = %v, want nil", path, err)
		}
	}
	if err := os.RemoveAll(gone); err != nil {
		t.Fatalf("RemoveAll(%s) = %v, want nil", gone, err)
	}

	got, err := runner.Worktrees(t.Context(), dir)
	if err != nil {
		t.Fatalf("Worktrees() = %v, want nil", err)
	}

	want := []git.ListedWorktree{{Path: dir}, {Path: kept}, {Path: gone, Prunable: true}}
	if !slices.Equal(got, want) {
		t.Errorf("Worktrees() = %+v, want %+v", got, want)
	}
}

func TestWorktreesFailsOutsideARepository(t *testing.T) {
	t.Parallel()
	runner, _ := repo(t)

	if _, err := runner.Worktrees(t.Context(), t.TempDir()); err == nil {
		t.Error("Worktrees() = nil, want the error outside a repository")
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

func TestCurrentBranchReadsTheBranchCheckedOut(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)

	got, err := runner.CurrentBranch(t.Context(), dir)
	if err != nil {
		t.Fatalf("CurrentBranch() = %v, want nil", err)
	}
	if got != "main" {
		t.Errorf("CurrentBranch() = %q, want %q", got, "main")
	}
}

func TestCurrentBranchIsEmptyOnADetachedHead(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)
	gittest.Run(t, dir, "checkout", "--quiet", "--detach", "HEAD")

	got, err := runner.CurrentBranch(t.Context(), dir)
	if err != nil {
		t.Fatalf("CurrentBranch() = %v, want nil on a detached HEAD", err)
	}
	if got != "" {
		t.Errorf("CurrentBranch() = %q, want it empty on a detached HEAD", got)
	}
}

func TestCurrentBranchFailsOutsideARepository(t *testing.T) {
	t.Parallel()
	runner, _ := repo(t)

	_, err := runner.CurrentBranch(t.Context(), t.TempDir())
	var gitErr *git.Error
	if !errors.As(err, &gitErr) {
		t.Fatalf("CurrentBranch outside a repository = %v, want *git.Error", err)
	}
}

func TestUpstreamAnswersForBothKindsOfBranch(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)
	gittest.Run(t, dir, "branch", "--no-track", "login-screen", "origin/dev")

	got, err := runner.Upstream(t.Context(), dir, "main")
	if err != nil {
		t.Fatalf("Upstream(main) = %v, want nil", err)
	}
	if want := "origin/main"; got != want {
		t.Errorf("Upstream(main) = %q, want %q", got, want)
	}

	got, err = runner.Upstream(t.Context(), dir, "login-screen")
	if err != nil {
		t.Fatalf("Upstream(login-screen) = %v, want nil", err)
	}
	if got != "" {
		t.Errorf("Upstream(login-screen) = %q, want it empty for a branch that tracks nothing", got)
	}
}

func TestRemoteURLReadsTheURLAsItWasConfigured(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)
	const want = "git@github.com:dev/web.git"
	gittest.Run(t, dir, "remote", "set-url", "origin", want)

	got, err := runner.RemoteURL(t.Context(), dir, "origin")
	if err != nil {
		t.Fatalf("RemoteURL(origin) = %v, want nil", err)
	}
	if got != want {
		t.Errorf("RemoteURL(origin) = %q, want %q", got, want)
	}
}

func TestRemoteURLReportsARemoteTheRepositoryDoesNotHave(t *testing.T) {
	t.Parallel()
	runner, _ := repo(t)
	dir := t.TempDir()
	gittest.Run(t, dir, "init", "--quiet")

	_, err := runner.RemoteURL(t.Context(), dir, "origin")
	if !errors.Is(err, git.ErrNoRemote) {
		t.Fatalf("RemoteURL(origin) = %v, want git.ErrNoRemote", err)
	}
}

func TestRemoteURLFailsOutsideARepository(t *testing.T) {
	t.Parallel()
	runner, _ := repo(t)

	_, err := runner.RemoteURL(t.Context(), t.TempDir(), "origin")
	var gitErr *git.Error
	if !errors.As(err, &gitErr) {
		t.Fatalf("RemoteURL outside a repository = %v, want *git.Error", err)
	}
	if errors.Is(err, git.ErrNoRemote) {
		t.Errorf("RemoteURL outside a repository = %v, want a failure other than git.ErrNoRemote", err)
	}
}

func TestIsAncestorAnswersForABranchInAndOutOfItsBase(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)
	gittest.Run(t, dir, "checkout", "--quiet", "-b", "login-screen")

	got, err := runner.IsAncestor(t.Context(), dir, "refs/heads/login-screen", "refs/heads/main")
	if err != nil {
		t.Fatalf("IsAncestor(login-screen, main) = %v, want nil", err)
	}
	if !got {
		t.Error("IsAncestor(login-screen, main) = false, want true for a branch with no commit of its own")
	}

	gittest.Commit(t, dir, "one.txt", "one\n", "Add one")

	got, err = runner.IsAncestor(t.Context(), dir, "refs/heads/login-screen", "refs/heads/main")
	if err != nil {
		t.Fatalf("IsAncestor(login-screen, main) = %v, want nil", err)
	}
	if got {
		t.Error("IsAncestor(login-screen, main) = true, want false for a branch main does not hold")
	}
}

func TestIsAncestorReportsARefThatIsNotThere(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)

	_, err := runner.IsAncestor(t.Context(), dir, "refs/heads/no-such-branch", "refs/heads/main")
	var gitErr *git.Error
	if !errors.As(err, &gitErr) {
		t.Errorf("IsAncestor(no-such-branch, main) = %v, want *git.Error", err)
	}
}

func TestMergeFastForwardMovesTheBranchToTheRef(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)

	gittest.Run(t, dir, "checkout", "--quiet", "-b", "ahead")
	gittest.Commit(t, dir, "one.txt", "one\n", "Add one")
	want := headOf(t, dir)
	gittest.Run(t, dir, "checkout", "--quiet", "main")

	if err := runner.MergeFastForward(t.Context(), dir, "ahead"); err != nil {
		t.Fatalf("MergeFastForward(ahead) = %v, want nil", err)
	}
	if got := headOf(t, dir); got != want {
		t.Errorf("HEAD = %s, want main moved to %s", got, want)
	}
}

func TestMergeFastForwardRefusesWhenTheBranchDiverged(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)

	gittest.Run(t, dir, "checkout", "--quiet", "-b", "ahead")
	gittest.Commit(t, dir, "one.txt", "one\n", "Add one")
	gittest.Run(t, dir, "checkout", "--quiet", "main")
	gittest.Commit(t, dir, "two.txt", "two\n", "Add two")
	want := headOf(t, dir)

	err := runner.MergeFastForward(t.Context(), dir, "ahead")
	var gitErr *git.Error
	if !errors.As(err, &gitErr) {
		t.Fatalf("MergeFastForward(ahead) = %v, want *git.Error", err)
	}
	if got := headOf(t, dir); got != want {
		t.Errorf("HEAD = %s, want main left at %s", got, want)
	}
}

func TestAddDetachedWorktreeChecksOutTheRefWithNoBranch(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)
	path := filepath.Join(t.TempDir(), "pr_42")

	if err := runner.AddDetachedWorktree(t.Context(), dir, path, "origin/dev"); err != nil {
		t.Fatalf("AddDetachedWorktree(origin/dev) = %v, want nil", err)
	}
	if got := headOf(t, path); got != headOf(t, dir) {
		t.Errorf("HEAD = %q, want the commit of origin/dev %q", got, headOf(t, dir))
	}

	branch, err := runner.CurrentBranch(t.Context(), path)
	if err != nil {
		t.Fatalf("CurrentBranch() = %v, want nil", err)
	}
	if branch != "" {
		t.Errorf("CurrentBranch() = %q, want no branch", branch)
	}
	if branches := gittest.Run(t, dir, "branch", "--list", "dev"); branches != "" {
		t.Errorf("branches = %q, want no local branch created", branches)
	}
}

func TestAddDetachedWorktreeFailsOnARefThatIsNotThere(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)

	err := runner.AddDetachedWorktree(t.Context(), dir, filepath.Join(t.TempDir(), "pr_42"), "origin/nope")
	var gitErr *git.Error
	if !errors.As(err, &gitErr) {
		t.Fatalf("AddDetachedWorktree(origin/nope) = %v, want *git.Error", err)
	}
}

func TestCheckoutDetachedMovesTheWorktreeToTheRef(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)
	path := filepath.Join(t.TempDir(), "pr_42")
	if err := runner.AddDetachedWorktree(t.Context(), dir, path, "origin/dev"); err != nil {
		t.Fatalf("AddDetachedWorktree(origin/dev) = %v, want nil", err)
	}
	gittest.Commit(t, dir, "login.go", "package login\n", "Add the login screen")
	gittest.Run(t, dir, "push", "origin", "main:dev")
	gittest.Run(t, dir, "fetch", "origin")

	if err := runner.CheckoutDetached(t.Context(), path, "origin/dev"); err != nil {
		t.Fatalf("CheckoutDetached(origin/dev) = %v, want nil", err)
	}
	if got := headOf(t, path); got != headOf(t, dir) {
		t.Errorf("HEAD = %q, want the new commit of origin/dev %q", got, headOf(t, dir))
	}

	branch, err := runner.CurrentBranch(t.Context(), path)
	if err != nil {
		t.Fatalf("CurrentBranch() = %v, want nil", err)
	}
	if branch != "" {
		t.Errorf("CurrentBranch() = %q, want no branch", branch)
	}
}

func TestCheckoutDetachedFailsOnARefThatIsNotThere(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)
	path := filepath.Join(t.TempDir(), "pr_42")
	if err := runner.AddDetachedWorktree(t.Context(), dir, path, "origin/dev"); err != nil {
		t.Fatalf("AddDetachedWorktree(origin/dev) = %v, want nil", err)
	}

	err := runner.CheckoutDetached(t.Context(), path, "origin/nope")
	var gitErr *git.Error
	if !errors.As(err, &gitErr) {
		t.Fatalf("CheckoutDetached(origin/nope) = %v, want *git.Error", err)
	}
}
