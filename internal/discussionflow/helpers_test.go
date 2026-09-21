package discussionflow_test

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/discussionflow"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/session"
)

// pollTimeout and pollStep bound how long a test waits for an evaluation,
// which the flow runs on a goroutine of its own.
const (
	pollTimeout = 2 * time.Second
	pollStep    = 5 * time.Millisecond
)

// The board every test discusses, with the two repositories it manages.
const (
	boardID   = "board-1"
	projectID = "PVT_1"
	webID     = "repo-web"
	apiID     = "repo-api"
	cardKey   = "acme/web#12"
)

// base is the fixed instant the timestamps of the tests are built from.
var base = time.Date(2026, time.September, 18, 12, 0, 0, 0, time.UTC)

// errSession is what the fake session answers with when a test asks it to
// fail.
var errSession = errors.New("session: the model is not there")

// memSessions is an in-memory discussionflow.Sessions recording what it was
// asked to do.
type memSessions struct {
	mu        sync.Mutex
	summaries map[session.Key]session.Summary
	infos     map[session.Key]session.TaskInfo
	stored    map[session.Key]bool // the sessions ever created, open or not
	calls     []string
	startErr  error // returned by Start alone
}

func newSessions() *memSessions {
	return &memSessions{
		summaries: map[session.Key]session.Summary{},
		infos:     map[session.Key]session.TaskInfo{},
		stored:    map[session.Key]bool{},
	}
}

func (m *memSessions) Open(_ context.Context, t session.TaskInfo) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "open:"+t.ID)
	m.infos[t.Key()] = t
	m.stored[t.Key()] = true
	if _, ok := m.summaries[t.Key()]; !ok {
		m.summaries[t.Key()] = session.Summary{
			TaskID: t.ID, Stage: t.Stage, Status: session.StatusWaiting, Idle: true,
		}
	}
	return nil
}

func (m *memSessions) Start(_ context.Context, t session.TaskInfo, restarted bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "start:"+t.ID+":restarted="+strconv.FormatBool(restarted))
	if m.startErr != nil {
		return m.startErr
	}
	m.infos[t.Key()] = t
	m.stored[t.Key()] = true
	m.summaries[t.Key()] = session.Summary{TaskID: t.ID, Stage: t.Stage, Status: session.StatusWorking}
	return nil
}

func (m *memSessions) Close(_ context.Context, k session.Key) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "close:"+k.TaskID)
	delete(m.summaries, k)
	return nil
}

func (m *memSessions) DiscardTask(_ context.Context, taskID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "discardTask:"+taskID)
	for k := range m.summaries {
		if k.TaskID == taskID {
			delete(m.summaries, k)
		}
	}
	for k := range m.stored {
		if k.TaskID == taskID {
			delete(m.stored, k)
		}
	}
	return nil
}

func (m *memSessions) Summary(k session.Key) (session.Summary, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	sum, ok := m.summaries[k]
	return sum, ok
}

func (m *memSessions) Exists(_ context.Context, k session.Key) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	return m.stored[k], nil
}

// idle leaves the conversation of a discussion resting, which is what an
// evaluation reads the drafts on.
func (m *memSessions) idle(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	k := session.Key{TaskID: id, Stage: session.DiscussionStage}
	m.summaries[k] = session.Summary{TaskID: id, Stage: session.DiscussionStage, Status: session.StatusWaiting, Idle: true}
}

// shut leaves a discussion without an open conversation, which is a
// discussion no evaluation reads the drafts of or publishes for.
func (m *memSessions) shut(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.summaries, session.Key{TaskID: id, Stage: session.DiscussionStage})
}

// info is what the conversation of a discussion was last opened with.
func (m *memSessions) info(id string) session.TaskInfo {
	m.mu.Lock()
	defer m.mu.Unlock()

	return m.infos[session.Key{TaskID: id, Stage: session.DiscussionStage}]
}

// made is what the fake was asked to do, in order.
func (m *memSessions) made() []string {
	m.mu.Lock()
	defer m.mu.Unlock()

	return slices.Clone(m.calls)
}

// memBoards is an in-memory discussionflow.Boards over one board.
type memBoards struct {
	mu       sync.Mutex
	board    board.Board
	found    bool
	stored   board.Stored
	refreshs int
}

func newBoards() *memBoards {
	return &memBoards{
		board: board.Board{
			ID: boardID, Owner: "acme", OwnerType: board.OwnerOrganization, Number: 7,
			Title: "Roadmap", URL: "https://github.com/orgs/acme/projects/7",
			NewCardStatus: "opt-todo", CreatedAt: base,
		},
		found: true,
		stored: board.Stored{
			Reading: &board.Reading{
				ProjectID:     projectID,
				Title:         "Roadmap",
				Viewer:        "octocat",
				Statuses:      []board.Option{{ID: "opt-todo", Name: "A Fazer"}, {ID: "opt-done", Name: "Done"}},
				HasStatus:     true,
				StatusFieldID: "field-status",
				Module: &board.ModuleField{ID: "field-module", Name: "Módulo", Options: []board.Option{
					{ID: "opt-billing", Name: "Billing"}, {ID: "opt-auth", Name: "Auth"},
				}},
				Cards: []board.Card{{
					Issue: board.Issue{
						Owner: "acme", Name: "web", Number: 12,
						Title: "Invoices", URL: "https://github.com/acme/web/issues/12",
					},
					Body: "The invoices.", Status: "A Fazer", ReadAt: base,
				}},
			},
			ReadAt: base,
		},
	}
}

func (m *memBoards) Get(id string) (board.Board, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if !m.found || id != m.board.ID {
		return board.Board{}, false
	}
	return m.board, true
}

func (m *memBoards) Stored(id string) board.Stored {
	m.mu.Lock()
	defer m.mu.Unlock()

	if id != m.board.ID {
		return board.Stored{}
	}
	return m.stored
}

func (m *memBoards) Card(id, key string) (board.Card, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if id != m.board.ID || m.stored.Reading == nil {
		return board.Card{}, false
	}
	index := slices.IndexFunc(m.stored.Reading.Cards, func(c board.Card) bool { return c.Key() == key })
	if index < 0 {
		return board.Card{}, false
	}
	return m.stored.Reading.Cards[index], true
}

func (m *memBoards) Refresh(string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.refreshs++
}

// forgetModuleOption takes an option out of the module field of the board, as
// a board the user changed between the drafts and the publication of them.
func (m *memBoards) forgetModuleOption(name string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	options := m.stored.Reading.Module.Options
	m.stored.Reading.Module.Options = slices.DeleteFunc(options, func(o board.Option) bool {
		return o.Name == name
	})
}

// refreshed is how many times the board was asked to be read again.
func (m *memBoards) refreshed() int {
	m.mu.Lock()
	defer m.mu.Unlock()

	return m.refreshs
}

// memGH is an in-memory discussionflow.GH counting what it was asked to write,
// with the calls a test asks it to refuse or to hold.
type memGH struct {
	mu           sync.Mutex
	calls        []string
	createErr    map[string]error         // by title, and only the first time
	held         map[string]chan struct{} // by title: the issues waiting to be created
	blockedByErr error
}

// failCreate makes the next issue of that title fail, as GitHub refusing one
// halfway through a run does.
func (m *memGH) failCreate(title string, err error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.createErr == nil {
		m.createErr = map[string]error{}
	}
	m.createErr[title] = err
}

// holdCreate keeps the issue of that title from being created until the test
// lets it go, which is how a test looks at a discussion in the middle of a
// run. Letting it go twice is letting it go once.
func (m *memGH) holdCreate(title string) (release func()) {
	gate := make(chan struct{})

	m.mu.Lock()
	if m.held == nil {
		m.held = map[string]chan struct{}{}
	}
	m.held[title] = gate
	m.mu.Unlock()

	var once sync.Once
	return func() { once.Do(func() { close(gate) }) }
}

// awaitRelease waits for the test to let the issue of that title be created.
func (m *memGH) awaitRelease(title string) {
	m.mu.Lock()
	gate := m.held[title]
	m.mu.Unlock()

	if gate != nil {
		<-gate
	}
}

// failBlockedBy makes every dependency GitHub is asked for fail.
func (m *memGH) failBlockedBy(err error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.blockedByErr = err
}

// made is what the fake was asked to write, in order.
func (m *memGH) made() []string {
	m.mu.Lock()
	defer m.mu.Unlock()

	return slices.Clone(m.calls)
}

func (m *memGH) LookupIssues(_ context.Context, refs []gh.IssueRef) (map[gh.IssueRef]gh.IssueNode, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	found := map[gh.IssueRef]gh.IssueNode{}
	for _, ref := range refs {
		found[ref] = gh.IssueNode{
			ID: "I_" + ref.String(), Number: ref.Number, Title: ref.String(),
			URL:          "https://github.com/" + ref.Owner + "/" + ref.Name + "/issues/" + strconv.Itoa(ref.Number),
			RepositoryID: "R_" + ref.Owner + "/" + ref.Name,
		}
	}
	return found, nil
}

func (m *memGH) LookupRepositories(_ context.Context, repos []string) (map[string]string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	found := map[string]string{}
	for _, fullName := range repos {
		found[fullName] = "R_" + fullName
	}
	return found, nil
}

func (m *memGH) CreateIssue(_ context.Context, repositoryID, title, _ string) (gh.IssueNode, error) {
	m.awaitRelease(title)

	m.mu.Lock()
	defer m.mu.Unlock()

	if err := m.createErr[title]; err != nil {
		delete(m.createErr, title)
		return gh.IssueNode{}, err
	}
	m.calls = append(m.calls, "createIssue:"+repositoryID+":"+title)
	return gh.IssueNode{ID: "I_" + title, Number: len(m.calls), Title: title, RepositoryID: repositoryID}, nil
}

func (m *memGH) UpdateIssue(_ context.Context, issueID, _, _ string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "updateIssue:"+issueID)
	return nil
}

func (m *memGH) AddProjectItem(_ context.Context, id, contentID string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "addProjectItem:"+id+":"+contentID)
	return "PVTI_" + contentID, nil
}

func (m *memGH) SetProjectSingleSelect(_ context.Context, _, itemID, fieldID, optionID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "setField:"+itemID+":"+fieldID+":"+optionID)
	return nil
}

func (m *memGH) AddSubIssue(_ context.Context, parentID, subIssueID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "addSubIssue:"+parentID+":"+subIssueID)
	return nil
}

func (m *memGH) AddBlockedBy(_ context.Context, issueID, blockingIssueID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.blockedByErr != nil {
		return m.blockedByErr
	}
	m.calls = append(m.calls, "addBlockedBy:"+issueID+":"+blockingIssueID)
	return nil
}

// fixture is a flow over in-memory dependencies, with the discussions of a
// real service on a store in memory.
type fixture struct {
	t            *testing.T
	flow         *discussionflow.Service
	discussions  *discussion.Service
	store        *memStore
	sessions     *memSessions
	boards       *memBoards
	gh           *memGH
	repositories *repository.Service
	dataDir      string

	mu      sync.Mutex
	ids     int
	elapsed int
	changes []string
}

// newFixture builds a flow over one board with two cloned repositories, and a
// clock that moves one second per reading so that two writes never share an
// instant.
func newFixture(t *testing.T) *fixture {
	t.Helper()

	f := &fixture{
		t: t, store: newMemStore(), sessions: newSessions(), boards: newBoards(),
		gh: &memGH{}, dataDir: t.TempDir(),
	}
	f.discussions = discussion.New(discussion.Deps{
		Store: f.store, DataDir: f.dataDir, Now: f.now, NewID: f.newID,
	})
	f.repositories = repositoryService(t, f.dataDir)
	f.flow = discussionflow.New(discussionflow.Deps{
		Discussions:  f.discussions,
		Sessions:     f.sessions,
		Boards:       f.boards,
		Repositories: f.repositories,
		GH:           f.gh,
		Now:          f.now,
		OnChange:     f.onChange,
	})
	t.Cleanup(f.flow.Close)
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

func (f *fixture) onChange(id string) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.changes = append(f.changes, id)
}

// changeCount is how many times the flow reported a change of a discussion.
func (f *fixture) changeCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()

	return len(f.changes)
}

// start opens a discussion of the board over the one card of its reading.
func (f *fixture) start(cards ...string) string {
	f.t.Helper()

	id, err := f.flow.Start(f.t.Context(), discussionflow.StartParams{
		BoardID: boardID, Title: "Invoices", Text: "Export invoices", Cards: cards,
	})
	if err != nil {
		f.t.Fatalf("start discussion: %v", err)
	}
	return id
}

// write puts an artifact of the agent in the folder of a discussion.
func (f *fixture) write(id, name, content string) {
	f.t.Helper()

	stored, ok := f.discussions.Get(id)
	if !ok {
		f.t.Fatalf("discussion %s is not there", id)
	}
	if err := os.WriteFile(filepath.Join(stored.ArtifactsDir, name), []byte(content), 0o600); err != nil {
		f.t.Fatalf("write %s: %v", name, err)
	}
}

// state is what the flow says about a discussion now.
func (f *fixture) state(id string) discussionflow.State {
	f.t.Helper()

	state, ok := f.flow.State(id)
	if !ok {
		f.t.Fatalf("discussion %s is not there", id)
	}
	return state
}

// draftState is one draft of a discussion with what can be done to it.
func (f *fixture) draftState(id, draftID string) discussionflow.DraftState {
	f.t.Helper()

	for _, d := range f.state(id).Drafts {
		if d.Draft.ID == draftID {
			return d
		}
	}
	f.t.Fatalf("draft %s of discussion %s is not there", draftID, id)
	return discussionflow.DraftState{}
}

// record reads the artifact the agent wrote, as an evaluation of an idle
// conversation does, and waits for the drafts to be there.
func (f *fixture) record(id, content string) {
	f.t.Helper()

	f.write(id, discussion.DraftsFile, content)
	f.sessions.idle(id)
	f.flow.Check(id)
	f.waitFor(id, func(state discussionflow.State) bool { return state.Discussion.DraftsRead })
}

// decide records a decision of the user on a draft.
func (f *fixture) decide(id, draftID string, d discussion.Decision) {
	f.t.Helper()

	if err := f.flow.Decide(f.t.Context(), id, draftID, d); err != nil {
		f.t.Fatalf("decide on draft %s: %v", draftID, err)
	}
}

// approve approves a draft, which is what sends it to GitHub.
func (f *fixture) approve(id, draftID string) {
	f.t.Helper()

	f.decide(id, draftID, discussion.DecisionApproved)
}

// waitPublished waits for a draft to be written on GitHub to the last step,
// with the run that wrote it over.
func (f *fixture) waitPublished(id, draftID string) discussion.Draft {
	f.t.Helper()

	f.waitFor(id, func(state discussionflow.State) bool {
		return !state.Publishing && f.draftIn(state, draftID).Published.Done()
	})
	return f.draftState(id, draftID).Draft
}

// waitFailed waits for the publication of a draft to fail, with the run that
// tried it over.
func (f *fixture) waitFailed(id, draftID string) discussion.Draft {
	f.t.Helper()

	f.waitFor(id, func(state discussionflow.State) bool {
		return !state.Publishing && f.draftIn(state, draftID).PublishError != ""
	})
	return f.draftState(id, draftID).Draft
}

// draftIn is one draft of a state, empty when the discussion has no such one.
func (f *fixture) draftIn(state discussionflow.State, draftID string) discussion.Draft {
	return f.draftStateIn(state, draftID).Draft
}

// draftStateIn is one draft of a state with what can be done to it, empty when
// the discussion has no such one.
func (f *fixture) draftStateIn(state discussionflow.State, draftID string) discussionflow.DraftState {
	for _, d := range state.Drafts {
		if d.Draft.ID == draftID {
			return d
		}
	}
	return discussionflow.DraftState{}
}

// waitFor waits for the state of a discussion to say what the test expects,
// because an evaluation runs on a goroutine of its own.
func (f *fixture) waitFor(id string, done func(discussionflow.State) bool) discussionflow.State {
	f.t.Helper()

	deadline := time.Now().Add(pollTimeout)
	for {
		state := f.state(id)
		if done(state) {
			return state
		}
		if time.Now().After(deadline) {
			f.t.Fatalf("the discussion %s never got there: status %s", id, state.Status)
		}
		time.Sleep(pollStep)
	}
}

// repositoryService is a repository service over a store in memory with the
// two cloned repositories of the board.
func repositoryService(t *testing.T, dataDir string) *repository.Service {
	t.Helper()

	repos := &memRepositories{items: []repository.Repository{
		{ID: webID, Owner: "acme", Name: "web", Path: filepath.Join(dataDir, "web"), BoardID: boardID, CreatedAt: base},
		{ID: apiID, Owner: "acme", Name: "api", Path: filepath.Join(dataDir, "api"), BoardID: boardID, CreatedAt: base},
	}}
	for _, repo := range repos.items {
		if err := os.MkdirAll(filepath.Join(repo.Path, ".git"), 0o700); err != nil {
			t.Fatalf("create clone: %v", err)
		}
	}
	service := repository.New(repository.Deps{
		Store: repos, Settings: repos, ScanRoot: dataDir, Now: func() time.Time { return base },
	})
	if err := service.Sync(t.Context()); err != nil {
		t.Fatalf("sync repositories: %v", err)
	}
	return service
}

// memRepositories is an in-memory repository.Store over a fixed list.
type memRepositories struct {
	mu    sync.Mutex
	items []repository.Repository
}

func (m *memRepositories) List(_ context.Context) ([]repository.Repository, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	return slices.Clone(m.items), nil
}

func (m *memRepositories) Insert(_ context.Context, repo repository.Repository) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.items = append(m.items, repo)
	return nil
}

func (m *memRepositories) UpdatePath(_ context.Context, id, path string) error {
	return m.update(id, func(repo *repository.Repository) { repo.Path = path })
}

func (m *memRepositories) UpdateBoard(_ context.Context, id, id2 string) error {
	return m.update(id, func(repo *repository.Repository) { repo.BoardID = id2 })
}

func (m *memRepositories) UpdateReviewInstructions(_ context.Context, id, text string) error {
	return m.update(id, func(repo *repository.Repository) { repo.ReviewInstructions = text })
}

func (m *memRepositories) Delete(_ context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if index := m.indexOf(id); index >= 0 {
		m.items = slices.Delete(m.items, index, index+1)
	}
	return nil
}

func (m *memRepositories) update(id string, mutate func(*repository.Repository)) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	index := m.indexOf(id)
	if index < 0 {
		return os.ErrNotExist
	}
	mutate(&m.items[index])
	return nil
}

func (m *memRepositories) indexOf(id string) int {
	return slices.IndexFunc(m.items, func(r repository.Repository) bool { return r.ID == id })
}

// Get answers the settings of the repositories, which the tests leave empty.
func (m *memRepositories) Get(context.Context, string) (string, bool, error) { return "", false, nil }

// Set keeps no setting: no test changes one.
func (m *memRepositories) Set(context.Context, string, string) error { return nil }

// memStore is an in-memory discussion.Store, with the writes of a draft a
// test asks it to refuse.
type memStore struct {
	mu          sync.Mutex
	discussions []discussion.Discussion
	drafts      map[string][]discussion.Draft

	// writeErr is what the next writes of a draft the test picked answer
	// with, and writeErrLeft how many of them still do.
	writeErr     error
	writeErrLeft int
	writeErrWhen func(discussion.Draft) bool
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
	return out, nil
}

func (m *memStore) Insert(_ context.Context, d discussion.Discussion) error {
	m.mu.Lock()
	defer m.mu.Unlock()

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

	m.drafts[discussionID] = slices.Clone(drafts)
	if d == nil {
		return nil
	}
	return m.update(*d)
}

// failWrites makes the next count writes of a draft the picker says yes to
// fail, which is how a test looks at a publication the store did not record.
func (m *memStore) failWrites(count int, err error, when func(discussion.Draft) bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.writeErr, m.writeErrLeft, m.writeErrWhen = err, count, when
}

// refuses reports whether the write of this draft is one the test asked to
// fail, and takes it off the count.
func (m *memStore) refuses(draft discussion.Draft) error {
	if m.writeErrLeft == 0 || (m.writeErrWhen != nil && !m.writeErrWhen(draft)) {
		return nil
	}
	m.writeErrLeft--
	return m.writeErr
}

func (m *memStore) UpdateDraft(_ context.Context, draft discussion.Draft) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if err := m.refuses(draft); err != nil {
		return err
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
