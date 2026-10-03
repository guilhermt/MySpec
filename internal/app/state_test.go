package app_test

import (
	"path/filepath"
	"slices"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/app"
	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/claude"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/platform/xdg"
)

// The app reads the environment of the process, so this test changes it and
// cannot run in parallel: no claude, no gh and no desktop bus, so that nothing
// it starts in the background reaches outside the test.
func TestTheStateCarriesTheFactoryDefaultsBesideTheDefaultsOfTheUser(t *testing.T) {
	root := t.TempDir()
	t.Setenv("PATH", t.TempDir())
	t.Setenv(claude.EnvPath, filepath.Join(root, "no-claude"))
	t.Setenv("DBUS_SESSION_BUS_ADDRESS", "unix:path="+filepath.Join(root, "no-bus"))
	services := app.StartedForTest(t, xdg.Dirs{Data: filepath.Join(root, "data"), State: filepath.Join(root, "state")})

	if err := services.Settings.SetModelDefault(string(models.PRD), string(models.Opus55), string(models.Medium)); err != nil {
		t.Fatalf("SetModelDefault() = %v, want nil", err)
	}
	state := services.State.GetState()

	if diff := cmp.Diff(bindings.FromModelSet(models.Factory()), state.ModelFactory); diff != "" {
		t.Errorf("ModelFactory (-want +got):\n%s", diff)
	}
	prd := bindings.StageModel{Stage: string(models.PRD), Model: string(models.Opus55), Effort: string(models.Medium)}
	if !slices.Contains(state.ModelDefaults, prd) {
		t.Errorf("ModelDefaults = %+v, want the default of the PRD the user set", state.ModelDefaults)
	}
}
