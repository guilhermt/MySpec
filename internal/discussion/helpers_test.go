package discussion_test

import (
	"context"
	"os"
	"slices"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/discussion"
)

// base is the fixed instant the tests build their timestamps from.
var base = time.Date(2026, time.September, 18, 12, 0, 0, 0, time.UTC)

// memStore is an in-memory discussion.Store.
type memStore struct {
	mu          sync.Mutex
	discussions []discussion.Discussion
	drafts      map[string][]discussion.Draft
	insertErr   error
	writeErr    error
	updateErr   error
	deleteErr   error
	writes      int
}

func newMemStore() *memStore {
	return &memStore{drafts: map[string][]discussion.Draft{}}
}

func (m *memStore) ListActive(_ context.Context) ([]discussion.Discussion, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	var out []discussion.Discussion
	for _, d := range m.discussions {
		if !d.Archived() {
			out = append(out, d)
		}
	}
	slices.SortStableFunc(out, func(a, b discussion.Discussion) int { return a.CreatedAt.Compare(b.CreatedAt) })
	return out, nil
}

func (m *memStore) ListArchived(_ context.Context) ([]discussion.Discussion, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	var out []discussion.Discussion
	for _, d := range m.discussions {
		if d.Archived() {
			out = append(out, d)
		}
	}
	slices.SortStableFunc(out, func(a, b discussion.Discussion) int { return b.ArchivedAt.Compare(a.ArchivedAt) })
	return out, nil
}

func (m *memStore) Insert(_ context.Context, d discussion.Discussion) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.insertErr != nil {
		return m.insertErr
	}
	m.discussions = append(m.discussions, d)
	return nil
}

func (m *memStore) Update(_ context.Context, d discussion.Discussion) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	return m.update(d)
}

// update replaces a discussion, keeping what only UpdateArchived writes.
func (m *memStore) update(d discussion.Discussion) error {
	if m.updateErr != nil {
		return m.updateErr
	}
	index := m.indexOf(d.ID)
	if index < 0 {
		return os.ErrNotExist
	}
	archivedAt := m.discussions[index].ArchivedAt
	m.discussions[index] = d
	m.discussions[index].ArchivedAt = archivedAt
	return nil
}

func (m *memStore) UpdateArchived(_ context.Context, id string, archivedAt, updatedAt time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	index := m.indexOf(id)
	if index < 0 {
		return os.ErrNotExist
	}
	m.discussions[index].ArchivedAt, m.discussions[index].UpdatedAt = archivedAt, updatedAt
	return nil
}

func (m *memStore) Delete(_ context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.deleteErr != nil {
		return m.deleteErr
	}
	if index := m.indexOf(id); index >= 0 {
		m.discussions = slices.Delete(m.discussions, index, index+1)
	}
	delete(m.drafts, id)
	return nil
}

func (m *memStore) Drafts(_ context.Context, discussionID string) ([]discussion.Draft, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	return slices.Clone(m.drafts[discussionID]), nil
}

func (m *memStore) WriteDrafts(_ context.Context, discussionID string, drafts []discussion.Draft,
	d *discussion.Discussion,
) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.writeErr != nil {
		return m.writeErr
	}
	m.writes++
	m.drafts[discussionID] = slices.Clone(drafts)
	if d == nil {
		return nil
	}
	return m.update(*d)
}

func (m *memStore) UpdateDraft(_ context.Context, draft discussion.Draft) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.updateErr != nil {
		return m.updateErr
	}
	drafts := m.drafts[draft.DiscussionID]
	index := slices.IndexFunc(drafts, func(d discussion.Draft) bool { return d.ID == draft.ID })
	if index < 0 {
		return os.ErrNotExist
	}
	drafts[index] = draft
	return nil
}

// indexOf is the position of a discussion, -1 when it is not there.
func (m *memStore) indexOf(id string) int {
	return slices.IndexFunc(m.discussions, func(d discussion.Discussion) bool { return d.ID == id })
}

// fixture is a service over an in-memory store and a temporary data directory.
type fixture struct {
	t       *testing.T
	store   *memStore
	service *discussion.Service
	dataDir string

	mu      sync.Mutex
	ids     int
	elapsed int
	changes int
}

// newFixture builds a service with ids that differ in the prefix a folder is
// named after, and a clock that moves one second per reading, so that two
// writes never share an instant.
func newFixture(t *testing.T) *fixture {
	t.Helper()

	f := &fixture{t: t, store: newMemStore(), dataDir: t.TempDir()}
	f.service = discussion.New(discussion.Deps{
		Store:    f.store,
		DataDir:  f.dataDir,
		Now:      f.now,
		NewID:    f.newID,
		OnChange: f.onChange,
	})
	return f
}

func (f *fixture) now() time.Time {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.elapsed++
	return base.Add(time.Duration(f.elapsed) * time.Second)
}

func (f *fixture) newID() string {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.ids++
	return strconv.Itoa(f.ids) + "-discussion"
}

func (f *fixture) onChange() {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.changes++
}

// changeCount is how many times the service reported a change.
func (f *fixture) changeCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()

	return f.changes
}

// create makes a discussion of one board with one card.
func (f *fixture) create() discussion.Discussion {
	f.t.Helper()

	d, err := f.service.Create(f.t.Context(), discussion.CreateParams{
		BoardID:        "board-1",
		BoardTitle:     "Roadmap",
		BoardOwner:     "acme",
		BoardNumber:    7,
		Title:          "Invoices",
		Text:           "Export invoices",
		InitialContext: "# Invoices\n",
		Cards:          []discussion.InputCard{{Owner: "acme", Name: "web", Number: 12, Title: "Card", URL: "url"}},
	})
	if err != nil {
		f.t.Fatalf("create discussion: %v", err)
	}
	return d
}

// record parses an artifact and records it, which is what the flow does after
// a turn of the agent.
func (f *fixture) record(id, content string) bool {
	f.t.Helper()

	artifact, err := discussion.ParseArtifact(content)
	if err != nil {
		f.t.Fatalf("parse artifact: %v", err)
	}
	changed, err := f.service.RecordDrafts(f.t.Context(), id, artifact)
	if err != nil {
		f.t.Fatalf("record drafts: %v", err)
	}
	return changed
}

// recordValidated validates an artifact against the board and records it,
// which is the whole reading the flow does after a turn of the agent.
func (f *fixture) recordValidated(id, content string) bool {
	f.t.Helper()

	artifact, err := discussion.ParseArtifact(content)
	if err != nil {
		f.t.Fatalf("parse artifact: %v", err)
	}
	if err = discussion.Validate(artifact, boardCatalog()); err != nil {
		f.t.Fatalf("validate artifact: %v", err)
	}
	changed, err := f.service.RecordDrafts(f.t.Context(), id, artifact)
	if err != nil {
		f.t.Fatalf("record drafts: %v", err)
	}
	return changed
}

// draft is one draft of a discussion by id.
func (f *fixture) draft(id, draftID string) discussion.Draft {
	f.t.Helper()

	for _, d := range f.service.Drafts(id) {
		if d.ID == draftID {
			return d
		}
	}
	f.t.Fatalf("draft %s of discussion %s is not there", draftID, id)
	return discussion.Draft{}
}

// draftIDs are the drafts of a discussion, in position order.
func (f *fixture) draftIDs(id string) []string {
	f.t.Helper()

	drafts := f.service.Drafts(id)
	ids := make([]string, 0, len(drafts))
	for _, d := range drafts {
		ids = append(ids, d.ID)
	}
	return ids
}
