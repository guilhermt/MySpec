package bindings

import (
	"context"
	"log/slog"

	"github.com/guilhermt/myspec/internal/theme"
)

// SettingsService is the settings API the frontend calls.
type SettingsService struct {
	theme *theme.Service
	log   *slog.Logger
}

// NewSettingsService builds the service over the theme domain.
func NewSettingsService(t *theme.Service, log *slog.Logger) *SettingsService {
	return &SettingsService{theme: t, log: log}
}

// SetTheme stores the theme preference: system, light or dark.
func (s *SettingsService) SetTheme(preference string) error {
	pref, err := theme.ParsePreference(preference)
	if err != nil {
		s.log.Error("binding failed", "method", "SetTheme", "err", err)
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.theme.SetPreference(ctx, pref); err != nil {
		s.log.Error("binding failed", "method", "SetTheme", "err", err)
		return err
	}
	return nil
}
