// Package worktree owns the worktrees the app creates for its tasks, one per
// task: where they are, how they come to be, whether they are clean, and how
// they go.
package worktree

import (
	"context"
	"errors"
	"path/filepath"
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
	Branch    string // the task name
	Base      string // the ref the branch was created from, e.g. origin/dev
	CreatedAt time.Time
}

// Store persists the registry of worktrees.
type Store interface {
	ListByTasks(ctx context.Context, taskIDs []string) ([]Worktree, error)
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

// Leftover is what Purge could not take back: the folder of a worktree, its
// branch, or both, with what git said.
type Leftover struct {
	Path   string // "" when the folder went
	Branch string // "" when the branch went
	Error  string
}

// The reasons Ensure refuses to create a worktree. Each wraps the git error
// when there is one, so errors.As(err, &gitErr) also works.
var (
	ErrFetchFailed  = errors.New("worktree: fetch failed")
	ErrNoBaseBranch = errors.New("worktree: neither origin/dev nor origin/main exists")
	ErrPathExists   = errors.New("worktree: path already exists")
	ErrBranchExists = errors.New("worktree: branch already exists")
)

// Path is where the worktree of a task lives: inside the data directory, one
// folder per repository, as GitHub names it, and one per task.
func Path(dataDir, owner, name, taskName string) string {
	return filepath.Join(dataDir, worktreesDir, owner, name, taskName)
}
