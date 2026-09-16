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

func TestArtifactsDirLivesUnderTheRepository(t *testing.T) {
	t.Parallel()

	got := task.ArtifactsDir("/data", "dev", "web", "add-login")
	want := filepath.Join("/data", "tasks", "dev", "web", "add-login")
	if got != want {
		t.Errorf("ArtifactsDir() = %q, want %q", got, want)
	}
}

func TestTaskPRDPathIsInTheArtifactsDir(t *testing.T) {
	t.Parallel()

	tk := task.Task{ArtifactsDir: "/data/tasks/add-login"}
	if want := "/data/tasks/add-login/PRD.md"; tk.PRDPath() != want {
		t.Errorf("PRDPath() = %q, want %q", tk.PRDPath(), want)
	}
}
