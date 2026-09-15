// Package attention knows what the tasks of the open workspace wait on the
// user for: it derives the situations from the state of every task, keeps when
// each one started and ended, and tells the user about a new one when the app
// is not in front of them.
package attention

import (
	"strconv"
	"strings"
	"time"

	"github.com/guilhermt/myspec/internal/task"
)

// Kind is what a situation asks of the user.
type Kind string

// The situations of the catalog, by group.
const (
	KindSessionError       Kind = "session_error"
	KindStepBlocked        Kind = "step_blocked"
	KindWorktreeUnreadable Kind = "worktree_unreadable"
	KindPRBlocked          Kind = "pr_blocked"
	KindPlanInvalid        Kind = "plan_invalid"
	KindPRClosed           Kind = "pr_closed"

	KindPermission      Kind = "permission"
	KindQuestion        Kind = "question"
	KindReply           Kind = "reply"
	KindReadyToContinue Kind = "ready_to_continue"
	KindStepReview      Kind = "step_review"
	KindStepEmpty       Kind = "step_empty"
	KindDraft           Kind = "draft"
	KindFindings        Kind = "findings"
	KindChangesReview   Kind = "changes_review"

	KindMerge            Kind = "merge"
	KindNothingToPublish Kind = "nothing_to_publish"
)

// Group is how urgent a situation is.
type Group string

// The groups, from the most urgent.
const (
	GroupError   Group = "error"   // errors and blocks
	GroupWaiting Group = "waiting" // the agent waits for the user
	GroupClosing Group = "closing" // merge and closing
)

// Group is the group a kind belongs to.
func (k Kind) Group() Group {
	switch k {
	case KindSessionError, KindStepBlocked, KindWorktreeUnreadable, KindPRBlocked, KindPlanInvalid, KindPRClosed:
		return GroupError
	case KindMerge, KindNothingToPublish:
		return GroupClosing
	default:
		return GroupWaiting
	}
}

// rank orders the groups, the most urgent first.
func (g Group) rank() int {
	switch g {
	case GroupError:
		return 0
	case GroupWaiting:
		return 1
	default:
		return 2
	}
}

// Form is the shape a situation is in, for the kinds that have more than one.
// Changing form is going on with the same situation.
type Form string

// The forms of step_review, changes_review and merge.
const (
	FormNone    Form = ""
	FormReview  Form = "review"  // nothing staged yet
	FormStaged  Form = "staged"  // part of the changed files staged
	FormApprove Form = "approve" // every changed file staged
	FormMerge   Form = "merge"   // the pull request is open
	FormClose   Form = "close"   // merged, or the merge could not be confirmed
)

// PlaceKind says what part of a task a place is.
type PlaceKind string

// The places a situation can be in.
const (
	PlaceStage      PlaceKind = "stage"       // a planning stage
	PlaceStep       PlaceKind = "step"        // the current step
	PlaceStepReview PlaceKind = "step_review" // the conversation that reviews the current step
	PlaceRepo       PlaceKind = "repo"        // a repository of the PR stage
)

// Place is where in a task a situation is.
type Place struct {
	Kind       PlaceKind
	Stage      task.Stage // PlaceStage only
	Step       int        // PlaceStep and PlaceStepReview only
	RepoPath   string     // PlaceRepo only
	Repository string     // PlaceRepo only: the path relative to the workspace, as the steps name it
}

// Key names a place inside its task, the way the store keeps it:
// stage:<stage>, step:<number>, step_review:<number> or repo:<absolute path>.
func (p Place) Key() string {
	switch p.Kind {
	case PlaceStep:
		return "step:" + strconv.Itoa(p.Step)
	case PlaceStepReview:
		return "step_review:" + strconv.Itoa(p.Step)
	case PlaceRepo:
		return "repo:" + p.RepoPath
	default:
		return "stage:" + string(p.Stage)
	}
}

// ParsePlace reads a key back. The relative path of a repository is not in
// the key; the next derivation brings it.
func ParsePlace(key string) (Place, bool) {
	prefix, value, found := strings.Cut(key, ":")
	if !found || value == "" {
		return Place{}, false
	}
	switch prefix {
	case "stage":
		stage, err := task.ParseStage(value)
		if err != nil {
			return Place{}, false
		}
		return Place{Kind: PlaceStage, Stage: stage}, true
	case "step", "step_review":
		number, err := strconv.Atoi(value)
		if err != nil || number <= 0 {
			return Place{}, false
		}
		return Place{Kind: PlaceKind(prefix), Step: number}, true
	case "repo":
		// The key is cut at its first colon, so a path with colons of its own
		// comes back whole.
		return Place{Kind: PlaceRepo, RepoPath: value}, true
	default:
		return Place{}, false
	}
}

// Found is a situation as one derivation sees it, before the service decides
// whether it started, goes on or is the same one it already holds.
type Found struct {
	TaskID  string
	Place   Place
	Kind    Kind
	Form    Form
	Percent int    // FormStaged only
	Title   string // the title of its notification: the name of the task
	Body    string // the text of its notification, in the form it is in now
}

// Situation is a situation the service holds: it started and has not ended.
type Situation struct {
	ID        string
	TaskID    string
	Place     Place
	Kind      Kind
	Form      Form
	Percent   int
	StartedAt time.Time
}
