package bindings_test

import (
	"crypto/sha256"
	"fmt"
	"strconv"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/attention"
	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/claude/claudetest"
	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/discussionflow"
	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/prreport"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/pulls"
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/reviewflow"
	"github.com/guilhermt/myspec/internal/reviewmode"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/upgrade"
	"github.com/guilhermt/myspec/internal/worktree"
)

func TestFromTasksCarriesTheStateOfEachStep(t *testing.T) {
	t.Parallel()

	tasks := []task.Task{{ID: "task-1", Name: "login-screen", Stage: task.StageImplementation}}
	states := []flow.StepState{
		{
			Step:   task.Step{Number: 1, File: "1-first.md", Title: "First"},
			Status: flow.StepBlocked,
			Block: &task.StepBlock{
				Reason: task.BlockDirty,
				Detail: " M main.go",
				Files:  1,
			},
			WorktreePath: "/data/worktrees/dev/web/login-screen",
		},
		{
			Step:   task.Step{Number: 2, File: "2-second.md", Title: "Second"},
			Status: flow.StepPreparing,
			Phase:  flow.PhaseFetching,
		},
		{
			Step:     task.Step{Number: 3, File: "3-third.md", Title: "Third"},
			Status:   flow.StepNotStarted,
			Choice:   models.Choice{Model: models.Opus55, Effort: models.XHigh},
			Adjusted: true,
		},
	}
	want := []bindings.Step{
		{
			Number: 1, File: "1-first.md", Title: "First",
			Status:       "blocked",
			Block:        &bindings.StepBlock{Reason: "dirty_worktree", Detail: " M main.go", Files: 1},
			WorktreePath: "/data/worktrees/dev/web/login-screen",
			Reports:      []bindings.StepReport{},
		},
		{
			Number: 2, File: "2-second.md", Title: "Second",
			Status: "preparing", Phase: "fetching",
			Reports: []bindings.StepReport{},
		},
		{
			Number: 3, File: "3-third.md", Title: "Third",
			Status: "not_started",
			Model:  "claude-opus-5-5[1m]", Effort: "xhigh", Adjusted: true, ModelEditable: true,
			ReviewModeEditable: true, Reports: []bindings.StepReport{},
		},
	}

	got := bindings.FromTasks(
		tasks,
		func(string) task.Artifacts { return task.Artifacts{} },
		func(string) []flow.StepState { return states },
		noPR,
		noWorktree,
		noConversations,
		repoOf,
		nil,
		nil,
	)
	if len(got) != 1 {
		t.Fatalf("len(FromTasks()) = %d, want 1", len(got))
	}
	if diff := cmp.Diff(want, got[0].Steps); diff != "" {
		t.Errorf("steps mismatch (-want +got):\n%s", diff)
	}
	if got[0].CurrentStep != 1 {
		t.Errorf("currentStep = %d, want 1", got[0].CurrentStep)
	}
}

func TestFromTasksCarriesTheAgentReviewOfAStep(t *testing.T) {
	t.Parallel()

	states := []flow.StepState{
		{
			Step:          task.Step{Number: 1, File: "1-first.md", Title: "First"},
			Status:        flow.StepAgentReview,
			ReviewMode:    reviewmode.Agent,
			ReviewPass:    2,
			ReportMissing: true,
			Reports: []task.ReviewReport{
				{Pass: 1, File: "1-review-1.md"},
				{Pass: 2, File: "1-review-2.md", Clean: true},
			},
			ReviewerStage: "step_review:1",
			Reviewer: session.Summary{
				Status:         session.StatusWorking,
				Choice:         models.Choice{Model: models.Opus55, Effort: models.High},
				TurnRunning:    true,
				ProcessRunning: true,
				RetryAttempt:   1,
				ContextPercent: 40,
				PendingCount:   1,
				LastError:      "overloaded",
			},
		},
		{
			Step:     task.Step{Number: 2, File: "2-second.md", Title: "Second"},
			Status:   flow.StepNotStarted,
			Fallback: "",
		},
	}
	want := []bindings.Step{
		{
			Number: 1, File: "1-first.md", Title: "First", Status: "agent_review",
			ReviewMode:    "agent",
			ReviewPass:    2,
			ReportMissing: true,
			Reports: []bindings.StepReport{
				{Pass: 1, File: "1-review-1.md"},
				{Pass: 2, File: "1-review-2.md", Clean: true},
			},
			Reviewer: &bindings.StepReviewer{
				SessionStage:   "step_review:1",
				SessionStatus:  "working",
				SessionModel:   "claude-opus-5-5[1m]",
				SessionEffort:  "high",
				TurnRunning:    true,
				ProcessRunning: true,
				RetryAttempt:   1,
				ContextPercent: 40,
				PendingCount:   1,
				LastError:      "overloaded",
			},
		},
		{
			Number: 2, File: "2-second.md", Title: "Second", Status: "not_started",
			ModelEditable: true, ReviewModeEditable: true,
			// A step without a reviewer carries none, and an empty list.
			Reports: []bindings.StepReport{},
		},
	}

	got := stepsOf(t, states)
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("steps mismatch (-want +got):\n%s", diff)
	}
	if got[1].Reports == nil {
		t.Error("reports of a step without a review = nil, want an empty slice")
	}
}

func TestFromTasksCarriesTheFallbackAndTheRoundOfAStep(t *testing.T) {
	t.Parallel()

	states := []flow.StepState{
		{
			Step:        task.Step{Number: 1, File: "1-first.md", Title: "First"},
			Status:      flow.StepAddressingReview,
			ReviewMode:  reviewmode.Agent,
			ReviewRound: 2,
		},
		{
			Step:       task.Step{Number: 2, File: "2-second.md", Title: "Second"},
			Status:     flow.StepAwaitingReview,
			ReviewMode: reviewmode.Manual,
			Fallback:   task.FallbackRoundsExhausted,
		},
		{
			Step:         task.Step{Number: 3, File: "3-third.md", Title: "Third"},
			Status:       flow.StepNotStarted,
			ReviewMode:   reviewmode.Agent,
			ModeAdjusted: true,
		},
	}

	got := stepsOf(t, states)
	if got[0].ReviewRound != 2 || got[0].ReviewMode != "agent" {
		t.Errorf("step 1 = round %d mode %q, want round 2 under agent", got[0].ReviewRound, got[0].ReviewMode)
	}
	if got[1].ReviewFallback != "rounds_exhausted" || got[1].ReviewMode != "manual" {
		t.Errorf("step 2 = fallback %q mode %q, want rounds_exhausted under manual",
			got[1].ReviewFallback, got[1].ReviewMode)
	}
	if !got[2].ReviewModeAdjusted || !got[2].ReviewModeEditable {
		t.Errorf("step 3 = adjusted %v editable %v, want both", got[2].ReviewModeAdjusted, got[2].ReviewModeEditable)
	}
}

func TestFromTasksCarriesTheReviewModeOfTheTask(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		task         task.Task
		wantMode     string
		wantEditable bool
	}{
		{
			name:         "a task before the plan",
			task:         task.Task{ID: "task-1", Stage: task.StagePlan, ReviewModes: task.ReviewModes{Task: reviewmode.Agent}},
			wantMode:     "agent",
			wantEditable: true,
		},
		{
			name:     "a task in the pull request stage",
			task:     task.Task{ID: "task-1", Stage: task.StagePR, ReviewModes: task.ReviewModes{Task: reviewmode.Agent}},
			wantMode: "agent",
		},
		{
			// Only a task built by hand has no mode; the user reviews it.
			name:         "a task without a mode",
			task:         task.Task{ID: "task-1", Stage: task.StagePRD},
			wantMode:     "manual",
			wantEditable: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := bindings.FromTasks(
				[]task.Task{tt.task},
				func(string) task.Artifacts { return task.Artifacts{} },
				func(string) []flow.StepState { return nil },
				noPR,
				noWorktree,
				noConversations,
				repoOf,
				nil,
				nil,
			)
			if len(got) != 1 {
				t.Fatalf("len(FromTasks()) = %d, want 1", len(got))
			}
			if got[0].ReviewMode != tt.wantMode || got[0].ReviewModeEditable != tt.wantEditable {
				t.Errorf("task = reviewMode %q editable %v, want %q %v",
					got[0].ReviewMode, got[0].ReviewModeEditable, tt.wantMode, tt.wantEditable)
			}
		})
	}
}

func TestFromTasksHasNoCurrentStepWithoutAPlan(t *testing.T) {
	t.Parallel()

	got := bindings.FromTasks(
		[]task.Task{{ID: "task-1", Name: "login-screen", Stage: task.StagePRD}},
		func(string) task.Artifacts { return task.Artifacts{} },
		func(string) []flow.StepState { return nil },
		noPR,
		noWorktree,
		noConversations,
		repoOf,
		nil,
		nil,
	)
	if len(got) != 1 {
		t.Fatalf("len(FromTasks()) = %d, want 1", len(got))
	}
	if got[0].CurrentStep != 0 {
		t.Errorf("currentStep = %d, want 0", got[0].CurrentStep)
	}
	if got[0].Steps == nil {
		t.Error("steps = nil, want an empty slice")
	}
}

func TestFromTasksCarriesTheConversationsOfTheTask(t *testing.T) {
	t.Parallel()

	start := time.Date(2026, time.September, 27, 10, 0, 0, 0, time.UTC)
	conversations := map[string][]session.Conversation{
		"task-1": {
			{Stage: "prd", StartedAt: start},
			{Stage: "step:1", StartedAt: start.Add(time.Hour)},
		},
	}
	got := bindings.FromTasks(
		[]task.Task{{ID: "task-1", Stage: task.StagePRD}, {ID: "task-2", Stage: task.StagePRD}},
		func(string) task.Artifacts { return task.Artifacts{} },
		func(string) []flow.StepState { return nil },
		noPR,
		noWorktree,
		func(id string) []session.Conversation { return conversations[id] },
		repoOf,
		nil,
		nil,
	)

	want := []bindings.TaskConversation{
		{Stage: "prd", StartedAt: "2026-09-27T10:00:00Z"},
		{Stage: "step:1", StartedAt: "2026-09-27T11:00:00Z"},
	}
	if diff := cmp.Diff(want, got[0].Conversations); diff != "" {
		t.Errorf("conversations mismatch (-want +got):\n%s", diff)
	}
	if got[1].Conversations == nil || len(got[1].Conversations) != 0 {
		t.Errorf("conversations of a task without sessions = %#v, want an empty slice", got[1].Conversations)
	}
}

func TestFromTasksCarriesTheWorktreeOfTheTask(t *testing.T) {
	t.Parallel()

	wt := worktree.Worktree{TaskID: "task-1", Path: "/data/worktrees/login", Branch: "login", Base: "origin/main"}
	got := bindings.FromTasks(
		[]task.Task{{ID: "task-1", Stage: task.StageImplementation}, {ID: "task-2", Stage: task.StagePRD}},
		func(string) task.Artifacts { return task.Artifacts{} },
		func(string) []flow.StepState { return nil },
		noPR,
		func(id string) (worktree.Worktree, bool) { return wt, id == "task-1" },
		noConversations,
		repoOf,
		nil,
		nil,
	)

	type place struct{ Branch, BaseBranch, WorktreePath string }
	for i, want := range []place{{"login", "origin/main", "/data/worktrees/login"}, {}} {
		if diff := cmp.Diff(want, place{got[i].Branch, got[i].BaseBranch, got[i].WorktreePath}); diff != "" {
			t.Errorf("worktree of %s mismatch (-want +got):\n%s", got[i].ID, diff)
		}
	}
}

func TestFromTasksCarriesTheReviewOfAStep(t *testing.T) {
	t.Parallel()

	states := []flow.StepState{{
		Step:   task.Step{Number: 1, File: "1-first.md", Title: "First"},
		Status: flow.StepInReview,
		Review: &review.Snapshot{
			Files: []review.File{
				{Path: "main.go", Kind: git.KindModified, Staged: true},
				{Path: "notes.md", Kind: git.KindUntracked},
			},
			Staged: 1,
			Total:  2,
		},
	}}
	want := &bindings.Review{
		Files: []bindings.ReviewFile{
			{Path: "main.go", Kind: "modified", Staged: true},
			{Path: "notes.md", Kind: "untracked"},
		},
		Staged:  1,
		Total:   2,
		Percent: 50,
	}

	got := stepsOf(t, states)
	if diff := cmp.Diff(want, got[0].Review); diff != "" {
		t.Errorf("review mismatch (-want +got):\n%s", diff)
	}
}

func TestFromTasksCarriesAWorktreeThatCouldNotBeRead(t *testing.T) {
	t.Parallel()

	states := []flow.StepState{{
		Step:   task.Step{Number: 1, File: "1-first.md", Title: "First"},
		Status: flow.StepReviewFailed,
		Review: &review.Snapshot{Err: "git status: no such file"},
	}}

	got := stepsOf(t, states)
	if got[0].Review == nil {
		t.Fatal("review = nil, want what git said")
	}
	if got[0].Review.Error != "git status: no such file" {
		t.Errorf("error = %q, want what git said", got[0].Review.Error)
	}
	// The frontend maps over the files without checking for null.
	if got[0].Review.Files == nil {
		t.Error("files = nil, want an empty slice")
	}
}

func TestFromTasksCarriesTheCommitOfAStepThatIsOver(t *testing.T) {
	t.Parallel()

	states := []flow.StepState{
		{
			Step:          task.Step{Number: 1, File: "1-first.md", Title: "First"},
			Status:        flow.StepDone,
			CommitSHA:     "2222222",
			CommitSubject: "Add the login screen",
			CommittedAt:   time.Date(2026, 9, 20, 14, 30, 0, 0, time.UTC),
		},
		{
			Step:         task.Step{Number: 2, File: "2-second.md", Title: "Second"},
			Status:       flow.StepReadyToApprove,
			Review:       &review.Snapshot{Staged: 2, Total: 2},
			CommitFailed: true,
		},
	}

	got := stepsOf(t, states)
	if got[0].CommitSHA != "2222222" || got[0].CommitSubject != "Add the login screen" {
		t.Errorf("commit = %q %q, want the one the step produced", got[0].CommitSHA, got[0].CommitSubject)
	}
	if got[0].CommittedAt != "2026-09-20T14:30:00Z" {
		t.Errorf("committedAt = %q, want the committer date", got[0].CommittedAt)
	}
	if got[1].CommittedAt != "" {
		t.Errorf("committedAt = %q, want empty on a step not committed", got[1].CommittedAt)
	}
	if got[0].Review != nil {
		t.Errorf("review = %+v, want nil on a step that is over", got[0].Review)
	}
	if !got[1].CommitFailed {
		t.Error("commitFailed = false, want the warning of the step the user is on")
	}
}

func TestTheCurrentStepIsTheFirstOneThatIsNotDone(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		statuses []flow.StepStatus
		want     int
	}{
		{"nothing committed yet", []flow.StepStatus{flow.StepImplementing, flow.StepNotStarted}, 1},
		{"the first one is committed", []flow.StepStatus{flow.StepDone, flow.StepPreparing}, 2},
		{"every step is committed", []flow.StepStatus{flow.StepDone, flow.StepDone}, 0},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			states := make([]flow.StepState, len(test.statuses))
			for i, status := range test.statuses {
				states[i] = flow.StepState{Step: task.Step{Number: i + 1}, Status: status}
			}
			got := bindings.FromTasks(
				[]task.Task{{ID: "task-1", Stage: task.StageImplementation}},
				func(string) task.Artifacts { return task.Artifacts{} },
				func(string) []flow.StepState { return states },
				noPR,
				noWorktree,
				noConversations,
				repoOf,
				nil,
				nil,
			)
			if got[0].CurrentStep != test.want {
				t.Errorf("currentStep = %d, want %d", got[0].CurrentStep, test.want)
			}
		})
	}
}

// noPR is the PR stage of a task that has not reached it.
func noPR(string) (flow.PullRequest, bool) { return flow.PullRequest{}, false }

func noWorktree(string) (worktree.Worktree, bool) { return worktree.Worktree{}, false }

func noConversations(string) []session.Conversation { return nil }

// convertRepo is the repository every converted task belongs to.
var convertRepo = repository.Repository{ID: "repo-1", Owner: "dev", Name: "web", Path: "/home/dev/web"}

// repoOf is the Repositories of the conversions: one registered repository.
func repoOf(id string) (repository.Repository, bool) {
	return convertRepo, id == convertRepo.ID
}

// stepsOf converts the steps of a single implementing task, which is what
// every step conversion test needs.
func stepsOf(t *testing.T, states []flow.StepState) []bindings.Step {
	t.Helper()

	got := bindings.FromTasks(
		[]task.Task{{ID: "task-1", Name: "login-screen", Stage: task.StageImplementation}},
		func(string) task.Artifacts { return task.Artifacts{} },
		func(string) []flow.StepState { return states },
		noPR,
		noWorktree,
		noConversations,
		repoOf,
		nil,
		nil,
	)
	if len(got) != 1 {
		t.Fatalf("len(FromTasks()) = %d, want 1", len(got))
	}
	return got[0].Steps
}

func TestFromTasksCarriesWhatClosingATaskDid(t *testing.T) {
	t.Parallel()

	closedAt := time.Date(2026, 9, 8, 18, 30, 0, 0, time.UTC)
	pr := flow.PullRequest{
		Status: flow.PRClosed,
		PR: task.PRDetails{
			Number: 7, URL: "https://github.com/acme/api/pull/7", State: task.PRStateMerged, Base: "dev",
		},
		Close: &task.CloseResult{
			Worktree:     task.CloseStep{Outcome: task.OutcomeDone},
			Branch:       task.CloseStep{Outcome: task.OutcomeSkipped, Reason: task.SkipNotMerged, Detail: "login-screen"},
			Base:         task.CloseStep{Outcome: task.OutcomeFailed, Detail: "git merge: refusing"},
			WorktreePath: "/data/worktrees/dev/web/login-screen",
			BranchName:   "login-screen",
			BaseBranch:   "dev",
			BaseCommits:  3,
			ClosedAt:     closedAt,
		},
	}

	got := bindings.FromTasks(
		[]task.Task{{ID: "task-1", Name: "login-screen", Stage: task.StagePR}},
		func(string) task.Artifacts { return task.Artifacts{} },
		func(string) []flow.StepState { return nil },
		func(string) (flow.PullRequest, bool) { return pr, true },
		noWorktree,
		noConversations,
		repoOf,
		nil,
		nil,
	)
	if len(got) != 1 || got[0].PR == nil {
		t.Fatalf("FromTasks() = %+v, want one task with its pull request", got)
	}

	want := &bindings.CloseResult{
		Worktree:     bindings.CloseStep{Outcome: "done"},
		Branch:       bindings.CloseStep{Outcome: "skipped", Reason: "not_merged", Detail: "login-screen"},
		Base:         bindings.CloseStep{Outcome: "failed", Detail: "git merge: refusing"},
		WorktreePath: "/data/worktrees/dev/web/login-screen",
		BranchName:   "login-screen",
		BaseBranch:   "dev",
		BaseCommits:  3,
		ClosedAt:     "2026-09-08T18:30:00Z",
	}
	if diff := cmp.Diff(want, got[0].PR.Close); diff != "" {
		t.Errorf("close result mismatch (-want +got):\n%s", diff)
	}
	if got[0].PR.PRBase != "dev" || got[0].PR.CanClose {
		t.Errorf("pull request = %+v, want the base and no closing to offer", got[0].PR)
	}
}

func TestFromTasksCarriesAReadingThatFailedAndTheMissingClone(t *testing.T) {
	t.Parallel()

	pr := flow.PullRequest{
		Status:       flow.PRDone,
		PR:           task.PRDetails{Number: 8, State: task.PRStateOpen, Base: "dev"},
		CheckError:   "gh pr view: connection refused",
		CanClose:     true,
		CloneMissing: true,
	}

	got := bindings.FromTasks(
		[]task.Task{{ID: "task-1", Name: "login-screen", Stage: task.StagePR}},
		func(string) task.Artifacts { return task.Artifacts{} },
		func(string) []flow.StepState { return nil },
		func(string) (flow.PullRequest, bool) { return pr, true },
		noWorktree,
		noConversations,
		repoOf,
		nil,
		nil,
	)
	if len(got) != 1 || got[0].PR == nil {
		t.Fatalf("FromTasks() = %+v, want one task with its pull request", got)
	}
	converted := got[0].PR
	if converted.Close != nil {
		t.Errorf("close result = %+v, want nil on a task that is not closed", converted.Close)
	}
	if converted.CheckError != "gh pr view: connection refused" || !converted.CanClose {
		t.Errorf("pull request = %+v, want the failed reading and the closing offered", converted)
	}
	if !converted.CloneMissing {
		t.Error("cloneMissing = false, want the clone reported as gone")
	}
}

func TestFromArchivedCarriesTheDocumentsAndThePullRequest(t *testing.T) {
	t.Parallel()

	createdAt := time.Date(2026, 9, 1, 9, 0, 0, 0, time.UTC)
	archivedAt := time.Date(2026, 9, 8, 18, 30, 0, 0, time.UTC)
	tasks := []task.Task{{
		ID:              "task-1",
		RepositoryID:    convertRepo.ID,
		Name:            "login-screen",
		ArtifactVersion: 4,
		CreatedAt:       createdAt,
		ArchivedAt:      archivedAt,
	}}
	artifacts := task.Artifacts{
		PRD:      true,
		TechSpec: true,
		Plan: task.Plan{
			Present: true,
			Steps: []task.Step{
				{Number: 1, File: "1-first.md", Title: "First"},
				{Number: 2, File: "2-second.md", Title: "Second"},
			},
		},
	}
	run := task.PRRun{
		Status: task.PRClosed,
		PR: task.PRDetails{
			Number: 7, URL: "https://github.com/acme/api/pull/7", State: task.PRStateMerged,
		},
	}

	want := []bindings.ArchivedTask{{
		ID:           "task-1",
		Name:         "login-screen",
		RepositoryID: convertRepo.ID,
		Repository:   "dev/web",
		HasPRD:       true,
		HasTechSpec:  true,
		Steps: []bindings.ArchivedStep{
			{Number: 1, File: "1-first.md", Title: "First", Reports: []bindings.StepReport{}},
			{Number: 2, File: "2-second.md", Title: "Second", Reports: []bindings.StepReport{}},
		},
		PR: &bindings.ArchivedPR{
			Number: 7, URL: "https://github.com/acme/api/pull/7", State: "merged",
		},
		ArtifactVersion: 4,
		CreatedAt:       "2026-09-01T09:00:00Z",
		ArchivedAt:      "2026-09-08T18:30:00Z",
	}}

	got := bindings.FromArchived(
		tasks,
		func(string) task.Artifacts { return artifacts },
		func(string) (task.PRRun, bool) { return run, true },
		repoOf,
	)
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("history mismatch (-want +got):\n%s", diff)
	}
}

func TestFromTasksCarriesTheModeAndTheOneShotDocument(t *testing.T) {
	t.Parallel()

	got := bindings.FromTasks(
		[]task.Task{
			{ID: "task-1", Name: "login-screen", Mode: task.ModeOneShot, Stage: task.StageOneShot},
			{ID: "task-2", Name: "sign-up", Mode: task.ModeStructured, Stage: task.StagePRD},
		},
		func(id string) task.Artifacts { return task.Artifacts{OneShot: id == "task-1"} },
		func(string) []flow.StepState { return nil },
		noPR,
		noWorktree,
		noConversations,
		repoOf,
		nil,
		nil,
	)
	if len(got) != 2 {
		t.Fatalf("len(FromTasks()) = %d, want 2", len(got))
	}
	if got[0].Mode != "one_shot" || got[0].Stage != "one_shot" || !got[0].HasOneShot {
		t.Errorf("task-1 = mode %q stage %q hasOneShot %v, want the One-Shot planning with its document",
			got[0].Mode, got[0].Stage, got[0].HasOneShot)
	}
	if got[1].Mode != "structured" || got[1].HasOneShot {
		t.Errorf("task-2 = mode %q hasOneShot %v, want a Structured task without the document",
			got[1].Mode, got[1].HasOneShot)
	}
}

func TestFromArchivedCarriesTheModeAndTheOneShotDocument(t *testing.T) {
	t.Parallel()

	// The plan of a One-Shot task is its document, as a single step with the
	// reports of its review.
	artifacts := task.Artifacts{
		OneShot: true,
		Plan: task.Plan{
			Present: true,
			Steps: []task.Step{
				{Number: 1, File: "one-shot.md", Title: "Login screen"},
			},
		},
		StepReports: map[int][]task.ReviewReport{1: {{Pass: 1, File: "1-review-1.md", Clean: true}}},
	}

	got := bindings.FromArchived(
		[]task.Task{{ID: "task-1", Name: "login-screen", Mode: task.ModeOneShot}},
		func(string) task.Artifacts { return artifacts },
		func(string) (task.PRRun, bool) { return task.PRRun{}, false },
		repoOf,
	)
	if len(got) != 1 {
		t.Fatalf("len(FromArchived()) = %d, want 1", len(got))
	}
	if got[0].Mode != "one_shot" || !got[0].HasOneShot || got[0].HasPRD || got[0].HasTechSpec {
		t.Errorf("archived task = %+v, want a One-Shot task with its document alone", got[0])
	}
	want := []bindings.ArchivedStep{{
		Number: 1, File: "one-shot.md", Title: "Login screen",
		Reports: []bindings.StepReport{{Pass: 1, File: "1-review-1.md", Clean: true}},
	}}
	if diff := cmp.Diff(want, got[0].Steps); diff != "" {
		t.Errorf("steps mismatch (-want +got):\n%s", diff)
	}
}

func TestFromArchivedCarriesTheReportsOfTheSteps(t *testing.T) {
	t.Parallel()

	artifacts := task.Artifacts{
		Plan: task.Plan{
			Present: true,
			Steps: []task.Step{
				{Number: 1, File: "1-first.md", Title: "First"},
				{Number: 2, File: "2-second.md", Title: "Second"},
			},
		},
		StepReports: map[int][]task.ReviewReport{
			1: {{Pass: 1, File: "1-review-1.md", Findings: 2}, {Pass: 2, File: "1-review-2.md", Clean: true, Findings: -1}},
		},
	}
	want := []bindings.ArchivedStep{
		{
			Number: 1, File: "1-first.md", Title: "First",
			Reports: []bindings.StepReport{
				{Pass: 1, File: "1-review-1.md", Findings: 2},
				{Pass: 2, File: "1-review-2.md", Clean: true, Findings: -1},
			},
		},
		{Number: 2, File: "2-second.md", Title: "Second", Reports: []bindings.StepReport{}},
	}

	got := bindings.FromArchived(
		[]task.Task{{ID: "task-1", Name: "login-screen"}},
		func(string) task.Artifacts { return artifacts },
		func(string) (task.PRRun, bool) { return task.PRRun{}, false },
		repoOf,
	)
	if len(got) != 1 {
		t.Fatalf("len(FromArchived()) = %d, want 1", len(got))
	}
	if diff := cmp.Diff(want, got[0].Steps); diff != "" {
		t.Errorf("steps mismatch (-want +got):\n%s", diff)
	}
	// The history maps over the reports of every step without checking for null.
	if got[0].Steps[1].Reports == nil {
		t.Error("reports of a step without a review = nil, want an empty slice")
	}
}

func TestFromArchivedAllocatesEveryList(t *testing.T) {
	t.Parallel()

	got := bindings.FromArchived(
		[]task.Task{{ID: "task-1", Name: "login-screen"}},
		func(string) task.Artifacts { return task.Artifacts{} },
		func(string) (task.PRRun, bool) { return task.PRRun{}, false },
		repoOf,
	)
	if len(got) != 1 {
		t.Fatalf("len(FromArchived()) = %d, want 1", len(got))
	}
	// The frontend maps over the steps without checking for null, and a task
	// that opened no pull request carries none.
	if got[0].Steps == nil || got[0].PR != nil {
		t.Errorf("archived task = %+v, want an empty slice of steps and no pull request", got[0])
	}
}

func TestFromDeletePreviewCarriesWhatWouldBeDestroyed(t *testing.T) {
	t.Parallel()

	preview := flow.DeletePreview{
		SessionRunning: true,
		Worktree: &flow.WorktreePreview{
			Path:  "/data/worktrees/dev/web/login-screen",
			Dirty: true,
			Files: 2,
		},
		Branch: &flow.BranchPreview{
			Name:  "login-screen",
			Error: "git merge-base: bad revision",
		},
		PR: &flow.PRPreview{
			Number: 7,
			URL:    "https://github.com/acme/api/pull/7",
			State:  task.PRStateOpen,
		},
	}
	want := bindings.DeletePreview{
		SessionRunning: true,
		Worktree: &bindings.WorktreePreview{
			Path:  "/data/worktrees/dev/web/login-screen",
			Dirty: true,
			Files: 2,
		},
		Branch: &bindings.BranchPreview{
			Name:  "login-screen",
			Error: "git merge-base: bad revision",
		},
		PR: &bindings.PRPreview{
			Number: 7,
			URL:    "https://github.com/acme/api/pull/7",
			State:  "open",
		},
	}

	if diff := cmp.Diff(want, bindings.FromDeletePreview(preview)); diff != "" {
		t.Errorf("preview mismatch (-want +got):\n%s", diff)
	}
}

func TestFromDeletePreviewAndResultKeepNilForWhatIsNotThere(t *testing.T) {
	t.Parallel()

	preview := bindings.FromDeletePreview(flow.DeletePreview{})
	if preview.Worktree != nil || preview.Branch != nil || preview.PR != nil {
		t.Errorf("preview = %+v, want nothing to destroy", preview)
	}
	if leftover := bindings.FromDeleteResult(flow.DeleteResult{}).Leftover; leftover != nil {
		t.Errorf("leftover = %+v, want nil when git removed everything", leftover)
	}
}

func TestFromDeleteResultCarriesWhatStayed(t *testing.T) {
	t.Parallel()

	result := flow.DeleteResult{Leftover: &flow.LeftoverInfo{
		Path:   "/data/worktrees/dev/web/login-screen",
		Branch: "login-screen",
		Error:  "git worktree remove: permission denied",
	}}
	want := bindings.DeleteResult{Leftover: &bindings.Leftover{
		Path:   "/data/worktrees/dev/web/login-screen",
		Branch: "login-screen",
		Error:  "git worktree remove: permission denied",
	}}

	if diff := cmp.Diff(want, bindings.FromDeleteResult(result)); diff != "" {
		t.Errorf("result mismatch (-want +got):\n%s", diff)
	}
}

func TestFromEntryCarriesTheStepOfAMarker(t *testing.T) {
	t.Parallel()

	got := bindings.FromEntry(session.Entry{
		Kind:   session.KindMarker,
		Marker: &session.MarkerEntry{Type: session.MarkerStepStarted, Step: 2, Restarted: true},
	})
	want := markerDTO(bindings.MarkerEntry{Type: "step_started", Step: 2, Findings: -1, Restarted: true})
	if diff := cmp.Diff(want, got.Marker); diff != "" {
		t.Errorf("marker mismatch (-want +got):\n%s", diff)
	}
}

func TestFromEntryCarriesTheFieldsOfAnAction(t *testing.T) {
	t.Parallel()

	started := time.Date(2026, time.September, 6, 12, 0, 0, 0, time.UTC)
	finished := started.Add(3200 * time.Millisecond)
	cases := map[string]struct {
		action *session.ActionEntry
		want   *bindings.ActionEntry
	}{
		"every field present": {
			action: &session.ActionEntry{
				ToolUseID: "toolu_2", Tool: "Bash", Label: "Running", Target: "go test ./...",
				Status: session.ActionError, Description: "Run the tests", CommandLines: 2,
				StartedAt: &started, FinishedAt: &finished, ExitCode: new(2), ParentToolUseID: "toolu_1",
				OutputLines: 40, OutputTail: "FAIL", OutputTruncated: true,
			},
			want: &bindings.ActionEntry{
				ToolUseID: "toolu_2", Tool: "Bash", Label: "Running", Target: "go test ./...",
				Status: "error", Description: "Run the tests", CommandLines: 2,
				StartedAt: "2026-09-06T12:00:00Z", FinishedAt: "2026-09-06T12:00:03.2Z", ExitCode: 2, ParentToolUseID: "toolu_1",
				OutputLines: 40, OutputTail: "FAIL", OutputTruncated: true,
			},
		},
		"an old transcript": {
			action: &session.ActionEntry{ToolUseID: "toolu_1", Tool: "Read", Label: "Reading", Status: session.ActionDone},
			want:   &bindings.ActionEntry{ToolUseID: "toolu_1", Tool: "Read", Label: "Reading", Status: "done", ExitCode: -1},
		},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			got := bindings.FromEntry(session.Entry{Kind: session.KindAction, Action: tc.action})
			if diff := cmp.Diff(tc.want, got.Action); diff != "" {
				t.Errorf("action mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestFromEntryCarriesWhoInterrupted(t *testing.T) {
	t.Parallel()

	text := bindings.FromEntry(session.Entry{
		Kind:      session.KindAssistant,
		Assistant: &session.AssistantEntry{Text: "half", Complete: true, Interrupted: true, InterruptedBy: "crash"},
	})
	if got := text.Assistant.InterruptedBy; got != "crash" {
		t.Errorf("assistant InterruptedBy = %q, want crash", got)
	}
	action := bindings.FromEntry(session.Entry{
		Kind:   session.KindAction,
		Action: &session.ActionEntry{Tool: "Read", Status: session.ActionInterrupted, InterruptedBy: "user"},
	})
	if got := action.Action.InterruptedBy; got != "user" {
		t.Errorf("action InterruptedBy = %q, want user", got)
	}
}

// markerDTO is a marker as FromEntry converts it: its lists are never nil.
func markerDTO(m bindings.MarkerEntry) *bindings.MarkerEntry {
	if m.Failed == nil {
		m.Failed = []string{}
	}
	if m.Problems == nil {
		m.Problems = []bindings.PlanProblem{}
	}
	if m.Commits == nil {
		m.Commits = []bindings.MarkerCommit{}
	}
	if m.Epics == nil {
		m.Epics = []string{}
	}
	if m.Before == nil {
		m.Before = []bindings.DraftBefore{}
	}
	return &m
}

func TestFromEntryCarriesTheNewMarkerFields(t *testing.T) {
	t.Parallel()

	cases := map[string]struct {
		marker *session.MarkerEntry
		want   *bindings.MarkerEntry
	}{
		"compacted": {
			marker: &session.MarkerEntry{Type: session.MarkerCompacted, PreTokens: 150000, Percent: 75},
			want:   markerDTO(bindings.MarkerEntry{Type: "compacted", PreTokens: 150000, Findings: -1, Percent: 75}),
		},
		"retried": {
			marker: &session.MarkerEntry{Type: session.MarkerRetried, Attempts: 2, Reason: "rate_limit"},
			want:   markerDTO(bindings.MarkerEntry{Type: "retried", Findings: -1, Attempts: 2, Reason: "rate_limit"}),
		},
		"committed": {
			marker: &session.MarkerEntry{
				Type: session.MarkerCommitted, SHA: "a1b2c3d", Subject: "Fix the lint", Pushed: true, Number: 42,
			},
			want: markerDTO(bindings.MarkerEntry{
				Type: "committed", Findings: -1, SHA: "a1b2c3d", Subject: "Fix the lint", Pushed: true, Number: 42,
			}),
		},
		"pr_opened": {
			marker: &session.MarkerEntry{Type: session.MarkerPROpened, Number: 42, Base: "main"},
			want:   markerDTO(bindings.MarkerEntry{Type: "pr_opened", Findings: -1, Number: 42, Base: "main"}),
		},
		"checks_read": {
			marker: &session.MarkerEntry{
				Type: session.MarkerChecksRead, Pass: 2, Passed: 3, Total: 5, Failed: []string{"lint"}, Conflict: true,
			},
			want: markerDTO(bindings.MarkerEntry{
				Type: "checks_read", Pass: 2, Findings: -1, Passed: 3, Total: 5, Failed: []string{"lint"}, Conflict: true,
			}),
		},
		"draft_approved": {
			marker: &session.MarkerEntry{Type: session.MarkerDraftApproved, Title: "Add login"},
			want:   markerDTO(bindings.MarkerEntry{Type: "draft_approved", Findings: -1, Title: "Add login"}),
		},
		"changes_approved": {
			marker: &session.MarkerEntry{Type: session.MarkerChangesApproved, Files: 4},
			want:   markerDTO(bindings.MarkerEntry{Type: "changes_approved", Findings: -1, Files: 4}),
		},
		"paused": {
			marker: &session.MarkerEntry{Type: session.MarkerPaused},
			want:   markerDTO(bindings.MarkerEntry{Type: "paused", Findings: -1}),
		},
		"plan_invalid": {
			marker: &session.MarkerEntry{
				Type: session.MarkerPlanInvalid, Problems: []session.PlanProblem{{File: "01-a.md", Message: "no title"}},
			},
			want: markerDTO(bindings.MarkerEntry{
				Type: "plan_invalid", Findings: -1, Problems: []bindings.PlanProblem{{File: "01-a.md", Message: "no title"}},
			}),
		},
		"review_started": {
			marker: &session.MarkerEntry{Type: session.MarkerReviewStarted, Model: "opus-5-5", Effort: "high", Mode: "publish"},
			want: markerDTO(bindings.MarkerEntry{
				Type: "review_started", Findings: -1, Model: "opus-5-5", Effort: "high", Mode: "publish",
			}),
		},
		"pr_review_revised": {
			marker: &session.MarkerEntry{Type: session.MarkerPRReviewRevised, Pass: 2, Findings: new(3)},
			want:   markerDTO(bindings.MarkerEntry{Type: "pr_review_revised", Pass: 2, Findings: 3}),
		},
		"findings_decided": {
			marker: &session.MarkerEntry{Type: session.MarkerFindingsDecided, Pass: 2, Approved: 2, Discarded: 1},
			want:   markerDTO(bindings.MarkerEntry{Type: "findings_decided", Pass: 2, Findings: -1, Approved: 2, Discarded: 1}),
		},
		"review_published": {
			marker: &session.MarkerEntry{
				Type: session.MarkerReviewPublished, Pass: 2, Verdict: "comment", Inline: 2, Body: 1, Summary: true,
				Minimal: false, URL: "https://github.com/acme/api/pull/7#pullrequestreview-1",
			},
			want: markerDTO(bindings.MarkerEntry{
				Type: "review_published", Pass: 2, Findings: -1, Verdict: "comment", Inline: 2, Body: 1, Summary: true,
				URL: "https://github.com/acme/api/pull/7#pullrequestreview-1",
			}),
		},
		"new_commits": {
			marker: &session.MarkerEntry{
				Type: session.MarkerNewCommits, Count: -1,
				Commits: []session.MarkerCommit{{SHA: "c19f02e", Subject: "Fix the time zone rule", Author: "rsouza"}},
			},
			want: markerDTO(bindings.MarkerEntry{
				Type: "new_commits", Findings: -1, Count: -1,
				Commits: []bindings.MarkerCommit{{SHA: "c19f02e", Subject: "Fix the time zone rule", Author: "rsouza"}},
			}),
		},
		"discussion_started": {
			marker: &session.MarkerEntry{
				Type: session.MarkerDiscussionStarted, Model: "opus-5-5", Effort: "high",
				Board: "Roadmap", Epics: []string{"acme/web#1"},
			},
			want: markerDTO(bindings.MarkerEntry{
				Type: "discussion_started", Findings: -1, Model: "opus-5-5", Effort: "high",
				Board: "Roadmap", Epics: []string{"acme/web#1"},
			}),
		},
		"discussion_document": {
			marker: &session.MarkerEntry{Type: session.MarkerDiscussionDocument, First: true, Stamp: "1-2"},
			want:   markerDTO(bindings.MarkerEntry{Type: "discussion_document", Findings: -1, First: true}),
		},
		"drafts_written": {
			marker: &session.MarkerEntry{Type: session.MarkerDraftsWritten, Round: 2, Count: 3},
			want:   markerDTO(bindings.MarkerEntry{Type: "drafts_written", Findings: -1, Round: 2, Count: 3}),
		},
		"drafts_revised": {
			marker: &session.MarkerEntry{
				Type: session.MarkerDraftsRevised, Round: 1, Changed: 1, Added: 1, Dropped: 1,
				Before: []session.DraftBefore{
					{Title: "Export invoices", Kind: "new", Decision: "approved", Changes: []string{"title"}, ApprovalCleared: true},
					{Title: "Invoice schema", Kind: "update", Dropped: true},
					{Title: "Audit log", Kind: "new", Added: true},
				},
			},
			want: markerDTO(bindings.MarkerEntry{
				Type: "drafts_revised", Findings: -1, Round: 1, Changed: 1, Added: 1, Dropped: 1,
				Before: []bindings.DraftBefore{
					{Title: "Export invoices", Kind: "new", Decision: "approved", Changes: []string{"title"}, ApprovalCleared: true},
					{Title: "Invoice schema", Kind: "update", Changes: []string{}, Dropped: true},
					{Title: "Audit log", Kind: "new", Changes: []string{}, Added: true},
				},
			}),
		},
		"drafts_unreadable": {
			marker: &session.MarkerEntry{Type: session.MarkerDraftsUnreadable, Round: 1, Reason: "It has no title."},
			want: markerDTO(bindings.MarkerEntry{
				Type: "drafts_unreadable", Findings: -1, Round: 1, Reason: "It has no title.",
			}),
		},
		"drafts_published": {
			marker: &session.MarkerEntry{Type: session.MarkerDraftsPublished, Round: 2},
			want:   markerDTO(bindings.MarkerEntry{Type: "drafts_published", Findings: -1, Round: 2}),
		},
		"interrupted": {
			marker: &session.MarkerEntry{Type: session.MarkerInterrupted, InterruptedBy: "user"},
			want:   markerDTO(bindings.MarkerEntry{Type: "interrupted", Findings: -1, InterruptedBy: "user"}),
		},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			got := bindings.FromEntry(session.Entry{Kind: session.KindMarker, Marker: tc.marker})
			if diff := cmp.Diff(tc.want, got.Marker); diff != "" {
				t.Errorf("marker mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestFromEntryCarriesWhenAQuestionWasAnswered(t *testing.T) {
	t.Parallel()

	answeredAt := time.Date(2026, time.September, 6, 12, 0, 0, 0, time.UTC)
	answered := bindings.FromEntry(session.Entry{
		Kind:     session.KindQuestion,
		Question: &session.QuestionEntry{Status: session.PermissionAllowed, AnsweredAt: &answeredAt},
	})
	if got := answered.Question.AnsweredAt; got != "2026-09-06T12:00:00Z" {
		t.Errorf("AnsweredAt = %q, want 2026-09-06T12:00:00Z", got)
	}
	pending := bindings.FromEntry(session.Entry{
		Kind:     session.KindQuestion,
		Question: &session.QuestionEntry{Status: session.PermissionPending},
	})
	if got := pending.Question.AnsweredAt; got != "" {
		t.Errorf("AnsweredAt = %q, want empty while pending", got)
	}
}

func TestFromEntryCarriesTheSubagentOfAText(t *testing.T) {
	t.Parallel()

	got := bindings.FromEntry(session.Entry{
		Kind:      session.KindAssistant,
		Assistant: &session.AssistantEntry{Text: "done", Complete: true, ParentToolUseID: "toolu_1"},
	})
	want := &bindings.AssistantEntry{Text: "done", Complete: true, ParentToolUseID: "toolu_1"}
	if diff := cmp.Diff(want, got.Assistant); diff != "" {
		t.Errorf("assistant mismatch (-want +got):\n%s", diff)
	}
}

func TestFromEntryCarriesTheVerdictOfAStepReviewMarker(t *testing.T) {
	t.Parallel()

	cases := map[string]struct {
		marker *session.MarkerEntry
		want   *bindings.MarkerEntry
	}{
		"findings counted": {
			marker: &session.MarkerEntry{Type: session.MarkerStepReviewWritten, Pass: 2, Findings: new(3)},
			want:   markerDTO(bindings.MarkerEntry{Type: "step_review_written", Pass: 2, Findings: 3}),
		},
		"no findings": {
			marker: &session.MarkerEntry{Type: session.MarkerStepReviewWritten, Pass: 2, Clean: true, Findings: new(0)},
			want:   markerDTO(bindings.MarkerEntry{Type: "step_review_written", Pass: 2, Clean: true}),
		},
		"an old transcript": {
			marker: &session.MarkerEntry{Type: session.MarkerStepReviewWritten, Pass: 1},
			want:   markerDTO(bindings.MarkerEntry{Type: "step_review_written", Pass: 1, Findings: -1}),
		},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			got := bindings.FromEntry(session.Entry{Kind: session.KindMarker, Marker: tc.marker})
			if diff := cmp.Diff(tc.want, got.Marker); diff != "" {
				t.Errorf("marker mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestFromEntryCarriesTheMessageOfTheAppAndThePromptSent(t *testing.T) {
	t.Parallel()

	cases := map[string]struct {
		user *session.UserEntry
		want *bindings.UserEntry
	}{
		"a report": {
			user: &session.UserEntry{
				Text: "the report", App: true,
				AppKind: session.AppReport, AppPass: 2, AppRound: 2, AppRounds: 3, AppCount: -1,
			},
			want: &bindings.UserEntry{
				Text: "the report", App: true,
				AppKind: "report", AppPass: 2, AppRound: 2, AppRounds: 3, AppCount: -1,
			},
		},
		"a prompt": {
			user: &session.UserEntry{Prompt: true, Sent: "the rendered prompt"},
			want: &bindings.UserEntry{Prompt: true, Sent: "the rendered prompt"},
		},
		"an old transcript": {
			user: &session.UserEntry{Text: "commit", App: true},
			want: &bindings.UserEntry{Text: "commit", App: true},
		},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			got := bindings.FromEntry(session.Entry{Kind: session.KindUser, User: tc.user})
			if diff := cmp.Diff(tc.want, got.User); diff != "" {
				t.Errorf("user mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestFromTasksPicksTheSessionOfTheStageTheTaskIsIn(t *testing.T) {
	t.Parallel()

	summaries := map[session.Key]session.Summary{
		{TaskID: "task-1", Stage: "prd"}:    {Status: session.StatusWorking, PendingCount: 2},
		{TaskID: "task-2", Stage: "plan"}:   {Status: session.StatusPaused},
		{TaskID: "task-2", Stage: "step:2"}: {Status: session.StatusNeedsPermission, ContextPercent: 40},
	}
	states := []flow.StepState{
		{Step: task.Step{Number: 1}, Status: flow.StepDone},
		{Step: task.Step{Number: 2}, Status: flow.StepImplementing},
	}

	got := bindings.FromTasks(
		[]task.Task{
			{ID: "task-1", Stage: task.StagePRD},
			{ID: "task-2", Stage: task.StageImplementation},
		},
		func(string) task.Artifacts { return task.Artifacts{} },
		func(id string) []flow.StepState {
			if id == "task-2" {
				return states
			}
			return nil
		},
		noPR,
		noWorktree,
		noConversations,
		repoOf,
		summaries,
		nil,
	)
	if len(got) != 2 {
		t.Fatalf("len(FromTasks()) = %d, want 2", len(got))
	}
	if got[0].SessionStatus != "working" || got[0].PendingCount != 2 {
		t.Errorf("task-1 = %+v, want the session of its own stage", got[0])
	}
	// The implementing task is shown through the session of the step that
	// runs, never through the one the planning stage left behind.
	if got[1].SessionStatus != "needs_permission" || got[1].ContextPercent != 40 {
		t.Errorf("task-2 = %+v, want the session of step 2", got[1])
	}
}

func TestFromTasksLeavesAnImplementingTaskWithoutAStepAtRest(t *testing.T) {
	t.Parallel()

	summaries := map[session.Key]session.Summary{
		{TaskID: "task-1", Stage: "step:1"}: {Status: session.StatusWorking},
	}
	states := []flow.StepState{{Step: task.Step{Number: 1}, Status: flow.StepDone}}

	got := bindings.FromTasks(
		[]task.Task{{ID: "task-1", Stage: task.StageImplementation}},
		func(string) task.Artifacts { return task.Artifacts{} },
		func(string) []flow.StepState { return states },
		noPR,
		noWorktree,
		noConversations,
		repoOf,
		summaries,
		nil,
	)
	if got[0].SessionStatus != "waiting" {
		t.Errorf("sessionStatus = %q, want waiting: every step is committed", got[0].SessionStatus)
	}
}

func TestFromTasksCarriesThePullRequestOfThePRStage(t *testing.T) {
	t.Parallel()

	checkedAt := time.Date(2026, 9, 5, 10, 0, 0, 0, time.UTC)
	pr := flow.PullRequest{
		Status:       flow.PRReadyToApprove,
		WorktreePath: "/data/worktrees/dev/web/login-screen",
		Branch:       "login-screen",
		BaseBranch:   "origin/dev",
		Draft:        &task.Draft{Present: true, Title: "Add the login screen", Body: "It adds the screen."},
		Reports:      []task.ReviewReport{{Pass: 1, File: "review-1.md", Clean: false}},
		Review:       &review.Snapshot{Staged: 2, Total: 2},
		PR: task.PRDetails{
			Number: 7, URL: "https://github.com/acme/api/pull/7", State: task.PRStateOpen, CheckedAt: checkedAt,
		},
		SessionStage: session.PRReviewStage,
		Session: session.Summary{
			Status:         session.StatusWaiting,
			ContextPercent: 30,
			Choice:         models.Choice{Model: models.Opus55, Effort: models.Medium},
		},
	}

	got := bindings.FromTasks(
		[]task.Task{{ID: "task-1", RepositoryID: convertRepo.ID, Name: "login-screen", Stage: task.StagePR}},
		func(string) task.Artifacts { return task.Artifacts{} },
		func(string) []flow.StepState { return nil },
		func(string) (flow.PullRequest, bool) { return pr, true },
		noWorktree,
		noConversations,
		repoOf,
		map[session.Key]session.Summary{
			{TaskID: "task-1", Stage: session.PRReviewStage}: {Status: session.StatusWaiting},
		},
		nil,
	)
	if len(got) != 1 {
		t.Fatalf("len(FromTasks()) = %d, want 1", len(got))
	}

	want := &bindings.PullRequest{
		Status:       "ready_to_approve",
		WorktreePath: "/data/worktrees/dev/web/login-screen",
		Branch:       "login-screen",
		BaseBranch:   "origin/dev",
		Draft: &bindings.PRDraft{
			Title: "Add the login screen", Body: "It adds the screen.", File: "draft.md",
		},
		Reports: []bindings.PRReport{{Pass: 1, File: "review-1.md", Findings: []bindings.ReviewFinding{}}},
		Review: &bindings.Review{
			Files: []bindings.ReviewFile{}, Staged: 2, Total: 2, Percent: 100,
		},
		PRNumber:       7,
		PRURL:          "https://github.com/acme/api/pull/7",
		PRState:        "open",
		CheckedAt:      "2026-09-05T10:00:00Z",
		Trouble:        bindings.PRTrouble{FailedChecks: []string{}},
		Checks:         []bindings.PRCheck{},
		SessionStage:   "pr_review",
		SessionStatus:  "waiting",
		SessionModel:   "claude-opus-5-5[1m]",
		SessionEffort:  "medium",
		ContextPercent: 30,
	}
	if diff := cmp.Diff(want, got[0].PR); diff != "" {
		t.Errorf("pull request mismatch (-want +got):\n%s", diff)
	}
	if got[0].Repository != "dev/web" || got[0].RepositoryID != convertRepo.ID {
		t.Errorf("task = %+v, want the repository it belongs to", got[0])
	}
	// The PR stage has no conversation of its own: both of them belong to the
	// pull request, and the fields of the task stay empty.
	if got[0].SessionStatus != "waiting" || got[0].ContextPercent != 0 {
		t.Errorf("task = %+v, want no session of its own", got[0])
	}
}

func TestFromTasksCarriesTheModelsOfEveryStage(t *testing.T) {
	t.Parallel()

	tasks := []task.Task{{
		ID:    "task-1",
		Name:  "login-screen",
		Stage: task.StageTechSpec,
		Models: task.Models{Stages: models.Set{
			models.PRD:            {Model: models.Fable51, Effort: models.XHigh},
			models.TechSpec:       {Model: models.Fable51, Effort: models.High},
			models.Plan:           {Model: models.Fable51, Effort: models.High},
			models.Implementation: {Model: models.Opus55, Effort: models.High},
			models.StepReview:     {Model: models.Opus55, Effort: models.High},
			models.PR:             {Model: models.Opus55, Effort: models.Medium},
			models.PRReview:       {Model: models.Sonnet5, Effort: models.Low},
		}},
	}}

	got := bindings.FromTasks(
		tasks,
		func(string) task.Artifacts { return task.Artifacts{} },
		func(string) []flow.StepState { return nil },
		noPR,
		noWorktree,
		noConversations,
		repoOf,
		map[session.Key]session.Summary{
			{TaskID: "task-1", Stage: "tech_spec"}: {
				Status: session.StatusWaiting,
				Choice: models.Choice{Model: models.Fable51, Effort: models.High},
			},
		},
		nil,
	)
	if len(got) != 1 {
		t.Fatalf("len(FromTasks()) = %d, want 1", len(got))
	}

	// The task is in the tech spec: its session is the live one, and only the
	// stages that come after it can still be changed.
	want := []bindings.TaskStageModel{
		{Stage: "prd", Model: "claude-fable-5-1", Effort: "xhigh"},
		{Stage: "tech_spec", Model: "claude-fable-5-1", Effort: "high", Live: true},
		{Stage: "plan", Model: "claude-fable-5-1", Effort: "high", Editable: true},
		{Stage: "implementation", Model: "claude-opus-5-5[1m]", Effort: "high", Editable: true},
		{Stage: "step_review", Model: "claude-opus-5-5[1m]", Effort: "high", Editable: true},
		{Stage: "pr", Model: "claude-opus-5-5[1m]", Effort: "medium", Editable: true},
		{Stage: "pr_review", Model: "claude-sonnet-5", Effort: "low", Editable: true},
	}
	if diff := cmp.Diff(want, got[0].Models); diff != "" {
		t.Errorf("models mismatch (-want +got):\n%s", diff)
	}
	if got[0].SessionModel != "claude-fable-5-1" || got[0].SessionEffort != "high" {
		t.Errorf("session choice = %q %q, want the one of the tech spec session",
			got[0].SessionModel, got[0].SessionEffort)
	}
}

func TestFromModelSetIsInTheOrderOfTheSettings(t *testing.T) {
	t.Parallel()

	want := []bindings.StageModel{
		{Stage: "prd", Model: "claude-fable-5-1", Effort: "high"},
		{Stage: "tech_spec", Model: "claude-fable-5-1", Effort: "high"},
		{Stage: "plan", Model: "claude-fable-5-1", Effort: "high"},
		{Stage: "one_shot", Model: "claude-fable-5-1", Effort: "high"},
		{Stage: "implementation", Model: "claude-opus-5-5[1m]", Effort: "high"},
		{Stage: "step_review", Model: "claude-opus-5-5[1m]", Effort: "high"},
		{Stage: "pr", Model: "claude-opus-5-5[1m]", Effort: "medium"},
		{Stage: "pr_review", Model: "claude-opus-5-5[1m]", Effort: "high"},
		{Stage: "discussion", Model: "claude-fable-5-1", Effort: "high"},
	}

	if diff := cmp.Diff(want, bindings.FromModelSet(models.Factory())); diff != "" {
		t.Errorf("FromModelSet() mismatch (-want +got):\n%s", diff)
	}
}

func TestFromCatalogConvertsEveryModelWithItsEfforts(t *testing.T) {
	t.Parallel()

	catalog := models.CatalogFrom(claudetest.Catalog)

	want := bindings.ModelCatalog{Models: []bindings.CatalogModel{
		{Name: "claude-opus-5-5[1m]", Efforts: []string{"low", "medium", "high", "xhigh", "max"}},
		{Name: "claude-fable-5-1", Efforts: []string{"low", "medium", "high", "xhigh", "max"}},
		{Name: "claude-sonnet-5", Efforts: []string{"low", "medium", "high", "xhigh", "max"}},
		{Name: "claude-haiku-4-5-20251001", Efforts: []string{}},
	}}

	if diff := cmp.Diff(want, bindings.FromCatalog(catalog, "")); diff != "" {
		t.Errorf("FromCatalog() mismatch (-want +got):\n%s", diff)
	}
}

func TestFromCatalogOfNothingIsEmptyAndNotNil(t *testing.T) {
	t.Parallel()

	got := bindings.FromCatalog(models.Catalog{}, models.CatalogNotFound)

	want := bindings.ModelCatalog{Models: []bindings.CatalogModel{}, Failure: "not_found"}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("FromCatalog() mismatch (-want +got):\n%s", diff)
	}
}

func TestFromPromptAllocatesThePlaceholders(t *testing.T) {
	t.Parallel()

	got := bindings.FromPrompt(prompts.Prompt{
		Stage:    prompts.StageCommit,
		Text:     "Commit what is staged.",
		Modified: true,
	})
	want := bindings.Prompt{
		Stage:        "commit",
		Text:         "Commit what is staged.",
		Modified:     true,
		Placeholders: []string{},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("FromPrompt() mismatch (-want +got):\n%s", diff)
	}
	// The frontend maps over the placeholders without checking for null.
	if got.Placeholders == nil {
		t.Error("placeholders = nil, want an empty slice")
	}
}

func TestFromTasksCarriesTheSituationsOfEachTask(t *testing.T) {
	t.Parallel()

	startedAt := time.Date(2026, 9, 11, 9, 30, 0, 0, time.UTC)
	situations := map[string][]attention.Situation{
		"task-1": {{
			ID:        "s1",
			TaskID:    "task-1",
			Place:     attention.Place{Kind: attention.PlaceStage, Stage: task.StageTechSpec},
			Kind:      attention.KindReply,
			StartedAt: startedAt,
		}},
		"task-2": {
			{
				ID:        "s2",
				TaskID:    "task-2",
				Place:     attention.Place{Kind: attention.PlacePR},
				Kind:      attention.KindPRBlocked,
				StartedAt: startedAt.Add(time.Minute),
			},
			{
				ID:        "s3",
				TaskID:    "task-2",
				Place:     attention.Place{Kind: attention.PlacePR},
				Kind:      attention.KindChangesReview,
				Form:      attention.FormStaged,
				Percent:   50,
				StartedAt: startedAt,
			},
		},
	}

	got := bindings.FromTasks(
		[]task.Task{
			{ID: "task-1", Name: "login-screen", Stage: task.StageTechSpec},
			{ID: "task-2", Name: "sign-up", Stage: task.StagePR},
			{ID: "task-3", Name: "dark-mode", Stage: task.StagePRD},
		},
		func(string) task.Artifacts { return task.Artifacts{} },
		func(string) []flow.StepState { return nil },
		noPR,
		noWorktree,
		noConversations,
		repoOf,
		nil,
		situations,
	)
	if len(got) != 3 {
		t.Fatalf("len(FromTasks()) = %d, want 3", len(got))
	}

	want := [][]bindings.Situation{
		{{
			ID:        "s1",
			TaskID:    "task-1",
			Kind:      "reply",
			Group:     "waiting",
			Place:     bindings.Place{Kind: "stage", Stage: "tech_spec"},
			StartedAt: "2026-09-11T09:30:00Z",
		}},
		{
			{
				ID:        "s2",
				TaskID:    "task-2",
				Kind:      "pr_blocked",
				Group:     "error",
				Place:     bindings.Place{Kind: "pr"},
				StartedAt: "2026-09-11T09:31:00Z",
			},
			{
				ID:        "s3",
				TaskID:    "task-2",
				Kind:      "changes_review",
				Group:     "waiting",
				Form:      "staged",
				Percent:   50,
				Place:     bindings.Place{Kind: "pr"},
				StartedAt: "2026-09-11T09:30:00Z",
			},
		},
		{},
	}
	for i, summary := range got {
		if diff := cmp.Diff(want[i], summary.Situations); diff != "" {
			t.Errorf("situations of %s mismatch (-want +got):\n%s", summary.ID, diff)
		}
	}
	// The frontend maps over the situations of every task without checking for
	// null.
	if got[2].Situations == nil {
		t.Error("situations of a task without any = nil, want an empty slice")
	}
}

func TestFromStartedCarriesTheFocus(t *testing.T) {
	t.Parallel()

	situation := attention.Situation{
		ID:        "s1",
		TaskID:    "task-1",
		Place:     attention.Place{Kind: attention.PlaceStep, Step: 3},
		Kind:      attention.KindStepReview,
		Form:      attention.FormReview,
		StartedAt: time.Date(2026, 9, 11, 9, 30, 0, 0, time.UTC),
	}
	converted := bindings.Situation{
		ID:        "s1",
		TaskID:    "task-1",
		Kind:      "step_review",
		Group:     "waiting",
		Form:      "review",
		Place:     bindings.Place{Kind: "step", Step: 3},
		StartedAt: "2026-09-11T09:30:00Z",
	}

	tests := []struct {
		name    string
		focused bool
	}{
		{"with the window in front", true},
		{"with the window away", false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			got := bindings.FromStarted(attention.Started{Situation: situation, Focused: test.focused})
			want := bindings.SituationStarted{Situation: converted, Focused: test.focused}
			if diff := cmp.Diff(want, got); diff != "" {
				t.Errorf("FromStarted() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestRefusedStateCarriesTheCasesAndNothingElse(t *testing.T) {
	t.Parallel()

	refused := &upgrade.RefusedError{Cases: []upgrade.Case{
		{
			Kind:    upgrade.CaseRootTask,
			Entries: []upgrade.Entry{{Task: "whole-product", Workspace: "/home/dev/work"}},
		},
		{
			Kind:       upgrade.CaseNoOrigin,
			Repository: "/home/dev/work/web",
			Detail:     "/home/dev/work/web has no origin remote.",
			Entries: []upgrade.Entry{
				{Task: "login-screen", Workspace: "/home/dev/work", Path: "/home/dev/work/web"},
			},
		},
	}}

	got := bindings.RefusedState(refused)

	want := bindings.State{
		Migration: &bindings.Migration{Cases: []bindings.MigrationCase{
			{
				Kind:  "root_task",
				Tasks: []bindings.MigrationTask{{Name: "whole-product", Workspace: "/home/dev/work"}},
			},
			{
				Kind:       "no_origin",
				Repository: "/home/dev/work/web",
				Detail:     "/home/dev/work/web has no origin remote.",
				Tasks: []bindings.MigrationTask{
					{Name: "login-screen", Workspace: "/home/dev/work", Path: "/home/dev/work/web"},
				},
			},
		}},
		Repositories:  []bindings.Repository{},
		Boards:        []bindings.Board{},
		Theme:         "system",
		ModelDefaults: []bindings.StageModel{},
		ModelCatalog:  bindings.ModelCatalog{Models: []bindings.CatalogModel{}},
		Tasks:         []bindings.TaskSummary{},
		History:       []bindings.ArchivedTask{},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("RefusedState() mismatch (-want +got):\n%s", diff)
	}
}

func TestFromCandidatesCarriesTheIdentityAndWhetherItIsRegistered(t *testing.T) {
	t.Parallel()

	candidates := []repository.Candidate{
		{Identity: repository.Identity{Owner: "dev", Name: "api"}, Path: "/home/dev/api"},
		{Identity: repository.Identity{Owner: "dev", Name: "web"}, Path: "/home/dev/web", Registered: true},
	}

	want := []bindings.RepositoryCandidate{
		{Owner: "dev", Name: "api", FullName: "dev/api", Path: "/home/dev/api"},
		{Owner: "dev", Name: "web", FullName: "dev/web", Path: "/home/dev/web", Registered: true},
	}
	if diff := cmp.Diff(want, bindings.FromCandidates(candidates)); diff != "" {
		t.Errorf("FromCandidates() mismatch (-want +got):\n%s", diff)
	}
	if got := bindings.FromCandidates(nil); got == nil {
		t.Error("FromCandidates(nil) = nil, want an empty slice")
	}
}

// readAt is the instant the boards of the conversion tests were read at.
var readAt = time.Date(2026, time.September, 16, 12, 0, 0, 0, time.UTC)

// roadmap is the board the conversion tests convert, with Done as its final
// status.
var roadmap = board.Board{
	ID:            "board-1",
	Owner:         "acme",
	OwnerType:     board.OwnerOrganization,
	Number:        3,
	Title:         "Roadmap",
	URL:           "https://github.com/orgs/acme/projects/3",
	FinalStatuses: []string{"done"},
}

// boardCard is an open card of acme/<repo> numbered number, in Todo, with no
// slice set.
func boardCard(repo string, number int) board.Card {
	return board.Card{
		Issue: board.Issue{
			Owner: "acme", Name: repo, Number: number, Title: "Add login",
			URL: "https://github.com/acme/" + repo + "/issues/1", State: task.IssueOpen,
		},
		StatusID: "todo",
		Status:   "Todo",
		ReadAt:   readAt,
	}
}

// convertBoard converts roadmap with a reading of cards, next to the
// repositories given, the missing clones and the tasks of the cards.
func convertBoard(
	cards []board.Card,
	repositories []repository.Repository,
	missing map[string]bool,
	cardTasks map[string]task.CardTaskIDs,
	others ...board.Board,
) bindings.Board {
	reading := &board.Reading{
		Title:     "Roadmap",
		Viewer:    "dev",
		HasStatus: true,
		Statuses:  []board.Option{{ID: "todo", Name: "Todo"}, {ID: "done", Name: "Done"}},
		Cards:     cards,
	}
	got := bindings.FromBoards(
		append([]board.Board{roadmap}, others...),
		func(id string) board.Stored {
			if id != roadmap.ID {
				return board.Stored{}
			}
			return board.Stored{Reading: reading, ReadAt: readAt}
		},
		func(string) bool { return false },
		repositories,
		func(id string) bool { return missing[id] },
		cardTasks,
		map[string]discussion.Writer{},
	)
	return got[0]
}

func TestFromBoardsDecidesWhatStartTaskDoesForEachCard(t *testing.T) {
	t.Parallel()

	other := board.Board{ID: "board-2", Title: "Platform", FinalStatuses: []string{}}
	repositories := []repository.Repository{
		{ID: "r-start", Owner: "acme", Name: "start", Path: "/src/start", BoardID: roadmap.ID},
		{ID: "r-case", Owner: "ACME", Name: "Case", Path: "/src/case", BoardID: roadmap.ID},
		{ID: "r-clone", Owner: "acme", Name: "clone", BoardID: roadmap.ID},
		{ID: "r-missing", Owner: "acme", Name: "missing", Path: "/src/missing", BoardID: roadmap.ID},
		{ID: "r-free", Owner: "acme", Name: "free", Path: "/src/free"},
		{ID: "r-other", Owner: "acme", Name: "other", Path: "/src/other", BoardID: other.ID},
	}
	closed := boardCard("start", 2)
	closed.State = task.IssueClosed
	tests := []struct {
		name           string
		card           board.Card
		wantAction     string
		wantOtherBoard string
		wantRepository string
	}{
		{"a card with an active task", boardCard("start", 1), "has_task", "", "r-start"},
		{"a closed issue", closed, "closed", "", "r-start"},
		{"a repository nobody registered", boardCard("unknown", 3), "add_to_board", "", ""},
		{"a repository without a board", boardCard("free", 4), "add_to_board", "", "r-free"},
		{"a repository of another board", boardCard("other", 5), "other_board", "Platform", "r-other"},
		{"a repository without a clone", boardCard("clone", 6), "clone", "", "r-clone"},
		{"a clone that is missing", boardCard("missing", 7), "clone_missing", "", "r-missing"},
		{"a repository ready to work in", boardCard("start", 8), "start", "", "r-start"},
		{"a repository named in another case", boardCard("case", 9), "start", "", "r-case"},
	}
	cards := make([]board.Card, len(tests))
	for i, tt := range tests {
		cards[i] = tt.card
	}
	got := convertBoard(
		cards, repositories, map[string]bool{"r-missing": true},
		map[string]task.CardTaskIDs{"acme/start#1": {Active: "task-1"}}, other,
	)

	for i, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			card := got.Cards[i]
			if card.Action != tt.wantAction || card.OtherBoard != tt.wantOtherBoard {
				t.Errorf("action = %q, %q, want %q, %q", card.Action, card.OtherBoard, tt.wantAction, tt.wantOtherBoard)
			}
			if card.RepositoryID != tt.wantRepository {
				t.Errorf("repositoryId = %q, want %q", card.RepositoryID, tt.wantRepository)
			}
		})
	}
}

func TestFromBoardsMarksACardFinalByItsStatusOrItsClosedIssue(t *testing.T) {
	t.Parallel()

	done := boardCard("web", 1)
	done.StatusID, done.Status = "done", "Done"
	closed := boardCard("web", 2)
	closed.State = task.IssueClosed
	open := boardCard("web", 3)

	got := convertBoard([]board.Card{done, closed, open}, nil, nil, nil)

	finals := []bool{got.Cards[0].Final, got.Cards[1].Final, got.Cards[2].Final}
	if diff := cmp.Diff([]bool{true, true, false}, finals); diff != "" {
		t.Errorf("final mismatch (-want +got):\n%s", diff)
	}
	wantStatuses := []bindings.BoardStatus{{ID: "todo", Name: "Todo"}, {ID: "done", Name: "Done", Final: true}}
	if diff := cmp.Diff(wantStatuses, got.Statuses); diff != "" {
		t.Errorf("statuses mismatch (-want +got):\n%s", diff)
	}
}

func TestFromBoardsCarriesTheCardWithItsRelationsAndTasks(t *testing.T) {
	t.Parallel()

	card := boardCard("web", 12)
	card.Title = "Add the login screen"
	card.Body = "The body."
	card.Assignees = []board.Assignee{{Login: "dev", AvatarURL: "https://avatars/dev"}}
	card.Fields = []board.Field{{Name: "Size", Value: "M"}}
	card.PullRequests = []board.PullRequest{
		{Owner: "acme", Name: "web", Number: 40, URL: "https://github.com/acme/web/pull/40", State: board.PRMerged},
	}
	card.Epic = &board.Epic{
		Issue: board.Issue{Owner: "acme", Name: "web", Number: 1, Title: "Auth", URL: "https://e", State: task.IssueOpen},
		Body:  "The epic.",
	}
	card.Siblings = []board.Related{{
		Issue:  board.Issue{Owner: "acme", Name: "web", Number: 13, Title: "Logout", URL: "https://s", State: task.IssueOpen},
		Status: "Todo", OnBoard: true,
	}}
	card.Dependencies = []board.Dependency{{
		Related: board.Related{
			Issue: board.Issue{Owner: "acme", Name: "api", Number: 7, Title: "Tokens", URL: "https://d", State: task.IssueClosed},
		},
		Satisfied: true,
	}}
	repositories := []repository.Repository{
		{ID: "r-web", Owner: "acme", Name: "web", Path: "/src/web", BoardID: roadmap.ID},
		{ID: "r-other", Owner: "acme", Name: "api", Path: "/src/api"},
	}

	got := convertBoard(
		[]board.Card{card}, repositories, nil,
		map[string]task.CardTaskIDs{"acme/web#12": {Archived: "task-0"}},
	)

	want := bindings.Board{
		ID: "board-1", Owner: "acme", OwnerType: "organization", Number: 3, Title: "Roadmap",
		URL:       "https://github.com/orgs/acme/projects/3",
		HasStatus: true,
		Statuses: []bindings.BoardStatus{
			{ID: "todo", Name: "Todo"}, {ID: "done", Name: "Done", Final: true},
		},
		RepositoryIDs: []string{"r-web"},
		ReadAt:        "2026-09-16T12:00:00Z",
		Viewer:        "dev",
		Cards: []bindings.BoardCard{{
			CardIssue: bindings.CardIssue{
				Key: "acme/web#12", Repository: "acme/web", Number: 12, Title: "Add the login screen",
				URL: "https://github.com/acme/web/issues/1", State: "open",
			},
			Body: "The body.", StatusID: "todo", Status: "Todo",
			Assignees: []bindings.CardAssignee{{Login: "dev", AvatarURL: "https://avatars/dev"}},
			Fields:    []bindings.CardField{{Name: "Size", Value: "M"}},
			PullRequests: []bindings.CardPullRequest{
				{Repository: "acme/web", Number: 40, URL: "https://github.com/acme/web/pull/40", State: "merged"},
			},
			Epic: &bindings.CardIssue{
				Key: "acme/web#1", Repository: "acme/web", Number: 1, Title: "Auth", URL: "https://e", State: "open",
			},
			EpicBody: "The epic.",
			Siblings: []bindings.CardRelated{{
				CardIssue: bindings.CardIssue{
					Key: "acme/web#13", Repository: "acme/web", Number: 13, Title: "Logout", URL: "https://s", State: "open",
				},
				Status: "Todo", OnBoard: true,
			}},
			Dependencies: []bindings.CardDependency{{
				CardRelated: bindings.CardRelated{CardIssue: bindings.CardIssue{
					Key: "acme/api#7", Repository: "acme/api", Number: 7, Title: "Tokens", URL: "https://d", State: "closed",
				}},
				PullRequests: []bindings.CardPullRequest{},
				Satisfied:    true,
			}},
			ReadAt:         "2026-09-16T12:00:00Z",
			SuggestedName:  "12-add-the-login-screen",
			RepositoryID:   "r-web",
			ArchivedTaskID: "task-0",
			Action:         "start",
		}},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("FromBoards() mismatch (-want +got):\n%s", diff)
	}
}

func TestFromBoardsSaysTheDiscussionThatWroteACard(t *testing.T) {
	t.Parallel()

	written, archived, alone := boardCard("web", 1), boardCard("web", 2), boardCard("web", 3)
	reading := &board.Reading{Title: "Roadmap", Cards: []board.Card{written, archived, alone}}
	writers := map[string]discussion.Writer{
		written.Key():  {ID: "d-1", Title: "Usage tiers"},
		archived.Key(): {ID: "d-2", Title: "Old plan", Archived: true},
	}

	got := bindings.FromBoards(
		[]board.Board{roadmap},
		func(string) board.Stored { return board.Stored{Reading: reading, ReadAt: readAt} },
		func(string) bool { return false },
		nil, func(string) bool { return false }, nil, writers,
	)[0]

	want := []*bindings.WritingDiscussion{
		{ID: "d-1", Title: "Usage tiers"},
		{ID: "d-2", Title: "Old plan", Archived: true},
		nil,
	}
	writtenBy := make([]*bindings.WritingDiscussion, 0, len(got.Cards))
	for _, card := range got.Cards {
		writtenBy = append(writtenBy, card.WrittenBy)
	}
	if diff := cmp.Diff(want, writtenBy); diff != "" {
		t.Errorf("WrittenBy mismatch (-want +got):\n%s", diff)
	}
}

func TestFromBoardsNeverHandsTheFrontendNull(t *testing.T) {
	t.Parallel()

	failed := &board.Failure{Reason: board.ReasonNotFound}
	got := bindings.FromBoards(
		[]board.Board{roadmap},
		func(string) board.Stored { return board.Stored{Failure: failed, FailedAt: readAt} },
		func(string) bool { return true },
		nil, func(string) bool { return false }, nil,
		map[string]discussion.Writer{},
	)

	want := []bindings.Board{{
		ID: "board-1", Owner: "acme", OwnerType: "organization", Number: 3, Title: "Roadmap",
		URL:           "https://github.com/orgs/acme/projects/3",
		Statuses:      []bindings.BoardStatus{},
		RepositoryIDs: []string{},
		Reading:       true,
		Failure: &bindings.BoardFailure{
			Reason:   "not_found",
			Message:  "The board doesn't exist or this account can't read it. Check the number and that this account can see the project.",
			FailedAt: "2026-09-16T12:00:00Z",
		},
		Cards: []bindings.BoardCard{},
	}}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("FromBoards() without a reading mismatch (-want +got):\n%s", diff)
	}

	card := convertBoard([]board.Card{boardCard("web", 1)}, nil, nil, nil).Cards[0]
	if card.Assignees == nil || card.Fields == nil || card.PullRequests == nil ||
		card.Siblings == nil || card.Dependencies == nil {
		t.Errorf("card = %+v, want every list allocated", card)
	}
	if empty := bindings.FromBoards(nil, nil, nil, nil, nil, nil, nil); empty == nil {
		t.Error("FromBoards(nil) = nil, want an empty slice")
	}
}

func TestFromRepositoriesCarriesTheBoardAndTheCloneOfARepositoryWithoutOne(t *testing.T) {
	t.Parallel()

	list := []repository.Repository{
		{ID: "r-1", Owner: "acme", Name: "web", BoardID: "board-1"},
		{ID: "r-2", Owner: "acme", Name: "api", Path: "/src/api"},
	}
	got := bindings.FromRepositories(
		list,
		func(string) bool { return true },
		func(string) (int, int) { return 0, 0 },
		func(string) (int, int) { return 0, 0 },
		func(id string) (bool, string) { return id == "r-1", map[string]string{"r-1": "exit status 1"}[id] },
	)

	want := []bindings.Repository{
		{
			ID: "r-1", Owner: "acme", Name: "web", FullName: "acme/web",
			BoardID: "board-1", Cloning: true, CloneError: "exit status 1",
		},
		{
			ID: "r-2", Owner: "acme", Name: "api", FullName: "acme/api", Path: "/src/api",
			Missing: true, Cloned: true,
		},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("FromRepositories() mismatch (-want +got):\n%s", diff)
	}
}

func TestFromTasksAndFromArchivedCarryTheCardOfTheTask(t *testing.T) {
	t.Parallel()

	card := &task.Card{
		BoardID: "board-1", Owner: "Acme", Name: "Web", Number: 12, Title: "Add login",
		URL: "https://github.com/acme/web/issues/12", Status: "In progress", State: task.IssueOpen,
		Epic: &task.CardEpic{Owner: "acme", Name: "web", Number: 1, Title: "Auth", URL: "https://e"},
	}
	tasks := []task.Task{
		{ID: "task-1", Name: "with-card", Stage: task.StagePRD, Card: card},
		{ID: "task-2", Name: "without-card", Stage: task.StagePRD},
	}
	want := &bindings.TaskCard{
		BoardID: "board-1", Key: "acme/web#12", Repository: "Acme/Web", Number: 12, Title: "Add login",
		URL: "https://github.com/acme/web/issues/12", Status: "In progress", State: "open",
		Epic: &bindings.CardIssue{Key: "acme/web#1", Repository: "acme/web", Number: 1, Title: "Auth", URL: "https://e"},
	}

	summaries := bindings.FromTasks(
		tasks,
		func(string) task.Artifacts { return task.Artifacts{} },
		func(string) []flow.StepState { return nil },
		func(string) (flow.PullRequest, bool) { return flow.PullRequest{}, false },
		noWorktree,
		noConversations,
		func(string) (repository.Repository, bool) { return repository.Repository{}, false },
		nil, nil,
	)
	archived := bindings.FromArchived(
		tasks,
		func(string) task.Artifacts { return task.Artifacts{} },
		func(string) (task.PRRun, bool) { return task.PRRun{}, false },
		func(string) (repository.Repository, bool) { return repository.Repository{}, false },
	)

	if diff := cmp.Diff(want, summaries[0].Card); diff != "" {
		t.Errorf("summary card mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff(want, archived[0].Card); diff != "" {
		t.Errorf("archived card mismatch (-want +got):\n%s", diff)
	}
	if summaries[1].Card != nil || archived[1].Card != nil {
		t.Errorf("cards of a task without one = %+v, %+v, want nil", summaries[1].Card, archived[1].Card)
	}
}

// reviewRepos are the registered repositories the conversions of the Reviews
// view are given: one cloned, one without a clone and one whose clone is gone.
var reviewRepos = []bindings.Repository{
	{ID: "r-1", Owner: "acme", Name: "web", FullName: "acme/web", BoardID: "board-1", Cloned: true},
	{ID: "r-2", Owner: "acme", Name: "api", FullName: "acme/api"},
	{ID: "r-3", Owner: "acme", Name: "cli", FullName: "acme/cli", Cloned: true, Missing: true},
}

// openPR is an open pull request of acme/web, updated minutes after readAt so
// that the order of the rows is the order of the tests.
func openPR(number int, author string, minutes int) pulls.PullRequest {
	return pulls.PullRequest{
		Owner: "acme", Name: "web", Number: number,
		Title:     "Add the login screen",
		URL:       "https://github.com/acme/web/pull/" + strconv.Itoa(number),
		Author:    author,
		UpdatedAt: readAt.Add(time.Duration(minutes) * time.Minute),
	}
}

// noReview, noCard and noTasks are what a pull request the product knows
// nothing about is converted with.
func noReview(string, int) (prreview.Review, bool) { return prreview.Review{}, false }

func noCard(string, string, int) (string, board.Card, bool) { return "", board.Card{}, false }

var noTasks []reviewflow.TaskPR

func TestFromReviewCenterPutsThePendingPullRequestsFirstAndTheRestByTheirUpdate(t *testing.T) {
	t.Parallel()

	readings := []pulls.RepositoryReading{{
		RepositoryID: "r-1",
		PullRequests: []pulls.PullRequest{
			openPR(1, "dev", 30),   // the viewer's own: never pending
			openPR(2, "alice", 10), // pending, updated first
			openPR(3, "bob", 20),   // pending, updated last
		},
	}}

	center := bindings.FromReviewCenter(
		readings, false, readAt, "dev", pulls.Filters{}, reviewRepos, noTasks, noReview, noCard,
	)

	numbers := make([]int, 0, len(center.PullRequests))
	for _, row := range center.PullRequests {
		numbers = append(numbers, row.Number)
	}
	if diff := cmp.Diff([]int{3, 2, 1}, numbers); diff != "" {
		t.Errorf("order of the rows (-want +got):\n%s", diff)
	}
	if center.PendingCount != 2 {
		t.Errorf("pendingCount = %d, want 2", center.PendingCount)
	}
	if got := center.ReadAt; got != readAt.Format(time.RFC3339) {
		t.Errorf("readAt = %q, want the instant of the reading", got)
	}
	if own := center.PullRequests[2]; !own.Own || own.Pending {
		t.Errorf("row of the viewer's own pull request = %+v, want own and not pending", own)
	}
}

func TestFromReviewCenterSaysWhatTheButtonOfEachRowDoes(t *testing.T) {
	t.Parallel()

	fork := openPR(4, "bob", 0)
	fork.Fork = true
	uncloned, missing := openPR(5, "bob", 0), openPR(6, "bob", 0)
	uncloned.Owner, uncloned.Name = "acme", "api"
	missing.Owner, missing.Name = "acme", "cli"
	readings := []pulls.RepositoryReading{
		{RepositoryID: "r-1", PullRequests: []pulls.PullRequest{
			openPR(1, "bob", 0), openPR(2, "bob", 0), openPR(3, "bob", 0), fork,
		}},
		{RepositoryID: "r-2", PullRequests: []pulls.PullRequest{uncloned}},
		{RepositoryID: "r-3", PullRequests: []pulls.PullRequest{missing}},
	}
	tasks := []reviewflow.TaskPR{{TaskID: "task-1", RepositoryID: "r-1", Number: 2}}
	reviews := func(repositoryID string, number int) (prreview.Review, bool) {
		if repositoryID == "r-1" && number == 3 {
			return prreview.Review{ID: "review-1"}, true
		}
		return prreview.Review{}, false
	}

	center := bindings.FromReviewCenter(
		readings, false, readAt, "dev", pulls.Filters{}, reviewRepos, tasks, reviews, noCard,
	)

	want := map[int]string{
		1: "review", 2: "open_task", 3: "open_review", 4: "fork", 5: "clone", 6: "clone_missing",
	}
	for _, row := range center.PullRequests {
		if row.Action != want[row.Number] {
			t.Errorf("action of #%d = %q, want %q", row.Number, row.Action, want[row.Number])
		}
	}
	for _, row := range center.PullRequests {
		switch row.Number {
		case 2:
			if row.TaskID != "task-1" || row.Pending {
				t.Errorf("row of the pull request of a task = %+v, want task-1 and not pending", row)
			}
		case 3:
			if row.ReviewID != "review-1" {
				t.Errorf("reviewId of #3 = %q, want review-1", row.ReviewID)
			}
		}
	}
}

func TestFromReviewCenterMarksWhatTheFiltersHideAndCountsOnlyWhatIsLeft(t *testing.T) {
	t.Parallel()

	labelled := openPR(2, "bot", 0)
	labelled.Labels = []pulls.Label{{Name: "dependencies", Color: "ededed"}}
	readings := []pulls.RepositoryReading{{
		RepositoryID: "r-1",
		PullRequests: []pulls.PullRequest{openPR(1, "alice", 10), labelled},
	}}
	filters := pulls.Filters{AuthorsExclude: []string{"bot"}}

	center := bindings.FromReviewCenter(
		readings, true, time.Time{}, "dev", filters, reviewRepos, noTasks, noReview, noCard,
	)

	if center.PendingCount != 1 {
		t.Errorf("pendingCount = %d, want 1: the excluded author does not count", center.PendingCount)
	}
	if !center.Reading || center.ReadAt != "" {
		t.Errorf("center = reading %v at %q, want a reading that never landed", center.Reading, center.ReadAt)
	}
	for _, row := range center.PullRequests {
		if want := row.Number == 2; row.Filtered != want {
			t.Errorf("filtered of #%d = %v, want %v", row.Number, row.Filtered, want)
		}
	}
	if diff := cmp.Diff([]string{"alice", "bot"}, center.Authors); diff != "" {
		t.Errorf("authors (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]string{"dependencies"}, center.Labels); diff != "" {
		t.Errorf("labels (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff(bindings.FromReviewFilters(filters), center.Filters); diff != "" {
		t.Errorf("filters (-want +got):\n%s", diff)
	}
}

func TestFromReviewCenterCarriesTheFailureOfARepositoryAndTheCardOfAPullRequest(t *testing.T) {
	t.Parallel()

	readings := []pulls.RepositoryReading{
		{RepositoryID: "r-1", PullRequests: []pulls.PullRequest{openPR(1, "alice", 0)}},
		{RepositoryID: "r-2", Failure: &pulls.Failure{Reason: pulls.ReasonFailed, Detail: "exit status 1"}},
	}
	cardOf := func(owner, name string, number int) (string, board.Card, bool) {
		if owner != "acme" || name != "web" || number != 1 {
			return "", board.Card{}, false
		}
		return "board-1", board.Card{
			Issue: board.Issue{
				Owner: "acme", Name: "web", Number: 12, Title: "Add login",
				URL: "https://github.com/acme/web/issues/12",
			},
			Status: "In progress",
		}, true
	}

	center := bindings.FromReviewCenter(
		readings, false, readAt, "dev", pulls.Filters{}, reviewRepos, noTasks, noReview, cardOf,
	)

	wantFailures := []bindings.PullsFailure{{
		RepositoryID: "r-2", Repository: "acme/api", Message: "Couldn't read from GitHub: exit status 1",
	}}
	if diff := cmp.Diff(wantFailures, center.Failures); diff != "" {
		t.Errorf("failures (-want +got):\n%s", diff)
	}
	wantCard := &bindings.PullCard{
		BoardID: "board-1", Number: 12, Title: "Add login",
		URL: "https://github.com/acme/web/issues/12", Status: "In progress",
	}
	if diff := cmp.Diff(wantCard, center.PullRequests[0].Card); diff != "" {
		t.Errorf("card of the row (-want +got):\n%s", diff)
	}
	if row := center.PullRequests[0]; row.Repository != "acme/web" || row.BoardID != "board-1" {
		t.Errorf("row = %+v, want the repository and the board of acme/web", row)
	}
}

func TestFromReviewCenterAllocatesEverythingWithoutAReading(t *testing.T) {
	t.Parallel()

	center := bindings.FromReviewCenter(
		nil, false, time.Time{}, "", pulls.Filters{}, nil, nil, noReview, noCard,
	)

	if center.PullRequests == nil || center.Failures == nil || center.Authors == nil || center.Labels == nil ||
		center.Filters.AuthorsInclude == nil || center.Filters.LabelsExclude == nil {
		t.Errorf("center = %+v, want every list allocated", center)
	}
}

func TestFromReviewCenterDoesNotCountThePullRequestsThatAlreadyHaveAReview(t *testing.T) {
	t.Parallel()

	readings := []pulls.RepositoryReading{{
		RepositoryID: "r-1",
		PullRequests: []pulls.PullRequest{openPR(1, "alice", 10), openPR(2, "bob", 20)},
	}}
	reviews := func(_ string, number int) (prreview.Review, bool) {
		return prreview.Review{ID: "review-1"}, number == 1
	}

	center := bindings.FromReviewCenter(
		readings, false, readAt, "dev", pulls.Filters{}, reviewRepos, noTasks, reviews, noCard,
	)

	if center.PendingCount != 1 {
		t.Errorf("pendingCount = %d, want 1: the pull request with an active review does not count", center.PendingCount)
	}
	for _, row := range center.PullRequests {
		if !row.Pending {
			t.Errorf("pending of #%d = false, want true: the row still waits, the count is what leaves it out", row.Number)
		}
	}
}

func TestFromReviewCenterCarriesWhatTheListReadsOfEachPullRequest(t *testing.T) {
	t.Parallel()

	pr := openPR(1, "alice", 0)
	pr.HeadBranch, pr.BaseBranch, pr.Body = "login-screen", "dev", "Adds the login."
	pr.Checks = gh.PRChecks{
		Checks: []gh.Check{{
			Name: "test", URL: "https://github.com/acme/web/actions/runs/1", Conclusion: "success", State: gh.CheckPassed,
			StartedAt: readAt, CompletedAt: readAt.Add(time.Minute),
		}},
		Mergeable: gh.MergeableConflicting,
	}
	pr.Reviewed, pr.ReviewedCommit, pr.HeadCommit = true, "aaa", "bbb"
	pr.YourReview = &pulls.YourReview{State: "changes_requested", At: readAt}
	pr.NewCommitCount = -1
	bare := openPR(2, "bob", 0)
	readings := []pulls.RepositoryReading{{RepositoryID: "r-1", PullRequests: []pulls.PullRequest{pr, bare}}}

	center := bindings.FromReviewCenter(
		readings, false, readAt, "dev", pulls.Filters{}, reviewRepos, noTasks, noReview, noCard,
	)

	rowOf := func(number int) bindings.PullRequestRow {
		for _, row := range center.PullRequests {
			if row.Number == number {
				return row
			}
		}
		t.Fatalf("no row for #%d", number)
		return bindings.PullRequestRow{}
	}
	got := rowOf(1)
	wantChecks := []bindings.PRCheck{{
		Name: "test", State: "passed", Conclusion: "success", URL: "https://github.com/acme/web/actions/runs/1",
		StartedAt: readAt.Format(time.RFC3339), CompletedAt: readAt.Add(time.Minute).Format(time.RFC3339),
	}}
	if diff := cmp.Diff(wantChecks, got.Checks); diff != "" {
		t.Errorf("checks (-want +got):\n%s", diff)
	}
	wantReview := &bindings.PullReview{State: "changes_requested", At: readAt.Format(time.RFC3339)}
	if diff := cmp.Diff(wantReview, got.YourReview); diff != "" {
		t.Errorf("yourReview (-want +got):\n%s", diff)
	}
	if got.HeadBranch != "login-screen" || got.BaseBranch != "dev" || got.Body != "Adds the login." ||
		got.Mergeable != "conflicting" || got.NewCommitCount != -1 {
		t.Errorf("row = %+v, want the branches, the body, the merge and the count of the pull request", got)
	}

	none := rowOf(2)
	if none.Checks == nil || len(none.Checks) != 0 || none.YourReview != nil || none.Mergeable != "" || none.NewCommitCount != 0 {
		t.Errorf("row without a reading = %+v, want empty checks (not nil), no review and no merge", none)
	}
}

func TestFromReviewCenterSaysWhenTheRunOfFailuresStarted(t *testing.T) {
	t.Parallel()

	readings := []pulls.RepositoryReading{{
		RepositoryID: "r-2",
		Failure:      &pulls.Failure{Reason: pulls.ReasonNotFound, FailedAt: readAt},
	}}

	center := bindings.FromReviewCenter(
		readings, false, readAt, "dev", pulls.Filters{}, reviewRepos, noTasks, noReview, noCard,
	)

	if got := center.Failures[0].FailedAt; got != readAt.Format(time.RFC3339) {
		t.Errorf("failedAt = %q, want the first failing reading", got)
	}
}

func TestReviewFiltersCarryTheNamesOfTheBoardAndTheRepository(t *testing.T) {
	t.Parallel()

	got := bindings.FromReviewFilters(pulls.Filters{BoardID: "board-1", BoardName: "Web", RepositoryName: "web"})

	if got.BoardName != "Web" || got.RepositoryName != "web" {
		t.Errorf("filters = %+v, want the names of the board and the repository", got)
	}
}

// reviewState is a review of acme/web#7 in a status, with one recorded pass.
func reviewState(status reviewflow.Status, pass prreview.Pass) reviewflow.State {
	stored := prreview.Review{
		ID: "review-1", RepositoryID: "r-1", Number: 7, Title: "Add the login screen",
		Author: "alice", URL: "https://github.com/acme/web/pull/7",
		HeadBranch: "login", BaseBranch: "main", Mode: prreview.ModePublish,
		AskedPass: pass.Number, ReportedPass: pass.Number, CreatedAt: readAt,
	}
	return reviewflow.State{
		Review: stored, Status: status, Passes: []prreview.Pass{pass},
		Session: session.Summary{Status: session.StatusWaiting, Idle: true}, SessionOpen: true,
	}
}

// recordedPass is a pass with one undecided finding, decided when decision is
// not the empty one.
func recordedPass(number int, decision prreview.Decision) prreview.Pass {
	return prreview.Pass{
		ReviewID: "review-1", Number: number, Recorded: true, Revision: 1,
		SummaryOriginal: "Two things to look at.", Summary: "Two things to look at.",
		Findings: []prreview.Finding{{Finding: prreport.Finding{
			Number: 1, Path: "main.go", Line: 12, Original: "Handle the error.",
			Text: "Handle the error.", Decision: decision,
		}}},
		CreatedAt: readAt,
	}
}

func TestFromReviewsSaysWhatTheUserCanDoWithAReview(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		status  reviewflow.Status
		pass    prreview.Pass
		publish bool
		apply   bool
		approve bool
		again   bool
	}{
		{
			name: "ready to publish", status: reviewflow.StatusReadyToPublish,
			pass: recordedPass(1, prreview.DecisionApproved), publish: true, again: true,
		},
		{
			name: "publish failed with everything decided", status: reviewflow.StatusPublishFailed,
			pass: recordedPass(1, prreview.DecisionDiscarded), publish: true, again: true,
		},
		{
			name: "publish failed with a finding to decide", status: reviewflow.StatusPublishFailed,
			pass: recordedPass(1, prreview.DecisionNone), again: true,
		},
		{
			name: "ready to apply", status: reviewflow.StatusReadyToApply,
			pass: recordedPass(1, prreview.DecisionApproved), apply: true, again: true,
		},
		{
			name: "ready to approve", status: reviewflow.StatusReadyToApprove,
			pass: recordedPass(1, prreview.DecisionApproved), approve: true, again: true,
		},
		{
			name: "in review", status: reviewflow.StatusInReview,
			pass: recordedPass(1, prreview.DecisionApproved), again: true,
		},
		{
			name: "committing", status: reviewflow.StatusCommitting,
			pass: recordedPass(1, prreview.DecisionApproved),
		},
		{
			name: "applying", status: reviewflow.StatusApplying,
			pass: recordedPass(1, prreview.DecisionApproved),
		},
		{
			name: "awaiting a decision", status: reviewflow.StatusAwaitingDecision,
			pass: recordedPass(1, prreview.DecisionNone), again: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := bindings.FromReviews([]reviewflow.State{reviewState(tt.status, tt.pass)}, nil, reviewRepos)[0]

			if got.CanPublish != tt.publish || got.CanApply != tt.apply ||
				got.CanApprove != tt.approve || got.CanReviewAgain != tt.again {
				t.Errorf("publish %v, apply %v, approve %v, again %v, want %v, %v, %v, %v",
					got.CanPublish, got.CanApply, got.CanApprove, got.CanReviewAgain,
					tt.publish, tt.apply, tt.approve, tt.again)
			}
		})
	}
}

func TestFromReviewsRefusesAnotherPassWhileThePassAskedForIsStillRunning(t *testing.T) {
	t.Parallel()

	state := reviewState(reviewflow.StatusAwaitingReply, recordedPass(1, prreview.DecisionNone))
	state.Review.AskedPass = 2

	if got := bindings.FromReviews([]reviewflow.State{state}, nil, reviewRepos)[0]; got.CanReviewAgain {
		t.Error("canReviewAgain = true, want false while the report of the pass asked for is missing")
	}

	working := reviewState(reviewflow.StatusReviewing, recordedPass(1, prreview.DecisionNone))
	working.Session = session.Summary{Status: session.StatusWorking, TurnRunning: true}

	if got := bindings.FromReviews([]reviewflow.State{working}, nil, reviewRepos)[0]; got.CanReviewAgain {
		t.Error("canReviewAgain = true, want false while the agent works")
	}

	paused := reviewState(reviewflow.StatusAwaitingDecision, recordedPass(1, prreview.DecisionNone))
	paused.Session = session.Summary{Status: session.StatusPaused}

	if got := bindings.FromReviews([]reviewflow.State{paused}, nil, reviewRepos)[0]; !got.CanReviewAgain {
		t.Error("canReviewAgain = false, want true on a paused conversation")
	}
}

func TestFromReviewsOffersABlockedPassAgainWithItsReason(t *testing.T) {
	t.Parallel()

	blocked := reviewState(reviewflow.StatusPassBlocked, recordedPass(1, prreview.DecisionNone))
	blocked.Review.AskedPass = 2
	blocked.PassBlocked = "gh is not logged in"

	got := bindings.FromReviews([]reviewflow.State{blocked}, nil, reviewRepos)[0]
	if !got.CanReviewAgain {
		t.Error("canReviewAgain = false, want true on a blocked pass")
	}
	if got.PassBlocked != "gh is not logged in" {
		t.Errorf("passBlocked = %q, want the reason the pass could not start", got.PassBlocked)
	}

	waiting := reviewState(reviewflow.StatusWaitingChecks, recordedPass(1, prreview.DecisionNone))
	waiting.Review.AskedPass = 2

	if got := bindings.FromReviews([]reviewflow.State{waiting}, nil, reviewRepos)[0]; got.CanReviewAgain || got.PassBlocked != "" {
		t.Errorf("canReviewAgain %v, passBlocked %q, want false and none while the pass waits for the checks",
			got.CanReviewAgain, got.PassBlocked)
	}
}

func TestFromReviewsCarriesThePassesTheVerdictsAndTheSituationsOfAReview(t *testing.T) {
	t.Parallel()

	pass := recordedPass(1, prreview.DecisionApproved)
	pass.Verdict = prreview.VerdictComment
	pass.PublishedAt = readAt
	pass.PublishedURL = "https://github.com/acme/web/pull/7#pullrequestreview-1"
	pass.Findings[0].Placement = prreview.PlacementInline
	state := reviewState(reviewflow.StatusPublished, pass)
	state.WorktreePath = "/data/worktrees/acme/web/pr_7"
	state.Review.Card = &prreview.Card{BoardID: "board-1", Number: 12, Title: "Add login", Status: "Done"}
	situations := map[string][]attention.Situation{
		"review-1": {{ID: "s-1", TaskID: "review-1", Kind: attention.KindReviewReport, Form: attention.FormPublish}},
	}

	got := bindings.FromReviews([]reviewflow.State{state}, situations, reviewRepos)[0]

	wantPass := bindings.ReviewPass{
		Pass: 1, File: "review-1.md", Recorded: true, Summary: "Two things to look at.",
		Findings: []bindings.ReviewFinding{{
			Number: 1, Path: "main.go", Line: 12, LineURL: "https://github.com/acme/web/pull/7/files#diff-2873f79a86c0d8b3335cd7731b0ecf7dd4301eb19a82ef7a1cba7589b5252261R12", Text: "Handle the error.",
			Decision: "approved", Placement: "inline",
		}},
		Revision: 1, Published: true, PublishedAt: readAt.Format(time.RFC3339),
		PublishedURL: "https://github.com/acme/web/pull/7#pullrequestreview-1", Verdict: "comment",
		Checks: []bindings.PRCheck{},
	}
	if diff := cmp.Diff([]bindings.ReviewPass{wantPass}, got.Passes); diff != "" {
		t.Errorf("passes (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]string{"approve", "request_changes", "comment"}, got.Verdicts); diff != "" {
		t.Errorf("verdicts (-want +got):\n%s", diff)
	}
	if got.Repository != "acme/web" || got.WorktreePath != "/data/worktrees/acme/web/pr_7" {
		t.Errorf("review = %+v, want the repository and the worktree of the review", got)
	}
	if got.Card == nil || got.Card.Number != 12 {
		t.Errorf("card = %+v, want the card of the pull request", got.Card)
	}
	if len(got.Situations) != 1 || got.Situations[0].ID != "s-1" {
		t.Errorf("situations = %+v, want the one of the review", got.Situations)
	}
	if got.SessionStage != "review" {
		t.Errorf("sessionStage = %q, want review", got.SessionStage)
	}
}

func TestFromReviewsTellsAPassTheUserEditedFromTheReport(t *testing.T) {
	t.Parallel()

	summary := recordedPass(1, prreview.DecisionNone)
	summary.Summary = "One thing to look at."
	finding := recordedPass(1, prreview.DecisionNone)
	finding.Findings[0].Text = "Handle the error and log it."

	tests := []struct {
		name string
		pass prreview.Pass
		want bool
	}{
		{name: "as the report has it", pass: recordedPass(1, prreview.DecisionNone), want: false},
		{name: "summary edited", pass: summary, want: true},
		{name: "finding edited", pass: finding, want: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			state := reviewState(reviewflow.StatusAwaitingDecision, tt.pass)
			got := bindings.FromReviews([]reviewflow.State{state}, nil, reviewRepos)[0]

			if got.Passes[0].Edited != tt.want {
				t.Errorf("edited = %v, want %v", got.Passes[0].Edited, tt.want)
			}
		})
	}
}

func TestFromReviewsOffersOnlyACommentOnAPullRequestOfTheUsersOwn(t *testing.T) {
	t.Parallel()

	state := reviewState(reviewflow.StatusReadyToPublish, recordedPass(1, prreview.DecisionApproved))
	state.Review.Own = true
	state.Review.Mode = prreview.ModeApply
	state.SessionOpen = false

	got := bindings.FromReviews([]reviewflow.State{state}, nil, reviewRepos)[0]

	if diff := cmp.Diff([]string{"comment"}, got.Verdicts); diff != "" {
		t.Errorf("verdicts (-want +got):\n%s", diff)
	}
	if got.Mode != "apply" || got.SessionStage != "" {
		t.Errorf("review = mode %q, stage %q, want apply without a conversation", got.Mode, got.SessionStage)
	}
	if empty := bindings.FromReviews(nil, nil, nil); empty == nil {
		t.Error("FromReviews(nil) = nil, want an empty slice")
	}
}

func TestFromArchivedReviewsCarriesWhatBecameOfThePullRequest(t *testing.T) {
	t.Parallel()

	archived := prreview.Review{
		ID: "review-1", RepositoryID: "r-1", Number: 7, Title: "Add the login screen",
		Author: "alice", URL: "https://github.com/acme/web/pull/7", Mode: prreview.ModePublish,
		PRState: prreview.PRMerged, CreatedAt: readAt, ArchivedAt: readAt.Add(time.Hour),
		BaseBranch: "main", MergedBy: "bob", MergedAt: readAt.Add(30 * time.Minute),
	}
	passes := func(id string) []prreview.Pass {
		if id != "review-1" {
			return nil
		}
		return []prreview.Pass{recordedPass(1, prreview.DecisionApproved)}
	}

	got := bindings.FromArchivedReviews([]prreview.Review{archived}, passes, reviewRepos)

	want := []bindings.ArchivedReview{{
		ID: "review-1", RepositoryID: "r-1", Repository: "acme/web", Number: 7,
		Title: "Add the login screen", Author: "alice", URL: "https://github.com/acme/web/pull/7",
		Mode: "publish", Outcome: "merged",
		Passes: []bindings.ReviewPass{{
			Pass: 1, File: "review-1.md", Recorded: true, Summary: "Two things to look at.",
			Findings: []bindings.ReviewFinding{{
				Number: 1, Path: "main.go", Line: 12, LineURL: "https://github.com/acme/web/pull/7/files#diff-2873f79a86c0d8b3335cd7731b0ecf7dd4301eb19a82ef7a1cba7589b5252261R12", Text: "Handle the error.",
				Decision: "approved",
			}},
			Revision: 1, Checks: []bindings.PRCheck{},
		}},
		BaseBranch: "main",
		MergedBy:   "bob",
		MergedAt:   readAt.Add(30 * time.Minute).Format(time.RFC3339),
		CreatedAt:  readAt.Format(time.RFC3339),
		ArchivedAt: readAt.Add(time.Hour).Format(time.RFC3339),
	}}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("FromArchivedReviews() mismatch (-want +got):\n%s", diff)
	}
	if empty := bindings.FromArchivedReviews(nil, nil, nil); empty == nil {
		t.Error("FromArchivedReviews(nil) = nil, want an empty slice")
	}
}

func TestFromReviewLeftoverKeepsTheWorktreeGitCouldNotRemove(t *testing.T) {
	t.Parallel()

	left := bindings.FromReviewLeftover(reviewflow.Leftover{WorktreePath: "/data/worktrees/acme/web/pr_7"})
	if left.Leftover == nil || left.Leftover.Path != "/data/worktrees/acme/web/pr_7" {
		t.Errorf("FromReviewLeftover() = %+v, want the path of the worktree", left.Leftover)
	}
	if clean := bindings.FromReviewLeftover(reviewflow.Leftover{}); clean.Leftover != nil {
		t.Errorf("FromReviewLeftover() = %+v, want nil when git removed everything", clean.Leftover)
	}
}

// discussionRepos are the registered repositories the conversions of a
// discussion are given: two of its board, one of them with its clone gone, and
// one of another board.
var discussionRepos = []bindings.Repository{
	{ID: "r-api", Owner: "acme", Name: "api", FullName: "acme/api", BoardID: "board-1", Cloned: true},
	{ID: "r-web", Owner: "acme", Name: "web", FullName: "acme/web", BoardID: "board-1", Cloned: true},
	{ID: "r-cli", Owner: "acme", Name: "cli", FullName: "acme/cli", BoardID: "board-2", Cloned: true},
}

// discussionMissing is the clone of acme/api, which the last check did not
// find.
func discussionMissing(id string) bool { return id == "r-api" }

// discussionReading is the stored reading of the board of the discussion: a
// module field and the card acme/web#12, with its epic and its dependency.
func discussionReading() *board.Reading {
	card := boardCard("web", 12)
	card.Body = "Email and password."
	card.Fields = []board.Field{{Name: "Módulo", Value: "Auth"}}
	card.Epic = &board.Epic{Issue: board.Issue{
		Owner: "acme", Name: "web", Number: 1, Title: "Auth", URL: "https://e", State: task.IssueOpen,
	}}
	card.Dependencies = []board.Dependency{{Related: board.Related{Issue: board.Issue{
		Owner: "acme", Name: "api", Number: 7, Title: "Tokens", URL: "https://d", State: task.IssueOpen,
	}}}}
	tokens := boardCard("api", 7)
	tokens.Title, tokens.URL = "Tokens", "https://github.com/acme/api/issues/7"
	return &board.Reading{
		Title:     "Roadmap",
		Viewer:    "dev",
		HasStatus: true,
		Statuses:  []board.Option{{ID: "todo", Name: "Todo"}, {ID: "done", Name: "Done"}},
		Module: &board.ModuleField{ID: "field-1", Name: "Módulo", Options: []board.Option{
			{ID: "auth", Name: "Auth"}, {ID: "billing", Name: "Billing"},
		}},
		Cards: []board.Card{card, tokens},
	}
}

// inputCard is the card acme/web#12 the discussion started from.
var inputCard = discussion.InputCard{
	Owner: "acme", Name: "web", Number: 12, Title: "Add login",
	URL: "https://github.com/acme/web/issues/1",
}

// discussionState is a discussion of the board Roadmap in a status, with the
// drafts given.
func discussionState(status discussionflow.Status, drafts ...discussionflow.DraftState) discussionflow.State {
	return discussionflow.State{
		Discussion: discussion.Discussion{
			ID: "discussion-1", BoardID: "board-1", BoardTitle: "Roadmap as it was",
			Title: "The invoices of the quarter", Text: "What to do with them.",
			Cards: []discussion.InputCard{inputCard}, DraftsRead: true, DraftsRevision: 2,
			CreatedAt: readAt,
		},
		Status:      status,
		Drafts:      drafts,
		Session:     session.Summary{Status: session.StatusWaiting, Idle: true},
		SessionOpen: true,
		CanArchive:  true,
	}
}

// discussionDrafts are the three drafts of the discussion the conversion
// tests convert: the card of the reading rewritten, a new card of an epic, and
// the epic the user grouped them into.
func discussionDrafts() []discussionflow.DraftState {
	update := discussion.Draft{
		DiscussionID: "discussion-1", ID: "login", Position: 1,
		Kind: discussion.KindUpdate, Source: discussion.SourceAgent,
		Owner: "acme", Name: "web", Card: &inputCard,
		Title: "Add the login screen", Body: "Email, password and the link.",
		Module: "Auth",
		Dependencies: []discussion.Dependency{{
			Ref: discussion.Ref{Owner: "acme", Name: "api", Number: 7}, Original: true, Linked: true,
		}},
		Decision: discussion.DecisionApproved, Revision: 2,
		Warnings: []string{"The module Billing is not an option of the board."},
		Published: discussion.Publication{
			Outcome: discussion.OutcomeUpdated, Number: 12,
			URL: "https://github.com/acme/web/issues/12", At: readAt,
		},
	}
	export := discussion.Draft{
		DiscussionID: "discussion-1", ID: "export", Position: 2,
		Kind: discussion.KindNew, Source: discussion.SourceAgent,
		Owner: "acme", Name: "api",
		Title: "Export the invoices", Body: "A CSV of the quarter.",
		Epic: "the-epic",
		Dependencies: []discussion.Dependency{{
			Ref: discussion.Ref{Draft: "login"}, Dropped: discussion.DropDiscarded,
		}},
		PublishError: "gh: the issue could not be created",
	}
	epic := discussion.Draft{
		DiscussionID: "discussion-1", ID: "the-epic", Position: 3,
		Kind: discussion.KindEpic, Source: discussion.SourceUser,
		Owner: "acme", Name: "cli", Title: "The invoices", Body: "Everything about them.",
	}
	return []discussionflow.DraftState{
		{Draft: update},
		{Draft: export, Hold: discussionflow.Hold{Reason: discussionflow.HoldDraft, Title: "Add the login screen"}},
		{Draft: epic},
	}
}

// convertDiscussion converts the state with the reading given, the
// repositories of the tests and the board Roadmap when it is registered.
func convertDiscussion(
	state discussionflow.State, reading *board.Reading, registered bool,
	situations map[string][]attention.Situation,
) bindings.DiscussionSummary {
	boards := func(id string) (board.Board, bool) {
		if !registered || id != "board-1" {
			return board.Board{}, false
		}
		return board.Board{ID: "board-1", Title: "Roadmap"}, true
	}
	stored := func(id string) board.Stored {
		if id != "board-1" {
			return board.Stored{}
		}
		return board.Stored{Reading: reading, ReadAt: readAt}
	}
	return bindings.FromDiscussions(
		[]discussionflow.State{state}, situations, boards, stored, discussionRepos, discussionMissing,
	)[0]
}

func TestFromDiscussionsCarriesEveryDraftWithWhatTheReadingKnows(t *testing.T) {
	t.Parallel()

	state := discussionState(discussionflow.StatusPublishFailed, discussionDrafts()...)

	got := convertDiscussion(state, discussionReading(), true, nil)

	want := []bindings.Draft{
		{
			ID: "login", Position: 1, Kind: "update", Source: "agent",
			Repository: "acme/web", RepositoryID: "r-web",
			Card: &bindings.DiscussionCard{
				Key: "acme/web#12", Repository: "acme/web", Number: 12, Title: "Add login",
				URL: "https://github.com/acme/web/issues/1",
			},
			Title: "Add the login screen", Body: "Email, password and the link.", Module: "Auth",
			Dependencies: []bindings.DraftDependency{{
				DraftRef: bindings.DraftRef{
					Key: "acme/api#7", Reference: "acme/api#7", Title: "Tokens",
					URL: "https://github.com/acme/api/issues/7",
				},
				Linked: true,
			}},
			Current: &bindings.DraftCurrent{
				Title: "Add login", Body: "Email and password.", Module: "Auth", Status: "Todo",
				Epic: &bindings.DraftRef{
					Key: "acme/web#1", Reference: "acme/web#1", Title: "Auth", URL: "https://e",
				},
				Dependencies: []bindings.DraftRef{{
					Key: "acme/api#7", Reference: "acme/api#7", Title: "Tokens", URL: "https://d",
				}},
				ReadAt: readAt.Format(time.RFC3339),
			},
			Decision: "approved", Revision: 2,
			Warnings:    []string{"The module Billing is not an option of the board."},
			Outcome:     "updated",
			Number:      12,
			URL:         "https://github.com/acme/web/issues/12",
			Published:   true,
			PublishedAt: readAt.Format(time.RFC3339),

			ApprovePublishes: []string{}, DiscardPublishes: []string{},
		},
		{
			ID: "export", Position: 2, Kind: "new", Source: "agent",
			Repository: "acme/api", RepositoryID: "r-api",
			Title: "Export the invoices", Body: "A CSV of the quarter.",
			Epic: &bindings.DraftRef{Draft: "the-epic", Title: "The invoices"},
			Dependencies: []bindings.DraftDependency{{
				DraftRef: bindings.DraftRef{Draft: "login", Title: "Add the login screen"},
				Dropped:  "discarded",
			}},
			Warnings:     []string{},
			PublishError: "gh: the issue could not be created",
			Hold:         bindings.DraftHold{Reason: "draft", Title: "Add the login screen"},

			ApprovePublishes: []string{}, DiscardPublishes: []string{},
		},
		{
			ID: "the-epic", Position: 3, Kind: "epic", Source: "user",
			Repository: "acme/cli",
			Title:      "The invoices", Body: "Everything about them.",
			Dependencies: []bindings.DraftDependency{},
			Warnings:     []string{},

			ApprovePublishes: []string{}, DiscardPublishes: []string{},
		},
	}
	if diff := cmp.Diff(want, got.Drafts); diff != "" {
		t.Errorf("drafts (-want +got):\n%s", diff)
	}
}

func TestFromDiscussionsCarriesWhatHoldsEachDraft(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		hold discussionflow.Hold
		want bindings.DraftHold
	}{
		{"none", discussionflow.Hold{}, bindings.DraftHold{}},
		{
			"epic discarded",
			discussionflow.Hold{Reason: discussionflow.HoldEpicDiscarded},
			bindings.DraftHold{Reason: "epic_discarded"},
		},
		{
			"cards",
			discussionflow.Hold{Reason: discussionflow.HoldCards, Left: 2},
			bindings.DraftHold{Reason: "cards", Left: 2},
		},
		{
			"epic short",
			discussionflow.Hold{Reason: discussionflow.HoldEpicShort, Approved: 1, Cards: 3},
			bindings.DraftHold{Reason: "epic_short", Approved: 1, Cards: 3},
		},
		{"epic", discussionflow.Hold{Reason: discussionflow.HoldEpic}, bindings.DraftHold{Reason: "epic"}},
		{
			"draft",
			discussionflow.Hold{Reason: discussionflow.HoldDraft, Title: "Add the login screen"},
			bindings.DraftHold{Reason: "draft", Title: "Add the login screen"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			states := discussionDrafts()
			states[0].Hold = tt.hold
			state := discussionState(discussionflow.StatusDeciding, states...)

			got := convertDiscussion(state, discussionReading(), true, nil)

			if diff := cmp.Diff(tt.want, got.Drafts[0].Hold); diff != "" {
				t.Errorf("hold (-want +got):\n%s", diff)
			}
		})
	}
}

func TestFromDiscussionsCarriesWhatEachGestureWouldPublish(t *testing.T) {
	t.Parallel()

	states := discussionDrafts()
	states[1].ApprovePublishes = []string{"the-epic", "export"}
	states[1].DiscardPublishes = []string{"the-epic"}
	states[1].ApproveHold = discussionflow.Hold{Reason: discussionflow.HoldCards, Left: 2}
	state := discussionState(discussionflow.StatusDeciding, states...)

	got := convertDiscussion(state, discussionReading(), true, nil).Drafts[1]

	if diff := cmp.Diff([]string{"the-epic", "export"}, got.ApprovePublishes); diff != "" {
		t.Errorf("approvePublishes (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]string{"the-epic"}, got.DiscardPublishes); diff != "" {
		t.Errorf("discardPublishes (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff(bindings.DraftHold{Reason: "cards", Left: 2}, got.ApproveHold); diff != "" {
		t.Errorf("approveHold (-want +got):\n%s", diff)
	}
}

func TestFromDiscussionsMarksTheDraftsRevisedByTheLastReadingOnly(t *testing.T) {
	t.Parallel()

	states := discussionDrafts()
	states[0].Draft.RevisedReading, states[0].Draft.ApprovalCleared = 2, true
	states[1].Draft.RevisedReading = 1
	state := discussionState(discussionflow.StatusDeciding, states...)

	got := convertDiscussion(state, discussionReading(), true, nil)

	revised := make([]bool, len(got.Drafts))
	for i, draft := range got.Drafts {
		revised[i] = draft.Revised
	}
	if diff := cmp.Diff([]bool{true, false, false}, revised); diff != "" {
		t.Errorf("revised (-want +got):\n%s", diff)
	}
	if !got.Drafts[0].ApprovalCleared {
		t.Error("approvalCleared = false, want the approval a revision took")
	}
}

func TestFromDiscussionsCarriesTheRoundAndThePublicationUnderWay(t *testing.T) {
	t.Parallel()

	state := discussionState(discussionflow.StatusPublishing, discussionDrafts()...)
	state.Round, state.Publishing = 3, true
	state.Drafts[0].Draft.Round = 3

	got := convertDiscussion(state, discussionReading(), true, nil)

	if got.Round != 3 || !got.Publishing || got.Drafts[0].Round != 3 {
		t.Errorf("round = %d, publishing = %v, draft round = %d, want 3, true, 3", got.Round, got.Publishing, got.Drafts[0].Round)
	}
}

func TestFromDiscussionsMarksTheDraftsOfThePublicationUnderWay(t *testing.T) {
	t.Parallel()

	states := discussionDrafts()
	states[1].Publishing = true
	state := discussionState(discussionflow.StatusPublishing, states...)

	got := convertDiscussion(state, discussionReading(), true, nil)

	publishing := make([]bool, len(got.Drafts))
	for i, draft := range got.Drafts {
		publishing[i] = draft.Publishing
	}
	if diff := cmp.Diff([]bool{false, true, false}, publishing); diff != "" {
		t.Errorf("publishing (-want +got):\n%s", diff)
	}
}

func TestFromDiscussionsCarriesTheBoardTheModuleAndTheSituations(t *testing.T) {
	t.Parallel()

	state := discussionState(discussionflow.StatusDeciding, discussionDrafts()...)
	state.HasDocument, state.DocumentRevision = true, 3
	situations := map[string][]attention.Situation{
		"discussion-1": {{
			ID: "s-1", TaskID: "discussion-1", Kind: attention.KindDrafts,
			Place: attention.Place{Kind: attention.PlaceDiscussion},
		}},
	}

	got := convertDiscussion(state, discussionReading(), true, situations)

	want := bindings.DiscussionSummary{
		ID: "discussion-1", BoardID: "board-1", Board: "Roadmap",
		Title: "The invoices of the quarter", Text: "What to do with them.",
		Status: "deciding",
		Cards: []bindings.DiscussionCard{{
			Key: "acme/web#12", Repository: "acme/web", Number: 12, Title: "Add login",
			URL: "https://github.com/acme/web/issues/1",
		}},
		Drafts:         got.Drafts,
		DraftsRead:     true,
		DraftsRevision: 2,
		HasDocument:    true, DocumentRevision: 3,
		ModuleField:   "Módulo",
		ModuleOptions: []string{"Auth", "Billing"},
		Repositories: []bindings.DiscussionRepository{
			{ID: "r-api", FullName: "acme/api", Cloned: true, Missing: true},
			{ID: "r-web", FullName: "acme/web", Cloned: true},
		},
		CanArchive:    true,
		SessionStage:  "discussion",
		SessionStatus: "waiting",
		Situations: []bindings.Situation{{
			ID: "s-1", TaskID: "discussion-1", Kind: "drafts", Group: "waiting",
			Place: bindings.Place{Kind: "discussion"}, StartedAt: time.Time{}.Format(time.RFC3339),
		}},
		CreatedAt: readAt.Format(time.RFC3339),
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("FromDiscussions() mismatch (-want +got):\n%s", diff)
	}
}

func TestFromDiscussionsLeavesADiscussionOfABoardThatIsGoneWithWhatItRecorded(t *testing.T) {
	t.Parallel()

	drafts := discussionDrafts()
	drafts[0].Draft.Card = &discussion.InputCard{Owner: "acme", Name: "web", Number: 99, Title: "Gone"}
	state := discussionState(discussionflow.StatusDiscussing, drafts...)
	state.Discussion.BoardID = "board-gone"

	got := convertDiscussion(state, nil, false, nil)

	if got.Board != "Roadmap as it was" {
		t.Errorf("board = %q, want the title the discussion recorded", got.Board)
	}
	if len(got.Repositories) != 0 || got.Repositories == nil {
		t.Errorf("repositories = %+v, want an empty list", got.Repositories)
	}
	if got.ModuleField != "" || len(got.ModuleOptions) != 0 || got.ModuleOptions == nil {
		t.Errorf("module = %q %+v, want none", got.ModuleField, got.ModuleOptions)
	}
	if got.Drafts[0].Current != nil {
		t.Errorf("current = %+v, want nil for a card that left the reading", got.Drafts[0].Current)
	}
	if ref := got.Drafts[0].Dependencies[0].DraftRef; ref.Title != "" || ref.URL != "" {
		t.Errorf("dependency = %+v, want only the reference without the reading", ref)
	}
	if empty := bindings.FromDiscussions(nil, nil, nil, nil, nil, nil); empty == nil {
		t.Error("FromDiscussions(nil) = nil, want an empty slice")
	}
}

func TestFromArchivedDiscussionsCountsWhatWasPublishedAndTheRepositoriesItTouched(t *testing.T) {
	t.Parallel()

	archived := discussionState(discussionflow.StatusReadyToArchive).Discussion
	archived.ArchivedAt = readAt.Add(time.Hour)
	stored := []discussion.Draft{discussionDrafts()[0].Draft, discussionDrafts()[1].Draft}
	stored[0].Round, stored[0].RevisedReading = 2, 2
	stored[1].Published = discussion.Publication{
		Outcome: discussion.OutcomeCreated, Number: 30,
		URL: "https://github.com/acme/api/issues/30", At: readAt,
	}
	drafts := func(id string) []discussion.Draft {
		if id != "discussion-1" {
			return nil
		}
		return stored
	}

	got := bindings.FromArchivedDiscussions([]discussion.Discussion{archived}, drafts, discussionRepos)

	if len(got) != 1 {
		t.Fatalf("FromArchivedDiscussions() = %+v, want one discussion", got)
	}
	if got[0].Board != "Roadmap as it was" || got[0].Title != "The invoices of the quarter" {
		t.Errorf("discussion = %+v, want the board and the title it recorded", got[0])
	}
	if got[0].Text != "What to do with them." {
		t.Errorf("text = %q, want what the user wrote", got[0].Text)
	}
	if got[0].PublishedCount != 2 {
		t.Errorf("publishedCount = %d, want 2", got[0].PublishedCount)
	}
	if diff := cmp.Diff([]string{"r-web", "r-api"}, got[0].RepositoryIDs); diff != "" {
		t.Errorf("repositoryIds (-want +got):\n%s", diff)
	}
	if got[0].ArchivedAt != readAt.Add(time.Hour).Format(time.RFC3339) {
		t.Errorf("archivedAt = %q, want the instant it was archived", got[0].ArchivedAt)
	}
	if got[0].Drafts[0].Round != 2 || got[0].Drafts[0].Revised {
		t.Errorf("draft round = %d, revised = %v, want 2, false: the history does not say revised", got[0].Drafts[0].Round, got[0].Drafts[0].Revised)
	}
	// A draft no reading revised is not revised either, though the history reads it with no revision.
	if got[0].Drafts[1].Revised {
		t.Error("revised = true for a draft never revised, want false")
	}
	if got[0].Drafts[0].Current != nil {
		t.Errorf("current = %+v, want nil in the history", got[0].Drafts[0].Current)
	}
	empty := bindings.FromArchivedDiscussions(
		[]discussion.Discussion{{ID: "discussion-2"}}, func(string) []discussion.Draft { return nil }, nil,
	)
	if empty[0].Cards == nil || empty[0].Drafts == nil || empty[0].RepositoryIDs == nil {
		t.Errorf("archived = %+v, want every list allocated", empty[0])
	}
	if none := bindings.FromArchivedDiscussions(nil, nil, nil); none == nil {
		t.Error("FromArchivedDiscussions(nil) = nil, want an empty slice")
	}
}

func TestFromArchivedDiscussionsKeepsTheRepositoriesOfADiscussionOfABoardThatIsGone(t *testing.T) {
	t.Parallel()

	archived := discussionState(discussionflow.StatusReadyToArchive).Discussion
	archived.ArchivedAt = readAt.Add(time.Hour)
	published := discussionDrafts()[1].Draft
	published.Published = discussion.Publication{
		Outcome: discussion.OutcomeCreated, Number: 30,
		URL: "https://github.com/acme/api/issues/30", At: readAt,
	}
	drafts := func(string) []discussion.Draft { return []discussion.Draft{published} }
	// Removing a board releases its repositories: they stay registered
	// without one.
	released := make([]bindings.Repository, len(discussionRepos))
	copy(released, discussionRepos)
	for i := range released {
		released[i].BoardID = ""
	}

	got := bindings.FromArchivedDiscussions([]discussion.Discussion{archived}, drafts, released)

	if diff := cmp.Diff([]string{"r-web", "r-api"}, got[0].RepositoryIDs); diff != "" {
		t.Errorf("repositoryIds (-want +got):\n%s", diff)
	}
}

func TestFromTasksCarriesWhatWentWrongWithThePullRequestSinceItsReview(t *testing.T) {
	t.Parallel()

	troubled := flow.PullRequest{
		Status:  flow.PRTrouble,
		PR:      task.PRDetails{Number: 8, State: task.PRStateOpen, Base: "main"},
		Trouble: gh.Trouble{FailedChecks: []string{"ci", "lint"}, Conflict: true},
	}
	ready := flow.PullRequest{
		Status: flow.PRDone,
		PR:     task.PRDetails{Number: 9, State: task.PRStateOpen, Base: "main"},
	}
	byTask := map[string]flow.PullRequest{"task-1": troubled, "task-2": ready}

	got := bindings.FromTasks(
		[]task.Task{
			{ID: "task-1", Name: "login-screen", Stage: task.StagePR},
			{ID: "task-2", Name: "signup-screen", Stage: task.StagePR},
		},
		func(string) task.Artifacts { return task.Artifacts{} },
		func(string) []flow.StepState { return nil },
		func(id string) (flow.PullRequest, bool) { pr, ok := byTask[id]; return pr, ok },
		noWorktree,
		noConversations,
		repoOf,
		nil,
		nil,
	)
	if len(got) != 2 || got[0].PR == nil || got[1].PR == nil {
		t.Fatalf("FromTasks() = %+v, want two tasks with their pull requests", got)
	}
	want := bindings.PRTrouble{FailedChecks: []string{"ci", "lint"}, Conflict: true}
	if diff := cmp.Diff(want, got[0].PR.Trouble); diff != "" {
		t.Errorf("trouble mismatch (-want +got):\n%s", diff)
	}
	if clean := got[1].PR.Trouble; clean.FailedChecks == nil || len(clean.FailedChecks) != 0 || clean.Conflict {
		t.Errorf("trouble = %#v, want an empty list and no conflict", clean)
	}
}

func TestFromTasksCarriesTheChecksOfThePullRequestByName(t *testing.T) {
	t.Parallel()

	started := time.Date(2026, 9, 27, 23, 56, 8, 0, time.UTC)
	read := flow.PullRequest{
		Status: flow.PRWaitingChecks,
		PR: task.PRDetails{
			Number: 8, State: task.PRStateOpen, Base: "main", CheckedAt: started,
			Checks: []gh.Check{
				{
					Name: "test", URL: "https://github.com/acme/api/actions/runs/1", Conclusion: "failure", State: gh.CheckFailed,
					StartedAt: started, CompletedAt: started.Add(112 * time.Second),
				},
				{Name: "ci/deploy", Pending: true, State: gh.CheckRunning, StartedAt: started},
				{Name: "ci/queued", Pending: true, State: gh.CheckQueued},
			},
			Mergeable: gh.MergeableClean,
		},
	}
	unread := flow.PullRequest{Status: flow.PRWaitingChecks, PR: task.PRDetails{Number: 9}}
	byTask := map[string]flow.PullRequest{"task-1": read, "task-2": unread}

	got := bindings.FromTasks(
		[]task.Task{
			{ID: "task-1", Name: "login-screen", Stage: task.StagePR},
			{ID: "task-2", Name: "signup-screen", Stage: task.StagePR},
		},
		func(string) task.Artifacts { return task.Artifacts{} },
		func(string) []flow.StepState { return nil },
		func(id string) (flow.PullRequest, bool) { pr, ok := byTask[id]; return pr, ok },
		noWorktree,
		noConversations,
		repoOf,
		nil,
		nil,
	)
	if len(got) != 2 || got[0].PR == nil || got[1].PR == nil {
		t.Fatalf("FromTasks() = %+v, want two tasks with their pull requests", got)
	}
	want := []bindings.PRCheck{
		{
			Name: "test", State: "failed", Conclusion: "failure",
			StartedAt: "2026-09-27T23:56:08Z", CompletedAt: "2026-09-27T23:58:00Z",
			URL: "https://github.com/acme/api/actions/runs/1",
		},
		{Name: "ci/deploy", State: "running", StartedAt: "2026-09-27T23:56:08Z"},
		{Name: "ci/queued", State: "queued"},
	}
	if diff := cmp.Diff(want, got[0].PR.Checks); diff != "" {
		t.Errorf("checks mismatch (-want +got):\n%s", diff)
	}
	if got[0].PR.Mergeable != "mergeable" {
		t.Errorf("Mergeable = %q, want mergeable", got[0].PR.Mergeable)
	}
	if got[1].PR.Checks == nil || len(got[1].PR.Checks) != 0 || got[1].PR.Mergeable != "" {
		t.Errorf("Checks, Mergeable = %#v, %q, want an empty list and no merge state before a reading", got[1].PR.Checks, got[1].PR.Mergeable)
	}
}

func TestFromTasksCarriesWhoMergedThePullRequestAndWhen(t *testing.T) {
	t.Parallel()

	merged := flow.PullRequest{
		Status: flow.PRMerged,
		PR: task.PRDetails{
			Number: 8, State: task.PRStateMerged,
			MergedBy: "guilhermt", MergedAt: time.Date(2026, 9, 28, 0, 9, 14, 0, time.UTC),
		},
	}
	open := flow.PullRequest{Status: flow.PRWaitingChecks, PR: task.PRDetails{Number: 9}}
	byTask := map[string]flow.PullRequest{"task-1": merged, "task-2": open}

	got := bindings.FromTasks(
		[]task.Task{
			{ID: "task-1", Name: "login-screen", Stage: task.StagePR},
			{ID: "task-2", Name: "signup-screen", Stage: task.StagePR},
		},
		func(string) task.Artifacts { return task.Artifacts{} },
		func(string) []flow.StepState { return nil },
		func(id string) (flow.PullRequest, bool) { pr, ok := byTask[id]; return pr, ok },
		noWorktree,
		noConversations,
		repoOf,
		nil,
		nil,
	)
	if len(got) != 2 || got[0].PR == nil || got[1].PR == nil {
		t.Fatalf("FromTasks() = %+v, want two tasks with their pull requests", got)
	}
	if got[0].PR.MergedBy != "guilhermt" || got[0].PR.MergedAt != "2026-09-28T00:09:14Z" {
		t.Errorf("MergedBy, MergedAt = %q, %q, want guilhermt at 2026-09-28T00:09:14Z", got[0].PR.MergedBy, got[0].PR.MergedAt)
	}
	if got[1].PR.MergedBy != "" || got[1].PR.MergedAt != "" {
		t.Errorf("MergedBy, MergedAt = %q, %q, want both empty before the merge", got[1].PR.MergedBy, got[1].PR.MergedAt)
	}
}

func TestFromReviewsCarriesWhatWentWrongWithThePullRequestSinceItsLastPass(t *testing.T) {
	t.Parallel()

	troubled := reviewState(reviewflow.StatusTrouble, recordedPass(1, prreview.DecisionApproved))
	troubled.Review.Trouble = gh.Trouble{FailedChecks: []string{"ci"}, Conflict: true}
	ready := reviewState(reviewflow.StatusPublished, recordedPass(1, prreview.DecisionApproved))

	got := bindings.FromReviews([]reviewflow.State{troubled, ready}, nil, reviewRepos)

	want := bindings.PRTrouble{FailedChecks: []string{"ci"}, Conflict: true}
	if diff := cmp.Diff(want, got[0].Trouble); diff != "" {
		t.Errorf("trouble mismatch (-want +got):\n%s", diff)
	}
	if clean := got[1].Trouble; clean.FailedChecks == nil || len(clean.FailedChecks) != 0 || clean.Conflict {
		t.Errorf("trouble = %#v, want an empty list and no conflict", clean)
	}
}

// sessionBlock is the part of a session block that tells the turn in progress.
type sessionBlock struct {
	TurnStartedAt, ActionLabel, ActionTarget string
	RetryMax                                 int
	RetryAt, RetryReason                     string
	TurnFailed                               bool
}

func TestEverySessionBlockCarriesTheTurnInProgressAndItsAction(t *testing.T) {
	t.Parallel()

	startedAt := time.Date(2026, 9, 26, 14, 5, 0, 0, time.UTC)
	busy := session.Summary{
		Status: session.StatusWorking, TurnRunning: true, TurnStartedAt: startedAt,
		ActionLabel: "Reading", ActionTarget: "internal/app/state.go",
		RetryAttempt: 3, RetryMax: 10, RetryAt: startedAt.Add(8 * time.Second), RetryReason: "overloaded",
		TurnFailed: true,
	}
	idle := session.Summary{Status: session.StatusWaiting, Idle: true}

	blocks := map[string]func(session.Summary) sessionBlock{
		"task": func(summary session.Summary) sessionBlock {
			got := bindings.FromTasks(
				[]task.Task{{ID: "task-1", Name: "login-screen", Stage: task.StagePRD}},
				func(string) task.Artifacts { return task.Artifacts{} },
				func(string) []flow.StepState { return nil },
				noPR,
				noWorktree,
				noConversations,
				repoOf,
				map[session.Key]session.Summary{{TaskID: "task-1", Stage: string(task.StagePRD)}: summary},
				nil,
			)[0]
			return sessionBlock{got.TurnStartedAt, got.ActionLabel, got.ActionTarget, got.RetryMax, got.RetryAt, got.RetryReason, got.TurnFailed}
		},
		"step reviewer": func(summary session.Summary) sessionBlock {
			got := stepsOf(t, []flow.StepState{{
				Step:   task.Step{Number: 1, File: "1-first.md", Title: "First"},
				Status: flow.StepAgentReview, ReviewMode: reviewmode.Agent,
				ReviewerStage: "step_review:1", Reviewer: summary,
			}})[0].Reviewer
			return sessionBlock{got.TurnStartedAt, got.ActionLabel, got.ActionTarget, got.RetryMax, got.RetryAt, got.RetryReason, got.TurnFailed}
		},
		"pull request": func(summary session.Summary) sessionBlock {
			pr := flow.PullRequest{Status: flow.PRDone, SessionStage: "pr", Session: summary}
			got := bindings.FromTasks(
				[]task.Task{{ID: "task-1", Name: "login-screen", Stage: task.StagePR}},
				func(string) task.Artifacts { return task.Artifacts{} },
				func(string) []flow.StepState { return nil },
				func(string) (flow.PullRequest, bool) { return pr, true },
				noWorktree,
				noConversations,
				repoOf,
				nil,
				nil,
			)[0].PR
			return sessionBlock{got.TurnStartedAt, got.ActionLabel, got.ActionTarget, got.RetryMax, got.RetryAt, got.RetryReason, got.TurnFailed}
		},
		"review": func(summary session.Summary) sessionBlock {
			state := reviewState(reviewflow.StatusReviewing, recordedPass(1, ""))
			state.Session = summary
			got := bindings.FromReviews([]reviewflow.State{state}, nil, reviewRepos)[0]
			return sessionBlock{got.TurnStartedAt, got.ActionLabel, got.ActionTarget, got.RetryMax, got.RetryAt, got.RetryReason, got.TurnFailed}
		},
		"discussion": func(summary session.Summary) sessionBlock {
			state := discussionState(discussionflow.StatusPublishFailed)
			state.Session = summary
			got := convertDiscussion(state, nil, true, nil)
			return sessionBlock{got.TurnStartedAt, got.ActionLabel, got.ActionTarget, got.RetryMax, got.RetryAt, got.RetryReason, got.TurnFailed}
		},
	}

	for name, block := range blocks {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			want := sessionBlock{
				"2026-09-26T14:05:00Z", "Reading", "internal/app/state.go",
				10, "2026-09-26T14:05:08Z", "overloaded", true,
			}
			if got := block(busy); got != want {
				t.Errorf("in a turn = %+v, want %+v", got, want)
			}
			if got := block(idle); got != (sessionBlock{}) {
				t.Errorf("without a turn = %+v, want every field empty", got)
			}
		})
	}
}

func TestEverySessionBlockCarriesWhenItsSessionWasPaused(t *testing.T) {
	t.Parallel()

	pausedAt := time.Date(2026, 9, 26, 14, 5, 0, 0, time.UTC)
	summaries := []struct {
		name    string
		summary session.Summary
		want    string
	}{
		{"paused", session.Summary{Status: session.StatusPaused, PausedAt: pausedAt}, "2026-09-26T14:05:00Z"},
		{"paused before the time was kept", session.Summary{Status: session.StatusPaused}, ""},
		{"not paused", session.Summary{Status: session.StatusWaiting, Idle: true}, ""},
	}

	blocks := map[string]func(session.Summary) string{
		"task": func(summary session.Summary) string {
			got := bindings.FromTasks(
				[]task.Task{{ID: "task-1", Name: "login-screen", Stage: task.StagePRD}},
				func(string) task.Artifacts { return task.Artifacts{} },
				func(string) []flow.StepState { return nil },
				noPR,
				noWorktree,
				noConversations,
				repoOf,
				map[session.Key]session.Summary{{TaskID: "task-1", Stage: string(task.StagePRD)}: summary},
				nil,
			)[0]
			return got.PausedAt
		},
		"step reviewer": func(summary session.Summary) string {
			got := stepsOf(t, []flow.StepState{{
				Step:   task.Step{Number: 1, File: "1-first.md", Title: "First"},
				Status: flow.StepAgentReview, ReviewMode: reviewmode.Agent,
				ReviewerStage: "step_review:1", Reviewer: summary,
			}})[0].Reviewer
			return got.PausedAt
		},
		"pull request": func(summary session.Summary) string {
			pr := flow.PullRequest{Status: flow.PRDone, SessionStage: "pr", Session: summary}
			got := bindings.FromTasks(
				[]task.Task{{ID: "task-1", Name: "login-screen", Stage: task.StagePR}},
				func(string) task.Artifacts { return task.Artifacts{} },
				func(string) []flow.StepState { return nil },
				func(string) (flow.PullRequest, bool) { return pr, true },
				noWorktree,
				noConversations,
				repoOf,
				nil,
				nil,
			)[0].PR
			return got.PausedAt
		},
		"review": func(summary session.Summary) string {
			state := reviewState(reviewflow.StatusReviewing, recordedPass(1, ""))
			state.Session = summary
			got := bindings.FromReviews([]reviewflow.State{state}, nil, reviewRepos)[0]
			return got.PausedAt
		},
		"discussion": func(summary session.Summary) string {
			state := discussionState(discussionflow.StatusPublishFailed)
			state.Session = summary
			got := convertDiscussion(state, nil, true, nil)
			return got.PausedAt
		},
	}

	for name, block := range blocks {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			for _, tt := range summaries {
				if got := block(tt.summary); got != tt.want {
					t.Errorf("%s: pausedAt = %q, want %q", tt.name, got, tt.want)
				}
			}
		})
	}
}

func TestFromReviewsCarriesTheTitleAndTheLineOnGitHubOfAFinding(t *testing.T) {
	t.Parallel()

	pass := recordedPass(1, prreview.DecisionNone)
	pass.Findings = []prreview.Finding{
		{Finding: prreport.Finding{Number: 1, Title: "The error is dropped", Path: "main.go", Line: 12, Original: "a", Text: "a"}},
		{Finding: prreport.Finding{Number: 2, Title: "No tests", Original: "b", Text: "b"}},
	}
	state := reviewState(reviewflow.StatusReadyToPublish, pass)

	got := bindings.FromReviews([]reviewflow.State{state}, nil, reviewRepos)[0]

	// The anchor is the SHA-256 of "main.go", computed apart from the code.
	const anchored = "https://github.com/acme/web/pull/7/files" +
		"#diff-2873f79a86c0d8b3335cd7731b0ecf7dd4301eb19a82ef7a1cba7589b5252261R12"
	want := []bindings.ReviewFinding{
		{Number: 1, Title: "The error is dropped", Path: "main.go", Line: 12, LineURL: anchored, Text: "a"},
		{Number: 2, Title: "No tests", Text: "b"},
	}
	if diff := cmp.Diff(want, got.Passes[0].Findings); diff != "" {
		t.Errorf("findings (-want +got):\n%s", diff)
	}
}

func TestFromReviewsCarriesTheLiveReadingOfThePullRequest(t *testing.T) {
	t.Parallel()

	state := reviewState(reviewflow.StatusNewCommits, recordedPass(1, prreview.DecisionApproved))
	state.Checks = gh.PRChecks{
		Checks:    []gh.Check{{Name: "test", URL: "https://github.com/acme/web/actions/runs/1", Conclusion: "success"}},
		Mergeable: gh.MergeableConflicting,
	}
	state.CheckedAt = readAt
	state.CheckErrorAt = readAt.Add(-time.Minute)
	state.CheckError = "GitHub can't be reached."
	state.NewCommits = 3
	state.StaleCommits = -1

	got := bindings.FromReviews([]reviewflow.State{state}, nil, reviewRepos)[0]

	if len(got.Checks) != 1 || got.Checks[0].Name != "test" || got.Mergeable != "conflicting" {
		t.Errorf("checks = %+v, mergeable = %q, want the checks and the merge of the reading", got.Checks, got.Mergeable)
	}
	if got.CheckedAt != readAt.Format(time.RFC3339) || got.CheckErrorAt != readAt.Add(-time.Minute).Format(time.RFC3339) {
		t.Errorf("checkedAt = %q, checkErrorAt = %q, want the hours of the readings", got.CheckedAt, got.CheckErrorAt)
	}
	if got.NewCommits != 3 || got.StaleCommits != -1 {
		t.Errorf("newCommits = %d, staleCommits = %d, want 3 and -1", got.NewCommits, got.StaleCommits)
	}

	none := bindings.FromReviews([]reviewflow.State{reviewState(reviewflow.StatusReviewing, recordedPass(1, prreview.DecisionNone))}, nil, reviewRepos)[0]
	if none.Checks == nil || none.CheckedAt != "" || none.CheckErrorAt != "" {
		t.Errorf("review without a reading = %+v, want empty checks and no hours", none)
	}
}

func TestFromReviewsCarriesTheChecksAndTheHoursOfAPass(t *testing.T) {
	t.Parallel()

	sent := recordedPass(1, prreview.DecisionApproved)
	sent.Checks = []gh.Check{{Name: "lint", URL: "https://github.com/acme/web/actions/runs/2", Conclusion: "failure"}}
	sent.Mergeable = gh.MergeableClean
	sent.ChecksReadAt = readAt
	sent.RecordedAt = readAt.Add(time.Minute)
	sent.SentAt = readAt.Add(2 * time.Minute)
	sent.SummaryPublished = true
	applied := recordedPass(2, prreview.DecisionApproved)
	applied.Applied = true
	plain := recordedPass(3, prreview.DecisionApproved)

	state := reviewState(reviewflow.StatusPublished, sent)
	state.Passes = []prreview.Pass{sent, applied, plain}

	got := bindings.FromReviews([]reviewflow.State{state}, nil, reviewRepos)[0].Passes

	if len(got[0].Checks) != 1 || got[0].Checks[0].Name != "lint" || got[0].Mergeable != "mergeable" {
		t.Errorf("checks = %+v, mergeable = %q, want the ones of the reading that let the pass start",
			got[0].Checks, got[0].Mergeable)
	}
	if got[0].ChecksReadAt != readAt.Format(time.RFC3339) ||
		got[0].RecordedAt != readAt.Add(time.Minute).Format(time.RFC3339) ||
		got[0].SentAt != readAt.Add(2*time.Minute).Format(time.RFC3339) {
		t.Errorf("hours = %q %q %q, want the ones of the pass", got[0].ChecksReadAt, got[0].RecordedAt, got[0].SentAt)
	}
	if !got[0].SummaryPublished {
		t.Error("summaryPublished = false, want true")
	}
	for i, want := range []bool{true, true, false} {
		if got[i].Sent != want {
			t.Errorf("pass %d sent = %v, want %v", i+1, got[i].Sent, want)
		}
	}
	if got[2].Checks == nil || got[2].SentAt != "" || got[2].ChecksReadAt != "" {
		t.Errorf("pass without them = %+v, want empty checks and no hours", got[2])
	}
}

func TestFromTasksCarriesTheStructuredPassesOfThePullRequest(t *testing.T) {
	t.Parallel()

	recordedAt := time.Date(2026, 9, 27, 17, 28, 0, 0, time.UTC)
	sentAt := recordedAt.Add(time.Hour)
	anchored := prreport.Finding{
		Number: 1, Title: "The error is dropped", Path: "main.go", Line: 12,
		Original: "Handle it.", Text: "Handle it well.", Decision: prreport.DecisionApproved,
	}
	general := prreport.Finding{Number: 2, Title: "No tests", Original: "Add some.", Text: "Add some."}
	pr := flow.PullRequest{
		Status: flow.PRAwaitingDecision,
		Reports: []task.ReviewReport{
			{Pass: 1, File: "review-1.md", Clean: false},
			{Pass: 3, File: "review-3.md", Clean: true},
		},
		Passes: []task.PRPass{
			{Pass: 2, Recorded: false},
			{
				Pass: 3, Recorded: true, Clean: false, Revision: 2, RecordedAt: recordedAt, SentAt: sentAt,
				Findings: []prreport.Finding{anchored, general},
			},
		},
		Pass:       &task.PRPass{Pass: 3},
		Unreadable: "The report is not valid.",
		PR:         task.PRDetails{URL: "https://github.com/acme/api/pull/7"},
	}

	got := bindings.FromTasks(
		[]task.Task{{ID: "task-1", RepositoryID: convertRepo.ID, Name: "login-screen", Stage: task.StagePR}},
		func(string) task.Artifacts { return task.Artifacts{} },
		func(string) []flow.StepState { return nil },
		func(string) (flow.PullRequest, bool) { return pr, true },
		noWorktree,
		noConversations,
		repoOf,
		nil,
		nil,
	)
	if len(got) != 1 || got[0].PR == nil {
		t.Fatalf("FromTasks() = %+v, want one task with a pull request", got)
	}
	gotPR := got[0].PR

	if gotPR.CurrentPass != 3 {
		t.Errorf("currentPass = %d, want 3", gotPR.CurrentPass)
	}
	if gotPR.UnreadableReport != "The report is not valid." {
		t.Errorf("unreadableReport = %q, want the reason", gotPR.UnreadableReport)
	}

	wantURL := fmt.Sprintf("https://github.com/acme/api/pull/7/files#diff-%xR12", sha256.Sum256([]byte("main.go")))
	want := []bindings.PRReport{
		{Pass: 1, File: "review-1.md", Findings: []bindings.ReviewFinding{}},
		{Pass: 2, Structured: true, Findings: []bindings.ReviewFinding{}},
		{
			Pass: 3, File: "review-3.md", Structured: true, Recorded: true, Revision: 2, Edited: true,
			RecordedAt: "2026-09-27T17:28:00Z", SentAt: "2026-09-27T18:28:00Z",
			Findings: []bindings.ReviewFinding{
				{
					Number: 1, Title: "The error is dropped", Path: "main.go", Line: 12, LineURL: wantURL,
					Text: "Handle it well.", Decision: "approved",
				},
				{Number: 2, Title: "No tests", Text: "Add some."},
			},
		},
	}
	if diff := cmp.Diff(want, gotPR.Reports); diff != "" {
		t.Errorf("reports mismatch (-want +got):\n%s", diff)
	}
}

func TestFromRemovalCountsAndNamesTheRepositories(t *testing.T) {
	t.Parallel()

	got := bindings.FromRemoval(board.Removal{ToNoBoard: []string{"acme/web"}})

	want := bindings.BoardRemoval{ToNoBoard: 1, ToNoBoardNames: []string{"acme/web"}, RemovedNames: []string{}}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("FromRemoval() mismatch (-want +got):\n%s", diff)
	}
}
