package flow_test

import (
	"cmp"
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
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/prreport"
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/reviewmode"
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

// The registered repository every fake task belongs to, and the data directory
// its worktrees live under.
const (
	repoID  = "repo-1"
	dataDir = "/data"
)

// repo is the registered repository of every fake task.
var repo = repository.Repository{ID: repoID, Owner: "dev", Name: "web", Path: "/home/dev/web"}

// memRepositories is an in-memory flow.Repositories: one repository, whose
// clone a test can say is gone.
type memRepositories struct {
	mu      sync.Mutex
	repo    repository.Repository
	missing bool
	checks  int
}

func newRepositories() *memRepositories {
	return &memRepositories{repo: repo}
}

func (m *memRepositories) Get(id string) (repository.Repository, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if id != m.repo.ID {
		return repository.Repository{}, false
	}
	return m.repo, true
}

func (m *memRepositories) Missing(id string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()

	return id == m.repo.ID && m.missing
}

func (m *memRepositories) Check(id string) (repository.Repository, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.checks++
	if id != m.repo.ID {
		return repository.Repository{}, repository.ErrNotFound
	}
	if m.missing {
		return repository.Repository{}, &repository.Refusal{
			Reason: repository.ReasonCloneMissing, Path: m.repo.Path,
		}
	}
	return m.repo, nil
}

// setInstructions is what the user wrote as the fixed review instructions of
// the repository.
func (m *memRepositories) setInstructions(text string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.repo.ReviewInstructions = text
}

// setMissing says whether the clone of the repository is there.
func (m *memRepositories) setMissing(missing bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.missing = missing
}

// memTasks is an in-memory flow.Tasks that lets a test say what the disk
// holds.
type memTasks struct {
	mu        sync.Mutex
	items     []task.Task
	archived  []task.Task // newest first, as the service keeps them
	artifacts map[string]task.Artifacts
	runs      map[string][]task.StepRun
	prs       map[string]task.PRRun
	passes    map[string][]task.PRPass // the structured passes of the review, by task, in order of pass
	seeded    map[string]task.Models   // the choices a test made for a task, by id
	// seededModes are the review modes a test made for a task, by id.
	seededModes map[string]task.ReviewModes
	// seededTaskModes are the modes a test created a task in, by id.
	seededTaskModes map[string]task.Mode
	calls           []string
	err             error         // returned by every mutation
	recordErr       error         // returned by RecordPRReport
	block           chan struct{} // when set, Inspect waits on it
	inspects        int
}

func newTasks() *memTasks {
	return &memTasks{
		artifacts: map[string]task.Artifacts{},
		runs:      map[string][]task.StepRun{},
		prs:       map[string]task.PRRun{},
		passes:    map[string][]task.PRPass{},
		seeded:    map[string]task.Models{},

		seededModes:     map[string]task.ReviewModes{},
		seededTaskModes: map[string]task.Mode{},
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

func (m *memTasks) ReadArtifact(id, name string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "read:"+id+":"+name)
	if m.err != nil {
		return "", m.err
	}
	return "the report " + name, nil
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

func (m *memTasks) SetStageModel(
	_ context.Context, id string, stage models.Stage, c models.Choice,
) (task.Task, error) {
	return m.updateModels(
		id,
		"model:"+id+":"+string(stage)+":"+string(c.Model)+":"+string(c.Effort),
		func(choices *task.Models) { choices.Stages[stage] = c },
	)
}

func (m *memTasks) SetStepModel(_ context.Context, id string, number int, c models.Choice) (task.Task, error) {
	return m.updateModels(
		id,
		"stepModel:"+id+":"+strconv.Itoa(number)+":"+string(c.Model)+":"+string(c.Effort),
		func(choices *task.Models) { choices.Steps[number] = c },
	)
}

// updateModels records the models of a task the way task.Service does, on
// copies of the maps: what the call says nothing about is kept.
func (m *memTasks) updateModels(id, label string, mutate func(*task.Models)) (task.Task, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, label)
	if m.err != nil {
		return task.Task{}, m.err
	}
	index := m.indexOf(id)
	if index < 0 {
		return task.Task{}, task.ErrNotFound
	}
	choices := task.Models{
		Stages: maps.Clone(m.items[index].Models.Stages),
		Steps:  maps.Clone(m.items[index].Models.Steps),
	}
	if choices.Stages == nil {
		choices.Stages = models.Set{}
	}
	if choices.Steps == nil {
		choices.Steps = map[int]models.Choice{}
	}
	mutate(&choices)
	m.items[index].Models = choices
	return m.items[index], nil
}

// setModels is the model and effort of the stages and the steps of a task,
// which is what the user chose before the flow ran. A test may set them before
// the helper that seeds the task, and then they wait for it: a session has to
// find its choice there the moment it starts.
func (m *memTasks) setModels(id string, choices task.Models) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.seeded[id] = choices
	if index := m.indexOf(id); index >= 0 {
		m.items[index].Models = choices
	}
}

func (m *memTasks) SetReviewMode(_ context.Context, id string, mode reviewmode.Mode) (task.Task, error) {
	return m.updateReviewModes(id, "reviewMode:"+id+":"+string(mode), func(modes *task.ReviewModes) {
		modes.Task = mode
	})
}

func (m *memTasks) SetStepReviewMode(_ context.Context, id string, number int, mode reviewmode.Mode) (task.Task, error) {
	return m.updateReviewModes(
		id,
		"stepReviewMode:"+id+":"+strconv.Itoa(number)+":"+string(mode),
		func(modes *task.ReviewModes) { modes.Steps[number] = mode },
	)
}

func (m *memTasks) ClearStepReviewMode(_ context.Context, id string, number int) (task.Task, error) {
	return m.updateReviewModes(
		id,
		"clearStepReviewMode:"+id+":"+strconv.Itoa(number),
		func(modes *task.ReviewModes) { delete(modes.Steps, number) },
	)
}

// updateReviewModes records the review modes of a task the way task.Service
// does, on a copy of the map: what the call says nothing about is kept.
func (m *memTasks) updateReviewModes(id, label string, mutate func(*task.ReviewModes)) (task.Task, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, label)
	if m.err != nil {
		return task.Task{}, m.err
	}
	index := m.indexOf(id)
	if index < 0 {
		return task.Task{}, task.ErrNotFound
	}
	modes := task.ReviewModes{
		Task:  m.items[index].ReviewModes.Task,
		Steps: maps.Clone(m.items[index].ReviewModes.Steps),
	}
	if modes.Steps == nil {
		modes.Steps = map[int]reviewmode.Mode{}
	}
	mutate(&modes)
	m.items[index].ReviewModes = modes
	return m.items[index], nil
}

// setStepReports adds reports to what the disk holds for a step, which is how a
// test says the reviewer wrote them. The maps and the slices go out with every
// copy of the artifacts, so they are replaced rather than changed.
func (m *memTasks) setStepReports(id string, number int, reports ...task.ReviewReport) {
	m.mu.Lock()
	defer m.mu.Unlock()

	a := m.artifacts[id]
	a.StepReports = maps.Clone(a.StepReports)
	if a.StepReports == nil {
		a.StepReports = map[int][]task.ReviewReport{}
	}
	a.StepReports[number] = append(slices.Clone(a.StepReports[number]), reports...)
	m.artifacts[id] = a
}

// setReviewModes is the review mode of a task and of its steps, which is what
// the user chose before the flow ran. Like setModels, it may come before the
// helper that seeds the task.
func (m *memTasks) setReviewModes(id string, modes task.ReviewModes) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.seededModes[id] = modes
	if index := m.indexOf(id); index >= 0 {
		m.items[index].ReviewModes = modes
	}
}

// setTaskMode is the mode a task was created in. It comes before the helper
// that seeds the task, which gives a One-Shot task its repository.
func (m *memTasks) setTaskMode(id string, mode task.Mode) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.seededTaskModes[id] = mode
}

func (m *memTasks) RemoveArtifacts(_ context.Context, id string, from task.Stage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "remove:"+id+":"+string(from))
	if m.err != nil {
		return m.err
	}
	var mode task.Mode
	if index := m.indexOf(id); index >= 0 {
		mode = m.items[index].Mode
	}
	a := m.artifacts[id]
	for _, stage := range mode.From(from) {
		switch stage {
		case task.StagePRD:
			a.PRD = false
		case task.StageTechSpec:
			a.TechSpec = false
		case task.StagePlan:
			a.Plan = task.Plan{}
		case task.StageOneShot:
			a.OneShot = false
			a.Plan = task.Plan{}
		case task.StageImplementation:
			a.StepReports = nil
		case task.StagePR:
			a.PR = task.PRArtifacts{}
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

func (m *memTasks) PRRun(id string) (task.PRRun, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	run, ok := m.prs[id]
	return run, ok
}

func (m *memTasks) SetPRRun(
	_ context.Context, id string, status task.PRStatus, block *task.PRBlock,
) (task.PRRun, error) {
	return m.updatePRRun(id, "pr:"+string(status), func(run *task.PRRun) {
		run.Status, run.Block = status, block
	})
}

func (m *memTasks) SetPRDetails(_ context.Context, id string, pr task.PRDetails) (task.PRRun, error) {
	return m.updatePRRun(id, "prDetails", func(run *task.PRRun) { run.PR = pr })
}

func (m *memTasks) SetPRClosed(_ context.Context, id string, result task.CloseResult) (task.PRRun, error) {
	return m.updatePRRun(id, "prClosed", func(run *task.PRRun) {
		copied := result
		run.Status, run.Block, run.Close = task.PRClosed, nil, &copied
	})
}

func (m *memTasks) SetPRReviewed(_ context.Context, id, commit string, pass int) (task.PRRun, error) {
	return m.updatePRRun(id, "prReviewed:"+strconv.Itoa(pass), func(run *task.PRRun) {
		run.ReviewedCommit, run.ReportedPass = commit, pass
	})
}

func (m *memTasks) SetPRBaseline(_ context.Context, id string, baseline gh.Trouble) (task.PRRun, error) {
	return m.updatePRRun(id, "prBaseline", func(run *task.PRRun) {
		run.TroubleBaseline, run.Trouble = baseline, gh.Trouble{}
	})
}

func (m *memTasks) SetPRTrouble(_ context.Context, id string, trouble gh.Trouble) (task.PRRun, error) {
	return m.updatePRRun(id, "prTrouble", func(run *task.PRRun) { run.Trouble = trouble })
}

func (m *memTasks) ClearPRRun(_ context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "clearPR:"+id)
	if m.err != nil {
		return m.err
	}
	delete(m.prs, id)
	delete(m.passes, id)
	return nil
}

func (m *memTasks) PRPasses(id string) []task.PRPass {
	m.mu.Lock()
	defer m.mu.Unlock()

	return clonePasses(m.passes[id])
}

// clonePasses copies passes with their findings, so that a caller never shares
// them with the fake.
func clonePasses(passes []task.PRPass) []task.PRPass {
	out := slices.Clone(passes)
	for i := range out {
		out[i].Findings = slices.Clone(out[i].Findings)
	}
	return out
}

// setPRPasses seeds the structured passes of a task, which is how a test says
// what the app asked for and recorded.
func (m *memTasks) setPRPasses(id string, passes ...task.PRPass) {
	m.mu.Lock()
	defer m.mu.Unlock()

	passes = clonePasses(passes)
	for i := range passes {
		passes[i].TaskID = id
	}
	m.passes[id] = passes
}

// writePass stores a pass the way task.Service does: the row of the same pass
// is replaced, and the rows are kept in order of pass. The caller holds the lock.
func (m *memTasks) writePass(pass task.PRPass) {
	passes := m.passes[pass.TaskID]
	if index := slices.IndexFunc(passes, func(p task.PRPass) bool { return p.Pass == pass.Pass }); index >= 0 {
		passes[index] = pass
		return
	}
	passes = append(passes, pass)
	slices.SortFunc(passes, func(a, b task.PRPass) int { return a.Pass - b.Pass })
	m.passes[pass.TaskID] = passes
}

// mutatePass changes a stored pass and records the call, failing like the
// store does.
func (m *memTasks) mutatePass(id string, pass int, label string, mutate func(*task.PRPass) error) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, label+":"+id+":"+strconv.Itoa(pass))
	if m.err != nil {
		return m.err
	}
	index := slices.IndexFunc(m.passes[id], func(p task.PRPass) bool { return p.Pass == pass })
	if index < 0 {
		return task.ErrNotFound
	}
	stored := m.passes[id][index]
	stored.Findings = slices.Clone(stored.Findings)
	if err := mutate(&stored); err != nil {
		return err
	}
	m.passes[id][index] = stored
	return nil
}

func (m *memTasks) AskPRPass(_ context.Context, id string, pass int) (task.PRPass, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "askPRPass:"+id+":"+strconv.Itoa(pass))
	if m.err != nil {
		return task.PRPass{}, m.err
	}
	if index := slices.IndexFunc(m.passes[id], func(p task.PRPass) bool { return p.Pass == pass }); index >= 0 &&
		m.passes[id][index].Recorded {
		return task.PRPass{}, task.ErrPRPassRecorded
	}
	asked := task.PRPass{TaskID: id, Pass: pass, AskedAt: time.Now().UTC()}
	m.writePass(asked)
	return asked, nil
}

func (m *memTasks) UnaskPRPass(_ context.Context, id string, pass int) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "unaskPRPass:"+id+":"+strconv.Itoa(pass))
	if m.err != nil {
		return m.err
	}
	m.passes[id] = slices.DeleteFunc(m.passes[id], func(p task.PRPass) bool { return p.Pass == pass && !p.Recorded })
	return nil
}

func (m *memTasks) RecordPRReport(
	_ context.Context, id string, report prreport.Report,
) (task.PRPass, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "recordPRReport:"+id+":"+strconv.Itoa(report.Pass))
	if err := cmp.Or(m.err, m.recordErr); err != nil {
		return task.PRPass{}, false, err
	}
	index := slices.IndexFunc(m.passes[id], func(p task.PRPass) bool { return p.Pass == report.Pass })
	if index < 0 {
		return task.PRPass{}, false, task.ErrNotFound
	}
	stored := m.passes[id][index]
	stored.Findings = slices.Clone(stored.Findings)
	switch {
	case stored.Sent():
		return stored, false, nil
	case !stored.Recorded:
		stored.Recorded, stored.Clean, stored.SummaryOriginal = true, report.Clean, report.Summary
		stored.Revision, stored.RecordedAt = 1, time.Now().UTC()
		stored.Findings = prreport.Fresh(report.Findings)
	case prreport.Same(stored.SummaryOriginal, stored.Findings, report):
		return stored, false, nil
	default:
		stored.SummaryOriginal, stored.Clean = report.Summary, report.Clean
		stored.Findings = prreport.Inherit(stored.Findings, report.Findings)
		stored.Revision++
	}
	m.passes[id][index] = stored
	return stored, true, nil
}

func (m *memTasks) DecidePRFinding(
	_ context.Context, id string, pass, number int, d prreport.Decision,
) error {
	return m.mutatePass(id, pass, "decidePRFinding:"+strconv.Itoa(number), func(p *task.PRPass) error {
		if _, err := prreport.ParseDecision(string(d)); err != nil {
			return err
		}
		index := slices.IndexFunc(p.Findings, func(f prreport.Finding) bool { return f.Number == number })
		if index < 0 {
			return task.ErrNotFound
		}
		p.Findings[index].Decision = d
		return nil
	})
}

func (m *memTasks) SetPRFindingText(_ context.Context, id string, pass, number int, text string) error {
	return m.mutatePass(id, pass, "setPRFindingText:"+strconv.Itoa(number), func(p *task.PRPass) error {
		text = strings.TrimSpace(text)
		if text == "" {
			return prreport.ErrEmptyText
		}
		index := slices.IndexFunc(p.Findings, func(f prreport.Finding) bool { return f.Number == number })
		if index < 0 {
			return task.ErrNotFound
		}
		p.Findings[index].Text = text
		return nil
	})
}

func (m *memTasks) ApproveRestOfPRFindings(_ context.Context, id string, pass int) error {
	return m.mutatePass(id, pass, "approveRestOfPRFindings", func(p *task.PRPass) error {
		for i := range p.Findings {
			if p.Findings[i].Decision == prreport.DecisionNone {
				p.Findings[i].Decision = prreport.DecisionApproved
			}
		}
		return nil
	})
}

func (m *memTasks) MarkPRPassSent(_ context.Context, id string, pass int) error {
	return m.mutatePass(id, pass, "markPRPassSent", func(p *task.PRPass) error {
		p.SentAt = time.Now().UTC()
		return nil
	})
}

func (m *memTasks) UnmarkPRPassSent(_ context.Context, id string, pass int) error {
	return m.mutatePass(id, pass, "unmarkPRPassSent", func(p *task.PRPass) error {
		p.SentAt = time.Time{}
		return nil
	})
}

// updatePRRun records the state of the PR stage the way task.Service does:
// what the call says nothing about is kept.
func (m *memTasks) updatePRRun(id, label string, mutate func(*task.PRRun)) (task.PRRun, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, label+":"+id)
	if m.err != nil {
		return task.PRRun{}, m.err
	}

	run, ok := m.prs[id]
	if !ok {
		run = task.PRRun{TaskID: id}
	}
	mutate(&run)
	m.prs[id] = run
	return run, nil
}

// prRun is what the fake recorded about the PR stage of a task, if anything.
func (m *memTasks) prRun(id string) (task.PRRun, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	run, ok := m.prs[id]
	return run, ok
}

// setPRRun seeds the record of the PR stage, which is how a test says what the
// app recorded before it closed.
func (m *memTasks) setPRRun(id string, run task.PRRun) {
	m.mu.Lock()
	defer m.mu.Unlock()

	run.TaskID = id
	m.prs[id] = run
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

func (m *memTasks) SetStepCommitted(
	_ context.Context, id string, number int, sha, subject string, committedAt time.Time,
) (task.StepRun, error) {
	return m.updateRun(id, number, task.StepDone, func(run *task.StepRun) {
		run.CommitSHA, run.CommitSubject, run.CommittedAt = sha, subject, committedAt
	})
}

func (m *memTasks) SetStepPass(_ context.Context, id string, number, pass int) (task.StepRun, error) {
	label := "stepPass:" + id + ":" + strconv.Itoa(number) + ":" + strconv.Itoa(pass)
	return m.updateReview(id, number, label, func(run *task.StepRun) {
		run.ReviewPass = pass
	})
}

func (m *memTasks) SetStepReported(_ context.Context, id string, number, pass int) (task.StepRun, error) {
	label := "stepReported:" + id + ":" + strconv.Itoa(number) + ":" + strconv.Itoa(pass)
	return m.updateReview(id, number, label, func(run *task.StepRun) {
		run.ReportedPass = pass
	})
}

func (m *memTasks) SetStepFallback(
	_ context.Context, id string, number int, fallback task.ReviewFallback,
) (task.StepRun, error) {
	label := "stepFallback:" + id + ":" + strconv.Itoa(number) + ":" + string(fallback)
	return m.updateReview(id, number, label, func(run *task.StepRun) {
		run.Fallback = fallback
	})
}

func (m *memTasks) ClearStepReview(_ context.Context, id string, number int) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "clearStepReview:"+id+":"+strconv.Itoa(number))
	if m.err != nil {
		return m.err
	}
	if index := slices.IndexFunc(m.runs[id], func(r task.StepRun) bool { return r.Number == number }); index >= 0 {
		run := &m.runs[id][index]
		run.ReviewPass, run.ReportedPass, run.Fallback = 0, 0, ""
	}
	// The map goes out with every copy of the artifacts, so it is replaced
	// rather than changed.
	a := m.artifacts[id]
	a.StepReports = maps.Clone(a.StepReports)
	delete(a.StepReports, number)
	m.artifacts[id] = a
	return nil
}

// updateReview records how far the agent review of a step got the way
// task.Service does: unlike updateRun, it keeps the status of the run.
func (m *memTasks) updateReview(
	id string, number int, label string, mutate func(*task.StepRun),
) (task.StepRun, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, label)
	if m.err != nil {
		return task.StepRun{}, m.err
	}

	runs := m.runs[id]
	run := task.StepRun{TaskID: id, Number: number}
	index := slices.IndexFunc(runs, func(r task.StepRun) bool { return r.Number == number })
	if index >= 0 {
		run = runs[index]
	}
	mutate(&run)

	if index < 0 {
		m.runs[id] = append(runs, run)
	} else {
		runs[index] = run
	}
	return run, nil
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
	delete(m.passes, id)
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
		ID:           id,
		RepositoryID: repoID,
		Name:         id,
		Mode:         m.seededTaskModes[id],
		Stage:        stage,
		ArtifactsDir: filepath.Join(dataDir, id),
		Models:       m.seeded[id],
		ReviewModes:  m.seededModes[id],
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

// useCard gives a task the card of the board it was created from.
func (m *memTasks) useCard(id string, c task.Card) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if index := m.indexOf(id); index >= 0 {
		m.items[index].Card = &c
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

// failRecord makes recording the report of a pass return err, nil to let it
// through again.
func (m *memTasks) failRecord(err error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.recordErr = err
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
	replies   map[session.Key]string // what the agent of a session said last
	calls     []string
	messages  []string
	apps      []session.AppMessage // every message of the app, with its kind and numbers
	markers   []keyedMarker        // every marker of the Mark methods but the reviews'
	err       error                // returned by every call that changes something
}

func newSessions() *memSessions {
	return &memSessions{
		summaries: map[session.Key]session.Summary{},
		infos:     map[session.Key]session.TaskInfo{},
		replies:   map[session.Key]string{},
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

func (m *memSessions) Exists(_ context.Context, k session.Key) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.err != nil {
		return false, m.err
	}
	_, ok := m.summaries[k]
	return ok, nil
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

func (m *memSessions) ForgetTask(taskID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "forgetTask:"+taskID)
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

func (m *memSessions) Interrupt(_ context.Context, k session.Key) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "interrupt:"+k.TaskID+":"+k.Stage)
	return m.err
}

func (m *memSessions) SetChoice(_ context.Context, k session.Key, c models.Choice) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "choice:"+k.TaskID+":"+k.Stage+":"+string(c.Model)+":"+string(c.Effort))
	if m.err != nil {
		return m.err
	}
	sum, ok := m.summaries[k]
	if !ok {
		return session.ErrNotFound
	}
	sum.Choice = c
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

func (m *memSessions) LastReply(k session.Key) string {
	m.mu.Lock()
	defer m.mu.Unlock()

	return m.replies[k]
}

// setReply is what the agent of a session said last.
func (m *memSessions) setReply(k session.Key, text string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.replies[k] = text
}

func (m *memSessions) SendFromApp(_ context.Context, k session.Key, msg session.AppMessage) error {
	return m.send(k, msg, false)
}

func (m *memSessions) SendCorrection(_ context.Context, k session.Key, msg session.AppMessage) error {
	return m.send(k, msg, true)
}

func (m *memSessions) MarkPRReview(_ context.Context, k session.Key, pass int, clean bool, findings int) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls,
		"mark:"+k.TaskID+":"+k.Stage+":pass="+strconv.Itoa(pass)+":clean="+strconv.FormatBool(clean))
	m.markers = append(m.markers, keyedMarker{
		Key: k, Marker: reportMarker(session.MarkerPRReviewWritten, pass, clean, findings),
	})
}

func (m *memSessions) MarkPRReviewRevised(_ context.Context, k session.Key, pass int, clean bool, findings int) {
	m.mark(k, reportMarker(session.MarkerPRReviewRevised, pass, clean, findings))
}

// reportMarker is the marker of a written or revised report, with the count of
// findings when there is one (-1 unknown).
func reportMarker(t session.MarkerType, pass int, clean bool, findings int) session.MarkerEntry {
	marker := session.MarkerEntry{Type: t, Pass: pass, Clean: clean}
	if findings >= 0 {
		marker.Findings = &findings
	}
	return marker
}

// MarkFindingsDecided records nothing when the last marker of the pass says the
// same, as the session service does.
func (m *memSessions) MarkFindingsDecided(_ context.Context, k session.Key, pass, approved, discarded int) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, km := range slices.Backward(m.markers) {
		if km.Key != k || km.Marker.Type != session.MarkerFindingsDecided || km.Marker.Pass != pass {
			continue
		}
		if km.Marker.Approved == approved && km.Marker.Discarded == discarded {
			return
		}
		break
	}
	m.markers = append(m.markers, keyedMarker{Key: k, Marker: session.MarkerEntry{
		Type: session.MarkerFindingsDecided, Pass: pass, Approved: approved, Discarded: discarded,
	}})
}

func (m *memSessions) MarkStepReview(_ context.Context, k session.Key, pass int, clean bool, findings int) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "markStep:"+k.TaskID+":"+k.Stage+":pass="+strconv.Itoa(pass)+
		":clean="+strconv.FormatBool(clean)+":findings="+strconv.Itoa(findings))
}

// keyedMarker is a marker and the session it was recorded in.
type keyedMarker struct {
	Key    session.Key
	Marker session.MarkerEntry
}

func (m *memSessions) mark(k session.Key, marker session.MarkerEntry) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.markers = append(m.markers, keyedMarker{Key: k, Marker: marker})
}

func (m *memSessions) MarkCommitted(_ context.Context, k session.Key, sha, subject string, pushed bool, number int) {
	m.mark(k, session.MarkerEntry{
		Type: session.MarkerCommitted, SHA: sha, Subject: subject, Pushed: pushed, Number: number,
	})
}

// MarkPROpened records nothing when the session already has the pull request
// marked opened, as the session service does.
func (m *memSessions) MarkPROpened(_ context.Context, k session.Key, number int, base string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	opened := slices.ContainsFunc(m.markers, func(km keyedMarker) bool {
		return km.Key == k && km.Marker.Type == session.MarkerPROpened && km.Marker.Number == number
	})
	if !opened {
		m.markers = append(m.markers, keyedMarker{
			Key: k, Marker: session.MarkerEntry{Type: session.MarkerPROpened, Number: number, Base: base},
		})
	}
}

func (m *memSessions) MarkChecksRead(
	_ context.Context, k session.Key, pass, passed, total int, failed []string, conflict bool,
) {
	m.mark(k, session.MarkerEntry{
		Type: session.MarkerChecksRead, Pass: pass, Passed: passed, Total: total, Failed: failed, Conflict: conflict,
	})
}

func (m *memSessions) MarkDraftApproved(_ context.Context, k session.Key, title string) {
	m.mark(k, session.MarkerEntry{Type: session.MarkerDraftApproved, Title: title})
}

func (m *memSessions) MarkChangesApproved(_ context.Context, k session.Key, files int) {
	m.mark(k, session.MarkerEntry{Type: session.MarkerChangesApproved, Files: files})
}

func (m *memSessions) MarkPlanInvalid(_ context.Context, k session.Key, problems []session.PlanProblem) {
	m.mark(k, session.MarkerEntry{Type: session.MarkerPlanInvalid, Problems: problems})
}

// marked is every marker recorded of type t.
func (m *memSessions) marked(t session.MarkerType) []keyedMarker {
	m.mu.Lock()
	defer m.mu.Unlock()

	var out []keyedMarker
	for _, km := range m.markers {
		if km.Marker.Type == t {
			out = append(out, km)
		}
	}
	return out
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

// send records a message of the app, counting it as the service would.
func (m *memSessions) send(k session.Key, msg session.AppMessage, correction bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "send:"+k.TaskID+":"+k.Stage)
	if m.err != nil {
		return m.err
	}
	m.messages = append(m.messages, msg.Text)
	m.apps = append(m.apps, msg)
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

// sentCount is how many messages of the app carried text, which a prompt of a
// review pass does ahead of the sections the app appends to it.
func (m *memSessions) sentCount(text string) int {
	m.mu.Lock()
	defer m.mu.Unlock()

	n := 0
	for _, message := range m.messages {
		if strings.Contains(message, text) {
			n++
		}
	}
	return n
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
	items     map[string]worktree.Worktree // by task id
	calls     []string
	status    git.Status
	base      string // the ref every branch is said to come from
	merged    bool   // whether git sees every branch in the base it is asked about
	baseErr   error
	mergedErr error
	ahead     int // how many commits every branch is said to have past the base
	aheadErr  error
	subject   string           // the subject every commit reading answers with
	committed time.Time        // the committer date every commit reading answers with
	phases    []worktree.Phase // reported by every Ensure
	ensureErr error
	statusErr error
	commitErr error
	cleanErr  error
	removeErr error
	block     chan struct{} // when set, Ensure waits on it or on the context
	linger    chan struct{} // when set, a cancelled Ensure waits on it before it returns
	hold      chan struct{} // when set, Close waits on it after it recorded the call

	closeResult task.CloseResult // what every closing answers with
	closeCalls  []closeCall      // the closings the flow asked for, in order
	leftover    *worktree.Leftover
	purged      []string // the tasks Purge was called for
}

// closeCall is one closing of a task, with what the flow decided about the
// base branch and the branch of the worktree.
type closeCall struct {
	taskID string
	base   string
	policy worktree.BranchPolicy
}

func newWorktrees() *memWorktrees {
	return &memWorktrees{
		items:     map[string]worktree.Worktree{},
		subject:   "Do the work of the step",
		committed: commitTime,
		phases:    []worktree.Phase{worktree.PhaseFetching, worktree.PhaseCreating},
		base:      "origin/dev",
		closeResult: task.CloseResult{
			Worktree:    task.CloseStep{Outcome: task.OutcomeDone},
			Branch:      task.CloseStep{Outcome: task.OutcomeDone},
			Base:        task.CloseStep{Outcome: task.OutcomeDone},
			BaseCommits: 3,
		},
	}
}

// setCloseResult is what every closing of a task answers with.
func (m *memWorktrees) setCloseResult(result task.CloseResult) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.closeResult = result
}

// setLeftover is what every purge of a task answers with: what git could not
// take back.
func (m *memWorktrees) setLeftover(left worktree.Leftover) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.leftover = &left
}

// closings are the closings the flow asked for, in order.
func (m *memWorktrees) closings() []closeCall {
	m.mu.Lock()
	defer m.mu.Unlock()

	return slices.Clone(m.closeCalls)
}

func (m *memWorktrees) Get(taskID string) (worktree.Worktree, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	wt, ok := m.items[taskID]
	return wt, ok
}

func (m *memWorktrees) Base(_ context.Context, wt worktree.Worktree) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "base:"+wt.TaskID)
	if m.baseErr != nil {
		return "", m.baseErr
	}
	return m.base, nil
}

func (m *memWorktrees) Ensure(
	ctx context.Context, t task.Task, registered repository.Repository, onPhase func(worktree.Phase),
) (worktree.Worktree, error) {
	m.mu.Lock()
	m.calls = append(m.calls, "ensure:"+t.ID+":"+registered.FullName())
	block, linger, phases, err := m.block, m.linger, slices.Clone(m.phases), m.ensureErr
	m.mu.Unlock()

	if block != nil {
		select {
		case <-block:
		case <-ctx.Done():
			if linger != nil {
				<-linger
			}
			return worktree.Worktree{}, ctx.Err()
		}
	}
	for _, phase := range phases {
		onPhase(phase)
	}
	if err != nil {
		return worktree.Worktree{}, err
	}
	if wt, ok := m.Get(t.ID); ok {
		return wt, nil
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	wt := worktree.Worktree{
		TaskID:   t.ID,
		RepoPath: registered.Path,
		Path:     worktree.Path(dataDir, registered.Owner, registered.Name, t.Name),
		Branch:   t.Name,
	}
	m.items[t.ID] = wt
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

// failCommits makes every commit reading fail.
func (m *memWorktrees) failCommits(err error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.commitErr = err
}

func (m *memWorktrees) Commit(_ context.Context, wt worktree.Worktree, rev string) (git.Commit, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "commit:"+wt.TaskID+":"+rev)
	if m.commitErr != nil {
		return git.Commit{}, m.commitErr
	}
	return git.Commit{SHA: rev, Subject: m.subject, CommittedAt: m.committed}, nil
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

	m.calls = append(m.calls, "merged:"+wt.TaskID+":"+base)
	if m.mergedErr != nil {
		return false, m.mergedErr
	}
	return m.merged, nil
}

func (m *memWorktrees) Ahead(_ context.Context, wt worktree.Worktree, base string) (int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "ahead:"+wt.TaskID+":"+base)
	if m.aheadErr != nil {
		return 0, m.aheadErr
	}
	return m.ahead, nil
}

func (m *memWorktrees) Close(
	_ context.Context, wt worktree.Worktree, base string, policy worktree.BranchPolicy,
) task.CloseResult {
	m.mu.Lock()
	m.calls = append(m.calls, "close:"+wt.TaskID)
	m.closeCalls = append(m.closeCalls, closeCall{taskID: wt.TaskID, base: base, policy: policy})
	hold := m.hold
	m.mu.Unlock()

	// Git goes on after the context is cancelled: what it does is not cut short.
	if hold != nil {
		<-hold
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	// The real service forgets the worktree whatever git did, so the fake does
	// too: nothing there is the app's any more.
	delete(m.items, wt.TaskID)
	result := m.closeResult
	result.WorktreePath, result.BranchName, result.BaseBranch = wt.Path, wt.Branch, base
	return result
}

// holdClose keeps every closing running until the returned channel is closed,
// which is how a test keeps the work of the PR stage under way.
func (m *memWorktrees) holdClose() chan struct{} {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.hold = make(chan struct{})
	return m.hold
}

func (m *memWorktrees) Purge(_ context.Context, taskID string) (worktree.Leftover, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "purge:"+taskID)
	m.purged = append(m.purged, taskID)
	delete(m.items, taskID)
	if m.leftover == nil {
		return worktree.Leftover{}, false
	}
	return *m.leftover, true
}

func (m *memWorktrees) Remove(_ context.Context, taskID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.calls = append(m.calls, "remove:"+taskID)
	if m.removeErr != nil {
		return m.removeErr
	}
	delete(m.items, taskID)
	return nil
}

// failBase makes every reading of the base of a branch fail with err.
func (m *memWorktrees) failBase(err error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.baseErr = err
}

// seed registers a worktree the way a previous run of the app left it.
func (m *memWorktrees) seed(t task.Task) worktree.Worktree {
	return m.seedAt(t, worktree.Path(dataDir, repo.Owner, repo.Name, t.Name))
}

// seedAt registers a worktree at a path of the test's choosing, which is how a
// test says whether the folder of the worktree is still on disk.
func (m *memWorktrees) seedAt(t task.Task, path string) worktree.Worktree {
	m.mu.Lock()
	defer m.mu.Unlock()

	wt := worktree.Worktree{
		TaskID:   t.ID,
		RepoPath: repo.Path,
		Path:     path,
		Branch:   t.Name,
		Base:     m.base,
	}
	m.items[t.ID] = wt
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

// lingerOnCancel keeps a cancelled creation of a worktree running until the
// returned channel is closed, as git goes on writing for a moment after it is
// told to stop.
func (m *memWorktrees) lingerOnCancel() chan struct{} {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.linger = make(chan struct{})
	return m.linger
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

func (m *memReviews) Snapshot(string) (review.Snapshot, bool) {
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

// setPR is the pull request every reading of a branch answers with. A pull
// request seeded without a merge state has checks that settle a wait at once:
// one check that passed, and a branch that merges clean.
func (m *memGH) setPR(branch string, pr gh.PR) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if pr.Checks.Mergeable == "" {
		pr.Checks = passedChecks()
	}
	m.prs[branch] = pr
}

// forgetPR makes the readings of a branch find no pull request again.
func (m *memGH) forgetPR(branch string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.prs, branch)
}

// viewCount is how many times the pull request of a branch was read.
func (m *memGH) viewCount(branch string) int {
	m.mu.Lock()
	defer m.mu.Unlock()

	n := 0
	for _, call := range m.calls {
		if strings.HasPrefix(call, "view:") && strings.HasSuffix(call, ":"+branch) {
			n++
		}
	}
	return n
}

// passedChecks is a reading of GitHub that lets a pass start at once: one check
// that passed, and a branch that merges clean.
func passedChecks() gh.PRChecks {
	return gh.PRChecks{
		Checks:    []gh.Check{{Name: "test", URL: "https://github.com/acme/api/runs/1", Conclusion: "success"}},
		Mergeable: gh.MergeableClean,
	}
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

// commitAllPrompt is what the fake renderer answers with for the commit stage
// when the commit takes every change of the worktree, which is the commit the
// agent review asks for.
func commitAllPrompt(name string) string { return "Commit every change of " + name }

// reviewPrompt is what the fake renderer answers with for the prompt of a
// review pass, with the report it is about.
func reviewPrompt(path string) string { return "Review the pull request into " + path }

// instructedReviewPrompt is the prompt of a review pass that carries the fixed
// review instructions of the repository.
func instructedReviewPrompt(path, instructions string) string {
	return reviewPrompt(path) + " following " + instructions
}

// oneShotReviewPrompt is the prompt of a review pass of a One-Shot task, which
// also names the document of the task.
func oneShotReviewPrompt(path, document string) string {
	return reviewPrompt(path) + " against " + document
}

// githubStatus is the section the fake renderer ends the prompt of a review
// pass with, like the real one.
func githubStatus(checks *gh.PRChecks, mergeBase string) string {
	return "\n\n## GitHub status\n\n" + prompts.PRChecksSection(checks, mergeBase)
}

// fixture is a flow.Service over the four fakes.
type fixture struct {
	service      *flow.Service
	tasks        *memTasks
	sessions     *memSessions
	worktrees    *memWorktrees
	repositories *memRepositories
	reviews      *memReviews
	gh           *memGH
}

func newFixture(t *testing.T) *fixture {
	t.Helper()

	f := &fixture{
		tasks:        newTasks(),
		sessions:     newSessions(),
		worktrees:    newWorktrees(),
		repositories: newRepositories(),
		reviews:      newReviews(),
		gh:           newGH(),
	}
	f.service = flow.New(flow.Deps{
		Tasks:        f.tasks,
		Sessions:     f.sessions,
		Worktrees:    f.worktrees,
		Repositories: f.repositories,
		Review:       f.reviews,
		GH:           f.gh,
		RenderPrompt: func(stage prompts.Stage, vars prompts.Vars) (string, error) {
			switch stage {
			case prompts.StageCommit:
				if vars.CommitAll {
					return commitAllPrompt(vars.TaskName), nil
				}
				return commitPrompt(vars.TaskName, vars.Push), nil
			case prompts.StagePRReview:
				status := githubStatus(vars.Checks, vars.MergeBase)
				switch {
				case vars.OneShotPath != "":
					return oneShotReviewPrompt(vars.ReviewPath, vars.OneShotPath) + status, nil
				case vars.Instructions != "":
					return instructedReviewPrompt(vars.ReviewPath, vars.Instructions) + status, nil
				}
				return reviewPrompt(vars.ReviewPath) + status, nil
			default:
				return "", errors.New("unexpected prompt stage " + string(stage))
			}
		},
	})
	t.Cleanup(f.service.Close)
	return f
}

// plan is a valid plan of one step.
func plan() task.Plan {
	return task.Plan{
		Present: true,
		Steps:   []task.Step{{Number: 1, File: "1-first.md", Title: "First"}},
	}
}

// brokenPlan is a plan whose only step has no title.
func brokenPlan() task.Plan {
	return task.Plan{
		Present:  true,
		Steps:    []task.Step{{Number: 1, File: "1-first.md"}},
		Problems: []task.PlanProblem{{File: "1-first.md", Message: `missing the title heading ("# Step N: Title")`}},
	}
}

// oneShotPlan is the plan task.Service derives for a One-Shot task: one step,
// the document itself.
func oneShotPlan() task.Plan {
	return task.Plan{
		Present: true,
		Steps:   []task.Step{{Number: 1, File: task.OneShotFile, Title: "Login screen"}},
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

// waitEvaluated waits for an evaluation asked for after the flow had read the
// disk before times to be over, not only to have begun. An evaluation holds the
// lock of the task from its reading of the disk to its end, and Continue waits
// for that lock before it refuses a task that is not revisiting, which is what
// a test that proves the flow did nothing needs.
func (f *fixture) waitEvaluated(t *testing.T, id string, before int) {
	t.Helper()

	f.waitEvaluations(t, before+1)
	wantErrIs(t, f.service.Continue(t.Context(), id), flow.ErrNotRevisiting)
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

// reviewerKey is the session that reviews a step of a task.
func reviewerKey(id string, number int) session.Key {
	return session.Key{TaskID: id, Stage: session.StepReviewStage(number)}
}

// waitReviewer polls until the session that reviews a step has been opened. The
// pass is recorded before the reviewer starts, so a test that waits on the
// status alone can still be ahead of the Start call.
func (f *fixture) waitReviewer(t *testing.T, id string, number int) {
	t.Helper()

	waitFor(t, "the reviewer of step "+strconv.Itoa(number)+" of "+id, func() bool {
		_, ok := f.sessions.Summary(reviewerKey(id, number))
		return ok
	})
}

// stepReport is the report of one pass of the agent review of a step, as the
// disk holds it: two findings when it asks for changes.
func stepReport(number, pass int, clean bool) task.ReviewReport {
	findings := 2
	if clean {
		findings = 0
	}
	return task.ReviewReport{Pass: pass, File: task.StepReportFile(number, pass), Clean: clean, Findings: findings}
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

// failRemove makes every removal of the worktree of a task fail with err.
func (m *memWorktrees) failRemove(err error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.removeErr = err
}
