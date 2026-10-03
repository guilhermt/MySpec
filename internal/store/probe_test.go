package store_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/guilhermt/myspec/internal/store"
)

func TestProbeAcceptsADirectoryItCanReadAndWrite(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "existing"), []byte("x"), 0o600); err != nil {
		t.Fatalf("WriteFile() = %v, want nil", err)
	}

	if err := store.Probe(dir); err != nil {
		t.Fatalf("Probe(%s) = %v, want nil", dir, err)
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("ReadDir() = %v, want nil", err)
	}
	if len(entries) != 1 {
		t.Errorf("entries after Probe = %d, want 1: the probe file must be removed", len(entries))
	}
}

func TestProbeAcceptsAnEmptyDirectory(t *testing.T) {
	t.Parallel()

	if err := store.Probe(t.TempDir()); err != nil {
		t.Fatalf("Probe(empty) = %v, want nil", err)
	}
}

func TestProbeFailsOnAMissingDirectory(t *testing.T) {
	t.Parallel()
	dir := filepath.Join(t.TempDir(), "missing")

	if err := store.Probe(dir); err == nil {
		t.Fatalf("Probe(%s) = nil, want an error", dir)
	}
}

func TestProbeFindsADirectoryWithoutPermission(t *testing.T) {
	t.Parallel()
	if os.Geteuid() == 0 {
		t.Skip("root reads every directory")
	}
	dir := t.TempDir()
	if err := os.Chmod(dir, 0); err != nil {
		t.Fatalf("Chmod() = %v, want nil", err)
	}
	t.Cleanup(func() { _ = os.Chmod(dir, 0o700) })

	err := store.Probe(dir)

	if !store.PermissionDenied(err) {
		t.Fatalf("PermissionDenied(Probe(%s)) = false for %v, want true", dir, err)
	}
}

func TestProbeFindsADirectoryItCanReadButNotWrite(t *testing.T) {
	t.Parallel()
	if os.Geteuid() == 0 {
		t.Skip("root writes in every directory")
	}
	dir := t.TempDir()
	if err := os.Chmod(dir, 0o500); err != nil {
		t.Fatalf("Chmod() = %v, want nil", err)
	}
	t.Cleanup(func() { _ = os.Chmod(dir, 0o700) })

	err := store.Probe(dir)

	if !store.PermissionDenied(err) {
		t.Fatalf("PermissionDenied(Probe(%s)) = false for %v, want true", dir, err)
	}
}
