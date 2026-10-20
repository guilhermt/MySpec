package reviewmode

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
)

// Settings persists the app settings as key-value pairs.
type Settings interface {
	Get(ctx context.Context, key string) (string, bool, error)
	Set(ctx context.Context, key, value string) error
}

// The keys where the defaults are stored, as the mode itself: the one of the
// steps of a task and the one of its pull request.
const (
	settingsKey   = "review_mode"
	prSettingsKey = "pr_review_mode"
)

// Service owns the modes a new task starts with, who reviews the steps and the
// pull request of a task.
type Service struct {
	settings Settings
	log      *slog.Logger
	onChange func()

	mu      sync.Mutex
	value   Mode
	prValue Mode
}

// New reads the saved defaults. Without a saved value a default is Manual; a
// value that is not a mode is logged and ignored.
func New(ctx context.Context, settings Settings, log *slog.Logger, onChange func()) (*Service, error) {
	mode, invalid, err := readDefault(ctx, settings, settingsKey)
	if err != nil {
		return nil, err
	}
	if invalid != "" {
		log.Warn("invalid review mode default", "value", invalid)
	}
	prMode, invalid, err := readDefault(ctx, settings, prSettingsKey)
	if err != nil {
		return nil, err
	}
	if invalid != "" {
		log.Warn("invalid pr review mode default", "value", invalid)
	}

	return &Service{
		settings: settings,
		log:      log,
		onChange: onChange,
		value:    mode,
		prValue:  prMode,
	}, nil
}

// readDefault reads the default saved under key: Manual when there is none, or
// when it is not a mode, in which case invalid is the value read.
func readDefault(ctx context.Context, settings Settings, key string) (mode Mode, invalid string, err error) {
	value, ok, err := settings.Get(ctx, key)
	switch {
	case err != nil:
		return "", "", fmt.Errorf("read %s: %w", key, err)
	case !ok:
		return Manual, "", nil
	}
	parsed, parseErr := ParseMode(value)
	if parseErr != nil {
		return Manual, value, nil //nolint:nilerr // an invalid default is ignored, not an error
	}
	return parsed, "", nil
}

// Default is the mode a new task starts with.
func (s *Service) Default() Mode {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.value
}

// SetDefault persists the default and notifies the listener. It changes the
// tasks created from now on, never one that exists.
func (s *Service) SetDefault(ctx context.Context, mode Mode) error {
	if err := s.settings.Set(ctx, settingsKey, string(mode)); err != nil {
		return fmt.Errorf("save review mode default: %w", err)
	}

	s.mu.Lock()
	s.value = mode
	s.mu.Unlock()

	s.log.Info("review mode default changed", "mode", string(mode))
	if s.onChange != nil {
		s.onChange()
	}
	return nil
}

// PRDefault is the mode the review of the pull request of a new task starts
// with.
func (s *Service) PRDefault() Mode {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.prValue
}

// SetPRDefault persists the default of the pull request and notifies the
// listener. It changes the tasks created from now on, never one that exists.
func (s *Service) SetPRDefault(ctx context.Context, mode Mode) error {
	if err := s.settings.Set(ctx, prSettingsKey, string(mode)); err != nil {
		return fmt.Errorf("save pr review mode default: %w", err)
	}

	s.mu.Lock()
	s.prValue = mode
	s.mu.Unlock()

	s.log.Info("pr review mode default changed", "mode", string(mode))
	if s.onChange != nil {
		s.onChange()
	}
	return nil
}
