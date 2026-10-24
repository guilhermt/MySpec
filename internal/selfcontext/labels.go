package selfcontext

import (
	"fmt"
	"strings"

	"github.com/guilhermt/myspec/internal/discussionflow"
	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/reviewflow"
	"github.com/guilhermt/myspec/internal/reviewmode"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

// The labels below repeat the ones the interface shows, because the state a
// session reads names things as the screen does. Each one names its TypeScript
// function; frontend/src/test/ui-labels.json keeps the two sides equal.

// stageLabels are the names of the stages; stageLabel in lib/stages.ts.
var stageLabels = map[task.Stage]string{
	task.StagePRD:            "PRD",
	task.StageTechSpec:       "Tech spec",
	task.StagePlan:           "Plan",
	task.StageOneShot:        "Planning",
	task.StageImplementation: "Implementation",
	task.StagePR:             "PR",
}

// modeLabels are the names of the task modes; taskModeLabel in
// lib/task-modes.ts.
var modeLabels = map[task.Mode]string{
	task.ModeStructured: "Structured",
	task.ModeOneShot:    "One-Shot",
}

// reviewModeLabels are the names of the review modes; reviewModeLabel in
// lib/review-modes.ts.
var reviewModeLabels = map[reviewmode.Mode]string{
	reviewmode.Manual: "Manual",
	reviewmode.Agent:  "Agent",
}

// stepStatusLabels are where a step stands; stepStatusLabel in
// features/task/step-status.ts.
var stepStatusLabels = map[flow.StepStatus]string{
	flow.StepNotStarted:       "Not started",
	flow.StepPreparing:        "Preparing",
	flow.StepBlocked:          "Blocked",
	flow.StepImplementing:     "Implementing",
	flow.StepAgentReview:      "Agent review",
	flow.StepAddressingReview: "Addressing review",
	flow.StepAwaitingReview:   "Awaiting review",
	flow.StepInReview:         "In review",
	flow.StepReadyToApprove:   "Ready to approve",
	flow.StepNothingToCommit:  "Nothing to approve",
	flow.StepReviewFailed:     "Can't read the worktree",
	flow.StepCommitting:       "Committing",
	flow.StepDiverged:         "Not as expected",
	flow.StepDone:             "Done",
}

// prStatusLabels are where a pull request stands, but for the trouble, which
// reads from what went wrong; prStatusLabel in features/task/pr-status.ts.
var prStatusLabels = map[flow.PRStatus]string{
	flow.PRPreparing:        "Checking GitHub",
	flow.PRBlocked:          "Blocked",
	flow.PRDrafting:         "Preparing the draft",
	flow.PRDraftReady:       "Draft waiting for your OK",
	flow.PRAwaitingReply:    "Waiting for your reply",
	flow.PROpening:          "Opening the pull request",
	flow.PRReviewing:        "Reviewing the pull request",
	flow.PRAddressingReview: "Addressing the review",
	flow.PRWaitingChecks:    "Waiting for checks",
	flow.PRAwaitingDecision: "Waiting for your decision",
	flow.PRInReview:         "In review",
	flow.PRReadyToApprove:   "Ready to approve",
	flow.PRCommitting:       "Committing",
	flow.PRPushing:          "Pushing the commit",
	flow.PRDiverged:         "Not as expected",
	flow.PRDone:             "Waiting for the merge",
	flow.PRMerged:           "Merged · ready to close",
	flow.PRClosedUnmerged:   "Closed without merge",
	flow.PRClosing:          "Closing",
	flow.PRClosed:           "Closed",
}

// reviewStatusLabels are where a review stands, in the words of the bars of
// the review; the interface has no function that gives them one by one, so
// only the Go tests keep them.
var reviewStatusLabels = map[reviewflow.Status]string{
	reviewflow.StatusReviewing:        "Reviewing",
	reviewflow.StatusAwaitingReply:    "Waiting for your reply",
	reviewflow.StatusAwaitingDecision: "Decide findings",
	reviewflow.StatusReadyToPublish:   "Ready to publish",
	reviewflow.StatusPublishFailed:    "Publish failed",
	reviewflow.StatusPublished:        "Published",
	reviewflow.StatusNewCommits:       "New commits",
	reviewflow.StatusReadyToApply:     "Ready to apply",
	reviewflow.StatusApplying:         "Applying the findings",
	reviewflow.StatusInReview:         "Review changes",
	reviewflow.StatusReadyToApprove:   "Approve changes",
	reviewflow.StatusCommitting:       "Committing",
	reviewflow.StatusReadyToMerge:     "Ready to merge",
	reviewflow.StatusWaitingChecks:    "Waiting for checks",
	reviewflow.StatusPassBlocked:      "Pass blocked",
	reviewflow.StatusPushing:          "Pushing the commit",
	reviewflow.StatusDiverged:         "Not as expected",
}

// discussionStatusLabels are where a discussion stands, in the words of its
// sidebar; like the review ones, only the Go tests keep them.
var discussionStatusLabels = map[discussionflow.Status]string{
	discussionflow.StatusNone:            "Discussing",
	discussionflow.StatusDiscussing:      "Discussing",
	discussionflow.StatusDiverged:        "Not as expected",
	discussionflow.StatusDeciding:        "Decide drafts",
	discussionflow.StatusPublishing:      "Publishing",
	discussionflow.StatusPublishFailed:   "Publish failed",
	discussionflow.StatusEpicDiscarded:   "Epic discarded",
	discussionflow.StatusEpicCantPublish: "Epic can't publish",
	discussionflow.StatusReadyToArchive:  "Ready to archive",
}

// voices are the words of who talks in a conversation with a single session
// key; VOICES in features/chat/markers.ts.
var voices = map[string]string{
	string(task.StagePRD):      "PRD agent",
	string(task.StageTechSpec): "Tech spec agent",
	string(task.StagePlan):     "Plan agent",
	string(task.StageOneShot):  "Planning agent",
	string(task.StagePR):       "PR agent",
	session.PRReviewStage:      "Reviewer",
	session.PRFixStage:         "Implementer",
	session.ReviewStage:        "Reviewer",
	session.DiscussionStage:    "Discussion agent",
}

// troubleText is what went wrong with a pull request after its review: the
// checks that failed, by name, and the conflict with its base; troubleText in
// lib/pull-requests.ts.
func troubleText(t gh.Trouble, base string) string {
	var parts []string
	if len(t.FailedChecks) > 0 {
		parts = append(parts, "Checks failed: "+strings.Join(t.FailedChecks, ", "))
	}
	if t.Conflict {
		name := base
		if name == "" {
			name = "the base"
		}
		word := "Conflict"
		if len(parts) > 0 {
			word = "conflict"
		}
		parts = append(parts, word+" with "+name)
	}
	return strings.Join(parts, " · ")
}

// prBase is the branch the pull request merges into, without origin/.
func prBase(pr flow.PullRequest) string {
	if pr.PR.Base != "" {
		return pr.PR.Base
	}
	return strings.TrimPrefix(pr.BaseBranch, "origin/")
}

// prStatusLabel is where the pull request of a task stands; a status the table
// lacks reads as its own value.
func prStatusLabel(pr flow.PullRequest) string {
	if pr.Status == flow.PRTrouble {
		return troubleText(pr.Trouble, prBase(pr))
	}
	return labelOf(prStatusLabels, pr.Status)
}

// labelOf is the label of a key, or the key itself when the table lacks it.
func labelOf[K ~string](labels map[K]string, key K) string {
	if label, ok := labels[key]; ok {
		return label
	}
	return string(key)
}

// voiceOf is the word of who talks in a conversation, by its stage key; ""
// for a stage it does not know; voiceOf in features/chat/markers.ts.
func voiceOf(stage string) string {
	if _, ok := session.ParseStepReviewStage(stage); ok {
		return "Reviewer"
	}
	if _, ok := session.ParseStepStage(stage); ok {
		return "Implementer"
	}
	return voices[stage]
}

// conversationName is how the state names a conversation: its voice, and the
// step or the pull request it is about.
func conversationName(stage string) string {
	if n, ok := stepNumber(stage); ok {
		return fmt.Sprintf("%s of step %d", voiceOf(stage), n)
	}
	switch stage {
	case session.PRReviewStage:
		return "Reviewer of the pull request"
	case session.PRFixStage:
		return "Implementer of the pull request"
	}
	if voice := voiceOf(stage); voice != "" {
		return voice
	}
	return stage
}

// stepNumber is the step a step or step review stage belongs to.
func stepNumber(stage string) (int, bool) {
	if n, ok := session.ParseStepStage(stage); ok {
		return n, true
	}
	return session.ParseStepReviewStage(stage)
}
