package gh

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

// State is where a pull request is.
type State string

// The states GitHub reports for a pull request.
const (
	StateOpen   State = "open"
	StateMerged State = "merged"
	StateClosed State = "closed"
)

// PR is a pull request, as the app shows it.
type PR struct {
	Number int
	URL    string
	State  State
}

// prFields are the fields of a pull request the app asks gh for.
const prFields = "number,url,state"

// noPR is what gh says, in lower case, about a branch with no pull request.
const noPR = "no pull requests found"

// Auth reports whether gh is installed and logged in. A gh that answers with
// no login is ErrNotAuthenticated over what it said, so the interface can show
// the message of the tool itself.
func (r *Runner) Auth(ctx context.Context) error {
	if _, err := r.Run(ctx, "", "auth", "status"); err != nil {
		var ghErr *Error
		// Only a gh that ran and refused says anything about the login; a
		// cancellation or a kill is the failure it is.
		if errors.As(err, &ghErr) && ghErr.ExitCode > 0 {
			return fmt.Errorf("%w: %w", ErrNotAuthenticated, ghErr)
		}
		return err
	}
	return nil
}

// ViewPR reads the pull request of a branch, ErrNoPR when it has none. dir is
// the worktree, which is what tells gh the repository to ask about.
func (r *Runner) ViewPR(ctx context.Context, dir, branch string) (PR, error) {
	out, err := r.Run(ctx, dir, "pr", "view", branch, "--json", prFields)
	if err != nil {
		var ghErr *Error
		// A branch with no pull request is an answer, not a failure: the app
		// asks precisely to find out.
		if errors.As(err, &ghErr) && ghErr.ExitCode > 0 && strings.Contains(strings.ToLower(ghErr.Output), noPR) {
			return PR{}, ErrNoPR
		}
		return PR{}, err
	}

	var body struct {
		Number int    `json:"number"`
		URL    string `json:"url"`
		State  string `json:"state"`
	}
	if err := json.Unmarshal([]byte(out), &body); err != nil {
		return PR{}, fmt.Errorf("gh pr view %s: %w", branch, err)
	}
	return PR{Number: body.Number, URL: body.URL, State: stateOf(body.State)}, nil
}

// stateOf normalizes the state gh writes in upper case. A value the app does
// not know is empty: it says nothing rather than something wrong.
func stateOf(state string) State {
	switch got := State(strings.ToLower(state)); got {
	case StateOpen, StateMerged, StateClosed:
		return got
	default:
		return State("")
	}
}
