package task

import (
	"errors"
	"fmt"
	"slices"
	"time"
)

// StepStatus is how far the app got with a step, as it records it. What the
// interface shows on top of it comes from the session of the step.
type StepStatus string

// How far the app got with a step it started.
const (
	StepPreparing StepStatus = "preparing" // fetch, worktree and check under way
	StepBlocked   StepStatus = "blocked"   // the start failed; Block says why
	StepStarted   StepStatus = "started"   // the session of the step exists
)

// stepStatuses lists every status a step run may carry.
var stepStatuses = []StepStatus{StepPreparing, StepBlocked, StepStarted}

// BlockReason says why a step could not start.
type BlockReason string

// The reasons a step could not start.
const (
	BlockDirty        BlockReason = "dirty_worktree"
	BlockFetchFailed  BlockReason = "fetch_failed"
	BlockNoBase       BlockReason = "no_base_branch"
	BlockPathExists   BlockReason = "path_exists"
	BlockBranchExists BlockReason = "branch_exists"
	BlockGitFailed    BlockReason = "git_failed"
	BlockNoRepository BlockReason = "no_repository"
)

// blockReasons lists every reason a step may be blocked for.
var blockReasons = []BlockReason{
	BlockDirty, BlockFetchFailed, BlockNoBase, BlockPathExists,
	BlockBranchExists, BlockGitFailed, BlockNoRepository,
}

// The ways a stored step value fails to be read back.
var (
	ErrUnknownStepStatus  = errors.New("task: unknown step status")
	ErrUnknownBlockReason = errors.New("task: unknown block reason")
)

// StepBlock is why a step is blocked, in git's own words when git said them.
type StepBlock struct {
	Reason BlockReason
	Detail string // what git said; the status lines of a dirty worktree; the path or branch that exists
	Files  int    // dirty worktree only: how many entries git status listed
}

// StepRun is what the app recorded about a step it started.
type StepRun struct {
	TaskID    string
	Number    int
	Status    StepStatus
	Block     *StepBlock // blocked only
	CreatedAt time.Time
	UpdatedAt time.Time
}

// ParseStepStatus narrows a stored or received string to a step status.
func ParseStepStatus(value string) (StepStatus, error) {
	status := StepStatus(value)
	if !slices.Contains(stepStatuses, status) {
		return "", fmt.Errorf("parse step status %q: %w", value, ErrUnknownStepStatus)
	}
	return status, nil
}

// ParseBlockReason narrows a stored or received string to a block reason.
func ParseBlockReason(value string) (BlockReason, error) {
	reason := BlockReason(value)
	if !slices.Contains(blockReasons, reason) {
		return "", fmt.Errorf("parse block reason %q: %w", value, ErrUnknownBlockReason)
	}
	return reason, nil
}
