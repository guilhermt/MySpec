package pulls

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/guilhermt/myspec/internal/repository"
)

// readTimeout bounds a whole reading, however many repositories it walks.
const readTimeout = 60 * time.Second

// Settings persists the filters; store.SettingsRepo implements it.
type Settings interface {
	Get(ctx context.Context, key string) (string, bool, error)
	Set(ctx context.Context, key, value string) error
}

// Deps are what Service needs from the outside.
type Deps struct {
	GitHub       GitHub
	Repositories func() []repository.Repository
	Settings     Settings
	Log          *slog.Logger
	Now          func() time.Time // defaults to time.Now
	OnChange     func()           // after a reading ends or the filters change; may be nil
}

// Service reads the open pull requests of the registered repositories and
// holds the last reading, in memory, next to the filters of the view.
type Service struct {
	github       GitHub
	repositories func() []repository.Repository
	settings     Settings
	log          *slog.Logger
	now          func() time.Time
	onChange     func()

	// ctx is cancelled by Close, which ends the reading that runs then.
	ctx    context.Context
	cancel context.CancelFunc

	mu       sync.Mutex
	viewer   string // the account of gh; "" until the first reading read it
	readings map[string]RepositoryReading
	readAt   time.Time
	reading  bool // a reading runs now
	pending  bool // a refresh was asked while a reading ran
	filters  Filters
}

// New builds a Service from deps.
func New(deps Deps) *Service {
	log := deps.Log
	if log == nil {
		log = slog.New(slog.DiscardHandler)
	}
	now := deps.Now
	if now == nil {
		now = time.Now
	}
	ctx, cancel := context.WithCancel(context.Background())
	return &Service{
		github:       deps.GitHub,
		repositories: deps.Repositories,
		settings:     deps.Settings,
		log:          log,
		now:          now,
		onChange:     deps.OnChange,
		ctx:          ctx,
		cancel:       cancel,
		readings:     map[string]RepositoryReading{},
		filters:      Filters{}.normalized(),
	}
}

// Sync loads the filters the user last chose. Filters stored unreadable are
// the zero value. It does not call OnChange.
func (s *Service) Sync(ctx context.Context) error {
	raw, ok, err := s.settings.Get(ctx, filtersSetting)
	if err != nil {
		return fmt.Errorf("read setting %s: %w", filtersSetting, err)
	}
	var f Filters
	if ok && raw != "" {
		if err := json.Unmarshal([]byte(raw), &f); err != nil {
			s.log.Warn("review filters unreadable", "error", err)
			f = Filters{}
		}
	}

	s.mu.Lock()
	s.filters = f.normalized()
	s.mu.Unlock()
	return nil
}

// Refresh reads the pull requests of every registered repository again, in the
// background: Reading reports it while it runs. A refresh asked while one runs
// is coalesced into a single reading after it. It does nothing once the
// service is closed.
func (s *Service) Refresh() {
	if s.ctx.Err() != nil {
		return
	}

	s.mu.Lock()
	if s.reading {
		s.pending = true
		s.mu.Unlock()
		return
	}
	s.reading = true
	s.mu.Unlock()

	s.changed()
	go s.runReads()
}

// runReads reads until no refresh is waiting, and calls OnChange after each
// reading, with the state it left behind. A refresh waiting when the service
// is closed is dropped, since its reading would only fail.
func (s *Service) runReads() {
	for {
		s.runRead()

		s.mu.Lock()
		again := s.pending && s.ctx.Err() == nil
		s.pending, s.reading = false, again
		s.mu.Unlock()

		s.changed()
		if !again {
			return
		}
	}
}

// runRead reads every registered repository once and replaces the readings
// with what it found.
func (s *Service) runRead() {
	ctx, cancel := context.WithTimeout(s.ctx, readTimeout)
	defer cancel()

	started := s.now()
	repos := sortedRepositories(s.repositories())
	var found map[string]RepositoryReading
	cost := 0
	viewer, err := s.readViewer(ctx)
	if err != nil {
		var failure *Failure
		if !errors.As(err, &failure) {
			failure = FailureOf(err)
		}
		s.log.Warn("pull requests reading failed", "error", err)
		found = batchFailure(repos, failure)
	} else {
		found, cost = s.readAll(ctx, repos, viewer)
	}
	s.save(repos, found, started, cost)
}

// sortedRepositories orders the registered repositories by owner/name,
// ignoring case, so a batch always carries the same repositories.
func sortedRepositories(repos []repository.Repository) []repository.Repository {
	repos = slices.Clone(repos)
	slices.SortStableFunc(repos, func(a, b repository.Repository) int {
		return strings.Compare(strings.ToLower(a.FullName()), strings.ToLower(b.FullName()))
	})
	return repos
}

// save keeps what the reading found, in the order of the registered
// repositories. A repository whose reading failed keeps the list the reading
// before it found; one no longer registered is dropped.
func (s *Service) save(repos []repository.Repository, found map[string]RepositoryReading, started time.Time, cost int) {
	readAt := s.now()

	s.mu.Lock()
	defer s.mu.Unlock()

	readings := make(map[string]RepositoryReading, len(repos))
	total, failed := 0, 0
	for _, repo := range repos {
		reading, ok := found[repo.ID]
		if !ok {
			continue
		}
		if reading.Failure != nil {
			before := s.readings[repo.ID]
			reading.PullRequests = before.PullRequests
			failure := *reading.Failure
			failure.FailedAt = readAt
			if before.Failure != nil && !before.Failure.FailedAt.IsZero() {
				failure.FailedAt = before.Failure.FailedAt
			}
			reading.Failure = &failure
			failed++
		}
		if reading.PullRequests == nil {
			reading.PullRequests = []PullRequest{}
		}
		total += len(reading.PullRequests)
		readings[repo.ID] = reading
	}
	s.readings, s.readAt = readings, readAt
	s.log.Info("pull requests read", "repositories", len(readings), "failed", failed,
		"pull_requests", total, "duration_ms", readAt.Sub(started).Milliseconds(), "cost", cost)
}

// Reading reports whether a reading runs now.
func (s *Service) Reading() bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.reading
}

// ReadAt is when the last reading ended; the zero instant before the first one
// ends.
func (s *Service) ReadAt() time.Time {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.readAt
}

// Viewer is the account gh is authenticated as; "" until a reading read it.
func (s *Service) Viewer() string {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.viewer
}

// Readings is what the last reading found, in the order of the registered
// repositories. A repository never read is not there.
func (s *Service) Readings() []RepositoryReading {
	repos := s.repositories()

	s.mu.Lock()
	defer s.mu.Unlock()

	readings := make([]RepositoryReading, 0, len(repos))
	for _, repo := range repos {
		if reading, ok := s.readings[repo.ID]; ok {
			readings = append(readings, reading)
		}
	}
	return readings
}

// ReadDetails reads refs from GitHub now, open or not. A ref GitHub answered
// nothing for is left out of the map. It fails with a *Failure.
func (s *Service) ReadDetails(ctx context.Context, refs []Ref) (map[Ref]Detail, error) {
	if len(refs) == 0 {
		return map[Ref]Detail{}, nil
	}
	viewer, err := s.readViewer(ctx)
	if err != nil {
		return nil, err
	}
	return s.readDetails(ctx, refs, viewer)
}

// Filters is a copy of the filters of the view.
func (s *Service) Filters() Filters {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.filters.clone()
}

// SetFilters stores the filters of the view.
func (s *Service) SetFilters(ctx context.Context, f Filters) error {
	f = f.normalized()
	raw, err := json.Marshal(f)
	if err != nil {
		return fmt.Errorf("encode setting %s: %w", filtersSetting, err)
	}
	if err := s.settings.Set(ctx, filtersSetting, string(raw)); err != nil {
		return fmt.Errorf("write setting %s: %w", filtersSetting, err)
	}

	s.mu.Lock()
	s.filters = f
	s.mu.Unlock()

	s.changed()
	return nil
}

// Close ends the reading that runs now and refuses the next ones.
func (s *Service) Close() { s.cancel() }

// changed runs the OnChange callback outside the mutex.
func (s *Service) changed() {
	if s.onChange != nil {
		s.onChange()
	}
}
