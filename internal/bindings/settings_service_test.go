package bindings_test

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
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
	if got := f.state.GetState().Theme; got != "dark" {
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
	got := f.state.GetState().ModelDefaults
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
		{name: "no model", stage: "prd", model: "", effort: "high", want: "Choose a model."},
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

	if got := f.state.GetState().ReviewModeDefault; got != "agent" {
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
	f.register(t, t.TempDir())

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

func TestListPromptsSaysWhichPromptsAreEdited(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	listed, err := f.settings.ListPrompts()
	if err != nil {
		t.Fatalf("ListPrompts() = %v, want nil", err)
	}
	if len(listed) != len(prompts.Editable) {
		t.Fatalf("ListPrompts() has %d prompts, want %d", len(listed), len(prompts.Editable))
	}
	for i, l := range listed {
		if l.Modified || l.EditedAt != "" {
			t.Errorf("ListPrompts()[%d] = %+v, want an unedited prompt", i, l)
		}
	}

	if _, err = f.settings.SavePrompt("commit", "mine"); err != nil {
		t.Fatalf("SavePrompt() = %v, want nil", err)
	}
	listed, err = f.settings.ListPrompts()
	if err != nil {
		t.Fatalf("ListPrompts() = %v, want nil", err)
	}
	for i, l := range listed {
		stage := string(prompts.Editable[i])
		if l.Stage != stage {
			t.Errorf("ListPrompts()[%d].Stage = %q, want %q", i, l.Stage, stage)
		}
		edited := stage == "commit"
		if l.Modified != edited || (l.EditedAt != "") != edited {
			t.Errorf("ListPrompts()[%d] = %+v, want edited = %v", i, l, edited)
		}
	}
	if _, err = time.Parse(time.RFC3339, listed[5].EditedAt); err != nil {
		t.Errorf("EditedAt = %q, want RFC 3339", listed[5].EditedAt)
	}
}

func TestGetPromptCarriesTheLinesAndTheTimeOfTheEdit(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	got, err := f.settings.SavePrompt("commit", "one\ntwo\n")
	if err != nil {
		t.Fatalf("SavePrompt() = %v, want nil", err)
	}
	if got.Lines != 2 || got.DefaultLines < 1 || got.EditedAt == "" {
		t.Errorf("SavePrompt() = lines %d, default lines %d, edited %q", got.Lines, got.DefaultLines, got.EditedAt)
	}
}

func TestCheckMachineReturnsWhereTheCheckStands(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	want := bindings.Machine{
		Checked: true,
		Items:   []bindings.MachineItem{{ID: "claude_found", Result: "missing"}},
	}
	service := bindings.NewSettingsService(
		f.theme, f.models, f.reviewModes, func() bindings.Machine { return want }, f.dataDir, slog.New(slog.DiscardHandler),
	)

	got, err := service.CheckMachine()
	if err != nil {
		t.Fatalf("CheckMachine() = %v, want nil", err)
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("CheckMachine() mismatch (-want +got):\n%s", diff)
	}
}

// fullSettings is a models.Settings whose writes fail with err.
type fullSettings struct{ err error }

func (fullSettings) Get(context.Context, string) (string, bool, error) { return "", false, nil }

func (s fullSettings) Set(context.Context, string, string) error { return s.err }

func TestTheSettersOfADefaultSayWhenTheDiskIsFull(t *testing.T) {
	t.Parallel()
	full := fullSettings{err: fmt.Errorf("save: %w", syscall.ENOSPC)}
	home, err := os.UserHomeDir()
	if err != nil {
		t.Fatalf("os.UserHomeDir() = %v, want the home", err)
	}

	// dirs are the data directory of the service and how the sentence names it.
	tests := []struct {
		name string
		dirs func(f *fixture) (dataDir, shown string)
	}{
		{"outside the home", func(f *fixture) (string, string) { return f.dataDir, f.dataDir }},
		{"under the home", func(*fixture) (string, string) {
			return filepath.Join(home, ".local", "share", "myspec"), "~/.local/share/myspec"
		}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			f := newFixture(t)
			fullModels, err := models.New(t.Context(), full, slog.New(slog.DiscardHandler), func() {})
			if err != nil {
				t.Fatalf("models.New() = %v, want nil", err)
			}
			fullModes, err := reviewmode.New(t.Context(), full, slog.New(slog.DiscardHandler), func() {})
			if err != nil {
				t.Fatalf("reviewmode.New() = %v, want nil", err)
			}
			dataDir, shown := test.dirs(f)
			service := bindings.NewSettingsService(
				f.theme, fullModels, fullModes, nil, dataDir, slog.New(slog.NewJSONHandler(f.logs, nil)),
			)
			want := "no space left on the disk of " + shown + ". Free some space, then try again."

			for name, set := range map[string]func() error{
				"SetModelDefault":      func() error { return service.SetModelDefault("prd", "sonnet", "high") },
				"SetReviewModeDefault": func() error { return service.SetReviewModeDefault("agent") },
			} {
				if err := set(); err == nil || err.Error() != want {
					t.Errorf("%s() = %v, want %q", name, err, want)
				}
			}
			if !f.logged(t, "binding failed") {
				t.Error("the failure was not logged as binding failed")
			}
		})
	}
}
