package task_test

import (
	"errors"
	"path/filepath"
	"strings"
	"testing"

	"github.com/guilhermt/myspec/internal/task"
)

func TestValidateName(t *testing.T) {
	t.Parallel()

	tests := map[string]struct {
		name string
		want error
	}{
		"single word":         {name: "login", want: nil},
		"hyphenated":          {name: "add-login-screen", want: nil},
		"digits":              {name: "fix-404", want: nil},
		"only digits":         {name: "42", want: nil},
		"at the length cap":   {name: strings.Repeat("a", task.NameMaxLen), want: nil},
		"empty":               {name: "", want: task.ErrInvalidName},
		"uppercase":           {name: "Login", want: task.ErrInvalidName},
		"underscore":          {name: "add_login", want: task.ErrInvalidName},
		"space":               {name: "add login", want: task.ErrInvalidName},
		"leading hyphen":      {name: "-login", want: task.ErrInvalidName},
		"trailing hyphen":     {name: "login-", want: task.ErrInvalidName},
		"double hyphen":       {name: "add--login", want: task.ErrInvalidName},
		"slash":               {name: "feat/login", want: task.ErrInvalidName},
		"dot":                 {name: "login.v2", want: task.ErrInvalidName},
		"accent":              {name: "loginção", want: task.ErrInvalidName},
		"past the length cap": {name: strings.Repeat("a", task.NameMaxLen+1), want: task.ErrInvalidName},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			if err := task.ValidateName(tc.name); !errors.Is(err, tc.want) {
				t.Errorf("ValidateName(%q) = %v, want %v", tc.name, err, tc.want)
			}
		})
	}
}

func TestWorkspaceSlugIsStable(t *testing.T) {
	t.Parallel()

	first := task.WorkspaceSlug("/home/user/code/my-app")
	second := task.WorkspaceSlug("/home/user/code/my-app")
	if first != second {
		t.Errorf("WorkspaceSlug is not stable: %q then %q", first, second)
	}
	if want := "my-app-"; !strings.HasPrefix(first, want) {
		t.Errorf("WorkspaceSlug() = %q, want prefix %q", first, want)
	}
}

func TestWorkspaceSlugSeparatesPathsSharingABase(t *testing.T) {
	t.Parallel()

	first := task.WorkspaceSlug("/home/user/one/app")
	second := task.WorkspaceSlug("/home/user/two/app")
	if first == second {
		t.Errorf("WorkspaceSlug() = %q for both paths, want different slugs", first)
	}
}

func TestWorkspaceSlugNormalizesTheBase(t *testing.T) {
	t.Parallel()

	tests := map[string]string{
		"/home/user/My App":  "my-app-",
		"/home/user/__app__": "app-",
		"/home/user/ç":       "workspace-",
		"/":                  "workspace-",
	}

	for path, prefix := range tests {
		t.Run(path, func(t *testing.T) {
			t.Parallel()

			if got := task.WorkspaceSlug(path); !strings.HasPrefix(got, prefix) {
				t.Errorf("WorkspaceSlug(%q) = %q, want prefix %q", path, got, prefix)
			}
		})
	}
}

func TestArtifactsDirLivesUnderTheWorkspaceSlug(t *testing.T) {
	t.Parallel()

	const workspacePath = "/home/user/code/my-app"
	got := task.ArtifactsDir("/data", workspacePath, "add-login")
	want := filepath.Join("/data", "workspaces", task.WorkspaceSlug(workspacePath), "tasks", "add-login")
	if got != want {
		t.Errorf("ArtifactsDir() = %q, want %q", got, want)
	}
}

func TestTaskDirIsTheRepositoryOrTheWorkspaceRoot(t *testing.T) {
	t.Parallel()

	root := task.Task{WorkspacePath: "/ws"}
	if got := root.Dir(); got != "/ws" {
		t.Errorf("Dir() = %q, want %q", got, "/ws")
	}

	inRepo := task.Task{WorkspacePath: "/ws", RepoPath: "/ws/api"}
	if got := inRepo.Dir(); got != "/ws/api" {
		t.Errorf("Dir() = %q, want %q", got, "/ws/api")
	}
}

func TestTaskPRDPathIsInTheArtifactsDir(t *testing.T) {
	t.Parallel()

	tk := task.Task{ArtifactsDir: "/data/tasks/add-login"}
	if want := "/data/tasks/add-login/PRD.md"; tk.PRDPath() != want {
		t.Errorf("PRDPath() = %q, want %q", tk.PRDPath(), want)
	}
}
