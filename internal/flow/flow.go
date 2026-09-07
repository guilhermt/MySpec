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

	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

// Tasks is what the flow needs from internal/task.
type Tasks interface {
	Get(id string) (task.Task, bool)
	List() []task.Task
	Inspect(id string) (task.Artifacts, error)
	SetStage(ctx context.Context, id string, stage task.Stage, revisiting bool) (task.Task, error)
	RemoveArtifacts(ctx context.Context, id string, from task.Stage) error
	Repositories(t task.Task) []task.Repository
}

// Sessions is what the flow needs from internal/session.
type Sessions interface {
	Open(ctx context.Context, t session.TaskInfo) error
	Start(ctx context.Context, t session.TaskInfo, restarted bool) error
	Discard(ctx context.Context, taskID string, stages ...string) error
	Close(ctx context.Context, taskID string) error
	Summary(taskID string) (session.Summary, bool)
	SendFromApp(ctx context.Context, taskID, text string) error
}

// Deps are what Service needs from the outside.
type Deps struct {
	Tasks    Tasks
	Sessions Sessions
	Log      *slog.Logger
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
	tasks    Tasks
	sessions Sessions
	log      *slog.Logger

	mu     sync.Mutex
	locks  map[string]*taskLock // by task id
	closed bool
}

// taskLock serializes the work on one task and coalesces its pending checks.
type taskLock struct {
	mu     sync.Mutex
	queued bool
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
		Stage:          prompts.Stage(t.Stage),
		PRDPath:        t.PRDPath(),
		TechSpecPath:   t.TechSpecPath(),
		StepsDir:       t.StepsDir(),
		Repositories:   rels,
		InitialContext: t.InitialContext,
		ArtifactExists: a.Done(t.Stage),
	}
}
