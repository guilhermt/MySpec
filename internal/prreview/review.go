// Package prreview owns the review of a pull request as an item of the
// product: its record, the passes the agent wrote, the findings of each pass
// and what the user decided about them. What to do with a review, when to ask
// for a pass and when to publish, belongs to internal/reviewflow.
package prreview

import (
	"errors"
	"fmt"
	"path/filepath"
	"regexp"
	"slices"
	"time"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/prreport"
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
type Decision = prreport.Decision

// The decisions of a finding; DecisionNone is a finding still to decide.
const (
	DecisionNone      = prreport.DecisionNone
	DecisionApproved  = prreport.DecisionApproved
	DecisionDiscarded = prreport.DecisionDiscarded
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

	// TroubleBaseline is what the reading the last pass started from showed
	// wrong, and Trouble what went wrong since, while the review rested
	// published or ready to merge.
	TroubleBaseline gh.Trouble
	Trouble         gh.Trouble

	// MergedBy, MergedAt and ClosedAt are who merged the pull request and
	// when, and when it closed, as gh read them when the review ended; empty
	// for a review archived before they were kept.
	MergedBy string
	MergedAt time.Time
	ClosedAt time.Time

	ArchivedAt time.Time
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// End is how the pull request of a review ended: merged or closed, with who
// merged it and when, as gh reads them.
type End struct {
	State    PRState
	MergedBy string
	MergedAt time.Time
	ClosedAt time.Time
}

// Finding is one numbered finding of a pass, with where it went when the
// pass was published.
type Finding struct {
	prreport.Finding
	Placement Placement
}

// ReportFindings are the findings of a pass as the report owns them, without
// where a publication put them.
func ReportFindings(findings []Finding) []prreport.Finding {
	reported := make([]prreport.Finding, 0, len(findings))
	for _, finding := range findings {
		reported = append(reported, finding.Finding)
	}
	return reported
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
	Applied bool

	Checks           []gh.Check   // the checks of the reading that let the pass start; nil before it was sent and for a pass sent before they were kept
	Mergeable        gh.Mergeable // "" as Checks
	ChecksReadAt     time.Time    // when that reading was made; zero as Checks
	RecordedAt       time.Time    // when the report was first recorded; zero before, and for a pass recorded before it was kept
	SentAt           time.Time    // apply mode: when the approved findings went to the agent; zero before
	SummaryPublished bool         // the summary went with the published review

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

// ParseDecision narrows a stored or received string to a decision. The empty
// string is a finding still to decide.
func ParseDecision(value string) (Decision, error) { return prreport.ParseDecision(value) }

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

// reportFileName is the name a report of a pass may have: review-<pass>.md.
var reportFileName = regexp.MustCompile(`^review-\d+\.md$`)

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
	ErrUnknownMode     = errors.New("prreview: unknown mode")
	ErrUnknownVerdict  = errors.New("prreview: unknown verdict")
	ErrUnknownArtifact = errors.New("prreview: unknown artifact")
)
