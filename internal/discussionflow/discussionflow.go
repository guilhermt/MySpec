// Package discussionflow drives a discussion of a demand of a board, as
// reviewflow drives the review of a pull request: it starts the discussion and
// its conversation, reads the drafts the agent wrote at the end of every turn,
// notices the document, publishes on GitHub what the user approved, and
// archives or deletes the discussion at the end. What a discussion holds
// belongs to internal/discussion.
package discussionflow

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"time"

	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/session"
)

// Sessions is what the discussions need from internal/session: the single
// conversation of a discussion.
type Sessions interface {
	Open(ctx context.Context, t session.TaskInfo) error
	Start(ctx context.Context, t session.TaskInfo, restarted bool) error
	Close(ctx context.Context, k session.Key) error
	DiscardTask(ctx context.Context, taskID string) error
	Summary(k session.Key) (session.Summary, bool)
	Exists(ctx context.Context, k session.Key) (bool, error)
}

// Boards is what the discussions need from internal/board: the board a
// discussion is about and the cards of its last reading.
type Boards interface {
	Get(id string) (board.Board, bool)
	Stored(id string) board.Stored
	Card(boardID, key string) (board.Card, bool)
	Refresh(id string)
}

// GH is what the discussions need from internal/gh: the node ids a write needs
// and the writes themselves, the issues and the board items a publication
// creates.
type GH interface {
	LookupIssues(ctx context.Context, refs []gh.IssueRef) (map[gh.IssueRef]gh.IssueNode, error)
	LookupRepositories(ctx context.Context, repos []string) (map[string]string, error)
	CreateIssue(ctx context.Context, repositoryID, title, body string) (gh.IssueNode, error)
	UpdateIssue(ctx context.Context, issueID, title, body string) error
	AddProjectItem(ctx context.Context, projectID, contentID string) (string, error)
	SetProjectSingleSelect(ctx context.Context, projectID, itemID, fieldID, optionID string) error
	AddSubIssue(ctx context.Context, parentID, subIssueID string) error
	AddBlockedBy(ctx context.Context, issueID, blockingIssueID string) error
}

// Deps are what Service needs from the outside.
type Deps struct {
	Discussions  *discussion.Service
	Sessions     Sessions
	Boards       Boards
	Repositories *repository.Service
	GH           GH
	Log          *slog.Logger
	Now          func() time.Time // defaults to time.Now
	// OnChange says that what the app only keeps in memory about a discussion
	// changed; it may be nil.
	OnChange func(id string)
}

// evaluateTimeout bounds the database and disk work of an evaluation, which
// runs on a goroutine of the discussion.
const evaluateTimeout = 10 * time.Second

// The ways the flow of a discussion refuses what it was asked for.
var (
	ErrNotReady      = errors.New("discussionflow: the epic isn't ready to publish")
	ErrPublishing    = errors.New("discussionflow: wait for the publication to finish")
	ErrCannotArchive = errors.New("discussionflow: the discussion can't be archived")
	ErrNoReading     = errors.New("discussionflow: the board hasn't been read yet")
)

// Service is the state machine of every discussion of the product.
type Service struct {
	discussions  *discussion.Service
	sessions     Sessions
	boards       Boards
	repositories *repository.Service
	gh           GH
	log          *slog.Logger
	now          func() time.Time
	onChange     func(id string)

	mu     sync.Mutex
	locks  map[string]*discussionLock // by discussion id
	closed bool
}

// discussionLock serializes the work on one discussion and coalesces its
// pending checks. What it keeps beyond that lives only in memory: the next
// evaluation settles it.
type discussionLock struct {
	mu     sync.Mutex
	queued bool
	// unreadable is why the drafts artifact could not be read; "" when the
	// last reading of it worked.
	unreadable string
	// hasDocument says the agent has written the document of the discussion,
	// and documentStamp is the modification time and the size it had when it
	// was last looked at.
	hasDocument   bool
	documentStamp string
	// documentRevision is bumped every time the document changes, so that the
	// interface reads it again.
	documentRevision int
	// publishing says a run that writes on GitHub is under way.
	publishing bool
	// epicsRequested are the epics the user asked to publish and that have not
	// finished yet.
	epicsRequested map[string]bool
}

// New builds a Service from deps.
func New(deps Deps) *Service {
	s := &Service{
		discussions:  deps.Discussions,
		sessions:     deps.Sessions,
		boards:       deps.Boards,
		repositories: deps.Repositories,
		gh:           deps.GH,
		log:          deps.Log,
		now:          deps.Now,
		onChange:     deps.OnChange,
		locks:        map[string]*discussionLock{},
	}
	if s.log == nil {
		s.log = slog.New(slog.DiscardHandler)
	}
	if s.now == nil {
		s.now = time.Now
	}
	return s
}

// Check asks for an evaluation of a discussion and returns at once. The app
// calls it with the id of whatever item a session spoke about, so an id that is
// no discussion of its own does nothing.
func (s *Service) Check(id string) {
	if _, ok := s.discussions.Get(id); !ok {
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

// run evaluates a discussion, one evaluation at a time per discussion.
func (s *Service) run(id string, l *discussionLock) {
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

// lockOf is the lock of a discussion, created on the first call for it.
func (s *Service) lockOf(id string) *discussionLock {
	s.mu.Lock()
	defer s.mu.Unlock()

	l, ok := s.locks[id]
	if !ok {
		l = &discussionLock{epicsRequested: map[string]bool{}}
		s.locks[id] = l
	}
	return l
}

// forget drops the lock of a discussion that left the list.
func (s *Service) forget(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.locks, id)
}

// notify says that something the app keeps about a discussion changed.
func (s *Service) notify(id string) {
	if s.onChange != nil {
		s.onChange(id)
	}
}

// sessionKey is the conversation of a discussion, the only one it has.
func sessionKey(id string) session.Key {
	return session.Key{TaskID: id, Stage: session.DiscussionStage}
}
