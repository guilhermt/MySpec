package newdiscussion

// RefusalReason is why the app refuses to save a draft.
type RefusalReason string

// The reasons a draft is refused.
const (
	RefusalEmpty     RefusalReason = "empty"      // the title and the text are both blank
	RefusalBoardGone RefusalReason = "board_gone" // the app no longer has the board
)

// Refusal is a draft the app refuses to save.
type Refusal struct {
	Reason RefusalReason
}

func (r *Refusal) Error() string { return "new discussion draft: " + r.Message() }

// Message is the refusal as the interface shows it.
func (r *Refusal) Message() string {
	switch r.Reason {
	case RefusalEmpty:
		return "Write a title or what to discuss to save a draft."
	case RefusalBoardGone:
		return "This board is no longer in the app."
	default:
		return "The draft is refused: " + string(r.Reason) + "."
	}
}
