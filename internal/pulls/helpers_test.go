package pulls_test

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/pulls"
	"github.com/guilhermt/myspec/internal/repository"
)

// base is the fixed instant the tests read the pull requests at.
var base = time.Date(2026, time.September, 16, 12, 0, 0, 0, time.UTC)

// The ids of the repositories the fixture registers, in the order they are
// read: acme/alpha, acme/beta, acme/gamma.
const (
	alphaID = "repo-1"
	betaID  = "repo-2"
	gammaID = "repo-3"
)

// The kinds of query the fake tells apart, by what only that query says.
const (
	queryViewer = "viewer { login }"
	queryList   = "pullRequests(states: OPEN"
	queryDetail = "pullRequest(number:"
)

// pollTimeout and pollStep bound how long a test waits for a reading, which
// runs in the background.
const (
	pollTimeout = 2 * time.Second
	pollStep    = 5 * time.Millisecond
)

// fixture is a pulls service over doubles, with three registered repositories.
type fixture struct {
	service  *pulls.Service
	github   *fakeGitHub
	settings *memSettings
	changes  *changeCounter

	mu    sync.Mutex
	repos []repository.Repository
}

// newFixture registers acme/alpha, acme/beta and acme/gamma, none on a board,
// and syncs the service.
func newFixture(t *testing.T) *fixture {
	t.Helper()

	f := &fixture{
		github:   newFakeGitHub(),
		settings: &memSettings{values: map[string]string{}},
		changes:  &changeCounter{},
		repos: []repository.Repository{
			{ID: alphaID, Owner: "acme", Name: "alpha", CreatedAt: base},
			{ID: betaID, Owner: "acme", Name: "beta", CreatedAt: base},
			{ID: gammaID, Owner: "acme", Name: "gamma", CreatedAt: base},
		},
	}
	f.github.reply(queryViewer, load(t, "viewer.json"), nil)
	f.service = pulls.New(pulls.Deps{
		GitHub:       f.github,
		Repositories: f.repositories,
		Settings:     f.settings,
		Now:          func() time.Time { return base },
		OnChange:     f.changes.inc,
	})
	t.Cleanup(f.service.Close)
	if err := f.service.Sync(t.Context()); err != nil {
		t.Fatalf("Sync() = %v, want nil", err)
	}
	return f
}

// repositories is what the service reads: the registered repositories now.
func (f *fixture) repositories() []repository.Repository {
	f.mu.Lock()
	defer f.mu.Unlock()

	return slices.Clone(f.repos)
}

// remove takes the repository of id off the registered ones.
func (f *fixture) remove(id string) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.repos = slices.DeleteFunc(f.repos, func(r repository.Repository) bool { return r.ID == id })
}

// register replaces the registered repositories with repos.
func (f *fixture) register(repos []repository.Repository) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.repos = slices.Clone(repos)
}

// refresh reads the pull requests and waits for the reading to end.
func (f *fixture) refresh(t *testing.T) {
	t.Helper()

	f.service.Refresh()
	waitReading(t, f.service)
}

// reading is what the last reading found about the repository of id.
func (f *fixture) reading(t *testing.T, id string) pulls.RepositoryReading {
	t.Helper()

	for _, r := range f.service.Readings() {
		if r.RepositoryID == id {
			return r
		}
	}
	t.Fatalf("no reading of %s", id)
	return pulls.RepositoryReading{}
}

// pullRequest is the pull request of number in the repository of id, as the
// last reading saw it.
func (f *fixture) pullRequest(t *testing.T, id string, number int) pulls.PullRequest {
	t.Helper()

	for _, pr := range f.reading(t, id).PullRequests {
		if pr.Number == number {
			return pr
		}
	}
	t.Fatalf("the reading of %s has no pull request %d", id, number)
	return pulls.PullRequest{}
}

// waitReading waits until no reading runs.
func waitReading(t *testing.T, s *pulls.Service) {
	t.Helper()

	deadline := time.Now().Add(pollTimeout)
	for s.Reading() {
		if time.Now().After(deadline) {
			t.Fatalf("the reading did not end within %s", pollTimeout)
		}
		time.Sleep(pollStep)
	}
}

// load is the recorded GitHub answer of name, in testdata.
func load(t *testing.T, name string) gh.Response {
	t.Helper()

	raw, err := os.ReadFile(filepath.Join("testdata", name))
	if err != nil {
		t.Fatalf("read %s: %v", name, err)
	}
	var resp gh.Response
	if err := json.Unmarshal(raw, &resp); err != nil {
		t.Fatalf("decode %s: %v", name, err)
	}
	return resp
}

// call is one query the fake answered.
type call struct {
	Query string
	Vars  gh.Vars
}

// reply is what the fake answers for one kind of query.
type reply struct {
	resp gh.Response
	err  error
}

// fakeGitHub answers what a test wrote down, one answer per kind of query.
type fakeGitHub struct {
	mu      sync.Mutex
	replies map[string]reply
	calls   []call
	// gate holds the answer of the next list query until it is closed, so a
	// test can ask for a refresh while a reading runs.
	gate chan struct{}
}

func newFakeGitHub() *fakeGitHub {
	return &fakeGitHub{replies: map[string]reply{}}
}

// reply is what the fake answers for the queries of kind.
func (g *fakeGitHub) reply(kind string, resp gh.Response, err error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	g.replies[kind] = reply{resp: resp, err: err}
}

// hold makes the next list queries wait, and answers the function it returns.
func (g *fakeGitHub) hold() func() {
	g.mu.Lock()
	defer g.mu.Unlock()

	gate := make(chan struct{})
	g.gate = gate
	return func() { close(gate) }
}

func (g *fakeGitHub) GraphQL(ctx context.Context, query string, vars gh.Vars) (gh.Response, error) {
	g.mu.Lock()
	kind := kindOf(query)
	g.calls = append(g.calls, call{Query: query, Vars: vars})
	answer, ok := g.replies[kind]
	gate := g.gate
	g.mu.Unlock()

	if gate != nil && kind == queryList {
		select {
		case <-gate:
		case <-ctx.Done():
			return gh.Response{}, ctx.Err()
		}
	}
	if !ok {
		return gh.Response{}, errors.New("no reply for " + kind)
	}
	return answer.resp, answer.err
}

// made is every query of kind the fake answered.
func (g *fakeGitHub) made(kind string) []call {
	g.mu.Lock()
	defer g.mu.Unlock()

	var calls []call
	for _, c := range g.calls {
		if kindOf(c.Query) == kind {
			calls = append(calls, c)
		}
	}
	return calls
}

// kindOf is the kind of query, by what only that query says.
func kindOf(query string) string {
	switch {
	case strings.Contains(query, queryDetail):
		return queryDetail
	case strings.Contains(query, queryList):
		return queryList
	default:
		return queryViewer
	}
}

// memSettings is an in-memory pulls.Settings.
type memSettings struct {
	mu     sync.Mutex
	values map[string]string
	getErr error // what Get fails with, when set
	setErr error // what Set fails with, when set
}

func (s *memSettings) Get(_ context.Context, key string) (string, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.getErr != nil {
		return "", false, s.getErr
	}
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

// get is the value stored under key.
func (s *memSettings) get(key string) string {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.values[key]
}

// changeCounter counts the calls of OnChange.
type changeCounter struct {
	mu sync.Mutex
	n  int
}

func (c *changeCounter) inc() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.n++
}

func (c *changeCounter) count() int {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.n
}
