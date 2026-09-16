package session

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/guilhermt/myspec/internal/models"
)

// ErrNotFound is returned when a task has no persisted session.
var ErrNotFound = errors.New("session: not found")

// Key identifies one session: a task and the stage it belongs to.
type Key struct {
	TaskID string
	Stage  string
}

// Record is the persisted session row: one per stage of a task.
type Record struct {
	ID     string // also the Claude Code session id
	TaskID string
	Stage  string // prd, tech_spec, plan, step:<n>, step_review:<n>, pr or pr_review
	// Choice is the model and effort the session runs with from its next message
	// on. It is born with the one of its stage or step and changes only through
	// SetChoice.
	Choice        models.Choice
	Started       bool // system/init has arrived at least once for this id
	Paused        bool
	ContextTokens int
	ContextWindow int
	Corrections   int // automatic corrections the app sent to this session
	LastError     string
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// The prefixes that open the session key of a stage a task has more than one
// of: one step, or the reviewer of a step.
const (
	stepStagePrefix       = "step:"
	stepReviewStagePrefix = "step_review:"
)

// The session keys of the PR stage of a task: the conversation that drafts
// and opens the pull request, and the one that reviews it.
const (
	PRStage       = "pr"
	PRReviewStage = "pr_review"
)

// StepStage is the session key of a step, which is what the sessions table
// records in its stage column.
func StepStage(number int) string { return stepStagePrefix + strconv.Itoa(number) }

// ParseStepStage reads the number out of a step session key.
func ParseStepStage(stage string) (number int, ok bool) {
	rest, found := strings.CutPrefix(stage, stepStagePrefix)
	if !found {
		return 0, false
	}
	number, err := strconv.Atoi(rest)
	if err != nil || number <= 0 {
		return 0, false
	}
	return number, true
}

// StepReviewStage is the session key of the reviewer of a step, which is what
// the sessions table records in its stage column.
func StepReviewStage(number int) string { return stepReviewStagePrefix + strconv.Itoa(number) }

// ParseStepReviewStage reads the number out of the session key of the reviewer
// of a step.
func ParseStepReviewStage(stage string) (number int, ok bool) {
	rest, found := strings.CutPrefix(stage, stepReviewStagePrefix)
	if !found {
		return 0, false
	}
	number, err := strconv.Atoi(rest)
	if err != nil || number <= 0 {
		return 0, false
	}
	return number, true
}

// SessionRepository persists one Record per stage of a task.
//
//nolint:revive // the name pairs with EntryRepository, as the spec defines the two
type SessionRepository interface {
	Get(ctx context.Context, taskID, stage string) (Record, error) // ErrNotFound
	Insert(ctx context.Context, rec Record) error
	Update(ctx context.Context, rec Record) error
	Delete(ctx context.Context, taskID string, stages ...string) error
	DeleteByTask(ctx context.Context, taskID string) error
}

// Status is what the interface shows about a session at a glance.
type Status string

// The states a session is shown in.
const (
	StatusWorking         Status = "working"
	StatusWaiting         Status = "waiting"
	StatusNeedsPermission Status = "needs_permission" // a permission request waits for an answer
	StatusNeedsAnswer     Status = "needs_answer"     // a structured question waits for an answer
	StatusPaused          Status = "paused"
	StatusError           Status = "error"
)

// Summary is what the interface shows about a session without opening it.
type Summary struct {
	TaskID         string
	Stage          string // stage of the session behind it
	Status         Status
	Choice         models.Choice // what the session runs with from its next message on
	TurnRunning    bool
	ProcessRunning bool
	RetryAttempt   int // last api_retry attempt of the running turn, 0 otherwise
	ContextPercent int // 0 until the first result of the session
	PendingCount   int
	Corrections    int
	LastError      string
	// TurnFailed says the last turn ended in an error the CLI survived, and no
	// turn has run since. The session is at rest all the same.
	TurnFailed bool
	// Idle is the session at rest: no turn, no pending message, no request, no
	// pause and no error.
	Idle bool
}

// Transcript is the whole conversation of a task.
type Transcript struct {
	TaskID    string
	SessionID string
	Stage     string
	Entries   []Entry // ordered by Seq, pending user entries excluded
	Pending   []Entry // queued user entries in send order
}

// EventKind says how a transcript event changes the conversation.
type EventKind string

// The transcript events the app emits.
const (
	EventEntry  EventKind = "entry"  // Entry created or changed; replace by id (pending flag says which list)
	EventText   EventKind = "text"   // full current text of a streaming assistant entry
	EventRemove EventKind = "remove" // Entry deleted
	EventReset  EventKind = "reset"  // reload the transcript with GetTranscript
)

// TranscriptEvent is one change to the conversation of a task.
type TranscriptEvent struct {
	TaskID  string
	Stage   string
	Kind    EventKind
	Entry   *Entry
	EntryID string
	Text    string
}
