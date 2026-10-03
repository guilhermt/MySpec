package bindings_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/bindings"
)

func TestGetStartupHandsTheFrontendTheSnapshot(t *testing.T) {
	t.Parallel()
	want := bindings.Startup{
		Phase:      "starting",
		Steps:      []bindings.StartupStep{{ID: "data", State: "running", StartedAt: "2026-10-03T12:00:00.000Z"}},
		SystemDark: true,
	}
	service := bindings.NewStartupService(func() bindings.Startup { return want }, func() {})

	if diff := cmp.Diff(want, service.GetStartup()); diff != "" {
		t.Errorf("GetStartup() mismatch (-want +got):\n%s", diff)
	}
}

func TestTryAgainRunsTheStartupAgain(t *testing.T) {
	t.Parallel()
	runs := 0
	service := bindings.NewStartupService(func() bindings.Startup { return bindings.Startup{} }, func() { runs++ })

	service.TryAgain()

	if runs != 1 {
		t.Errorf("startups run = %d, want 1", runs)
	}
}
