package selfcontext_test

import (
	"strings"
	"testing"

	"github.com/guilhermt/myspec/internal/selfcontext"
	"github.com/guilhermt/myspec/internal/session"
)

func TestIdentityTellsTheFlowAndTheRoleOfEachSession(t *testing.T) {
	t.Parallel()

	const (
		taskFlow       = "## The flow of a task"
		reviewFlow     = "## The flow of a review"
		discussionFlow = "## The flow of a discussion"
	)
	tests := []struct {
		name     string
		info     session.TaskInfo
		flow     string
		role     string
		oneShot  bool
		notInRaw string
	}{
		{name: "prd", info: session.TaskInfo{Stage: "prd"}, flow: taskFlow, role: "You are the PRD agent of this task"},
		{name: "tech spec", info: session.TaskInfo{Stage: "tech_spec"}, flow: taskFlow, role: "You are the Tech spec agent of this task"},
		{name: "plan", info: session.TaskInfo{Stage: "plan"}, flow: taskFlow, role: "You are the Plan agent of this task"},
		{name: "one-shot planning", info: session.TaskInfo{Stage: "one_shot", OneShotPath: "/t/one-shot.md"}, flow: taskFlow, role: "You are the Planning agent of this task", oneShot: true},
		{name: "step of a structured task", info: session.TaskInfo{Stage: "step:3"}, flow: taskFlow, role: "You are the Implementer of step 3"},
		{name: "step review of a structured task", info: session.TaskInfo{Stage: "step_review:3"}, flow: taskFlow, role: "You are the Reviewer of step 3"},
		{name: "step of a one-shot task", info: session.TaskInfo{Stage: "step:3", OneShotPath: "/t/one-shot.md"}, flow: taskFlow, role: "You are the Implementer of step 3", oneShot: true},
		{name: "step review of a one-shot task", info: session.TaskInfo{Stage: "step_review:3", OneShotPath: "/t/one-shot.md"}, flow: taskFlow, role: "You are the Reviewer of step 3", oneShot: true},
		{name: "pr", info: session.TaskInfo{Stage: "pr"}, flow: taskFlow, role: "You are the PR agent of this task"},
		{name: "pr review", info: session.TaskInfo{Stage: "pr_review"}, flow: taskFlow, role: "You are the Reviewer of the pull request of this task"},
		{name: "pr fix", info: session.TaskInfo{Stage: "pr_fix"}, flow: taskFlow, role: "You are the Implementer of the pull request of this task"},
		{name: "review in publish mode", info: session.TaskInfo{Stage: "review", Publish: true}, flow: reviewFlow, role: "You are the Reviewer of this pull request, in publish mode"},
		{name: "review in apply mode", info: session.TaskInfo{Stage: "review"}, flow: reviewFlow, role: "You are the Reviewer of this pull request, in apply mode"},
		{name: "discussion", info: session.TaskInfo{Stage: "discussion"}, flow: discussionFlow, role: "You are the Discussion agent of this discussion"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := selfcontext.Identity(tt.info)

			for _, want := range []string{"# You are MySpec", tt.flow, "## Your role", tt.role, "## The state of the app", "## Divergences"} {
				if !strings.Contains(got, want) {
					t.Errorf("identity lacks %q", want)
				}
			}
			if !strings.HasPrefix(got, "# You are MySpec") {
				t.Errorf("identity starts with %q", got[:20])
			}
			if strings.Contains(got, "{{") {
				t.Errorf("identity has a placeholder left")
			}
			if strings.Contains(got, "One-Shot task") != tt.oneShot {
				t.Errorf("identity says One-Shot = %v, want %v", !tt.oneShot, tt.oneShot)
			}
		})
	}
}

func TestIdentityNamesTheItemOfTheSession(t *testing.T) {
	t.Parallel()

	tests := map[string]string{
		"step:1":     "the state of this task",
		"review":     "the state of this review",
		"discussion": "the state of this discussion",
	}
	for stage, want := range tests {
		got := selfcontext.Identity(session.TaskInfo{Stage: stage})
		if !strings.Contains(got, want) {
			t.Errorf("identity of %s lacks %q", stage, want)
		}
	}
}

func TestIdentityOfAnUnknownStageHasOnlyTheCommonParts(t *testing.T) {
	t.Parallel()

	got := selfcontext.Identity(session.TaskInfo{Stage: "unknown"})

	if strings.Contains(got, "## Your role") || strings.Contains(got, "{{") {
		t.Errorf("identity has a role or a placeholder left:\n%s", got)
	}
	if !strings.Contains(got, "## The state of the app") {
		t.Error("identity lacks the common parts")
	}
}
