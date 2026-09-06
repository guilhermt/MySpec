package session

import (
	"errors"
	"time"
)

// ErrNotFound is returned when a task has no persisted session.
var ErrNotFound = errors.New("session: not found")

// Record is the persisted session row.
type Record struct {
	ID            string // also the Claude Code session id
	TaskID        string
	Stage         string // "prd"
	Started       bool   // system/init has arrived at least once for this id
	Paused        bool
	ContextTokens int
	ContextWindow int
	LastError     string
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// Status is what the interface shows about a session at a glance.
type Status string

// The states a session is shown in.
const (
	StatusWorking         Status = "working"
	StatusWaiting         Status = "waiting"
	StatusNeedsPermission Status = "needs_permission"
	StatusPaused          Status = "paused"
	StatusError           Status = "error"
)

// Summary is what the interface shows about a session without opening it.
type Summary struct {
	TaskID         string
	Status         Status
	TurnRunning    bool
	ProcessRunning bool
	RetryAttempt   int // last api_retry attempt of the running turn, 0 otherwise
	ContextPercent int // 0 until the first result of the session
	PendingCount   int
	LastError      string
}

// Transcript is the whole conversation of a task.
type Transcript struct {
	TaskID    string
	SessionID string
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
	Kind    EventKind
	Entry   *Entry
	EntryID string
	Text    string
}
