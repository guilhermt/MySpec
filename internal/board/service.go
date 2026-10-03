package board

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

	"github.com/guilhermt/myspec/internal/repository"
)

const (
	// scanTimeout bounds a scan of the home folder.
	scanTimeout = 2 * time.Minute
	// scanTTL is how long the scan of a preview serves the repositories typed in.
	scanTTL = 10 * time.Minute
	// saveTimeout bounds storing what a reading found or why it failed. The
	// write stands apart from the reading's own deadline, so a reading that ran
	// out of time still records what happened.
	saveTimeout = 10 * time.Second
)

// finalNames are the status names marked final by default, folded.
var finalNames = []string{"done", "concluido", "closed", "completed", "fechado", "finalizado"}

// newCardNames are the status names a new card gets by default, folded.
var newCardNames = []string{"a fazer", "to do", "todo", "ready"}

// moduleNames are the names of the module field of a board, folded.
var moduleNames = []string{"modulo", "module"}

// Store persists the registered boards, the last reading of each and the
// repositories each one manages.
type Store interface {
	// ListBoards returns the registered boards, by title ignoring case, then id.
	ListBoards(ctx context.Context) ([]Board, error)
	// InsertBoard registers a board with an empty reading and applies the links.
	InsertBoard(ctx context.Context, b Board, links []Link) error
	// UpdateBoard stores the title, the final statuses and the status of new
	// cards, applies the releases, then the links.
	UpdateBoard(ctx context.Context, b Board, links []Link, releases []Release) error
	// DeleteBoard applies the releases, then removes the board and its reading.
	DeleteBoard(ctx context.Context, id string, releases []Release) error
	// ListReadings returns the stored reading of every board, by board id.
	ListReadings(ctx context.Context) (map[string]Stored, error)
	// SaveReading stores a reading that succeeded, clears the failure and sets
	// the board's title.
	SaveReading(ctx context.Context, boardID, title string, r Reading, readAt time.Time) error
	// SaveFailure stores a reading that failed, keeping the stored reading.
	SaveFailure(ctx context.Context, boardID string, f Failure, failedAt time.Time) error
}

// Link ties a repository to a board: a registered one by id, or a new one.
type Link struct {
	RepositoryID string // "" registers a new repository
	NewID        string // new only
	Owner, Name  string // new only
	Path         string // the clone: for a new one, "" for none; for a registered one without a clone, "" keeps it without one
	CreatedAt    time.Time
}

// Release takes a repository off a board: out of any board, or out of the app.
type Release struct {
	RepositoryID string
	Remove       bool
}

// Repositories is what the board service needs of the registered repositories.
type Repositories interface {
	List() []repository.Repository
	Get(id string) (repository.Repository, bool)
	Sync(ctx context.Context) error
	Scan(ctx context.Context) ([]repository.Candidate, error)
}

// Deps are what Service needs from the outside.
type Deps struct {
	Store        Store
	GitHub       GraphQL
	Repositories Repositories
	Identify     func(ctx context.Context, path string) (repository.Identity, error) // repository.Identifier.Identify
	Counts       func(repositoryID string) (active, archived int)                    // task.Service.Counts; may be nil
	TaskCards    func(boardID string) []string                                       // keys of the cards of the active tasks of the board; may be nil
	Log          *slog.Logger
	Now          func() time.Time // defaults to time.Now
	NewID        func() string    // defaults to uuid.NewString
	OnChange     func()           // after any change; may be nil
	// OnRead hands over what a reading saw of the cards, the reading's own and the
	// extra ones, keyed by card key; may be nil.
	OnRead func(boardID string, cards map[string]Card)
}

// Service owns the registered boards and the last reading of each.
type Service struct {
	store        Store
	github       GraphQL
	repositories Repositories
	identify     func(ctx context.Context, path string) (repository.Identity, error)
	counts       func(repositoryID string) (active, archived int)
	taskCards    func(boardID string) []string
	log          *slog.Logger
	now          func() time.Time
	newID        func() string
	onChange     func()
	onRead       func(boardID string, cards map[string]Card)

	// saveMu serialises the writes of readings, so each one replaces the
	// reading the one before it stored. It is taken before mu.
	saveMu sync.Mutex

	mu      sync.Mutex
	boards  []Board                // by title ignoring case, then id
	stored  map[string]Stored      // by board id
	reading map[string]bool        // by board id: a reading runs now
	scan    []repository.Candidate // the last scan a preview made
	scanAt  time.Time
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
	taskCards := deps.TaskCards
	if taskCards == nil {
		taskCards = func(string) []string { return nil }
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
		store:        deps.Store,
		github:       deps.GitHub,
		repositories: deps.Repositories,
		identify:     deps.Identify,
		counts:       counts,
		taskCards:    taskCards,
		log:          log,
		now:          now,
		newID:        newID,
		onChange:     deps.OnChange,
		onRead:       deps.OnRead,
		stored:       map[string]Stored{},
		reading:      map[string]bool{},
	}
}

// Sync loads the registered boards and their stored readings. It does not call
// OnChange.
func (s *Service) Sync(ctx context.Context) error {
	boards, err := s.store.ListBoards(ctx)
	if err != nil {
		return fmt.Errorf("list boards: %w", err)
	}
	stored, err := s.store.ListReadings(ctx)
	if err != nil {
		return fmt.Errorf("list board readings: %w", err)
	}
	slices.SortStableFunc(boards, compare)
	if stored == nil {
		stored = map[string]Stored{}
	}

	s.mu.Lock()
	s.boards, s.stored = boards, stored
	s.mu.Unlock()
	return nil
}

// List is a copy of the registered boards, by title.
func (s *Service) List() []Board {
	s.mu.Lock()
	defer s.mu.Unlock()

	return slices.Clone(s.boards)
}

// Get is the registered board of id.
func (s *Service) Get(id string) (Board, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	i := s.index(id)
	if i < 0 {
		return Board{}, false
	}
	return s.boards[i], true
}

// Stored is the stored reading of the board of id. The reading it points to is
// never changed after it is stored: a new one replaces it.
func (s *Service) Stored(id string) Stored {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.stored[id]
}

// Reading reports whether a reading of the board of id runs now.
func (s *Service) Reading(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.reading[id]
}

// Card is the card of key in the stored reading of the board of boardID.
func (s *Service) Card(boardID, key string) (Card, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	reading := s.stored[boardID].Reading
	if reading == nil {
		return Card{}, false
	}
	i := cardIndex(reading, key)
	if i < 0 {
		return Card{}, false
	}
	return reading.Cards[i], true
}

// CardOfPullRequest is the first card, in the order of List, whose stored
// reading links it to the pull request owner/name#number, and the board it
// belongs to.
func (s *Service) CardOfPullRequest(owner, name string, number int) (boardID string, card Card, ok bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, b := range s.boards {
		reading := s.stored[b.ID].Reading
		if reading == nil {
			continue
		}
		for _, c := range reading.Cards {
			for _, pr := range c.PullRequests {
				if pr.Number == number && strings.EqualFold(pr.Owner, owner) && strings.EqualFold(pr.Name, name) {
					return b.ID, c, true
				}
			}
		}
	}
	return "", Card{}, false
}

// Context is the initial context of a task created from the card of key, with
// the document of the discussion the card came from and what the user added.
func (s *Service) Context(boardID, key, discussion, additional string) (string, error) {
	card, ok := s.Card(boardID, key)
	if !ok {
		return "", fmt.Errorf("context of card %s: %w", key, ErrCardNotFound)
	}
	return Context(card, discussion, additional), nil
}

// Refresh reads the board of id again, in the background: Reading reports it
// while it runs. A reading that fails keeps the stored one and records the
// failure. It does nothing for an unknown id or while a reading of id runs.
func (s *Service) Refresh(id string) {
	s.mu.Lock()
	i := s.index(id)
	if i < 0 || s.reading[id] {
		s.mu.Unlock()
		return
	}
	b := s.boards[i]
	s.reading[id] = true
	s.mu.Unlock()

	s.changed()
	go s.runRead(b)
}

// runRead reads b, stores what it found and hands the cards to OnRead. A board
// removed while its reading ran keeps nothing of it.
func (s *Service) runRead(b Board) {
	ctx, cancel := context.WithTimeout(context.Background(), readTimeout)
	defer cancel()

	started := s.now()
	reading, extras, err := s.read(ctx, b, s.taskCards(b.ID))
	if err == nil {
		err = s.save(b, reading, extras, started)
	}
	if err != nil {
		s.fail(b, err)
	}

	s.mu.Lock()
	delete(s.reading, b.ID)
	s.mu.Unlock()
	s.changed()
}

// save stores what the reading of b found, started at started, and hands its
// cards to OnRead. A board no longer registered keeps nothing of it.
func (s *Service) save(b Board, reading Reading, extras map[string]Card, started time.Time) error {
	readAt := s.now()

	s.saveMu.Lock()
	if _, ok := s.Get(b.ID); !ok {
		s.saveMu.Unlock()
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), saveTimeout)
	defer cancel()

	if err := s.store.SaveReading(ctx, b.ID, reading.Title, reading, readAt); err != nil {
		s.saveMu.Unlock()
		s.log.Error("board reading not saved", "board", b.ID, "title", b.Title, "error", err)
		return &Failure{Reason: ReasonFailed, Detail: err.Error()}
	}

	s.mu.Lock()
	if i := s.index(b.ID); i >= 0 {
		s.stored[b.ID] = Stored{Reading: &reading, ReadAt: readAt}
		s.boards[i].Title = reading.Title
		slices.SortStableFunc(s.boards, compare)
	}
	s.mu.Unlock()
	s.saveMu.Unlock()
	s.log.Info("board read", "board", b.ID, "title", reading.Title, "cards", len(reading.Cards),
		"duration_ms", readAt.Sub(started).Milliseconds())

	if s.onRead != nil {
		cards := make(map[string]Card, len(reading.Cards)+len(extras))
		for _, c := range reading.Cards {
			cards[c.Key()] = c
		}
		for key, c := range extras {
			cards[key] = c
		}
		s.onRead(b.ID, cards)
	}
	return nil
}

// fail records a reading of b that failed with err, keeping the stored
// reading. A board no longer registered keeps nothing of it.
func (s *Service) fail(b Board, err error) {
	var failure *Failure
	if !errors.As(err, &failure) {
		failure = failureOf(err)
	}
	failedAt := s.now()
	s.log.Warn("board reading failed", "board", b.ID, "title", b.Title, "error", err)
	if _, ok := s.Get(b.ID); !ok {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), saveTimeout)
	defer cancel()

	if saveErr := s.store.SaveFailure(ctx, b.ID, *failure, failedAt); saveErr != nil {
		s.log.Error("board reading not saved", "board", b.ID, "title", b.Title, "error", saveErr)
	}

	s.mu.Lock()
	if s.index(b.ID) >= 0 {
		stored := s.stored[b.ID]
		stored.Failure, stored.FailedAt = failure, failedAt
		s.stored[b.ID] = stored
	}
	s.mu.Unlock()
}

// RefreshCard reads the card of key again, with its epic and its dependencies,
// and replaces it in the stored reading of the board of boardID without moving
// the board's read time. A failure changes nothing.
func (s *Service) RefreshCard(ctx context.Context, boardID, key string) error {
	b, ok := s.Get(boardID)
	if !ok {
		return fmt.Errorf("refresh card %s: %w", key, ErrNotFound)
	}
	stored := s.Stored(boardID)
	r, ok := parseKey(key)
	if !ok || stored.Reading == nil || cardIndex(stored.Reading, key) < 0 {
		return fmt.Errorf("refresh card %s: %w", key, ErrCardNotFound)
	}

	loc := locatorOf(b)
	st, err := s.readStructure(ctx, loc)
	if err != nil {
		return err
	}
	found, err := s.readBatch(ctx, []Ref{r})
	if err != nil {
		return err
	}
	n, ok := found[r.Key()]
	if !ok {
		return fmt.Errorf("refresh card %s: %w", key, ErrCardNotFound)
	}

	now := s.now()
	card := baseCard(n, n.valuesIn(st.ProjectID), st, now)
	convention := ReadConvention(card.Body, b.Owner, card.Owner, card.Name)
	var needs refSet
	if epic, _ := epicRef(n, convention); epic != nil {
		needs.add(*epic)
	}
	for _, dep := range dependencyRefs(n, convention) {
		if cardIndex(stored.Reading, dep.Key()) < 0 {
			needs.add(dep)
		}
	}
	index, err := s.readBatch(ctx, needs.refs)
	if err != nil {
		return err
	}
	a := newAssembly(st, stored.Reading, conventionsOf(b.Owner, stored.Reading.Cards), index)
	card = a.assembleCard(card, n, convention)

	// The card goes into the reading stored now, which a Refresh may have
	// replaced while the card was read.
	s.saveMu.Lock()
	current := s.Stored(boardID)
	i := -1
	if current.Reading != nil {
		i = cardIndex(current.Reading, key)
	}
	if i < 0 {
		s.saveMu.Unlock()
		return fmt.Errorf("refresh card %s: %w", key, ErrCardNotFound)
	}
	reading := *current.Reading
	reading.Cards = slices.Clone(reading.Cards)
	reading.Cards[i] = card
	if err := s.store.SaveReading(ctx, boardID, reading.Title, reading, current.ReadAt); err != nil {
		s.saveMu.Unlock()
		return fmt.Errorf("save reading of board %s: %w", b.Title, err)
	}

	s.mu.Lock()
	current = s.stored[boardID]
	current.Reading = &reading
	s.stored[boardID] = current
	s.mu.Unlock()
	s.saveMu.Unlock()

	if s.onRead != nil {
		s.onRead(boardID, map[string]Card{card.Key(): card})
	}
	s.changed()
	return nil
}

// RepositoryLink is how a repository of a board ties to the app.
type RepositoryLink string

// The ways a repository of a board ties to the app.
const (
	LinkRegistered RepositoryLink = "registered"  // uses the registered repository
	LinkClone      RepositoryLink = "clone"       // registers it tied to a clone the scan found
	LinkUncloned   RepositoryLink = "uncloned"    // registers it without a clone
	LinkOtherBoard RepositoryLink = "other_board" // the repository belongs to another board
)

// ReleaseKind is where a repository unchecked from its board goes: out of any
// board, or out of the app.
type ReleaseKind string

// The places an unchecked repository goes to.
const (
	ReleaseNoBoard ReleaseKind = "no_board" // it has a clone, tasks or reviews
	ReleaseLeave   ReleaseKind = "leave"    // it has none of them
)

// RepositoryOption is a repository the user may tie to a board.
type RepositoryOption struct {
	Identity     repository.Identity
	Cards        int // issues of the board in this repository; 0 for one typed in
	Checked      bool
	Link         RepositoryLink
	RepositoryID string      // registered, other_board
	Path         string      // registered: its path, "" without a clone; clone: the first clone by path
	Clones       []string    // clone: every clone found, by path; never nil
	OtherBoard   string      // other_board: the title
	Release      ReleaseKind // the repository's own board, in an edit: where it goes when unchecked; "" otherwise
}

// StatusOption is an option of the Status field, marked final or not.
type StatusOption struct {
	Option
	Final bool
}

// Preview is what registering or editing a board shows before saving.
type Preview struct {
	Locator
	URL           string
	Title         string
	HasStatus     bool
	Statuses      []StatusOption     // board order
	NewCardStatus string             // the option a new card gets; "" for none
	Repositories  []RepositoryOption // by owner/name ignoring case

	GoneStatuses      []string // edit: names of the saved options the board no longer has, in saved order; never nil
	NewStatusIDs      []string // edit: ids of the options the saved ones lack, in board order; never nil
	NewCardStatusGone bool     // edit: the status new cards got is no longer an option
}

// RepositoryChoice is a repository the user checked.
type RepositoryChoice struct {
	Owner, Name string
	Path        string // the clone chosen for a clone link; "" otherwise
}

// SaveParams is what the user chose for a board.
type SaveParams struct {
	FinalStatuses []string
	NewCardStatus string             // the option a new card gets; "" for none
	Repositories  []RepositoryChoice // the checked ones
}

// Preview reads the board at rawURL for registering it: its statuses, with the
// final ones pre-marked, and the repositories its issues are in, all checked.
func (s *Service) Preview(ctx context.Context, rawURL string) (Preview, error) {
	loc, st, err := s.readNew(ctx, rawURL)
	if err != nil {
		return Preview{}, err
	}
	suggestions, err := s.readSuggestions(ctx, loc)
	if err != nil {
		return Preview{}, err
	}
	if err := s.rescan(ctx); err != nil {
		return Preview{}, err
	}

	p := newPreview(loc, st)
	for i, o := range st.Statuses {
		p.Statuses[i].Final = finalByDefault(o.Name)
	}
	p.NewCardStatus = newCardByDefault(st.Statuses)
	for _, sg := range suggestions {
		p.Repositories = append(p.Repositories, s.option(sg.Identity, sg.Cards, true, ""))
	}
	sortOptions(p.Repositories)
	return p, nil
}

// PreviewEdit reads the registered board of id again for editing it: its
// current statuses, final as the board holds them, and its repositories,
// checked, next to the ones its issues are in.
func (s *Service) PreviewEdit(ctx context.Context, id string) (Preview, error) {
	b, ok := s.Get(id)
	if !ok {
		return Preview{}, fmt.Errorf("preview board %s: %w", id, ErrNotFound)
	}
	loc := locatorOf(b)
	st, err := s.readStructure(ctx, loc)
	if err != nil {
		return Preview{}, err
	}
	suggestions, err := s.readSuggestions(ctx, loc)
	if err != nil {
		return Preview{}, err
	}
	if err := s.rescan(ctx); err != nil {
		return Preview{}, err
	}

	p := newPreview(loc, st)
	for i, o := range st.Statuses {
		p.Statuses[i].Final = slices.Contains(b.FinalStatuses, o.ID)
	}
	p.NewCardStatus = newCardStatus(b.NewCardStatus, st)
	p.NewCardStatusGone = b.NewCardStatus != "" && newCardStatus(b.NewCardStatus, st) == ""
	if b.SavedStatuses != nil {
		for _, o := range b.SavedStatuses {
			if !slices.ContainsFunc(st.Statuses, func(c Option) bool { return c.ID == o.ID }) {
				p.GoneStatuses = append(p.GoneStatuses, o.Name)
			}
		}
		for _, o := range st.Statuses {
			if !slices.ContainsFunc(b.SavedStatuses, func(c Option) bool { return c.ID == o.ID }) {
				p.NewStatusIDs = append(p.NewStatusIDs, o.ID)
			}
		}
	}
	cards := map[string]int{}
	for _, sg := range suggestions {
		cards[strings.ToLower(sg.Identity.FullName())] = sg.Cards
	}
	var own []repository.Identity
	for _, repo := range s.repositories.List() {
		if repo.BoardID == id {
			own = append(own, repo.Identity())
			o := s.option(repo.Identity(), cards[strings.ToLower(repo.FullName())], true, id)
			o.Release = kindOf(s.releaseOf(repo))
			p.Repositories = append(p.Repositories, o)
		}
	}
	for _, sg := range suggestions {
		if !slices.ContainsFunc(own, sg.Identity.Same) {
			p.Repositories = append(p.Repositories, s.option(sg.Identity, sg.Cards, false, id))
		}
	}
	sortOptions(p.Repositories)
	return p, nil
}

// CheckRepository checks a repository the user typed as owner/name for the
// board of boardID, "" for a board not registered yet.
func (s *Service) CheckRepository(ctx context.Context, boardID, typed string) (RepositoryOption, error) {
	owner, name, ok := strings.Cut(strings.TrimSpace(typed), "/")
	if !ok || owner == "" || name == "" || strings.Contains(name, "/") {
		return RepositoryOption{}, &Refusal{Reason: RefusalInvalidRepository}
	}
	identity, found, err := s.readRepository(ctx, owner, name)
	if err != nil {
		return RepositoryOption{}, err
	}
	if !found {
		return RepositoryOption{}, &Refusal{Reason: RefusalUnknownRepository, Repository: owner + "/" + name}
	}

	s.mu.Lock()
	stale := s.now().Sub(s.scanAt) > scanTTL
	s.mu.Unlock()
	if stale {
		if err := s.rescan(ctx); err != nil {
			return RepositoryOption{}, err
		}
	}
	return s.option(identity, 0, true, boardID), nil
}

// Add registers the board at rawURL with what the user chose, then reads it.
func (s *Service) Add(ctx context.Context, rawURL string, p SaveParams) (Board, error) {
	loc, st, err := s.readNew(ctx, rawURL)
	if err != nil {
		return Board{}, err
	}
	links, err := s.links(ctx, "", p.Repositories)
	if err != nil {
		return Board{}, err
	}

	b := Board{
		ID:            s.newID(),
		Owner:         loc.Owner,
		OwnerType:     loc.OwnerType,
		Number:        loc.Number,
		Title:         st.Title,
		URL:           st.URL,
		FinalStatuses: finalStatuses(p.FinalStatuses, st),
		NewCardStatus: newCardStatus(p.NewCardStatus, st),
		SavedStatuses: st.Statuses,
		CreatedAt:     s.now(),
	}
	if err := s.store.InsertBoard(ctx, b, links); err != nil {
		return Board{}, fmt.Errorf("insert board %s: %w", b.Title, err)
	}
	if err := s.repositories.Sync(ctx); err != nil {
		return Board{}, fmt.Errorf("sync repositories: %w", err)
	}

	s.mu.Lock()
	s.boards = append(s.boards, b)
	slices.SortStableFunc(s.boards, compare)
	s.stored[b.ID] = Stored{}
	s.mu.Unlock()

	s.log.Info("board registered", "board", b.ID, "title", b.Title, "repositories", len(links))
	s.changed()
	s.Refresh(b.ID)
	return b, nil
}

// Update saves what the user chose for the board of id. The repositories left
// unchecked leave the board: out of the app when they have no clone and no
// tasks, to No board otherwise.
func (s *Service) Update(ctx context.Context, id string, p SaveParams) error {
	b, ok := s.Get(id)
	if !ok {
		return fmt.Errorf("update board %s: %w", id, ErrNotFound)
	}
	st, err := s.readStructure(ctx, locatorOf(b))
	if err != nil {
		return err
	}
	links, err := s.links(ctx, id, p.Repositories)
	if err != nil {
		return err
	}
	releases := s.releases(id, func(repo repository.Repository) bool {
		return !slices.ContainsFunc(p.Repositories, func(c RepositoryChoice) bool {
			return repo.Identity().Same(repository.Identity{Owner: c.Owner, Name: c.Name})
		})
	})

	b.Title = st.Title
	b.FinalStatuses = finalStatuses(p.FinalStatuses, st)
	b.NewCardStatus = newCardStatus(p.NewCardStatus, st)
	b.SavedStatuses = st.Statuses
	if err := s.store.UpdateBoard(ctx, b, links, releases); err != nil {
		return fmt.Errorf("update board %s: %w", b.Title, err)
	}
	if err := s.repositories.Sync(ctx); err != nil {
		return fmt.Errorf("sync repositories: %w", err)
	}

	s.mu.Lock()
	if i := s.index(id); i >= 0 {
		s.boards[i].Title, s.boards[i].FinalStatuses = b.Title, b.FinalStatuses
		s.boards[i].NewCardStatus = b.NewCardStatus
		s.boards[i].SavedStatuses = b.SavedStatuses
		slices.SortStableFunc(s.boards, compare)
	}
	s.mu.Unlock()

	s.log.Info("board updated", "board", id, "title", b.Title, "repositories", len(links), "released", len(releases))
	s.changed()
	return nil
}

// Removal is what removing a board does to its repositories: owner/name of the
// ones that move to No board and of the ones that leave the app, alphabetical.
type Removal struct {
	ToNoBoard []string // never nil
	Removed   []string // never nil
}

// RemovalPreview is what removing the board of id does to its repositories.
func (s *Service) RemovalPreview(id string) (Removal, error) {
	if _, ok := s.Get(id); !ok {
		return Removal{}, fmt.Errorf("preview removal of board %s: %w", id, ErrNotFound)
	}
	r := Removal{ToNoBoard: []string{}, Removed: []string{}}
	for _, repo := range s.repositories.List() {
		if repo.BoardID != id {
			continue
		}
		if s.releaseOf(repo).Remove {
			r.Removed = append(r.Removed, repo.FullName())
		} else {
			r.ToNoBoard = append(r.ToNoBoard, repo.FullName())
		}
	}
	byName := func(a, b string) int { return strings.Compare(strings.ToLower(a), strings.ToLower(b)) }
	slices.SortFunc(r.ToNoBoard, byName)
	slices.SortFunc(r.Removed, byName)
	return r, nil
}

// Remove removes the board of id and releases every repository of it.
func (s *Service) Remove(ctx context.Context, id string) error {
	b, ok := s.Get(id)
	if !ok {
		return fmt.Errorf("remove board %s: %w", id, ErrNotFound)
	}
	releases := s.releases(id, nil)
	if err := s.store.DeleteBoard(ctx, id, releases); err != nil {
		return fmt.Errorf("delete board %s: %w", b.Title, err)
	}
	if err := s.repositories.Sync(ctx); err != nil {
		return fmt.Errorf("sync repositories: %w", err)
	}

	s.mu.Lock()
	if i := s.index(id); i >= 0 {
		s.boards = slices.Delete(s.boards, i, i+1)
	}
	delete(s.stored, id)
	delete(s.reading, id)
	s.mu.Unlock()

	s.log.Info("board removed", "board", id, "title", b.Title, "released", len(releases))
	s.changed()
	return nil
}

// AddRepository ties one more repository to the board of boardID.
func (s *Service) AddRepository(ctx context.Context, boardID string, choice RepositoryChoice) error {
	b, ok := s.Get(boardID)
	if !ok {
		return fmt.Errorf("add repository to board %s: %w", boardID, ErrNotFound)
	}
	links, err := s.links(ctx, boardID, []RepositoryChoice{choice})
	if err != nil {
		return err
	}
	if err := s.store.UpdateBoard(ctx, b, links, nil); err != nil {
		return fmt.Errorf("add repository to board %s: %w", b.Title, err)
	}
	if err := s.repositories.Sync(ctx); err != nil {
		return fmt.Errorf("sync repositories: %w", err)
	}

	s.log.Info("board repository added", "board", boardID, "title", b.Title, "repository", choice.Owner+"/"+choice.Name)
	s.changed()
	return nil
}

// readNew parses rawURL and reads the structure of a board not registered yet.
func (s *Service) readNew(ctx context.Context, rawURL string) (Locator, structure, error) {
	loc, ok := ParseURL(rawURL)
	if !ok {
		return Locator{}, structure{}, &Refusal{Reason: RefusalInvalidURL}
	}
	st, err := s.readStructure(ctx, loc)
	if err != nil {
		return Locator{}, structure{}, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	for _, b := range s.boards {
		if strings.EqualFold(b.Owner, loc.Owner) && b.Number == loc.Number {
			return Locator{}, structure{}, &Refusal{Reason: RefusalRegistered, Title: b.Title}
		}
	}
	return loc, st, nil
}

// rescan scans the home folder and keeps what it found for the repositories
// typed in.
func (s *Service) rescan(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, scanTimeout)
	defer cancel()

	candidates, err := s.repositories.Scan(ctx)
	if err != nil {
		return fmt.Errorf("scan clones: %w", err)
	}

	s.mu.Lock()
	s.scan, s.scanAt = candidates, s.now()
	s.mu.Unlock()
	return nil
}

// option is the repository of identity as a board of boardID, "" for a board
// not registered yet, would tie to it.
func (s *Service) option(identity repository.Identity, cards int, checked bool, boardID string) RepositoryOption {
	o := RepositoryOption{Identity: identity, Cards: cards, Checked: checked, Clones: []string{}}
	if repo, ok := s.registered(identity); ok {
		o.Identity, o.RepositoryID = repo.Identity(), repo.ID
		if repo.BoardID != "" && repo.BoardID != boardID {
			other, _ := s.Get(repo.BoardID)
			o.Link, o.OtherBoard, o.Checked = LinkOtherBoard, other.Title, false
			return o
		}
		o.Link, o.Path = LinkRegistered, repo.Path
		return o
	}

	s.mu.Lock()
	for _, c := range s.scan {
		if c.Identity.Same(identity) && !c.Registered {
			o.Clones = append(o.Clones, c.Path)
		}
	}
	s.mu.Unlock()
	if len(o.Clones) == 0 {
		o.Link = LinkUncloned
		return o
	}
	slices.Sort(o.Clones)
	o.Link, o.Path = LinkClone, o.Clones[0]
	return o
}

// links resolves the choices for the board of boardID, "" for a board not
// registered yet, against the registered repositories. A clone chosen must be
// a clone of its repository.
func (s *Service) links(ctx context.Context, boardID string, choices []RepositoryChoice) ([]Link, error) {
	links := make([]Link, 0, len(choices))
	for _, c := range choices {
		identity := repository.Identity{Owner: c.Owner, Name: c.Name}
		repo, registered := s.registered(identity)
		if registered && repo.BoardID != "" && repo.BoardID != boardID {
			other, _ := s.Get(repo.BoardID)
			return nil, &Refusal{Reason: RefusalOtherBoard, Title: other.Title, Repository: repo.FullName()}
		}
		path := c.Path
		if registered && repo.Cloned() {
			path = ""
		}
		if path != "" {
			path = filepath.Clean(path)
			found, err := s.identify(ctx, path)
			if err != nil {
				return nil, fmt.Errorf("identify clone %s: %w", path, err)
			}
			if !found.Same(identity) {
				return nil, &repository.Refusal{
					Reason:     repository.ReasonOtherRepository,
					Path:       path,
					Other:      found.FullName(),
					Repository: identity.FullName(),
				}
			}
		}
		if registered {
			links = append(links, Link{RepositoryID: repo.ID, Path: path})
			continue
		}
		links = append(links, Link{NewID: s.newID(), Owner: c.Owner, Name: c.Name, Path: path, CreatedAt: s.now()})
	}
	return links, nil
}

// releases takes off the board of id its repositories that leave reports; nil
// takes them all. A repository without a clone or tasks leaves the app.
func (s *Service) releases(id string, leave func(repository.Repository) bool) []Release {
	var releases []Release
	for _, repo := range s.repositories.List() {
		if repo.BoardID != id || (leave != nil && !leave(repo)) {
			continue
		}
		releases = append(releases, s.releaseOf(repo))
	}
	return releases
}

// releaseOf is what taking repo off its board does: it leaves the app without a
// clone, tasks or reviews, and goes to No board otherwise.
func (s *Service) releaseOf(repo repository.Repository) Release {
	active, archived := s.counts(repo.ID)
	return Release{RepositoryID: repo.ID, Remove: !repo.Cloned() && active+archived == 0}
}

// kindOf is the ReleaseKind of r.
func kindOf(r Release) ReleaseKind {
	if r.Remove {
		return ReleaseLeave
	}
	return ReleaseNoBoard
}

// registered is the registered repository of identity.
func (s *Service) registered(identity repository.Identity) (repository.Repository, bool) {
	for _, repo := range s.repositories.List() {
		if repo.Identity().Same(identity) {
			return repo, true
		}
	}
	return repository.Repository{}, false
}

// newPreview is the preview of the board at loc, with no status marked final and
// no repository.
func newPreview(loc Locator, st structure) Preview {
	p := Preview{
		Locator:      loc,
		URL:          st.URL,
		Title:        st.Title,
		HasStatus:    st.HasStatus,
		Statuses:     make([]StatusOption, len(st.Statuses)),
		Repositories: []RepositoryOption{},

		GoneStatuses: []string{},
		NewStatusIDs: []string{},
	}
	for i, o := range st.Statuses {
		p.Statuses[i] = StatusOption{Option: o}
	}
	return p
}

// sortOptions orders options by owner/name, ignoring case.
func sortOptions(options []RepositoryOption) {
	slices.SortStableFunc(options, func(a, b RepositoryOption) int {
		return strings.Compare(strings.ToLower(a.Identity.FullName()), strings.ToLower(b.Identity.FullName()))
	})
}

// finalStatuses is ids without the ones that are not options of st; never nil.
func finalStatuses(ids []string, st structure) []string {
	final := []string{}
	for _, id := range ids {
		if slices.ContainsFunc(st.Statuses, func(o Option) bool { return o.ID == id }) && !slices.Contains(final, id) {
			final = append(final, id)
		}
	}
	return final
}

// newCardStatus is id when it is an option of st, "" otherwise.
func newCardStatus(id string, st structure) string {
	if slices.ContainsFunc(st.Statuses, func(o Option) bool { return o.ID == id }) {
		return id
	}
	return ""
}

// newCardByDefault is the option a new card gets unless the user says
// otherwise: the first status whose name says it is where work starts, "" when
// no status does.
func newCardByDefault(statuses []Option) string {
	for _, o := range statuses {
		if slices.Contains(newCardNames, fold(strings.TrimSpace(o.Name))) {
			return o.ID
		}
	}
	return ""
}

// finalByDefault reports whether a status of this name is final unless the user
// says otherwise.
func finalByDefault(name string) bool {
	return slices.Contains(finalNames, fold(strings.TrimSpace(name)))
}

// locatorOf is where b lives on GitHub.
func locatorOf(b Board) Locator {
	return Locator{Owner: b.Owner, OwnerType: b.OwnerType, Number: b.Number}
}

// cardIndex is the position of the card of key in reading, -1 when it is not
// there.
func cardIndex(reading *Reading, key string) int {
	key = strings.ToLower(key)
	return slices.IndexFunc(reading.Cards, func(c Card) bool { return c.Key() == key })
}

// index is the position of id in the list, -1 when it is not there. The caller
// holds the mutex.
func (s *Service) index(id string) int {
	return slices.IndexFunc(s.boards, func(b Board) bool { return b.ID == id })
}

// changed runs the OnChange callback outside the mutex.
func (s *Service) changed() {
	if s.onChange != nil {
		s.onChange()
	}
}

// compare orders boards by title, ignoring case, then by id.
func compare(a, b Board) int {
	return cmp.Or(
		strings.Compare(strings.ToLower(a.Title), strings.ToLower(b.Title)),
		strings.Compare(a.ID, b.ID),
	)
}
