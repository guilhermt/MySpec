package deploys

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/repository"
)

const (
	// readTimeout bounds a whole reading, however many repositories it walks.
	readTimeout = 60 * time.Second
	// filterSetting is the key of the setting that holds the filter of the view.
	filterSetting = "deploy_filter"
)

// Store persists the configuration; store.DeploysRepo implements it.
type Store interface {
	ListDeployConfigs(ctx context.Context) ([]BoardConfig, error)
	SaveDeployConfig(ctx context.Context, c BoardConfig) error
}

// Settings persists the filter of the view; store.SettingsRepo implements it.
type Settings interface {
	Get(ctx context.Context, key string) (string, bool, error)
	Set(ctx context.Context, key, value string) error
}

// Deps are what Service needs from the outside.
type Deps struct {
	GitHub       GitHub
	Store        Store
	Settings     Settings
	Repositories func() []repository.Repository // the registered ones, with their board
	Boards       func() []board.Board           // the registered boards
	Log          *slog.Logger
	Now          func() time.Time // defaults to time.Now
	OnChange     func()           // may be nil
	OnFinished   func(Finished)   // a run started by a merge of the app ended; may be nil
}

// Filter is the board the Deploys view shows; BoardID "" is every board.
type Filter struct {
	BoardID string `json:"boardId"`
	Title   string `json:"title"` // the title when chosen, for the chip of a board that left
}

// FilterGone is why the board of the filter is not shown.
type FilterGone string

// The reasons the board of the filter is not shown.
const (
	FilterShown     FilterGone = ""
	FilterNoDeploys FilterGone = "no_deploys" // the board exists without deploys on, or without a managed repository
	FilterRemoved   FilterGone = "removed"    // the board is no longer registered
)

// Overview is the Deploys view, derived.
type Overview struct {
	Boards     []BoardOverview // the boards with deploys on and a managed repository, by title ignoring case, then id; never nil
	ReadAt     time.Time       // the end of the last whole reading; zero before one
	Reading    bool
	Failure    *Failure // the last whole reading failed for every repository
	Filter     Filter
	FilterGone FilterGone
	Waiting    int  // environments pending or with a pull request ready, over every board, whatever the filter
	Failed     bool // some environment, the first included, has its last deploy failed
}

// BoardOverview is one board of the view.
type BoardOverview struct {
	ID           string
	Title        string
	Shown        bool                 // the filter keeps it
	Repositories []RepositoryOverview // by name, then owner, ignoring case; never nil
}

// RepositoryOverview is one row of the matrix.
type RepositoryOverview struct {
	RepositoryID string
	Owner        string
	Name         string
	Reading      bool      // a reading of this repository alone runs
	ReadAt       time.Time // when the environments shown were read; zero before
	Failure      *Failure
	Environments []EnvironmentOverview // configuration order; never nil
}

// EnvironmentOverview is one cell of the matrix, with the passage before it.
type EnvironmentOverview struct {
	Position     int
	Environment  Environment
	PreviousName string              // "" for the first
	Reading      *EnvironmentReading // nil when unread
	View         View
	Action       *Action // a copy; nil for none
}

// Service reads the deploys of the repositories the boards manage, holds the
// last reading in memory, runs the actions of the user and watches the runs
// those start.
type Service struct {
	github       GitHub
	store        Store
	settings     Settings
	repositories func() []repository.Repository
	boards       func() []board.Board
	log          *slog.Logger
	now          func() time.Time
	onChange     func()
	onFinished   func(Finished)

	// ctx is cancelled by Close, which ends the readings, the actions and the
	// watching of runs.
	ctx    context.Context
	cancel context.CancelFunc
	start  sync.Once

	mu           sync.Mutex
	configs      map[string]BoardConfig // by board
	readings     map[string]RepositoryReading
	readAt       time.Time
	failure      *Failure
	reading      bool            // the worker runs
	readingAll   bool            // the worker reads every repository now
	queuedAll    bool            // a reading of every repository waits
	queued       map[string]bool // repositories whose reading waits
	readingRepos map[string]bool // repositories asked to be read alone and not read yet
	actions      map[actionKey]*Action
	filter       Filter
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
		store:        deps.Store,
		settings:     deps.Settings,
		repositories: deps.Repositories,
		boards:       deps.Boards,
		log:          log,
		now:          now,
		onChange:     deps.OnChange,
		onFinished:   deps.OnFinished,
		ctx:          ctx,
		cancel:       cancel,
		configs:      map[string]BoardConfig{},
		readings:     map[string]RepositoryReading{},
		queued:       map[string]bool{},
		readingRepos: map[string]bool{},
		actions:      map[actionKey]*Action{},
	}
}

// Sync loads the configuration and the filter of the view. A filter stored
// unreadable is the zero value. It does not call OnChange.
func (s *Service) Sync(ctx context.Context) error {
	configs, err := s.store.ListDeployConfigs(ctx)
	if err != nil {
		return fmt.Errorf("list deploy configurations: %w", err)
	}
	raw, ok, err := s.settings.Get(ctx, filterSetting)
	if err != nil {
		return fmt.Errorf("read setting %s: %w", filterSetting, err)
	}
	var filter Filter
	if ok && raw != "" {
		if err := json.Unmarshal([]byte(raw), &filter); err != nil {
			s.log.Warn("deploy filter unreadable", "error", err)
			filter = Filter{}
		}
	}

	byBoard := make(map[string]BoardConfig, len(configs))
	for _, c := range configs {
		byBoard[c.BoardID] = cloneConfig(c)
	}
	s.mu.Lock()
	s.configs, s.filter = byBoard, filter
	s.mu.Unlock()
	return nil
}

// Reload is Sync followed by OnChange: the board service calls it after a
// write that changes the repositories of a board.
func (s *Service) Reload(ctx context.Context) error {
	if err := s.Sync(ctx); err != nil {
		return err
	}
	s.changed()
	return nil
}

// cloneConfig is a copy of c that shares nothing with it; its repositories are
// never nil.
func cloneConfig(c BoardConfig) BoardConfig {
	c.Repositories = slices.Clone(c.Repositories)
	if c.Repositories == nil {
		c.Repositories = []RepositoryConfig{}
	}
	for i := range c.Repositories {
		c.Repositories[i].Environments = slices.Clone(c.Repositories[i].Environments)
	}
	return c
}

// managed is a repository whose deploys the app manages: its board has them on
// and it has a configuration there.
type managed struct {
	repo  repository.Repository
	board string
	envs  []Environment
}

// managedLocked lists the managed repositories among repos, by id. Callers
// hold the mutex.
func (s *Service) managedLocked(repos []repository.Repository) []managed {
	var found []managed
	for _, repo := range repos {
		cfg, ok := s.configs[repo.BoardID]
		if !ok || !cfg.Enabled {
			continue
		}
		for _, rc := range cfg.Repositories {
			if rc.RepositoryID == repo.ID {
				found = append(found, managed{repo: repo, board: cfg.BoardID, envs: rc.Environments})
				break
			}
		}
	}
	slices.SortFunc(found, func(a, b managed) int { return cmp.Compare(a.repo.ID, b.repo.ID) })
	return found
}

// targetOf is what a reading asks of a managed repository.
func targetOf(m managed) target {
	return target{ID: m.repo.ID, Owner: m.repo.Owner, Name: m.repo.Name, Environments: slices.Clone(m.envs)}
}

// Refresh asks for a reading of every managed repository, in the background:
// Reading reports it while it runs. A request that arrives while a reading
// runs is coalesced into one reading after it. Without a managed repository
// it does nothing, and gh isn't called.
func (s *Service) Refresh() {
	repos := s.repositories()

	s.mu.Lock()
	if s.ctx.Err() != nil || len(s.managedLocked(repos)) == 0 {
		s.mu.Unlock()
		return
	}
	s.queuedAll = true
	start := s.takeWorkerLocked()
	if start {
		s.readingAll = true
	}
	s.mu.Unlock()

	if start {
		s.changed()
		go s.runReads()
	}
}

// RefreshRepository asks for a reading of one repository: the Try again of a
// row. It does nothing for a repository that is not managed.
func (s *Service) RefreshRepository(repositoryID string) {
	repos := s.repositories()

	s.mu.Lock()
	if s.ctx.Err() != nil || !slices.ContainsFunc(s.managedLocked(repos), func(m managed) bool { return m.repo.ID == repositoryID }) {
		s.mu.Unlock()
		return
	}
	s.queued[repositoryID] = true
	s.readingRepos[repositoryID] = true
	start := s.takeWorkerLocked()
	s.mu.Unlock()

	s.changed()
	if start {
		go s.runReads()
	}
}

// takeWorkerLocked claims the worker when none runs, and reports whether the
// caller must start it. Callers hold the mutex.
func (s *Service) takeWorkerLocked() bool {
	if s.reading {
		return false
	}
	s.reading = true
	return true
}

// runReads is the worker: it reads what waits, one reading at a time, until
// nothing waits. What is asked while a reading runs becomes the next one. What
// waits when the service is closed is dropped, since its reading would only
// fail.
func (s *Service) runReads() {
	for {
		s.mu.Lock()
		all := s.queuedAll
		ids := slices.Sorted(maps.Keys(s.queued))
		s.queuedAll = false
		s.queued = map[string]bool{}
		if s.ctx.Err() != nil || (!all && len(ids) == 0) {
			s.reading, s.readingAll = false, false
			clear(s.readingRepos)
			s.mu.Unlock()
			s.changed()
			return
		}
		s.readingAll = all
		s.mu.Unlock()

		s.runRead(all, ids)

		s.mu.Lock()
		for _, id := range ids {
			delete(s.readingRepos, id)
		}
		s.mu.Unlock()
		s.changed()
	}
}

// runRead reads every managed repository when all is true, and the managed
// ones among ids otherwise.
func (s *Service) runRead(all bool, ids []string) {
	repos := s.repositories()

	s.mu.Lock()
	var targets []target
	for _, m := range s.managedLocked(repos) {
		if all || slices.Contains(ids, m.repo.ID) {
			targets = append(targets, targetOf(m))
		}
	}
	s.mu.Unlock()

	if len(targets) == 0 {
		if all {
			s.dropUnmanaged(nil)
		}
		return
	}
	ctx, cancel := context.WithTimeout(s.ctx, readTimeout)
	defer cancel()
	_ = s.readAndSave(ctx, targets, all)
}

// readAndSave reads targets and keeps what the reading found. whole says the
// targets are every managed repository. A failure that holds for the whole
// reading is kept as the failure of the view and returned.
func (s *Service) readAndSave(ctx context.Context, targets []target, whole bool) error {
	started := s.now()
	found, spent, err := readRepositories(ctx, s.github, targets)
	if err != nil {
		if s.ctx.Err() != nil {
			return err
		}
		s.log.Warn("deploys reading failed", "error", err)
		s.saveFailure(err)
		return err
	}
	s.save(found, targets, whole, started, spent)
	return nil
}

// saveFailure keeps err as the failure of the whole reading; the readings stay
// as they were. FailedAt stays at the first reading of the run of failures.
func (s *Service) saveFailure(err error) {
	failure := &Failure{}
	if !errors.As(err, &failure) {
		failure = FailureOf(err)
	}
	copied := *failure

	s.mu.Lock()
	defer s.mu.Unlock()

	copied.FailedAt = s.now()
	if s.failure != nil && !s.failure.FailedAt.IsZero() {
		copied.FailedAt = s.failure.FailedAt
	}
	s.failure = &copied
}

// save keeps what a reading found of targets. A repository whose reading
// failed keeps the environments of the reading before it; a whole reading
// drops the readings of repositories no longer managed.
func (s *Service) save(found map[string]RepositoryReading, targets []target, whole bool, started time.Time, spent cost) {
	readAt := s.now()

	s.mu.Lock()
	defer s.mu.Unlock()

	failed := 0
	for _, t := range targets {
		reading, ok := found[t.ID]
		if !ok {
			continue
		}
		before := s.readings[t.ID]
		if !before.ReadAt.IsZero() && started.Before(before.ReadAt) {
			// A reading of this repository that began later already ended.
			continue
		}
		if reading.Failure != nil {
			failure := *reading.Failure
			failure.FailedAt = readAt
			if before.Failure != nil && !before.Failure.FailedAt.IsZero() {
				failure.FailedAt = before.Failure.FailedAt
			}
			reading.Failure = &failure
			reading.Environments, reading.ReadAt = before.Environments, before.ReadAt
			failed++
		} else {
			reading.ReadAt = readAt
		}
		if reading.Environments == nil {
			reading.Environments = []EnvironmentReading{}
		}
		reading.RepositoryID = t.ID
		s.readings[t.ID] = reading
		s.clearFailedActionsLocked(t.ID)
	}
	s.failure = nil
	if !whole {
		return
	}

	ids := make(map[string]bool, len(targets))
	for _, t := range targets {
		ids[t.ID] = true
	}
	for id := range s.readings {
		if !ids[id] {
			delete(s.readings, id)
		}
	}
	s.readAt = readAt
	s.log.Info("deploys read", "repositories", len(targets), "failed", failed,
		"duration_ms", readAt.Sub(started).Milliseconds(), "cost", spent.GraphQL, "rest_calls", spent.REST)
}

// dropUnmanaged keeps only the readings of the repositories of keep.
func (s *Service) dropUnmanaged(keep map[string]bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for id := range s.readings {
		if !keep[id] {
			delete(s.readings, id)
		}
	}
	s.failure = nil
}

// readOne reads one repository now and keeps what it found. It returns the
// failure of the reading, if there is one.
func (s *Service) readOne(ctx context.Context, m managed) error {
	if err := s.readAndSave(ctx, []target{targetOf(m)}, false); err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if failure := s.readings[m.repo.ID].Failure; failure != nil {
		return failure
	}
	return nil
}

// Reading reports whether a reading of every managed repository runs now.
func (s *Service) Reading() bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.readingAll
}

// SaveConfig validates and stores the deploys of a board, then asks for a
// reading: the environments changed.
func (s *Service) SaveConfig(ctx context.Context, c BoardConfig) error {
	if !slices.ContainsFunc(s.boards(), func(b board.Board) bool { return b.ID == c.BoardID }) {
		return fmt.Errorf("board %s: %w", c.BoardID, ErrBoardNotFound)
	}
	var onBoard []string
	for _, repo := range s.repositories() {
		if repo.BoardID == c.BoardID {
			onBoard = append(onBoard, repo.ID)
		}
	}

	c = cloneConfig(c)
	for i := range c.Repositories {
		for j := range c.Repositories[i].Environments {
			env := &c.Repositories[i].Environments[j]
			env.Name, env.Branch = strings.TrimSpace(env.Name), strings.TrimSpace(env.Branch)
		}
	}
	if err := Validate(c, onBoard); err != nil {
		return err
	}
	if err := s.store.SaveDeployConfig(ctx, c); err != nil {
		return fmt.Errorf("save deploy configuration: %w", err)
	}

	s.mu.Lock()
	s.configs[c.BoardID] = c
	s.mu.Unlock()

	s.changed()
	s.Refresh()
	return nil
}

// Config is a copy of the deploys of a board, with the repositories that are
// still of the board; false when the board has none saved.
func (s *Service) Config(boardID string) (BoardConfig, bool) {
	repos := s.repositories()

	s.mu.Lock()
	defer s.mu.Unlock()

	c, ok := s.configs[boardID]
	if !ok {
		return BoardConfig{}, false
	}
	return stillOnBoard(c, repos), true
}

// Configs are the deploys of every board that has them, by board id.
func (s *Service) Configs() []BoardConfig {
	repos := s.repositories()

	s.mu.Lock()
	defer s.mu.Unlock()

	configs := make([]BoardConfig, 0, len(s.configs))
	for _, id := range slices.Sorted(maps.Keys(s.configs)) {
		configs = append(configs, stillOnBoard(s.configs[id], repos))
	}
	return configs
}

// stillOnBoard is a copy of c without the repositories that left its board,
// which the store still has until the next reload.
func stillOnBoard(c BoardConfig, repos []repository.Repository) BoardConfig {
	c = cloneConfig(c)
	c.Repositories = slices.DeleteFunc(c.Repositories, func(rc RepositoryConfig) bool {
		return !slices.ContainsFunc(repos, func(r repository.Repository) bool {
			return r.ID == rc.RepositoryID && r.BoardID == c.BoardID
		})
	})
	return c
}

// Filter is the filter of the view.
func (s *Service) Filter() Filter {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.filter
}

// SetFilter chooses the board the view shows; "" is every board.
func (s *Service) SetFilter(ctx context.Context, boardID string) error {
	filter := Filter{}
	if boardID != "" {
		filter.BoardID = boardID
		for _, b := range s.boards() {
			if b.ID == boardID {
				filter.Title = b.Title
			}
		}
	}
	raw, err := json.Marshal(filter)
	if err != nil {
		return fmt.Errorf("encode setting %s: %w", filterSetting, err)
	}
	if err := s.settings.Set(ctx, filterSetting, string(raw)); err != nil {
		return fmt.Errorf("write setting %s: %w", filterSetting, err)
	}

	s.mu.Lock()
	s.filter = filter
	s.mu.Unlock()

	s.changed()
	return nil
}

// Options is what the configuration of a repository offers: its workflows and
// what GitHub says of each branch. It fails with a *Failure.
func (s *Service) Options(ctx context.Context, repositoryID string, branches []string) (Options, error) {
	for _, repo := range s.repositories() {
		if repo.ID == repositoryID {
			return ReadOptions(ctx, s.github, repo.Owner, repo.Name, branches)
		}
	}
	return Options{}, &Failure{Reason: ReasonNotFound}
}

// Position is the position of the environment on branch in the configuration
// of the repository; -1 when there is none.
func (s *Service) Position(repositoryID, branch string) int {
	s.mu.Lock()
	defer s.mu.Unlock()

	return positionOf(s.environmentsLocked(repositoryID), branch)
}

// positionOf is the position of the environment on branch among envs; -1 when
// there is none.
func positionOf(envs []Environment, branch string) int {
	return slices.IndexFunc(envs, func(e Environment) bool { return e.Branch == branch })
}

// environmentsLocked are the environments configured for a repository, in
// order; nil when it has none. Callers hold the mutex.
func (s *Service) environmentsLocked(repositoryID string) []Environment {
	for _, c := range s.configs {
		for _, rc := range c.Repositories {
			if rc.RepositoryID == repositoryID {
				return rc.Environments
			}
		}
	}
	return nil
}

// environmentReadingLocked is the reading of the environment at position j of
// envs, a copy; nil when it is unread, or when it was read for another
// configuration. Callers hold the mutex.
func (s *Service) environmentReadingLocked(repositoryID string, envs []Environment, j int) *EnvironmentReading {
	rr, ok := s.readings[repositoryID]
	if !ok || j < 0 || j >= len(envs) || j >= len(rr.Environments) {
		return nil
	}
	previous := ""
	if j > 0 {
		previous = envs[j-1].Branch
	}
	if !rr.Environments[j].Holds(envs[j], previous) {
		return nil
	}
	reading := rr.Environments[j]
	return &reading
}

// viewLocked is the view of the environment at position j of envs. Callers
// hold the mutex.
func (s *Service) viewLocked(repositoryID string, envs []Environment, j int) View {
	var previous *EnvironmentReading
	var action *Action
	if j > 0 {
		previous = s.environmentReadingLocked(repositoryID, envs, j-1)
		action = s.actions[actionKey{RepositoryID: repositoryID, From: envs[j-1].Branch, To: envs[j].Branch}]
	}
	return Derive(j, s.environmentReadingLocked(repositoryID, envs, j), previous, action)
}

// Overview is the view the screen draws, derived from the configuration, the
// last readings and the actions in flight.
func (s *Service) Overview() Overview {
	repos := s.repositories()
	titles := map[string]string{}
	for _, b := range s.boards() {
		titles[b.ID] = b.Title
	}
	repoByID := make(map[string]repository.Repository, len(repos))
	for _, r := range repos {
		repoByID[r.ID] = r
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	o := Overview{
		Boards:  []BoardOverview{},
		ReadAt:  s.readAt,
		Reading: s.readingAll,
		Filter:  s.filter,
	}
	if s.failure != nil {
		failure := *s.failure
		o.Failure = &failure
	}

	for _, id := range slices.Sorted(maps.Keys(s.configs)) {
		cfg := s.configs[id]
		title, registered := titles[id]
		if !cfg.Enabled || !registered {
			continue
		}
		bo := BoardOverview{ID: id, Title: title, Repositories: []RepositoryOverview{}}
		for _, rc := range cfg.Repositories {
			repo, ok := repoByID[rc.RepositoryID]
			if !ok || repo.BoardID != id {
				continue
			}
			ro := s.repositoryOverviewLocked(repo, rc.Environments)
			for _, e := range ro.Environments {
				if Waiting(e.View) {
					o.Waiting++
				}
				if e.View.Failed {
					o.Failed = true
				}
			}
			bo.Repositories = append(bo.Repositories, ro)
		}
		if len(bo.Repositories) == 0 {
			continue
		}
		slices.SortFunc(bo.Repositories, func(a, b RepositoryOverview) int {
			return cmp.Or(
				strings.Compare(strings.ToLower(a.Name), strings.ToLower(b.Name)),
				strings.Compare(strings.ToLower(a.Owner), strings.ToLower(b.Owner)),
				cmp.Compare(a.RepositoryID, b.RepositoryID),
			)
		})
		o.Boards = append(o.Boards, bo)
	}
	slices.SortFunc(o.Boards, func(a, b BoardOverview) int {
		return cmp.Or(strings.Compare(strings.ToLower(a.Title), strings.ToLower(b.Title)), cmp.Compare(a.ID, b.ID))
	})

	listed := o.Filter.BoardID == ""
	for i := range o.Boards {
		isFilter := o.Boards[i].ID == o.Filter.BoardID
		o.Boards[i].Shown = o.Filter.BoardID == "" || isFilter
		listed = listed || isFilter
	}
	if !listed {
		o.FilterGone = FilterNoDeploys
		if _, registered := titles[o.Filter.BoardID]; !registered {
			o.FilterGone = FilterRemoved
		}
	}
	return o
}

// repositoryOverviewLocked is the row of repo. Callers hold the mutex.
func (s *Service) repositoryOverviewLocked(repo repository.Repository, envs []Environment) RepositoryOverview {
	rr := s.readings[repo.ID]
	ro := RepositoryOverview{
		RepositoryID: repo.ID,
		Owner:        repo.Owner,
		Name:         repo.Name,
		Reading:      s.readingRepos[repo.ID],
		ReadAt:       rr.ReadAt,
		Environments: make([]EnvironmentOverview, len(envs)),
	}
	if rr.Failure != nil {
		failure := *rr.Failure
		ro.Failure = &failure
	}
	for j, env := range envs {
		eo := EnvironmentOverview{
			Position:    j,
			Environment: env,
			Reading:     s.environmentReadingLocked(repo.ID, envs, j),
			View:        s.viewLocked(repo.ID, envs, j),
		}
		if j > 0 {
			eo.PreviousName = envs[j-1].Name
			if action := s.actions[actionKey{RepositoryID: repo.ID, From: envs[j-1].Branch, To: env.Branch}]; action != nil {
				copied := *action
				eo.Action = &copied
			}
		}
		ro.Environments[j] = eo
	}
	return ro
}

// Start begins watching the runs the app started. Close ends it.
func (s *Service) Start() {
	s.start.Do(func() { go s.watch() })
}

// Close ends the readings, the actions and the watching of runs, and refuses
// the next ones.
func (s *Service) Close() { s.cancel() }

// changed runs the OnChange callback outside the mutex.
func (s *Service) changed() {
	if s.onChange != nil {
		s.onChange()
	}
}
