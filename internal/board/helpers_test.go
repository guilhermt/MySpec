package board_test

import (
	"context"
	"encoding/json"
	"errors"
	"maps"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/repository"
)

// base is the fixed instant the tests read the boards at.
var base = time.Date(2026, time.September, 16, 12, 0, 0, 0, time.UTC)

// The board the fixture registers.
const (
	boardID   = "board-1"
	projectID = "project-1"
)

// pollTimeout and pollStep bound how long a test waits for a reading, which
// runs in the background.
const (
	pollTimeout = 2 * time.Second
	pollStep    = 5 * time.Millisecond
)

// The substrings that tell the queries apart.
const (
	structureMatch = "viewer { login }"
	itemsMatch     = "items(first: 100"
	batchMatch     = "rateLimit { cost }"
	reposMatch     = "content { ... on Issue { repository { nameWithOwner } } }"
	repoMatch      = "repository(owner: $owner, name: $name)"
)

// suggestQ is the item query of the repository suggestion.
const suggestQ = "is:issue"

// The item queries of a reading at base.
const (
	openQ   = "is:issue is:open"
	closedQ = "is:issue is:closed closed:>=2026-09-02"
)

// fixture is a board service over doubles, with one registered board.
type fixture struct {
	service   *board.Service
	store     *memStore
	github    *fakeGitHub
	reads     *readRecorder
	repos     *memRepositories
	changes   *changeCounter
	taskCards []string                       // the keys TaskCards answers; set before a refresh
	clones    map[string]repository.Identity // what Identify answers, by path
	tasks     map[string]int                 // the active tasks of each repository, by id
	archived  map[string]int                 // the archived tasks of each repository, by id
	ids       int                            // how many ids NewID gave
}

// newFixture registers the board "Roadmap" with the stored reading given, and
// syncs the service.
func newFixture(t *testing.T, stored board.Stored) *fixture {
	t.Helper()

	f := &fixture{
		store: &memStore{
			boards: []board.Board{{
				ID:            boardID,
				Owner:         "acme",
				OwnerType:     board.OwnerOrganization,
				Number:        3,
				Title:         "Roadmap",
				URL:           "https://github.com/orgs/acme/projects/3",
				FinalStatuses: []string{},
				CreatedAt:     base,
			}},
			stored: map[string]board.Stored{boardID: stored},
		},
		github:   &fakeGitHub{},
		reads:    &readRecorder{},
		repos:    &memRepositories{},
		changes:  &changeCounter{},
		clones:   map[string]repository.Identity{},
		tasks:    map[string]int{},
		archived: map[string]int{},
	}
	f.service = board.New(board.Deps{
		Store:        f.store,
		GitHub:       f.github,
		Repositories: f.repos,
		Identify:     f.identify,
		Counts:       func(id string) (int, int) { return f.tasks[id], f.archived[id] },
		TaskCards:    func(string) []string { return f.taskCards },
		Now:          func() time.Time { return base },
		NewID:        f.newID,
		OnChange:     f.changes.inc,
		OnRead:       f.reads.record,
	})
	if err := f.service.Sync(t.Context()); err != nil {
		t.Fatalf("Sync() = %v, want nil", err)
	}
	return f
}

// identify is the identity of the clone at path, as clones holds it.
func (f *fixture) identify(_ context.Context, path string) (repository.Identity, error) {
	identity, ok := f.clones[path]
	if !ok {
		return repository.Identity{}, &repository.Refusal{Reason: repository.ReasonNotGitRoot, Path: path}
	}
	return identity, nil
}

// newID is id-1, id-2 and so on. Only the calls of the test goroutine use it.
func (f *fixture) newID() string {
	f.ids++
	return "id-" + strconv.Itoa(f.ids)
}

// refresh refreshes the board and waits for the reading to end.
func (f *fixture) refresh(t *testing.T) {
	t.Helper()

	f.service.Refresh(boardID)
	waitReading(t, f.service, boardID)
}

// waitReading waits until no reading of the board of id runs.
func waitReading(t *testing.T, s *board.Service, id string) {
	t.Helper()

	deadline := time.Now().Add(pollTimeout)
	for s.Reading(id) {
		if time.Now().After(deadline) {
			t.Fatalf("the reading of %s did not end within %s", id, pollTimeout)
		}
		time.Sleep(pollStep)
	}
}

// waitChanges waits until OnChange was called n times, which is how a test
// waits for a reading whose board was removed while it ran.
func waitChanges(t *testing.T, changes *changeCounter, n int) {
	t.Helper()

	deadline := time.Now().Add(pollTimeout)
	for changes.count() < n {
		if time.Now().After(deadline) {
			t.Fatalf("OnChange was called %d times within %s, want %d", changes.count(), pollTimeout, n)
		}
		time.Sleep(pollStep)
	}
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

// readRecorder records the calls of OnRead.
type readRecorder struct {
	mu    sync.Mutex
	calls []map[string]board.Card
}

func (r *readRecorder) record(_ string, cards map[string]board.Card) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.calls = append(r.calls, cards)
}

func (r *readRecorder) all() []map[string]board.Card {
	r.mu.Lock()
	defer r.mu.Unlock()

	return slices.Clone(r.calls)
}

// memStore is an in-memory board.Store.
type memStore struct {
	mu       sync.Mutex
	boards   []board.Board
	stored   map[string]board.Stored
	saveErr  error           // what SaveReading fails with, when set
	failures int             // how many failures were saved
	left     []time.Duration // how long the context of each write had left
	links    []board.Link    // the links of the last write
	releases []board.Release // the releases of the last write
}

// write records the context of a write and refuses one already over, as SQLite
// does. The caller holds the lock.
func (s *memStore) write(ctx context.Context) error {
	if deadline, ok := ctx.Deadline(); ok {
		s.left = append(s.left, time.Until(deadline))
	}
	return ctx.Err()
}

// writes is how long the context of each write of a reading had left.
func (s *memStore) writes() []time.Duration {
	s.mu.Lock()
	defer s.mu.Unlock()

	return slices.Clone(s.left)
}

func (s *memStore) ListBoards(context.Context) ([]board.Board, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	return slices.Clone(s.boards), nil
}

func (s *memStore) InsertBoard(_ context.Context, b board.Board, links []board.Link) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.links, s.releases = links, nil
	s.boards = append(s.boards, b)
	s.stored[b.ID] = board.Stored{}
	return nil
}

func (s *memStore) UpdateBoard(_ context.Context, b board.Board, links []board.Link, releases []board.Release) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.links, s.releases = links, releases
	for i := range s.boards {
		if s.boards[i].ID == b.ID {
			s.boards[i] = b
		}
	}
	return nil
}

func (s *memStore) DeleteBoard(_ context.Context, id string, releases []board.Release) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.links, s.releases = nil, releases
	s.boards = slices.DeleteFunc(s.boards, func(b board.Board) bool { return b.ID == id })
	delete(s.stored, id)
	return nil
}

func (s *memStore) ListReadings(context.Context) (map[string]board.Stored, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	return maps.Clone(s.stored), nil
}

func (s *memStore) SaveReading(ctx context.Context, id, title string, r board.Reading, readAt time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.write(ctx); err != nil {
		return err
	}
	if s.saveErr != nil {
		return s.saveErr
	}
	s.stored[id] = board.Stored{Reading: &r, ReadAt: readAt}
	for i := range s.boards {
		if s.boards[i].ID == id {
			s.boards[i].Title = title
		}
	}
	return nil
}

func (s *memStore) SaveFailure(ctx context.Context, id string, f board.Failure, failedAt time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.write(ctx); err != nil {
		return err
	}
	stored := s.stored[id]
	stored.Failure, stored.FailedAt = &f, failedAt
	s.stored[id] = stored
	s.failures++
	return nil
}

// get is the stored reading of id.
func (s *memStore) get(id string) board.Stored {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.stored[id]
}

// memRepositories is an in-memory board.Repositories.
type memRepositories struct {
	mu    sync.Mutex
	items []repository.Repository
	scan  []repository.Candidate
	syncs int // how many times Sync was called
}

func (r *memRepositories) List() []repository.Repository {
	r.mu.Lock()
	defer r.mu.Unlock()

	return slices.Clone(r.items)
}

func (r *memRepositories) Get(id string) (repository.Repository, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()

	i := slices.IndexFunc(r.items, func(repo repository.Repository) bool { return repo.ID == id })
	if i < 0 {
		return repository.Repository{}, false
	}
	return r.items[i], true
}

func (r *memRepositories) Sync(context.Context) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.syncs++
	return nil
}

// synced is how many times Sync was called.
func (r *memRepositories) synced() int {
	r.mu.Lock()
	defer r.mu.Unlock()

	return r.syncs
}

func (r *memRepositories) Scan(context.Context) ([]repository.Candidate, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	return slices.Clone(r.scan), nil
}

// reply is one answer of the fake GitHub.
type reply struct {
	resp    gh.Response
	err     error
	entered chan struct{} // when set, closed as the query arrives
	release chan struct{} // when set, the query answers once it closes
}

// rule answers the queries that contain match and carry q, in order; the last
// reply repeats.
type rule struct {
	match   string
	q       string
	replies []reply
}

// call is one query the fake GitHub received.
type call struct {
	query string
	vars  gh.Vars
}

// fakeGitHub is a board.GraphQL that answers by rules.
type fakeGitHub struct {
	mu    sync.Mutex
	rules []*rule
	calls []call
	gate  chan struct{} // when set, every query waits for it to close
}

// answer makes the queries that contain match and carry q answer replies.
func (f *fakeGitHub) answer(match, q string, replies ...reply) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.rules = append(f.rules, &rule{match: match, q: q, replies: replies})
}

func (f *fakeGitHub) GraphQL(_ context.Context, query string, vars gh.Vars) (gh.Response, error) {
	if f.gate != nil {
		<-f.gate
	}
	next, ok := f.next(query, vars)
	if !ok {
		return gh.Response{}, errors.New("fake github: no answer for the query")
	}
	if next.entered != nil {
		close(next.entered)
	}
	if next.release != nil {
		<-next.release
	}
	return next.resp, next.err
}

// next records the query and takes the reply of the first rule it matches.
func (f *fakeGitHub) next(query string, vars gh.Vars) (reply, bool) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.calls = append(f.calls, call{query: query, vars: vars})
	q, _ := vars["q"].(string)
	for _, r := range f.rules {
		if strings.Contains(query, r.match) && r.q == q {
			next := r.replies[0]
			if len(r.replies) > 1 {
				r.replies = r.replies[1:]
			}
			return next, true
		}
	}
	return reply{}, false
}

// received is the calls whose query contains match.
func (f *fakeGitHub) received(match string) []call {
	f.mu.Lock()
	defer f.mu.Unlock()

	var calls []call
	for _, c := range f.calls {
		if strings.Contains(c.query, match) {
			calls = append(calls, c)
		}
	}
	return calls
}

// node is a JSON object of a GraphQL answer.
type node = map[string]any

// data is a reply with data.
func data(v any) reply {
	raw, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return reply{resp: gh.Response{Data: raw}}
}

// nodes is a GraphQL connection.
func nodes(items ...node) node {
	if items == nil {
		items = []node{}
	}
	return node{"nodes": items}
}

// statusFieldID is the id of the Status field the structure query answers.
const statusFieldID = "field-status"

// The options of the Status field of the board.
var (
	todo  = board.Option{ID: "opt-todo", Name: "Todo"}
	doing = board.Option{ID: "opt-doing", Name: "In progress"}
	done  = board.Option{ID: "opt-done", Name: "Done"}
)

// structure answers the structure query for a board titled title, with a
// Status field and the fields Priority, Estimate and Labels.
func structure(title string) reply {
	return structureWith(title, todo, doing, done)
}

// structureWith is structure with the options of the Status field given.
func structureWith(title string, statuses ...board.Option) reply {
	return structureFields(title, statuses,
		node{"name": "Title", "dataType": "TITLE"},
		node{"name": "Status", "dataType": "SINGLE_SELECT", "id": statusFieldID},
		node{"name": "Priority", "dataType": "SINGLE_SELECT", "id": "field-priority"},
		node{"name": "Estimate", "dataType": "NUMBER"},
		node{"name": "Labels", "dataType": "LABELS"},
	)
}

// structureFields is structure with the options of the Status field and the
// fields of the board given. Nil statuses is a board without a Status field,
// which answers no field node at all.
func structureFields(title string, statuses []board.Option, fields ...node) reply {
	var field any
	if statuses != nil {
		field = node{"id": statusFieldID, "options": statuses}
	}
	return data(node{
		"viewer": node{"login": "dev"},
		"owner": node{"projectV2": node{
			"id":     projectID,
			"title":  title,
			"url":    "https://github.com/orgs/acme/projects/3",
			"field":  field,
			"fields": nodes(fields...),
		}},
	})
}

// singleSelect is a single select field of a board, with its options.
func singleSelect(id, name string, options ...board.Option) node {
	return node{"name": name, "dataType": "SINGLE_SELECT", "id": id, "options": options}
}

// issueURL is the URL of an issue.
func issueURL(fullName string, number int) string {
	return "https://github.com/" + fullName + "/issues/" + strconv.Itoa(number)
}

// brief is an issue as the brief fragment reads it: open, titled "Issue <n>".
func brief(fullName string, number int) node {
	return node{
		"number":     number,
		"title":      "Issue " + strconv.Itoa(number),
		"url":        issueURL(fullName, number),
		"state":      "OPEN",
		"repository": node{"nameWithOwner": fullName},
	}
}

// issueNode is an issue as the card fragment and the batch read it, with no
// body and no relations.
func issueNode(fullName string, number int) node {
	n := brief(fullName, number)
	n["body"] = ""
	n["assignees"] = nodes()
	n["parent"] = nil
	n["blockedBy"] = nodes()
	n["closedByPullRequestsReferences"] = nodes()
	n["subIssues"] = nodes()
	n["projectItems"] = nodes()
	return n
}

// with is n with key set to value.
func with(n node, key string, value any) node {
	out := maps.Clone(n)
	out[key] = value
	return out
}

// pr is a pull request in state.
func pr(fullName string, number int, state string) node {
	return node{
		"number":     number,
		"url":        "https://github.com/" + fullName + "/pull/" + strconv.Itoa(number),
		"state":      state,
		"repository": node{"nameWithOwner": fullName},
	}
}

// statusValue is the value of the Status field.
func statusValue(o board.Option) node {
	return node{"__typename": "ProjectV2ItemFieldSingleSelectValue", "name": o.Name, "optionId": o.ID, "field": node{"name": "Status"}}
}

// selectValue is the value of a single select field.
func selectValue(field, name string) node {
	return node{"__typename": "ProjectV2ItemFieldSingleSelectValue", "name": name, "optionId": "opt-" + name, "field": node{"name": field}}
}

// numberValue is the value of a number field.
func numberValue(field string, n float64) node {
	return node{"__typename": "ProjectV2ItemFieldNumberValue", "number": n, "field": node{"name": field}}
}

// textValue is the value of a text field.
func textValue(field, text string) node {
	return node{"__typename": "ProjectV2ItemFieldTextValue", "text": text, "field": node{"name": field}}
}

// projectItem is the item of an issue in the board of id, with its values.
func projectItem(id string, values ...node) node {
	return node{"project": node{"id": id}, "fieldValues": nodes(values...)}
}

// item is a board item holding content, with its values.
func item(content node, values ...node) node {
	return node{"fieldValues": nodes(values...), "content": with(content, "__typename", "Issue")}
}

// itemsPage answers a page of items; a cursor means there is a next page.
func itemsPage(cursor string, items ...node) reply {
	return data(node{"owner": node{"projectV2": node{"items": node{
		"pageInfo": node{"hasNextPage": cursor != "", "endCursor": cursor},
		"nodes":    nodes(items...)["nodes"],
	}}}})
}

// reposPage answers a page of the repository suggestion, one item per
// repository named; a cursor means there is a next page.
func reposPage(cursor string, fullNames ...string) reply {
	items := make([]node, 0, len(fullNames))
	for _, name := range fullNames {
		items = append(items, node{"content": node{"repository": node{"nameWithOwner": name}}})
	}
	return data(node{"owner": node{"projectV2": node{"items": node{
		"pageInfo": node{"hasNextPage": cursor != "", "endCursor": cursor},
		"nodes":    items,
	}}}})
}

// batch answers a batch query with issues under their aliases; a nil issue is
// one that does not exist.
func batch(issues ...node) reply {
	answer := node{"rateLimit": node{"cost": 1}}
	for i, n := range issues {
		answer["i"+strconv.Itoa(i)] = node{"issue": n}
	}
	return data(answer)
}

// cardIssue is a board.Issue as brief builds it.
func cardIssue(fullName string, number int) board.Issue {
	owner, name, _ := strings.Cut(fullName, "/")
	return board.Issue{
		Owner:  owner,
		Name:   name,
		Number: number,
		Title:  "Issue " + strconv.Itoa(number),
		URL:    issueURL(fullName, number),
		State:  "open",
	}
}
