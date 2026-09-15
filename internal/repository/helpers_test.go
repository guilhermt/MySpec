package repository_test

import (
	"bytes"
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	gocmp "github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/repository"
)

// base is the fixed instant the tests build their timestamps from.
var base = time.Date(2026, time.September, 15, 12, 0, 0, 0, time.UTC)

// filterSetting is the settings key the service keeps the filter under.
const filterSetting = "repository_filter"

// logCapture is a logger writing JSON records into a buffer.
type logCapture struct {
	log *slog.Logger
	buf *bytes.Buffer
}

func newLogCapture() logCapture {
	buf := &bytes.Buffer{}
	return logCapture{log: slog.New(slog.NewJSONHandler(buf, nil)), buf: buf}
}

// count returns how many records carry the given message.
func (c logCapture) count(t *testing.T, msg string) int {
	t.Helper()

	total := 0
	for line := range strings.SplitSeq(strings.TrimSpace(c.buf.String()), "\n") {
		if line == "" {
			continue
		}
		var rec map[string]any
		if err := json.Unmarshal([]byte(line), &rec); err != nil {
			t.Fatalf("parse log line %q: %v", line, err)
		}
		if rec["msg"] == msg {
			total++
		}
	}
	return total
}

// memStore is an in-memory repository.Store.
type memStore struct {
	mu    sync.Mutex
	items []repository.Repository
	err   error // what every method fails with, when set
}

func (s *memStore) List(context.Context) ([]repository.Repository, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.err != nil {
		return nil, s.err
	}
	out := slices.Clone(s.items)
	// The order of store.RepositoriesRepo: owner and name ignoring case, then id.
	slices.SortFunc(out, func(a, b repository.Repository) int {
		return cmp.Or(
			strings.Compare(strings.ToLower(a.Owner), strings.ToLower(b.Owner)),
			strings.Compare(strings.ToLower(a.Name), strings.ToLower(b.Name)),
			strings.Compare(a.ID, b.ID),
		)
	})
	return out, nil
}

func (s *memStore) Insert(_ context.Context, repo repository.Repository) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.err != nil {
		return s.err
	}
	s.items = append(s.items, repo)
	return nil
}

func (s *memStore) UpdatePath(_ context.Context, id, path string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.err != nil {
		return s.err
	}
	for i := range s.items {
		if s.items[i].ID == id {
			s.items[i].Path = path
		}
	}
	return nil
}

func (s *memStore) Delete(_ context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.err != nil {
		return s.err
	}
	s.items = slices.DeleteFunc(s.items, func(repo repository.Repository) bool { return repo.ID == id })
	return nil
}

// fail makes every later call of the store fail with err.
func (s *memStore) fail(err error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.err = err
}

// all is what the store holds, in the order of List.
func (s *memStore) all(t *testing.T) []repository.Repository {
	t.Helper()

	items, err := s.List(t.Context())
	if err != nil {
		t.Fatalf("List() = %v, want nil", err)
	}
	return items
}

// memSettings is an in-memory repository.Settings.
type memSettings struct {
	mu     sync.Mutex
	values map[string]string
	setErr error // what Set fails with, when set
}

func (s *memSettings) Get(_ context.Context, key string) (string, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	value, ok := s.values[key]
	return value, ok, nil
}

func (s *memSettings) Set(_ context.Context, key, value string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.setErr != nil {
		return s.setErr
	}
	s.values[key] = value
	return nil
}

// failSet makes every later write of the settings fail with err.
func (s *memSettings) failSet(err error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.setErr = err
}

// filter is the filter as the settings hold it, and whether they hold one.
func (s *memSettings) filter() (string, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	value, ok := s.values[filterSetting]
	return value, ok
}

// answer is what the fake Identify says about a path.
type answer struct {
	identity repository.Identity
	err      error
}

// recorder keeps the callbacks of the service in the order they came.
type recorder struct {
	mu     sync.Mutex
	events []string
}

func (r *recorder) add(event string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.events = append(r.events, event)
}

// take returns the events so far and forgets them.
func (r *recorder) take() []string {
	r.mu.Lock()
	defer r.mu.Unlock()

	events := r.events
	r.events = nil
	return events
}

// fixture is a Service with its collaborators, ready to assert on.
type fixture struct {
	service  *repository.Service
	store    *memStore
	settings *memSettings
	logs     logCapture
	events   *recorder
	answers  map[string]answer // by path; a path not in it has no origin
	counts   map[string][2]int // by id: active and archived tasks
}

func newFixture(t *testing.T) fixture {
	t.Helper()

	f := fixture{
		store:    &memStore{},
		settings: &memSettings{values: map[string]string{}},
		logs:     newLogCapture(),
		events:   &recorder{},
		answers:  map[string]answer{},
		counts:   map[string][2]int{},
	}
	ids := 0
	f.service = repository.New(repository.Deps{
		Store:    f.store,
		Settings: f.settings,
		Identify: func(_ context.Context, path string) (repository.Identity, error) {
			got, ok := f.answers[path]
			if !ok {
				return repository.Identity{}, &repository.Refusal{Reason: repository.ReasonNoOrigin, Path: path}
			}
			return got.identity, got.err
		},
		Counts: func(id string) (int, int) {
			counts := f.counts[id]
			return counts[0], counts[1]
		},
		Log: f.logs.log,
		Now: func() time.Time { return base },
		NewID: func() string {
			ids++
			return "repo-" + strconv.Itoa(ids)
		},
		OnChange:      func() { f.events.add("change") },
		OnPathChanged: func(id string) { f.events.add("path changed " + id) },
	})
	return f
}

// register adds the clone at path as owner/name, failing the test on error.
func (f fixture) register(t *testing.T, path, owner, name string) repository.Repository {
	t.Helper()

	f.answers[path] = answer{identity: repository.Identity{Owner: owner, Name: name}}
	repo, err := f.service.Add(t.Context(), path)
	if err != nil {
		t.Fatalf("Add(%s) = %v, want nil", path, err)
	}
	return repo
}

// clone creates a folder under parent that passes for a clone, a directory
// with a .git directory in it, and returns its path.
func clone(t *testing.T, parent, name string) string {
	t.Helper()

	path := filepath.Join(parent, name)
	if err := os.MkdirAll(filepath.Join(path, ".git"), 0o750); err != nil {
		t.Fatalf("MkdirAll(%s) = %v, want nil", path, err)
	}
	return path
}

// wantRefusal fails the test unless err is a *repository.Refusal equal to want
// whose message reads message.
func wantRefusal(t *testing.T, err error, want *repository.Refusal, message string) {
	t.Helper()

	var refusal *repository.Refusal
	if !errors.As(err, &refusal) {
		t.Fatalf("error = %v, want a *repository.Refusal", err)
	}
	if diff := gocmp.Diff(want, refusal); diff != "" {
		t.Errorf("refusal mismatch (-want +got):\n%s", diff)
	}
	if got := refusal.Message(); got != message {
		t.Errorf("Message() = %q, want %q", got, message)
	}
}
