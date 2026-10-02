package reviewflow_test

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
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/prreport"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/pulls"
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/reviewflow"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/worktree"
)

// pollTimeout and pollStep bound how long a test waits for an evaluation,
// which the flow runs on a goroutine of its own.
const (
	pollTimeout = 2 * time.Second
	pollStep    = 5 * time.Millisecond
)

// The pull request every test reviews, of the one registered repository.
const (
	repoID    = "repo-1"
	bareID    = "repo-2"
	prNumber  = 42
	viewer    = "octocat"
	prAuthor  = "contributor"
	headHash  = "aaa1111"
	otherHash = "bbb2222"
)

// base is the fixed instant the timestamps of the tests are built from.
var base = time.Date(2026, time.September, 17, 12, 0, 0, 0, time.UTC)

// The failures the fakes are told to answer with.
var (
	errGitHub = errors.New("gh: cannot reach github")
	errGit    = errors.New("git: cannot create the worktree")
	errStore  = errors.New("store: database is locked")
)

// memSessions is an in-memory reviewflow.Sessions recording what it was asked
// to do.
type memSessions struct {
	mu        sync.Mutex
	summaries map[session.Key]session.Summary
	infos     map[session.Key]session.TaskInfo
	stored    map[session.Key]bool // the sessions ever created, open or not
	calls     []string
	messages  []string
	apps      []session.AppMessage  // every message of the app, with its kind and numbers
	markers   []session.MarkerEntry // every marker the flow recorded, in order
	err       error                 // returned by every call that changes something
	startErr  error                 // returned by Start alone
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
	if m.err != nil {
		return m.err
	}
	if created, ok := m.infos[t.Key()]; ok && m.stored[t.Key()] {
		// A conversation keeps the model it was created with.
		t.Choice = created.Choice
	}
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
	if m.err != nil {
		return m.err
	}
	if m.startErr != nil {
		// The session was created before the start failed, as a store that
		// fails to queue the prompt leaves it.
		m.stored[t.Key()] = true
		return m.startErr
	}
	if created, ok := m.infos[t.Key()]; ok && m.stored[t.Key()] {
		// A conversation keeps the model it was created with.
		t.Choice = created.Choice
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
	if m.err != nil {
		return m.err
	}
	delete(m.summaries, k)
	return nil
}

func (m *memSessions) DiscardTask(_ context.Context, taskID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "discardTask:"+taskID)
	if m.err != nil {
		return m.err
	}
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

func (m *memSessions) Resume(_ context.Context, k session.Key) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "resume:"+k.TaskID)
	if m.err != nil {
		return m.err
	}
	sum, ok := m.summaries[k]
	if !ok {
		return session.ErrNotFound
	}
	sum.Status, sum.Idle = session.StatusWaiting, true
	m.summaries[k] = sum
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

func (m *memSessions) SendFromApp(_ context.Context, k session.Key, msg session.AppMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "send:"+k.TaskID)
	if m.err != nil {
		return m.err
	}
	m.messages = append(m.messages, msg.Text)
	m.apps = append(m.apps, msg)
	sum := m.summaries[k]
	sum.Status, sum.Idle = session.StatusWorking, false
	m.summaries[k] = sum
	return nil
}

func (m *memSessions) MarkPRReview(_ context.Context, k session.Key, pass int, clean bool, findings int) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "mark:"+k.TaskID+":pass="+strconv.Itoa(pass)+":clean="+strconv.FormatBool(clean))
	m.markers = append(m.markers, reportMarker(session.MarkerPRReviewWritten, pass, clean, findings))
}

func (m *memSessions) MarkPRReviewRevised(_ context.Context, _ session.Key, pass int, clean bool, findings int) {
	m.record(reportMarker(session.MarkerPRReviewRevised, pass, clean, findings))
}

func (m *memSessions) MarkChecksRead(
	_ context.Context, _ session.Key, pass, passed, total int, failed []string, conflict bool,
) {
	m.record(session.MarkerEntry{
		Type: session.MarkerChecksRead, Pass: pass, Passed: passed, Total: total, Failed: failed, Conflict: conflict,
	})
}

func (m *memSessions) MarkFindingsDecided(_ context.Context, _ session.Key, pass, approved, discarded int) {
	m.record(session.MarkerEntry{
		Type: session.MarkerFindingsDecided, Pass: pass, Approved: approved, Discarded: discarded,
	})
}

func (m *memSessions) MarkReviewPublished(_ context.Context, _ session.Key, p session.PublishedReview) {
	m.record(session.MarkerEntry{
		Type: session.MarkerReviewPublished, Pass: p.Pass, Verdict: p.Verdict, Inline: p.Inline, Body: p.Body,
		Summary: p.Summary, Minimal: p.Minimal, URL: p.URL,
	})
}

func (m *memSessions) MarkNewCommits(_ context.Context, _ session.Key, commits []session.MarkerCommit, count int) {
	m.record(session.MarkerEntry{Type: session.MarkerNewCommits, Commits: commits, Count: count})
}

func (m *memSessions) MarkChangesApproved(_ context.Context, _ session.Key, files int) {
	m.record(session.MarkerEntry{Type: session.MarkerChangesApproved, Files: files})
}

func (m *memSessions) MarkCommitted(
	_ context.Context, _ session.Key, sha, subject string, pushed bool, number int,
) {
	m.record(session.MarkerEntry{
		Type: session.MarkerCommitted, SHA: sha, Subject: subject, Pushed: pushed, Number: number,
	})
}

func (m *memSessions) record(marker session.MarkerEntry) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.markers = append(m.markers, marker)
}

// markersOf is the markers of a type the flow recorded, in order.
func (m *memSessions) markersOf(t session.MarkerType) []session.MarkerEntry {
	m.mu.Lock()
	defer m.mu.Unlock()

	var found []session.MarkerEntry
	for _, marker := range m.markers {
		if marker.Type == t {
			found = append(found, marker)
		}
	}
	return found
}

// reportMarker is the marker of a written or revised report.
func reportMarker(t session.MarkerType, pass int, clean bool, findings int) session.MarkerEntry {
	marker := session.MarkerEntry{Type: t, Pass: pass, Clean: clean}
	if findings >= 0 {
		marker.Findings = &findings
	}
	return marker
}

// sentApps is the kind and the numbers of every message of the app, without
// the text, which sent holds.
func (m *memSessions) sentApps() []session.AppMessage {
	m.mu.Lock()
	defer m.mu.Unlock()

	apps := slices.Clone(m.apps)
	for i := range apps {
		apps[i].Text = ""
	}
	return apps
}

// goIdle brings the conversation of a review to rest, which is what an
// evaluation waits for.
func (m *memSessions) goIdle(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := session.Key{TaskID: id, Stage: session.ReviewStage}
	sum, ok := m.summaries[key]
	if !ok {
		return
	}
	sum.Status, sum.Idle = session.StatusWaiting, true
	m.summaries[key] = sum
}

// goBusy puts the conversation of a review in the middle of a turn.
func (m *memSessions) goBusy(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := session.Key{TaskID: id, Stage: session.ReviewStage}
	sum, ok := m.summaries[key]
	if !ok {
		return
	}
	sum.Status, sum.Idle = session.StatusWorking, false
	m.summaries[key] = sum
}

// forget drops the conversation of a review, which is a review the app
// reopened without one.
func (m *memSessions) forget(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.summaries, session.Key{TaskID: id, Stage: session.ReviewStage})
}

// lose drops the conversation of a review from memory and from the database,
// which is a review that never had one.
func (m *memSessions) lose(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := session.Key{TaskID: id, Stage: session.ReviewStage}
	delete(m.summaries, key)
	delete(m.stored, key)
}

// info is what the last Open or Start said about the conversation of a review.
func (m *memSessions) info(id string) (session.TaskInfo, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	t, ok := m.infos[session.Key{TaskID: id, Stage: session.ReviewStage}]
	return t, ok
}

// recorded returns the calls the fake took, in order.
func (m *memSessions) recorded() []string {
	m.mu.Lock()
	defer m.mu.Unlock()

	return slices.Clone(m.calls)
}

// failStart makes every start of a conversation fail with err.
func (m *memSessions) failStart(err error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.startErr = err
}

// failWith makes every call that changes something return err.
func (m *memSessions) failWith(err error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.err = err
}

// memWorktrees is an in-memory reviewflow.Worktrees: it creates the worktree
// of a review in a folder of the test and answers with the failures it was
// told to.
type memWorktrees struct {
	mu         sync.Mutex
	dataDir    string
	items      map[string]worktree.Worktree // by item id
	calls      []string
	head       string // the commit every reading of a worktree answers with
	statusErr  error
	ensureErr  error
	updateErr  error
	updateOnce bool // the update failure is spent on the next call
	removeErr  error
	commitErr  error // returned when a commit is read
}

func newWorktrees(dataDir string) *memWorktrees {
	return &memWorktrees{dataDir: dataDir, items: map[string]worktree.Worktree{}, head: headHash}
}

func (m *memWorktrees) Get(itemID string) (worktree.Worktree, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	wt, ok := m.items[itemID]
	return wt, ok
}

func (m *memWorktrees) EnsureDetached(
	_ context.Context, itemID string, repo repository.Repository, dirName, headBranch, baseBranch string,
) (worktree.Worktree, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "ensureDetached:"+itemID+":"+dirName+":"+headBranch+":"+baseBranch)
	if m.ensureErr != nil {
		return worktree.Worktree{}, m.ensureErr
	}
	if wt, ok := m.items[itemID]; ok {
		return wt, nil
	}
	wt := worktree.Worktree{
		TaskID:   itemID,
		RepoPath: repo.Path,
		Path:     worktree.Path(m.dataDir, repo.Owner, repo.Name, dirName),
		Base:     "origin/" + baseBranch,
	}
	m.items[itemID] = wt
	return wt, nil
}

func (m *memWorktrees) UpdateDetached(_ context.Context, wt worktree.Worktree, headBranch string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "updateDetached:"+wt.TaskID+":"+headBranch)
	err := m.updateErr
	if m.updateOnce {
		m.updateErr, m.updateOnce = nil, false
	}
	return err
}

func (m *memWorktrees) Status(_ context.Context, wt worktree.Worktree) (git.Status, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "status:"+wt.TaskID)
	if m.statusErr != nil {
		return git.Status{}, m.statusErr
	}
	return git.Status{Head: m.head}, nil
}

func (m *memWorktrees) Commit(_ context.Context, _ worktree.Worktree, rev string) (git.Commit, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.commitErr != nil {
		return git.Commit{}, m.commitErr
	}
	return git.Commit{SHA: rev, Subject: "Fix the time zone rule"}, nil
}

func (m *memWorktrees) Clean(_ context.Context, wt worktree.Worktree) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "clean:"+wt.TaskID)
	return nil
}

func (m *memWorktrees) Remove(_ context.Context, itemID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "remove:"+itemID)
	if m.removeErr != nil {
		return m.removeErr
	}
	delete(m.items, itemID)
	return nil
}

// failEnsure makes every creation of a worktree fail with err.
func (m *memWorktrees) failEnsure(err error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.ensureErr = err
}

// failUpdate makes every update of a worktree fail with err; once says the
// failure is spent on the next call, as a worktree that is cleaned up is.
func (m *memWorktrees) failUpdate(err error, once bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.updateErr, m.updateOnce = err, once
}

// failRemove makes every removal of a worktree fail with err.
func (m *memWorktrees) failRemove(err error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.removeErr = err
}

// moveHead puts the worktree on another commit, as a commit the agent made
// does.
func (m *memWorktrees) moveHead(head string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.head = head
}

// failStatus makes every reading of a worktree fail with err.
func (m *memWorktrees) failStatus(err error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.statusErr = err
}

// recorded returns the calls the fake took, in order.
func (m *memWorktrees) recorded() []string {
	m.mu.Lock()
	defer m.mu.Unlock()

	return slices.Clone(m.calls)
}

// memPulls is an in-memory reviewflow.Pulls: it answers with the pull
// requests a test seeded, and with the failure it was told to.
type memPulls struct {
	mu        sync.Mutex
	viewer    string
	details   map[pulls.Ref]pulls.Detail
	err       error
	refreshes int
	reads     int           // the readings of GitHub that went out
	asked     [][]pulls.Ref // the pull requests each of them asked for
	// hold, when set, is what a reading waits on after it took its answer, and
	// entered says that a reading got there.
	hold    chan struct{}
	entered chan struct{}
}

func newPulls() *memPulls {
	return &memPulls{viewer: viewer, details: map[pulls.Ref]pulls.Detail{}}
}

func (m *memPulls) Viewer() string {
	m.mu.Lock()
	defer m.mu.Unlock()

	return m.viewer
}

func (m *memPulls) ReadDetails(_ context.Context, refs []pulls.Ref) (map[pulls.Ref]pulls.Detail, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.reads++
	m.asked = append(m.asked, slices.Clone(refs))
	if m.err != nil {
		return nil, m.err
	}
	found := map[pulls.Ref]pulls.Detail{}
	for _, ref := range refs {
		if detail, ok := m.details[ref]; ok {
			found[ref] = detail
		}
	}
	if m.hold != nil {
		hold, entered := m.hold, m.entered
		m.mu.Unlock()
		entered <- struct{}{}
		<-hold
		m.mu.Lock()
	}
	return found, nil
}

// holdReadings makes the next readings wait, after taking the answer they
// give, until the returned function lets them go; the channel receives one
// value for every reading that started waiting.
func (m *memPulls) holdReadings() (release func(), entered <-chan struct{}) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.hold, m.entered = make(chan struct{}), make(chan struct{}, 8)
	hold := m.hold
	var once sync.Once
	return func() { once.Do(func() { close(hold) }) }, m.entered
}

func (m *memPulls) Refresh() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.refreshes++
}

// seed is the pull request every reading of it answers with.
func (m *memPulls) seed(detail pulls.Detail) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.details[pulls.Ref{Owner: detail.Owner, Name: detail.Name, Number: detail.Number}] = detail
}

// readings is how many readings of GitHub went out.
func (m *memPulls) readings() int {
	m.mu.Lock()
	defer m.mu.Unlock()

	return m.reads
}

// refsRead is the pull requests every reading of GitHub asked for, in order.
func (m *memPulls) refsRead() [][]pulls.Ref {
	m.mu.Lock()
	defer m.mu.Unlock()

	return slices.Clone(m.asked)
}

// forget drops a pull request, which is one GitHub answers nothing for.
func (m *memPulls) forget(number int) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for ref := range m.details {
		if ref.Number == number {
			delete(m.details, ref)
		}
	}
}

// failWith makes every reading fail with err.
func (m *memPulls) failWith(err error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.err = err
}

// memBoards is an in-memory reviewflow.Boards: the card a test linked to a
// pull request, if any.
type memBoards struct {
	mu      sync.Mutex
	boardID string
	card    *board.Card
	number  int // the pull request the card is linked to
}

func newBoards() *memBoards { return &memBoards{} }

func (m *memBoards) CardOfPullRequest(_, _ string, number int) (string, board.Card, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.card == nil || m.number != number {
		return "", board.Card{}, false
	}
	return m.boardID, *m.card, true
}

// link is the card the pull request was opened for.
func (m *memBoards) link(number int, card board.Card) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.boardID, m.card, m.number = "board-1", &card, number
}

// memWatch is an in-memory reviewflow.Watcher: it hands out the reading a
// test seeded and records what it was told to watch.
type memWatch struct {
	mu      sync.Mutex
	calls   []string
	snap    review.Snapshot
	has     bool
	tracked map[string]bool
}

func newWatch() *memWatch { return &memWatch{tracked: map[string]bool{}} }

func (m *memWatch) Track(itemID string, wt worktree.Worktree, active bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "track:"+itemID+":"+filepath.Base(wt.Path)+":"+strconv.FormatBool(active))
	m.tracked[itemID] = active
}

func (m *memWatch) Refresh(itemID string) (review.Snapshot, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "refresh:"+itemID)
	return m.snap, m.has
}

func (m *memWatch) Snapshot(string) (review.Snapshot, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	return m.snap, m.has
}

func (m *memWatch) Forget(itemID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "forget:"+itemID)
	delete(m.tracked, itemID)
}

// recorded returns the calls the fake took, in order.
func (m *memWatch) recorded() []string {
	m.mu.Lock()
	defer m.mu.Unlock()

	return slices.Clone(m.calls)
}

// setSnapshot makes every reading of a worktree answer with snap.
func (m *memWatch) setSnapshot(snap review.Snapshot) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.snap, m.has = snap, true
}

// memGH is an in-memory reviewflow.GH: the diff a test seeded and the
// reviews it was asked to publish.
type memGH struct {
	mu        sync.Mutex
	diff      string
	url       string
	inputs    []gh.ReviewInput
	diffErr   error
	createErr error
}

func newGH() *memGH { return &memGH{url: "https://github.com/dev/web/pull/42#pullrequestreview-1"} }

func (m *memGH) PRDiff(_ context.Context, _, _ string, _ int) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.diffErr != nil {
		return "", m.diffErr
	}
	return m.diff, nil
}

func (m *memGH) CreateReview(_ context.Context, _, _ string, _ int, in gh.ReviewInput) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.createErr != nil {
		return "", m.createErr
	}
	m.inputs = append(m.inputs, in)
	return m.url, nil
}

// memReviewStore is an in-memory prreview.Store, which answers with the
// failures it was told to.
type memReviewStore struct {
	mu        sync.Mutex
	reviews   []prreview.Review
	passes    map[string][]prreview.Pass
	updateErr error // returned by every update of a review
	upsertErr error // returned by every write of a pass
}

func newReviewStore() *memReviewStore {
	return &memReviewStore{passes: map[string][]prreview.Pass{}}
}

func (m *memReviewStore) ListActive(context.Context) ([]prreview.Review, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	var out []prreview.Review
	for _, stored := range m.reviews {
		if !stored.Archived() {
			out = append(out, stored)
		}
	}
	return out, nil
}

func (m *memReviewStore) ListArchived(context.Context) ([]prreview.Review, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	var out []prreview.Review
	for _, stored := range m.reviews {
		if stored.Archived() {
			out = append(out, stored)
		}
	}
	return out, nil
}

func (m *memReviewStore) Insert(_ context.Context, stored prreview.Review) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.reviews = append(m.reviews, stored)
	return nil
}

// failUpdate makes every update of a review fail with err; nil heals it.
func (m *memReviewStore) failUpdate(err error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.updateErr = err
}

// failUpsertPass makes every write of a pass fail with err; nil heals it.
func (m *memReviewStore) failUpsertPass(err error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.upsertErr = err
}

func (m *memReviewStore) Update(_ context.Context, stored prreview.Review) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.updateErr != nil {
		return m.updateErr
	}
	index := m.indexOf(stored.ID)
	if index < 0 {
		return os.ErrNotExist
	}
	archivedAt := m.reviews[index].ArchivedAt
	m.reviews[index] = stored
	m.reviews[index].ArchivedAt = archivedAt
	return nil
}

func (m *memReviewStore) UpdateArchived(_ context.Context, id string, archivedAt, updatedAt time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	index := m.indexOf(id)
	if index < 0 {
		return os.ErrNotExist
	}
	m.reviews[index].ArchivedAt, m.reviews[index].UpdatedAt = archivedAt, updatedAt
	return nil
}

func (m *memReviewStore) Delete(_ context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if index := m.indexOf(id); index >= 0 {
		m.reviews = slices.Delete(m.reviews, index, index+1)
	}
	delete(m.passes, id)
	return nil
}

func (m *memReviewStore) Passes(_ context.Context, reviewID string) ([]prreview.Pass, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	return slices.Clone(m.passes[reviewID]), nil
}

func (m *memReviewStore) UpsertPass(_ context.Context, pass prreview.Pass) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.upsertErr != nil {
		return m.upsertErr
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

func (m *memReviewStore) DeletePass(_ context.Context, reviewID string, pass int) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.passes[reviewID] = slices.DeleteFunc(m.passes[reviewID],
		func(p prreview.Pass) bool { return p.Number == pass })
	return nil
}

func (m *memReviewStore) WritePass(_ context.Context, pass prreview.Pass, stored *prreview.Review) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if stored != nil {
		index := m.indexOf(stored.ID)
		if index < 0 {
			return os.ErrNotExist
		}
		archivedAt := m.reviews[index].ArchivedAt
		m.reviews[index] = *stored
		m.reviews[index].ArchivedAt = archivedAt
	}
	passes := m.passes[pass.ReviewID]
	pass.Findings = slices.Clone(pass.Findings)
	index := slices.IndexFunc(passes, func(p prreview.Pass) bool { return p.Number == pass.Number })
	if index < 0 {
		passes = append(passes, pass)
		slices.SortFunc(passes, func(a, b prreview.Pass) int { return a.Number - b.Number })
	} else {
		passes[index] = pass
	}
	m.passes[pass.ReviewID] = passes
	return nil
}

func (m *memReviewStore) UpdateFinding(
	_ context.Context, reviewID string, pass int, finding prreview.Finding,
) error {
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

func (m *memReviewStore) UpdateFindingTitles(_ context.Context, reviewID string, pass int, titles map[int]string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	index := slices.IndexFunc(m.passes[reviewID], func(p prreview.Pass) bool { return p.Number == pass })
	if index < 0 {
		return os.ErrNotExist
	}
	findings := m.passes[reviewID][index].Findings
	for i := range findings {
		if title, ok := titles[findings[i].Number]; ok {
			findings[i].Title = title
		}
	}
	return nil
}

// indexOf is the position of a review, -1 when it is not stored. The caller
// holds the mutex.
func (m *memReviewStore) indexOf(id string) int {
	return slices.IndexFunc(m.reviews, func(r prreview.Review) bool { return r.ID == id })
}

// memRepoStore is an in-memory repository.Store holding the registered
// repositories of the test.
type memRepoStore struct {
	mu    sync.Mutex
	items []repository.Repository
}

func (m *memRepoStore) List(context.Context) ([]repository.Repository, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	return slices.Clone(m.items), nil
}

func (m *memRepoStore) Insert(_ context.Context, repo repository.Repository) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.items = append(m.items, repo)
	return nil
}

func (m *memRepoStore) UpdatePath(_ context.Context, id, path string) error {
	return m.update(id, func(repo *repository.Repository) { repo.Path = path })
}

func (m *memRepoStore) UpdateBoard(_ context.Context, id, boardID string) error {
	return m.update(id, func(repo *repository.Repository) { repo.BoardID = boardID })
}

func (m *memRepoStore) UpdateReviewInstructions(_ context.Context, id, text string) error {
	return m.update(id, func(repo *repository.Repository) { repo.ReviewInstructions = text })
}

func (m *memRepoStore) Delete(_ context.Context, id string) error {
	return m.update(id, func(repo *repository.Repository) { repo.ID = "" })
}

// update changes one registered repository, failing when it is not stored.
func (m *memRepoStore) update(id string, mutate func(*repository.Repository)) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	index := slices.IndexFunc(m.items, func(r repository.Repository) bool { return r.ID == id })
	if index < 0 {
		return os.ErrNotExist
	}
	mutate(&m.items[index])
	return nil
}

// memSettings is an in-memory repository.Settings.
type memSettings struct {
	mu     sync.Mutex
	values map[string]string
}

func (m *memSettings) Get(_ context.Context, key string) (string, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	value, ok := m.values[key]
	return value, ok, nil
}

func (m *memSettings) Set(_ context.Context, key, value string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.values[key] = value
	return nil
}

// clonedRepository is the registered repository of the tests, with a clone on
// disk: the review of a pull request is refused without one.
func clonedRepository(t *testing.T) repository.Repository {
	t.Helper()

	path := filepath.Join(t.TempDir(), "web")
	if err := os.MkdirAll(filepath.Join(path, ".git"), 0o750); err != nil {
		t.Fatalf("create clone: %v", err)
	}
	return repository.Repository{
		ID: repoID, Owner: "dev", Name: "web", Path: path,
		ReviewInstructions: "never change a published migration",
	}
}

// registered is a repository.Service holding the repository given and one
// registered repository with no clone of its own.
func registered(t *testing.T, repo repository.Repository) *repository.Service {
	t.Helper()

	bare := repository.Repository{ID: bareID, Owner: "dev", Name: "api"}
	service := repository.New(repository.Deps{
		Store:    &memRepoStore{items: []repository.Repository{repo, bare}},
		Settings: &memSettings{values: map[string]string{}},
		Now:      func() time.Time { return base },
	})
	if err := service.Sync(t.Context()); err != nil {
		t.Fatalf("sync repositories: %v", err)
	}
	return service
}

// fixture is a reviewflow.Service over the fakes, with the real services of
// the reviews and of the repositories behind it.
type fixture struct {
	service      *reviewflow.Service
	reviews      *prreview.Service
	store        *memReviewStore
	repositories *repository.Service
	repo         repository.Repository
	sessions     *memSessions
	worktrees    *memWorktrees
	pulls        *memPulls
	boards       *memBoards
	watch        *memWatch
	gh           *memGH
	dataDir      string

	mu      sync.Mutex
	taskPRs []reviewflow.TaskPR
	changes []string // the reviews the flow announced a change of, in order
	ids     int
	clock   time.Time
}

func newFixture(t *testing.T) *fixture {
	t.Helper()

	f := &fixture{
		store:    newReviewStore(),
		sessions: newSessions(),
		pulls:    newPulls(),
		boards:   newBoards(),
		watch:    newWatch(),
		gh:       newGH(),
		dataDir:  t.TempDir(),
		clock:    base,
	}
	f.worktrees = newWorktrees(f.dataDir)
	f.repo = clonedRepository(t)
	f.repositories = registered(t, f.repo)
	f.reviews = prreview.New(prreview.Deps{
		Store:        f.store,
		DataDir:      f.dataDir,
		Repositories: f.repositories.Get,
		Now:          f.now,
		NewID:        f.newID,
	})
	f.service = f.newService(t)
	f.pulls.seed(openPR())
	return f
}

// newService builds a reviewflow.Service over the fakes of the fixture, which
// is how a test brings the app up again after a restart.
func (f *fixture) newService(t *testing.T) *reviewflow.Service {
	t.Helper()

	service := reviewflow.New(reviewflow.Deps{
		Reviews:      f.reviews,
		Pulls:        f.pulls,
		Sessions:     f.sessions,
		Worktrees:    f.worktrees,
		Repositories: f.repositories,
		Boards:       f.boards,
		Watch:        f.watch,
		GH:           f.gh,
		Tasks:        f.tasks,
		RenderPrompt: func(stage prompts.Stage, vars prompts.Vars) (string, error) {
			if stage != prompts.StageCommit {
				return "", errors.New("unexpected prompt stage " + string(stage))
			}
			return "Commit the work of " + vars.TaskName + " in " + vars.ArtifactsDir +
				", push=" + strconv.FormatBool(vars.Push) + " to " + vars.PushRef, nil
		},
		OnChange: f.onChange,
	})
	t.Cleanup(service.Close)
	return service
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

func (f *fixture) onChange(id string) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.changes = append(f.changes, id)
}

// changed is the reviews the flow announced a change of, in order.
func (f *fixture) changed() []string {
	f.mu.Lock()
	defer f.mu.Unlock()

	return slices.Clone(f.changes)
}

func (f *fixture) tasks() []reviewflow.TaskPR {
	f.mu.Lock()
	defer f.mu.Unlock()

	return slices.Clone(f.taskPRs)
}

// ownTaskPR says the pull request belongs to an active task of the product.
func (f *fixture) ownTaskPR(number int) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.taskPRs = append(f.taskPRs, reviewflow.TaskPR{
		TaskID: "task-1", RepositoryID: repoID, Number: number,
	})
}

// openPR is the pull request of another person the tests review.
func openPR() pulls.Detail {
	return pulls.Detail{
		PullRequest: pulls.PullRequest{
			Owner:      "dev",
			Name:       "web",
			Number:     prNumber,
			Title:      "Cache the board readings",
			URL:        "https://github.com/dev/web/pull/42",
			Author:     prAuthor,
			HeadBranch: "cache-boards",
			HeadCommit: headHash,
			BaseBranch: "main",
			Body:       "Keeps the last reading of a board in memory.",
		},
		State:  "open",
		Checks: gh.PRChecks{Checks: []gh.Check{}, Mergeable: gh.MergeableClean},
	}
}

// checkURL is the link of the check of the pull request of the tests.
const checkURL = "https://github.com/dev/web/actions/runs/7/job/9"

// withChecks is a pull request whose head has the checks given, and merges
// into the base as mergeable says.
func withChecks(detail pulls.Detail, mergeable gh.Mergeable, checks ...gh.Check) pulls.Detail {
	detail.Checks = gh.PRChecks{Checks: append([]gh.Check{}, checks...), Mergeable: mergeable}
	return detail
}

// The checks the tests read: one that passed, one that failed and one still
// running.
var (
	passedCheck  = gh.Check{Name: "test", URL: checkURL, Conclusion: "success"}
	failedCheck  = gh.Check{Name: "lint", URL: checkURL, Conclusion: "failure"}
	pendingCheck = gh.Check{Name: "test", URL: checkURL, Pending: true}
)

// ownPR is the same pull request, opened by the user themselves, which is the
// only one apply mode is offered for.
func ownPR() pulls.Detail {
	detail := openPR()
	detail.Author = viewer
	return detail
}

// start reviews the pull request of the fixture in publish mode.
func (f *fixture) start(t *testing.T) string {
	t.Helper()

	return f.startMode(t, prreview.ModePublish, "look at the tests")
}

// startMode reviews the pull request of the fixture in a mode of the test's
// choosing.
func (f *fixture) startMode(t *testing.T, mode prreview.Mode, instructions string) string {
	t.Helper()

	id, err := f.service.Start(t.Context(), reviewflow.StartParams{
		RepositoryID: repoID,
		Number:       prNumber,
		Instructions: instructions,
		Choice:       models.Choice{Model: models.Opus55, Effort: models.High},
		Mode:         mode,
	})
	if err != nil {
		t.Fatalf("start review: %v", err)
	}
	return id
}

// writeReport puts the report of a pass in the folder of a review, as the
// agent would.
func (f *fixture) writeReport(t *testing.T, id string, pass int, content string) {
	t.Helper()

	stored, ok := f.reviews.Get(id)
	if !ok {
		t.Fatalf("review %s is not active", id)
	}
	if err := os.WriteFile(stored.ReportPath(pass), []byte(content), 0o600); err != nil {
		t.Fatalf("write report %d: %v", pass, err)
	}
}

// record is the report of a pass as the app already had it recorded.
func (f *fixture) record(t *testing.T, id string, report prreport.Report, commit string) {
	t.Helper()

	if _, _, err := f.reviews.RecordReport(t.Context(), id, report, commit); err != nil {
		t.Fatalf("record report: %v", err)
	}
}

// decide is what the user decided about a finding of a pass.
func (f *fixture) decide(t *testing.T, id string, pass, number int, d prreview.Decision) {
	t.Helper()

	if err := f.reviews.Decide(t.Context(), id, pass, number, d); err != nil {
		t.Fatalf("decide finding %d: %v", number, err)
	}
}

// update writes a field of a review the flow only reads, which is what a
// reading of the pull request or a publication would have left behind.
func (f *fixture) update(t *testing.T, id string, mutate func(*prreview.Review)) {
	t.Helper()

	if _, err := f.reviews.Update(t.Context(), id, mutate); err != nil {
		t.Fatalf("update review: %v", err)
	}
}

// state is what the app shows about a review, failing the test when it has
// none.
func (f *fixture) state(t *testing.T, id string) reviewflow.State {
	t.Helper()

	state, ok := f.service.State(id)
	if !ok {
		t.Fatalf("review %s has no state", id)
	}
	return state
}

// pass is a pass of a review as the app holds it now.
func (f *fixture) pass(t *testing.T, id string, number int) prreview.Pass {
	t.Helper()

	for _, pass := range f.reviews.Passes(id) {
		if pass.Number == number {
			return pass
		}
	}
	t.Fatalf("review %s has no pass %d", id, number)
	return prreview.Pass{}
}

// evaluated asks for an evaluation of a review and waits for it to be over.
func (f *fixture) evaluated(t *testing.T, id string, cond func(reviewflow.State) bool, subject string) {
	t.Helper()

	f.service.Check(id)
	waitFor(t, subject, func() bool {
		state, ok := f.service.State(id)
		return ok && cond(state)
	})
}

// settleWait is how long a test that proves the flow did nothing gives an
// evaluation to run.
const settleWait = 100 * time.Millisecond

// settled asks for an evaluation of a review and gives it the time to run. It
// is the one place the tests sleep, because what they check is that nothing
// happened.
func (f *fixture) settled(t *testing.T, id string) {
	t.Helper()

	f.service.Check(id)
	time.Sleep(settleWait)
}

// sent is what the conversation of a review was told, in order.
func (m *memSessions) sent() []string {
	m.mu.Lock()
	defer m.mu.Unlock()

	return slices.Clone(m.messages)
}

// changesReport is a report with findings, as the agent writes it.
func changesReport(pass int, summary string, findings ...prreport.ParsedFinding) prreport.Report {
	return prreport.Report{Pass: pass, Summary: summary, Findings: findings}
}

// cleanReport is a report that found nothing to change.
func cleanReport(pass int, summary string) prreport.Report {
	return prreport.Report{Pass: pass, Clean: true, Summary: summary}
}

// reportFile is a report of a pass as the agent writes it to disk.
func reportFile(status, body string) string {
	return "---\nstatus: " + status + "\n---\n\n" + body + "\n"
}

// waitFor polls until cond holds, failing the test with subject when it never
// does. Evaluations run on their own goroutine, so tests wait instead of
// sleeping.
func waitFor(t *testing.T, subject string, cond func() bool) {
	t.Helper()

	deadline := time.Now().Add(pollTimeout)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(pollStep)
	}
	t.Fatalf("timed out waiting for %s", subject)
}

// wantErrIs fails the test unless err matches want.
func wantErrIs(t *testing.T, err, want error) {
	t.Helper()

	if !errors.Is(err, want) {
		t.Fatalf("error = %v, want %v", err, want)
	}
}
