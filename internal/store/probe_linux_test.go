package store_test

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
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
