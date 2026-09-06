package theme_test

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"sync"
	"testing"

	"github.com/guilhermt/myspec/internal/theme"
)

// settingsMem is an in-memory theme.Settings.
type settingsMem struct {
	mu     sync.Mutex
	values map[string]string
	getErr error
	setErr error
}

func newSettings(values map[string]string) *settingsMem {
	if values == nil {
		values = map[string]string{}
	}
	return &settingsMem{values: values}
}

func (s *settingsMem) Get(_ context.Context, key string) (string, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.getErr != nil {
		return "", false, s.getErr
	}
	value, ok := s.values[key]
	return value, ok, nil
}

func (s *settingsMem) Set(_ context.Context, key, value string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.setErr != nil {
		return s.setErr
	}
	s.values[key] = value
	return nil
}

// fixture is a Service with its collaborators, ready to assert on.
type fixture struct {
	service  *theme.Service
	settings *settingsMem
	logs     *bytes.Buffer
	changes  *int
}

func newFixture(t *testing.T, settings *settingsMem, systemDark bool) fixture {
	t.Helper()

	logs := &bytes.Buffer{}
	changes := 0

	service, err := theme.New(
		t.Context(),
		settings,
		systemDark,
		slog.New(slog.NewJSONHandler(logs, nil)),
		func() { changes++ },
	)
	if err != nil {
		t.Fatalf("New() = %v, want nil", err)
	}
	return fixture{service: service, settings: settings, logs: logs, changes: &changes}
}

func TestNewDefaultsToSystem(t *testing.T) {
	t.Parallel()
	f := newFixture(t, newSettings(nil), false)

	if got := f.service.Preference(); got != theme.System {
		t.Errorf("Preference() = %q, want %q", got, theme.System)
	}
}

func TestNewReadsTheSavedPreference(t *testing.T) {
	t.Parallel()
	f := newFixture(t, newSettings(map[string]string{"theme": "dark"}), false)

	if got := f.service.Preference(); got != theme.Dark {
		t.Errorf("Preference() = %q, want %q", got, theme.Dark)
	}
}

func TestNewFallsBackToSystemOnAnInvalidSavedValue(t *testing.T) {
	t.Parallel()
	f := newFixture(t, newSettings(map[string]string{"theme": "sepia"}), false)

	if got := f.service.Preference(); got != theme.System {
		t.Errorf("Preference() = %q, want %q", got, theme.System)
	}
	if !bytes.Contains(f.logs.Bytes(), []byte("invalid theme preference")) {
		t.Errorf("logs = %q, want an invalid preference warning", f.logs.String())
	}
}

func TestNewFailsWhenTheSettingsCannotBeRead(t *testing.T) {
	t.Parallel()
	wantErr := errors.New("database is closed")
	settings := newSettings(nil)
	settings.getErr = wantErr

	_, err := theme.New(t.Context(), settings, false, slog.New(slog.DiscardHandler), nil)

	if !errors.Is(err, wantErr) {
		t.Fatalf("New() = %v, want %v", err, wantErr)
	}
}

func TestParsePreference(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		value   string
		want    theme.Preference
		wantErr bool
	}{
		{name: "system", value: "system", want: theme.System},
		{name: "light", value: "light", want: theme.Light},
		{name: "dark", value: "dark", want: theme.Dark},
		{name: "unknown", value: "sepia", wantErr: true},
		{name: "empty", value: "", wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := theme.ParsePreference(tt.value)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("ParsePreference(%q) = %q, want an error", tt.value, got)
				}
				return
			}
			if err != nil {
				t.Fatalf("ParsePreference(%q) = %v, want nil", tt.value, err)
			}
			if got != tt.want {
				t.Errorf("ParsePreference(%q) = %q, want %q", tt.value, got, tt.want)
			}
		})
	}
}

func TestSetPreferencePersistsAndNotifies(t *testing.T) {
	t.Parallel()
	f := newFixture(t, newSettings(nil), false)

	if err := f.service.SetPreference(t.Context(), theme.Dark); err != nil {
		t.Fatalf("SetPreference() = %v, want nil", err)
	}

	if got := f.service.Preference(); got != theme.Dark {
		t.Errorf("Preference() = %q, want %q", got, theme.Dark)
	}
	if got := f.settings.values["theme"]; got != "dark" {
		t.Errorf("stored preference = %q, want %q", got, "dark")
	}
	if *f.changes != 1 {
		t.Errorf("onChange calls = %d, want 1", *f.changes)
	}
}

func TestSetPreferenceFailsWhenTheSettingsCannotBeWritten(t *testing.T) {
	t.Parallel()
	wantErr := errors.New("database is closed")
	settings := newSettings(nil)
	f := newFixture(t, settings, false)
	settings.setErr = wantErr

	err := f.service.SetPreference(t.Context(), theme.Dark)

	if !errors.Is(err, wantErr) {
		t.Fatalf("SetPreference() = %v, want %v", err, wantErr)
	}
	if got := f.service.Preference(); got != theme.System {
		t.Errorf("Preference() = %q, want %q", got, theme.System)
	}
	if *f.changes != 0 {
		t.Errorf("onChange calls = %d, want 0", *f.changes)
	}
}

func TestSetSystemDarkNotifiesOnlyOnAChange(t *testing.T) {
	t.Parallel()
	f := newFixture(t, newSettings(nil), false)

	f.service.SetSystemDark(false)
	if *f.changes != 0 {
		t.Fatalf("onChange calls = %d, want 0", *f.changes)
	}

	f.service.SetSystemDark(true)
	if !f.service.SystemDark() {
		t.Error("SystemDark() = false, want true")
	}
	if *f.changes != 1 {
		t.Errorf("onChange calls = %d, want 1", *f.changes)
	}
}

func TestEffective(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		pref       theme.Preference
		systemDark bool
		want       theme.Mode
	}{
		{name: "system light", pref: theme.System, systemDark: false, want: theme.ModeLight},
		{name: "system dark", pref: theme.System, systemDark: true, want: theme.ModeDark},
		{name: "light over a light system", pref: theme.Light, systemDark: false, want: theme.ModeLight},
		{name: "light over a dark system", pref: theme.Light, systemDark: true, want: theme.ModeLight},
		{name: "dark over a light system", pref: theme.Dark, systemDark: false, want: theme.ModeDark},
		{name: "dark over a dark system", pref: theme.Dark, systemDark: true, want: theme.ModeDark},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			f := newFixture(t, newSettings(map[string]string{"theme": string(tt.pref)}), tt.systemDark)

			if got := f.service.Effective(); got != tt.want {
				t.Errorf("Effective() = %q, want %q", got, tt.want)
			}
		})
	}
}
