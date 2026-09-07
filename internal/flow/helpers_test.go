package flow_test

import (
	"context"
	"errors"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

// pollTimeout and pollStep bound how long a test waits for an evaluation,
// which the flow runs on a goroutine of its own.
const (
	pollTimeout = 2 * time.Second
	pollStep    = 5 * time.Millisecond
)

// workspace is the root every fake task lives under.
const workspace = "/workspace"

// repos are the repositories of the fake workspace, as Repositories reports
// them.
var repos = []task.Repository{
	{Rel: "api", Path: filepath.Join(workspace, "api")},
	{Rel: "web", Path: filepath.Join(workspace, "web")},
}

// memTasks is an in-memory flow.Tasks that lets a test say what the disk
// holds.
type memTasks struct {
	mu        sync.Mutex
	items     []task.Task
	artifacts map[string]task.Artifacts
	calls     []string
	err       error         // returned by every mutation
	block     chan struct{} // when set, Inspect waits on it
	inspects  int
}

func newTasks() *memTasks {
	return &memTasks{artifacts: map[string]task.Artifacts{}}
}

func (m *memTasks) Get(id string) (task.Task, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	index := m.indexOf(id)
	if index < 0 {
		return task.Task{}, false
	}
	return m.items[index], true
}

func (m *memTasks) List() []task.Task {
	m.mu.Lock()
	defer m.mu.Unlock()

	return slices.Clone(m.items)
}

func (m *memTasks) Inspect(id string) (task.Artifacts, error) {
	m.mu.Lock()
	block := m.block
	m.inspects++
	a := m.artifacts[id]
	m.mu.Unlock()

	if block != nil {
		<-block
	}
	return a, nil
}

func (m *memTasks) SetStage(_ context.Context, id string, stage task.Stage, revisiting bool) (task.Task, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "stage:"+id+":"+string(stage)+":revisiting="+strconv.FormatBool(revisiting))
	if m.err != nil {
		return task.Task{}, m.err
	}
	index := m.indexOf(id)
	if index < 0 {
		return task.Task{}, task.ErrNotFound
	}
	m.items[index].Stage = stage
	m.items[index].Revisiting = revisiting
	return m.items[index], nil
}

func (m *memTasks) RemoveArtifacts(_ context.Context, id string, from task.Stage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "remove:"+id+":"+string(from))
	if m.err != nil {
		return m.err
	}
	a := m.artifacts[id]
	for _, stage := range from.From() {
		switch stage {
		case task.StagePRD:
			a.PRD = false
		case task.StageTechSpec:
			a.TechSpec = false
		case task.StagePlan:
			a.Plan = task.Plan{}
		case task.StageImplementation:
		}
	}
	m.artifacts[id] = a
	return nil
}

func (m *memTasks) Repositories(task.Task) []task.Repository {
	return repos
}

// add stores a task at a stage, with the artifacts the disk holds for it.
func (m *memTasks) add(id string, stage task.Stage, a task.Artifacts) task.Task {
	m.mu.Lock()
	defer m.mu.Unlock()

	t := task.Task{
		ID:            id,
		WorkspacePath: workspace,
		Name:          id,
		Stage:         stage,
		ArtifactsDir:  filepath.Join("/data", id),
	}
	m.items = append(m.items, t)
	m.artifacts[id] = a
	return t
}

// blockInspect holds every reading of the disk until the returned channel is
// closed, which is how a test keeps an evaluation running.
func (m *memTasks) blockInspect() chan struct{} {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.block = make(chan struct{})
	return m.block
}

// failWith makes every mutation of a task return err.
func (m *memTasks) failWith(err error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.err = err
}

// setArtifacts replaces what the disk holds for a task.
func (m *memTasks) setArtifacts(id string, a task.Artifacts) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.artifacts[id] = a
}

// setRevisiting marks a task as revisiting its stage without going through the
// service.
func (m *memTasks) setRevisiting(id string, revisiting bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if index := m.indexOf(id); index >= 0 {
		m.items[index].Revisiting = revisiting
	}
}

// inspectCount is how many times the flow read the disk.
func (m *memTasks) inspectCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()

	return m.inspects
}

// indexOf finds a task by id. The caller holds the mutex.
func (m *memTasks) indexOf(id string) int {
	return slices.IndexFunc(m.items, func(t task.Task) bool { return t.ID == id })
}

// memSessions is an in-memory flow.Sessions recording what it was asked to do.
type memSessions struct {
	mu        sync.Mutex
	summaries map[string]session.Summary
	calls     []string
	messages  []string
	err       error // returned by every call that changes something
}

func newSessions() *memSessions {
	return &memSessions{summaries: map[string]session.Summary{}}
}

func (m *memSessions) Open(_ context.Context, t session.TaskInfo) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "open:"+t.ID+":"+t.Stage)
	if m.err != nil {
		return m.err
	}
	if _, ok := m.summaries[t.ID]; !ok {
		m.summaries[t.ID] = session.Summary{TaskID: t.ID, Status: session.StatusWaiting, Idle: true}
	}
	return nil
}

func (m *memSessions) Start(_ context.Context, t session.TaskInfo, restarted bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "start:"+t.ID+":"+t.Stage+":restarted="+strconv.FormatBool(restarted))
	if m.err != nil {
		return m.err
	}
	m.summaries[t.ID] = session.Summary{TaskID: t.ID, Stage: t.Stage, Status: session.StatusWorking}
	return nil
}

func (m *memSessions) Discard(_ context.Context, taskID string, stages ...string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "discard:"+taskID+":"+strings.Join(stages, ","))
	if m.err != nil {
		return m.err
	}
	delete(m.summaries, taskID)
	return nil
}

func (m *memSessions) Close(_ context.Context, taskID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "close:"+taskID)
	if m.err != nil {
		return m.err
	}
	delete(m.summaries, taskID)
	return nil
}

func (m *memSessions) Summary(taskID string) (session.Summary, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	sum, ok := m.summaries[taskID]
	return sum, ok
}

func (m *memSessions) SendFromApp(_ context.Context, taskID, text string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "send:"+taskID)
	if m.err != nil {
		return m.err
	}
	m.messages = append(m.messages, text)
	sum := m.summaries[taskID]
	sum.Corrections++
	sum.Idle = false
	sum.Status = session.StatusWorking
	m.summaries[taskID] = sum
	return nil
}

// goIdle brings the session of a task to rest, keeping what it has counted.
func (m *memSessions) goIdle(taskID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	sum := m.summaries[taskID]
	sum.Status = session.StatusWaiting
	sum.Idle = true
	m.summaries[taskID] = sum
}

// failWith makes every call that changes something return err.
func (m *memSessions) failWith(err error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.err = err
}

// setSummary is the session state a test wants the flow to see.
func (m *memSessions) setSummary(taskID string, sum session.Summary) {
	m.mu.Lock()
	defer m.mu.Unlock()

	sum.TaskID = taskID
	m.summaries[taskID] = sum
}

// idle is a session at rest, which is what the end of a stage needs.
func idle(stage task.Stage) session.Summary {
	return session.Summary{Stage: string(stage), Status: session.StatusWaiting, Idle: true}
}

// busy is a session in the middle of a turn.
func busy(stage task.Stage) session.Summary {
	return session.Summary{Stage: string(stage), Status: session.StatusWorking, TurnRunning: true}
}

// recorded returns the calls both fakes took, in the order each took them.
func (m *memSessions) recorded() []string {
	m.mu.Lock()
	defer m.mu.Unlock()

	return slices.Clone(m.calls)
}

// sent returns the messages the app wrote to the agent.
func (m *memSessions) sent() []string {
	m.mu.Lock()
	defer m.mu.Unlock()

	return slices.Clone(m.messages)
}

func (m *memTasks) recorded() []string {
	m.mu.Lock()
	defer m.mu.Unlock()

	return slices.Clone(m.calls)
}

// fixture is a flow.Service over the two fakes.
type fixture struct {
	service  *flow.Service
	tasks    *memTasks
	sessions *memSessions
}

func newFixture(t *testing.T) *fixture {
	t.Helper()

	f := &fixture{tasks: newTasks(), sessions: newSessions()}
	f.service = flow.New(flow.Deps{Tasks: f.tasks, Sessions: f.sessions})
	t.Cleanup(f.service.Close)
	return f
}

// plan is a valid plan of one step in the first repository.
func plan() task.Plan {
	return task.Plan{
		Present: true,
		Steps:   []task.Step{{Number: 1, File: "1-first.md", Title: "First", Repository: "api", RepoPath: repos[0].Path}},
	}
}

// brokenPlan is a plan whose only step names a repository of no one.
func brokenPlan() task.Plan {
	return task.Plan{
		Present:  true,
		Steps:    []task.Step{{Number: 1, File: "1-first.md", Title: "First", Repository: "cli"}},
		Problems: []task.PlanProblem{{File: "1-first.md", Message: `repository "cli" is not one of the repositories of this task`}},
	}
}

// waitFor polls until cond holds, failing the test with subject when it never
// does. Evaluations run on their own goroutine, so tests wait instead of sleep.
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

// waitEvaluations polls until the flow has read the disk n times, which is one
// reading per evaluation that gets past the task lookup.
func (f *fixture) waitEvaluations(t *testing.T, n int) {
	t.Helper()

	waitFor(t, "evaluation number "+strconv.Itoa(n), func() bool { return f.tasks.inspectCount() >= n })
}

// waitStage polls until a task reaches a stage.
func (f *fixture) waitStage(t *testing.T, id string, stage task.Stage) {
	t.Helper()

	waitFor(t, "task "+id+" to reach "+string(stage), func() bool {
		got, ok := f.tasks.Get(id)
		return ok && got.Stage == stage
	})
}

// waitCalls polls until the sessions fake took the given calls, in order.
func (f *fixture) waitCalls(t *testing.T, want ...string) {
	t.Helper()

	waitFor(t, "session calls "+strings.Join(want, " "), func() bool {
		return slices.Equal(f.sessions.recorded(), want)
	})
}

// wantCalls fails the test unless the sessions fake took exactly these calls.
func (f *fixture) wantCalls(t *testing.T, want ...string) {
	t.Helper()

	if got := f.sessions.recorded(); !slices.Equal(got, want) {
		t.Errorf("session calls = %v, want %v", got, want)
	}
}

// wantTaskCalls fails the test unless the tasks fake took exactly these calls.
func (f *fixture) wantTaskCalls(t *testing.T, want ...string) {
	t.Helper()

	if got := f.tasks.recorded(); !slices.Equal(got, want) {
		t.Errorf("task calls = %v, want %v", got, want)
	}
}

// The failures the fakes are told to answer with.
var (
	errStart = errors.New("cannot start")
	errStore = errors.New("cannot write the task")
)

// wantErrIs fails the test unless err matches want.
func wantErrIs(t *testing.T, err, want error) {
	t.Helper()

	if !errors.Is(err, want) {
		t.Fatalf("error = %v, want %v", err, want)
	}
}
