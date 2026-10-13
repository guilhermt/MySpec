package claude_test

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/guilhermt/myspec/internal/claude"
)

// writeExecutable creates a claude.exe under dir.
func writeExecutable(t *testing.T, dir string) string {
	t.Helper()

	path := filepath.Join(dir, "claude.exe")
	if err := os.WriteFile(path, nil, 0o600); err != nil {
		t.Fatalf("WriteFile(%s) = %v, want nil", path, err)
	}
	return path
}

func TestLocateAcceptsAnOverrideWindowsRuns(t *testing.T) {
	isolate(t)
	override := filepath.Join(t.TempDir(), "claude.cmd")
	if err := os.WriteFile(override, nil, 0o600); err != nil {
		t.Fatalf("WriteFile(%s) = %v, want nil", override, err)
	}
	t.Setenv(claude.EnvPath, override)

	got, err := claude.Locate()
	if err != nil {
		t.Fatalf("Locate() = %v, want nil", err)
	}
	if got != override {
		t.Errorf("Locate() = %q, want %q", got, override)
	}
}

func TestLocateRejectsAnExtensionWindowsDoesNotRun(t *testing.T) {
	isolate(t)
	override := filepath.Join(t.TempDir(), "claude.txt")
	if err := os.WriteFile(override, nil, 0o600); err != nil {
		t.Fatalf("WriteFile(%s) = %v, want nil", override, err)
	}
	t.Setenv(claude.EnvPath, override)

	if _, err := claude.Locate(); !errors.Is(err, claude.ErrNotFound) {
		t.Errorf("Locate() error = %v, want ErrNotFound", err)
	}
}
