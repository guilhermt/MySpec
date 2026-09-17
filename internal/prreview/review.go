// Package prreview owns the review of a pull request as an item of the
// product: its record, the passes the agent wrote, the findings of each pass
// and what the user decided about them. What to do with a review, when to ask
// for a pass and when to publish, belongs to internal/reviewflow.
package prreview

import "time"

// Mode is what the product does with the findings the user approves.
type Mode string

// The modes a review runs in.
const (
	ModePublish Mode = "publish" // the approved findings are published on GitHub
	ModeApply   Mode = "apply"   // the agent applies them in the worktree
)

// Phase is where a review in apply mode is in the cycle that applies the
// findings.
type Phase string

// The phases of a review in apply mode; a review in publish mode has none.
const (
	PhaseNone       Phase = ""
	PhaseApplying   Phase = "applying"
	PhaseCommitting Phase = "committing"
)

// PRState is what became of the pull request under review.
type PRState string

// The states of a pull request.
const (
	PROpen   PRState = "open"
	PRMerged PRState = "merged"
	PRClosed PRState = "closed"
)

// Verdict is what a published review says about the pull request.
type Verdict string

// The verdicts a review is published with.
const (
	VerdictApprove        Verdict = "approve"
	VerdictRequestChanges Verdict = "request_changes"
	VerdictComment        Verdict = "comment"
)

// Decision is what the user decided about a finding.
type Decision string

// The decisions of a finding; DecisionNone is a finding still to decide.
const (
	DecisionNone      Decision = ""
	DecisionApproved  Decision = "approved"
	DecisionDiscarded Decision = "discarded"
)

// Placement is where a published finding went in the review.
type Placement string

// The placements of a finding; PlacementNone is a finding nobody published.
const (
	PlacementNone   Placement = ""
	PlacementInline Placement = "inline"
	PlacementBody   Placement = "body"
)

// Card is the card a pull request is linked to, as the review keeps it.
type Card struct {
	BoardID string `json:"boardId"`
	Owner   string `json:"owner"`
	Name    string `json:"name"`
	Number  int    `json:"number"`
	Title   string `json:"title"`
	URL     string `json:"url"`
	Status  string `json:"status"` // the Status of the card on its board; "" for none
}

// Review is the review of one pull request.
type Review struct {
	ID              string
	RepositoryID    string
	Number          int
	Title           string
	Author          string
	URL             string
	HeadBranch      string
	BaseBranch      string // as GitHub names it, without origin/
	Own             bool   // the author is the gh account
	Mode            Mode
	Phase           Phase
	Card            *Card // nil when the pull request has no card
	ArtifactsDir    string
	AskedPass       int    // the last pass the app asked for
	ReportedPass    int    // the last pass whose report the app recorded
	PassCommit      string // the commit the last recorded report covered
	PublishedPass   int
	PublishedCommit string // the head the last published review was sent against
	HeadCommit      string // the head GitHub last reported
	PRState         PRState
	PRCheckedAt     time.Time
	PublishError    string // why the last publication failed; "" otherwise
	ArchivedAt      time.Time
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// Finding is one numbered finding of a pass.
type Finding struct {
	Number    int
	Path      string // the file it is anchored to; "" for a general finding
	Line      int    // the line of the new side of the diff; 0 for a general finding
	Original  string // as the report has it
	Text      string // as the user left it
	Decision  Decision
	Placement Placement
}

// Pass is one pass of the agent over the pull request, with the report it
// wrote and what the user did with it.
type Pass struct {
	ReviewID        string
	Number          int
	Instructions    string // what the user wrote when asking for the pass
	Recorded        bool   // a readable report was recorded
	Clean           bool
	Commit          string // the head of the worktree when the report was recorded
	SummaryOriginal string // as the report has it
	Summary         string // as the user left it
	Revision        int    // bumped every time the report is read again and differs
	Verdict         Verdict
	PublishedAt     time.Time
	PublishedURL    string
	Findings        []Finding
	CreatedAt       time.Time
}
