package task

import (
	"errors"
	"fmt"
	"slices"
	"time"
)

// PRStatus is how far the app got with the PR stage of one repository, as it
// records it. What the interface shows on top of it comes from the session of
// the repository and from the disk.
type PRStatus string

// How far the app got with the PR stage of a repository.
const (
	PRPreparing  PRStatus = "preparing"  // gh and commit checks under way
	PRBlocked    PRStatus = "blocked"    // the stage could not start; Block says why
	PRDrafting   PRStatus = "drafting"   // the PR session is open, writing or waiting for the OK
	PROpening    PRStatus = "opening"    // the user approved the draft; the agent is opening the PR
	PRReviewing  PRStatus = "reviewing"  // the PR exists and the review session is running
	PRCommitting PRStatus = "committing" // the commit prompt was sent, waiting for the commit
	PRDone       PRStatus = "done"       // a pass closed clean; the repository awaits closing
	PRSkipped    PRStatus = "skipped"    // the branch has no commit past its base
)

// prStatuses lists every status a PR run may carry.
var prStatuses = []PRStatus{
	PRPreparing, PRBlocked, PRDrafting, PROpening, PRReviewing, PRCommitting, PRDone, PRSkipped,
}

// PRBlockReason says why the PR stage of a repository could not start.
type PRBlockReason string

// The reasons the PR stage of a repository is blocked.
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

// PRBlock is why the PR stage of a repository is blocked, in the words of the
// tool that refused.
type PRBlock struct {
	Reason PRBlockReason
	Detail string // what gh or git said, verbatim
}

// PRDetails is the pull request as gh last reported it.
type PRDetails struct {
	Number    int
	URL       string
	State     PRState // "" until a reading says otherwise
	CheckedAt time.Time
}

// PRRun is what the app recorded about the PR stage of one repository.
type PRRun struct {
	TaskID   string
	RepoPath string
	Status   PRStatus
	Block    *PRBlock // blocked only
	PR       PRDetails

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
