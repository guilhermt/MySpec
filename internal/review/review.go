// Package review watches the worktrees under review and keeps what git says
// about them, so the app can show the progress of a review as the user stages
// what they have read.
package review

import (
	"time"

	"github.com/guilhermt/myspec/internal/git"
)

// reviewDebounce is how long a worktree must stay quiet before it is read.
// Staging a file in VS Code rewrites the index and touches the file; the app
// only cares about the state left behind.
const reviewDebounce = 200 * time.Millisecond

// readTimeout bounds one reading, which runs on the watcher's goroutine.
const readTimeout = 30 * time.Second

// File is one changed path of a worktree under review.
type File struct {
	Path    string
	Kind    git.Kind
	Staged  bool // nothing of it is left outside the index
	Partial bool // part of it is in the index and part is not
}

// Snapshot is the last reading of a worktree. A failed reading carries Err and
// nothing else: an old number is worse than no number.
type Snapshot struct {
	Head   string
	Files  []File // in git's order
	Staged int
	Total  int
	Err    string
	ReadAt time.Time
}

// Percent is how much of the review is done, 0 when there is nothing to
// review. It only reaches 100 when every file is staged.
func (s Snapshot) Percent() int {
	if s.Total == 0 {
		return 0
	}
	return s.Staged * 100 / s.Total
}

// Ready reports whether the review can be approved: something changed, and
// nothing is left outside the index.
func (s Snapshot) Ready() bool { return s.Err == "" && s.Total > 0 && s.Staged == s.Total }

// Empty reports a worktree that was read and has no change at all.
func (s Snapshot) Empty() bool { return s.Err == "" && s.Total == 0 }
