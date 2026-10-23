// Package divergence keeps, per item, the divergence it has open: what the app
// expected after its one instruction to the agent, and found otherwise. It only
// keeps: the flows decide when one opens and when it ends.
package divergence

import (
	"context"
	"log/slog"
	"time"
)

// Kind says what the app expected and did not find.
type Kind string

// The divergences an item can have.
const (
	KindCommitMissing    Kind = "commit_missing"    // a commit turn ended with no new commit
	KindReportMissing    Kind = "report_missing"    // a pass ended with no report and no candidate
	KindReportUnreadable Kind = "report_unreadable" // the report of the pass is there and can't be read
	KindReportsAmbiguous Kind = "reports_ambiguous" // more than one file could be the report of the pass
	KindDraftMissing     Kind = "draft_missing"     // the draft of the pull request isn't there
	KindDraftUnreadable  Kind = "draft_unreadable"  // the draft of the pull request can't be read
	KindNoChanges        Kind = "no_changes"        // the approved findings went to the implementer and no file changed
	KindPRWrongBase      Kind = "pr_wrong_base"     // the pull request of the task goes into another base
	KindPROtherBranch    Kind = "pr_other_branch"   // a pull request of another branch has the head of the task
	KindPRsAmbiguous     Kind = "prs_ambiguous"     // more than one pull request could be the one of the task
	KindPRNotOpened      Kind = "pr_not_opened"     // the draft was approved and GitHub has no pull request
	KindPushRejected     Kind = "push_rejected"     // origin has commits the branch does not
	KindDraftsUnreadable Kind = "drafts_unreadable" // drafts.md still can't be read after the one correction
)

// kinds are the kinds this version knows.
var kinds = map[Kind]bool{
	KindCommitMissing:    true,
	KindReportMissing:    true,
	KindReportUnreadable: true,
	KindReportsAmbiguous: true,
	KindDraftMissing:     true,
	KindDraftUnreadable:  true,
	KindNoChanges:        true,
	KindPRWrongBase:      true,
	KindPROtherBranch:    true,
	KindPRsAmbiguous:     true,
	KindPRNotOpened:      true,
	KindPushRejected:     true,
	KindDraftsUnreadable: true,
}

// PR is a pull request a divergence names.
type PR struct {
	Number int    `json:"number"`
	URL    string `json:"url"`
	Base   string `json:"base"`
	Head   string `json:"head"`
}

// Facts are the concrete names of a divergence; each kind fills what it says.
type Facts struct {
	Branch     string   `json:"branch,omitempty"`     // the branch the commit or the push was about
	Base       string   `json:"base,omitempty"`       // the base the pull request was expected into, without origin/
	Commit     string   `json:"commit,omitempty"`     // short sha: the commit the step started on, the reviewed commit, or the head that was pushed
	Files      int      `json:"files"`                // the changed files of the worktree when the commit turn ended
	All        bool     `json:"all,omitempty"`        // commit_missing: the commit asked for every change, not the staged ones
	Pass       int      `json:"pass,omitempty"`       // the pass of the report or of the findings
	Approved   int      `json:"approved,omitempty"`   // no_changes: how many approved findings were sent
	Path       string   `json:"path,omitempty"`       // the file the app expected, relative to the artifacts folder of the item
	Reason     string   `json:"reason,omitempty"`     // why a file can't be read, or what git said
	Candidates []string `json:"candidates,omitempty"` // reports_ambiguous: the files, relative to the artifacts folder, sorted
	PRs        []PR     `json:"prs,omitempty"`        // the pull requests found
}

// Divergence is the divergence an item has open.
type Divergence struct {
	ItemID    string
	Stage     string // the conversation it belongs to, as session.Key.Stage
	Kind      Kind
	Facts     Facts
	StartedAt time.Time
}

// Mark is what the marker of a divergence keeps in the conversation.
type Mark struct {
	Kind  Kind  `json:"kind"`
	Facts Facts `json:"facts"`
}

// Row is a divergence as the database keeps it: the facts are their JSON.
type Row struct {
	ItemID    string
	Stage     string
	Kind      string
	Facts     string
	StartedAt time.Time
}

// Store is where the divergences are kept; internal/store implements it.
type Store interface {
	Divergences(ctx context.Context) ([]Row, error)
	PutDivergence(ctx context.Context, row Row) error
	DeleteDivergence(ctx context.Context, itemID string) error
}

// Deps are what a Service reaches outside itself with.
type Deps struct {
	Store    Store
	Log      *slog.Logger
	Now      func() time.Time
	OnChange func(itemID string) // may be nil
}
