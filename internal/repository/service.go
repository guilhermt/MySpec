package repository

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/guilhermt/myspec/internal/gh"
)

// filterSetting is the settings key that remembers the repository filter.
const filterSetting = "repository_filter"

// cloneFolderSetting is the settings key that remembers the folder new clones
// go into.
const cloneFolderSetting = "clone_folder"

// cloneTimeout bounds a clone, which downloads the whole history.
const cloneTimeout = 30 * time.Minute

// Store persists the registered repositories.
type Store interface {
	List(ctx context.Context) ([]Repository, error)
	Insert(ctx context.Context, repo Repository) error
	UpdatePath(ctx context.Context, id, path string) error
	UpdateBoard(ctx context.Context, id, boardID string) error
	UpdateReviewInstructions(ctx context.Context, id, text string) error
	Delete(ctx context.Context, id string) error
}

// Settings persists the filter and the clone folder; store.SettingsRepo implements it.
type Settings interface {
	Get(ctx context.Context, key string) (string, bool, error)
	Set(ctx context.Context, key, value string) error
}

// Deps are what Service needs from the outside.
type Deps struct {
	Store         Store
	Settings      Settings
	Identify      func(ctx context.Context, path string) (Identity, error) // Identifier.Identify
	Clone         func(ctx context.Context, fullName, dir string) error    // gh.Runner.Clone
	Counts        func(id string) (active, archived int)                   // the tasks of a repository; may be nil
	Reviews       func(id string) (active, archived int)                   // the reviews of pull requests of a repository; may be nil
	Log           *slog.Logger
	Now           func() time.Time // defaults to time.Now
	NewID         func() string    // defaults to uuid.NewString
	OnChange      func()           // after any change; may be nil
	OnPathChanged func(id string)  // after a path changed, before OnChange; may be nil
	ScanRoot      string           // the folder the scan starts at, the home folder when empty
}

// Service owns the registered repositories and what the app last found about
// their clones.
type Service struct {
	store         Store
	settings      Settings
	identify      func(ctx context.Context, path string) (Identity, error)
	clone         func(ctx context.Context, fullName, dir string) error
	counts        func(id string) (active, archived int)
	reviews       func(id string) (active, archived int)
	log           *slog.Logger
	now           func() time.Time
	newID         func() string
	onChange      func()
	onPathChanged func(id string)
	scanRoot      string

	mu          sync.Mutex
	items       []Repository      // by owner/name, ignoring case
	missing     map[string]bool   // by id: the clone was not there at the last check
	filter      string            // "" for every repository
	cloning     map[string]bool   // by id: a clone runs now
	cloneErrors map[string]string // by id: what gh said when the last clone failed
	cloneFolder string            // "" until chosen
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
	reviews := deps.Reviews
	if reviews == nil {
		reviews = func(string) (int, int) { return 0, 0 }
	}
	now := deps.Now
	if now == nil {
		now = time.Now
	}
	newID := deps.NewID
	if newID == nil {
		newID = uuid.NewString
	}
	scanRoot := deps.ScanRoot
	if scanRoot == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			home = os.Getenv("HOME")
		}
		scanRoot = home
	}
	return &Service{
		store:         deps.Store,
		settings:      deps.Settings,
		identify:      deps.Identify,
		clone:         deps.Clone,
		counts:        counts,
		reviews:       reviews,
		log:           log,
		now:           now,
		newID:         newID,
		onChange:      deps.OnChange,
		onPathChanged: deps.OnPathChanged,
		scanRoot:      scanRoot,
		missing:       map[string]bool{},
		cloning:       map[string]bool{},
		cloneErrors:   map[string]string{},
	}
}

// Sync loads the registered repositories and checks every clone. It does not
// call OnChange.
func (s *Service) Sync(ctx context.Context) error {
	if err := s.Load(ctx); err != nil {
		return err
	}
	return s.CheckClones(ctx, nil)
}

// Load reads the registered repositories, the filter and the clone folder,
// without testing the clones. A filter that names no registered repository
// counts as every repository, and is left as it is in the settings. It does not
// call OnChange.
func (s *Service) Load(ctx context.Context) error {
	items, err := s.store.List(ctx)
	if err != nil {
		return fmt.Errorf("list repositories: %w", err)
	}
	filter, _, err := s.settings.Get(ctx, filterSetting)
	if err != nil {
		return fmt.Errorf("read setting %s: %w", filterSetting, err)
	}
	cloneFolder, _, err := s.settings.Get(ctx, cloneFolderSetting)
	if err != nil {
		return fmt.Errorf("read setting %s: %w", cloneFolderSetting, err)
	}

	slices.SortStableFunc(items, compare)
	known := false
	for _, repo := range items {
		known = known || repo.ID == filter
	}
	if !known {
		filter = ""
	}

	s.mu.Lock()
	s.items, s.filter, s.cloneFolder = items, filter, cloneFolder
	s.mu.Unlock()
	return nil
}

// WithPath is how many of the loaded repositories are tied to a clone.
func (s *Service) WithPath() int {
	s.mu.Lock()
	defer s.mu.Unlock()

	n := 0
	for _, repo := range s.items {
		if repo.Cloned() {
			n++
		}
	}
	return n
}

// CheckClones tests the clone of every loaded repository that has a path, in
// order, and keeps which ones are gone. checking is called with the path before
// each test and returns what to call when the test ends; nil is accepted. It
// stops between two paths when ctx is done. It does not call OnChange.
func (s *Service) CheckClones(ctx context.Context, checking func(path string) func()) error {
	items := s.List()

	missing := map[string]bool{}
	for _, repo := range items {
		if !repo.Cloned() {
			continue
		}
		if err := ctx.Err(); err != nil {
			return fmt.Errorf("check clones: %w", err)
		}
		done := func() {}
		if checking != nil {
			done = checking(repo.Path)
		}
		isClone := IsClone(repo.Path)
		done()
		if !isClone {
			missing[repo.ID] = true
			s.log.Warn("repository clone missing", "repository", repo.FullName(), "path", repo.Path)
		}
	}

	s.mu.Lock()
	s.missing = missing
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

// Check looks at the clone of id now. It refuses as not_cloned when the
// repository has no clone and as clone_missing when the clone is not there, and
// calls OnChange when that differs from the last check.
func (s *Service) Check(id string) (Repository, error) {
	repo, ok := s.Get(id)
	if !ok {
		return Repository{}, fmt.Errorf("check repository %s: %w", id, ErrNotFound)
	}
	if !repo.Cloned() {
		return Repository{}, &Refusal{Reason: ReasonNotCloned, Repository: repo.FullName()}
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

// Add registers the repository the clone at path belongs to. A repository
// registered without a clone is tied to path instead. It refuses what Identify
// refuses, and a repository already registered with a clone.
func (s *Service) Add(ctx context.Context, path string) (Repository, error) {
	path = filepath.Clean(path)
	identity, err := s.identifyAt(ctx, path)
	if err != nil {
		return Repository{}, err
	}

	s.mu.Lock()
	for _, registered := range s.items {
		if !registered.Identity().Same(identity) {
			continue
		}
		s.mu.Unlock()
		if registered.Cloned() {
			return Repository{}, &Refusal{Reason: ReasonRegistered, Repository: registered.FullName(), Path: registered.Path}
		}
		repo, err := s.link(ctx, registered.ID, path)
		if err != nil {
			return Repository{}, err
		}
		s.log.Info("repository clone linked", "repository", repo.FullName(), "path", path)
		s.changed()
		return repo, nil
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

	repo, err = s.link(ctx, id, path)
	if err != nil {
		return Repository{}, err
	}
	s.log.Info("repository path changed", "repository", repo.FullName(), "path", path)
	s.changed()
	return repo, nil
}

// link ties the repository of id to the clone at path, which the caller made
// sure is a clone of that repository, and calls OnPathChanged. It does not
// call OnChange.
func (s *Service) link(ctx context.Context, id, path string) (Repository, error) {
	s.mu.Lock()
	i := s.index(id)
	if i < 0 {
		s.mu.Unlock()
		return Repository{}, fmt.Errorf("link repository %s: %w", id, ErrNotFound)
	}
	if err := s.store.UpdatePath(ctx, id, path); err != nil {
		s.mu.Unlock()
		return Repository{}, fmt.Errorf("update path of repository %s: %w", s.items[i].FullName(), err)
	}
	s.items[i].Path = path
	repo := s.items[i]
	delete(s.missing, id)
	s.mu.Unlock()

	if s.onPathChanged != nil {
		s.onPathChanged(id)
	}
	return repo, nil
}

// Cloning reports whether a clone of id runs now, and what the last one that
// failed said.
func (s *Service) Cloning(id string) (running bool, failure string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.cloning[id], s.cloneErrors[id]
}

// CloneFolder is the folder new clones go into; "" until the user chose one.
func (s *Service) CloneFolder() string {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.cloneFolder
}

// SetCloneFolder remembers the folder new clones go into.
func (s *Service) SetCloneFolder(ctx context.Context, path string) error {
	if path != "" {
		path = filepath.Clean(path)
	}

	s.mu.Lock()
	if err := s.settings.Set(ctx, cloneFolderSetting, path); err != nil {
		s.mu.Unlock()
		return fmt.Errorf("write setting %s: %w", cloneFolderSetting, err)
	}
	s.cloneFolder = path
	s.mu.Unlock()

	s.changed()
	return nil
}

// Clone clones the repository of id into <clone folder>/<name>, in the
// background: Cloning reports it while it runs and what it said when it
// failed. A folder there that is already a clone of the repository is linked
// without cloning; one with anything else is refused as path_taken. It does
// nothing while a clone of id runs.
func (s *Service) Clone(ctx context.Context, id string) error {
	s.mu.Lock()
	i := s.index(id)
	if i < 0 {
		s.mu.Unlock()
		return fmt.Errorf("clone repository %s: %w", id, ErrNotFound)
	}
	repo, running, folder := s.items[i], s.cloning[id], s.cloneFolder
	s.mu.Unlock()

	switch {
	case repo.Cloned():
		return fmt.Errorf("clone repository %s: %w", repo.FullName(), ErrCloned)
	case running:
		return nil
	case folder == "":
		return fmt.Errorf("clone repository %s: %w", repo.FullName(), ErrNoCloneFolder)
	}

	dir := filepath.Join(folder, repo.Name)
	if _, err := os.Lstat(dir); err == nil {
		identity, identifyErr := s.identify(ctx, dir)
		if identifyErr != nil || !repo.Identity().Same(identity) {
			return &Refusal{Reason: ReasonPathTaken, Path: dir, Repository: repo.FullName()}
		}
		linked, linkErr := s.link(ctx, id, dir)
		if linkErr != nil {
			return linkErr
		}
		s.log.Info("repository clone linked", "repository", linked.FullName(), "path", dir)
		s.changed()
		return nil
	} else if !errors.Is(err, fs.ErrNotExist) {
		return fmt.Errorf("clone repository %s: %w", repo.FullName(), err)
	}

	s.mu.Lock()
	if s.cloning[id] {
		s.mu.Unlock()
		return nil
	}
	s.cloning[id] = true
	delete(s.cloneErrors, id)
	s.mu.Unlock()

	s.changed()
	s.log.Info("repository clone started", "repository", repo.FullName(), "path", dir)
	//nolint:gosec // G118: the clone outlives the call that started it, bounded by cloneTimeout
	go s.runClone(id, repo.FullName(), dir)
	return nil
}

// runClone clones fullName into dir, which did not exist, and links the
// repository of id to it. A failed clone leaves no dir behind and keeps what
// gh said for Cloning. A repository removed while its clone ran keeps nothing
// of it.
func (s *Service) runClone(id, fullName, dir string) {
	ctx, cancel := context.WithTimeout(context.Background(), cloneTimeout)
	defer cancel()

	failure := ""
	if err := s.clone(ctx, fullName, dir); err != nil {
		failure = err.Error()
		var ghErr *gh.Error
		if errors.As(err, &ghErr) && ghErr.Output != "" {
			failure = ghErr.Output
		}
		if removeErr := os.RemoveAll(dir); removeErr != nil {
			err = errors.Join(err, removeErr)
		}
		s.log.Warn("repository clone failed", "repository", fullName, "path", dir, "error", err)
	} else if _, err := s.link(ctx, id, dir); err != nil {
		failure = err.Error()
		s.log.Warn("repository clone failed", "repository", fullName, "path", dir, "error", err)
	} else {
		s.log.Info("repository cloned", "repository", fullName, "path", dir)
	}

	s.mu.Lock()
	delete(s.cloning, id)
	if failure != "" && s.index(id) >= 0 {
		s.cloneErrors[id] = failure
	}
	s.mu.Unlock()

	s.changed()
}

// Remove forgets the repository of id. It refuses while the repository has
// tasks or reviews of pull requests, and a filter on it goes back to every
// repository.
func (s *Service) Remove(ctx context.Context, id string) error {
	repo, ok := s.Get(id)
	if !ok {
		return fmt.Errorf("remove repository %s: %w", id, ErrNotFound)
	}
	if active, archived := s.counts(id); active > 0 || archived > 0 {
		return &Refusal{Reason: ReasonHasTasks, Repository: repo.FullName(), Active: active, Archived: archived}
	}
	if active, archived := s.reviews(id); active > 0 || archived > 0 {
		return &Refusal{
			Reason:          ReasonHasReviews,
			Repository:      repo.FullName(),
			ActiveReviews:   active,
			ArchivedReviews: archived,
		}
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
	// A clone of the repository may still be running: what it records when it
	// ends belongs to a repository that is gone.
	delete(s.cloning, repo.ID)
	delete(s.cloneErrors, repo.ID)
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

// SetReviewInstructions rewrites what the user wants said in every review of a
// pull request of the repository of id.
func (s *Service) SetReviewInstructions(ctx context.Context, id, text string) (Repository, error) {
	text = strings.TrimSpace(text)

	s.mu.Lock()
	i := s.index(id)
	if i < 0 {
		s.mu.Unlock()
		return Repository{}, fmt.Errorf("set review instructions of repository %s: %w", id, ErrNotFound)
	}
	if err := s.store.UpdateReviewInstructions(ctx, id, text); err != nil {
		s.mu.Unlock()
		return Repository{}, fmt.Errorf("update review instructions of repository %s: %w", s.items[i].FullName(), err)
	}
	s.items[i].ReviewInstructions = text
	repo := s.items[i]
	s.mu.Unlock()

	s.changed()
	return repo, nil
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
