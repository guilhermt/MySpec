package claude_test

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/guilhermt/myspec/internal/claude"
)

// writeExecutable creates an executable file named claude under dir.
func writeExecutable(t *testing.T, dir string) string {
	t.Helper()

	path := filepath.Join(dir, "claude")
	if err := os.WriteFile(path, []byte("#!/bin/sh\n"), 0o700); err != nil {
		t.Fatalf("WriteFile(%s) = %v, want nil", path, err)
	}
	return path
}

// isolate points HOME and PATH at empty directories, so nothing installed on
// the machine running the tests can be found.
func isolate(t *testing.T) (home, path string) {
	t.Helper()

	home, path = t.TempDir(), t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("PATH", path)
	t.Setenv(claude.EnvPath, "")
	return home, path
}

func TestLocateFailsWhenNoExecutableExists(t *testing.T) {
	isolate(t)

	got, err := claude.Locate()
	if !errors.Is(err, claude.ErrNotFound) {
		t.Errorf("Locate() error = %v, want ErrNotFound", err)
	}
	if got != "" {
		t.Errorf("Locate() = %q, want empty", got)
	}
}

func TestLocateFindsTheExecutableOnPath(t *testing.T) {
	_, path := isolate(t)
	want := writeExecutable(t, path)

	got, err := claude.Locate()
	if err != nil {
		t.Fatalf("Locate() = %v, want nil", err)
	}
	if got != want {
		t.Errorf("Locate() = %q, want %q", got, want)
	}
}

func TestLocateFallsBackToLocalBin(t *testing.T) {
	home, _ := isolate(t)
	localBin := filepath.Join(home, ".local", "bin")
	if err := os.MkdirAll(localBin, 0o700); err != nil {
		t.Fatalf("MkdirAll(%s) = %v, want nil", localBin, err)
	}
	want := writeExecutable(t, localBin)

	got, err := claude.Locate()
	if err != nil {
		t.Fatalf("Locate() = %v, want nil", err)
	}
	if got != want {
		t.Errorf("Locate() = %q, want %q", got, want)
	}
}

func TestLocateFailsWithoutAHomeDirectory(t *testing.T) {
	isolate(t)
	t.Setenv("HOME", "")

	if _, err := claude.Locate(); err == nil {
		t.Error("Locate() = nil, want an error")
	}
}

func TestLocatePrefersTheOverride(t *testing.T) {
	_, path := isolate(t)
	writeExecutable(t, path)
	want := writeExecutable(t, t.TempDir())
	t.Setenv(claude.EnvPath, want)

	got, err := claude.Locate()
	if err != nil {
		t.Fatalf("Locate() = %v, want nil", err)
	}
	if got != want {
		t.Errorf("Locate() = %q, want %q", got, want)
	}
}

func TestLocateRejectsAnOverrideThatIsNotExecutable(t *testing.T) {
	_, path := isolate(t)
	writeExecutable(t, path)
	override := filepath.Join(t.TempDir(), "claude")
	if err := os.WriteFile(override, nil, 0o600); err != nil {
		t.Fatalf("WriteFile(%s) = %v, want nil", override, err)
	}
	t.Setenv(claude.EnvPath, override)

	if _, err := claude.Locate(); !errors.Is(err, claude.ErrNotFound) {
		t.Errorf("Locate() error = %v, want ErrNotFound", err)
	}
}

func TestLocateIgnoresADirectoryNamedClaude(t *testing.T) {
	isolate(t)
	directory := filepath.Join(t.TempDir(), "claude")
	if err := os.Mkdir(directory, 0o700); err != nil {
		t.Fatalf("Mkdir(%s) = %v, want nil", directory, err)
	}
	t.Setenv(claude.EnvPath, directory)

	if _, err := claude.Locate(); !errors.Is(err, claude.ErrNotFound) {
		t.Errorf("Locate() error = %v, want ErrNotFound", err)
	}
}
