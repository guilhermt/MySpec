package attention_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/attention"
	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

func TestDeriveAPlanningStage(t *testing.T) {
	t.Parallel()

	waiting := summary(session.StatusWaiting, true)
	failedTurn := waiting
	failedTurn.TurnFailed = true
	corrected, uncorrected := waiting, waiting
	corrected.Corrections, uncorrected.Corrections = 2, flow.MaxCorrections

	written := task.Artifacts{PRD: true, TechSpec: true}
	invalidPlan := task.Artifacts{PRD: true, TechSpec: true, Plan: task.Plan{
		Present:  true,
		Problems: []task.PlanProblem{{File: "1-session-api.md", Message: "the file is empty"}},
	}}
	revisited := stageInput(task.StageTechSpec, written, waiting)
	revisited.Task.Revisiting = true

	// situation is the one situation of the task, in the stage given.
	situation := func(stage task.Stage, kind attention.Kind, body string) []attention.Found {
		return []attention.Found{{
			TaskID: taskID, Place: attention.Place{Kind: attention.PlaceStage, Stage: stage},
			Kind: kind, Title: taskName, Body: body,
		}}
	}

	tests := []struct {
		name string
		in   attention.Input
		want []attention.Found
	}{
		{"no session", stageInput(task.StagePRD, task.Artifacts{}), nil},
		{"the agent is working", stageInput(task.StagePRD, task.Artifacts{}, summary(session.StatusWorking, false)), nil},
		{"a message waits in the queue", stageInput(task.StagePRD, task.Artifacts{}, summary(session.StatusWaiting, false)), nil},
		{"the session is paused", stageInput(task.StagePRD, task.Artifacts{}, summary(session.StatusPaused, false)), nil},
		{
			"the agent waits in the PRD",
			stageInput(task.StagePRD, task.Artifacts{}, waiting),
			situation(task.StagePRD, attention.KindReply, "The agent is waiting for your reply in PRD."),
		},
		{
			"the agent waits in the tech spec",
			stageInput(task.StageTechSpec, task.Artifacts{PRD: true}, waiting),
			situation(task.StageTechSpec, attention.KindReply, "The agent is waiting for your reply in tech spec."),
		},
		{"the document is written", stageInput(task.StageTechSpec, written, waiting), nil},
		{
			"a reopened stage has its document",
			revisited,
			situation(task.StageTechSpec, attention.KindReadyToContinue, "The tech spec is revised and ready to continue."),
		},
		{"the plan is invalid with corrections left", stageInput(task.StagePlan, invalidPlan, corrected), nil},
		{
			"the plan is invalid after every correction",
			stageInput(task.StagePlan, invalidPlan, uncorrected),
			situation(task.StagePlan, attention.KindPlanInvalid, "The plan is still invalid after automatic corrections."),
		},
		{
			"the session stopped with an error",
			stageInput(task.StagePlan, written, summary(session.StatusError, false)),
			situation(task.StagePlan, attention.KindSessionError, "The session stopped with an error in plan."),
		},
		{
			"the last turn failed",
			stageInput(task.StagePlan, written, failedTurn),
			situation(task.StagePlan, attention.KindSessionError, "The session stopped with an error in plan."),
		},
		{
			"a permission waits",
			stageInput(task.StagePRD, task.Artifacts{}, summary(session.StatusNeedsPermission, false)),
			situation(task.StagePRD, attention.KindPermission, "Permission requested in PRD."),
		},
		{
			"a question waits",
			stageInput(task.StagePRD, task.Artifacts{}, summary(session.StatusNeedsAnswer, false)),
			situation(task.StagePRD, attention.KindQuestion, "The agent has a question in PRD."),
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if diff := cmp.Diff(test.want, attention.Derive(test.in)); diff != "" {
				t.Errorf("Derive() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestDeriveTheCurrentStep(t *testing.T) {
	t.Parallel()

	working := summary(session.StatusWorking, false)
	waiting := summary(session.StatusWaiting, true)

	// A step still to come after the one under review: the current step is the
	// first one that is not done, not the last.
	followed := stepInput(flow.StepState{Status: flow.StepAwaitingReview, Review: &review.Snapshot{Total: 3}}, waiting)
	followed.Steps = append(followed.Steps, flow.StepState{
		Step:   task.Step{Number: 3, File: "3-logout.md", Title: "Logout", Repository: "api", RepoPath: apiPath},
		Status: flow.StepNotStarted,
	})

	// situation is the one situation of the task, in step 2.
	situation := func(kind attention.Kind, form attention.Form, percent int, body string) []attention.Found {
		return []attention.Found{{
			TaskID: taskID, Place: attention.Place{Kind: attention.PlaceStep, Step: 2},
			Kind: kind, Form: form, Percent: percent, Title: taskName, Body: body,
		}}
	}

	tests := []struct {
		name string
		in   attention.Input
		want []attention.Found
	}{
		{
			"blocked by a dirty worktree",
			stepInput(flow.StepState{Status: flow.StepBlocked, Block: &task.StepBlock{Reason: task.BlockDirty, Files: 2}}),
			situation(attention.KindStepBlocked, attention.FormNone, 0, "Step 2 can't start: the worktree has uncommitted changes."),
		},
		{"the agent is implementing", stepInput(flow.StepState{Status: flow.StepImplementing}, working), nil},
		{
			"awaiting review",
			stepInput(flow.StepState{Status: flow.StepAwaitingReview, Review: &review.Snapshot{Total: 3}}, waiting),
			situation(attention.KindStepReview, attention.FormReview, 0, "Step 2 is ready for review."),
		},
		{
			"a step not started after the one awaiting review",
			followed,
			situation(attention.KindStepReview, attention.FormReview, 0, "Step 2 is ready for review."),
		},
		{
			"one of three files staged",
			stepInput(flow.StepState{Status: flow.StepInReview, Review: &review.Snapshot{Staged: 1, Total: 3}}, waiting),
			situation(attention.KindStepReview, attention.FormStaged, 33, "Step 2 is ready for review."),
		},
		{
			"ready to approve",
			stepInput(flow.StepState{Status: flow.StepReadyToApprove, Review: &review.Snapshot{Staged: 3, Total: 3}}, waiting),
			situation(attention.KindStepReview, attention.FormApprove, 0, "Step 2 is ready for review."),
		},
		{
			"the last approval left no commit",
			stepInput(flow.StepState{
				Status: flow.StepReadyToApprove, Review: &review.Snapshot{Staged: 3, Total: 3}, CommitFailed: true,
			}, waiting),
			situation(attention.KindStepReview, attention.FormApprove, 0, "Step 2: the last approval didn't produce a commit."),
		},
		{
			"nothing to commit",
			stepInput(flow.StepState{Status: flow.StepNothingToCommit, Review: &review.Snapshot{}}, waiting),
			situation(attention.KindStepEmpty, attention.FormNone, 0, "Step 2 finished without changes."),
		},
		{
			"the worktree cannot be read",
			stepInput(flow.StepState{Status: flow.StepReviewFailed, Review: &review.Snapshot{Err: "git status: exit status 128"}}, waiting),
			situation(attention.KindWorktreeUnreadable, attention.FormNone, 0, "Step 2: the worktree can't be read."),
		},
		{
			"the session is paused in review",
			stepInput(flow.StepState{Status: flow.StepAwaitingReview, Review: &review.Snapshot{Total: 3}}, summary(session.StatusPaused, false)),
			nil,
		},
		{
			"a question waits",
			stepInput(flow.StepState{Status: flow.StepImplementing}, summary(session.StatusNeedsAnswer, false)),
			situation(attention.KindQuestion, attention.FormNone, 0, "The agent has a question in step 2."),
		},
		{"every step is done", stepInput(flow.StepState{Status: flow.StepDone}), nil},
		{"agent review under way", stepInput(flow.StepState{Status: flow.StepAgentReview, ReviewPass: 1}, waiting), nil},
		{"addressing a report", stepInput(flow.StepState{Status: flow.StepAddressingReview, ReviewRound: 1}, working), nil},
		{
			"fell to the user after three rounds",
			stepInput(flow.StepState{
				Status: flow.StepAwaitingReview, Review: &review.Snapshot{Total: 3}, Fallback: task.FallbackRoundsExhausted,
			}, waiting),
			situation(attention.KindStepReview, attention.FormReview, 0, "Step 2: the agent review didn't come clean after three rounds."),
		},
		{
			"fell to the user without the commit",
			stepInput(flow.StepState{
				Status: flow.StepAwaitingReview, Review: &review.Snapshot{Total: 3},
				CommitFailed: true, Fallback: task.FallbackNoCommit,
			}, waiting),
			situation(attention.KindStepReview, attention.FormReview, 0, "Step 2: the last approval didn't produce a commit."),
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if diff := cmp.Diff(test.want, attention.Derive(test.in)); diff != "" {
				t.Errorf("Derive() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestDeriveTheReviewerOfTheCurrentStep(t *testing.T) {
	t.Parallel()

	waiting := summary(session.StatusWaiting, true)
	failedTurn := waiting
	failedTurn.TurnFailed = true

	// underReview is step 2 in a pass of the agent review, with its implementer
	// in the state given and its reviewer in the one given.
	underReview := func(implementer, reviewer session.Summary, missing bool) attention.Input {
		return stepInput(flow.StepState{
			Status: flow.StepAgentReview, ReviewPass: 1, ReportMissing: missing,
			ReviewerStage: session.StepReviewStage(2), Reviewer: reviewer,
		}, implementer)
	}
	// reviewer is a situation in the conversation that reviews step 2.
	reviewer := func(kind attention.Kind, body string) attention.Found {
		return attention.Found{
			TaskID: taskID, Place: attention.Place{Kind: attention.PlaceStepReview, Step: 2},
			Kind: kind, Title: taskName, Body: body,
		}
	}

	tests := []struct {
		name string
		in   attention.Input
		want []attention.Found
	}{
		{"no reviewer", stepInput(flow.StepState{Status: flow.StepImplementing}, summary(session.StatusWorking, false)), nil},
		{"the reviewer is working", underReview(waiting, summary(session.StatusWorking, false), false), nil},
		{"the reviewer is paused", underReview(waiting, summary(session.StatusPaused, false), false), nil},
		{
			"the reviewer has a question",
			underReview(waiting, summary(session.StatusNeedsAnswer, false), false),
			[]attention.Found{reviewer(attention.KindQuestion, "The reviewer of step 2 has a question.")},
		},
		{
			"the reviewer asks for a permission",
			underReview(waiting, summary(session.StatusNeedsPermission, false), false),
			[]attention.Found{reviewer(attention.KindPermission, "The reviewer of step 2 asks for a permission.")},
		},
		{
			"the reviewer stopped with an error",
			underReview(waiting, summary(session.StatusError, false), false),
			[]attention.Found{reviewer(attention.KindSessionError, "The review of step 2 stopped with an error.")},
		},
		{
			"the last turn of the reviewer failed",
			underReview(waiting, failedTurn, false),
			[]attention.Found{reviewer(attention.KindSessionError, "The review of step 2 stopped with an error.")},
		},
		{
			"the pass ended without its report",
			underReview(waiting, waiting, true),
			[]attention.Found{reviewer(attention.KindReply, "The reviewer of step 2 stopped without writing its report.")},
		},
		{
			"the implementer and the reviewer both wait",
			underReview(summary(session.StatusNeedsPermission, false), summary(session.StatusNeedsAnswer, false), false),
			[]attention.Found{
				{
					TaskID: taskID, Place: attention.Place{Kind: attention.PlaceStep, Step: 2},
					Kind: attention.KindPermission, Title: taskName, Body: "Permission requested in step 2.",
				},
				reviewer(attention.KindQuestion, "The reviewer of step 2 has a question."),
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if diff := cmp.Diff(test.want, attention.Derive(test.in)); diff != "" {
				t.Errorf("Derive() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestDeriveTheRepositoriesOfThePRStage(t *testing.T) {
	t.Parallel()

	const webPath = workspace + "/web"

	waiting := summary(session.StatusWaiting, true)
	apiPlace := attention.Place{Kind: attention.PlaceRepo, RepoPath: apiPath, Repository: "api"}

	// situation is the one situation of the task, in api.
	situation := func(kind attention.Kind, form attention.Form, percent int, body string) []attention.Found {
		return []attention.Found{{
			TaskID: taskID, Place: apiPlace, Kind: kind, Form: form, Percent: percent, Title: taskName, Body: body,
		}}
	}

	tests := []struct {
		name string
		in   attention.Input
		want []attention.Found
	}{
		{
			"blocked",
			repoInput(flow.RepoState{
				Repository: "api", RepoPath: apiPath, Status: flow.RepoBlocked,
				Block: &task.PRBlock{Reason: task.PRBlockGHAuth, Detail: "You are not logged into any GitHub hosts."},
			}),
			situation(attention.KindPRBlocked, attention.FormNone, 0, "The pull request of api is blocked: the GitHub CLI isn't authenticated."),
		},
		{
			"the pull request was closed without a merge",
			repoInput(flow.RepoState{Repository: "api", RepoPath: apiPath, Status: flow.RepoPRClosed}),
			situation(attention.KindPRClosed, attention.FormNone, 0, "The pull request of api was closed without a merge."),
		},
		{
			"the agent stopped short of what the app waits for",
			repoInput(flow.RepoState{
				Repository: "api", RepoPath: apiPath, Status: flow.RepoAwaitingReply,
				SessionStage: session.PRStage("api"), Session: waiting,
			}),
			situation(attention.KindReply, attention.FormNone, 0, "The agent is waiting for your reply in api."),
		},
		{
			"a draft to approve",
			repoInput(flow.RepoState{
				Repository: "api", RepoPath: apiPath, Status: flow.RepoDraftReady,
				SessionStage: session.PRStage("api"), Session: waiting,
			}),
			situation(attention.KindDraft, attention.FormNone, 0, "The pull request draft of api is ready for your OK."),
		},
		{
			"findings to decide",
			repoInput(flow.RepoState{
				Repository: "api", RepoPath: apiPath, Status: flow.RepoAwaitingDecision,
				SessionStage: session.PRReviewStage("api"), Session: waiting,
			}),
			situation(attention.KindFindings, attention.FormNone, 0, "The review of api found changes for you to decide."),
		},
		{
			"changes with nothing staged",
			repoInput(flow.RepoState{
				Repository: "api", RepoPath: apiPath, Status: flow.RepoInReview, Review: &review.Snapshot{Total: 2},
				SessionStage: session.PRReviewStage("api"), Session: waiting,
			}),
			situation(attention.KindChangesReview, attention.FormReview, 0, "The changes from the review of api are ready for review."),
		},
		{
			"changes with one of two files staged",
			repoInput(flow.RepoState{
				Repository: "api", RepoPath: apiPath, Status: flow.RepoInReview, Review: &review.Snapshot{Staged: 1, Total: 2},
				SessionStage: session.PRReviewStage("api"), Session: waiting,
			}),
			situation(attention.KindChangesReview, attention.FormStaged, 50, "The changes from the review of api are ready for review."),
		},
		{
			"changes ready to approve",
			repoInput(flow.RepoState{
				Repository: "api", RepoPath: apiPath, Status: flow.RepoReadyToApprove, Review: &review.Snapshot{Staged: 2, Total: 2},
				SessionStage: session.PRReviewStage("api"), Session: waiting,
			}),
			situation(attention.KindChangesReview, attention.FormApprove, 0, "The changes from the review of api are ready for review."),
		},
		{
			"the last approval of the changes left no commit",
			repoInput(flow.RepoState{
				Repository: "api", RepoPath: apiPath, Status: flow.RepoReadyToApprove, Review: &review.Snapshot{Staged: 2, Total: 2},
				CommitFailed: true, SessionStage: session.PRReviewStage("api"), Session: waiting,
			}),
			situation(attention.KindChangesReview, attention.FormApprove, 0, "api: the last approval didn't produce a commit."),
		},
		{
			"ready to merge",
			repoInput(flow.RepoState{Repository: "api", RepoPath: apiPath, Status: flow.RepoDone}),
			situation(attention.KindMerge, attention.FormMerge, 0, "The pull request of api is ready to merge."),
		},
		{
			"the merge could not be confirmed",
			repoInput(flow.RepoState{
				Repository: "api", RepoPath: apiPath, Status: flow.RepoDone, CheckError: "gh pr view: timeout", CanClose: true,
			}),
			situation(attention.KindMerge, attention.FormClose, 0, "The pull request of api is ready to close."),
		},
		{
			"merged",
			repoInput(flow.RepoState{Repository: "api", RepoPath: apiPath, Status: flow.RepoMerged, CanClose: true}),
			situation(attention.KindMerge, attention.FormClose, 0, "The pull request of api is ready to close."),
		},
		{
			"nothing to publish",
			repoInput(flow.RepoState{Repository: "api", RepoPath: apiPath, Status: flow.RepoSkipped, CanClose: true}),
			situation(attention.KindNothingToPublish, attention.FormNone, 0, "api has nothing to publish and is ready to close."),
		},
		{
			"the agent is drafting",
			repoInput(flow.RepoState{
				Repository: "api", RepoPath: apiPath, Status: flow.RepoDrafting,
				SessionStage: session.PRStage("api"), Session: summary(session.StatusWorking, false),
			}),
			nil,
		},
		{"closing", repoInput(flow.RepoState{Repository: "api", RepoPath: apiPath, Status: flow.RepoClosing}), nil},
		{"closed", repoInput(flow.RepoState{Repository: "api", RepoPath: apiPath, Status: flow.RepoClosed}), nil},
		{
			"the session of a draft is paused",
			repoInput(flow.RepoState{
				Repository: "api", RepoPath: apiPath, Status: flow.RepoDraftReady,
				SessionStage: session.PRStage("api"), Session: summary(session.StatusPaused, false),
			}),
			nil,
		},
		{
			"a permission waits",
			repoInput(flow.RepoState{
				Repository: "api", RepoPath: apiPath, Status: flow.RepoDrafting,
				SessionStage: session.PRStage("api"), Session: summary(session.StatusNeedsPermission, false),
			}),
			situation(attention.KindPermission, attention.FormNone, 0, "Permission requested in api."),
		},
		{
			"the repository at the root of the workspace",
			repoInput(flow.RepoState{
				Repository: ".", RepoPath: workspace, Status: flow.RepoDraftReady,
				SessionStage: session.PRStage(task.Slug(".")), Session: waiting,
			}),
			[]attention.Found{{
				TaskID: taskID, Place: attention.Place{Kind: attention.PlaceRepo, RepoPath: workspace, Repository: "."},
				Kind: attention.KindDraft, Title: taskName, Body: "The pull request draft of code is ready for your OK.",
			}},
		},
		{
			"two repositories",
			repoInput(
				flow.RepoState{
					Repository: "web", RepoPath: webPath, Status: flow.RepoAwaitingDecision,
					SessionStage: session.PRReviewStage("web"), Session: waiting,
				},
				flow.RepoState{
					Repository: "api", RepoPath: apiPath, Status: flow.RepoDraftReady,
					SessionStage: session.PRStage("api"), Session: waiting,
				},
			),
			[]attention.Found{
				{
					TaskID: taskID, Place: attention.Place{Kind: attention.PlaceRepo, RepoPath: webPath, Repository: "web"},
					Kind: attention.KindFindings, Title: taskName, Body: "The review of web found changes for you to decide.",
				},
				{
					TaskID: taskID, Place: apiPlace,
					Kind: attention.KindDraft, Title: taskName, Body: "The pull request draft of api is ready for your OK.",
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if diff := cmp.Diff(test.want, attention.Derive(test.in)); diff != "" {
				t.Errorf("Derive() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestStepAndPRBlockPhrases(t *testing.T) {
	t.Parallel()

	stepBlocked := func(block *task.StepBlock) attention.Input {
		return stepInput(flow.StepState{Status: flow.StepBlocked, Block: block})
	}
	prBlocked := func(block *task.PRBlock) attention.Input {
		return repoInput(flow.RepoState{Repository: "api", RepoPath: apiPath, Status: flow.RepoBlocked, Block: block})
	}

	tests := []struct {
		name string
		in   attention.Input
		body string
	}{
		{"dirty worktree", stepBlocked(&task.StepBlock{Reason: task.BlockDirty}), "Step 2 can't start: the worktree has uncommitted changes."},
		{"fetch failed", stepBlocked(&task.StepBlock{Reason: task.BlockFetchFailed}), "Step 2 can't start: couldn't fetch origin."},
		{"no base branch", stepBlocked(&task.StepBlock{Reason: task.BlockNoBase}), "Step 2 can't start: no base branch."},
		{"worktree folder exists", stepBlocked(&task.StepBlock{Reason: task.BlockPathExists}), "Step 2 can't start: the worktree folder already exists."},
		{"branch exists", stepBlocked(&task.StepBlock{Reason: task.BlockBranchExists}), "Step 2 can't start: the branch already exists."},
		{"git failed for a step", stepBlocked(&task.StepBlock{Reason: task.BlockGitFailed}), "Step 2 can't start: git failed."},
		{"no repository", stepBlocked(&task.StepBlock{Reason: task.BlockNoRepository}), "Step 2 can't start: the step doesn't name a repository of this task."},
		{"a step blocked with no reason", stepBlocked(nil), "Step 2 can't start: git failed."},
		{"gh missing", prBlocked(&task.PRBlock{Reason: task.PRBlockGHMissing}), "The pull request of api is blocked: the GitHub CLI was not found."},
		{"gh not authenticated", prBlocked(&task.PRBlock{Reason: task.PRBlockGHAuth}), "The pull request of api is blocked: the GitHub CLI isn't authenticated."},
		{"gh failed", prBlocked(&task.PRBlock{Reason: task.PRBlockGHFailed}), "The pull request of api is blocked: the GitHub CLI failed."},
		{"git failed for a pull request", prBlocked(&task.PRBlock{Reason: task.PRBlockGitFailed}), "The pull request of api is blocked: git failed."},
		{"worktree gone", prBlocked(&task.PRBlock{Reason: task.PRBlockNoWorktree}), "The pull request of api is blocked: the worktree is gone."},
		{"a pull request blocked with no reason", prBlocked(nil), "The pull request of api is blocked: git failed."},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			got := attention.Derive(test.in)
			if len(got) != 1 {
				t.Fatalf("Derive() = %v, want one situation", got)
			}
			if got[0].Body != test.body {
				t.Errorf("body = %q, want %q", got[0].Body, test.body)
			}
		})
	}
}

func TestPlaceKeysReadBack(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		place attention.Place
		key   string
	}{
		{"stage", attention.Place{Kind: attention.PlaceStage, Stage: task.StageTechSpec}, "stage:tech_spec"},
		{"step", attention.Place{Kind: attention.PlaceStep, Step: 12}, "step:12"},
		{"step review", attention.Place{Kind: attention.PlaceStepReview, Step: 3}, "step_review:3"},
		{
			"repository with a colon in its path",
			attention.Place{Kind: attention.PlaceRepo, RepoPath: "/home/u/code/api:v2"},
			"repo:/home/u/code/api:v2",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if got := test.place.Key(); got != test.key {
				t.Errorf("Key() = %q, want %q", got, test.key)
			}
			got, ok := attention.ParsePlace(test.key)
			if !ok {
				t.Fatalf("ParsePlace(%q) = false, want true", test.key)
			}
			if diff := cmp.Diff(test.place, got); diff != "" {
				t.Errorf("ParsePlace(%q) mismatch (-want +got):\n%s", test.key, diff)
			}
		})
	}

	for _, key := range []string{"", "stage:", "stage:closing", "step:0", "step:x", "step_review:0", "step_review:x", "other:1"} {
		if place, ok := attention.ParsePlace(key); ok {
			t.Errorf("ParsePlace(%q) = %+v, true; want false", key, place)
		}
	}
}

func TestKindsBelongToTheirGroup(t *testing.T) {
	t.Parallel()

	groups := map[attention.Kind]attention.Group{
		attention.KindSessionError:       attention.GroupError,
		attention.KindStepBlocked:        attention.GroupError,
		attention.KindWorktreeUnreadable: attention.GroupError,
		attention.KindPRBlocked:          attention.GroupError,
		attention.KindPlanInvalid:        attention.GroupError,
		attention.KindPRClosed:           attention.GroupError,

		attention.KindPermission:      attention.GroupWaiting,
		attention.KindQuestion:        attention.GroupWaiting,
		attention.KindReply:           attention.GroupWaiting,
		attention.KindReadyToContinue: attention.GroupWaiting,
		attention.KindStepReview:      attention.GroupWaiting,
		attention.KindStepEmpty:       attention.GroupWaiting,
		attention.KindDraft:           attention.GroupWaiting,
		attention.KindFindings:        attention.GroupWaiting,
		attention.KindChangesReview:   attention.GroupWaiting,

		attention.KindMerge:            attention.GroupClosing,
		attention.KindNothingToPublish: attention.GroupClosing,
	}
	for kind, want := range groups {
		if got := kind.Group(); got != want {
			t.Errorf("%s.Group() = %q, want %q", kind, got, want)
		}
	}
}
