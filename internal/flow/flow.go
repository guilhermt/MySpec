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
	List() []task.Task
	Artifacts(id string) (task.Artifacts, bool) // the last inspection, for snapshots
	Inspect(id string) (task.Artifacts, error)
	SetStage(ctx context.Context, id string, stage task.Stage, revisiting bool) (task.Task, error)
	RemoveArtifacts(ctx context.Context, id string, from task.Stage) error
	Repositories(t task.Task) []task.Repository
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
	Resume(ctx context.Context, k session.Key) error
	Summary(k session.Key) (session.Summary, bool)
	SendFromApp(ctx context.Context, k session.Key, text string) error
	SendCorrection(ctx context.Context, k session.Key, text string) error
}

// Reviews is what the flow needs from internal/review.
type Reviews interface {
	Track(k review.Key, wt worktree.Worktree, active bool)
	Refresh(k review.Key) (review.Snapshot, bool)
	Snapshot(k review.Key) (review.Snapshot, bool)
	Forget(k review.Key)
	ForgetTask(taskID string)
}

// Worktrees is what the flow needs from internal/worktree.
type Worktrees interface {
	Get(taskID, repoPath string) (worktree.Worktree, bool)
	Ensure(ctx context.Context, t task.Task, repo task.Repository, onPhase func(worktree.Phase)) (worktree.Worktree, error)
	Status(ctx context.Context, wt worktree.Worktree) (git.Status, error)
	Commit(ctx context.Context, wt worktree.Worktree, rev string) (git.Commit, error)
	Clean(ctx context.Context, wt worktree.Worktree) error
	RemoveAll(ctx context.Context, taskID string) error
}

// Deps are what Service needs from the outside.
type Deps struct {
	Tasks     Tasks
	Sessions  Sessions
	Worktrees Worktrees
	Review    Reviews
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
