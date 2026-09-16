package board

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/guilhermt/myspec/internal/repository"
)

// Store persists the registered boards, the last reading of each and the
// repositories each one manages.
type Store interface {
	// ListBoards returns the registered boards, by title ignoring case, then id.
	ListBoards(ctx context.Context) ([]Board, error)
	// InsertBoard registers a board with an empty reading and applies the links.
	InsertBoard(ctx context.Context, b Board, links []Link) error
	// UpdateBoard stores the title and the final statuses, applies the releases,
	// then the links.
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
	boards  []Board           // by title ignoring case, then id
	stored  map[string]Stored // by board id
	reading map[string]bool   // by board id: a reading runs now
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

// Context is the initial context of a task created from the card of key, with
// what the user added.
func (s *Service) Context(boardID, key, additional string) (string, error) {
	card, ok := s.Card(boardID, key)
	if !ok {
		return "", fmt.Errorf("context of card %s: %w", key, ErrCardNotFound)
	}
	return Context(card, additional), nil
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

// runRead reads b, stores what it found and hands the cards to OnRead.
func (s *Service) runRead(b Board) {
	ctx, cancel := context.WithTimeout(context.Background(), readTimeout)
	defer cancel()

	started := s.now()
	loc := Locator{Owner: b.Owner, OwnerType: b.OwnerType, Number: b.Number}
	reading, extras, err := s.read(ctx, loc, s.taskCards(b.ID))
	if err == nil {
		readAt := s.now()
		s.saveMu.Lock()
		if saveErr := s.store.SaveReading(ctx, b.ID, reading.Title, reading, readAt); saveErr != nil {
			s.log.Error("board reading not saved", "board", b.Title, "error", saveErr)
			err = &Failure{Reason: ReasonFailed, Detail: saveErr.Error()}
			s.saveMu.Unlock()
		} else {
			s.mu.Lock()
			s.stored[b.ID] = Stored{Reading: &reading, ReadAt: readAt}
			if i := s.index(b.ID); i >= 0 {
				s.boards[i].Title = reading.Title
				slices.SortStableFunc(s.boards, compare)
			}
			s.mu.Unlock()
			s.saveMu.Unlock()
			s.log.Info("board read", "board", reading.Title, "cards", len(reading.Cards),
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
		}
	}
	if err != nil {
		s.fail(ctx, b, err)
	}

	s.mu.Lock()
	s.reading[b.ID] = false
	s.mu.Unlock()
	s.changed()
}

// fail records a reading of b that failed with err, keeping the stored reading.
func (s *Service) fail(ctx context.Context, b Board, err error) {
	var failure *Failure
	if !errors.As(err, &failure) {
		failure = failureOf(err)
	}
	failedAt := s.now()
	s.log.Warn("board reading failed", "board", b.Title, "error", err)
	if saveErr := s.store.SaveFailure(ctx, b.ID, *failure, failedAt); saveErr != nil {
		s.log.Error("board reading not saved", "board", b.Title, "error", saveErr)
	}

	s.mu.Lock()
	stored := s.stored[b.ID]
	stored.Failure, stored.FailedAt = failure, failedAt
	s.stored[b.ID] = stored
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

	loc := Locator{Owner: b.Owner, OwnerType: b.OwnerType, Number: b.Number}
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
	var needs refSet
	if epic, _ := epicRef(n, ReadConvention(card.Body, b.Owner, card.Owner, card.Name)); epic != nil {
		needs.add(*epic)
	}
	for _, dep := range dependencyRefs(n, b.Owner) {
		if cardIndex(stored.Reading, dep.Key()) < 0 {
			needs.add(dep)
		}
	}
	index, err := s.readBatch(ctx, needs.refs)
	if err != nil {
		return err
	}
	card = newAssembly(b.Owner, st, stored.Reading, index).assembleCard(card, n)

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
