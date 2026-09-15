package reviewmode_test

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"testing"

	"github.com/guilhermt/myspec/internal/reviewmode"
)

// memSettings is an in-memory reviewmode.Settings.
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
func newService(t *testing.T, settings *memSettings) (*reviewmode.Service, *int) {
	t.Helper()

	changes := 0
	service, err := reviewmode.New(t.Context(), settings, slog.New(slog.DiscardHandler), func() { changes++ })
	if err != nil {
		t.Fatalf("New() = %v, want nil", err)
	}
	return service, &changes
}

func TestNewWithoutASavedValueIsManual(t *testing.T) {
	t.Parallel()

	service, _ := newService(t, newSettings(nil))
	if got := service.Default(); got != reviewmode.Manual {
		t.Errorf("Default() = %q, want %q", got, reviewmode.Manual)
	}
}

func TestNewReadsTheSavedDefault(t *testing.T) {
	t.Parallel()

	service, _ := newService(t, newSettings(map[string]string{"review_mode": "agent"}))
	if got := service.Default(); got != reviewmode.Agent {
		t.Errorf("Default() = %q, want %q", got, reviewmode.Agent)
	}
}

func TestNewFallsBackOnAValueThatIsNotAMode(t *testing.T) {
	t.Parallel()

	service, _ := newService(t, newSettings(map[string]string{"review_mode": "nope"}))
	if got := service.Default(); got != reviewmode.Manual {
		t.Errorf("Default() = %q, want %q", got, reviewmode.Manual)
	}
}

func TestSetDefaultPersistsAndNotifies(t *testing.T) {
	t.Parallel()

	settings := newSettings(nil)
	service, changes := newService(t, settings)

	if err := service.SetDefault(t.Context(), reviewmode.Agent); err != nil {
		t.Fatalf("SetDefault() = %v, want nil", err)
	}

	if got := service.Default(); got != reviewmode.Agent {
		t.Errorf("Default() = %q, want %q", got, reviewmode.Agent)
	}
	if *changes != 1 {
		t.Errorf("onChange ran %d times, want 1", *changes)
	}

	reopened, _ := newService(t, settings)
	if got := reopened.Default(); got != reviewmode.Agent {
		t.Errorf("Default() after reading again = %q, want %q", got, reviewmode.Agent)
	}
}

func TestSetDefaultKeepsTheDefaultWhenTheSaveFails(t *testing.T) {
	t.Parallel()

	settings := newSettings(nil)
	service, changes := newService(t, settings)
	settings.err = errors.New("database is locked")

	if err := service.SetDefault(t.Context(), reviewmode.Agent); err == nil {
		t.Fatal("SetDefault() = nil, want an error")
	}
	if got := service.Default(); got != reviewmode.Manual {
		t.Errorf("Default() = %q, want %q", got, reviewmode.Manual)
	}
	if *changes != 0 {
		t.Errorf("onChange ran %d times, want the failed save to notify nobody", *changes)
	}
}
