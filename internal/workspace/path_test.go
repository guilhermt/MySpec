package workspace_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/guilhermt/myspec/internal/workspace"
)

func TestResolvePath(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		raw  string
		cwd  string
		want string
	}{
		{name: "relative", raw: "work/api", cwd: "/home/dev", want: "/home/dev/work/api"},
		{name: "dot", raw: ".", cwd: "/home/dev/work", want: "/home/dev/work"},
		{name: "absolute", raw: "/srv/work/", cwd: "/home/dev", want: "/srv/work"},
		{name: "parent", raw: "../other", cwd: "/home/dev/work", want: "/home/dev/other"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := workspace.ResolvePath(tt.raw, tt.cwd); got != tt.want {
				t.Errorf("ResolvePath(%q, %q) = %q, want %q", tt.raw, tt.cwd, got, tt.want)
			}
		})
	}
}

func TestValidateAcceptsAReadableFolder(t *testing.T) {
	t.Parallel()

	if err := workspace.Validate(t.TempDir()); err != nil {
		t.Errorf("Validate() = %v, want nil", err)
	}
}

func TestValidateRejectsAMissingPath(t *testing.T) {
	t.Parallel()

	err := workspace.Validate(filepath.Join(t.TempDir(), "gone"))

	wantErrIs(t, err, workspace.ErrNotFound)
	if got := workspace.ReasonFor(err); got != workspace.ReasonNotFound {
		t.Errorf("ReasonFor() = %q, want %q", got, workspace.ReasonNotFound)
	}
}

func TestValidateRejectsAFile(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "notes.md")
	if err := os.WriteFile(path, nil, 0o600); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}

	err := workspace.Validate(path)

	wantErrIs(t, err, workspace.ErrNotDirectory)
	if got := workspace.ReasonFor(err); got != workspace.ReasonNotDirectory {
		t.Errorf("ReasonFor() = %q, want %q", got, workspace.ReasonNotDirectory)
	}
}

func TestValidateRejectsAnUnreadableFolder(t *testing.T) {
	t.Parallel()
	if os.Geteuid() == 0 {
		t.Skip("root reads directories regardless of their mode")
	}
	path := mkdir(t, t.TempDir(), "locked")
	if err := os.Chmod(path, 0o000); err != nil {
		t.Fatalf("chmod %s: %v", path, err)
	}
	t.Cleanup(func() {
		if err := os.Chmod(path, 0o700); err != nil {
			t.Errorf("restore %s: %v", path, err)
		}
	})

	err := workspace.Validate(path)

	wantErrIs(t, err, workspace.ErrNotReadable)
	if got := workspace.ReasonFor(err); got != workspace.ReasonNotReadable {
		t.Errorf("ReasonFor() = %q, want %q", got, workspace.ReasonNotReadable)
	}
}

func TestReasonForPanicsOnAnyOtherError(t *testing.T) {
	t.Parallel()
	defer func() {
		if recover() == nil {
			t.Error("ReasonFor() did not panic")
		}
	}()

	workspace.ReasonFor(os.ErrClosed)
}
