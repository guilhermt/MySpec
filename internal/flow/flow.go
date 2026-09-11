// Package flow drives a task through its stages: it notices when a stage is
// done, starts the next one, and carries out the user's back, discard and
// continue.
package flow

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"time"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/worktree"
)

// Tasks is what the flow needs from internal/task.
type Tasks interface {
	Get(id string) (task.Task, bool)
	Lookup(id string) (task.Task, bool) // the workspace and the history
	List() []task.Task
	ListArchived() []task.Task
	Archive(ctx context.Context, id string) (task.Task, error)
	Artifacts(id string) (task.Artifacts, bool) // the last inspection, for snapshots
	Inspect(id string) (task.Artifacts, error)
	SetStage(ctx context.Context, id string, stage task.Stage, revisiting bool) (task.Task, error)
	RemoveArtifacts(ctx context.Context, id string, from task.Stage) error
	Repositories(t task.Task) []task.Repository
	PRRuns(id string) []task.PRRun
	SetPRRun(ctx context.Context, id, repoPath string, status task.PRStatus, block *task.PRBlock) (task.PRRun, error)
	SetPRDetails(ctx context.Context, id, repoPath string, pr task.PRDetails) (task.PRRun, error)
	SetPRClosed(ctx context.Context, id, repoPath string, result task.CloseResult) (task.PRRun, error)
	SetPRReviewed(ctx context.Context, id, repoPath, commit string, pass int) (task.PRRun, error)
	ClearPRRuns(ctx context.Context, id string) error
	StepRuns(id string) []task.StepRun
	SetStepRun(ctx context.Context, id string, number int, status task.StepStatus, block *task.StepBlock) (task.StepRun, error)
	SetStepStarted(ctx context.Context, id string, number int, startCommit string) (task.StepRun, error)
	SetStepCommitted(ctx context.Context, id string, number int, sha, subject string) (task.StepRun, error)
	ClearStepRuns(ctx context.Context, id string) error
	Delete(ctx context.Context, id string) error
}

// Sessions is what the flow needs from internal/session.
type Sessions interface {
	Open(ctx context.Context, t session.TaskInfo) error
	Start(ctx context.Context, t session.TaskInfo, restarted bool) error
	Discard(ctx context.Context, taskID string, stages ...string) error
	Close(ctx context.Context, k session.Key) error
	CloseTask(ctx context.Context, taskID string) error
	DiscardTask(ctx context.Context, taskID string) error
	Resume(ctx context.Context, k session.Key) error
	Summary(k session.Key) (session.Summary, bool)
	Summaries() map[session.Key]session.Summary
	SendFromApp(ctx context.Context, k session.Key, text string) error
	SendCorrection(ctx context.Context, k session.Key, text string) error
	MarkPRReview(ctx context.Context, k session.Key, pass int)
}

// Reviews is what the flow needs from internal/review.
type Reviews interface {
	Track(k review.Key, wt worktree.Worktree, active bool)
	Refresh(k review.Key) (review.Snapshot, bool)
	Snapshot(k review.Key) (review.Snapshot, bool)
	Forget(k review.Key)
	ForgetTask(taskID string)
}

// GH is what the flow needs from internal/gh: the readings that say whether a
// pull request can be opened and whether it already exists.
type GH interface {
	Auth(ctx context.Context) error
	ViewPR(ctx context.Context, dir, branch string) (gh.PR, error)
}

// Worktrees is what the flow needs from internal/worktree.
type Worktrees interface {
	Get(taskID, repoPath string) (worktree.Worktree, bool)
	List(taskID string) []worktree.Worktree
	Base(ctx context.Context, wt worktree.Worktree) (string, error)
	Ahead(ctx context.Context, wt worktree.Worktree, base string) (int, error)
	Merged(ctx context.Context, wt worktree.Worktree, base string) (bool, error)
	Ensure(ctx context.Context, t task.Task, repo task.Repository, onPhase func(worktree.Phase)) (worktree.Worktree, error)
	Status(ctx context.Context, wt worktree.Worktree) (git.Status, error)
	Commit(ctx context.Context, wt worktree.Worktree, rev string) (git.Commit, error)
	Clean(ctx context.Context, wt worktree.Worktree) error
	Close(ctx context.Context, wt worktree.Worktree, base string, policy worktree.BranchPolicy) task.CloseResult
	Purge(ctx context.Context, taskID string) []worktree.Leftover
	RemoveAll(ctx context.Context, taskID string) error
}

// Deps are what Service needs from the outside.
type Deps struct {
	Tasks     Tasks
	Sessions  Sessions
	Worktrees Worktrees
	Review    Reviews
	GH        GH
	Log       *slog.Logger
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

// Service is the state machine of every task of the open workspace.
type Service struct {
	tasks     Tasks
	sessions  Sessions
	worktrees Worktrees
	review    Reviews
	gh        GH
	log       *slog.Logger
	onChange  func(taskID string)

	renderPrompt func(stage prompts.Stage, vars prompts.Vars) (string, error)

	mu     sync.Mutex
	locks  map[string]*taskLock // by task id
	closed bool
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

	// repos is the asynchronous work of the PR stage, one entry per repository
	// under way; the lock of the task is not held while it runs.
	repos map[string]*repoWork
	// passAsked is the commit the app asked a review pass about, by
	// repository: one commit asks for one pass.
	passAsked map[string]string
	// repoNoCommit says the last approval of a repository ended without a
	// commit. Like the one of a step, it is transient on purpose.
	repoNoCommit map[string]bool
	// checkErrors is what the last reading of the pull request of a repository
	// awaiting closing said when it failed, by repository; "" or absent when it
	// succeeded.
	checkErrors map[string]string
	// openFailed says the agent was asked to open the pull request of a
	// repository and ended its turn without one, by repository. It holds until the
	// conversation of the repository moves on, and is transient on purpose like
	// repoNoCommit.
	openFailed map[string]bool
}

// repoWork is the goroutine that talks to git and to gh about one repository
// of a task in the PR stage.
type repoWork struct {
	running bool
	cancel  context.CancelFunc
	// pending says that work was asked for while this one was running and was
	// refused: the task is evaluated again once this one ends, so that nothing
	// the app asked for is forgotten.
	pending bool
}

// TaskInfo is what the session of a task needs to know about it at the stage
// the task is in.
func TaskInfo(t task.Task, a task.Artifacts, repos []task.Repository) session.TaskInfo {
	rels := make([]string, len(repos))
	for i, repo := range repos {
		rels[i] = repo.Rel
	}
	return session.TaskInfo{
		ID:             t.ID,
		Name:           t.Name,
		Dir:            t.Dir(),
		ArtifactsDir:   t.ArtifactsDir,
		Stage:          string(t.Stage),
		Prompt:         prompts.Stage(t.Stage),
		PRDPath:        t.PRDPath(),
		TechSpecPath:   t.TechSpecPath(),
		StepsDir:       t.StepsDir(),
		Repositories:   rels,
		InitialContext: t.InitialContext,
		ArtifactExists: a.Done(t.Stage),
	}
}
