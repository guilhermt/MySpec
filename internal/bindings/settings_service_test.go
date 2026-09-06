package bindings_test

import (
	"testing"

	"github.com/guilhermt/myspec/internal/theme"
)

func TestSetThemePersistsThePreference(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	if err := f.settings.SetTheme("dark"); err != nil {
		t.Fatalf("SetTheme() = %v, want nil", err)
	}

	if got := f.theme.Preference(); got != theme.Dark {
		t.Errorf("Preference() = %q, want %q", got, theme.Dark)
	}
	if got := f.workspace.GetState().Theme; got != "dark" {
		t.Errorf("State.Theme = %q, want %q", got, "dark")
	}
}

func TestSetThemeRejectsAnUnknownValue(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	if err := f.settings.SetTheme("sepia"); err == nil {
		t.Fatal("SetTheme(\"sepia\") = nil, want an error")
	}

	if got := f.theme.Preference(); got != theme.System {
		t.Errorf("Preference() = %q, want %q", got, theme.System)
	}
	if !f.logged(t, "binding failed") {
		t.Error("the failure was not logged as binding failed")
	}
}

func TestSetThemeReportsADatabaseFailure(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	if err := f.store.Close(); err != nil {
		t.Fatalf("Close() = %v, want nil", err)
	}

	if err := f.settings.SetTheme("light"); err == nil {
		t.Error("SetTheme() = nil, want an error from the closed database")
	}
	if !f.logged(t, "binding failed") {
		t.Error("the failure was not logged as binding failed")
	}
}
