package repository_test

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/git/gittest"
	"github.com/guilhermt/myspec/internal/repository"
)

// newIdentifier is an Identifier asking the real git, isolated from the machine.
func newIdentifier(t *testing.T) repository.Identifier {
	t.Helper()
	return repository.NewIdentifier(git.New(git.Deps{Env: gittest.Env(t)}))
}

// gitClone is a clone of a fresh local origin, and the path of that origin.
func gitClone(t *testing.T) (dir, origin string) {
	t.Helper()

	origin = gittest.Origin(t, false)
	return gittest.Clone(t, origin, filepath.Join(t.TempDir(), "web")), origin
}

func TestIdentifyReadsTheRepositoryOfACloneOnGitHub(t *testing.T) {
	t.Parallel()
	dir, _ := gitClone(t)
	gittest.Run(t, dir, "remote", "set-url", "origin", "git@github.com:dev/web.git")

	got, err := newIdentifier(t).Identify(t.Context(), dir+"/")
	if err != nil {
		t.Fatalf("Identify(%s) = %v, want nil", dir, err)
	}
	if want := (repository.Identity{Owner: "dev", Name: "web"}); got != want {
		t.Errorf("Identify(%s) = %+v, want %+v", dir, got, want)
	}
}

func TestIdentifyRefusesWhatIsNotACloneOnGitHub(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		// folder builds the folder to identify and says how it is refused.
		folder func(t *testing.T) (path string, want *repository.Refusal, message string)
	}{
		{
			name: "a folder that does not exist",
			folder: func(t *testing.T) (string, *repository.Refusal, string) {
				t.Helper()
				path := filepath.Join(t.TempDir(), "gone")
				return path, &repository.Refusal{Reason: repository.ReasonCloneMissing, Path: path},
					"The clone at " + path + " is missing."
			},
		},
		{
			name: "a file",
			folder: func(t *testing.T) (string, *repository.Refusal, string) {
				t.Helper()
				path := filepath.Join(t.TempDir(), "notes.txt")
				if err := os.WriteFile(path, nil, 0o600); err != nil {
					t.Fatalf("WriteFile(%s) = %v, want nil", path, err)
				}
				return path, &repository.Refusal{Reason: repository.ReasonCloneMissing, Path: path},
					"The clone at " + path + " is missing."
			},
		},
		{
			name: "a subdirectory of a clone",
			folder: func(t *testing.T) (string, *repository.Refusal, string) {
				t.Helper()
				dir, _ := gitClone(t)
				path := filepath.Join(dir, "src")
				if err := os.Mkdir(path, 0o750); err != nil {
					t.Fatalf("Mkdir(%s) = %v, want nil", path, err)
				}
				return path, &repository.Refusal{Reason: repository.ReasonNotGitRoot, Path: path},
					path + " is not the root of a git repository."
			},
		},
		{
			name: "a worktree of a clone",
			folder: func(t *testing.T) (string, *repository.Refusal, string) {
				t.Helper()
				dir, _ := gitClone(t)
				path := filepath.Join(t.TempDir(), "feature")
				gittest.Run(t, dir, "worktree", "add", "--quiet", "-b", "feature", path)
				return path, &repository.Refusal{Reason: repository.ReasonNotGitRoot, Path: path},
					path + " is not the root of a git repository."
			},
		},
		{
			name: "a repository without origin",
			folder: func(t *testing.T) (string, *repository.Refusal, string) {
				t.Helper()
				path := t.TempDir()
				gittest.Run(t, path, "init", "--quiet")
				return path, &repository.Refusal{Reason: repository.ReasonNoOrigin, Path: path},
					path + " has no origin remote."
			},
		},
		{
			name: "a clone whose origin is not on GitHub",
			folder: func(t *testing.T) (string, *repository.Refusal, string) {
				t.Helper()
				path, origin := gitClone(t)
				return path, &repository.Refusal{Reason: repository.ReasonNotGitHub, Path: path, URL: origin},
					"The origin remote of " + path + " is not on GitHub: " + origin + "."
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			path, want, message := tt.folder(t)

			_, err := newIdentifier(t).Identify(t.Context(), path)
			wantRefusal(t, err, want, message)
		})
	}
}

func TestIdentifyGivesBackAFailureOfGitAsGitSaidIt(t *testing.T) {
	t.Parallel()
	// A .git directory with nothing in it is not a repository git can read.
	path := clone(t, t.TempDir(), "broken")

	_, err := newIdentifier(t).Identify(t.Context(), path)
	var gitErr *git.Error
	if !errors.As(err, &gitErr) {
		t.Fatalf("Identify(%s) = %v, want a *git.Error", path, err)
	}
	var refusal *repository.Refusal
	if errors.As(err, &refusal) {
		t.Errorf("Identify(%s) = %v, want a failure that is not a refusal", path, err)
	}
}
