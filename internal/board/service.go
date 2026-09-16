package board

import (
	"context"
	"time"
)

// Store persists the registered boards, the last reading of each and the
// repositories each one manages.
type Store interface {
	// ListBoards returns the registered boards, by title ignoring case, then id.
	ListBoards(ctx context.Context) ([]Board, error)
	// InsertBoard registers a board with an empty reading and applies the links.
	InsertBoard(ctx context.Context, b Board, links []Link) error
	// UpdateBoard stores the title and the final statuses, applies the releases,
	// then the links.
	UpdateBoard(ctx context.Context, b Board, links []Link, releases []Release) error
	// DeleteBoard applies the releases, then removes the board and its reading.
	DeleteBoard(ctx context.Context, id string, releases []Release) error
	// ListReadings returns the stored reading of every board, by board id.
	ListReadings(ctx context.Context) (map[string]Stored, error)
	// SaveReading stores a reading that succeeded, clears the failure and sets
	// the board's title.
	SaveReading(ctx context.Context, boardID, title string, r Reading, readAt time.Time) error
	// SaveFailure stores a reading that failed, keeping the stored reading.
	SaveFailure(ctx context.Context, boardID string, f Failure, failedAt time.Time) error
}

// Link ties a repository to a board: a registered one by id, or a new one.
type Link struct {
	RepositoryID string // "" registers a new repository
	NewID        string // new only
	Owner, Name  string // new only
	Path         string // the clone: for a new one, "" for none; for a registered one without a clone, "" keeps it without one
	CreatedAt    time.Time
}

// Release takes a repository off a board: out of any board, or out of the app.
type Release struct {
	RepositoryID string
	Remove       bool
}
