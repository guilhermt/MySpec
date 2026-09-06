// Package theme owns the light and dark theme preference and the mode it
// resolves to.
package theme

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
)

// Preference is what the user picked in the theme control.
type Preference string

// The theme preferences the user can pick.
const (
	System Preference = "system"
	Light  Preference = "light"
	Dark   Preference = "dark"
)

// Mode is the theme the interface actually renders.
type Mode string

// The modes the interface renders in.
const (
	ModeLight Mode = "light"
	ModeDark  Mode = "dark"
)

// Settings persists the app settings as key-value pairs.
type Settings interface {
	Get(ctx context.Context, key string) (string, bool, error)
	Set(ctx context.Context, key, value string) error
}

// settingsKey is where the preference is stored.
const settingsKey = "theme"

// Service owns the theme preference and what the system reports.
type Service struct {
	settings Settings
	log      *slog.Logger
	onChange func()

	mu         sync.Mutex
	pref       Preference
	systemDark bool
}

// New reads the saved preference, falling back to System when there is none or
// the stored value is not a preference.
func New(ctx context.Context, settings Settings, systemDark bool, log *slog.Logger, onChange func()) (*Service, error) {
	value, ok, err := settings.Get(ctx, settingsKey)
	if err != nil {
		return nil, fmt.Errorf("read theme preference: %w", err)
	}

	pref := System
	if ok {
		parsed, err := ParsePreference(value)
		if err != nil {
			log.Warn("invalid theme preference", "value", value)
		} else {
			pref = parsed
		}
	}

	return &Service{
		settings:   settings,
		log:        log,
		onChange:   onChange,
		pref:       pref,
		systemDark: systemDark,
	}, nil
}

// ParsePreference turns a stored value into a Preference.
func ParsePreference(s string) (Preference, error) {
	switch pref := Preference(s); pref {
	case System, Light, Dark:
		return pref, nil
	default:
		return "", fmt.Errorf("theme: unknown preference %q", s)
	}
}

// Preference returns what the user picked.
func (s *Service) Preference() Preference {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.pref
}

// SetPreference persists the preference and notifies the listener.
func (s *Service) SetPreference(ctx context.Context, p Preference) error {
	if err := s.settings.Set(ctx, settingsKey, string(p)); err != nil {
		return fmt.Errorf("save theme preference: %w", err)
	}

	s.mu.Lock()
	s.pref = p
	systemDark := s.systemDark
	s.mu.Unlock()

	s.log.Info("theme changed", "preference", string(p), "system_dark", systemDark)
	s.changed()
	return nil
}

// SystemDark reports whether the system asks for a dark interface.
func (s *Service) SystemDark() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.systemDark
}

// SetSystemDark records what the system reports, notifying only on a change.
func (s *Service) SetSystemDark(dark bool) {
	s.mu.Lock()
	if s.systemDark == dark {
		s.mu.Unlock()
		return
	}
	s.systemDark = dark
	pref := s.pref
	s.mu.Unlock()

	s.log.Info("theme changed", "preference", string(pref), "system_dark", dark)
	s.changed()
}

// Effective is the mode the interface renders in.
func (s *Service) Effective() Mode {
	s.mu.Lock()
	defer s.mu.Unlock()

	switch s.pref {
	case Light:
		return ModeLight
	case Dark:
		return ModeDark
	default:
		if s.systemDark {
			return ModeDark
		}
		return ModeLight
	}
}

// changed runs the onChange callback outside the mutex.
func (s *Service) changed() {
	if s.onChange != nil {
		s.onChange()
	}
}
