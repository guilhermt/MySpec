// Package flow drives a task through its stages: it notices when a stage is
// done, starts the next one, and carries out the user's back, discard and
// continue.
package flow

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

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

// Tasks is what the flow needs from internal/task.
type Tasks interface {
	Get(id string) (task.Task, bool)
	Lookup(id string) (task.Task, bool) // active tasks and the history
	List() []task.Task
	ListArchived() []task.Task
	Archive(ctx context.Context, id string) (task.Task, error)
	Artifacts(id string) (task.Artifacts, bool) // the last inspection, for snapshots
	Inspect(id string) (task.Artifacts, error)
	ReadArtifact(id, name string) (string, error)
	SetStage(ctx context.Context, id string, stage task.Stage, revisiting bool) (task.Task, error)
	SetStageModel(ctx context.Context, id string, stage models.Stage, c models.Choice) (task.Task, error)
	SetStepModel(ctx context.Context, id string, number int, c models.Choice) (task.Task, error)
	SetReviewMode(ctx context.Context, id string, mode reviewmode.Mode) (task.Task, error)
	SetStepReviewMode(ctx context.Context, id string, number int, mode reviewmode.Mode) (task.Task, error)
	ClearStepReviewMode(ctx context.Context, id string, number int) (task.Task, error)
	RemoveArtifacts(ctx context.Context, id string, from task.Stage) error
	PRRun(id string) (task.PRRun, bool)
	SetPRRun(ctx context.Context, id string, status task.PRStatus, block *task.PRBlock) (task.PRRun, error)
	SetPRDetails(ctx context.Context, id string, pr task.PRDetails) (task.PRRun, error)
	SetPRClosed(ctx context.Context, id string, result task.CloseResult) (task.PRRun, error)
	SetPRReviewed(ctx context.Context, id, commit string, pass int) (task.PRRun, error)
	SetPRBaseline(ctx context.Context, id string, baseline gh.Trouble) (task.PRRun, error)
	SetPRTrouble(ctx context.Context, id string, trouble gh.Trouble) (task.PRRun, error)
	ClearPRRun(ctx context.Context, id string) error
	PRPasses(id string) []task.PRPass
	AskPRPass(ctx context.Context, id string, pass int) (task.PRPass, error)
	UnaskPRPass(ctx context.Context, id string, pass int) error
	RecordPRReport(ctx context.Context, id string, report prreport.Report) (task.PRPass, bool, error)
	DecidePRFinding(ctx context.Context, id string, pass, number int, d prreport.Decision) error
	SetPRFindingText(ctx context.Context, id string, pass, number int, text string) error
	ApproveRestOfPRFindings(ctx context.Context, id string, pass int) error
	MarkPRPassSent(ctx context.Context, id string, pass int) error
	UnmarkPRPassSent(ctx context.Context, id string, pass int) error
	StepRuns(id string) []task.StepRun
	SetStepRun(ctx context.Context, id string, number int, status task.StepStatus, block *task.StepBlock) (task.StepRun, error)
	SetStepStarted(ctx context.Context, id string, number int, startCommit string) (task.StepRun, error)
	SetStepCommitted(
		ctx context.Context, id string, number int, sha, subject string, committedAt time.Time,
	) (task.StepRun, error)
	SetStepPass(ctx context.Context, id string, number, pass int) (task.StepRun, error)
	SetStepReported(ctx context.Context, id string, number, pass int) (task.StepRun, error)
	SetStepFallback(ctx context.Context, id string, number int, fallback task.ReviewFallback) (task.StepRun, error)
	ClearStepReview(ctx context.Context, id string, number int) error
	ClearStepRuns(ctx context.Context, id string) error
	Delete(ctx context.Context, id string) error
}

// Sessions is what the flow needs from internal/session.
type Sessions interface {
	Open(ctx context.Context, t session.TaskInfo) error
	Start(ctx context.Context, t session.TaskInfo, restarted bool) error
	Discard(ctx context.Context, taskID string, stages ...string) error
	Close(ctx context.Context, k session.Key) error
	Exists(ctx context.Context, k session.Key) (bool, error)
	CloseTask(ctx context.Context, taskID string) error
	DiscardTask(ctx context.Context, taskID string) error
	ForgetTask(taskID string)
	Resume(ctx context.Context, k session.Key) error
	Interrupt(ctx context.Context, k session.Key) error
	SetChoice(ctx context.Context, k session.Key, c models.Choice) error
	Summary(k session.Key) (session.Summary, bool)
	Summaries() map[session.Key]session.Summary
	LastReply(k session.Key) string
	SendFromApp(ctx context.Context, k session.Key, m session.AppMessage) error
	SendCorrection(ctx context.Context, k session.Key, m session.AppMessage) error
	MarkPRReview(ctx context.Context, k session.Key, pass int, clean bool, findings int)
	MarkPRReviewRevised(ctx context.Context, k session.Key, pass int, clean bool, findings int)
	MarkFindingsDecided(ctx context.Context, k session.Key, pass, approved, discarded int)
	MarkStepReview(ctx context.Context, k session.Key, pass int, clean bool, findings int)
	MarkCommitted(ctx context.Context, k session.Key, sha, subject string, pushed bool, number int)
	MarkPROpened(ctx context.Context, k session.Key, number int, base string)
	MarkChecksRead(ctx context.Context, k session.Key, pass, passed, total int, failed []string, conflict bool)
	MarkDraftApproved(ctx context.Context, k session.Key, title string)
	MarkChangesApproved(ctx context.Context, k session.Key, files int)
	MarkPlanInvalid(ctx context.Context, k session.Key, problems []session.PlanProblem)
}

// Repositories is what the flow needs from internal/repository.
type Repositories interface {
	Get(id string) (repository.Repository, bool)
	Missing(id string) bool                         // the last check, for snapshots
	Check(id string) (repository.Repository, error) // a check now, for what needs the clone
}

// Reviews is what the flow needs from internal/review.
type Reviews interface {
	Track(taskID string, wt worktree.Worktree, active bool)
	Refresh(taskID string) (review.Snapshot, bool)
	Snapshot(taskID string) (review.Snapshot, bool)
	Forget(taskID string)
}

// GH is what the flow needs from internal/gh: the readings that say whether a
// pull request can be opened and whether it already exists.
type GH interface {
	Auth(ctx context.Context) error
	ViewPR(ctx context.Context, dir, branch string) (gh.PR, error)
}

// Worktrees is what the flow needs from internal/worktree.
type Worktrees interface {
	Get(taskID string) (worktree.Worktree, bool)
	Base(ctx context.Context, wt worktree.Worktree) (string, error)
	Merged(ctx context.Context, wt worktree.Worktree, base string) (bool, error)
	Ensure(
		ctx context.Context, t task.Task, repo repository.Repository, onPhase func(worktree.Phase),
	) (worktree.Worktree, error)
	Status(ctx context.Context, wt worktree.Worktree) (git.Status, error)
	Commit(ctx context.Context, wt worktree.Worktree, rev string) (git.Commit, error)
	Clean(ctx context.Context, wt worktree.Worktree) error
	Close(ctx context.Context, wt worktree.Worktree, base string, policy worktree.BranchPolicy) task.CloseResult
	Purge(ctx context.Context, taskID string) (worktree.Leftover, bool)
	Remove(ctx context.Context, taskID string) error
}

// Deps are what Service needs from the outside.
type Deps struct {
	Tasks        Tasks
	Sessions     Sessions
	Worktrees    Worktrees
	Repositories Repositories
	Review       Reviews
	GH           GH
	Log          *slog.Logger
	// RenderPrompt turns a prompt of the data directory into the message the
	// app sends; the flow uses it for the commit prompt.
	RenderPrompt func(stage prompts.Stage, vars prompts.Vars) (string, error)
	// OnChange says that the in-memory state of a step changed, which is what
	// the phases of a preparation are; it may be nil.
	OnChange func(taskID string)
}

// MaxCorrections is how many times the app corrects an invalid plan on its
// own before leaving it to the user.
const MaxCorrections = 3

// evaluateTimeout bounds the database work of an evaluation, which runs on the
// flow's own goroutine.
const evaluateTimeout = 10 * time.Second

// prCheckTimeout bounds one gh command of the PR stage, which talks to GitHub.
const prCheckTimeout = 30 * time.Second

// The ways the flow refuses to move a task.
var (
	ErrNotReady      = errors.New("flow: stage is not finished")
	ErrInvalidTarget = errors.New("flow: stage cannot be reached from here")
	ErrNotRevisiting = errors.New("flow: task is not revisiting a stage")
)

// Service is the state machine of every active task.
type Service struct {
	tasks        Tasks
	sessions     Sessions
	worktrees    Worktrees
	repositories Repositories
	review       Reviews
	gh           GH
	log          *slog.Logger
	onChange     func(taskID string)

	renderPrompt func(stage prompts.Stage, vars prompts.Vars) (string, error)

	mu     sync.Mutex
	locks  map[string]*taskLock // by task id
	closed bool
	// spawned counts the preparations and the PR work in flight, which Close
	// cancels and waits for.
	spawned sync.WaitGroup
}

// taskLock serializes the work on one task and coalesces its pending checks.
type taskLock struct {
	mu        sync.Mutex
	queued    bool
	preparing bool               // a prepare goroutine exists for the task
	cancel    context.CancelFunc // cancels it; nil when there is none
	phase     Phase              // what that goroutine is doing
	// noCommit says the last approval of the step ended without a commit. It
	// is transient on purpose: reopening the app leaves the step ready to
	// approve, which is what git says.
	noCommit bool

	// pr is the asynchronous work of the PR stage, while one is under way; the
	// lock of the task is not held while it runs.
	pr *prWork
	// passAsked is the commit the app asked a review pass about: one commit asks
	// for one pass.
	passAsked string
	// unreadable is why the report of the current structured pass, or its
	// rewrite, can't be read; "" once one is read.
	unreadable string
	// prNoCommit says the last approval of the review of the pull request ended
	// without a commit. Like noCommit, it is transient on purpose.
	prNoCommit bool
	// checkError is what the last reading of a pull request awaiting its merge
	// said when it failed; "" when it succeeded.
	checkError string
	// openFailed says the agent was asked to open the pull request and ended its
	// turn without one. It holds until the conversation moves on.
	openFailed bool
	// checks is the reading of GitHub that settled the last wait for checks,
	// held until the pass it belongs to is asked for; nil otherwise.
	checks *gh.PRChecks
	// checksWait is the wait for checks under way: whether it follows a push
	// of the app, which tolerates one reading without checks, and how many
	// readings without checks it saw.
	checksWait checksWait
}

// prWork is the goroutine that talks to git and to gh about the PR stage of a
// task.
type prWork struct {
	running bool
	cancel  context.CancelFunc
	// pending says that work was asked for while this one was running and was
	// refused: the task is evaluated again once this one ends, so that nothing
	// the app asked for is forgotten.
	pending bool
}

// TaskInfo is what the session of a task needs to know about it at the stage
// the task is in. The stages that have a session of their own, prd, tech_spec,
// plan and one_shot, go by the same name in internal/task and in
// internal/models, so the choice of the stage is read with the name the task
// carries.
func TaskInfo(t task.Task, a task.Artifacts, repo repository.Repository) session.TaskInfo {
	return session.TaskInfo{
		ID:             t.ID,
		Name:           t.Name,
		Dir:            repo.Path,
		ArtifactsDir:   t.ArtifactsDir,
		Stage:          string(t.Stage),
		Prompt:         prompts.Stage(t.Stage),
		PRDPath:        t.PRDPath(),
		TechSpecPath:   t.TechSpecPath(),
		StepsDir:       t.StepsDir(),
		OneShotPath:    oneShotPath(t),
		Repository:     repo.FullName(),
		InitialContext: t.InitialContext,
		ArtifactExists: a.Done(t.Stage),
		Choice:         t.Models.Stage(models.Stage(t.Stage)),
	}
}

// repositoryOf is the registered repository of a task.
func (s *Service) repositoryOf(t task.Task) (repository.Repository, error) {
	repo, ok := s.repositories.Get(t.RepositoryID)
	if !ok {
		return repository.Repository{}, fmt.Errorf("repository of task %s: %w", t.ID, repository.ErrNotFound)
	}
	return repo, nil
}

// oneShotPath is the document of a One-Shot task, which the prompts read in
// place of the PRD, the tech spec and the step file; "" for a Structured task.
func oneShotPath(t task.Task) string {
	if t.Mode != task.ModeOneShot {
		return ""
	}
	return t.OneShotPath()
}
