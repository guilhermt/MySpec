package app_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/guilhermt/myspec/internal/app"
)

func TestTryAgainOpensTheAppOnceThePermissionIsBack(t *testing.T) {
	t.Parallel()
	if os.Geteuid() == 0 {
		t.Skip("root reads and writes every directory")
	}
	dataDir := filepath.Join(t.TempDir(), "myspec")
	if err := os.Mkdir(dataDir, 0); err != nil {
		t.Fatalf("Mkdir() = %v, want nil", err)
	}
	t.Cleanup(func() { _ = os.Chmod(dataDir, 0o700) })
	a, published := newApp(t, app.AppOptions{DataDir: dataDir})

	a.Start()
	failed := waitFor(t, published, phaseIs("failed"))
	if failed.Failure.Case != "permission" || failed.Failure.DataDir != dataDir {
		t.Fatalf("Failure = %+v, want permission in %s", failed.Failure, dataDir)
	}
	if err := os.Chmod(dataDir, 0o700); err != nil {
		t.Fatalf("Chmod() = %v, want nil", err)
	}
	a.TryAgain()
	got := waitFor(t, published, phaseIs("ready"))

	if got.Failure != nil {
		t.Errorf("Failure = %+v after the second attempt, want nil", got.Failure)
	}
	if !a.IsReady() {
		t.Error("IsReady() = false after Try again, want true")
	}
}
