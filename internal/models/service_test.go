package models_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/claude"
	"github.com/guilhermt/myspec/internal/claude/claudetest"
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

	service, changes, _ := newLoggedService(t, settings)
	return service, changes
}

// newLoggedService builds a Service over settings, counting the notifications
// and capturing the log, for the tests that read a line of it.
func newLoggedService(t *testing.T, settings *memSettings) (*models.Service, *int, *bytes.Buffer) {
	t.Helper()

	logs := &bytes.Buffer{}
	changes := 0
	service, err := models.New(t.Context(), settings, slog.New(slog.NewJSONHandler(logs, nil)), func() { changes++ })
	if err != nil {
		t.Fatalf("New() = %v, want nil", err)
	}
	return service, &changes, logs
}

// savedCatalog is the settings value of a catalog, as the service stores it.
func savedCatalog(t *testing.T, catalog models.Catalog) string {
	t.Helper()

	encoded, err := json.Marshal(catalog)
	if err != nil {
		t.Fatalf("json.Marshal() = %v, want nil", err)
	}
	return string(encoded)
}

// reading is a Reader answering the same thing every time.
func reading(entries []claude.ModelEntry, err error) models.Reader {
	return func(context.Context) ([]claude.ModelEntry, error) { return entries, err }
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
	want[models.Implementation] = models.Choice{Model: models.Opus55, Effort: models.XHigh}

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

func TestNewWithoutASavedCatalogHoldsAnEmptyOne(t *testing.T) {
	t.Parallel()

	service, _ := newService(t, newSettings(nil))
	if got := service.Catalog().Models; got == nil || len(got) != 0 {
		t.Errorf("Catalog().Models = %#v, want an empty slice", got)
	}
	if got := service.CatalogFailure(); got != "" {
		t.Errorf("CatalogFailure() = %q, want the reading of this run to say nothing yet", got)
	}
}

func TestNewReadsTheSavedCatalog(t *testing.T) {
	t.Parallel()

	want := models.CatalogFrom(claudetest.Catalog)
	service, _ := newService(t, newSettings(map[string]string{"model_catalog": savedCatalog(t, want)}))
	if diff := cmp.Diff(want, service.Catalog()); diff != "" {
		t.Errorf("Catalog() mismatch (-want +got):\n%s", diff)
	}
}

func TestNewFallsBackOnACatalogThatIsNotOne(t *testing.T) {
	t.Parallel()

	service, _ := newService(t, newSettings(map[string]string{"model_catalog": "nope"}))
	if got := service.Catalog().Models; got == nil || len(got) != 0 {
		t.Errorf("Catalog().Models = %#v, want an empty slice", got)
	}
}

func TestDiscoverReplacesAndPersistsTheCatalog(t *testing.T) {
	t.Parallel()

	settings := newSettings(nil)
	service, changes := newService(t, settings)

	service.Discover(t.Context(), reading(claudetest.Catalog, nil))

	want := models.CatalogFrom(claudetest.Catalog)
	if diff := cmp.Diff(want, service.Catalog()); diff != "" {
		t.Errorf("Catalog() mismatch (-want +got):\n%s", diff)
	}
	saved, _, _ := settings.Get(t.Context(), "model_catalog")
	if diff := cmp.Diff(savedCatalog(t, want), saved); diff != "" {
		t.Errorf("saved catalog mismatch (-want +got):\n%s", diff)
	}
	if got := service.CatalogFailure(); got != "" {
		t.Errorf("CatalogFailure() = %q, want nothing after a reading that worked", got)
	}
	if *changes != 1 {
		t.Errorf("onChange ran %d times, want 1", *changes)
	}
}

func TestDiscoverKeepsTheCatalogWhenTheReadingFails(t *testing.T) {
	t.Parallel()

	want := models.CatalogFrom(claudetest.Catalog)
	saved := savedCatalog(t, want)
	settings := newSettings(map[string]string{"model_catalog": saved})
	service, changes := newService(t, settings)

	service.Discover(t.Context(), reading(nil, fmt.Errorf("x: %w", claude.ErrCatalogUnsupported)))

	if diff := cmp.Diff(want, service.Catalog()); diff != "" {
		t.Errorf("Catalog() mismatch (-want +got):\n%s", diff)
	}
	if got, _, _ := settings.Get(t.Context(), "model_catalog"); got != saved {
		t.Errorf("saved catalog = %q, want the failed reading to save nothing", got)
	}
	if got := service.CatalogFailure(); got != "" {
		t.Errorf("CatalogFailure() = %q, want nothing while there is a catalog", got)
	}
	if *changes != 1 {
		t.Errorf("onChange ran %d times, want 1", *changes)
	}
}

func TestDiscoverReportsWhyThereIsNoCatalog(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		read    models.Reader
		failure models.CatalogFailure
	}{
		{"without a CLI", reading(nil, fmt.Errorf("x: %w", claude.ErrNotFound)), models.CatalogNotFound},
		{"with a CLI that does not know the request", reading(nil, fmt.Errorf("x: %w", claude.ErrCatalogUnsupported)), models.CatalogUnsupported},
		{"with a reading that errored", reading(nil, errors.New("boom")), models.CatalogFailed},
		{"with a CLI that offered no model", reading([]claude.ModelEntry{{Value: "default", ResolvedModel: "claude-sonnet-5"}}, nil), models.CatalogFailed},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			service, changes := newService(t, newSettings(nil))
			service.Discover(t.Context(), tc.read)

			if got := service.CatalogFailure(); got != tc.failure {
				t.Errorf("CatalogFailure() = %q, want %q", got, tc.failure)
			}
			if got := service.Catalog().Models; len(got) != 0 {
				t.Errorf("Catalog().Models = %#v, want none", got)
			}
			if *changes != 1 {
				t.Errorf("onChange ran %d times, want 1", *changes)
			}
		})
	}
}

func TestDiscoverKeepsTheCatalogWhenTheSaveFails(t *testing.T) {
	t.Parallel()

	settings := newSettings(nil)
	service, _, logs := newLoggedService(t, settings)
	settings.err = errors.New("database is locked")

	service.Discover(t.Context(), reading(claudetest.Catalog, nil))

	if diff := cmp.Diff(models.CatalogFrom(claudetest.Catalog), service.Catalog()); diff != "" {
		t.Errorf("Catalog() mismatch (-want +got):\n%s", diff)
	}
	if !strings.Contains(logs.String(), "save model catalog failed") {
		t.Errorf("log = %q, want it to report the failed save", logs.String())
	}
}

func TestCatalogIsACopy(t *testing.T) {
	t.Parallel()

	service, _ := newService(t, newSettings(nil))
	service.Discover(t.Context(), reading(claudetest.Catalog, nil))

	got := service.Catalog()
	got.Models[0].Name = "gpt"
	got.Models[0].Efforts[0] = "ultra"

	if diff := cmp.Diff(models.CatalogFrom(claudetest.Catalog), service.Catalog()); diff != "" {
		t.Errorf("Catalog() mismatch (-want +got):\n%s", diff)
	}
}

func TestDiscoveryTellsHowTheReadingOfThisRunWent(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		read    models.Reader // nil: no reading ran
		done    bool
		failure models.CatalogFailure
	}{
		{"before the reading", nil, false, ""},
		{"after a success", reading(claudetest.Catalog, nil), true, ""},
		{"without a CLI", reading(nil, fmt.Errorf("x: %w", claude.ErrNotFound)), true, models.CatalogNotFound},
		{"with a CLI that does not know the request", reading(nil, fmt.Errorf("x: %w", claude.ErrCatalogUnsupported)), true, models.CatalogUnsupported},
		{"with a reading that errored", reading(nil, errors.New("boom")), true, models.CatalogFailed},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			service, _ := newService(t, newSettings(nil))
			if tc.read != nil {
				service.Discover(t.Context(), tc.read)
			}

			done, failure := service.Discovery()
			if done != tc.done || failure != tc.failure {
				t.Errorf("Discovery() = (%v, %q), want (%v, %q)", done, failure, tc.done, tc.failure)
			}
		})
	}
}
