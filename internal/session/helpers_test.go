package session_test

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/claude"
	"github.com/guilhermt/myspec/internal/claude/claudetest"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/session"
)

// base is the fixed instant the tests build their timestamps from.
var base = time.Date(2026, time.September, 6, 12, 0, 0, 0, time.UTC)

// pollTimeout and pollStep bound how long a test waits for the fake CLI, which
// runs as another process.
const (
	pollTimeout = 5 * time.Second
	pollStep    = 10 * time.Millisecond
)

// shutdownTimeout is how long a fixture gives its processes to leave.
const shutdownTimeout = 10 * time.Second

// renderPrompt is the prompt the tests send: the stage and every variable show
// up in it, so the echo of the fake tells whether the rendering happened. A
// step prompt goes through the real rendering, which reads the step file.
func renderPrompt(stage prompts.Stage, vars prompts.Vars) (string, error) {
	switch stage {
	case prompts.StageStep:
		return prompts.Render("", stage, vars)
	case prompts.StageStepReview:
		return fmt.Sprintf("Stage %s reviews %s after: %s", stage, vars.StepPath, vars.ImplementerReply), nil
	case prompts.StageOneShot:
		return fmt.Sprintf("Stage %s of task %s writes %s in %s from: %s",
			stage, vars.TaskName, vars.OneShotPath, vars.Repository, vars.InitialContext), nil
	case prompts.StagePRReview:
		rendered := fmt.Sprintf("Stage %s reviews %s (external %t, publish %t) with %q and %q",
			stage, vars.ContextPath, vars.External, vars.Publish, vars.Instructions, vars.PassInstructions)
		if vars.Checks != nil {
			rendered += "\n\n## GitHub status\n\n" + prompts.PRChecksSection(vars.Checks, vars.MergeBase)
		}
		return rendered, nil
	case prompts.StagePR:
		return fmt.Sprintf("Stage %s of task %s opens %s from %s, with the card %s: %s",
			stage, vars.TaskName, vars.Branch, vars.BaseBranch, vars.CardReference, vars.Card), nil
	default:
		return fmt.Sprintf("Stage %s of task %s writes %s in %s from: %s",
			stage, vars.TaskName, vars.PRDPath, vars.ArtifactsDir, vars.InitialContext), nil
	}
}

// memSessions is an in-memory session.SessionRepository, one record per stage
// of a task.
type memSessions struct {
	mu   sync.Mutex
	recs map[string]session.Record // by task id and stage
}

func newMemSessions() *memSessions {
	return &memSessions{recs: map[string]session.Record{}}
}

// key indexes a record by the task and stage it belongs to.
func key(taskID, stage string) string { return taskID + "/" + stage }

func (r *memSessions) Get(_ context.Context, taskID, stage string) (session.Record, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	rec, ok := r.recs[key(taskID, stage)]
	if !ok {
		return session.Record{}, fmt.Errorf("get %s session of task %s: %w", stage, taskID, session.ErrNotFound)
	}
	return rec, nil
}

func (r *memSessions) Insert(_ context.Context, rec session.Record) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.recs[key(rec.TaskID, rec.Stage)] = rec
	return nil
}

func (r *memSessions) Update(_ context.Context, rec session.Record) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.recs[key(rec.TaskID, rec.Stage)]; !ok {
		return fmt.Errorf("update session %s: %w", rec.ID, session.ErrNotFound)
	}
	r.recs[key(rec.TaskID, rec.Stage)] = rec
	return nil
}

func (r *memSessions) Delete(_ context.Context, taskID string, stages ...string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	for _, stage := range stages {
		delete(r.recs, key(taskID, stage))
	}
	return nil
}

func (r *memSessions) List(context.Context) ([]session.Record, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	out := slices.Collect(maps.Values(r.recs))
	slices.SortFunc(out, func(a, b session.Record) int {
		return cmp.Or(strings.Compare(a.TaskID, b.TaskID), a.CreatedAt.Compare(b.CreatedAt))
	})
	return out, nil
}

func (r *memSessions) DeleteByTask(_ context.Context, taskID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	for k, rec := range r.recs {
		if rec.TaskID == taskID {
			delete(r.recs, k)
		}
	}
	return nil
}

// get returns the stored record of a session key, failing the test when it is
// gone.
func (r *memSessions) get(t *testing.T, taskID, stage string) session.Record {
	t.Helper()

	rec, err := r.Get(t.Context(), taskID, stage)
	if err != nil {
		t.Fatalf("Get(%s, %s) = %v, want nil", taskID, stage, err)
	}
	return rec
}

// storedEntry is one row of the in-memory entry table. The payload is kept
// encoded, as the database does, so that the repository never shares memory
// with the service.
type storedEntry struct {
	sessionID string
	entry     session.Entry
	payload   []byte
}

// memEntries is an in-memory session.EntryRepository.
type memEntries struct {
	mu      sync.Mutex
	items   []storedEntry
	outputs map[string]session.Output
}

func (r *memEntries) List(_ context.Context, sessionID string) ([]session.Entry, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	var out []session.Entry
	for _, item := range r.items {
		if item.sessionID != sessionID {
			continue
		}
		e, err := session.UnmarshalPayload(item.entry.Kind, item.payload)
		if err != nil {
			return nil, err
		}
		e.ID = item.entry.ID
		e.Seq = item.entry.Seq
		e.TurnID = item.entry.TurnID
		e.CreatedAt = item.entry.CreatedAt
		out = append(out, e)
	}
	slices.SortStableFunc(out, func(a, b session.Entry) int { return a.Seq - b.Seq })
	return out, nil
}

func (r *memEntries) Insert(_ context.Context, sessionID string, e session.Entry) error {
	payload, err := e.MarshalPayload()
	if err != nil {
		return err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	if r.indexOf(e.ID) >= 0 {
		return fmt.Errorf("insert entry %s: duplicate id", e.ID)
	}
	r.items = append(r.items, storedEntry{sessionID: sessionID, entry: e, payload: payload})
	return nil
}

func (r *memEntries) Update(_ context.Context, e session.Entry) error {
	payload, err := e.MarshalPayload()
	if err != nil {
		return err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	index := r.indexOf(e.ID)
	if index < 0 {
		return fmt.Errorf("update entry %s: %w", e.ID, session.ErrNotFound)
	}
	r.items[index].entry = e
	r.items[index].payload = payload
	return nil
}

func (r *memEntries) Delete(_ context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if index := r.indexOf(id); index >= 0 {
		r.items = slices.Delete(r.items, index, index+1)
	}
	return nil
}

func (r *memEntries) MaxSeq(_ context.Context, sessionID string) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	maxSeq := 0
	for _, item := range r.items {
		if item.sessionID == sessionID {
			maxSeq = max(maxSeq, item.entry.Seq)
		}
	}
	return maxSeq, nil
}

func (r *memEntries) SaveOutput(_ context.Context, entryID string, o session.Output) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.outputs == nil {
		r.outputs = map[string]session.Output{}
	}
	r.outputs[entryID] = o
	return nil
}

func (r *memEntries) Output(_ context.Context, entryID string) (session.Output, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	o, ok := r.outputs[entryID]
	if !ok {
		return session.Output{}, fmt.Errorf("output of entry %s: %w", entryID, session.ErrNotFound)
	}
	return o, nil
}

// seed stores entries directly, bypassing the service.
func (r *memEntries) seed(t *testing.T, sessionID string, entries ...session.Entry) {
	t.Helper()

	for _, e := range entries {
		if err := r.Insert(t.Context(), sessionID, e); err != nil {
			t.Fatalf("seed entry %s: %v", e.ID, err)
		}
	}
}

// list returns the stored entries of a session, failing the test on error.
func (r *memEntries) list(t *testing.T, sessionID string) []session.Entry {
	t.Helper()

	entries, err := r.List(t.Context(), sessionID)
	if err != nil {
		t.Fatalf("List(%s) = %v, want nil", sessionID, err)
	}
	return entries
}

// indexOf finds a stored entry. The caller holds the mutex.
func (r *memEntries) indexOf(id string) int {
	return slices.IndexFunc(r.items, func(item storedEntry) bool { return item.entry.ID == id })
}

// fakeLauncher runs this test binary as the fake CLI playing one scenario. It
// records every Config it started, and fails where a test tells it to.
type fakeLauncher struct {
	scenario string
	env      []string // extra environment of the fake, as KEY=value

	mu           sync.Mutex
	locateErr    error
	preflightErr error
	starts       []claude.Config
}

func (l *fakeLauncher) Locate() (string, error) {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.locateErr != nil {
		return "", l.locateErr
	}
	return os.Args[0], nil
}

func (l *fakeLauncher) Preflight(_ context.Context, _ string) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	return l.preflightErr
}

func (l *fakeLauncher) Start(ctx context.Context, cfg claude.Config) (session.Process, error) {
	l.mu.Lock()
	l.starts = append(l.starts, cfg)
	l.mu.Unlock()

	cfg.Env = append(os.Environ(),
		claudetest.EnvFlag+"=1",
		claudetest.EnvScenario+"="+l.scenario,
	)
	cfg.Env = append(cfg.Env, l.env...)
	p, err := claude.Start(ctx, cfg, slog.New(slog.DiscardHandler))
	if err != nil {
		return nil, err
	}
	return p, nil
}

// fix clears the failures so the next start succeeds.
func (l *fakeLauncher) fix() {
	l.mu.Lock()
	defer l.mu.Unlock()

	l.locateErr = nil
	l.preflightErr = nil
}

// started returns the configs of every process started so far.
func (l *fakeLauncher) started() []claude.Config {
	l.mu.Lock()
	defer l.mu.Unlock()

	return slices.Clone(l.starts)
}

// fixture is a Service with its collaborators, ready to assert on.
type fixture struct {
	service  *session.Service
	sessions *memSessions
	entries  *memEntries
	launcher *fakeLauncher

	mu     sync.Mutex
	now    time.Time
	states []session.Key
	events []session.TranscriptEvent
}

// prd is the session key of a task in the PRD stage, which is where most of
// these tests keep theirs.
func prd(taskID string) session.Key {
	return session.Key{TaskID: taskID, Stage: string(prompts.StagePRD)}
}

// newFixture builds a Service whose processes play one fake scenario.
func newFixture(t *testing.T, scenario string) *fixture {
	t.Helper()

	return newFixtureWith(t, &fakeLauncher{scenario: scenario}, 0)
}

// newFixtureWith builds a Service over a given launcher and idle timeout, 0
// meaning the default.
func newFixtureWith(t *testing.T, launcher *fakeLauncher, idle time.Duration) *fixture {
	t.Helper()

	f := &fixture{
		sessions: newMemSessions(),
		entries:  &memEntries{},
		launcher: launcher,
		now:      base,
	}
	f.build(t, idle)
	return f
}

// restart builds a new Service over the records of this one, as a new run of
// the app finds them.
func (f *fixture) restart(t *testing.T) *fixture {
	t.Helper()

	next := &fixture{sessions: f.sessions, entries: f.entries, launcher: f.launcher, now: f.clock()}
	next.build(t, 0)
	return next
}

// build creates the Service of a fixture over its collaborators.
func (f *fixture) build(t *testing.T, idle time.Duration) {
	t.Helper()

	var ids int
	var idMu sync.Mutex
	f.service = session.New(session.Deps{
		Sessions:     f.sessions,
		Entries:      f.entries,
		Launcher:     f.launcher,
		RenderPrompt: renderPrompt,
		Log:          slog.New(slog.DiscardHandler),
		Now:          f.clock,
		NewID: func() string {
			idMu.Lock()
			defer idMu.Unlock()
			ids++
			return "id-" + strconv.Itoa(ids)
		},
		IdleTimeout:  idle,
		OnState:      f.onState,
		OnTranscript: f.onTranscript,
	})
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()
		f.service.Shutdown(ctx)
	})
}

// clock is the fixture's time, base until a test advances it.
func (f *fixture) clock() time.Time {
	f.mu.Lock()
	defer f.mu.Unlock()

	return f.now
}

// advance moves the fixture's clock forward.
func (f *fixture) advance(d time.Duration) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.now = f.now.Add(d)
}

// newGatedFixture builds a Service whose processes play the actions scenario,
// held at each gate until the test opens it.
func newGatedFixture(t *testing.T) (*fixture, func(gates ...string)) {
	t.Helper()

	dir := t.TempDir()
	f := newFixtureWith(t, &fakeLauncher{
		scenario: "actions",
		env:      []string{claudetest.EnvGates + "=" + dir},
	}, 0)
	open := func(gates ...string) {
		t.Helper()
		for _, g := range gates {
			if err := os.WriteFile(filepath.Join(dir, g), nil, 0o600); err != nil {
				t.Fatalf("open gate %s: %v", g, err)
			}
		}
	}
	return f, open
}

func (f *fixture) onState(k session.Key) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.states = append(f.states, k)
}

func (f *fixture) onTranscript(ev session.TranscriptEvent) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.events = append(f.events, ev)
}

// stateCount returns how many times OnState ran for a session.
func (f *fixture) stateCount(k session.Key) int {
	f.mu.Lock()
	defer f.mu.Unlock()

	total := 0
	for _, state := range f.states {
		if state == k {
			total++
		}
	}
	return total
}

// eventsOf returns the transcript events of a session with the given kind, in
// order.
func (f *fixture) eventsOf(k session.Key, kind session.EventKind) []session.TranscriptEvent {
	f.mu.Lock()
	defer f.mu.Unlock()

	var out []session.TranscriptEvent
	for _, ev := range f.events {
		if ev.TaskID == k.TaskID && ev.Stage == k.Stage && ev.Kind == kind {
			out = append(out, ev)
		}
	}
	return out
}

// textsOf returns every streamed text of an entry, in order.
func (f *fixture) textsOf(k session.Key, entryID string) []string {
	var out []string
	for _, ev := range f.eventsOf(k, session.EventText) {
		if ev.EntryID == entryID {
			out = append(out, ev.Text)
		}
	}
	return out
}

// taskInfo describes a task in its PRD stage, whose working directory is a
// fresh temporary one.
func taskInfo(t *testing.T, id string) session.TaskInfo {
	t.Helper()

	artifacts := t.TempDir()
	return session.TaskInfo{
		ID:             id,
		Name:           "login-screen",
		Dir:            t.TempDir(),
		ArtifactsDir:   artifacts,
		Stage:          string(prompts.StagePRD),
		Prompt:         prompts.StagePRD,
		PRDPath:        filepath.Join(artifacts, "PRD.md"),
		TechSpecPath:   filepath.Join(artifacts, "tech-spec.md"),
		StepsDir:       filepath.Join(artifacts, "steps"),
		Repository:     "dev/web",
		InitialContext: "a login screen with email and password",
		Choice:         models.Choice{Model: models.Opus55, Effort: models.High},
	}
}

// atStage is the same task moved on to another stage.
func atStage(info session.TaskInfo, stage prompts.Stage) session.TaskInfo {
	info.Stage = string(stage)
	info.Prompt = stage
	return info
}

// atReview is the same item as the review of a pull request that comes from no
// task, in publish mode, with what the user wrote for the first pass.
func atReview(info session.TaskInfo) session.TaskInfo {
	info = atStage(info, prompts.StagePRReview)
	info.Stage = session.ReviewStage
	info.ContextPath = filepath.Join(info.ArtifactsDir, "context.md")
	info.External, info.Publish = true, true
	info.Instructions = "Never change a published migration."
	info.PassInstructions = "Look at the cache."
	return info
}

// atDiscussion is the same item as a discussion of a board, with the two files
// the agent writes and the clones of the board it may read.
func atDiscussion(t *testing.T, info session.TaskInfo) session.TaskInfo {
	t.Helper()

	info = atStage(info, prompts.StageDiscussion)
	info.Stage = session.DiscussionStage
	info.DocumentPath = filepath.Join(info.ArtifactsDir, "discussion.md")
	info.DraftsPath = filepath.Join(info.ArtifactsDir, "drafts.md")
	info.Board = "## Board\n\n- Board: Roadmap"
	info.ExtraDirs = []string{t.TempDir(), t.TempDir()}
	return info
}

// atOneShot is the same task created One-Shot in the repository api, in its
// planning: the prompt names the document and the repository.
func atOneShot(info session.TaskInfo) session.TaskInfo {
	info = atStage(info, prompts.StageOneShot)
	info.OneShotPath = filepath.Join(info.ArtifactsDir, "one-shot.md")
	info.Repository = "api"
	return info
}

// atStep is the same task implementing a step: the session key is the step's,
// the prompt is the file written in dir, which is also where the CLI runs.
func atStep(t *testing.T, info session.TaskInfo, number int, content string) session.TaskInfo {
	t.Helper()

	dir := t.TempDir()
	path := filepath.Join(dir, "step.md")
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write step file: %v", err)
	}

	info.Dir = dir
	info.Stage = session.StepStage(number)
	info.Prompt = prompts.StageStep
	info.Step = number
	info.StepPath = path
	return info
}

// atStepReview is the same task reviewing a step: the session key is the one
// of the reviewer, which runs in a worktree of its own and hears reply from
// the implementer.
func atStepReview(t *testing.T, info session.TaskInfo, number int, reply string) session.TaskInfo {
	t.Helper()

	info.Dir = t.TempDir()
	info.Stage = session.StepReviewStage(number)
	info.Prompt = prompts.StageStepReview
	info.Step = number
	info.StepPath = filepath.Join(t.TempDir(), "step.md")
	info.ImplementerReply = reply
	return info
}

// start opens the session of a stage and queues its prompt.
func (f *fixture) start(t *testing.T, info session.TaskInfo) {
	t.Helper()

	if err := f.service.Start(t.Context(), info, false); err != nil {
		t.Fatalf("Start(%s) = %v, want nil", info.ID, err)
	}
}

// open loads the session of an existing task.
func (f *fixture) open(t *testing.T, info session.TaskInfo) {
	t.Helper()

	if err := f.service.Open(t.Context(), info); err != nil {
		t.Fatalf("Open(%s) = %v, want nil", info.ID, err)
	}
}

// send queues a message, failing the test when the service refuses it.
func (f *fixture) send(t *testing.T, k session.Key, text string) {
	t.Helper()

	if err := f.service.Send(t.Context(), k, text); err != nil {
		t.Fatalf("Send(%v, %q) = %v, want nil", k, text, err)
	}
}

// summary returns the summary of a session, failing the test when it is not
// open.
func (f *fixture) summary(t *testing.T, k session.Key) session.Summary {
	t.Helper()

	sum, ok := f.service.Summary(k)
	if !ok {
		t.Fatalf("Summary(%v) not found", k)
	}
	return sum
}

// transcript returns the conversation of a session, failing the test on error.
func (f *fixture) transcript(t *testing.T, k session.Key) session.Transcript {
	t.Helper()

	tr, err := f.service.Transcript(t.Context(), k)
	if err != nil {
		t.Fatalf("Transcript(%v) = %v, want nil", k, err)
	}
	return tr
}

// entriesOf returns the delivered entries of a session with the given kind.
func (f *fixture) entriesOf(t *testing.T, k session.Key, kind session.Kind) []session.Entry {
	t.Helper()

	var out []session.Entry
	for _, e := range f.transcript(t, k).Entries {
		if e.Kind == kind {
			out = append(out, e)
		}
	}
	return out
}

// waitStatus waits until the summary of a session satisfies cond.
func (f *fixture) waitStatus(
	t *testing.T, k session.Key, subject string, cond func(session.Summary) bool,
) session.Summary {
	t.Helper()

	var sum session.Summary
	waitFor(t, subject, func() bool {
		sum = f.summary(t, k)
		return cond(sum)
	})
	return sum
}

// waitIdle waits until the turn of a session is over and the process waits for
// the next message.
func (f *fixture) waitIdle(t *testing.T, k session.Key) session.Summary {
	t.Helper()

	return f.waitStatus(t, k, "the turn to end", func(s session.Summary) bool {
		return s.Status == session.StatusWaiting && s.ProcessRunning
	})
}

// waitEntries waits until a session has at least n delivered entries of a kind.
func (f *fixture) waitEntries(t *testing.T, k session.Key, kind session.Kind, n int) []session.Entry {
	t.Helper()

	var entries []session.Entry
	waitFor(t, fmt.Sprintf("%d %s entries", n, kind), func() bool {
		entries = f.entriesOf(t, k, kind)
		return len(entries) >= n
	})
	return entries
}

// waitFor polls until cond holds, failing the test with subject when it never
// does.
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
