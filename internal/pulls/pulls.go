// Package pulls reads from GitHub the open pull requests of the registered
// repositories, reads a pull request on its own, and holds the filters and the
// pending rule of the Reviews view. It doesn't know what a review is.
package pulls

import (
	"time"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/task"
)

// Label is a label of a pull request, as GitHub colours it.
type Label struct {
	Name  string
	Color string
}

// PullRequest is an open pull request of a registered repository.
type PullRequest struct {
	Owner  string
	Name   string
	Number int
	Title  string
	URL    string
	Author string // the login, "ghost" when the account is gone
	Labels []Label
	Draft  bool
	Fork   bool // the branch comes from a fork
	// HeadBranch is the branch of the pull request; HeadCommit is its tip.
	HeadBranch string
	HeadCommit string
	BaseBranch string
	UpdatedAt  time.Time
	// Reviewed reports whether the account of gh submitted a review of it.
	Reviewed bool
	// ReviewedCommit is the commit of that last submitted review; "" when none.
	ReviewedCommit string
	// Body is the description, as Markdown; "" when there is none.
	Body string
	// Checks are the checks of the head and whether it merges into the base;
	// only a list reading fills them, a Detail keeps its own.
	Checks gh.PRChecks
	// YourReview is the last review the account of gh submitted; nil when none.
	YourReview *YourReview
	// NewCommitCount is how many commits came after the commit of that review:
	// 0 without one or when the head is that commit, -1 when that commit is not
	// among the last 100 of the pull request.
	NewCommitCount int
}

// YourReview is a review the account of gh submitted: its state and when.
type YourReview struct {
	State string // approved, changes_requested, commented or dismissed
	At    time.Time
}

// Commit is one commit of a pull request, as a reading lists it.
type Commit struct {
	SHA     string
	Subject string // the first line of the message
	Author  string // the login, or the name of an author without an account
}

// Key identifies the pull request: owner/name#number, in lower case.
func (p PullRequest) Key() string { return task.IssueKey(p.Owner, p.Name, p.Number) }

// NewCommits reports whether the pull request moved since the last review of
// the account of gh.
func (p PullRequest) NewCommits() bool { return p.Reviewed && p.ReviewedCommit != p.HeadCommit }

// Detail is one pull request read on its own, open or not.
type Detail struct {
	PullRequest
	State  string      // "open" | "merged" | "closed"
	Checks gh.PRChecks // what GitHub says about the head: its checks and whether it merges clean
	// Commits are the last 50 commits, oldest first; never nil.
	Commits  []Commit
	MergedBy string    // the login of who merged it; "" when it isn't merged
	MergedAt time.Time // zero when it isn't merged
	ClosedAt time.Time // zero while it is open
}

// Ref names a pull request to read.
type Ref struct {
	Owner  string
	Name   string
	Number int
}

// RepositoryReading is what the last reading found about one repository.
type RepositoryReading struct {
	RepositoryID string
	PullRequests []PullRequest // updated most recently first; never nil
	// Failure is why the last reading of this repository failed; the list is
	// then the one the reading before it found.
	Failure *Failure
}
