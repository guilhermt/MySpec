package models_test

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"sync"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/models"
)

// memSettings is an in-memory models.Settings.
type memSettings struct {
	mu     sync.Mutex
	values map[string]string
	err    error // returned by Set when filled
}

func newSettings(values map[string]string) *memSettings {
	if values == nil {
		values = map[string]string{}
	}
	return &memSettings{values: values}
}

func (s *memSettings) Get(_ context.Context, key string) (string, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	value, ok := s.values[key]
	return value, ok, nil
}

func (s *memSettings) Set(_ context.Context, key, value string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.err != nil {
		return s.err
	}
	s.values[key] = value
	return nil
}

// newService builds a Service over settings, counting the notifications.
func newService(t *testing.T, settings *memSettings) (*models.Service, *int) {
	t.Helper()

	changes := 0
	service, err := models.New(t.Context(), settings, slog.New(slog.DiscardHandler), func() { changes++ })
	if err != nil {
		t.Fatalf("New() = %v, want nil", err)
	}
	return service, &changes
}

// savedDefaults is the settings value of a set, as the service stores it.
func savedDefaults(t *testing.T, set models.Set) map[string]string {
	t.Helper()

	encoded, err := json.Marshal(set)
	if err != nil {
		t.Fatalf("json.Marshal() = %v, want nil", err)
	}
	return map[string]string{"models": string(encoded)}
}

func TestNewWithoutASavedValueIsTheFactory(t *testing.T) {
	t.Parallel()

	service, _ := newService(t, newSettings(nil))
	if diff := cmp.Diff(models.Factory(), service.Defaults()); diff != "" {
		t.Errorf("Defaults() mismatch (-want +got):\n%s", diff)
	}
}

func TestNewReadsTheSavedDefaults(t *testing.T) {
	t.Parallel()

	want := models.Factory()
	want[models.Implementation] = models.Choice{Model: models.Opus5, Effort: models.XHigh}

	service, _ := newService(t, newSettings(savedDefaults(t, want)))
	if diff := cmp.Diff(want, service.Defaults()); diff != "" {
		t.Errorf("Defaults() mismatch (-want +got):\n%s", diff)
	}
}

func TestNewFallsBackOnAValueThatIsNotASet(t *testing.T) {
	t.Parallel()

	service, _ := newService(t, newSettings(map[string]string{"models": "nope"}))
	if diff := cmp.Diff(models.Factory(), service.Defaults()); diff != "" {
		t.Errorf("Defaults() mismatch (-want +got):\n%s", diff)
	}
}

func TestSetDefaultPersistsAndNotifies(t *testing.T) {
	t.Parallel()

	settings := newSettings(nil)
	service, changes := newService(t, settings)

	choice := models.Choice{Model: models.Sonnet5, Effort: models.Low}
	if err := service.SetDefault(t.Context(), models.PR, choice); err != nil {
		t.Fatalf("SetDefault() = %v, want nil", err)
	}

	want := models.Factory()
	want[models.PR] = choice
	if diff := cmp.Diff(want, service.Defaults()); diff != "" {
		t.Errorf("Defaults() mismatch (-want +got):\n%s", diff)
	}
	if *changes != 1 {
		t.Errorf("onChange ran %d times, want 1", *changes)
	}

	reopened, _ := newService(t, settings)
	if diff := cmp.Diff(want, reopened.Defaults()); diff != "" {
		t.Errorf("Defaults() after reading again mismatch (-want +got):\n%s", diff)
	}
}

func TestSetDefaultKeepsTheDefaultsWhenTheSaveFails(t *testing.T) {
	t.Parallel()

	settings := newSettings(nil)
	service, changes := newService(t, settings)
	settings.err = errors.New("database is locked")

	err := service.SetDefault(t.Context(), models.PR, models.Choice{Model: models.Sonnet5, Effort: models.Low})
	if err == nil {
		t.Fatal("SetDefault() = nil, want an error")
	}
	if diff := cmp.Diff(models.Factory(), service.Defaults()); diff != "" {
		t.Errorf("Defaults() mismatch (-want +got):\n%s", diff)
	}
	if *changes != 0 {
		t.Errorf("onChange ran %d times, want the failed save to notify nobody", *changes)
	}
}
