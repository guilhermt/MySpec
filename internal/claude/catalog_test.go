package claude_test

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/claude"
	"github.com/guilhermt/myspec/internal/claude/claudetest"
)

// catalogTimeout is the budget the app gives the reading in production.
const catalogTimeout = 20 * time.Second

// silentTimeout is what a reading gets when the CLI is known to say nothing:
// long enough to let the process start, short enough to keep the test quick.
const silentTimeout = 500 * time.Millisecond

func TestListModelsReadsTheCatalogOfTheCLI(t *testing.T) {
	binary := fakeBinary(t)
	ctx, cancel := context.WithTimeout(t.Context(), catalogTimeout)
	defer cancel()

	entries, err := claude.ListModels(ctx, binary, t.TempDir())
	if err != nil {
		t.Fatalf("ListModels() = %v, want nil", err)
	}
	if diff := cmp.Diff(claudetest.Catalog, entries); diff != "" {
		t.Errorf("catalog mismatch (-want +got):\n%s", diff)
	}
}

func TestListModelsFailsOnACLIThatDoesNotKnowTheRequest(t *testing.T) {
	binary := fakeBinary(t)
	t.Setenv(claudetest.EnvCatalog, "unsupported")
	ctx, cancel := context.WithTimeout(t.Context(), catalogTimeout)
	defer cancel()

	_, err := claude.ListModels(ctx, binary, t.TempDir())
	if !errors.Is(err, claude.ErrCatalogUnsupported) {
		t.Errorf("ListModels() = %v, want ErrCatalogUnsupported", err)
	}
}

func TestListModelsGivesUpWhenTheCLIStaysSilent(t *testing.T) {
	binary := fakeBinary(t)
	t.Setenv(claudetest.EnvCatalog, "silent")
	ctx, cancel := context.WithTimeout(t.Context(), silentTimeout)
	defer cancel()

	_, err := claude.ListModels(ctx, binary, t.TempDir())
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Errorf("ListModels() = %v, want a deadline exceeded", err)
	}
}

func TestListModelsFailsWithoutTheBinary(t *testing.T) {
	ctx, cancel := context.WithTimeout(t.Context(), catalogTimeout)
	defer cancel()

	if _, err := claude.ListModels(ctx, filepath.Join(t.TempDir(), "nowhere"), t.TempDir()); err == nil {
		t.Errorf("ListModels() = nil, want an error")
	}
}
