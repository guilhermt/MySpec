package attention

import (
	"cmp"
	"context"
	"log/slog"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// The timing of the situations.
const (
	// Settle is how long a situation has to hold before it starts. A task
	// passes through moments nobody waits on — a worktree still being read, a
	// commit landing before the next review pass is asked for, an artifact the
	// watcher has not seen yet — and none of them is worth a notification.
	Settle = time.Second
	// Grace is how long an ended situation is remembered: one that comes back
	// within it is the same one, with its start and without a new notification.
	Grace = time.Second
	// Baseline is how long after the app loads the tasks what is found counts
	// as found, not as started: nothing notifies, and each place keeps the start
	// the store remembers for it.
	Baseline = 3 * time.Second
)

// persistTimeout bounds the database work of an update.
const persistTimeout = 5 * time.Second

// Store keeps the situations of the tasks between runs of the app.
type Store interface {
	ListByTasks(ctx context.Context, taskIDs []string) ([]Record, error)
	Upsert(ctx context.Context, rec Record) error
	Delete(ctx context.Context, taskID, place string) error
}

// Record is a situation as the store keeps it.
type Record struct {
	TaskID    string
	Place     string // Place.Key
	ID        string
	Kind      Kind
	StartedAt time.Time
}

// Notifier shows desktop notifications. Its calls never block and never
// fail: what goes wrong is its own to log.
type Notifier interface {
	Send(id, title, body string)
	Withdraw(id string)
}

// Target is where a notification leads: a place of a task.
type Target struct {
	TaskID string
	Place  Place
}

// Started is a situation that just started, and whether the window was in
// front of the user when it did.
type Started struct {
	Situation Situation
	Focused   bool
}

// Deps are what Service needs from the outside.
type Deps struct {
	Store     Store
	Notifier  Notifier    // nil: no notification is ever sent
	Focused   func() bool // whether the window is in front of the user; nil counts as always
	Log       *slog.Logger
	Now       func() time.Time                       // defaults to time.Now
	NewID     func() string                          // defaults to uuid.NewString
	After     func(d time.Duration, f func()) func() // defaults to time.AfterFunc; returns what stops it
	OnDue     func()                                 // an update is due: a situation settled or a grace ran out; may be nil
	OnStarted func(Started)                          // a situation started after the baseline; may be nil
}

// Service holds the situations of the tasks the app loaded.
type Service struct {
	store     Store
	notifier  Notifier
	focused   func() bool
	log       *slog.Logger
	now       func() time.Time
	newID     func() string
	after     func(time.Duration, func()) func()
	onDue     func()
	onStarted func(Started)

	mu         sync.Mutex
	loadedAt   time.Time            // when the app loaded the tasks; zero before any
	generation int                  // bumped by every update
	known      map[string]*tracked  // by situation key
	candidates map[string]candidate // by situation key
	notices    map[string]*notice   // by situation id
	dueAt      time.Time            // when the update scheduled next is due; zero when none is
	stopDue    func()
	closed     bool
}

// tracked is a situation the service holds, with the last update that saw it.
type tracked struct {
	Situation
	seenAt  time.Time // until when it is known to hold: the last update that saw it, or the first one that did not
	seenGen int       // the last update that saw it
}

// candidate is a situation seen at a place but not settled yet.
type candidate struct {
	kind  Kind
	since time.Time
}

// notice is a notification the service sent since the app loaded the tasks.
type notice struct {
	target Target
	shown  bool // not withdrawn yet
}

// quietReturn says whether a situation that replaces another at the same
// place is a return to where the place was, which nobody is told about: a
// pull request whose trouble went away is ready to merge again.
func quietReturn(from, to Kind) bool { return from == KindPRTrouble && to == KindMerge }

// situationKey names a place of a task across the tasks the app loaded.
func situationKey(taskID string, place Place) string { return taskID + "|" + place.Key() }

// New builds a Service from deps.
func New(deps Deps) *Service {
	s := &Service{
		store:      deps.Store,
		notifier:   deps.Notifier,
		focused:    deps.Focused,
		log:        deps.Log,
		now:        deps.Now,
		newID:      deps.NewID,
		after:      deps.After,
		onDue:      deps.OnDue,
		onStarted:  deps.OnStarted,
		known:      map[string]*tracked{},
		candidates: map[string]candidate{},
		notices:    map[string]*notice{},
	}
	if s.focused == nil {
		s.focused = func() bool { return true }
	}
	if s.log == nil {
		s.log = slog.New(slog.DiscardHandler)
	}
	if s.now == nil {
		s.now = time.Now
	}
	if s.newID == nil {
		s.newID = uuid.NewString
	}
	if s.after == nil {
		s.after = func(d time.Duration, f func()) func() {
			timer := time.AfterFunc(d, f)
			return func() { timer.Stop() }
		}
	}
	return s
}

// Sync takes the tasks the app just loaded. What the store remembers about them
// comes back, every notification of the tasks before is withdrawn, and for
// Baseline what is found counts as already there. A store that cannot be read is
// returned as an error, with the tasks taken all the same.
func (s *Service) Sync(ctx context.Context, taskIDs []string) error {
	records, err := s.store.ListByTasks(ctx, taskIDs)
	if err != nil {
		// Without the starts the store remembers, but not without a baseline:
		// holding on to the tasks before would end each of their situations as
		// gone, deleting their starts, and take every situation already waiting
		// in this one for a new one.
		records = nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	now := s.now()
	for id := range s.notices {
		s.withdrawLocked(id)
	}
	s.notices = map[string]*notice{}
	s.candidates = map[string]candidate{}
	s.known = make(map[string]*tracked, len(records))
	for _, rec := range records {
		place, ok := ParsePlace(rec.Place)
		if !ok {
			s.log.Warn("situation place unknown", "task", rec.TaskID, "place", rec.Place)
			continue
		}
		s.known[situationKey(rec.TaskID, place)] = &tracked{
			Situation: Situation{ID: rec.ID, TaskID: rec.TaskID, Place: place, Kind: rec.Kind, StartedAt: rec.StartedAt},
			seenAt:    now,
			seenGen:   s.generation,
		}
	}
	s.loadedAt = now
	s.scheduleLocked(now.Add(Baseline), now)
	return err
}

// Update takes what the tasks the app loaded look like now and answers with
// the situations that hold, by task id, the most urgent first. It is called for
// every snapshot, and again whenever OnDue says one is due.
func (s *Service) Update(found []Found) map[string][]Situation {
	ctx, cancel := context.WithTimeout(context.Background(), persistTimeout)
	defer cancel()

	s.mu.Lock()
	now := s.now()
	s.generation++
	baseline := !s.loadedAt.IsZero() && now.Before(s.loadedAt.Add(Baseline))
	seen := make(map[string]bool, len(found))
	var started []Started

	for _, f := range found {
		key := situationKey(f.TaskID, f.Place)
		seen[key] = true
		held, holds := s.known[key]
		switch {
		case holds && held.Kind == f.Kind:
			// The same situation, in the form it is in now.
			held.Place, held.Form, held.Percent = f.Place, f.Form, f.Percent
			held.seenAt, held.seenGen = now, s.generation
			delete(s.candidates, key)
		case baseline:
			// The app just loaded the tasks: this was found, not seen starting.
			// It keeps the start the place had and says nothing.
			startedAt := now
			if holds {
				startedAt = held.StartedAt
			}
			s.commitLocked(ctx, key, f, startedAt, now)
		default:
			c, pending := s.candidates[key]
			if !pending || c.kind != f.Kind {
				s.candidates[key] = candidate{kind: f.Kind, since: now}
				s.scheduleLocked(now.Add(Settle), now)
				continue
			}
			if settled := c.since.Add(Settle); now.Before(settled) {
				s.scheduleLocked(settled, now)
				continue
			}
			delete(s.candidates, key)
			// held is still the situation that ends here: this loop runs before
			// the one that ends what was not seen, and a settle and a grace that
			// start together run out together.
			quiet := holds && quietReturn(held.Kind, f.Kind)
			if holds {
				s.endLocked(ctx, key, held)
			}
			situation := s.commitLocked(ctx, key, f, c.since, now)
			if !quiet {
				started = append(started, s.announceLocked(situation, f))
			}
		}
	}
	for key := range s.candidates {
		if !seen[key] {
			delete(s.candidates, key)
		}
	}
	for key, held := range s.known {
		if held.seenGen == s.generation || baseline {
			continue
		}
		if held.seenGen == s.generation-1 {
			// The update before this one saw it, and an update comes with every
			// change: it held until now, and its grace starts here. Counted from
			// the last update that saw it, a situation that waited for the user
			// through a quiet while would have no grace left when it goes.
			held.seenAt = now
		}
		if graceEnd := held.seenAt.Add(Grace); now.Before(graceEnd) {
			s.scheduleLocked(graceEnd, now)
			continue
		}
		s.endLocked(ctx, key, held)
	}
	if baseline {
		// What the baseline kept ends in the first update after it. Sync asks
		// for that update, but not when one is due sooner, such as a settle the
		// tasks before left running; nothing else in the baseline asks for an
		// update, so every update of the baseline asks again.
		s.scheduleLocked(s.loadedAt.Add(Baseline), now)
	}
	holding := s.holdingLocked()
	s.mu.Unlock()

	if s.onStarted != nil {
		for _, st := range started {
			s.onStarted(st)
		}
	}
	return holding
}

// View says the user reached the place of a situation in the app, with the
// window in front: a notification about it is out of date.
func (s *Service) View(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.withdrawLocked(id)
}

// Open is where the notification of a situation leads, which is what clicking
// it asks for, and forgets it. The situation may have ended since; its place is
// still where the user wanted to go.
func (s *Service) Open(id string) (Target, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	n, ok := s.notices[id]
	if !ok {
		return Target{}, false
	}
	delete(s.notices, id)
	return n.target, true
}

// Close stops the service: nothing is scheduled or notified after it. The
// notifier withdraws what it still shows when it closes itself.
func (s *Service) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.closed = true
	if s.stopDue != nil {
		s.stopDue()
	}
}

// commitLocked holds a situation found at a place, started at startedAt, and
// stores it. A store that fails only costs the start after a restart, so the
// failure goes to the log.
func (s *Service) commitLocked(ctx context.Context, key string, f Found, startedAt, now time.Time) Situation {
	situation := Situation{
		ID:        s.newID(),
		TaskID:    f.TaskID,
		Place:     f.Place,
		Kind:      f.Kind,
		Form:      f.Form,
		Percent:   f.Percent,
		StartedAt: startedAt,
	}
	s.known[key] = &tracked{Situation: situation, seenAt: now, seenGen: s.generation}

	rec := Record{TaskID: f.TaskID, Place: f.Place.Key(), ID: situation.ID, Kind: f.Kind, StartedAt: startedAt}
	if err := s.store.Upsert(ctx, rec); err != nil {
		s.log.Error("record situation failed", "task", rec.TaskID, "place", rec.Place, "err", err)
	}
	return situation
}

// announceLocked tells the user about a situation that just started: a
// notification when the window is not in front of them. With the window in
// front the interface shows it on its own.
func (s *Service) announceLocked(situation Situation, f Found) Started {
	focused := s.focused()
	notified := !focused && s.notifier != nil && !s.closed
	if notified {
		s.notifier.Send(situation.ID, f.Title, f.Body)
		s.notices[situation.ID] = &notice{target: Target{TaskID: situation.TaskID, Place: situation.Place}, shown: true}
	}
	s.log.Info("situation started", "task", situation.TaskID, "place", situation.Place.Key(),
		"kind", string(situation.Kind), "notified", notified)
	return Started{Situation: situation, Focused: focused}
}

// endLocked lets go of a situation that ended: its notification is withdrawn
// and the store forgets it.
func (s *Service) endLocked(ctx context.Context, key string, held *tracked) {
	delete(s.known, key)
	s.withdrawLocked(held.ID)

	place := held.Place.Key()
	if err := s.store.Delete(ctx, held.TaskID, place); err != nil {
		s.log.Error("forget situation failed", "task", held.TaskID, "place", place, "err", err)
	}
	s.log.Info("situation ended", "task", held.TaskID, "place", place, "kind", string(held.Kind))
}

// withdrawLocked takes the notification of a situation off the screen when it
// is still there. The notice stays, because the notification may be clicked on
// its way out and still lead to its place.
func (s *Service) withdrawLocked(id string) {
	n, ok := s.notices[id]
	if !ok || !n.shown {
		return
	}
	s.notifier.Withdraw(id)
	n.shown = false
}

// holdingLocked is every situation the last update saw, by task id, the most
// urgent first.
func (s *Service) holdingLocked() map[string][]Situation {
	holding := map[string][]Situation{}
	for _, held := range s.known {
		if held.seenGen != s.generation {
			continue
		}
		holding[held.TaskID] = append(holding[held.TaskID], held.Situation)
	}
	for _, list := range holding {
		slices.SortFunc(list, compareSituations)
	}
	return holding
}

// scheduleLocked asks for an update at an instant. A single timer runs, for the
// soonest instant asked for; the update it brings asks again for whatever is
// still to come.
func (s *Service) scheduleLocked(at, now time.Time) {
	if s.closed || s.onDue == nil {
		return
	}
	if !s.dueAt.IsZero() && !at.Before(s.dueAt) {
		return
	}
	if s.stopDue != nil {
		s.stopDue()
	}
	s.dueAt = at
	s.stopDue = s.after(at.Sub(now), s.due)
}

// due is what the timer runs when the update it was set for is due. OnDue is
// called without the mutex, because the update it brings takes it.
func (s *Service) due() {
	s.mu.Lock()
	s.dueAt, s.stopDue = time.Time{}, nil
	closed := s.closed
	s.mu.Unlock()

	if !closed {
		s.onDue()
	}
}

// compareSituations orders situations from the most urgent: by group, then the
// one that started first.
func compareSituations(a, b Situation) int {
	return cmp.Or(
		cmp.Compare(a.Kind.Group().rank(), b.Kind.Group().rank()),
		a.StartedAt.Compare(b.StartedAt),
		strings.Compare(a.Place.Key(), b.Place.Key()),
	)
}
