package board

import "errors"

// RefusalReason is why the app refuses a board or a repository of one.
type RefusalReason string

// The reasons a board or a repository of one is refused.
const (
	RefusalInvalidURL        RefusalReason = "invalid_url"        // the URL is not a GitHub project
	RefusalRegistered        RefusalReason = "already_registered" // the board is registered
	RefusalInvalidRepository RefusalReason = "invalid_repository" // the repository is not typed as owner/name
	RefusalUnknownRepository RefusalReason = "unknown_repository" // GitHub has no such repository for this account
	RefusalOtherBoard        RefusalReason = "other_board"        // the repository belongs to another board
	RefusalNotManaged        RefusalReason = "not_managed"        // the repository is not one of the board's
)

// Refusal is a board or a repository the app refuses, with everything the
// sentence the user reads needs.
type Refusal struct {
	Reason     RefusalReason
	Title      string // already_registered, other_board: the title of the board
	Repository string // unknown_repository, other_board, not_managed: owner/name
}

func (r *Refusal) Error() string { return "board: " + r.Message() }

// Message is the refusal as the interface shows it.
func (r *Refusal) Message() string {
	switch r.Reason {
	case RefusalInvalidURL:
		return "This isn't the URL of a GitHub project."
	case RefusalRegistered:
		return r.Title + " is already registered."
	case RefusalInvalidRepository:
		return "Type the repository as owner/name."
	case RefusalUnknownRepository:
		return r.Repository + " doesn't exist or this account can't read it."
	case RefusalOtherBoard:
		return r.Repository + " belongs to the board " + r.Title + "."
	case RefusalNotManaged:
		return r.Repository + " isn't managed by this board."
	default:
		return "The board is refused: " + string(r.Reason) + "."
	}
}

// The errors of the board service.
var (
	ErrNotFound     = errors.New("board: not found")
	ErrCardNotFound = errors.New("board: card not found")
)
