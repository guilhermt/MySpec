// Package discussion owns a discussion as an item of the product: its record,
// the cards it started from, the drafts the agent wrote, what the user edited
// and decided about each one and what was published on GitHub. What to do with
// a discussion, when to read the drafts and when to publish, belongs to
// internal/discussionflow.
package discussion

import (
	"errors"
	"fmt"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/guilhermt/myspec/internal/task"
)

// Kind is what a draft asks GitHub for.
type Kind string

// The kinds of a draft.
const (
	KindNew    Kind = "new"    // an issue to create
	KindUpdate Kind = "update" // an issue that exists, rewritten
	KindEpic   Kind = "epic"   // an issue that groups the cards under it
)

// Kinds lists the kinds in the order the interface offers them.
var Kinds = []Kind{KindNew, KindUpdate, KindEpic}

// ParseKind narrows a stored or received string to a kind.
func ParseKind(value string) (Kind, error) {
	if !slices.Contains(Kinds, Kind(value)) {
		return "", fmt.Errorf("parse draft kind %q: %w", value, ErrUnknownKind)
	}
	return Kind(value), nil
}

// Source is who a draft came from.
type Source string

// The sources of a draft.
const (
	SourceAgent Source = "agent" // the artifact the agent wrote
	SourceUser  Source = "user"  // the user grouped cards into an epic
)

// Decision is what the user decided about a draft.
type Decision string

// The decisions of a draft; DecisionNone is a draft still to decide.
const (
	DecisionNone      Decision = ""
	DecisionApproved  Decision = "approved"
	DecisionDiscarded Decision = "discarded"
)

// decisions lists the decisions a draft is stored with, the undecided one
// included.
var decisions = []Decision{DecisionNone, DecisionApproved, DecisionDiscarded}

// ParseDecision narrows a stored or received string to a decision. The empty
// string is a draft still to decide.
func ParseDecision(value string) (Decision, error) {
	if !slices.Contains(decisions, Decision(value)) {
		return "", fmt.Errorf("parse decision %q: %w", value, ErrUnknownDecision)
	}
	return Decision(value), nil
}

// Outcome is what the publication of a draft did on GitHub.
type Outcome string

// The outcomes of a draft; OutcomeNone is a draft nothing was written for.
const (
	OutcomeNone    Outcome = ""
	OutcomeCreated Outcome = "created"
	OutcomeUpdated Outcome = "updated"
)

// Drop is why a dependency was not recorded on GitHub.
type Drop string

// The ways a dependency is dropped; DropNone is a dependency still standing.
const (
	DropNone        Drop = ""
	DropDiscarded   Drop = "discarded"   // the draft it points at was discarded
	DropUnavailable Drop = "unavailable" // GitHub refused the relation
)

// InputCard is a card the discussion started from.
type InputCard struct {
	Owner  string
	Name   string
	Number int
	Title  string
	URL    string
}

// Key identifies the issue of the card: owner/name#number, in lower case.
func (c InputCard) Key() string { return task.IssueKey(c.Owner, c.Name, c.Number) }

// Reference is the card as GitHub names it: owner/name#number.
func (c InputCard) Reference() string {
	return c.Owner + "/" + c.Name + "#" + strconv.Itoa(c.Number)
}

// refFullName is an issue as a draft names it: owner/name#number.
var refFullName = regexp.MustCompile(`^([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)#(\d+)$`)

// refDraftID is the id of a draft of the discussion.
var refDraftID = regexp.MustCompile(`^[a-z0-9][a-z0-9-]*$`)

// Ref names what a draft points at: another draft of the discussion, by id, or
// an issue on GitHub. Exactly one of Draft and the issue fields is set.
type Ref struct {
	Draft  string
	Owner  string
	Name   string
	Number int
}

// IsDraft reports whether the reference points at a draft of the discussion.
func (r Ref) IsDraft() bool { return r.Draft != "" }

// String is the reference as a draft writes it: the draft id, or
// owner/name#number.
func (r Ref) String() string {
	if r.IsDraft() {
		return r.Draft
	}
	return r.Owner + "/" + r.Name + "#" + strconv.Itoa(r.Number)
}

// Key identifies what the reference points at, so that two ways of writing the
// same issue are one.
func (r Ref) Key() string {
	if r.IsDraft() {
		return "draft:" + r.Draft
	}
	return task.IssueKey(r.Owner, r.Name, r.Number)
}

// ParseRef reads a reference: owner/name#number of an issue, or the id of a
// draft of the discussion.
func ParseRef(value string) (Ref, bool) {
	value = strings.TrimSpace(value)
	if m := refFullName.FindStringSubmatch(value); m != nil {
		number, err := strconv.Atoi(m[3])
		if err != nil || number <= 0 {
			return Ref{}, false
		}
		return Ref{Owner: m[1], Name: m[2], Number: number}, true
	}
	if refDraftID.MatchString(value) {
		return Ref{Draft: value}, true
	}
	return Ref{}, false
}

// Dependency is a card a draft can only start after.
type Dependency struct {
	Ref
	Original bool // the artifact names it
	Linked   bool // GitHub has the relation
	Dropped  Drop
	Detail   string // DropUnavailable: what gh said
}

// Publication is what the app wrote on GitHub for one draft, step by step, so
// that a run that failed halfway is taken up where it stopped.
type Publication struct {
	Outcome   Outcome
	Number    int
	URL       string
	NodeID    string
	ItemID    string
	StatusSet bool
	ModuleSet bool
	ParentSet bool
	At        time.Time // zero until every step is done
}

// Done reports whether every step of the publication finished.
func (p Publication) Done() bool { return !p.At.IsZero() }

// Started reports whether something was written on GitHub for the draft, which
// is what makes it read only.
func (p Publication) Started() bool { return p.Outcome != OutcomeNone }

// Draft is one card the discussion produced: as the artifact has it, as the
// user left it, and what became of it on GitHub.
type Draft struct {
	DiscussionID       string
	ID                 string
	Position           int
	Kind               Kind
	Source             Source
	Owner              string // the repository of the issue, as the draft has it now
	Name               string
	RepositoryOriginal string     // owner/name as the artifact has it
	Card               *InputCard // update: the card it updates; nil otherwise
	TitleOriginal      string     // as the artifact has it
	Title              string     // as the user left it
	BodyOriginal       string
	Body               string
	ModuleOriginal     string // the name of the option; "" for none
	Module             string
	EpicOriginal       string       // Ref.String(); "" for none. Card drafts only.
	Epic               string       // Ref.String(); "" for none. Card drafts only.
	Dependencies       []Dependency // card drafts only
	Decision           Decision
	Revision           int      // bumped every time the artifact changes the draft
	Warnings           []string // what a publication or a rewrite said
	PublishError       string   // why the last publication failed; "" otherwise
	Published          Publication
}

// IsCard reports whether the draft is a card, which an epic is not.
func (d Draft) IsCard() bool { return d.Kind != KindEpic }

// EpicRef is what the epic of the draft points at.
func (d Draft) EpicRef() (Ref, bool) { return ParseRef(d.Epic) }

// InEpicDraft reports whether the epic of the draft is another draft of the
// discussion, which is published with it.
func (d Draft) InEpicDraft() bool {
	ref, ok := d.EpicRef()
	return ok && ref.IsDraft()
}

// Loose reports whether the draft is a card published on its own, and not as a
// member of an epic of the discussion.
func (d Draft) Loose() bool { return d.IsCard() && !d.InEpicDraft() }

// FullName is the repository of the issue of the draft, as GitHub names it.
func (d Draft) FullName() string { return d.Owner + "/" + d.Name }

// Reference is the issue of the draft as GitHub names it: the one it published,
// or the card an update rewrites. It is "" before either.
func (d Draft) Reference() string {
	number := d.Published.Number
	if number == 0 && d.Card != nil {
		number = d.Card.Number
	}
	if number == 0 {
		return ""
	}
	return d.FullName() + "#" + strconv.Itoa(number)
}

// Decided reports whether the user settled the draft, or the app already
// published it.
func (d Draft) Decided() bool { return d.Decision != DecisionNone || d.Published.Done() }

// Discussion is one discussion of a demand of a board.
type Discussion struct {
	ID             string
	BoardID        string
	BoardTitle     string // as it was when the discussion was created
	Title          string
	Text           string // what the user wrote when creating it; "" for none
	InitialContext string
	ArtifactsDir   string
	Cards          []InputCard
	DraftsRead     bool // a readable drafts artifact was recorded
	DraftsRevision int  // bumped every time the artifact is read again and differs
	ArchivedAt     time.Time
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// Archived reports whether the discussion left the list for the history.
func (d Discussion) Archived() bool { return !d.ArchivedAt.IsZero() }

// DocumentPath is the understanding the agent wrote.
func (d Discussion) DocumentPath() string { return filepath.Join(d.ArtifactsDir, DocumentFile) }

// DraftsPath is the artifact of the drafts the app reads.
func (d Discussion) DraftsPath() string { return filepath.Join(d.ArtifactsDir, DraftsFile) }

// ContextPath is the file that tells the agent what is to be discussed.
func (d Discussion) ContextPath() string { return filepath.Join(d.ArtifactsDir, ContextFile) }

// The files of the artifact folder of a discussion.
const (
	DocumentFile = "discussion.md"
	DraftsFile   = "drafts.md"
	ContextFile  = "context.md"
)

// discussionsDirName is the folder of the artifacts of every discussion inside
// the data directory.
const discussionsDirName = "discussions"

// idPrefixLen is how much of the id of a discussion names its folder: enough to
// tell two discussions of the same board apart, short enough to read.
const idPrefixLen = 8

// TitleMaxLen is the longest title a discussion takes.
const TitleMaxLen = 120

// ArtifactsDir is where the artifacts of a discussion live: one folder per
// board, as GitHub names it, and one per discussion.
func ArtifactsDir(dataDir, boardOwner string, boardNumber int, id string) string {
	short := id
	if len(short) > idPrefixLen {
		short = short[:idPrefixLen]
	}
	return filepath.Join(dataDir, discussionsDirName, boardOwner, strconv.Itoa(boardNumber), short)
}

// The ways an action on a discussion or on a draft is refused.
var (
	ErrNotFound         = errors.New("discussion: not found")
	ErrEmptyTitle       = errors.New("discussion: the title is required")
	ErrTitleTooLong     = errors.New("discussion: the title is too long")
	ErrNothingToDiscuss = errors.New("discussion: a text or at least one card is required")
	ErrUnknownKind      = errors.New("discussion: unknown draft kind")
	ErrUnknownDecision  = errors.New("discussion: unknown decision")
	ErrUnknownArtifact  = errors.New("discussion: unknown artifact")
	ErrDraftNotFound    = errors.New("discussion: the draft is not one of the discussion")
	ErrPublished        = errors.New("discussion: the draft was published and can't change")
	ErrInvalidRef       = errors.New("discussion: the reference is not usable here")
	ErrEmptyText        = errors.New("discussion: the title and the body of a draft are required")
	ErrNotEpic          = errors.New("discussion: the reference is not an epic draft of the discussion")
	ErrTooFewCards      = errors.New("discussion: an epic needs at least two cards")
	ErrDependencyLinked = errors.New("discussion: the dependency is already on GitHub")
	ErrArchived         = errors.New("discussion: the discussion is archived")
	ErrUntitled         = errors.New("discussion: a draft needs a title to be approved")
)
