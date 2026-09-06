package xdg_test

import (
	"os"
	"path/filepath"
	"testing"

	basedir "github.com/adrg/xdg"
	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/platform/xdg"
)

// setBases points the XDG base directories at root for the duration of the test.
func setBases(t *testing.T, root string) {
	t.Helper()
	t.Setenv("XDG_DATA_HOME", filepath.Join(root, "data"))
	t.Setenv("XDG_STATE_HOME", filepath.Join(root, "state"))
	basedir.Reload()
	t.Cleanup(basedir.Reload)
}

func TestResolve(t *testing.T) {
	root := t.TempDir()
	setBases(t, root)

	want := xdg.Dirs{
		Data:  filepath.Join(root, "data", "myspec"),
		State: filepath.Join(root, "state", "myspec"),
	}
	if diff := cmp.Diff(want, xdg.Resolve()); diff != "" {
		t.Errorf("Resolve() mismatch (-want +got):\n%s", diff)
	}
}

func TestPaths(t *testing.T) {
	dirs := xdg.Dirs{Data: "/data", State: "/state"}

	if got, want := dirs.DatabasePath(), "/data/myspec.db"; got != want {
		t.Errorf("DatabasePath() = %q, want %q", got, want)
	}
	if got, want := dirs.LogPath(), "/state/myspec.log"; got != want {
		t.Errorf("LogPath() = %q, want %q", got, want)
	}
}

func TestEnsureCreatesDirectories(t *testing.T) {
	root := t.TempDir()
	setBases(t, root)

	dirs := xdg.Resolve()
	if err := dirs.Ensure(); err != nil {
		t.Fatalf("Ensure() = %v, want nil", err)
	}

	for _, dir := range []string{dirs.Data, dirs.State} {
		info, err := os.Stat(dir)
		if err != nil {
			t.Fatalf("stat %s: %v", dir, err)
		}
		if !info.IsDir() {
			t.Errorf("%s is not a directory", dir)
		}
		if got := info.Mode().Perm(); got != 0o700 {
			t.Errorf("%s permissions = %v, want %v", dir, got, os.FileMode(0o700))
		}
	}
}

func TestEnsureIsIdempotent(t *testing.T) {
	dirs := xdg.Dirs{Data: filepath.Join(t.TempDir(), "data"), State: filepath.Join(t.TempDir(), "state")}

	for range 2 {
		if err := dirs.Ensure(); err != nil {
			t.Fatalf("Ensure() = %v, want nil", err)
		}
	}
}

func TestEnsureFailsWhenPathIsAFile(t *testing.T) {
	root := t.TempDir()
	blocked := filepath.Join(root, "data")
	if err := os.WriteFile(blocked, nil, 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}

	dirs := xdg.Dirs{Data: blocked, State: filepath.Join(root, "state")}
	if err := dirs.Ensure(); err == nil {
		t.Fatal("Ensure() = nil, want error")
	}
}
