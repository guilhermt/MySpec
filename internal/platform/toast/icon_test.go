package toast_test

import (
	"bytes"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/platform/toast"
)

// icon stands for the PNG of the app: InstallIcon copies bytes, whatever they
// are.
var icon = []byte("\x89PNG the icon of the app")

func TestInstallIconCopiesTheIconAndRepairsIt(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	wantPath := filepath.Join(dataDir, "icons", "myspec.png")
	if got := toast.IconPath(dataDir); got != wantPath {
		t.Errorf("IconPath() = %q, want %q", got, wantPath)
	}

	path := installIcon(t, dataDir)
	if path != wantPath {
		t.Errorf("InstallIcon() = %q, want %q", path, wantPath)
	}
	wantContent(t, path, icon)
	wantPerm(t, path, 0o600)
	wantPerm(t, filepath.Dir(path), 0o700)

	if err := os.WriteFile(path, []byte("broken"), 0o600); err != nil {
		t.Fatalf("WriteFile() = %v, want nil", err)
	}
	installIcon(t, dataDir)
	wantContent(t, path, icon)

	past := time.Date(2020, 1, 2, 3, 4, 5, 0, time.UTC)
	if err := os.Chtimes(path, past, past); err != nil {
		t.Fatalf("Chtimes() = %v, want nil", err)
	}
	installIcon(t, dataDir)
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("Stat() = %v, want nil", err)
	}
	if !info.ModTime().Equal(past) {
		t.Errorf("modified at %v, want %v: a good copy was rewritten", info.ModTime(), past)
	}
}

func TestInstallIconFailsWhereTheDirectoryCannotBeMade(t *testing.T) {
	t.Parallel()

	dataDir := filepath.Join(t.TempDir(), "file")
	if err := os.WriteFile(dataDir, nil, 0o600); err != nil {
		t.Fatalf("WriteFile() = %v, want nil", err)
	}

	path, err := toast.InstallIcon(dataDir, icon)
	if err == nil || path != "" {
		t.Errorf("InstallIcon() = %q, %v, want \"\" and an error", path, err)
	}
}

// installIcon runs InstallIcon, failing the test when it fails.
func installIcon(t *testing.T, dataDir string) string {
	t.Helper()

	path, err := toast.InstallIcon(dataDir, icon)
	if err != nil {
		t.Fatalf("InstallIcon() = %v, want nil", err)
	}
	return path
}

// wantContent fails the test unless the file at path holds want.
func wantContent(t *testing.T, path string, want []byte) {
	t.Helper()

	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile(%s) = %v, want nil", path, err)
	}
	if !bytes.Equal(got, want) {
		t.Errorf("%s holds %q, want %q", path, got, want)
	}
}

// wantPerm fails the test unless path has the permissions want.
func wantPerm(t *testing.T, path string, want os.FileMode) {
	t.Helper()

	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("Stat(%s) = %v, want nil", path, err)
	}
	// Windows has no permission bits.
	if runtime.GOOS == "windows" {
		return
	}
	if got := info.Mode().Perm(); got != want {
		t.Errorf("%s has permissions %v, want %v", path, got, want)
	}
}
