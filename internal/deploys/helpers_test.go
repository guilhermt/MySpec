package deploys_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/deploys"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/repository"
)

// base is the fixed instant the tests read the deploys at.
var base = time.Date(2026, time.September, 16, 12, 0, 0, 0, time.UTC)

// restReply is what the fake answers a REST call with.
type restReply struct {
	out string
	err error
}

// fakeGitHub answers what a test wrote down: the GraphQL through one function,
// the REST calls by a part of the endpoint.
type fakeGitHub struct {
	mu       sync.Mutex
	graphql  func(query string) (gh.Response, error)
	rest     map[string]restReply
	queries  []string
	endpoint []string
	bodies   []string
	// gate holds the answer of the next queries until it is closed, so a test
	// can ask for a reading while one runs.
	gate chan struct{}
}

func newFakeGitHub() *fakeGitHub {
	return &fakeGitHub{rest: map[string]restReply{}}
}

// answerREST makes the calls whose endpoint contains part answer out and err.
func (g *fakeGitHub) answerREST(part, out string, err error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	g.rest[part] = restReply{out: out, err: err}
}

// answerGraphQL makes every query answer data, with errs.
func (g *fakeGitHub) answerGraphQL(data string, errs ...gh.GraphQLError) {
	g.mu.Lock()
	defer g.mu.Unlock()

	g.graphql = func(string) (gh.Response, error) {
		return gh.Response{Data: json.RawMessage(data), Errors: errs}, nil
	}
}

// failGraphQL makes every query fail with err.
func (g *fakeGitHub) failGraphQL(err error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	g.graphql = func(string) (gh.Response, error) { return gh.Response{}, err }
}

// hold makes the next queries wait, and returns the function that releases them.
func (g *fakeGitHub) hold() func() {
	g.mu.Lock()
	defer g.mu.Unlock()

	gate := make(chan struct{})
	g.gate = gate
	return func() { close(gate) }
}

func (g *fakeGitHub) GraphQL(ctx context.Context, query string, _ gh.Vars) (gh.Response, error) {
	g.mu.Lock()
	g.queries = append(g.queries, query)
	answer := g.graphql
	gate := g.gate
	g.mu.Unlock()

	if gate != nil {
		select {
		case <-gate:
		case <-ctx.Done():
			return gh.Response{}, ctx.Err()
		}
	}

	if answer == nil {
		return gh.Response{}, fmt.Errorf("no reply for the query %q", query)
	}
	return answer(query)
}

// REST answers with the reply of the longest part the endpoint contains.
func (g *fakeGitHub) REST(_ context.Context, method, endpoint, body string) (string, error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	g.endpoint = append(g.endpoint, method+" "+endpoint)
	g.bodies = append(g.bodies, body)
	best := ""
	for part := range g.rest {
		if strings.Contains(endpoint, part) && len(part) > len(best) {
			best = part
		}
	}
	if best == "" {
		return "", fmt.Errorf("no reply for %s", endpoint)
	}
	return g.rest[best].out, g.rest[best].err
}

// bodyOf is the body of the last REST call whose "METHOD endpoint" contains part;
// false when there was none.
func (g *fakeGitHub) bodyOf(part string) (string, bool) {
	g.mu.Lock()
	defer g.mu.Unlock()

	for i := len(g.endpoint) - 1; i >= 0; i-- {
		if strings.Contains(g.endpoint[i], part) {
			return g.bodies[i], true
		}
	}
	return "", false
}

// graphQLCalls is how many queries the fake answered.
func (g *fakeGitHub) graphQLCalls() int {
	g.mu.Lock()
	defer g.mu.Unlock()

	return len(g.queries)
}

// restCalls are the REST calls the fake answered, as "METHOD endpoint".
func (g *fakeGitHub) restCalls() []string {
	g.mu.Lock()
	defer g.mu.Unlock()

	return append([]string(nil), g.endpoint...)
}

// threeEnvironments are Development, Staging and Production, with a workflow
// each (10, 20 and 30).
func threeEnvironments() []deploys.Environment {
	return []deploys.Environment{
		{Name: "Development", Branch: "dev", WorkflowID: 10},
		{Name: "Staging", Branch: "staging", WorkflowID: 20},
		{Name: "Production", Branch: "main", WorkflowID: 30},
	}
}

// runsJSON is the answer of a REST call that lists runs, one per entry of runs.
func runsJSON(t *testing.T, runs ...map[string]any) string {
	t.Helper()

	out, err := json.Marshal(map[string]any{"workflow_runs": runs})
	if err != nil {
		t.Fatalf("marshal runs: %v", err)
	}
	return string(out)
}

// runJSON is one run as GitHub writes it.
func runJSON(id int, status, conclusion string, createdAt time.Time) map[string]any {
	var concluded any
	if conclusion != "" {
		concluded = conclusion
	}
	return map[string]any{
		"id": id, "workflow_id": 10, "status": status, "conclusion": concluded,
		"head_sha": fmt.Sprintf("sha%d", id), "html_url": fmt.Sprintf("https://github.com/acme/api/actions/runs/%d", id),
		"created_at": createdAt.Format(time.RFC3339), "updated_at": createdAt.Add(time.Minute).Format(time.RFC3339),
	}
}

// The ids of what the fixture registers.
const (
	apiID      = "repo-1" // acme/api, on the Platform board
	webID      = "repo-2" // acme/web, on the Mobile board
	platformID = "board-1"
	mobileID   = "board-2"
)

// pollTimeout and pollStep bound how long a test waits for what runs in the
// background.
const (
	pollTimeout = 2 * time.Second
	pollStep    = 5 * time.Millisecond
)

// pendingData is what GitHub answers for a repository with one change waiting
// in dev and no pull request of deploy: Staging is pending.
const pendingData = `{
  "b0": {"target": {"oid": "dev9"}},
  "b1": {"target": {"oid": "stg1"}, "compare": {"aheadBy": 1, "commits": {"nodes": [
    {"oid": "dev9", "committedDate": "2026-09-10T10:00:00Z", "parents": {"totalCount": 1, "nodes": [{"oid": "stg1"}]},
     "associatedPullRequests": {"nodes": [{"number": 7, "title": "Add login", "url": "https://github.com/acme/api/pull/7", "mergedAt": "2026-09-10T10:00:00Z", "headRefName": "feat", "baseRefName": "dev", "author": {"login": "ana"}}]}}
  ]}}},
  "p1": {"totalCount": 0, "nodes": []},
  "b2": {"target": {"oid": "main1"}, "compare": {"aheadBy": 0, "commits": {"nodes": []}}},
  "p2": {"totalCount": 0, "nodes": []}
}`

// quietData is what GitHub answers for a repository with nothing waiting.
const quietData = `{
  "b0": {"target": {"oid": "dev9"}},
  "b1": {"target": {"oid": "stg1"}, "compare": {"aheadBy": 0, "commits": {"nodes": []}}},
  "p1": {"totalCount": 0, "nodes": []},
  "b2": {"target": {"oid": "main1"}, "compare": {"aheadBy": 0, "commits": {"nodes": []}}},
  "p2": {"totalCount": 0, "nodes": []}
}`

// graphQLData is the answer of a query whose repositories all read as repo.
func graphQLData(repo string) string {
	return fmt.Sprintf(`{"r0": %[1]s, "r1": %[1]s, "rateLimit": {"cost": 1}}`, repo)
}

// answerGraphQLRepo makes every query answer as if every repository were repo.
func (g *fakeGitHub) answerGraphQLRepo(repo string) {
	g.answerGraphQL(graphQLData(repo))
}

// fixture is a deploys service over doubles: acme/api on the Platform board and
// acme/web on the Mobile board, both with deploys on and Development, Staging
// and Production.
type fixture struct {
	service  *deploys.Service
	github   *fakeGitHub
	store    *memStore
	settings *memSettings
	changes  *changeCounter
	logs     *logBuffer
	finished *finishedLog

	mu     sync.Mutex
	clock  time.Time // what the service reads as now
	repos  []repository.Repository
	boards []board.Board
}

// fixtureOption changes the fixture before the service syncs.
type fixtureOption func(*fixture)

// withoutConfig leaves both boards without deploys saved.
func withoutConfig(f *fixture) { f.store.configs = map[string]deploys.BoardConfig{} }

// newFixture registers the repositories and the boards, saves their deploys,
// has the fake answer quiet repositories with one succeeded run per workflow,
// and syncs the service.
func newFixture(t *testing.T, opts ...fixtureOption) *fixture {
	t.Helper()

	f := &fixture{
		github:   newFakeGitHub(),
		store:    &memStore{configs: map[string]deploys.BoardConfig{}},
		settings: &memSettings{values: map[string]string{}},
		changes:  &changeCounter{},
		logs:     &logBuffer{},
		finished: &finishedLog{},
		clock:    base,
		repos: []repository.Repository{
			{ID: apiID, Owner: "acme", Name: "api", BoardID: platformID, CreatedAt: base},
			{ID: webID, Owner: "acme", Name: "web", BoardID: mobileID, CreatedAt: base},
		},
		boards: []board.Board{
			{ID: platformID, Title: "Platform"},
			{ID: mobileID, Title: "mobile"},
		},
	}
	for _, c := range []deploys.BoardConfig{
		{BoardID: platformID, Enabled: true, Repositories: []deploys.RepositoryConfig{{RepositoryID: apiID, Environments: threeEnvironments()}}},
		{BoardID: mobileID, Enabled: true, Repositories: []deploys.RepositoryConfig{{RepositoryID: webID, Environments: threeEnvironments()}}},
	} {
		f.store.configs[c.BoardID] = c
	}
	f.github.answerGraphQLRepo(quietData)
	idleRuns(t, f.github)
	for _, opt := range opts {
		opt(f)
	}

	f.service = deploys.New(deploys.Deps{
		GitHub:       f.github,
		Store:        f.store,
		Settings:     f.settings,
		Repositories: f.repositories,
		Boards:       f.boardList,
		Log:          slog.New(slog.NewTextHandler(f.logs, nil)),
		Now:          f.now,
		OnChange:     f.changes.inc,
		OnFinished:   f.finished.add,
	})
	t.Cleanup(f.service.Close)
	if err := f.service.Sync(t.Context()); err != nil {
		t.Fatalf("Sync() = %v, want nil", err)
	}
	return f
}

// now is the instant the service reads.
func (f *fixture) now() time.Time {
	f.mu.Lock()
	defer f.mu.Unlock()

	return f.clock
}

// advance moves the instant the service reads by d.
func (f *fixture) advance(d time.Duration) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.clock = f.clock.Add(d)
}

// repositories is what the service reads: the registered repositories now.
func (f *fixture) repositories() []repository.Repository {
	f.mu.Lock()
	defer f.mu.Unlock()

	return slices.Clone(f.repos)
}

// boardList is the registered boards now.
func (f *fixture) boardList() []board.Board {
	f.mu.Lock()
	defer f.mu.Unlock()

	return slices.Clone(f.boards)
}

// refresh reads every managed repository and waits for the reading to end.
func (f *fixture) refresh(t *testing.T) {
	t.Helper()

	f.service.Refresh()
	waitIdle(t, f.service)
}

// environment is the cell of the repository at position, as the view shows it.
func (f *fixture) environment(t *testing.T, repositoryID string, position int) deploys.EnvironmentOverview {
	t.Helper()

	for _, b := range f.service.Overview().Boards {
		for _, r := range b.Repositories {
			if r.RepositoryID == repositoryID {
				return r.Environments[position]
			}
		}
	}
	t.Fatalf("the view has no repository %s", repositoryID)
	return deploys.EnvironmentOverview{}
}

// repository is the row of the repository, as the view shows it.
func (f *fixture) repository(t *testing.T, repositoryID string) deploys.RepositoryOverview {
	t.Helper()

	for _, b := range f.service.Overview().Boards {
		for _, r := range b.Repositories {
			if r.RepositoryID == repositoryID {
				return r
			}
		}
	}
	t.Fatalf("the view has no repository %s", repositoryID)
	return deploys.RepositoryOverview{}
}

// waitIdle waits until no reading runs.
func waitIdle(t *testing.T, s *deploys.Service) {
	t.Helper()

	waitFor(t, "the readings to end", func() bool {
		o := s.Overview()
		if o.Reading {
			return false
		}
		for _, b := range o.Boards {
			for _, r := range b.Repositories {
				if r.Reading {
					return false
				}
			}
		}
		return true
	})
}

// waitAction waits until the action of the repository at position satisfies
// ok, and returns it; a nil action is passed as nil.
func (f *fixture) waitAction(t *testing.T, repositoryID string, position int, ok func(*deploys.Action) bool) *deploys.Action {
	t.Helper()

	var action *deploys.Action
	waitFor(t, "the action to get where the test expects", func() bool {
		action = f.environment(t, repositoryID, position).Action
		return ok(action)
	})
	return action
}

// waitFor polls until cond holds.
func waitFor(t *testing.T, what string, cond func() bool) {
	t.Helper()

	deadline := time.Now().Add(pollTimeout)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatalf("timed out after %s waiting for %s", pollTimeout, what)
		}
		time.Sleep(pollStep)
	}
}

// memStore is an in-memory deploys.Store.
type memStore struct {
	mu      sync.Mutex
	configs map[string]deploys.BoardConfig
	err     error // what both methods fail with, when set
}

func (s *memStore) ListDeployConfigs(context.Context) ([]deploys.BoardConfig, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.err != nil {
		return nil, s.err
	}
	configs := make([]deploys.BoardConfig, 0, len(s.configs))
	for _, c := range s.configs {
		configs = append(configs, c)
	}
	return configs, nil
}

func (s *memStore) SaveDeployConfig(_ context.Context, c deploys.BoardConfig) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.err != nil {
		return s.err
	}
	s.configs[c.BoardID] = c
	return nil
}

// saved is the configuration stored for the board.
func (s *memStore) saved(boardID string) (deploys.BoardConfig, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	c, ok := s.configs[boardID]
	return c, ok
}

// memSettings is an in-memory deploys.Settings.
type memSettings struct {
	mu     sync.Mutex
	values map[string]string
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

// finishedLog records the calls of OnFinished.
type finishedLog struct {
	mu   sync.Mutex
	list []deploys.Finished
}

func (l *finishedLog) add(f deploys.Finished) {
	l.mu.Lock()
	defer l.mu.Unlock()

	l.list = append(l.list, f)
}

func (l *finishedLog) all() []deploys.Finished {
	l.mu.Lock()
	defer l.mu.Unlock()

	return slices.Clone(l.list)
}

// logBuffer is what the service logged, as text.
type logBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *logBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	return b.buf.Write(p)
}

func (b *logBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()

	return b.buf.String()
}
