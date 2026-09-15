package bindings_test

import (
	"slices"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/reviewmode"
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

func TestSetModelDefaultChangesTheDefaultsOfTheState(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	if err := f.settings.SetModelDefault("pr", "claude-sonnet-5", "low"); err != nil {
		t.Fatalf("SetModelDefault() = %v, want nil", err)
	}

	want := bindings.StageModel{Stage: "pr", Model: "claude-sonnet-5", Effort: "low"}
	got := f.workspace.GetState().ModelDefaults
	if !slices.Contains(got, want) {
		t.Errorf("ModelDefaults = %+v, want it to hold %+v", got, want)
	}
}

func TestSetModelDefaultReportsWhatTheUserGotWrong(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	tests := []struct {
		name   string
		stage  string
		model  string
		effort string
		want   string
	}{
		// The commit has no choice of its own: it runs in the session that
		// sends it.
		{name: "stage with no choice", stage: "commit", model: "claude-opus-5", effort: "high", want: "Unknown stage."},
		{name: "unknown model", stage: "prd", model: "gpt", effort: "high", want: "Unknown model."},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			err := f.settings.SetModelDefault(tt.stage, tt.model, tt.effort)
			if err == nil {
				t.Fatalf("SetModelDefault(%q, %q) = nil, want an error", tt.stage, tt.model)
			}
			if err.Error() != tt.want {
				t.Errorf("SetModelDefault() error = %q, want %q", err, tt.want)
			}
			if f.logged(t, "binding failed") {
				t.Error("a mistake the user can correct was logged as a failure")
			}
		})
	}
}

func TestSetReviewModeDefaultChangesTheDefaultOfTheState(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	if err := f.settings.SetReviewModeDefault("agent"); err != nil {
		t.Fatalf("SetReviewModeDefault() = %v, want nil", err)
	}

	if got := f.workspace.GetState().ReviewModeDefault; got != "agent" {
		t.Errorf("State.ReviewModeDefault = %q, want %q", got, "agent")
	}
}

func TestSetReviewModeDefaultRejectsAnUnknownMode(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	err := f.settings.SetReviewModeDefault("auto")
	if err == nil || err.Error() != "Unknown review mode." {
		t.Fatalf("SetReviewModeDefault(auto) error = %v, want the unknown review mode notice", err)
	}

	if got := f.reviewModes.Default(); got != reviewmode.Manual {
		t.Errorf("Default() = %q, want %q", got, reviewmode.Manual)
	}
	if f.logged(t, "binding failed") {
		t.Error("a mistake the user can correct was logged as a failure")
	}
}

func TestGetPromptReadsTheDefault(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	got, err := f.settings.GetPrompt("prd")
	if err != nil {
		t.Fatalf("GetPrompt(prd) = %v, want nil", err)
	}
	if got.Stage != "prd" || got.Modified {
		t.Errorf("prompt = %+v, want the untouched default of the PRD", got)
	}
	if !strings.HasPrefix(got.Text, "# PRD Creator") {
		t.Errorf("text = %q, want the default of the PRD", got.Text)
	}
	if len(got.Placeholders) == 0 || got.Placeholders[0] != "{{task_name}}" {
		t.Errorf("placeholders = %v, want the ones of the default, in order", got.Placeholders)
	}
}

func TestSavePromptIsWhatTheNextSessionStartsWith(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.open(t, t.TempDir())

	saved, err := f.settings.SavePrompt("prd", "Say hello to {{task_name}}")
	if err != nil {
		t.Fatalf("SavePrompt(prd) = %v, want nil", err)
	}
	if !saved.Modified || saved.Text != "Say hello to {{task_name}}" {
		t.Errorf("prompt = %+v, want the edit of the user", saved)
	}

	id, err := f.tasks.CreateTask(newTask("login-screen"))
	if err != nil {
		t.Fatalf("CreateTask() = %v, want nil", err)
	}
	f.waitForStatus(t, id, "waiting")

	// The edit is what the session opened with, and the initial context is
	// appended because the edit dropped its placeholder.
	waitAssistantText(t, f, id, "prd", "Say hello to login-screen")
	waitAssistantText(t, f, id, "prd", "a login screen with email and password")
}

func TestRestorePromptGoesBackToTheDefault(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	if _, err := f.settings.SavePrompt("commit", "Commit it."); err != nil {
		t.Fatalf("SavePrompt(commit) = %v, want nil", err)
	}

	got, err := f.settings.RestorePrompt("commit")
	if err != nil {
		t.Fatalf("RestorePrompt(commit) = %v, want nil", err)
	}
	if got.Modified {
		t.Errorf("prompt = %+v, want it to follow the default again", got)
	}

	read, err := f.settings.GetPrompt("commit")
	if err != nil {
		t.Fatalf("GetPrompt(commit) = %v, want nil", err)
	}
	if diff := cmp.Diff(got, read); diff != "" {
		t.Errorf("restored prompt mismatch (-restored +read):\n%s", diff)
	}
}

func TestPromptOperationsRejectAnUnknownPrompt(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	// The prompt of a step is the step file the plan wrote: it is none of the
	// settings' to show or to edit.
	if _, err := f.settings.GetPrompt("step"); err == nil || err.Error() != "Unknown prompt." {
		t.Errorf("GetPrompt(step) error = %v, want the unknown prompt notice", err)
	}
	if _, err := f.settings.SavePrompt("step", "hello"); err == nil || err.Error() != "Unknown prompt." {
		t.Errorf("SavePrompt(step) error = %v, want the unknown prompt notice", err)
	}
	if _, err := f.settings.RestorePrompt("step"); err == nil || err.Error() != "Unknown prompt." {
		t.Errorf("RestorePrompt(step) error = %v, want the unknown prompt notice", err)
	}
	if f.logged(t, "binding failed") {
		t.Error("a mistake the user can correct was logged as a failure")
	}
}
