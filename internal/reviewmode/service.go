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

// settingsKey is where the default is stored, as the mode itself.
const settingsKey = "review_mode"

// Service owns the mode a new task starts with.
type Service struct {
	settings Settings
	log      *slog.Logger
	onChange func()

	mu    sync.Mutex
	value Mode
}

// New reads the saved default. Without a saved value the default is Manual; a
// value that is not a mode is logged and ignored.
func New(ctx context.Context, settings Settings, log *slog.Logger, onChange func()) (*Service, error) {
	value, ok, err := settings.Get(ctx, settingsKey)
	if err != nil {
		return nil, fmt.Errorf("read review mode default: %w", err)
	}

	mode := Manual
	if ok {
		parsed, parseErr := ParseMode(value)
		if parseErr != nil {
			log.Warn("invalid review mode default", "value", value)
		} else {
			mode = parsed
		}
	}

	return &Service{
		settings: settings,
		log:      log,
		onChange: onChange,
		value:    mode,
	}, nil
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
