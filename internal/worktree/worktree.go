// Package worktree owns the worktrees the app creates for its tasks: where
// they are, how they come to be, whether they are clean, and how they go.
package worktree

import (
	"context"
	"errors"
	"path/filepath"
	"time"
)

// The layout of the worktrees inside a workspace.
const (
	Dir          = ".myspec" // hidden, so the workspace scan never lists a worktree as a repository
	worktreesDir = "worktrees"
	rootSegment  = "_root"    // stands for a repository that is the workspace root itself
	excludeLine  = ".myspec/" // what a root repository is told to ignore
	dirPerm      = 0o750
	filePerm     = 0o600
)

// The timeouts of the git commands. A fetch talks to the network; the rest is
// local work.
const (
	FetchTimeout   = 2 * time.Minute
	CommandTimeout = 30 * time.Second
)

// Worktree is a worktree the app created.
type Worktree struct {
	TaskID    string
	RepoPath  string // the repository it was added to, absolute
	Path      string // absolute
	Branch    string // the task name
	CreatedAt time.Time
}

// Store persists the registry of worktrees.
type Store interface {
	ListByTasks(ctx context.Context, taskIDs []string) ([]Worktree, error)
	Insert(ctx context.Context, wt Worktree) error
	Delete(ctx context.Context, taskID, repoPath string) error
}

// Phase is what Ensure is doing, for the interface to show while it runs.
type Phase string

// The phases of a creation, in order.
const (
	PhaseFetching Phase = "fetching"
	PhaseCreating Phase = "creating"
)

// Status is what git status reports of a worktree.
type Status struct {
	Entries []string // the porcelain lines; empty when clean
}

// Clean reports whether nothing is modified, staged, deleted or untracked.
func (s Status) Clean() bool { return len(s.Entries) == 0 }

// The reasons Ensure refuses to create a worktree. Each wraps the git error
// when there is one, so errors.As(err, &gitErr) also works.
var (
	ErrFetchFailed  = errors.New("worktree: fetch failed")
	ErrNoBaseBranch = errors.New("worktree: neither origin/dev nor origin/main exists")
	ErrPathExists   = errors.New("worktree: path already exists")
	ErrBranchExists = errors.New("worktree: branch already exists")
)

// Path is where the worktree of a task in a repository lives:
// {workspace}/.myspec/worktrees/{repo}/{task}, with "_root" standing for the
// workspace root when it is itself the repository.
func Path(workspacePath, rel, taskName string) string {
	segment := rel
	if rel == "." {
		segment = rootSegment
	}
	return filepath.Join(workspacePath, Dir, worktreesDir, segment, taskName)
}
