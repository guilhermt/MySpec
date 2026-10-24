// Package selfcontext is what a session knows of MySpec: the identity every
// process of a session starts with, and the state of its item that goes ahead
// of every message that opens a turn, in the names the interface shows. It only
// renders: the flows derive the states, and the session decides when each text
// goes.
package selfcontext

import (
	"embed"
	"strconv"
	"strings"

	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

//go:embed texts/*.md
var texts embed.FS

// Identity is what a session appends to the system prompt of the CLI: who
// MySpec is, the flow of its kind of item, its role with the contract and why,
// and how to read the state of the item.
func Identity(t session.TaskInfo) string {
	return strings.TrimSpace(strings.NewReplacer(
		"{{item}}", itemOf(t.Stage),
		"{{flow}}", text(flowFile(t)),
		"{{role}}", role(t),
	).Replace(text("identity.md")))
}

// itemOf is the kind of item a session belongs to.
func itemOf(stage string) string {
	switch stage {
	case session.ReviewStage:
		return "review"
	case session.DiscussionStage:
		return "discussion"
	default:
		return "task"
	}
}

// flowFile is the text that tells the flow of the kind of item of a session.
func flowFile(t session.TaskInfo) string {
	switch {
	case t.Stage == session.ReviewStage:
		return "flow_review.md"
	case t.Stage == session.DiscussionStage:
		return "flow_discussion.md"
	case t.OneShotPath != "" || t.Stage == string(task.StageOneShot):
		return "flow_one_shot.md"
	default:
		return "flow_structured.md"
	}
}

// role is the text of the role of a session, with its step number; "" for a
// stage that has none.
func role(t session.TaskInfo) string {
	file, step := roleFile(t)
	if file == "" {
		return ""
	}
	return strings.ReplaceAll(text(file), "{{step}}", strconv.Itoa(step))
}

// roleFile is the file of the role of a session and, for a step or a step
// review, the number of the step.
func roleFile(t session.TaskInfo) (file string, step int) {
	if n, ok := session.ParseStepStage(t.Stage); ok {
		return "role_step.md", n
	}
	if n, ok := session.ParseStepReviewStage(t.Stage); ok {
		return "role_step_review.md", n
	}
	switch t.Stage {
	case string(task.StagePRD):
		return "role_prd.md", 0
	case string(task.StageTechSpec):
		return "role_tech_spec.md", 0
	case string(task.StagePlan):
		return "role_plan.md", 0
	case string(task.StageOneShot):
		return "role_one_shot.md", 0
	case string(task.StagePR):
		return "role_pr.md", 0
	case session.PRReviewStage:
		return "role_pr_review.md", 0
	case session.PRFixStage:
		return "role_pr_fix.md", 0
	case session.ReviewStage:
		if t.Publish {
			return "role_review_publish.md", 0
		}
		return "role_review_apply.md", 0
	case session.DiscussionStage:
		return "role_discussion.md", 0
	}
	return "", 0
}

// text reads one of the embedded texts; they are all there at build time.
func text(name string) string {
	b, err := texts.ReadFile("texts/" + name)
	if err != nil {
		panic("selfcontext: " + err.Error())
	}
	return string(b)
}
