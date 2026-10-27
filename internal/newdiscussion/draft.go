// Package newdiscussion keeps the drafts of the New discussion dialog: the
// title and the text the user saved to finish later, with the board they were
// written for. It only keeps: the dialog decides when to save, resume and
// delete one.
package newdiscussion

import (
	"context"
	"log/slog"
	"time"
)

// Draft is the title and the text of a New discussion the user saved to finish
// later, with its board.
type Draft struct {
	ID        string
	BoardID   string
	Title     string // as the user typed it; "" for none
	Text      string // what to discuss, as typed; "" for none
	CreatedAt time.Time
	SavedAt   time.Time
}

// Store is the persistence of the drafts.
type Store interface {
	// NewDiscussionDrafts returns every draft, the most recently saved first.
	NewDiscussionDrafts(ctx context.Context) ([]Draft, error)
	// PutNewDiscussionDraft inserts the draft, or updates the one with its id
	// keeping when it was created.
	PutNewDiscussionDraft(ctx context.Context, d Draft) error
	// DeleteNewDiscussionDraft removes a draft. A missing one is not an error.
	DeleteNewDiscussionDraft(ctx context.Context, id string) error
}

// Deps are what Service needs from the outside.
type Deps struct {
	Store    Store
	HasBoard func(boardID string) bool // whether the app still has the board
	Log      *slog.Logger
	Now      func() time.Time // defaults to time.Now
	NewID    func() string    // defaults to uuid.NewString
	OnChange func()           // after the drafts change; may be nil
}

// SaveParams is what the user typed in the dialog.
type SaveParams struct {
	ID      string // "" for a new draft
	BoardID string
	Title   string
	Text    string
}
