package models

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"sync"

	"github.com/guilhermt/myspec/internal/claude"
)

// Settings persists the app settings as key-value pairs.
type Settings interface {
	Get(ctx context.Context, key string) (string, bool, error)
	Set(ctx context.Context, key, value string) error
}

// The settings keys: the defaults, as the JSON of a Set, and the last catalog
// read on this machine, as the JSON of a Catalog.
const (
	settingsKey = "models"
	catalogKey  = "model_catalog"
)

// Reader reads the catalog of the installed CLI. internal/app provides it
// over internal/claude.
type Reader func(ctx context.Context) ([]claude.ModelEntry, error)

// Service owns the defaults of the app: the choice a new task starts each
// stage with; and the catalog: what the installed Claude Code offers, as last
// read on this machine.
type Service struct {
	settings Settings
	log      *slog.Logger
	onChange func()

	mu       sync.Mutex
	defaults Set
	catalog  Catalog
	failure  CatalogFailure
	// discovered is whether the reading of the catalog of this run ended.
	discovered bool
}

// New reads the saved defaults and the saved catalog. Without a saved value
// the defaults are the factory ones; a value that is not the JSON of a set is
// logged and ignored, and a stage it lacks or holds an invalid choice for
// takes the factory one. The catalog is the last one read on this machine, and
// empty until a reading fills it.
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

	catalog, catalogErr := readCatalog(ctx, settings, log)
	if catalogErr != nil {
		return nil, catalogErr
	}

	return &Service{
		settings: settings,
		log:      log,
		onChange: onChange,
		defaults: Complete(saved),
		catalog:  catalog,
	}, nil
}

// readCatalog reads the saved catalog. Without a saved value, and for a value
// that is not the JSON of a catalog, the catalog is the empty one.
func readCatalog(ctx context.Context, settings Settings, log *slog.Logger) (Catalog, error) {
	empty := Catalog{Models: []CatalogModel{}}

	value, ok, err := settings.Get(ctx, catalogKey)
	if err != nil {
		return empty, fmt.Errorf("read model catalog: %w", err)
	}
	if !ok {
		return empty, nil
	}

	var saved Catalog
	if err := json.Unmarshal([]byte(value), &saved); err != nil {
		log.Warn("invalid model catalog", "value", value)
		saved = empty
	}
	if saved.Models == nil {
		saved.Models = []CatalogModel{}
	}
	return saved, nil
}

// Catalog is a copy of the catalog: what the pickers offer.
func (s *Service) Catalog() Catalog {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.catalog.clone()
}

// CatalogFailure is why the pickers have nothing to offer: the failure of the
// reading of this run, and only while no reading ever succeeded on this
// machine. It is "" when there is a catalog, whatever this run's reading did.
func (s *Service) CatalogFailure() CatalogFailure {
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(s.catalog.Models) > 0 {
		return ""
	}
	return s.failure
}

// ProcessEffort is Catalog.ProcessEffort on the current catalog.
func (s *Service) ProcessEffort(choice Choice) Effort {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.catalog.ProcessEffort(choice)
}

// Discover reads the catalog once, with read, and keeps the result: a catalog
// that replaces the one held and is persisted as the last successful reading
// of this machine, or a failure that leaves the catalog as it is. Either way
// the listener is notified. A reading that offers no model at all is a
// failure, so that the last good catalog stays.
func (s *Service) Discover(ctx context.Context, read Reader) {
	entries, err := read(ctx)
	if err != nil {
		s.failed(catalogFailureOf(err), err.Error())
		return
	}

	catalog := CatalogFrom(entries)
	if len(catalog.Models) == 0 {
		s.failed(CatalogFailed, "the CLI offered no model")
		return
	}

	// The catalog of this run stands even when it cannot be saved: the next
	// run then starts from the previous successful reading.
	encoded, err := json.Marshal(catalog)
	if err != nil {
		s.log.Error("save model catalog failed", "error", err)
	} else if err := s.settings.Set(ctx, catalogKey, string(encoded)); err != nil {
		s.log.Error("save model catalog failed", "error", err)
	}

	s.mu.Lock()
	s.catalog = catalog
	s.failure = ""
	s.discovered = true
	s.mu.Unlock()

	s.log.Info("model catalog read", "models", len(catalog.Models))
	if s.onChange != nil {
		s.onChange()
	}
}

// Discovery is how the reading of the catalog of this run went: done is false
// while it runs, and failure is "" when it succeeded.
func (s *Service) Discovery() (done bool, failure CatalogFailure) {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.discovered, s.failure
}

// catalogFailureOf tells apart the ways a reading fails, as the interface
// tells them apart.
func catalogFailureOf(err error) CatalogFailure {
	switch {
	case errors.Is(err, claude.ErrNotFound):
		return CatalogNotFound
	case errors.Is(err, claude.ErrCatalogUnsupported):
		return CatalogUnsupported
	default:
		return CatalogFailed
	}
}

// failed records why the reading of this run gave no catalog, leaving the one
// held as it is, and notifies the listener.
func (s *Service) failed(failure CatalogFailure, reason string) {
	s.log.Warn("model catalog reading failed", "failure", string(failure), "error", reason)

	s.mu.Lock()
	s.failure = failure
	s.discovered = true
	s.mu.Unlock()

	if s.onChange != nil {
		s.onChange()
	}
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
