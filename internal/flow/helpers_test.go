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
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/worktree"
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
	runs      map[string][]task.StepRun
	calls     []string
	err       error         // returned by every mutation
	block     chan struct{} // when set, Inspect waits on it
	inspects  int
}

func newTasks() *memTasks {
	return &memTasks{artifacts: map[string]task.Artifacts{}, runs: map[string][]task.StepRun{}}
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

func (m *memTasks) Artifacts(id string) (task.Artifacts, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	a, ok := m.artifacts[id]
	return a, ok
}

func (m *memTasks) Repositories(task.Task) []task.Repository {
	return repos
}

func (m *memTasks) StepRuns(id string) []task.StepRun {
	m.mu.Lock()
	defer m.mu.Unlock()

	return slices.Clone(m.runs[id])
}

func (m *memTasks) SetStepRun(
	_ context.Context, id string, number int, status task.StepStatus, block *task.StepBlock,
) (task.StepRun, error) {
	return m.updateRun(id, number, status, func(run *task.StepRun) { run.Block = block })
}

func (m *memTasks) SetStepStarted(_ context.Context, id string, number int, startCommit string) (task.StepRun, error) {
	return m.updateRun(id, number, task.StepStarted, func(run *task.StepRun) { run.StartCommit = startCommit })
}

func (m *memTasks) SetStepCommitted(_ context.Context, id string, number int, sha, subject string) (task.StepRun, error) {
	return m.updateRun(id, number, task.StepDone, func(run *task.StepRun) {
		run.CommitSHA, run.CommitSubject = sha, subject
	})
}

// updateRun records the state of a step the way task.Service does: what the
// call says nothing about is kept.
func (m *memTasks) updateRun(
	id string, number int, status task.StepStatus, mutate func(*task.StepRun),
) (task.StepRun, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "step:"+id+":"+strconv.Itoa(number)+":"+string(status))
	if m.err != nil {
		return task.StepRun{}, m.err
	}

	runs := m.runs[id]
	run := task.StepRun{TaskID: id, Number: number}
	index := slices.IndexFunc(runs, func(r task.StepRun) bool { return r.Number == number })
	if index >= 0 {
		run = runs[index]
	}
	run.Status, run.Block = status, nil
	mutate(&run)

	if index < 0 {
		m.runs[id] = append(runs, run)
	} else {
		runs[index] = run
	}
	return run, nil
}

// setRun seeds the record of a step, which is what a task resumed from the
// database comes back with.
func (m *memTasks) setRun(id string, run task.StepRun) {
	m.mu.Lock()
	defer m.mu.Unlock()

	run.TaskID = id
	runs := m.runs[id]
	index := slices.IndexFunc(runs, func(r task.StepRun) bool { return r.Number == run.Number })
	if index < 0 {
		m.runs[id] = append(runs, run)
	} else {
		runs[index] = run
	}
}

func (m *memTasks) ClearStepRuns(_ context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "clearSteps:"+id)
	if m.err != nil {
		return m.err
	}
	delete(m.runs, id)
	return nil
}

func (m *memTasks) Delete(_ context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "delete:"+id)
	if m.err != nil {
		return m.err
	}
	if index := m.indexOf(id); index >= 0 {
		m.items = slices.Delete(m.items, index, index+1)
	}
	return nil
}

// stepRun is what the fake recorded about a step, if anything.
func (m *memTasks) stepRun(id string, number int) (task.StepRun, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	index := slices.IndexFunc(m.runs[id], func(r task.StepRun) bool { return r.Number == number })
	if index < 0 {
		return task.StepRun{}, false
	}
	return m.runs[id][index], true
}

// setStepRun seeds a step run without going through the flow, which is how a
// test says what the app recorded before it closed.
func (m *memTasks) setStepRun(id string, run task.StepRun) {
	m.mu.Lock()
	defer m.mu.Unlock()

	run.TaskID = id
	m.runs[id] = append(m.runs[id], run)
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

func (m *memSessions) Resume(_ context.Context, taskID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "resume:"+taskID)
	if m.err != nil {
		return m.err
	}
	sum, ok := m.summaries[taskID]
	if !ok {
		return session.ErrNotFound
	}
	sum.Status, sum.Idle = session.StatusWaiting, true
	m.summaries[taskID] = sum
	return nil
}

func (m *memSessions) Summary(taskID string) (session.Summary, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	sum, ok := m.summaries[taskID]
	return sum, ok
}

func (m *memSessions) SendFromApp(_ context.Context, taskID, text string) error {
	return m.send(taskID, text, false)
}

func (m *memSessions) SendCorrection(_ context.Context, taskID, text string) error {
	return m.send(taskID, text, true)
}

// send records a message of the app, counting it as the service would.
func (m *memSessions) send(taskID, text string, correction bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "send:"+taskID)
	if m.err != nil {
		return m.err
	}
	m.messages = append(m.messages, text)
	sum := m.summaries[taskID]
	if correction {
		sum.Corrections++
	}
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

// memWorktrees is an in-memory flow.Worktrees: it hands out the worktrees a
// test seeds, answers with the failures it was told to, and records the calls.
type memWorktrees struct {
	mu        sync.Mutex
	items     map[string][]worktree.Worktree // by task id
	calls     []string
	status    git.Status
	subject   string           // the subject every commit reading answers with
	phases    []worktree.Phase // reported by every Ensure
	ensureErr error
	statusErr error
	commitErr error
	cleanErr  error
	removeErr error
	block     chan struct{} // when set, Ensure waits on it or on the context
}

func newWorktrees() *memWorktrees {
	return &memWorktrees{
		items:   map[string][]worktree.Worktree{},
		subject: "Do the work of the step",
		phases:  []worktree.Phase{worktree.PhaseFetching, worktree.PhaseCreating},
	}
}

func (m *memWorktrees) Get(taskID, repoPath string) (worktree.Worktree, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	index := slices.IndexFunc(m.items[taskID], func(wt worktree.Worktree) bool { return wt.RepoPath == repoPath })
	if index < 0 {
		return worktree.Worktree{}, false
	}
	return m.items[taskID][index], true
}

func (m *memWorktrees) Ensure(
	ctx context.Context, t task.Task, repo task.Repository, onPhase func(worktree.Phase),
) (worktree.Worktree, error) {
	m.mu.Lock()
	m.calls = append(m.calls, "ensure:"+t.ID+":"+repo.Rel)
	block, phases, err := m.block, slices.Clone(m.phases), m.ensureErr
	m.mu.Unlock()

	if block != nil {
		select {
		case <-block:
		case <-ctx.Done():
			return worktree.Worktree{}, ctx.Err()
		}
	}
	for _, phase := range phases {
		onPhase(phase)
	}
	if err != nil {
		return worktree.Worktree{}, err
	}
	if wt, ok := m.Get(t.ID, repo.Path); ok {
		return wt, nil
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	wt := worktree.Worktree{
		TaskID:   t.ID,
		RepoPath: repo.Path,
		Path:     worktree.Path(t.WorkspacePath, repo.Rel, t.Name),
		Branch:   t.Name,
	}
	m.items[t.ID] = append(m.items[t.ID], wt)
	return wt, nil
}

func (m *memWorktrees) Status(_ context.Context, wt worktree.Worktree) (git.Status, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "status:"+wt.TaskID+":"+filepath.Base(wt.Path))
	if m.statusErr != nil {
		return git.Status{}, m.statusErr
	}
	return m.status, nil
}

func (m *memWorktrees) Commit(_ context.Context, wt worktree.Worktree, rev string) (git.Commit, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "commit:"+wt.TaskID+":"+rev)
	if m.commitErr != nil {
		return git.Commit{}, m.commitErr
	}
	return git.Commit{SHA: rev, Subject: m.subject}, nil
}

func (m *memWorktrees) Clean(_ context.Context, wt worktree.Worktree) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "clean:"+wt.TaskID+":"+filepath.Base(wt.Path))
	if m.cleanErr != nil {
		return m.cleanErr
	}
	m.status = git.Status{}
	return nil
}

func (m *memWorktrees) RemoveAll(_ context.Context, taskID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "removeAll:"+taskID)
	if m.removeErr != nil {
		return m.removeErr
	}
	delete(m.items, taskID)
	return nil
}

// seed registers a worktree the way a previous run of the app left it.
func (m *memWorktrees) seed(t task.Task, repo task.Repository) worktree.Worktree {
	m.mu.Lock()
	defer m.mu.Unlock()

	wt := worktree.Worktree{
		TaskID:   t.ID,
		RepoPath: repo.Path,
		Path:     worktree.Path(t.WorkspacePath, repo.Rel, t.Name),
		Branch:   t.Name,
	}
	m.items[t.ID] = append(m.items[t.ID], wt)
	return wt
}

// recorded returns the calls the fake took, in order.
func (m *memWorktrees) recorded() []string {
	m.mu.Lock()
	defer m.mu.Unlock()

	return slices.Clone(m.calls)
}

// setStatus is what the next check of a worktree reports.
func (m *memWorktrees) setStatus(status git.Status) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.status = status
}

// failEnsure makes every creation of a worktree fail with err.
func (m *memWorktrees) failEnsure(err error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.ensureErr = err
}

// blockEnsure holds every creation of a worktree until the returned channel is
// closed, which is how a test keeps a preparation running.
func (m *memWorktrees) blockEnsure() chan struct{} {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.block = make(chan struct{})
	return m.block
}

// memReviews is an in-memory flow.Reviews: it hands out the reading a test
// seeds and records which worktree it was told to watch, and how.
type memReviews struct {
	mu      sync.Mutex
	calls   []string
	snap    review.Snapshot
	has     bool
	tracked map[string]bool // task id -> whether its numbers matter now
}

func newReviews() *memReviews {
	return &memReviews{tracked: map[string]bool{}}
}

func (m *memReviews) Track(taskID string, wt worktree.Worktree, active bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "track:"+taskID+":"+filepath.Base(wt.Path)+":"+strconv.FormatBool(active))
	m.tracked[taskID] = active
}

func (m *memReviews) Refresh(taskID string) (review.Snapshot, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "refresh:"+taskID)
	return m.snap, m.has
}

func (m *memReviews) Snapshot(_ string) (review.Snapshot, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	return m.snap, m.has
}

func (m *memReviews) Forget(taskID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "forget:"+taskID)
	delete(m.tracked, taskID)
}

// activeOf says whether the worktree of a task is watched, and whether its
// numbers matter now.
func (m *memReviews) activeOf(taskID string) (active, watched bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	active, watched = m.tracked[taskID]
	return active, watched
}

// setSnapshot makes every reading answer with snap.
func (m *memReviews) setSnapshot(snap review.Snapshot) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.snap, m.has = snap, true
}

// reviewCalls is what the review service was asked, in order.
func (m *memReviews) reviewCalls() []string {
	m.mu.Lock()
	defer m.mu.Unlock()

	return slices.Clone(m.calls)
}

// commitPrompt is what the fake renderer answers with for the commit stage,
// with the name of the task so that a test can see the placeholders went
// through.
func commitPrompt(name string) string { return "Commit the work of " + name }

// fixture is a flow.Service over the four fakes.
type fixture struct {
	service   *flow.Service
	tasks     *memTasks
	sessions  *memSessions
	worktrees *memWorktrees
	reviews   *memReviews
}

func newFixture(t *testing.T) *fixture {
	t.Helper()

	f := &fixture{
		tasks:     newTasks(),
		sessions:  newSessions(),
		worktrees: newWorktrees(),
		reviews:   newReviews(),
	}
	f.service = flow.New(flow.Deps{
		Tasks:     f.tasks,
		Sessions:  f.sessions,
		Worktrees: f.worktrees,
		Review:    f.reviews,
		RenderPrompt: func(stage prompts.Stage, vars prompts.Vars) (string, error) {
			if stage != prompts.StageCommit {
				return "", errors.New("unexpected prompt stage " + string(stage))
			}
			return commitPrompt(vars.TaskName), nil
		},
	})
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

// waitStep polls until a step of a task reaches a status.
func (f *fixture) waitStep(t *testing.T, id string, number int, status flow.StepStatus) {
	t.Helper()

	waitFor(t, "step "+strconv.Itoa(number)+" of "+id+" to be "+string(status), func() bool {
		for _, state := range f.service.Steps(id) {
			if state.Step.Number == number {
				return state.Status == status
			}
		}
		return false
	})
}

// stepState is the state of a step of a task, failing the test when the plan
// has no such step.
func (f *fixture) stepState(t *testing.T, id string, number int) flow.StepState {
	t.Helper()

	for _, state := range f.service.Steps(id) {
		if state.Step.Number == number {
			return state
		}
	}
	t.Fatalf("task %s has no step %d", id, number)
	return flow.StepState{}
}

// waitWorktreeCalls polls until the worktrees fake took the given calls, in
// order.
func (f *fixture) waitWorktreeCalls(t *testing.T, want ...string) {
	t.Helper()

	waitFor(t, "worktree calls "+strings.Join(want, " "), func() bool {
		return slices.Equal(f.worktrees.recorded(), want)
	})
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

// failRemoveAll makes every removal of the worktrees of a task fail with err.
func (m *memWorktrees) failRemoveAll(err error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.removeErr = err
}
