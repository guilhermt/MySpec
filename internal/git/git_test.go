package git_test

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"testing"

	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/git/gittest"
)

// repo is a clone of a fresh origin, with the runner that acts on it.
func repo(t *testing.T) (*git.Runner, string) {
	t.Helper()

	origin := gittest.Origin(t, true)
	dir := gittest.Clone(t, origin, filepath.Join(t.TempDir(), "api"))
	return git.New(git.Deps{Env: gittest.Env(t)}), dir
}

func TestRunReturnsTheTrimmedOutputOfGit(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)

	got, err := runner.Run(t.Context(), dir, "rev-parse", "--abbrev-ref", "HEAD")
	if err != nil {
		t.Fatalf("Run(rev-parse) = %v, want nil", err)
	}
	if got != "main" {
		t.Errorf("Run(rev-parse) = %q, want %q", got, "main")
	}
}

func TestRunReportsWhatGitSaidAboutAFailure(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)

	_, err := runner.Run(t.Context(), dir, "cat-file", "-p", "nope")
	var gitErr *git.Error
	if !errors.As(err, &gitErr) {
		t.Fatalf("Run(cat-file) error = %v, want *git.Error", err)
	}
	if want := []string{"cat-file", "-p", "nope"}; strings.Join(gitErr.Args, " ") != strings.Join(want, " ") {
		t.Errorf("Args = %v, want %v", gitErr.Args, want)
	}
	if gitErr.Dir != dir {
		t.Errorf("Dir = %q, want %q", gitErr.Dir, dir)
	}
	if gitErr.ExitCode <= 0 {
		t.Errorf("ExitCode = %d, want a non-zero exit", gitErr.ExitCode)
	}
	if gitErr.Output == "" {
		t.Error("Output is empty, want what git printed")
	}
	if !strings.Contains(gitErr.Error(), gitErr.Output) {
		t.Errorf("Error() = %q, want it to carry %q", gitErr.Error(), gitErr.Output)
	}
}

func TestRunReportsACancelledContext(t *testing.T) {
	t.Parallel()
	runner, dir := repo(t)

	ctx, cancel := context.WithCancel(t.Context())
	cancel()

	_, err := runner.Run(ctx, dir, "status")
	var gitErr *git.Error
	if !errors.As(err, &gitErr) {
		t.Fatalf("Run(status) error = %v, want *git.Error", err)
	}
	if !errors.Is(err, context.Canceled) {
		t.Errorf("Run(status) error = %v, want context.Canceled underneath", err)
	}
	if gitErr.ExitCode != -1 {
		t.Errorf("ExitCode = %d, want -1", gitErr.ExitCode)
	}
}

func TestRunFailsWithoutGitOnThePath(t *testing.T) {
	t.Setenv("PATH", t.TempDir())

	runner := git.New(git.Deps{})
	_, err := runner.Run(t.Context(), t.TempDir(), "status")
	if !errors.Is(err, git.ErrNotFound) {
		t.Errorf("Run(status) error = %v, want ErrNotFound", err)
	}
}
