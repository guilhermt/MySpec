package task

import (
	"errors"
	"fmt"
	"slices"
	"time"
)

// PRStatus is how far the app got with the PR stage of a task, as it records
// it. What the interface shows on top of it comes from the session of the
// stage and from the disk.
type PRStatus string

// How far the app got with the PR stage of a task.
const (
	PRPreparing  PRStatus = "preparing"  // gh and commit checks under way
	PRBlocked    PRStatus = "blocked"    // the stage could not start; Block says why
	PRDrafting   PRStatus = "drafting"   // the PR session is open, writing or waiting for the OK
	PROpening    PRStatus = "opening"    // the user approved the draft; the agent is opening the PR
	PRReviewing  PRStatus = "reviewing"  // the PR exists and the review session is running
	PRCommitting PRStatus = "committing" // the commit prompt was sent, waiting for the commit
	PRDone       PRStatus = "done"       // a pass closed clean; the task awaits closing
	PRClosing    PRStatus = "closing"    // the user asked for the closing; git is at work
	PRClosed     PRStatus = "closed"     // the worktree is gone; Close says what else happened
)

// prStatuses lists every status a PR run may carry.
var prStatuses = []PRStatus{
	PRPreparing, PRBlocked, PRDrafting, PROpening, PRReviewing, PRCommitting,
	PRDone, PRClosing, PRClosed,
}

// PRBlockReason says why the PR stage of a task could not start.
type PRBlockReason string

// The reasons the PR stage of a task is blocked.
const (
	PRBlockGHMissing  PRBlockReason = "gh_missing"
	PRBlockGHAuth     PRBlockReason = "gh_unauthenticated"
	PRBlockGHFailed   PRBlockReason = "gh_failed"
	PRBlockGitFailed  PRBlockReason = "git_failed"
	PRBlockNoWorktree PRBlockReason = "no_worktree"
)

// prBlockReasons lists every reason the PR stage may be blocked for.
var prBlockReasons = []PRBlockReason{
	PRBlockGHMissing, PRBlockGHAuth, PRBlockGHFailed, PRBlockGitFailed, PRBlockNoWorktree,
}

// PRState is where GitHub says the pull request is.
type PRState string

// The states a pull request is read in.
const (
	PRStateOpen   PRState = "open"
	PRStateMerged PRState = "merged"
	PRStateClosed PRState = "closed"
)

// prStates lists every state a pull request is stored with.
var prStates = []PRState{PRStateOpen, PRStateMerged, PRStateClosed}

// The ways a stored PR value fails to be read back.
var (
	ErrUnknownPRStatus      = errors.New("task: unknown pr status")
	ErrUnknownPRBlockReason = errors.New("task: unknown pr block reason")
	ErrUnknownPRState       = errors.New("task: unknown pr state")
)

// PRBlock is why the PR stage of a task is blocked, in the words of the tool
// that refused.
type PRBlock struct {
	Reason PRBlockReason
	Detail string // what gh or git said, verbatim
}

// PRDetails is the pull request as gh last reported it.
type PRDetails struct {
	Number    int
	URL       string
	State     PRState // "" until a reading says otherwise
	Base      string  // the branch the pull request merges into; "" until gh says
	CheckedAt time.Time
}

// CloseOutcome is what became of one of the three things closing a task acts
// on.
type CloseOutcome string

// What closing does with the worktree, the branch and the base branch.
const (
	OutcomeDone    CloseOutcome = "done"    // removed, deleted or updated
	OutcomeSkipped CloseOutcome = "skipped" // left alone on purpose; Reason says why
	OutcomeFailed  CloseOutcome = "failed"  // git refused; Detail says what it said
)

// The reasons a part of the closing is skipped.
const (
	SkipMissing       = "missing"         // the worktree folder, the branch or the base branch is not there
	SkipNotMerged     = "not_merged"      // git does not see the branch in the base and GitHub did not confirm the merge
	SkipNotCheckedOut = "not_checked_out" // the base branch is not the one checked out in the clone
	SkipDirty         = "dirty"           // the clone has uncommitted changes
	SkipNoUpstream    = "no_upstream"     // the base branch tracks no remote branch
	SkipDiverged      = "diverged"        // the base branch has commits of its own
	SkipUpToDate      = "up_to_date"      // the base branch already matches the remote
)

// CloseStep is one part of the closing of a task: the worktree, the branch or
// the base branch.
type CloseStep struct {
	Outcome CloseOutcome `json:"outcome"`
	Reason  string       `json:"reason"` // skipped only
	// Detail is what git said, the status lines of a dirty clone, or the path
	// or branch left behind.
	Detail string `json:"detail"`
}

// CloseResult is what closing a task did, as the app shows it forever after.
type CloseResult struct {
	Worktree     CloseStep `json:"worktree"`
	Branch       CloseStep `json:"branch"`
	Base         CloseStep `json:"base"`
	WorktreePath string    `json:"worktreePath"`
	BranchName   string    `json:"branchName"`
	BaseBranch   string    `json:"baseBranch"`  // the local branch the pull request merged into
	BaseCommits  int       `json:"baseCommits"` // how many commits the base moved by; done only
	ClosedAt     time.Time `json:"closedAt"`
}

// PRRun is what the app recorded about the PR stage of a task.
type PRRun struct {
	TaskID string
	Status PRStatus
	Block  *PRBlock // blocked only
	PR     PRDetails
	Close  *CloseResult // closed only

	// ReviewedCommit is the commit the last written report covered, and
	// ReportedPass its number: together they are the rule that a new pass only
	// happens after a new commit.
	ReviewedCommit string
	ReportedPass   int

	CreatedAt time.Time
	UpdatedAt time.Time
}

// ParsePRStatus narrows a stored or received string to a PR status.
func ParsePRStatus(value string) (PRStatus, error) {
	status := PRStatus(value)
	if !slices.Contains(prStatuses, status) {
		return "", fmt.Errorf("parse pr status %q: %w", value, ErrUnknownPRStatus)
	}
	return status, nil
}

// ParsePRBlockReason narrows a stored or received string to a PR block reason.
func ParsePRBlockReason(value string) (PRBlockReason, error) {
	reason := PRBlockReason(value)
	if !slices.Contains(prBlockReasons, reason) {
		return "", fmt.Errorf("parse pr block reason %q: %w", value, ErrUnknownPRBlockReason)
	}
	return reason, nil
}

// ParsePRState narrows a stored or received string to a pull request state.
// The empty string is the state of a pull request nothing was read about yet.
func ParsePRState(value string) (PRState, error) {
	state := PRState(value)
	if state == "" {
		return "", nil
	}
	if !slices.Contains(prStates, state) {
		return "", fmt.Errorf("parse pr state %q: %w", value, ErrUnknownPRState)
	}
	return state, nil
}
