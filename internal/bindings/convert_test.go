package bindings_test

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/attention"
	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/reviewmode"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
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
			Choice:   models.Choice{Model: models.Opus5, Effort: models.XHigh},
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
			Model:  "claude-opus-5", Effort: "xhigh", Adjusted: true, ModelEditable: true,
			ReviewModeEditable: true, Reports: []bindings.StepReport{},
		},
	}

	got := bindings.FromTasks(
		tasks,
		func(string) task.Artifacts { return task.Artifacts{} },
		func(string) []flow.StepState { return states },
		noPR,
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
				Choice:         models.Choice{Model: models.Opus5, Effort: models.High},
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
				SessionModel:   "claude-opus-5",
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
			1: {{Pass: 1, File: "1-review-1.md"}, {Pass: 2, File: "1-review-2.md", Clean: true}},
		},
	}
	want := []bindings.ArchivedStep{
		{
			Number: 1, File: "1-first.md", Title: "First",
			Reports: []bindings.StepReport{
				{Pass: 1, File: "1-review-1.md"},
				{Pass: 2, File: "1-review-2.md", Clean: true},
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
	want := &bindings.MarkerEntry{Type: "step_started", Step: 2, Restarted: true}
	if diff := cmp.Diff(want, got.Marker); diff != "" {
		t.Errorf("marker mismatch (-want +got):\n%s", diff)
	}
}

func TestFromEntryCarriesTheVerdictOfAStepReviewMarker(t *testing.T) {
	t.Parallel()

	got := bindings.FromEntry(session.Entry{
		Kind:   session.KindMarker,
		Marker: &session.MarkerEntry{Type: session.MarkerStepReviewWritten, Pass: 2, Clean: true},
	})
	want := &bindings.MarkerEntry{Type: "step_review_written", Pass: 2, Clean: true}
	if diff := cmp.Diff(want, got.Marker); diff != "" {
		t.Errorf("marker mismatch (-want +got):\n%s", diff)
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
			Choice:         models.Choice{Model: models.Opus5, Effort: models.Medium},
		},
	}

	got := bindings.FromTasks(
		[]task.Task{{ID: "task-1", RepositoryID: convertRepo.ID, Name: "login-screen", Stage: task.StagePR}},
		func(string) task.Artifacts { return task.Artifacts{} },
		func(string) []flow.StepState { return nil },
		func(string) (flow.PullRequest, bool) { return pr, true },
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
		Reports: []bindings.PRReport{{Pass: 1, File: "review-1.md"}},
		Review: &bindings.Review{
			Files: []bindings.ReviewFile{}, Staged: 2, Total: 2, Percent: 100,
		},
		PRNumber:       7,
		PRURL:          "https://github.com/acme/api/pull/7",
		PRState:        "open",
		CheckedAt:      "2026-09-05T10:00:00Z",
		SessionStage:   "pr_review",
		SessionStatus:  "waiting",
		SessionModel:   "claude-opus-5",
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
			models.Implementation: {Model: models.Opus5, Effort: models.High},
			models.StepReview:     {Model: models.Opus5, Effort: models.High},
			models.PR:             {Model: models.Opus5, Effort: models.Medium},
			models.PRReview:       {Model: models.Sonnet5, Effort: models.Low},
		}},
	}}

	got := bindings.FromTasks(
		tasks,
		func(string) task.Artifacts { return task.Artifacts{} },
		func(string) []flow.StepState { return nil },
		noPR,
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
		{Stage: "implementation", Model: "claude-opus-5", Effort: "high", Editable: true},
		{Stage: "step_review", Model: "claude-opus-5", Effort: "high", Editable: true},
		{Stage: "pr", Model: "claude-opus-5", Effort: "medium", Editable: true},
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
		{Stage: "implementation", Model: "claude-opus-5", Effort: "high"},
		{Stage: "step_review", Model: "claude-opus-5", Effort: "high"},
		{Stage: "pr", Model: "claude-opus-5", Effort: "medium"},
		{Stage: "pr_review", Model: "claude-opus-5", Effort: "high"},
	}

	if diff := cmp.Diff(want, bindings.FromModelSet(models.Factory())); diff != "" {
		t.Errorf("FromModelSet() mismatch (-want +got):\n%s", diff)
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
