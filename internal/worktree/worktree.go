// Package worktree owns the worktrees the app creates for its items, one per
// item: where they are, how they come to be, whether they are clean, and how
// they go. A task works on a branch of its own; the review of a pull request
// works on a detached HEAD at the head of that pull request.
package worktree

import (
	"context"
	"errors"
	"path/filepath"
	"strconv"
	"time"
)

// The layout of the worktrees inside the data directory.
const (
	worktreesDir = "worktrees"
	dirPerm      = 0o750
)

// The timeouts of the git commands. A fetch talks to the network; the rest is
// local work.
const (
	FetchTimeout   = 2 * time.Minute
	CommandTimeout = 30 * time.Second
)

// Worktree is a worktree the app created.
type Worktree struct {
	TaskID string
	// RepoPath is the clone git runs in for it: where it was added, or where
	// the repository was moved since.
	RepoPath  string
	Path      string // absolute
	Branch    string // the task name; "" for a worktree on a detached HEAD
	Base      string // the ref the branch was created from, e.g. origin/dev
	CreatedAt time.Time
}

// Store persists the registry of worktrees.
type Store interface {
	ListByTasks(ctx context.Context, itemIDs []string) ([]Worktree, error)
	Insert(ctx context.Context, wt Worktree) error
	Delete(ctx context.Context, taskID string) error
}

// Phase is what Ensure is doing, for the interface to show while it runs.
type Phase string

// The phases of a creation, in order.
const (
	PhaseFetching Phase = "fetching"
	PhaseCreating Phase = "creating"
)

// BranchPolicy says what Close does with the branch of the worktree.
type BranchPolicy int

const (
	// DeleteBranch deletes the branch whatever git thinks of it: GitHub
	// confirmed the merge, or the branch has no commit of its own.
	DeleteBranch BranchPolicy = iota
	// DeleteBranchIfMerged deletes the branch only when git sees it in the
	// base branch, and keeps it otherwise.
	DeleteBranchIfMerged
)

// Leftover is what git could not remove when a worktree was purged: each part
// with whether it stayed and what git said, and the clone it belongs to.
type Leftover struct {
	RepoPath  string // the clone the worktree and the branch belong to
	Path      string // the worktree folder
	PathKept  bool   // git couldn't remove the folder
	PathError string // what git said; "" when it went
	// PathRegistered says that git still lists the folder that stayed as a
	// worktree of the clone, which git worktree remove can take down; a
	// folder git forgot is only a folder.
	PathRegistered bool
	Branch         string
	BranchKept     bool   // git couldn't delete the branch
	BranchError    string // what git said; "" when it went
}

// The reasons Ensure refuses to create a worktree. Each wraps the git error
// when there is one, so errors.As(err, &gitErr) also works.
var (
	ErrFetchFailed  = errors.New("worktree: fetch failed")
	ErrNoBaseBranch = errors.New("worktree: neither origin/dev nor origin/main exists")
	ErrPathExists   = errors.New("worktree: path already exists")
	ErrBranchExists = errors.New("worktree: branch already exists")
	ErrNoHeadBranch = errors.New("worktree: the head branch does not exist on origin")
	ErrDirty        = errors.New("worktree: the worktree has changes")
)

// ReviewDirName is the folder the worktree of the review of a pull request
// lives in. A task name never holds an underscore, so it never collides with
// the folder of a task.
func ReviewDirName(number int) string { return "pr_" + strconv.Itoa(number) }

// Path is where the worktree of an item lives: inside the data directory, one
// folder per repository, as GitHub names it, and one per item: the name of a
// task, or ReviewDirName for the review of a pull request.
func Path(dataDir, owner, name, dirName string) string {
	return filepath.Join(dataDir, worktreesDir, owner, name, dirName)
}
