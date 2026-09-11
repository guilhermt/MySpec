package attention_test

import (
	"bytes"
	"cmp"
	"context"
	"encoding/json"
	"log/slog"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/attention"
	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

// The task every input is about, in a workspace with a repository api.
const (
	taskID    = "task-1"
	taskName  = "login-screen"
	workspace = "/home/u/code"
	apiPath   = workspace + "/api"
)

// summary is a session in a status, at rest or not.
func summary(status session.Status, idle bool) session.Summary {
	return session.Summary{TaskID: taskID, Status: status, Idle: idle}
}

// stageInput is the task in a planning stage with what its folder holds, and
// the session of the stage when one is given.
func stageInput(stage task.Stage, a task.Artifacts, sum ...session.Summary) attention.Input {
	in := attention.Input{
		Task:      task.Task{ID: taskID, Name: taskName, WorkspacePath: workspace, Stage: stage},
		Artifacts: a,
		Sessions:  map[session.Key]session.Summary{},
	}
	if len(sum) > 0 {
		in.Sessions[session.Key{TaskID: taskID, Stage: string(stage)}] = sum[0]
	}
	return in
}

// stepInput is the task in implementation with two steps of api: the first one
// committed and the second one in the state given, with the session of the
// second one when one is given.
func stepInput(second flow.StepState, sum ...session.Summary) attention.Input {
	second.Step = task.Step{Number: 2, File: "2-login-form.md", Title: "Login form", Repository: "api", RepoPath: apiPath}
	in := attention.Input{
		Task: task.Task{ID: taskID, Name: taskName, WorkspacePath: workspace, Stage: task.StageImplementation},
		Steps: []flow.StepState{
			{
				Step:   task.Step{Number: 1, File: "1-session-api.md", Title: "Session API", Repository: "api", RepoPath: apiPath},
				Status: flow.StepDone,
			},
			second,
		},
		Sessions: map[session.Key]session.Summary{},
	}
	if len(sum) > 0 {
		in.Sessions[session.Key{TaskID: taskID, Stage: session.StepStage(2)}] = sum[0]
	}
	return in
}

// repoInput is the task in the PR stage with the repositories given, in order.
func repoInput(repos ...flow.RepoState) attention.Input {
	return attention.Input{
		Task:     task.Task{ID: taskID, Name: taskName, WorkspacePath: workspace, Stage: task.StagePR},
		Repos:    repos,
		Sessions: map[session.Key]session.Summary{},
	}
}

// base is the instant the clock of every service starts at.
var base = time.Date(2026, time.September, 11, 9, 0, 0, 0, time.UTC)

// The places of a task the service tests hold situations at.
var (
	prdPlace  = attention.Place{Kind: attention.PlaceStage, Stage: task.StagePRD}
	stepPlace = attention.Place{Kind: attention.PlaceStep, Step: 2}
)

// repoPlace is the place of a repository of the workspace, by its name.
func repoPlace(name string) attention.Place {
	return attention.Place{Kind: attention.PlaceRepo, RepoPath: workspace + "/" + name, Repository: name}
}

// found is what a derivation sees at a place of the task with the given id: a
// situation of a kind, with a notification that names both.
func found(id string, place attention.Place, kind attention.Kind) attention.Found {
	return attention.Found{
		TaskID: id,
		Place:  place,
		Kind:   kind,
		Title:  taskName,
		Body:   string(kind) + " at " + place.Key(),
	}
}

// memStore is an in-memory attention.Store that records the writes asked of
// it, upsert:<task>:<place>:<id> and delete:<task>:<place>, and fails every
// call with err when it is set.
type memStore struct {
	records map[string]attention.Record // by task id and place
	calls   []string
	err     error
}

func newMemStore() *memStore {
	return &memStore{records: map[string]attention.Record{}}
}

// seed stores records as a run of the app before left them.
func (m *memStore) seed(recs ...attention.Record) {
	for _, rec := range recs {
		m.records[rec.TaskID+"|"+rec.Place] = rec
	}
}

func (m *memStore) ListByTasks(_ context.Context, taskIDs []string) ([]attention.Record, error) {
	if m.err != nil {
		return nil, m.err
	}
	var list []attention.Record
	for _, rec := range m.records {
		if slices.Contains(taskIDs, rec.TaskID) {
			list = append(list, rec)
		}
	}
	slices.SortFunc(list, func(a, b attention.Record) int {
		return cmp.Or(strings.Compare(a.TaskID, b.TaskID), strings.Compare(a.Place, b.Place))
	})
	return list, nil
}

func (m *memStore) Upsert(_ context.Context, rec attention.Record) error {
	m.calls = append(m.calls, "upsert:"+rec.TaskID+":"+rec.Place+":"+rec.ID)
	if m.err != nil {
		return m.err
	}
	m.seed(rec)
	return nil
}

func (m *memStore) Delete(_ context.Context, taskID, place string) error {
	m.calls = append(m.calls, "delete:"+taskID+":"+place)
	if m.err != nil {
		return m.err
	}
	delete(m.records, taskID+"|"+place)
	return nil
}

// memNotifier is an attention.Notifier that records what it is asked:
// send:<id>:<title>:<body> and withdraw:<id>.
type memNotifier struct {
	calls []string
}

func (m *memNotifier) Send(id, title, body string) {
	m.calls = append(m.calls, "send:"+id+":"+title+":"+body)
}

func (m *memNotifier) Withdraw(id string) {
	m.calls = append(m.calls, "withdraw:"+id)
}

// clock is a clock the test moves by hand.
type clock struct {
	now time.Time
}

func (c *clock) Now() time.Time { return c.now }

// advance moves the clock forward by d.
func (c *clock) advance(d time.Duration) { c.now = c.now.Add(d) }

// after is the scheduler of the service: it records what the service asks for
// and runs it only when the fixture moves the clock past it.
type after struct {
	clock  *clock
	timers []*timer
}

// timer is one function the service scheduled.
type timer struct {
	delay   time.Duration
	at      time.Time
	f       func()
	stopped bool
	fired   bool
}

// schedule is the attention.Deps.After of the tests.
func (a *after) schedule(d time.Duration, f func()) func() {
	tm := &timer{delay: d, at: a.clock.now.Add(d), f: f}
	a.timers = append(a.timers, tm)
	return func() { tm.stopped = true }
}

// delays are the delays of everything the service scheduled, in order.
func (a *after) delays() []time.Duration {
	delays := make([]time.Duration, len(a.timers))
	for i, tm := range a.timers {
		delays[i] = tm.delay
	}
	return delays
}

// fixture is a service over fakes, and what it told the app.
type fixture struct {
	service  *attention.Service
	store    *memStore
	notifier *memNotifier
	clock    *clock
	after    *after
	logs     *bytes.Buffer
	started  []attention.Started // what OnStarted heard, in order
	dues     int                 // how many times OnDue asked for an update
}

// newService builds a service over fakes, with the window in front of the user
// or away from them, that names its situations s1, s2 and so on.
func newService(t *testing.T, focused bool) *fixture {
	t.Helper()

	clk := &clock{now: base}
	f := &fixture{
		store:    newMemStore(),
		notifier: &memNotifier{},
		clock:    clk,
		after:    &after{clock: clk},
		logs:     &bytes.Buffer{},
	}
	ids := 0
	f.service = attention.New(attention.Deps{
		Store:    f.store,
		Notifier: f.notifier,
		Focused:  func() bool { return focused },
		Log:      slog.New(slog.NewJSONHandler(f.logs, nil)),
		Now:      clk.Now,
		NewID: func() string {
			ids++
			return "s" + strconv.Itoa(ids)
		},
		After:     f.after.schedule,
		OnDue:     func() { f.dues++ },
		OnStarted: func(started attention.Started) { f.started = append(f.started, started) },
	})
	return f
}

// advance moves the clock forward by d and fires the timers that came due on
// the way, the way time does.
func (f *fixture) advance(d time.Duration) {
	f.clock.advance(d)
	for _, tm := range f.after.timers {
		if tm.stopped || tm.fired || tm.at.After(f.clock.now) {
			continue
		}
		tm.fired = true
		tm.f()
	}
}

// settle runs the two updates that start what is found: the one that first
// sees it, and the one once it has held for Settle. It answers what the second
// one does.
func (f *fixture) settle(seen ...attention.Found) map[string][]attention.Situation {
	f.service.Update(seen)
	f.advance(attention.Settle)
	return f.service.Update(seen)
}

// logged counts the records of the log with the given message.
func (f *fixture) logged(t *testing.T, msg string) int {
	t.Helper()

	total := 0
	for line := range strings.SplitSeq(strings.TrimSpace(f.logs.String()), "\n") {
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
