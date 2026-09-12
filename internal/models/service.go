package models

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"maps"
	"sync"
)

// Settings persists the app settings as key-value pairs.
type Settings interface {
	Get(ctx context.Context, key string) (string, bool, error)
	Set(ctx context.Context, key, value string) error
}

// settingsKey is where the defaults are stored, as the JSON of a Set.
const settingsKey = "models"

// Service owns the defaults of the app: the choice a new task starts each
// stage with.
type Service struct {
	settings Settings
	log      *slog.Logger
	onChange func()

	mu       sync.Mutex
	defaults Set
}

// New reads the saved defaults. Without a saved value the defaults are the
// factory ones; a value that is not the JSON of a set is logged and ignored,
// and a stage it lacks or holds an invalid choice for takes the factory one.
func New(ctx context.Context, settings Settings, log *slog.Logger, onChange func()) (*Service, error) {
	value, ok, err := settings.Get(ctx, settingsKey)
	if err != nil {
		return nil, fmt.Errorf("read model defaults: %w", err)
	}

	var saved Set
	if ok {
		if err := json.Unmarshal([]byte(value), &saved); err != nil {
			log.Warn("invalid model defaults", "value", value)
			saved = nil
		}
	}

	return &Service{
		settings: settings,
		log:      log,
		onChange: onChange,
		defaults: Complete(saved),
	}, nil
}

// Defaults is a copy of the defaults, with a choice for every stage.
func (s *Service) Defaults() Set {
	s.mu.Lock()
	defer s.mu.Unlock()

	return maps.Clone(s.defaults)
}

// SetDefault persists the default of one stage and notifies the listener. It
// changes the tasks created from now on, never one that exists.
func (s *Service) SetDefault(ctx context.Context, stage Stage, c Choice) error {
	s.mu.Lock()
	defaults := maps.Clone(s.defaults)
	s.mu.Unlock()
	defaults[stage] = c

	encoded, err := json.Marshal(defaults)
	if err != nil {
		return fmt.Errorf("save model defaults: %w", err)
	}
	if err := s.settings.Set(ctx, settingsKey, string(encoded)); err != nil {
		return fmt.Errorf("save model defaults: %w", err)
	}

	s.mu.Lock()
	s.defaults = defaults
	s.mu.Unlock()

	s.log.Info("model default changed", "stage", string(stage), "model", string(c.Model), "effort", string(c.Effort))
	if s.onChange != nil {
		s.onChange()
	}
	return nil
}
