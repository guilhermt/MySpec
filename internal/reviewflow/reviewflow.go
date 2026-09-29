// Package reviewflow drives the review of a pull request, as flow drives a
// task: it starts a review, asks for a pass, records the report the agent
// wrote, publishes what the user approved, notices new commits, and ends the
// review when the pull request is merged or closed.
package reviewflow

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"time"

	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/pulls"
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/worktree"
)

// Sessions is what the reviews need from internal/session.
type Sessions interface {
	Open(ctx context.Context, t session.TaskInfo) error
	Start(ctx context.Context, t session.TaskInfo, restarted bool) error
	Close(ctx context.Context, k session.Key) error
	DiscardTask(ctx context.Context, taskID string) error
	Resume(ctx context.Context, k session.Key) error
	Summary(k session.Key) (session.Summary, bool)
	Exists(ctx context.Context, k session.Key) (bool, error)
	SendFromApp(ctx context.Context, k session.Key, m session.AppMessage) error
	MarkPRReview(ctx context.Context, k session.Key, pass int, clean bool)
}

// Worktrees is what the reviews need from internal/worktree: a worktree on a
// detached HEAD at the head of the pull request.
type Worktrees interface {
	Get(itemID string) (worktree.Worktree, bool)
	EnsureDetached(
		ctx context.Context, itemID string, repo repository.Repository, dirName, headBranch, baseBranch string,
	) (worktree.Worktree, error)
	UpdateDetached(ctx context.Context, wt worktree.Worktree, headBranch string) error
	Status(ctx context.Context, wt worktree.Worktree) (git.Status, error)
	Clean(ctx context.Context, wt worktree.Worktree) error
	Remove(ctx context.Context, itemID string) error
}

// Pulls is what the reviews need from internal/pulls: the pull request as
// GitHub has it now, and who gh is logged in as.
type Pulls interface {
	Viewer() string
	ReadDetails(ctx context.Context, refs []pulls.Ref) (map[pulls.Ref]pulls.Detail, error)
	Refresh()
}

// Boards is what the reviews need from internal/board: the card a pull
// request is linked to.
type Boards interface {
	CardOfPullRequest(owner, name string, number int) (boardID string, card board.Card, ok bool)
}

// Watcher is what the reviews need from internal/review, the watcher of a
// worktree: in apply mode the user reviews the changes of the agent file by
// file, as they do on a step.
type Watcher interface {
	Track(itemID string, wt worktree.Worktree, active bool)
	Refresh(itemID string) (review.Snapshot, bool)
	Snapshot(itemID string) (review.Snapshot, bool)
	Forget(itemID string)
}

// GH is what the reviews need from internal/gh: the diff a finding is anchored
// in and the review the user publishes.
type GH interface {
	PRDiff(ctx context.Context, owner, name string, number int) (string, error)
	CreateReview(ctx context.Context, owner, name string, number int, in gh.ReviewInput) (string, error)
}

// TaskPR is the pull request of an active task of the product, which is never
// reviewed on its own: its review belongs to the task.
type TaskPR struct {
	TaskID       string
	RepositoryID string
	Number       int
}

// Deps are what Service needs from the outside.
type Deps struct {
	Reviews      *prreview.Service
	Pulls        Pulls
	Sessions     Sessions
	Worktrees    Worktrees
	Repositories *repository.Service
	Boards       Boards
	Watch        Watcher
	GH           GH
	// Tasks are the pull requests of the active tasks of the product.
	Tasks func() []TaskPR
	Log   *slog.Logger
	// RenderPrompt turns a prompt of the data directory into the message the
	// app sends; a review uses it for the commit prompt of apply mode.
	RenderPrompt func(stage prompts.Stage, vars prompts.Vars) (string, error)
	// OnChange says that what the app only keeps in memory about a review
	// changed; it may be nil.
	OnChange func(id string)
}

// evaluateTimeout bounds the database and disk work of an evaluation, which
// runs on a goroutine of the review.
const evaluateTimeout = 10 * time.Second

// The ways the flow of a review refuses what it was asked for.
var (
	ErrPullRequestGone = errors.New("reviewflow: the pull request is not on GitHub")
	ErrNotOpen         = errors.New("reviewflow: the pull request is not open")
	ErrFork            = errors.New("reviewflow: the pull request comes from a fork")
	ErrTaskPullRequest = errors.New("reviewflow: the pull request belongs to a task of the product")
	ErrApplyNotOwn     = errors.New("reviewflow: only a pull request of your own can be fixed in the app")
	ErrPassRunning     = errors.New("reviewflow: a pass of the review is still running")
	ErrBusy            = errors.New("reviewflow: the conversation of the review is busy")
	ErrNotReady        = errors.New("reviewflow: the review is not ready for that")
	ErrOwnVerdict      = errors.New("reviewflow: a pull request of your own can only be commented on")
	ErrEmptyReview     = errors.New("reviewflow: write a summary before publishing")
	ErrNoWorktree      = errors.New("reviewflow: the worktree of the review is gone")
)

// The sentences the user reads when the pull request of a review is gone or
// closed: a failed publication keeps them, and the bindings answer with them.
const (
	GoneMessage    = "This pull request is no longer on GitHub."
	NotOpenMessage = "This pull request isn't open."
)

// Service is the state machine of every review of a pull request.
type Service struct {
	reviews      *prreview.Service
	pulls        Pulls
	sessions     Sessions
	worktrees    Worktrees
	repositories *repository.Service
	boards       Boards
	watch        Watcher
	gh           GH
	tasks        func() []TaskPR
	log          *slog.Logger
	onChange     func(id string)

	renderPrompt func(stage prompts.Stage, vars prompts.Vars) (string, error)

	mu      sync.Mutex
	locks   map[string]*reviewLock // by review id
	closed  bool
	polling bool // a reading of the pull requests of the reviews is under way
}

// reviewLock serializes the work on one review and coalesces its pending
// checks.
type reviewLock struct {
	mu     sync.Mutex
	queued bool
	// unreadable is why the report of the pass the app asked for could not be
	// read; "" when the last reading of it worked. It is kept in memory: the
	// next report the agent writes settles it.
	unreadable string
	// checkError is what the last reading of the pull request said when it
	// failed; "" when it worked.
	checkError string
	// commitFailed says the last approval of apply mode ended without a
	// commit. Like the flow of a task, it is transient on purpose.
	commitFailed bool
	// commitBase is the commit the worktree was on when the last approval
	// asked for a commit, read then because the pass it fixes recorded none.
	// A head that moved from it is the commit the agent made.
	commitBase string
	// wait is the wait for checks under way, in memory: whether it follows a
	// commit the app pushed, which tolerates one reading without checks, and
	// how many readings without checks it saw.
	wait checksWait
	// passBlocked is why the pass the app asked for could not start: the
	// reading of GitHub failed, or the worktree could not be updated. "" while
	// nothing blocks it. Kept in memory: Review again reads again.
	passBlocked string
}

// New builds a Service from deps.
func New(deps Deps) *Service {
	s := &Service{
		reviews:      deps.Reviews,
		pulls:        deps.Pulls,
		sessions:     deps.Sessions,
		worktrees:    deps.Worktrees,
		repositories: deps.Repositories,
		boards:       deps.Boards,
		watch:        deps.Watch,
		gh:           deps.GH,
		tasks:        deps.Tasks,
		log:          deps.Log,
		onChange:     deps.OnChange,

		renderPrompt: deps.RenderPrompt,
		locks:        map[string]*reviewLock{},
	}
	if s.log == nil {
		s.log = slog.New(slog.DiscardHandler)
	}
	if s.tasks == nil {
		s.tasks = func() []TaskPR { return nil }
	}
	return s
}

// Check asks for an evaluation of a review and returns at once. The app calls
// it with the id of whatever item a session or a watcher spoke about, so an id
// that is no review of its own does nothing.
func (s *Service) Check(id string) {
	if _, ok := s.reviews.Get(id); !ok {
		return
	}
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.closed || l.queued {
		return
	}
	l.queued = true
	go s.run(id, l)
}

// run evaluates a review, one evaluation at a time per review.
func (s *Service) run(id string, l *reviewLock) {
	l.mu.Lock()
	defer l.mu.Unlock()

	s.mu.Lock()
	l.queued = false
	s.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), evaluateTimeout)
	defer cancel()

	s.evaluate(ctx, id)
}

// Close stops the flow from evaluating anything else. The evaluations under
// way end on their own.
func (s *Service) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.closed = true
}

// isClosed reports whether the flow was closed.
func (s *Service) isClosed() bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.closed
}

// lockOf is the lock of a review, created on the first call for it.
func (s *Service) lockOf(id string) *reviewLock {
	s.mu.Lock()
	defer s.mu.Unlock()

	l, ok := s.locks[id]
	if !ok {
		l = &reviewLock{}
		s.locks[id] = l
	}
	return l
}

// notify says that something the app keeps about a review changed.
func (s *Service) notify(id string) {
	if s.onChange != nil {
		s.onChange(id)
	}
}

// sessionKey is the conversation of a review, the only one it has.
func sessionKey(id string) session.Key {
	return session.Key{TaskID: id, Stage: session.ReviewStage}
}

// headOf is the commit the worktree of a review is on, "" when git cannot say.
func (s *Service) headOf(ctx context.Context, wt worktree.Worktree) string {
	status, err := s.worktrees.Status(ctx, wt)
	if err != nil {
		s.log.Warn("read worktree failed", "review", wt.TaskID, "path", wt.Path, "error", err)
		return ""
	}
	return status.Head
}
