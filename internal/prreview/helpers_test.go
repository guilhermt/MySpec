package prreview_test

import (
	"context"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/repository"
)

// base is the fixed instant the tests build their timestamps from.
var base = time.Date(2026, time.September, 17, 12, 0, 0, 0, time.UTC)

// memStore is an in-memory prreview.Store.
type memStore struct {
	mu        sync.Mutex
	reviews   []prreview.Review
	passes    map[string][]prreview.Pass
	insertErr error
	updateErr error
	passErr   error
	deleteErr error
}

func newMemStore() *memStore {
	return &memStore{passes: map[string][]prreview.Pass{}}
}

func (m *memStore) ListActive(_ context.Context) ([]prreview.Review, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	var out []prreview.Review
	for _, review := range m.reviews {
		if !review.Archived() {
			out = append(out, review)
		}
	}
	slices.SortStableFunc(out, func(a, b prreview.Review) int { return a.CreatedAt.Compare(b.CreatedAt) })
	return out, nil
}

func (m *memStore) ListArchived(_ context.Context) ([]prreview.Review, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	var out []prreview.Review
	for _, review := range m.reviews {
		if review.Archived() {
			out = append(out, review)
		}
	}
	slices.SortStableFunc(out, func(a, b prreview.Review) int { return b.ArchivedAt.Compare(a.ArchivedAt) })
	return out, nil
}

func (m *memStore) Insert(_ context.Context, review prreview.Review) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.insertErr != nil {
		return m.insertErr
	}
	m.reviews = append(m.reviews, review)
	return nil
}

func (m *memStore) Update(_ context.Context, review prreview.Review) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.updateErr != nil {
		return m.updateErr
	}
	index := m.indexOf(review.ID)
	if index < 0 {
		return os.ErrNotExist
	}
	archivedAt := m.reviews[index].ArchivedAt
	m.reviews[index] = review
	m.reviews[index].ArchivedAt = archivedAt
	return nil
}

func (m *memStore) UpdateArchived(_ context.Context, id string, archivedAt, updatedAt time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	index := m.indexOf(id)
	if index < 0 {
		return os.ErrNotExist
	}
	m.reviews[index].ArchivedAt, m.reviews[index].UpdatedAt = archivedAt, updatedAt
	return nil
}

func (m *memStore) Delete(_ context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.deleteErr != nil {
		return m.deleteErr
	}
	if index := m.indexOf(id); index >= 0 {
		m.reviews = slices.Delete(m.reviews, index, index+1)
	}
	delete(m.passes, id)
	return nil
}

func (m *memStore) Passes(_ context.Context, reviewID string) ([]prreview.Pass, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.passErr != nil {
		return nil, m.passErr
	}
	return slices.Clone(m.passes[reviewID]), nil
}

func (m *memStore) UpsertPass(_ context.Context, pass prreview.Pass) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.updateErr != nil {
		return m.updateErr
	}
	passes := m.passes[pass.ReviewID]
	index := slices.IndexFunc(passes, func(p prreview.Pass) bool { return p.Number == pass.Number })
	if index < 0 {
		passes = append(passes, pass)
		slices.SortFunc(passes, func(a, b prreview.Pass) int { return a.Number - b.Number })
	} else {
		findings := passes[index].Findings
		passes[index] = pass
		passes[index].Findings = findings
	}
	m.passes[pass.ReviewID] = passes
	return nil
}

func (m *memStore) DeletePass(_ context.Context, reviewID string, pass int) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.passes[reviewID] = slices.DeleteFunc(m.passes[reviewID],
		func(p prreview.Pass) bool { return p.Number == pass })
	return nil
}

func (m *memStore) ReplaceFindings(_ context.Context, reviewID string, pass int, findings []prreview.Finding) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	index := slices.IndexFunc(m.passes[reviewID], func(p prreview.Pass) bool { return p.Number == pass })
	if index < 0 {
		return os.ErrNotExist
	}
	m.passes[reviewID][index].Findings = slices.Clone(findings)
	return nil
}

func (m *memStore) UpdateFinding(_ context.Context, reviewID string, pass int, finding prreview.Finding) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	index := slices.IndexFunc(m.passes[reviewID], func(p prreview.Pass) bool { return p.Number == pass })
	if index < 0 {
		return os.ErrNotExist
	}
	findings := m.passes[reviewID][index].Findings
	at := slices.IndexFunc(findings, func(f prreview.Finding) bool { return f.Number == finding.Number })
	if at < 0 {
		return os.ErrNotExist
	}
	findings[at] = finding
	return nil
}

// indexOf is the position of a review, -1 when it is not stored. The caller
// holds the mutex.
func (m *memStore) indexOf(id string) int {
	return slices.IndexFunc(m.reviews, func(r prreview.Review) bool { return r.ID == id })
}

// storedPass is the pass as the store has it, which the tests read to confirm
// what was persisted.
func (m *memStore) storedPass(t *testing.T, reviewID string, number int) prreview.Pass {
	t.Helper()

	m.mu.Lock()
	defer m.mu.Unlock()

	for _, pass := range m.passes[reviewID] {
		if pass.Number == number {
			return pass
		}
	}
	t.Fatalf("pass %d of review %s is not stored", number, reviewID)
	return prreview.Pass{}
}

// fixture is a service with an in-memory store, a temporary data directory and
// one registered repository.
type fixture struct {
	service *prreview.Service
	store   *memStore
	dataDir string
	repo    repository.Repository

	mu      sync.Mutex
	changes int
	ids     int
	clock   time.Time
}

// newFixture builds a service whose clock and ids are the test's.
func newFixture(t *testing.T) *fixture {
	t.Helper()

	f := &fixture{
		store:   newMemStore(),
		dataDir: t.TempDir(),
		repo:    repository.Repository{ID: "repo-1", Owner: "dev", Name: "web", Path: "/clones/web"},
		clock:   base,
	}
	f.service = prreview.New(prreview.Deps{
		Store:        f.store,
		DataDir:      f.dataDir,
		Repositories: func(id string) (repository.Repository, bool) { return f.repo, id == f.repo.ID },
		Now:          f.now,
		NewID:        f.newID,
		OnChange:     f.onChange,
	})
	return f
}

// now walks the clock a second at a time, so that every write is later than
// the one before it.
func (f *fixture) now() time.Time {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.clock = f.clock.Add(time.Second)
	return f.clock
}

func (f *fixture) newID() string {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.ids++
	return "review-" + strconv.Itoa(f.ids)
}

func (f *fixture) onChange() {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.changes++
}

// changed is how many times the service announced a change.
func (f *fixture) changed() int {
	f.mu.Lock()
	defer f.mu.Unlock()

	return f.changes
}

// create makes a review of a pull request in publish mode.
func (f *fixture) create(t *testing.T, number int) prreview.Review {
	t.Helper()

	review, err := f.service.Create(t.Context(), prreview.CreateParams{
		RepositoryID: f.repo.ID,
		Number:       number,
		Title:        "Add the review center",
		Author:       "octocat",
		URL:          "https://github.com/dev/web/pull/" + strconv.Itoa(number),
		HeadBranch:   "feature",
		BaseBranch:   "main",
		HeadCommit:   "abc1234",
		Mode:         prreview.ModePublish,
	})
	if err != nil {
		t.Fatalf("create review: %v", err)
	}
	return review
}

// asked is a review with the first pass asked for.
func (f *fixture) asked(t *testing.T, number int) prreview.Review {
	t.Helper()

	review := f.create(t, number)
	if _, err := f.service.AskPass(t.Context(), review.ID, 1, "look at the tests"); err != nil {
		t.Fatalf("ask pass: %v", err)
	}
	return review
}

// recorded is a review whose first pass holds the report given.
func (f *fixture) recorded(t *testing.T, number int, report prreview.Report, commit string) prreview.Review {
	t.Helper()

	review := f.asked(t, number)
	if _, _, err := f.service.RecordReport(t.Context(), review.ID, report, commit); err != nil {
		t.Fatalf("record report: %v", err)
	}
	return review
}

// pass is the pass of a review the service holds now.
func (f *fixture) pass(t *testing.T, id string, number int) prreview.Pass {
	t.Helper()

	for _, pass := range f.service.Passes(id) {
		if pass.Number == number {
			return pass
		}
	}
	t.Fatalf("review %s has no pass %d", id, number)
	return prreview.Pass{}
}

// review is the active review the service holds now.
func (f *fixture) review(t *testing.T, id string) prreview.Review {
	t.Helper()

	review, ok := f.service.Get(id)
	if !ok {
		t.Fatalf("review %s is not active", id)
	}
	return review
}

// changesReport is a report with findings, as the agent writes it.
func changesReport(pass int, summary string, findings ...prreview.ParsedFinding) prreview.Report {
	return prreview.Report{Pass: pass, Summary: summary, Findings: findings}
}

// cleanReport is a report that found nothing to change.
func cleanReport(pass int, summary string) prreview.Report {
	return prreview.Report{Pass: pass, Clean: true, Summary: summary}
}

// writeFile puts an artifact in the folder of a review.
func writeFile(t *testing.T, dir, name, content string) {
	t.Helper()

	if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o600); err != nil {
		t.Fatalf("write %s: %v", name, err)
	}
}
