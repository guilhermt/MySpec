package gh

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
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
	Base   string // the branch the pull request merges into, as GitHub names it
	Checks PRChecks
	// MergedBy is the login of who merged the pull request and MergedAt when;
	// "" and zero before the merge.
	MergedBy string
	MergedAt time.Time
}

// prFields are the fields of a pull request the app asks gh for.
const prFields = "number,url,state,baseRefName,mergeable,statusCheckRollup,mergedBy,mergedAt"

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
		Number            int         `json:"number"`
		URL               string      `json:"url"`
		State             string      `json:"state"`
		BaseRefName       string      `json:"baseRefName"`
		Mergeable         string      `json:"mergeable"`
		StatusCheckRollup []CheckNode `json:"statusCheckRollup"`
		MergedBy          struct {
			Login string `json:"login"`
		} `json:"mergedBy"`
		MergedAt time.Time `json:"mergedAt"`
	}
	if err := json.Unmarshal([]byte(out), &body); err != nil {
		return PR{}, fmt.Errorf("gh pr view %s: %w", branch, err)
	}
	return PR{
		Number:   body.Number,
		URL:      body.URL,
		State:    stateOf(body.State),
		Base:     body.BaseRefName,
		Checks:   ParseChecks(body.StatusCheckRollup, body.Mergeable),
		MergedBy: body.MergedBy.Login,
		MergedAt: body.MergedAt,
	}, nil
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

// ReviewEvent is the verdict a review is published with.
type ReviewEvent string

// The verdicts GitHub takes for a review.
const (
	EventApprove        ReviewEvent = "APPROVE"
	EventRequestChanges ReviewEvent = "REQUEST_CHANGES"
	EventComment        ReviewEvent = "COMMENT"
)

// ReviewComment is one inline comment of a review, on a line of the new side
// of the diff.
type ReviewComment struct {
	Path string `json:"path"`
	Line int    `json:"line"`
	Side string `json:"side"` // always "RIGHT"
	Body string `json:"body"`
}

// ReviewInput is a review as the GitHub API takes it.
type ReviewInput struct {
	CommitID string          `json:"commit_id"`
	Event    ReviewEvent     `json:"event"`
	Body     string          `json:"body"`
	Comments []ReviewComment `json:"comments"` // never nil: an empty list is []
}

// CreateReview publishes a review on a pull request and answers with its URL.
// The review travels as JSON on the stdin of gh: a body and its comments are
// more than a command line takes.
func (r *Runner) CreateReview(ctx context.Context, owner, name string, number int, in ReviewInput) (string, error) {
	if in.Comments == nil {
		in.Comments = []ReviewComment{}
	}
	body, err := json.Marshal(in)
	if err != nil {
		return "", fmt.Errorf("gh api reviews: %w", err)
	}

	endpoint := fmt.Sprintf("repos/%s/%s/pulls/%d/reviews", owner, name, number)
	out, err := r.RunInput(ctx, "", string(body), "api", "--method", "POST", endpoint, "--input", "-")
	if err != nil {
		return "", authOr(err)
	}

	var answer struct {
		HTMLURL string `json:"html_url"`
	}
	if err := json.Unmarshal([]byte(out), &answer); err != nil {
		return "", fmt.Errorf("gh api %s: %w", endpoint, err)
	}
	return answer.HTMLURL, nil
}

// PRDiff is the unified diff of a pull request as it is now.
func (r *Runner) PRDiff(ctx context.Context, owner, name string, number int) (string, error) {
	return r.Run(ctx, "", "pr", "diff", strconv.Itoa(number), "--repo", owner+"/"+name)
}

// authOr turns a gh that refused for lack of a login into
// ErrNotAuthenticated, and leaves every other failure as it is.
func authOr(err error) error {
	_, settled := answerOf(err)
	return settled
}

// answerOf reads what every command shares about a failed gh. A failure that
// is no answer of gh (it did not run, or it was cancelled or timed out) comes
// back as it is, and a refusal for lack of a login as ErrNotAuthenticated,
// both with a nil *Error: there is nothing more to read in them. Any other
// failure is an answer of gh, which comes back as its *Error next to err, for
// the caller to read further.
func answerOf(err error) (*Error, error) {
	var ghErr *Error
	if !errors.As(err, &ghErr) {
		return nil, err
	}
	if errors.Is(ghErr.Err, context.Canceled) || errors.Is(ghErr.Err, context.DeadlineExceeded) {
		return nil, err
	}
	if ghErr.ExitCode == exitAuth || strings.Contains(ghErr.Output, "gh auth login") {
		return nil, fmt.Errorf("%w: %w", ErrNotAuthenticated, ghErr)
	}
	return ghErr, err
}
