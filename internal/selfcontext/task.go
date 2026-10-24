package selfcontext

import (
	"fmt"
	"strings"
	"time"

	"github.com/guilhermt/myspec/internal/divergence"
	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/reviewmode"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/worktree"
)

// TaskInput is what the state of a task is rendered from, as the flow and the
// sessions have it now.
type TaskInput struct {
	Task       task.Task
	Repository string // owner/name; "" when the repository is no longer registered
	Stage      string // the session the state goes to, as session.Key.Stage
	Artifacts  task.Artifacts
	Steps      []flow.StepState
	Worktree   *worktree.Worktree // nil before the worktree exists
	PR         *flow.PullRequest  // nil before the PR stage
	Sessions   map[session.Key]session.Summary
	Divergence *divergence.Divergence // nil for none
	Now        time.Time
}

// Task is the state of a task for one of its sessions.
func Task(in TaskInput) string {
	current := currentStep(in.Steps)
	lines := []string{
		header("task", in.Now),
		fmt.Sprintf("Task: %s · %s", in.Task.Name, labelOf(modeLabels, in.Task.Mode)),
	}
	if in.Repository != "" {
		lines = append(lines, "Repository: "+in.Repository)
	}
	lines = append(lines,
		fmt.Sprintf("This conversation: %s (%s) · %s", conversationName(in.Stage), in.Stage, relation(in, current)),
		stageLine(in, current),
		documentsLine(in),
	)
	lines = append(lines, stepLines(in.Steps, current)...)
	lines = append(lines, worktreeLine(in.Worktree))
	if in.PR != nil {
		lines = append(lines, prLine(*in.PR))
	}
	lines = append(lines, conversationsLine(in.Task.ID, in.Stage, in.Sessions))
	return block(append(lines, divergenceLines(in.Divergence)...))
}

// currentStep is the step the task is on: the first that is not done; nil
// when every step is done or there are none.
func currentStep(steps []flow.StepState) *flow.StepState {
	for i := range steps {
		if steps[i].Status != flow.StepDone {
			return &steps[i]
		}
	}
	return nil
}

// relation says how the stage of the conversation stands to the task.
func relation(in TaskInput, current *flow.StepState) string {
	t := in.Task
	if n, ok := stepNumber(in.Stage); ok {
		return stepRelation(t, n, in.Steps, current)
	}
	switch in.Stage {
	case session.PRStage, session.PRReviewStage, session.PRFixStage:
		if t.Stage == task.StagePR {
			return "the task is in the PR stage"
		}
		return "the PR stage has not come yet"
	}
	at, mine := t.Mode.Index(t.Stage), t.Mode.Index(task.Stage(in.Stage))
	switch {
	case mine < at:
		return "its stage is done"
	case mine == at:
		return "the task is in this stage"
	}
	return "its stage has not come yet"
}

// stepRelation says how the step n of a conversation stands to the task.
func stepRelation(t task.Task, n int, steps []flow.StepState, current *flow.StepState) string {
	switch {
	case t.Stage == task.StagePR:
		return "its step is done"
	case t.Stage != task.StageImplementation:
		return "its step has not started"
	}
	for _, st := range steps {
		if st.Step.Number == n && st.Status == flow.StepDone {
			return "its step is done"
		}
	}
	if current != nil && current.Step.Number == n {
		return "its step is the current one"
	}
	return "its step has not started"
}

// stageLine is the stage of the task, with the step or the pull request it is
// on.
func stageLine(in TaskInput, current *flow.StepState) string {
	line := "Stage: " + labelOf(stageLabels, in.Task.Stage)
	switch {
	case in.Task.Stage == task.StageImplementation && current != nil:
		line += fmt.Sprintf(" · step %d of %d", current.Step.Number, len(in.Steps))
	case in.Task.Stage == task.StagePR && in.PR != nil:
		line += " · " + prStatusLabel(*in.PR)
	}
	return line
}

// documentsLine lists the documents of the task that exist, with their paths.
func documentsLine(in TaskInput) string {
	t, a := in.Task, in.Artifacts
	var parts []string
	if a.PRD {
		parts = append(parts, "PRD "+t.PRDPath())
	}
	if a.TechSpec {
		parts = append(parts, "Tech spec "+t.TechSpecPath())
	}
	if a.OneShot {
		parts = append(parts, "One-Shot document "+t.OneShotPath())
	}
	if a.Plan.Present && t.Mode == task.ModeStructured {
		counts := fmt.Sprintf("%d steps", len(a.Plan.Steps))
		if len(a.Plan.Problems) > 0 {
			counts += fmt.Sprintf(", %d problems", len(a.Plan.Problems))
		}
		parts = append(parts, fmt.Sprintf("Plan %s (%s)", t.StepsDir(), counts))
	}
	if a.PR.Draft.Present {
		parts = append(parts, "Draft of the pull request "+t.DraftPath())
	}
	if len(parts) == 0 {
		return "Documents: none yet"
	}
	return "Documents: " + strings.Join(parts, "; ")
}

// stepLines list the steps, one per line, under a title; none without steps.
func stepLines(steps []flow.StepState, current *flow.StepState) []string {
	if len(steps) == 0 {
		return nil
	}
	lines := []string{"Steps:"}
	for i := range steps {
		lines = append(lines, stepLine(steps[i], &steps[i] == current))
	}
	return lines
}

// stepLine is one step: where it stands and what is worth knowing of it.
func stepLine(st flow.StepState, isCurrent bool) string {
	line := fmt.Sprintf("- %d · %s · %s", st.Step.Number, st.Step.Title, labelOf(stepStatusLabels, st.Status))
	if isCurrent {
		line += " · current · review " + labelOf(reviewModeLabels, st.ReviewMode)
	}
	switch st.Status {
	case flow.StepAgentReview:
		line += fmt.Sprintf(" · pass %d", st.ReviewPass)
	case flow.StepAddressingReview:
		line += fmt.Sprintf(" · round %d", st.ReviewRound)
	case flow.StepBlocked:
		if st.Block != nil {
			line += " · " + strings.ReplaceAll(string(st.Block.Reason), "_", " ")
		}
	case flow.StepDone:
		line += " · " + shortSHA(st.CommitSHA) + " " + st.CommitSubject
	default: // the other statuses say all in their label
	}
	return line
}

// shortSHA is the first seven characters of a commit.
func shortSHA(sha string) string {
	if len(sha) > 7 {
		return sha[:7]
	}
	return sha
}

// worktreeLine is where the task works; "" before the worktree exists.
func worktreeLine(wt *worktree.Worktree) string {
	if wt == nil {
		return ""
	}
	branch := "detached HEAD"
	if wt.Branch != "" {
		branch = "branch " + wt.Branch
	}
	return fmt.Sprintf("Worktree: %s · %s · base %s", wt.Path, branch, wt.Base)
}

// prLine is the pull request of the task, opened or not.
func prLine(pr flow.PullRequest) string {
	status := prStatusLabel(pr)
	if pr.PR.Number == 0 {
		line := "Pull request: not opened yet · " + status
		if pr.Draft != nil {
			line += fmt.Sprintf(" · draft %q", pr.Draft.Title)
		}
		return line
	}
	head, base := pr.PR.Head, prBase(pr)
	if head == "" {
		head = pr.Branch
	}
	line := fmt.Sprintf("Pull request: #%d %s · %s · %s into %s · checks %s",
		pr.PR.Number, pr.PR.URL, status, head, base, checksText(pr.PR.Checks, pr.PR.Checks != nil))
	if merge := mergeText(pr.PR.Mergeable, base); merge != "" {
		line += " · " + merge
	}
	line += " · review " + labelOf(reviewModeLabels, pr.Mode)
	if pr.Mode == reviewmode.Agent {
		line += fmt.Sprintf(" · round %d of %d", pr.Round, flow.MaxPRReviewRounds)
	}
	if pr.Pass != nil {
		line += fmt.Sprintf(" · pass %d", pr.Pass.Pass)
	}
	switch pr.PR.State {
	case task.PRStateMerged:
		line += fmt.Sprintf(" · merged by %s at %s", pr.PR.MergedBy, clock(pr.PR.MergedAt))
	case task.PRStateClosed:
		line += " · closed without merge"
	default: // still open
	}
	return line
}
