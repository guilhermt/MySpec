package divergence

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"slices"
	"sync"
	"time"
)

// Service keeps the divergence of each item, in the database and in a cache
// the readers use.
type Service struct {
	deps Deps

	mu    sync.Mutex
	cache map[string]Divergence
}

// New builds a service that knows no divergence until Load runs.
func New(deps Deps) *Service {
	if deps.Now == nil {
		deps.Now = time.Now
	}
	return &Service{deps: deps, cache: map[string]Divergence{}}
}

// Load reads every divergence into the cache. A row of a kind this version does
// not know, or whose facts can't be read, is dropped with a warning.
func (s *Service) Load(ctx context.Context) error {
	rows, err := s.deps.Store.Divergences(ctx)
	if err != nil {
		return fmt.Errorf("load divergences: %w", err)
	}

	cache := make(map[string]Divergence, len(rows))
	for _, row := range rows {
		d, ok := s.decode(row)
		if !ok {
			continue
		}
		cache[d.ItemID] = d
	}

	s.mu.Lock()
	s.cache = cache
	s.mu.Unlock()
	return nil
}

// decode reads a row; ok is false for a row it drops.
func (s *Service) decode(row Row) (Divergence, bool) {
	kind := Kind(row.Kind)
	if !kinds[kind] {
		s.deps.Log.Warn("divergence of an unknown kind dropped", "item", row.ItemID, "kind", row.Kind)
		return Divergence{}, false
	}
	var facts Facts
	if err := json.Unmarshal([]byte(row.Facts), &facts); err != nil {
		s.deps.Log.Warn("divergence with unreadable facts dropped", "item", row.ItemID, "kind", row.Kind, "error", err)
		return Divergence{}, false
	}
	return Divergence{ItemID: row.ItemID, Stage: row.Stage, Kind: kind, Facts: facts, StartedAt: row.StartedAt}, true
}

// Get returns a copy of the divergence of an item.
func (s *Service) Get(itemID string) (Divergence, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	d, ok := s.cache[itemID]
	if !ok {
		return Divergence{}, false
	}
	return clone(d), true
}

// Open records the divergence of an item, replacing the one it had, and says
// whether it is new: false when the item already had this very one. Changing
// the facts of a divergence of the same kind and stage keeps when it started, so
// that the situation it makes does not begin again.
func (s *Service) Open(ctx context.Context, d Divergence) (bool, error) {
	opened, err := s.open(ctx, d)
	if opened {
		s.changed(d.ItemID)
	}
	return opened, err
}

// open stores the divergence under the lock; OnChange is for the caller, once
// the lock is free.
func (s *Service) open(ctx context.Context, d Divergence) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	d.StartedAt = s.deps.Now()
	previous, had := s.cache[d.ItemID]
	if had {
		if previous.Kind == d.Kind && previous.Stage == d.Stage {
			if reflect.DeepEqual(previous.Facts, d.Facts) {
				return false, nil
			}
			d.StartedAt = previous.StartedAt
		}
	}

	facts, err := json.Marshal(d.Facts)
	if err != nil {
		return false, fmt.Errorf("open divergence of %s: %w", d.ItemID, err)
	}
	row := Row{ItemID: d.ItemID, Stage: d.Stage, Kind: string(d.Kind), Facts: string(facts), StartedAt: d.StartedAt}
	if err = s.deps.Store.PutDivergence(ctx, row); err != nil {
		return false, fmt.Errorf("open divergence of %s: %w", d.ItemID, err)
	}
	s.cache[d.ItemID] = clone(d)
	return true, nil
}

// Clear ends the divergence of an item. With kinds it ends it only when it is
// one of them. An item without the divergence is not an error.
func (s *Service) Clear(ctx context.Context, itemID string, kinds ...Kind) error {
	cleared, err := s.clear(ctx, itemID, kinds)
	if cleared {
		s.changed(itemID)
	}
	return err
}

// clear deletes the divergence under the lock; OnChange is for the caller, once
// the lock is free.
func (s *Service) clear(ctx context.Context, itemID string, kinds []Kind) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	d, ok := s.cache[itemID]
	if !ok || (len(kinds) > 0 && !slices.Contains(kinds, d.Kind)) {
		return false, nil
	}
	if err := s.deps.Store.DeleteDivergence(ctx, itemID); err != nil {
		return false, fmt.Errorf("clear divergence of %s: %w", itemID, err)
	}
	delete(s.cache, itemID)
	return true, nil
}

// Forget drops the cache entry of an item the database already lost by
// cascade.
func (s *Service) Forget(itemID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.cache, itemID)
}

// changed tells the owner of the service.
func (s *Service) changed(itemID string) {
	if s.deps.OnChange != nil {
		s.deps.OnChange(itemID)
	}
}

// clone copies the slices of a divergence, so that a reader never shares them
// with the cache.
func clone(d Divergence) Divergence {
	d.Facts.Candidates = slices.Clone(d.Facts.Candidates)
	d.Facts.PRs = slices.Clone(d.Facts.PRs)
	return d
}
