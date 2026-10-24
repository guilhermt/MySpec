package selfcontext_test

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/divergence"
	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/reviewmode"
	"github.com/guilhermt/myspec/internal/selfcontext"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/worktree"
)

func sessionsOf(pairs ...func() (session.Key, session.Summary)) map[session.Key]session.Summary {
	sessions := map[session.Key]session.Summary{}
	for _, p := range pairs {
		k, sum := p()
		sessions[k] = sum
	}
	return sessions
}

func sessionOf(taskID, stage string, status session.Status) func() (session.Key, session.Summary) {
	return func() (session.Key, session.Summary) { return open(taskID, stage, status) }
}

func TestTheStateOfATaskInImplementationTellsTheStepsAndTheDivergence(t *testing.T) {
	t.Parallel()

	steps := []flow.StepState{
		{Step: task.Step{Number: 1, Title: "Models"}, Status: flow.StepDone, CommitSHA: "abc1234def", CommitSubject: "Add the models"},
		{Step: task.Step{Number: 2, Title: "Service"}, Status: flow.StepDone, CommitSHA: "bcd2345efa", CommitSubject: "Add the service"},
		{Step: task.Step{Number: 3, Title: "Wiring"}, Status: flow.StepImplementing, ReviewMode: reviewmode.Agent},
		{Step: task.Step{Number: 4, Title: "Docs"}, Status: flow.StepNotStarted, ReviewMode: reviewmode.Manual},
	}
	got := selfcontext.Task(selfcontext.TaskInput{
		Task:       task.Task{ID: "t1", Name: "login", Mode: task.ModeStructured, Stage: task.StageImplementation, ArtifactsDir: "/tasks/t1"},
		Repository: "acme/app",
		Stage:      "step_review:2",
		Artifacts: task.Artifacts{
			PRD: true, TechSpec: true,
			Plan: task.Plan{Present: true, Steps: []task.Step{{Number: 1}, {Number: 2}, {Number: 3}, {Number: 4}}},
		},
		Steps:    steps,
		Worktree: &worktree.Worktree{Path: "/wt/login", Branch: "feature/login", Base: "origin/main"},
		Sessions: sessionsOf(
			sessionOf("t1", "step:3", session.StatusWorking),
			sessionOf("t1", "step_review:2", session.StatusWaiting),
			sessionOf("other", "step:1", session.StatusWorking),
		),
		Divergence: &divergence.Divergence{
			ItemID: "t1", Stage: "step:3", Kind: divergence.KindCommitMissing, StartedAt: openedAt,
			Facts: divergence.Facts{Branch: "feature/login", Commit: "abc1234", Files: 4},
		},
		Now: readAt,
	})

	want := stateOf(
		headerOf("task"),
		"Task: login · Structured",
		"Repository: acme/app",
		"This conversation: Reviewer of step 2 (step_review:2) · its step is done",
		"Stage: Implementation · step 3 of 4",
		"Documents: PRD /tasks/t1/PRD.md; Tech spec /tasks/t1/tech-spec.md; Plan /tasks/t1/steps (4 steps)",
		"Steps:",
		"- 1 · Models · Done · abc1234 Add the models",
		"- 2 · Service · Done · bcd2345 Add the service",
		"- 3 · Wiring · Implementing · current · review Agent",
		"- 4 · Docs · Not started",
		"Worktree: /wt/login · branch feature/login · base origin/main",
		"Conversations: Reviewer of step 2 · idle · this conversation; Implementer of step 3 · working",
		"Divergence: commit_missing, shown as Not as expected, open since "+local(openedAt)+", in the conversation Implementer of step 3 (step:3)",
		"- Expected: a commit on feature/login after abc1234",
		"- Found: no commit, and 4 files changed in the worktree",
		"- Actions in the interface:",
		"  - Ask the agent again: sends the commit request to Implementer of step 3 again",
		"  - Check again: reads git, the files and GitHub again, and the flow goes on if things are now as expected",
	)
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("state mismatch (-want +got):\n%s", diff)
	}
}

func TestTheStateOfAOneShotTaskInThePullRequestStageTellsTheReview(t *testing.T) {
	t.Parallel()

	merged := time.Date(2026, time.October, 23, 15, 0, 0, 0, time.UTC)
	pr := flow.PullRequest{
		Status: flow.PRAddressingReview, Branch: "feature/x", BaseBranch: "origin/main",
		Draft: &task.Draft{Present: true, Title: "Add x"},
		PR: task.PRDetails{
			Number: 12, URL: "https://github.com/acme/app/pull/12", State: task.PRStateMerged,
			Checks: []gh.Check{
				{Name: "build", State: gh.CheckPassed},
				{Name: "test", State: gh.CheckSkipped},
				{Name: "lint", State: gh.CheckFailed},
			},
			Mergeable: gh.MergeableConflicting, MergedBy: "ana", MergedAt: merged,
		},
		Mode: reviewmode.Agent, Round: 2, Pass: &task.PRPass{Pass: 3},
	}
	got := selfcontext.Task(selfcontext.TaskInput{
		Task:      task.Task{ID: "t2", Name: "feature-x", Mode: task.ModeOneShot, Stage: task.StagePR, ArtifactsDir: "/tasks/t2"},
		Stage:     "pr_fix",
		Artifacts: task.Artifacts{OneShot: true, PR: task.PRArtifacts{Draft: task.Draft{Present: true}}},
		Worktree:  &worktree.Worktree{Path: "/wt/x", Base: "origin/main"},
		PR:        &pr,
		Sessions: sessionsOf(
			sessionOf("t2", "pr", session.StatusWaiting),
			sessionOf("t2", "pr_fix", session.StatusWorking),
		),
		Now: readAt,
	})

	want := stateOf(
		headerOf("task"),
		"Task: feature-x · One-Shot",
		"This conversation: Implementer of the pull request (pr_fix) · the task is in the PR stage",
		"Stage: PR · Addressing the review",
		"Documents: One-Shot document /tasks/t2/one-shot.md; Draft of the pull request /tasks/t2/pr/draft.md",
		"Worktree: /wt/x · detached HEAD · base origin/main",
		"Pull request: #12 https://github.com/acme/app/pull/12 · Addressing the review · feature/x into main · checks 2 of 3 passed, failed: lint"+
			" · conflict with main · review Agent · round 2 of 5 · pass 3 · merged by ana at "+local(merged),
		"Conversations: PR agent · idle; Implementer of the pull request · working · this conversation",
		"Divergence: none",
	)
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("state mismatch (-want +got):\n%s", diff)
	}
}

func TestTheStateOfATaskInThePRDStageHasNoDocumentsAndNoConversations(t *testing.T) {
	t.Parallel()

	got := selfcontext.Task(selfcontext.TaskInput{
		Task:  task.Task{ID: "t3", Name: "new-thing", Mode: task.ModeStructured, Stage: task.StagePRD, ArtifactsDir: "/tasks/t3"},
		Stage: "prd",
		Now:   readAt,
	})

	want := stateOf(
		headerOf("task"),
		"Task: new-thing · Structured",
		"This conversation: PRD agent (prd) · the task is in this stage",
		"Stage: PRD",
		"Documents: none yet",
		"Conversations: none open",
		"Divergence: none",
	)
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("state mismatch (-want +got):\n%s", diff)
	}
}

func TestTheRelationOfAConversationToTheTaskFollowsItsStage(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		task  task.Task
		stage string
		want  string
	}{
		{"planning stage done", task.Task{Mode: task.ModeStructured, Stage: task.StagePlan}, "prd", "its stage is done"},
		{"planning stage to come", task.Task{Mode: task.ModeStructured, Stage: task.StagePRD}, "plan", "its stage has not come yet"},
		{"step before implementation", task.Task{Mode: task.ModeStructured, Stage: task.StagePlan}, "step:1", "its step has not started"},
		{"step after implementation", task.Task{Mode: task.ModeStructured, Stage: task.StagePR}, "step:1", "its step is done"},
		{"pull request before its stage", task.Task{Mode: task.ModeStructured, Stage: task.StageImplementation}, "pr", "the PR stage has not come yet"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			tt.task.ID = "t"
			got := selfcontext.Task(selfcontext.TaskInput{Task: tt.task, Stage: tt.stage, Now: readAt})
			if !containsLine(got, " · "+tt.want) {
				t.Errorf("state = %q, want the relation %q", got, tt.want)
			}
		})
	}
}
