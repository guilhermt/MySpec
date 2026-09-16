package repository

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// filterSetting is the settings key that remembers the repository filter.
const filterSetting = "repository_filter"

// Store persists the registered repositories.
type Store interface {
	List(ctx context.Context) ([]Repository, error)
	Insert(ctx context.Context, repo Repository) error
	UpdatePath(ctx context.Context, id, path string) error
	Delete(ctx context.Context, id string) error
}

// Settings persists the filter; store.SettingsRepo implements it.
type Settings interface {
	Get(ctx context.Context, key string) (string, bool, error)
	Set(ctx context.Context, key, value string) error
}

// Deps are what Service needs from the outside.
type Deps struct {
	Store         Store
	Settings      Settings
	Identify      func(ctx context.Context, path string) (Identity, error) // Identifier.Identify
	Counts        func(id string) (active, archived int)                   // the tasks of a repository; may be nil
	Log           *slog.Logger
	Now           func() time.Time // defaults to time.Now
	NewID         func() string    // defaults to uuid.NewString
	OnChange      func()           // after any change; may be nil
	OnPathChanged func(id string)  // after a path changed, before OnChange; may be nil
}

// Service owns the registered repositories and what the app last found about
// their clones.
type Service struct {
	store         Store
	settings      Settings
	identify      func(ctx context.Context, path string) (Identity, error)
	counts        func(id string) (active, archived int)
	log           *slog.Logger
	now           func() time.Time
	newID         func() string
	onChange      func()
	onPathChanged func(id string)

	mu      sync.Mutex
	items   []Repository    // by owner/name, ignoring case
	missing map[string]bool // by id: the clone was not there at the last check
	filter  string          // "" for every repository
}

// New builds a Service from deps.
func New(deps Deps) *Service {
	log := deps.Log
	if log == nil {
		log = slog.New(slog.DiscardHandler)
	}
	counts := deps.Counts
	if counts == nil {
		counts = func(string) (int, int) { return 0, 0 }
	}
	now := deps.Now
	if now == nil {
		now = time.Now
	}
	newID := deps.NewID
	if newID == nil {
		newID = uuid.NewString
	}
	return &Service{
		store:         deps.Store,
		settings:      deps.Settings,
		identify:      deps.Identify,
		counts:        counts,
		log:           log,
		now:           now,
		newID:         newID,
		onChange:      deps.OnChange,
		onPathChanged: deps.OnPathChanged,
		missing:       map[string]bool{},
	}
}

// Sync loads the registered repositories, checks every clone and reads the
// filter. A filter that names no registered repository counts as every
// repository, and is left as it is in the settings. It does not call OnChange.
func (s *Service) Sync(ctx context.Context) error {
	items, err := s.store.List(ctx)
	if err != nil {
		return fmt.Errorf("list repositories: %w", err)
	}
	filter, _, err := s.settings.Get(ctx, filterSetting)
	if err != nil {
		return fmt.Errorf("read setting %s: %w", filterSetting, err)
	}

	slices.SortStableFunc(items, compare)
	missing := map[string]bool{}
	known := false
	for _, repo := range items {
		if !IsClone(repo.Path) {
			missing[repo.ID] = true
			s.log.Warn("repository clone missing", "repository", repo.FullName(), "path", repo.Path)
		}
		known = known || repo.ID == filter
	}
	if !known {
		filter = ""
	}

	s.mu.Lock()
	s.items, s.missing, s.filter = items, missing, filter
	s.mu.Unlock()
	return nil
}

// List is a copy of the registered repositories, by owner/name.
func (s *Service) List() []Repository {
	s.mu.Lock()
	defer s.mu.Unlock()

	return slices.Clone(s.items)
}

// Get is the registered repository of id.
func (s *Service) Get(id string) (Repository, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	i := s.index(id)
	if i < 0 {
		return Repository{}, false
	}
	return s.items[i], true
}

// Missing reports whether the clone of id was not there at the last check.
func (s *Service) Missing(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.missing[id]
}

// Check looks at the clone of id now. It refuses as clone_missing when the
// clone is not there, and calls OnChange when that differs from the last check.
func (s *Service) Check(id string) (Repository, error) {
	repo, ok := s.Get(id)
	if !ok {
		return Repository{}, fmt.Errorf("check repository %s: %w", id, ErrNotFound)
	}

	gone := !IsClone(repo.Path)

	s.mu.Lock()
	if s.index(id) < 0 {
		s.mu.Unlock()
		return Repository{}, fmt.Errorf("check repository %s: %w", id, ErrNotFound)
	}
	changed := s.missing[id] != gone
	if gone {
		s.missing[id] = true
	} else {
		delete(s.missing, id)
	}
	s.mu.Unlock()

	if changed {
		if gone {
			s.log.Warn("repository clone missing", "repository", repo.FullName(), "path", repo.Path)
		} else {
			s.log.Info("repository clone found", "repository", repo.FullName(), "path", repo.Path)
		}
		s.changed()
	}
	if gone {
		return Repository{}, &Refusal{Reason: ReasonCloneMissing, Path: repo.Path}
	}
	return repo, nil
}

// Add registers the repository the clone at path belongs to. It refuses what
// Identify refuses, and a repository already registered.
func (s *Service) Add(ctx context.Context, path string) (Repository, error) {
	path = filepath.Clean(path)
	identity, err := s.identifyAt(ctx, path)
	if err != nil {
		return Repository{}, err
	}

	s.mu.Lock()
	for _, registered := range s.items {
		if registered.Identity().Same(identity) {
			s.mu.Unlock()
			return Repository{}, &Refusal{Reason: ReasonRegistered, Repository: registered.FullName(), Path: registered.Path}
		}
	}
	repo := Repository{
		ID:        s.newID(),
		Owner:     identity.Owner,
		Name:      identity.Name,
		Path:      path,
		CreatedAt: s.now().UTC(),
	}
	if err := s.store.Insert(ctx, repo); err != nil {
		s.mu.Unlock()
		return Repository{}, fmt.Errorf("insert repository %s: %w", repo.FullName(), err)
	}
	i, _ := slices.BinarySearchFunc(s.items, repo, compare)
	s.items = slices.Insert(s.items, i, repo)
	delete(s.missing, repo.ID)
	s.mu.Unlock()

	s.log.Info("repository registered", "repository", repo.FullName(), "path", path)
	s.changed()
	return repo, nil
}

// ChangePath ties the repository of id to the clone at path, which has to be a
// clone of that same repository.
func (s *Service) ChangePath(ctx context.Context, id, path string) (Repository, error) {
	repo, ok := s.Get(id)
	if !ok {
		return Repository{}, fmt.Errorf("change path of repository %s: %w", id, ErrNotFound)
	}

	path = filepath.Clean(path)
	identity, err := s.identifyAt(ctx, path)
	if err != nil {
		return Repository{}, err
	}
	if !repo.Identity().Same(identity) {
		return Repository{}, &Refusal{
			Reason:     ReasonOtherRepository,
			Path:       path,
			Other:      identity.FullName(),
			Repository: repo.FullName(),
		}
	}

	s.mu.Lock()
	i := s.index(id)
	if i < 0 {
		s.mu.Unlock()
		return Repository{}, fmt.Errorf("change path of repository %s: %w", id, ErrNotFound)
	}
	if err := s.store.UpdatePath(ctx, id, path); err != nil {
		s.mu.Unlock()
		return Repository{}, fmt.Errorf("update path of repository %s: %w", repo.FullName(), err)
	}
	s.items[i].Path = path
	repo = s.items[i]
	delete(s.missing, id)
	s.mu.Unlock()

	s.log.Info("repository path changed", "repository", repo.FullName(), "path", path)
	if s.onPathChanged != nil {
		s.onPathChanged(id)
	}
	s.changed()
	return repo, nil
}

// Remove forgets the repository of id. It refuses while the repository has
// tasks, and a filter on it goes back to every repository.
func (s *Service) Remove(ctx context.Context, id string) error {
	repo, ok := s.Get(id)
	if !ok {
		return fmt.Errorf("remove repository %s: %w", id, ErrNotFound)
	}
	if active, archived := s.counts(id); active > 0 || archived > 0 {
		return &Refusal{Reason: ReasonHasTasks, Repository: repo.FullName(), Active: active, Archived: archived}
	}

	s.mu.Lock()
	if err := s.store.Delete(ctx, repo.ID); err != nil {
		s.mu.Unlock()
		return fmt.Errorf("delete repository %s: %w", repo.FullName(), err)
	}
	// Past the delete the repository is gone, and nothing below can put it
	// back: the rest of the removal happens whatever it says.
	if i := s.index(repo.ID); i >= 0 {
		s.items = slices.Delete(s.items, i, i+1)
	}
	delete(s.missing, repo.ID)
	var filterErr error
	if s.filter == repo.ID {
		s.filter = ""
		filterErr = s.settings.Set(ctx, filterSetting, "")
	}
	s.mu.Unlock()

	if filterErr != nil {
		// A stored filter naming no repository is every repository, both here
		// and on the next Sync, so the removal stands.
		s.log.Warn("repository filter not cleared", "repository", repo.FullName(), "error", filterErr)
	}
	s.log.Info("repository removed", "repository", repo.FullName())
	s.changed()
	return nil
}

// Filter is the id of the repository the tasks are filtered by, "" for every
// repository.
func (s *Service) Filter() string {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.filter
}

// SetFilter filters the tasks by the repository of id, or shows every
// repository again with "".
func (s *Service) SetFilter(ctx context.Context, id string) error {
	s.mu.Lock()
	if id != "" && s.index(id) < 0 {
		s.mu.Unlock()
		return fmt.Errorf("filter by repository %s: %w", id, ErrNotFound)
	}
	if err := s.settings.Set(ctx, filterSetting, id); err != nil {
		s.mu.Unlock()
		return fmt.Errorf("write setting %s: %w", filterSetting, err)
	}
	s.filter = id
	s.mu.Unlock()

	s.changed()
	return nil
}

// identifyAt identifies the clone at path. A refusal comes back as it is, for
// the user to read; any other failure is wrapped.
func (s *Service) identifyAt(ctx context.Context, path string) (Identity, error) {
	identity, err := s.identify(ctx, path)
	if err == nil {
		return identity, nil
	}
	var refusal *Refusal
	if errors.As(err, &refusal) {
		return Identity{}, refusal
	}
	return Identity{}, fmt.Errorf("identify %s: %w", path, err)
}

// index is the position of id in the list, -1 when it is not there. The caller
// holds the mutex.
func (s *Service) index(id string) int {
	return slices.IndexFunc(s.items, func(repo Repository) bool { return repo.ID == id })
}

// changed runs the OnChange callback outside the mutex.
func (s *Service) changed() {
	if s.onChange != nil {
		s.onChange()
	}
}

// compare orders repositories by owner and name, ignoring case, then by id.
func compare(a, b Repository) int {
	return cmp.Or(
		strings.Compare(strings.ToLower(a.Owner), strings.ToLower(b.Owner)),
		strings.Compare(strings.ToLower(a.Name), strings.ToLower(b.Name)),
		strings.Compare(a.ID, b.ID),
	)
}
