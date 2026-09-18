// Package pulls reads from GitHub the open pull requests of the registered
// repositories, reads a pull request on its own, and holds the filters and the
// pending rule of the Reviews view. It doesn't know what a review is.
package pulls

import (
	"time"

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
}

// Key identifies the pull request: owner/name#number, in lower case.
func (p PullRequest) Key() string { return task.IssueKey(p.Owner, p.Name, p.Number) }

// NewCommits reports whether the pull request moved since the last review of
// the account of gh.
func (p PullRequest) NewCommits() bool { return p.Reviewed && p.ReviewedCommit != p.HeadCommit }

// Detail is one pull request read on its own, open or not.
type Detail struct {
	PullRequest
	Body  string
	State string // "open" | "merged" | "closed"
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
