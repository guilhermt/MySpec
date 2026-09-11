package flow_test

import (
	"context"
	"errors"
	"maps"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/gh"
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
	archived  []task.Task // newest first, as the service keeps them
	artifacts map[string]task.Artifacts
	runs      map[string][]task.StepRun
	prs       map[string][]task.PRRun
	calls     []string
	err       error         // returned by every mutation
	block     chan struct{} // when set, Inspect waits on it
	inspects  int
}

func newTasks() *memTasks {
	return &memTasks{
		artifacts: map[string]task.Artifacts{},
		runs:      map[string][]task.StepRun{},
		prs:       map[string][]task.PRRun{},
	}
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

func (m *memTasks) Lookup(id string) (task.Task, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if index := m.indexOf(id); index >= 0 {
		return m.items[index], true
	}
	if index := slices.IndexFunc(m.archived, func(t task.Task) bool { return t.ID == id }); index >= 0 {
		return m.archived[index], true
	}
	return task.Task{}, false
}

func (m *memTasks) List() []task.Task {
	m.mu.Lock()
	defer m.mu.Unlock()

	return slices.Clone(m.items)
}

func (m *memTasks) ListArchived() []task.Task {
	m.mu.Lock()
	defer m.mu.Unlock()

	return slices.Clone(m.archived)
}

func (m *memTasks) Archive(_ context.Context, id string) (task.Task, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "archive:"+id)
	if m.err != nil {
		return task.Task{}, m.err
	}
	index := m.indexOf(id)
	if index < 0 {
		return task.Task{}, task.ErrNotFound
	}
	t := m.items[index]
	t.ArchivedAt = time.Now().UTC()
	m.items = slices.Delete(m.items, index, index+1)
	m.archived = slices.Insert(m.archived, 0, t)
	return t, nil
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
		case task.StagePR:
			a.PR = nil
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

func (m *memTasks) PRRuns(id string) []task.PRRun {
	m.mu.Lock()
	defer m.mu.Unlock()

	return slices.Clone(m.prs[id])
}

func (m *memTasks) SetPRRun(
	_ context.Context, id, repoPath string, status task.PRStatus, block *task.PRBlock,
) (task.PRRun, error) {
	return m.updatePRRun(id, repoPath, "pr:"+string(status), func(run *task.PRRun) {
		run.Status, run.Block = status, block
	})
}

func (m *memTasks) SetPRDetails(_ context.Context, id, repoPath string, pr task.PRDetails) (task.PRRun, error) {
	return m.updatePRRun(id, repoPath, "prDetails", func(run *task.PRRun) { run.PR = pr })
}

func (m *memTasks) SetPRClosed(_ context.Context, id, repoPath string, result task.CloseResult) (task.PRRun, error) {
	return m.updatePRRun(id, repoPath, "prClosed", func(run *task.PRRun) {
		copied := result
		run.Status, run.Block, run.Close = task.PRClosed, nil, &copied
	})
}

func (m *memTasks) SetPRReviewed(_ context.Context, id, repoPath, commit string, pass int) (task.PRRun, error) {
	return m.updatePRRun(id, repoPath, "prReviewed:"+strconv.Itoa(pass), func(run *task.PRRun) {
		run.ReviewedCommit, run.ReportedPass = commit, pass
	})
}

func (m *memTasks) ClearPRRuns(_ context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "clearPRs:"+id)
	if m.err != nil {
		return m.err
	}
	delete(m.prs, id)
	return nil
}

// updatePRRun records the state of a repository the way task.Service does:
// what the call says nothing about is kept.
func (m *memTasks) updatePRRun(
	id, repoPath, label string, mutate func(*task.PRRun),
) (task.PRRun, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, label+":"+id+":"+filepath.Base(repoPath))
	if m.err != nil {
		return task.PRRun{}, m.err
	}

	runs := m.prs[id]
	run := task.PRRun{TaskID: id, RepoPath: repoPath}
	index := slices.IndexFunc(runs, func(r task.PRRun) bool { return r.RepoPath == repoPath })
	if index >= 0 {
		run = runs[index]
	}
	mutate(&run)

	if index < 0 {
		// task.Service keeps the runs by repository path, and so does the fake.
		position, _ := slices.BinarySearchFunc(runs, run, func(a, b task.PRRun) int {
			return strings.Compare(a.RepoPath, b.RepoPath)
		})
		m.prs[id] = slices.Insert(runs, position, run)
	} else {
		runs[index] = run
	}
	return run, nil
}

// prRun is what the fake recorded about a repository, if anything.
func (m *memTasks) prRun(id, repoPath string) (task.PRRun, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	index := slices.IndexFunc(m.prs[id], func(r task.PRRun) bool { return r.RepoPath == repoPath })
	if index < 0 {
		return task.PRRun{}, false
	}
	return m.prs[id][index], true
}

// setPRRun seeds the record of a repository, which is how a test says what the
// app recorded before it closed.
func (m *memTasks) setPRRun(id string, run task.PRRun) {
	m.mu.Lock()
	defer m.mu.Unlock()

	run.TaskID = id
	m.prs[id] = append(m.prs[id], run)
	slices.SortFunc(m.prs[id], func(a, b task.PRRun) int { return strings.Compare(a.RepoPath, b.RepoPath) })
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
	if index := slices.IndexFunc(m.archived, func(t task.Task) bool { return t.ID == id }); index >= 0 {
		m.archived = slices.Delete(m.archived, index, index+1)
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

// useDir puts the artifacts of a task in a directory of the test, which is
// what the actions that write a file into it need.
func (m *memTasks) useDir(id, dir string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if index := m.indexOf(id); index >= 0 {
		m.items[index].ArtifactsDir = dir
	}
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
	summaries map[session.Key]session.Summary
	infos     map[session.Key]session.TaskInfo
	calls     []string
	messages  []string
	err       error // returned by every call that changes something
}

func newSessions() *memSessions {
	return &memSessions{
		summaries: map[session.Key]session.Summary{},
		infos:     map[session.Key]session.TaskInfo{},
	}
}

func (m *memSessions) Open(_ context.Context, t session.TaskInfo) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "open:"+t.ID+":"+t.Stage)
	if m.err != nil {
		return m.err
	}
	m.infos[t.Key()] = t
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

	m.calls = append(m.calls, "start:"+t.ID+":"+t.Stage+":restarted="+strconv.FormatBool(restarted))
	if m.err != nil {
		return m.err
	}
	m.infos[t.Key()] = t
	m.summaries[t.Key()] = session.Summary{TaskID: t.ID, Stage: t.Stage, Status: session.StatusWorking}
	return nil
}

func (m *memSessions) Discard(_ context.Context, taskID string, stages ...string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "discard:"+taskID+":"+strings.Join(stages, ","))
	if m.err != nil {
		return m.err
	}
	for _, stage := range stages {
		delete(m.summaries, session.Key{TaskID: taskID, Stage: stage})
	}
	return nil
}

func (m *memSessions) Close(_ context.Context, k session.Key) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "close:"+k.TaskID+":"+k.Stage)
	if m.err != nil {
		return m.err
	}
	delete(m.summaries, k)
	return nil
}

func (m *memSessions) CloseTask(_ context.Context, taskID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "closeTask:"+taskID)
	if m.err != nil {
		return m.err
	}
	for k := range m.summaries {
		if k.TaskID == taskID {
			delete(m.summaries, k)
		}
	}
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
	return nil
}

func (m *memSessions) Resume(_ context.Context, k session.Key) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "resume:"+k.TaskID+":"+k.Stage)
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

func (m *memSessions) Summaries() map[session.Key]session.Summary {
	m.mu.Lock()
	defer m.mu.Unlock()

	return maps.Clone(m.summaries)
}

func (m *memSessions) SendFromApp(_ context.Context, k session.Key, text string) error {
	return m.send(k, text, false)
}

func (m *memSessions) SendCorrection(_ context.Context, k session.Key, text string) error {
	return m.send(k, text, true)
}

func (m *memSessions) MarkPRReview(_ context.Context, k session.Key, pass int) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "mark:"+k.TaskID+":"+k.Stage+":pass="+strconv.Itoa(pass))
}

// send records a message of the app, counting it as the service would.
func (m *memSessions) send(k session.Key, text string, correction bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "send:"+k.TaskID+":"+k.Stage)
	if m.err != nil {
		return m.err
	}
	m.messages = append(m.messages, text)
	sum := m.summaries[k]
	if correction {
		sum.Corrections++
	}
	sum.Idle = false
	sum.Status = session.StatusWorking
	m.summaries[k] = sum
	return nil
}

// goIdle brings every session of a task to rest, keeping what each has
// counted.
func (m *memSessions) goIdle(taskID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for k, sum := range m.summaries {
		if k.TaskID != taskID {
			continue
		}
		sum.Status = session.StatusWaiting
		sum.Idle = true
		m.summaries[k] = sum
	}
}

// goIdleSession brings one session to rest, keeping what it has counted. A
// session that is not open is left alone, so a test that stops one agent
// neither reopens a session the flow has closed nor reaches one it opens later.
func (m *memSessions) goIdleSession(k session.Key) {
	m.mu.Lock()
	defer m.mu.Unlock()

	sum, ok := m.summaries[k]
	if !ok {
		return
	}
	sum.Status = session.StatusWaiting
	sum.Idle = true
	m.summaries[k] = sum
}

// failWith makes every call that changes something return err.
func (m *memSessions) failWith(err error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.err = err
}

// setSummary is the session state a test wants the flow to see. The stage of
// the summary is what names the session.
func (m *memSessions) setSummary(taskID string, sum session.Summary) {
	m.mu.Lock()
	defer m.mu.Unlock()

	sum.TaskID = taskID
	m.summaries[session.Key{TaskID: taskID, Stage: sum.Stage}] = sum
}

// info is what the last Open or Start said about a session.
func (m *memSessions) info(k session.Key) (session.TaskInfo, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	t, ok := m.infos[k]
	return t, ok
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
	base      string // the ref every branch is said to come from
	ahead     int    // how many commits past the base every branch has
	merged    bool   // whether git sees every branch in the base it is asked about
	baseErr   error
	aheadErr  error
	mergedErr error
	subject   string           // the subject every commit reading answers with
	phases    []worktree.Phase // reported by every Ensure
	ensureErr error
	statusErr error
	commitErr error
	cleanErr  error
	removeErr error
	block     chan struct{} // when set, Ensure waits on it or on the context

	closeResult task.CloseResult // what every closing answers with
	closeCalls  []closeCall      // the closings the flow asked for, in order
	leftovers   []worktree.Leftover
	purged      []string // the tasks Purge was called for
}

// closeCall is one closing of a repository, with what the flow decided about
// the base branch and the branch of the worktree.
type closeCall struct {
	taskID   string
	repoPath string
	base     string
	policy   worktree.BranchPolicy
}

func newWorktrees() *memWorktrees {
	return &memWorktrees{
		items:   map[string][]worktree.Worktree{},
		subject: "Do the work of the step",
		phases:  []worktree.Phase{worktree.PhaseFetching, worktree.PhaseCreating},
		base:    "origin/dev",
		ahead:   1,
		closeResult: task.CloseResult{
			Worktree:    task.CloseStep{Outcome: task.OutcomeDone},
			Branch:      task.CloseStep{Outcome: task.OutcomeDone},
			Base:        task.CloseStep{Outcome: task.OutcomeDone},
			BaseCommits: 3,
		},
	}
}

// setCloseResult is what every closing of a repository answers with.
func (m *memWorktrees) setCloseResult(result task.CloseResult) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.closeResult = result
}

// setLeftovers is what every purge of a task answers with: what git could not
// take back.
func (m *memWorktrees) setLeftovers(leftovers []worktree.Leftover) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.leftovers = leftovers
}

// closings are the closings the flow asked for, in order.
func (m *memWorktrees) closings() []closeCall {
	m.mu.Lock()
	defer m.mu.Unlock()

	return slices.Clone(m.closeCalls)
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

func (m *memWorktrees) List(taskID string) []worktree.Worktree {
	m.mu.Lock()
	defer m.mu.Unlock()

	return slices.Clone(m.items[taskID])
}

func (m *memWorktrees) Base(_ context.Context, wt worktree.Worktree) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "base:"+wt.TaskID+":"+filepath.Base(wt.RepoPath))
	if m.baseErr != nil {
		return "", m.baseErr
	}
	return m.base, nil
}

func (m *memWorktrees) Ahead(_ context.Context, wt worktree.Worktree, base string) (int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "ahead:"+wt.TaskID+":"+filepath.Base(wt.RepoPath)+":"+base)
	if m.aheadErr != nil {
		return 0, m.aheadErr
	}
	return m.ahead, nil
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

func (m *memWorktrees) Merged(_ context.Context, wt worktree.Worktree, base string) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "merged:"+wt.TaskID+":"+filepath.Base(wt.RepoPath)+":"+base)
	if m.mergedErr != nil {
		return false, m.mergedErr
	}
	return m.merged, nil
}

func (m *memWorktrees) Close(
	_ context.Context, wt worktree.Worktree, base string, policy worktree.BranchPolicy,
) task.CloseResult {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "close:"+wt.TaskID+":"+filepath.Base(wt.RepoPath))
	m.closeCalls = append(m.closeCalls, closeCall{
		taskID: wt.TaskID, repoPath: wt.RepoPath, base: base, policy: policy,
	})
	// The real service forgets the worktree whatever git did, so the fake does
	// too: nothing there is the app's any more.
	index := slices.IndexFunc(m.items[wt.TaskID], func(w worktree.Worktree) bool { return w.RepoPath == wt.RepoPath })
	if index >= 0 {
		m.items[wt.TaskID] = slices.Delete(m.items[wt.TaskID], index, index+1)
	}
	result := m.closeResult
	result.WorktreePath, result.BranchName, result.BaseBranch = wt.Path, wt.Branch, base
	return result
}

func (m *memWorktrees) Purge(_ context.Context, taskID string) []worktree.Leftover {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "purge:"+taskID)
	m.purged = append(m.purged, taskID)
	delete(m.items, taskID)
	return slices.Clone(m.leftovers)
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

// setAhead is how many commits past its base every branch is said to have.
func (m *memWorktrees) setAhead(n int) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.ahead = n
}

// failAhead makes every count of the commits of a branch fail with err.
func (m *memWorktrees) failAhead(err error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.aheadErr = err
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
		Base:     m.base,
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
	tracked map[review.Key]bool // key -> whether its numbers matter now
}

func newReviews() *memReviews {
	return &memReviews{tracked: map[review.Key]bool{}}
}

func (m *memReviews) Track(k review.Key, wt worktree.Worktree, active bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "track:"+reviewLabel(k)+":"+filepath.Base(wt.Path)+":"+strconv.FormatBool(active))
	m.tracked[k] = active
}

func (m *memReviews) Refresh(k review.Key) (review.Snapshot, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "refresh:"+reviewLabel(k))
	return m.snap, m.has
}

func (m *memReviews) Snapshot(_ review.Key) (review.Snapshot, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	return m.snap, m.has
}

func (m *memReviews) Forget(k review.Key) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "forget:"+reviewLabel(k))
	delete(m.tracked, k)
}

func (m *memReviews) ForgetTask(taskID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "forget-task:"+taskID)
	maps.DeleteFunc(m.tracked, func(k review.Key, _ bool) bool { return k.TaskID == taskID })
}

// activeOf says whether the worktree of a key is watched, and whether its
// numbers matter now.
func (m *memReviews) activeOf(k review.Key) (active, watched bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	active, watched = m.tracked[k]
	return active, watched
}

// reviewKey is the key the step of a task in the given repository of the fake
// workspace is reviewed under.
func reviewKey(taskID string, repo int) review.Key {
	return review.Key{TaskID: taskID, RepoPath: repos[repo].Path}
}

// reviewLabel names a key in the recorded calls, by task and repository.
func reviewLabel(k review.Key) string {
	return k.TaskID + ":" + filepath.Base(k.RepoPath)
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

// memGH is an in-memory flow.GH: it answers with the login and the pull
// requests a test seeds, and records what it was asked.
type memGH struct {
	mu      sync.Mutex
	calls   []string
	authErr error
	prs     map[string]gh.PR // by branch
	viewErr error            // returned by every reading that finds no seeded PR
}

func newGH() *memGH {
	return &memGH{prs: map[string]gh.PR{}, viewErr: gh.ErrNoPR}
}

func (m *memGH) Auth(context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "auth")
	return m.authErr
}

func (m *memGH) ViewPR(_ context.Context, dir, branch string) (gh.PR, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "view:"+filepath.Base(filepath.Dir(dir))+":"+branch)
	if pr, ok := m.prs[branch]; ok {
		return pr, nil
	}
	return gh.PR{}, m.viewErr
}

// setPR is the pull request every reading of a branch answers with.
func (m *memGH) setPR(branch string, pr gh.PR) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.prs[branch] = pr
}

// failAuth makes every login check fail with err.
func (m *memGH) failAuth(err error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.authErr = err
}

// failView makes every reading of a branch with no seeded pull request fail
// with err.
func (m *memGH) failView(err error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.viewErr = err
}

// ghCalls is what gh was asked, in order.
func (m *memGH) ghCalls() []string {
	m.mu.Lock()
	defer m.mu.Unlock()

	return slices.Clone(m.calls)
}

// commitPrompt is what the fake renderer answers with for the commit stage,
// with the name of the task so that a test can see the placeholders went
// through, and the push instruction when the commit belongs to a pull request.
func commitPrompt(name string, push bool) string {
	message := "Commit the work of " + name
	if push {
		message += ". " + prompts.PushInstruction
	}
	return message
}

// reviewPrompt is what the fake renderer answers with for the prompt of a
// review pass, with the report it is about.
func reviewPrompt(path string) string { return "Review the pull request into " + path }

// fixture is a flow.Service over the four fakes.
type fixture struct {
	service   *flow.Service
	tasks     *memTasks
	sessions  *memSessions
	worktrees *memWorktrees
	reviews   *memReviews
	gh        *memGH
}

func newFixture(t *testing.T) *fixture {
	t.Helper()

	f := &fixture{
		tasks:     newTasks(),
		sessions:  newSessions(),
		worktrees: newWorktrees(),
		reviews:   newReviews(),
		gh:        newGH(),
	}
	f.service = flow.New(flow.Deps{
		Tasks:     f.tasks,
		Sessions:  f.sessions,
		Worktrees: f.worktrees,
		Review:    f.reviews,
		GH:        f.gh,
		RenderPrompt: func(stage prompts.Stage, vars prompts.Vars) (string, error) {
			switch stage {
			case prompts.StageCommit:
				return commitPrompt(vars.TaskName, vars.Push), nil
			case prompts.StagePRReview:
				return reviewPrompt(vars.ReviewPath), nil
			default:
				return "", errors.New("unexpected prompt stage " + string(stage))
			}
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

// waitStepSession polls until the session of a step has been opened. Starting a
// step records the run before it starts the session, so a test that waits on
// the status alone can still be ahead of the Start call, and whatever it does
// to the session then is overwritten by it.
func (f *fixture) waitStepSession(t *testing.T, id string, number int) {
	t.Helper()

	key := session.Key{TaskID: id, Stage: session.StepStage(number)}
	waitFor(t, "the session of step "+strconv.Itoa(number)+" of "+id, func() bool {
		_, ok := f.sessions.Summary(key)
		return ok
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
