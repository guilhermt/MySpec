package claude_test

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/claude"
	"github.com/guilhermt/myspec/internal/claude/claudetest"
)

// preflightTimeout is the budget the app gives the check in production.
const preflightTimeout = 10 * time.Second

// fakeBinary turns this test binary into the fake CLI for the child processes
// started from the test, and returns the path to run.
func fakeBinary(t *testing.T) string {
	t.Helper()

	t.Setenv(claudetest.EnvFlag, "1")
	return os.Args[0]
}

func TestPreflightPassesForALoggedInUser(t *testing.T) {
	binary := fakeBinary(t)
	ctx, cancel := context.WithTimeout(t.Context(), preflightTimeout)
	defer cancel()

	if err := claude.Preflight(ctx, binary); err != nil {
		t.Errorf("Preflight() = %v, want nil", err)
	}
}

func TestPreflightReportsALoggedOutUser(t *testing.T) {
	binary := fakeBinary(t)
	t.Setenv(claudetest.EnvAuth, "out")
	ctx, cancel := context.WithTimeout(t.Context(), preflightTimeout)
	defer cancel()

	err := claude.Preflight(ctx, binary)
	if !errors.Is(err, claude.ErrNotLoggedIn) {
		t.Errorf("Preflight() = %v, want ErrNotLoggedIn", err)
	}
}

func TestPreflightReportsAMissingBinary(t *testing.T) {
	ctx, cancel := context.WithTimeout(t.Context(), preflightTimeout)
	defer cancel()

	err := claude.Preflight(ctx, filepath.Join(t.TempDir(), "nowhere"))
	switch {
	case err == nil:
		t.Errorf("Preflight() = nil, want an error")
	case errors.Is(err, claude.ErrNotLoggedIn):
		t.Errorf("Preflight() = %v, want a failure other than ErrNotLoggedIn", err)
	}
}

func TestPreflightHonoursTheContext(t *testing.T) {
	binary := fakeBinary(t)
	ctx, cancel := context.WithCancel(t.Context())
	cancel()

	if err := claude.Preflight(ctx, binary); err == nil {
		t.Errorf("Preflight() = nil, want an error")
	}
}
