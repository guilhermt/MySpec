package xdg_test

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"

	basedir "github.com/adrg/xdg"

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

func TestPaths(t *testing.T) {
	dirs := xdg.Dirs{Data: filepath.FromSlash("/data"), State: filepath.FromSlash("/state")}

	if got, want := dirs.DatabasePath(), filepath.Join(dirs.Data, "myspec.db"); got != want {
		t.Errorf("DatabasePath() = %q, want %q", got, want)
	}
	if got, want := dirs.LogPath(), filepath.Join(dirs.State, "myspec.log"); got != want {
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
		// Windows has no permission bits.
		if runtime.GOOS != "windows" {
			if got := info.Mode().Perm(); got != 0o700 {
				t.Errorf("%s permissions = %v, want %v", dir, got, os.FileMode(0o700))
			}
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
