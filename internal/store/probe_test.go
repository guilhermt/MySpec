package store_test

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"testing"

	"github.com/guilhermt/myspec/internal/store"
)

// limitedProbeVar names the directory a re-executed test binary probes with a
// file size limit of zero, under which every write fails: the stand-in for a
// full disk, which a test cannot make.
const limitedProbeVar = "MYSPEC_TEST_LIMITED_PROBE"

// The exit codes of the limited probe: it failed with the errno of the write,
// it passed, it failed otherwise, or it could not set the limit.
const (
	limitedProbeWriteFailed = 3
	limitedProbePassed      = 4
	limitedProbeOther       = 5
	limitedProbeNoLimit     = 6
)

func TestMain(m *testing.M) {
	if dir := os.Getenv(limitedProbeVar); dir != "" {
		os.Exit(limitedProbe(dir))
	}
	os.Exit(m.Run())
}

// limitedProbe runs the probe of dir with a file size limit of zero. Go ignores
// the SIGXFSZ the write raises, so the write fails with EFBIG.
func limitedProbe(dir string) int {
	if err := syscall.Setrlimit(syscall.RLIMIT_FSIZE, &syscall.Rlimit{}); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return limitedProbeNoLimit
	}
	err := store.Probe(dir)
	fmt.Fprintln(os.Stderr, err)
	switch {
	case err == nil:
		return limitedProbePassed
	case errors.Is(err, syscall.EFBIG):
		return limitedProbeWriteFailed
	default:
		return limitedProbeOther
	}
}

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

func TestProbeFailsWhenItsWriteFailsAndRemovesItsFile(t *testing.T) {
	t.Parallel()
	exe, err := os.Executable()
	if err != nil {
		t.Fatalf("os.Executable() = %v, want the test binary", err)
	}
	dir := t.TempDir()
	cmd := exec.CommandContext(t.Context(), exe, "-test.run=^$")
	cmd.Env = append(os.Environ(), limitedProbeVar+"="+dir)

	out, err := cmd.CombinedOutput()

	var exit *exec.ExitError
	if !errors.As(err, &exit) || exit.ExitCode() != limitedProbeWriteFailed {
		t.Fatalf("the limited probe = %v (%s), want the error of the write, with its errno", err, out)
	}
	if entries, err := os.ReadDir(dir); err != nil || len(entries) != 0 {
		t.Errorf("entries after the probe = %v, %v, want none: the probe file must be removed", entries, err)
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
