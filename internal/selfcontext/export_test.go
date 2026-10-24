package selfcontext

import (
	"maps"
	"slices"

	"github.com/guilhermt/myspec/internal/discussionflow"
	"github.com/guilhermt/myspec/internal/divergence"
	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/reviewflow"
	"github.com/guilhermt/myspec/internal/reviewmode"
	"github.com/guilhermt/myspec/internal/task"
)

// The unexported labels and divergence texts, for the external tests of the
// package.
var (
	DivergenceText   = divergenceText
	TroubleText      = troubleText
	VoiceOf          = voiceOf
	ConversationName = conversationName
)

// StageLabel is the label of a stage.
func StageLabel(stage string) string { return labelOf(stageLabels, task.Stage(stage)) }

// ModeLabel is the label of a task mode.
func ModeLabel(mode string) string { return labelOf(modeLabels, task.Mode(mode)) }

// ReviewModeLabel is the label of a review mode.
func ReviewModeLabel(mode string) string { return labelOf(reviewModeLabels, reviewmode.Mode(mode)) }

// StepStatusLabel is the label of a step status.
func StepStatusLabel(status string) string { return labelOf(stepStatusLabels, flow.StepStatus(status)) }

// PRStatusLabel is the label of the status of a pull request.
func PRStatusLabel(status string, trouble gh.Trouble, base string) string {
	return prStatusLabel(flow.PullRequest{Status: flow.PRStatus(status), Trouble: trouble, BaseBranch: base})
}

// ReviewStatusLabel is the label of the status of a review.
func ReviewStatusLabel(status string) string {
	return labelOf(reviewStatusLabels, reviewflow.Status(status))
}

// DiscussionStatusLabel is the label of the status of a discussion.
func DiscussionStatusLabel(status string) string {
	return labelOf(discussionStatusLabels, discussionflow.Status(status))
}

// StepStatuses are the statuses the step table labels.
func StepStatuses() []string {
	return slices.Sorted(func(yield func(string) bool) {
		for k := range maps.Keys(stepStatusLabels) {
			if !yield(string(k)) {
				return
			}
		}
	})
}

// PRStatuses are the statuses the pull request table labels.
func PRStatuses() []string {
	return slices.Sorted(func(yield func(string) bool) {
		for k := range maps.Keys(prStatusLabels) {
			if !yield(string(k)) {
				return
			}
		}
	})
}

// DivergenceActions are the labels and the effects of the ways out of a
// divergence, in the order of the buttons.
func DivergenceActions(d divergence.Divergence) (labels, does []string) {
	for _, a := range divergenceActions(d) {
		labels = append(labels, a.label)
		does = append(does, a.does)
	}
	return labels, does
}
