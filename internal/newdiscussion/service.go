package newdiscussion

import (
	"cmp"
	"context"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Service keeps the drafts, in the database and in a cache the readers use.
type Service struct {
	deps Deps

	mu    sync.Mutex
	cache map[string]Draft // by id
}

// New builds a service that knows no draft until Load runs.
func New(deps Deps) *Service {
	if deps.Now == nil {
		deps.Now = time.Now
	}
	if deps.NewID == nil {
		deps.NewID = uuid.NewString
	}
	if deps.Log == nil {
		deps.Log = slog.New(slog.DiscardHandler)
	}
	return &Service{deps: deps, cache: map[string]Draft{}}
}

// Load reads every draft into the cache.
func (s *Service) Load(ctx context.Context) error {
	rows, err := s.deps.Store.NewDiscussionDrafts(ctx)
	if err != nil {
		return fmt.Errorf("load new discussion drafts: %w", err)
	}

	cache := make(map[string]Draft, len(rows))
	for _, d := range rows {
		cache[d.ID] = d
	}

	s.mu.Lock()
	s.cache = cache
	s.mu.Unlock()
	return nil
}

// List returns the drafts, the most recently saved first. It is never nil.
func (s *Service) List() []Draft {
	s.mu.Lock()
	defer s.mu.Unlock()

	list := make([]Draft, 0, len(s.cache))
	for _, d := range s.cache {
		list = append(list, d)
	}
	slices.SortFunc(list, func(a, b Draft) int {
		return cmp.Or(b.SavedAt.Compare(a.SavedAt), strings.Compare(a.ID, b.ID))
	})
	return list
}

// Save stores what the user typed and returns the draft. An empty id creates a
// draft; a known one updates it, keeping when it was created; an unknown one is
// inserted with that id, so that the text is never lost. A draft with no title
// and no text, or for a board the app no longer has, is refused with a
// *Refusal.
func (s *Service) Save(ctx context.Context, p SaveParams) (Draft, error) {
	if strings.TrimSpace(p.Title) == "" && strings.TrimSpace(p.Text) == "" {
		return Draft{}, &Refusal{Reason: RefusalEmpty}
	}
	if !s.deps.HasBoard(p.BoardID) {
		return Draft{}, &Refusal{Reason: RefusalBoardGone}
	}

	d, err := s.save(ctx, p)
	if err != nil {
		return Draft{}, err
	}
	s.deps.Log.Info("new discussion draft saved", "draft", d.ID, "board", d.BoardID)
	s.changed()
	return d, nil
}

// save stores the draft under the lock; OnChange is for the caller, once the
// lock is free.
func (s *Service) save(ctx context.Context, p SaveParams) (Draft, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := s.deps.Now()
	d := Draft{ID: p.ID, BoardID: p.BoardID, Title: p.Title, Text: p.Text, CreatedAt: now, SavedAt: now}
	if d.ID == "" {
		d.ID = s.deps.NewID()
	}
	if known, ok := s.cache[d.ID]; ok {
		d.CreatedAt = known.CreatedAt
	}
	if err := s.deps.Store.PutNewDiscussionDraft(ctx, d); err != nil {
		return Draft{}, fmt.Errorf("save new discussion draft %s: %w", d.ID, err)
	}
	s.cache[d.ID] = d
	return d, nil
}

// Delete removes a draft. An unknown id is not an error.
func (s *Service) Delete(ctx context.Context, id string) error {
	deleted, err := s.delete(ctx, id)
	if deleted {
		s.deps.Log.Info("new discussion draft deleted", "draft", id)
		s.changed()
	}
	return err
}

// delete removes the draft under the lock; OnChange is for the caller, once
// the lock is free.
func (s *Service) delete(ctx context.Context, id string) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.deps.Store.DeleteNewDiscussionDraft(ctx, id); err != nil {
		return false, fmt.Errorf("delete new discussion draft %s: %w", id, err)
	}
	_, had := s.cache[id]
	delete(s.cache, id)
	return had, nil
}

// ForgetBoard drops the drafts of a board from the cache. The database lost
// them with the board by cascade, and the removal of the board publishes.
func (s *Service) ForgetBoard(boardID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for id, d := range s.cache {
		if d.BoardID == boardID {
			delete(s.cache, id)
		}
	}
}

// changed tells the owner of the service.
func (s *Service) changed() {
	if s.deps.OnChange != nil {
		s.deps.OnChange()
	}
}
