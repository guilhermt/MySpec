// Package prreview owns the review of a pull request as an item of the
// product: its record, the passes the agent wrote, the findings of each pass
// and what the user decided about them. What to do with a review, when to ask
// for a pass and when to publish, belongs to internal/reviewflow.
package prreview

import (
	"errors"
	"fmt"
	"path/filepath"
	"slices"
	"time"
)

// Mode is what the product does with the findings the user approves.
type Mode string

// The modes a review runs in.
const (
	ModePublish Mode = "publish" // the approved findings are published on GitHub
	ModeApply   Mode = "apply"   // the agent applies them in the worktree
)

// Phase is where a review is in the cycle of a pass: waiting for the checks
// of the head before one, and, in apply mode, applying the findings or
// committing the fixes.
type Phase string

// The phases of a review.
const (
	PhaseNone          Phase = ""
	PhaseWaitingChecks Phase = "waiting_checks" // both modes: a pass was asked for and waits for GitHub
	PhaseApplying      Phase = "applying"       // apply only
	PhaseCommitting    Phase = "committing"     // apply only
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
	Phase           Phase // where the review is in the cycle of a pass; PhaseNone while the findings are the user's
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
	// Applied is set once the fixes of the approved findings went up in a
	// commit the app asked for, in apply mode.
	Applied   bool
	Findings  []Finding
	CreatedAt time.Time
}

// Modes lists the modes in the order the interface offers them.
var Modes = []Mode{ModePublish, ModeApply}

// ParseMode narrows a stored or received string to a mode.
func ParseMode(value string) (Mode, error) {
	if !slices.Contains(Modes, Mode(value)) {
		return "", fmt.Errorf("parse review mode %q: %w", value, ErrUnknownMode)
	}
	return Mode(value), nil
}

// Verdicts lists the verdicts in the order the interface offers them.
var Verdicts = []Verdict{VerdictApprove, VerdictRequestChanges, VerdictComment}

// ParseVerdict narrows a stored or received string to a verdict.
func ParseVerdict(value string) (Verdict, error) {
	if !slices.Contains(Verdicts, Verdict(value)) {
		return "", fmt.Errorf("parse verdict %q: %w", value, ErrUnknownVerdict)
	}
	return Verdict(value), nil
}

// decisions lists the decisions a finding is stored with, the undecided one
// included.
var decisions = []Decision{DecisionNone, DecisionApproved, DecisionDiscarded}

// ParseDecision narrows a stored or received string to a decision. The empty
// string is a finding still to decide.
func ParseDecision(value string) (Decision, error) {
	if !slices.Contains(decisions, Decision(value)) {
		return "", fmt.Errorf("parse decision %q: %w", value, ErrUnknownDecision)
	}
	return Decision(value), nil
}

// Archived reports whether the review left the list for the history.
func (r Review) Archived() bool { return !r.ArchivedAt.IsZero() }

// ReportPath is the report the agent writes for one pass.
func (r Review) ReportPath(pass int) string {
	return filepath.Join(r.ArtifactsDir, ReportFile(pass))
}

// ContextPath is the file that tells the agent which pull request it reviews.
func (r Review) ContextPath() string {
	return filepath.Join(r.ArtifactsDir, ContextFile)
}

// Reference is the pull request as GitHub names it: owner/name#number.
func (r Review) Reference(fullName string) string {
	return fmt.Sprintf("%s#%d", fullName, r.Number)
}

// Anchored reports whether the finding points at a line of the pull request,
// which is what an inline comment needs.
func (f Finding) Anchored() bool { return f.Path != "" && f.Line > 0 }

// Published reports whether the pass was sent to GitHub.
func (p Pass) Published() bool { return !p.PublishedAt.IsZero() }

// Decided reports whether the user decided on every finding of the pass. A
// pass with no findings is decided.
func (p Pass) Decided() bool {
	for _, finding := range p.Findings {
		if finding.Decision == DecisionNone {
			return false
		}
	}
	return true
}

// Approved are the findings the user kept, in the order the report numbered
// them.
func (p Pass) Approved() []Finding {
	var approved []Finding
	for _, finding := range p.Findings {
		if finding.Decision == DecisionApproved {
			approved = append(approved, finding)
		}
	}
	return approved
}

// reviewsDirName is the folder of the artifacts of every review inside the
// data directory.
const reviewsDirName = "reviews"

// idPrefixLen is how much of the id of a review names its folder: enough to
// tell apart two reviews of the same pull request, short enough to read.
const idPrefixLen = 8

// ContextFile is the name of the file that describes the pull request under
// review.
const ContextFile = "context.md"

// ReportFile is the name of the report of one pass.
func ReportFile(pass int) string { return fmt.Sprintf("review-%d.md", pass) }

// ArtifactsDir is where the artifacts of a review live: one folder per
// repository, as GitHub names it, and one per review, so that a pull request
// reviewed twice never mixes the two.
func ArtifactsDir(dataDir, owner, name string, number int, id string) string {
	short := id
	if len(short) > idPrefixLen {
		short = short[:idPrefixLen]
	}
	return filepath.Join(dataDir, reviewsDirName, owner, name, fmt.Sprintf("pr-%d-%s", number, short))
}

// The ways an action on a review is refused.
var (
	ErrNotFound        = errors.New("prreview: not found")
	ErrActiveExists    = errors.New("prreview: the pull request already has an active review")
	ErrNotDeciding     = errors.New("prreview: the pass is not the one being decided")
	ErrEmptyText       = errors.New("prreview: the text of a finding is required")
	ErrUnknownMode     = errors.New("prreview: unknown mode")
	ErrUnknownVerdict  = errors.New("prreview: unknown verdict")
	ErrUnknownDecision = errors.New("prreview: unknown decision")
	ErrUnknownArtifact = errors.New("prreview: unknown artifact")
)
