package newdiscussion_test

import (
	"context"
	"errors"
	"slices"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/newdiscussion"
)

const boardID = "board-1"

var base = time.Date(2026, time.October, 27, 10, 0, 0, 0, time.UTC)

// memStore is an in-memory newdiscussion.Store.
type memStore struct {
	mu    sync.Mutex
	rows  map[string]newdiscussion.Draft
	fails bool // every call fails
}

func (m *memStore) NewDiscussionDrafts(context.Context) ([]newdiscussion.Draft, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.fails {
		return nil, errors.New("disk gone")
	}
	var list []newdiscussion.Draft
	for _, d := range m.rows {
		list = append(list, d)
	}
	return list, nil
}

func (m *memStore) PutNewDiscussionDraft(_ context.Context, d newdiscussion.Draft) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.fails {
		return errors.New("disk gone")
	}
	m.rows[d.ID] = d
	return nil
}

func (m *memStore) DeleteNewDiscussionDraft(_ context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.fails {
		return errors.New("disk gone")
	}
	delete(m.rows, id)
	return nil
}

// fixture is a draft service over an in-memory store, with the boards board-1
// and board-2, a clock the test moves and the ids draft-1, draft-2...
type fixture struct {
	service *newdiscussion.Service
	store   *memStore
	now     time.Time
	ids     int
	changes int
}

func newFixture(t *testing.T) *fixture {
	t.Helper()

	f := &fixture{store: &memStore{rows: map[string]newdiscussion.Draft{}}, now: base}
	f.service = newdiscussion.New(newdiscussion.Deps{
		Store:    f.store,
		HasBoard: func(id string) bool { return slices.Contains([]string{boardID, "board-2"}, id) },
		Now:      func() time.Time { return f.now },
		NewID: func() string {
			f.ids++
			return "draft-" + strconv.Itoa(f.ids)
		},
		OnChange: func() { f.changes++ },
	})
	return f
}

// save saves what the params say, failing the test on error.
func (f *fixture) save(t *testing.T, p newdiscussion.SaveParams) newdiscussion.Draft {
	t.Helper()

	d, err := f.service.Save(t.Context(), p)
	if err != nil {
		t.Fatalf("Save(%+v) = %v, want nil", p, err)
	}
	return d
}
