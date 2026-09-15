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
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/workspace"
)

func TestFromWorkspace(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		in   *workspace.Workspace
		want *bindings.Workspace
	}{
		{name: "none", in: nil, want: nil},
		{
			name: "no repos",
			in:   &workspace.Workspace{Name: "code", Path: "/home/u/code"},
			want: &bindings.Workspace{Name: "code", Path: "/home/u/code", Repos: []bindings.Repo{}},
		},
		{
			name: "with repos",
			in: &workspace.Workspace{
				Name:  "code",
				Path:  "/home/u/code",
				Repos: []workspace.Repo{{Name: "api", Path: "/home/u/code/api"}},
			},
			want: &bindings.Workspace{
				Name:  "code",
				Path:  "/home/u/code",
				Repos: []bindings.Repo{{Name: "api", Path: "/home/u/code/api"}},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if diff := cmp.Diff(tt.want, bindings.FromWorkspace(tt.in)); diff != "" {
				t.Errorf("FromWorkspace() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestFromRecentsIsNeverNil(t *testing.T) {
	t.Parallel()

	got := bindings.FromRecents(nil)
	if got == nil {
		t.Fatal("FromRecents(nil) = nil, want an empty slice")
	}
	if len(got) != 0 {
		t.Errorf("len(FromRecents(nil)) = %d, want 0", len(got))
	}
}

func TestFromRecentsDropsTheTimestamp(t *testing.T) {
	t.Parallel()

	in := []workspace.Recent{
		{Name: "code", Path: "/home/u/code", LastOpenedAt: time.Now()},
		{Name: "work", Path: "/home/u/work", LastOpenedAt: time.Now()},
	}
	want := []bindings.Recent{
		{Name: "code", Path: "/home/u/code"},
		{Name: "work", Path: "/home/u/work"},
	}

	if diff := cmp.Diff(want, bindings.FromRecents(in)); diff != "" {
		t.Errorf("FromRecents() mismatch (-want +got):\n%s", diff)
	}
}

func TestFromNotice(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		in   *workspace.Notice
		want *bindings.Notice
	}{
		{name: "none", in: nil, want: nil},
		{
			name: "missing path",
			in:   &workspace.Notice{Path: "/gone", Reason: workspace.ReasonNotFound},
			want: &bindings.Notice{Path: "/gone", Reason: "not_found"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if diff := cmp.Diff(tt.want, bindings.FromNotice(tt.in)); diff != "" {
				t.Errorf("FromNotice() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestFromTasksCarriesTheStateOfEachStep(t *testing.T) {
	t.Parallel()

	tasks := []task.Task{{ID: "task-1", Name: "login-screen", WorkspacePath: "/home/u/code", Stage: task.StageImplementation}}
	states := []flow.StepState{
		{
			Step:   task.Step{Number: 1, File: "1-first.md", Title: "First", Repository: "api", RepoPath: "/home/u/code/api"},
			Status: flow.StepBlocked,
			Block: &task.StepBlock{
				Reason: task.BlockDirty,
				Detail: " M main.go",
				Files:  1,
			},
			WorktreePath: "/home/u/code/.myspec/worktrees/api/login-screen",
		},
		{
			Step:   task.Step{Number: 2, File: "2-second.md", Title: "Second", Repository: "api", RepoPath: "/home/u/code/api"},
			Status: flow.StepPreparing,
			Phase:  flow.PhaseFetching,
		},
		{
			Step:     task.Step{Number: 3, File: "3-third.md", Title: "Third", Repository: "api", RepoPath: "/home/u/code/api"},
			Status:   flow.StepNotStarted,
			Choice:   models.Choice{Model: models.Opus5, Effort: models.XHigh},
			Adjusted: true,
		},
	}
	want := []bindings.Step{
		{
			Number: 1, File: "1-first.md", Title: "First",
			Repository: "api", RepoPath: "/home/u/code/api", Status: "blocked",
			Block:        &bindings.StepBlock{Reason: "dirty_worktree", Detail: " M main.go", Files: 1},
			WorktreePath: "/home/u/code/.myspec/worktrees/api/login-screen",
		},
		{
			Number: 2, File: "2-second.md", Title: "Second",
			Repository: "api", RepoPath: "/home/u/code/api", Status: "preparing", Phase: "fetching",
		},
		{
			Number: 3, File: "3-third.md", Title: "Third",
			Repository: "api", RepoPath: "/home/u/code/api", Status: "not_started",
			Model: "claude-opus-5", Effort: "xhigh", Adjusted: true, ModelEditable: true,
		},
	}

	got := bindings.FromTasks(
		tasks,
		func(string) task.Artifacts { return task.Artifacts{} },
		func(string) []flow.StepState { return states },
		noRepos,
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

func TestFromTasksHasNoCurrentStepWithoutAPlan(t *testing.T) {
	t.Parallel()

	got := bindings.FromTasks(
		[]task.Task{{ID: "task-1", Name: "login-screen", Stage: task.StagePRD}},
		func(string) task.Artifacts { return task.Artifacts{} },
		func(string) []flow.StepState { return nil },
		noRepos,
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
		Step:   task.Step{Number: 1, File: "1-first.md", Title: "First", Repository: "api"},
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
				noRepos,
				nil,
				nil,
			)
			if got[0].CurrentStep != test.want {
				t.Errorf("currentStep = %d, want %d", got[0].CurrentStep, test.want)
			}
		})
	}
}

// noRepos is the PR stage of a task that has not reached it.
func noRepos(string) []flow.RepoState { return nil }

// stepsOf converts the steps of a single implementing task, which is what
// every step conversion test needs.
func stepsOf(t *testing.T, states []flow.StepState) []bindings.Step {
	t.Helper()

	got := bindings.FromTasks(
		[]task.Task{{ID: "task-1", Name: "login-screen", Stage: task.StageImplementation}},
		func(string) task.Artifacts { return task.Artifacts{} },
		func(string) []flow.StepState { return states },
		noRepos,
		nil,
		nil,
	)
	if len(got) != 1 {
		t.Fatalf("len(FromTasks()) = %d, want 1", len(got))
	}
	return got[0].Steps
}

func TestFromTasksCarriesWhatClosingARepositoryDid(t *testing.T) {
	t.Parallel()

	closedAt := time.Date(2026, 9, 8, 18, 30, 0, 0, time.UTC)
	states := []flow.RepoState{
		{
			Repository: "api",
			RepoPath:   "/home/u/code/api",
			Slug:       "api",
			Status:     flow.RepoClosed,
			PR: task.PRDetails{
				Number: 7, URL: "https://github.com/acme/api/pull/7", State: task.PRStateMerged, Base: "dev",
			},
			Close: &task.CloseResult{
				Worktree:     task.CloseStep{Outcome: task.OutcomeDone},
				Branch:       task.CloseStep{Outcome: task.OutcomeSkipped, Reason: task.SkipNotMerged, Detail: "login-screen"},
				Base:         task.CloseStep{Outcome: task.OutcomeFailed, Detail: "git merge: refusing"},
				WorktreePath: "/home/u/code/.myspec/worktrees/api/login-screen",
				BranchName:   "login-screen",
				BaseBranch:   "dev",
				BaseCommits:  3,
				ClosedAt:     closedAt,
			},
		},
		{
			Repository: "web",
			RepoPath:   "/home/u/code/web",
			Slug:       "web",
			Status:     flow.RepoDone,
			PR:         task.PRDetails{Number: 8, State: task.PRStateOpen, Base: "dev"},
			CheckError: "gh pr view: connection refused",
			CanClose:   true,
		},
	}

	got := bindings.FromTasks(
		[]task.Task{{ID: "task-1", Name: "login-screen", Stage: task.StagePR}},
		func(string) task.Artifacts { return task.Artifacts{} },
		func(string) []flow.StepState { return nil },
		func(string) []flow.RepoState { return states },
		nil,
		nil,
	)
	if len(got) != 1 {
		t.Fatalf("len(FromTasks()) = %d, want 1", len(got))
	}

	want := &bindings.CloseResult{
		Worktree:     bindings.CloseStep{Outcome: "done"},
		Branch:       bindings.CloseStep{Outcome: "skipped", Reason: "not_merged", Detail: "login-screen"},
		Base:         bindings.CloseStep{Outcome: "failed", Detail: "git merge: refusing"},
		WorktreePath: "/home/u/code/.myspec/worktrees/api/login-screen",
		BranchName:   "login-screen",
		BaseBranch:   "dev",
		BaseCommits:  3,
		ClosedAt:     "2026-09-08T18:30:00Z",
	}
	if diff := cmp.Diff(want, got[0].Repos[0].Close); diff != "" {
		t.Errorf("close result mismatch (-want +got):\n%s", diff)
	}
	if got[0].Repos[0].PRBase != "dev" || got[0].Repos[0].CanClose {
		t.Errorf("api = %+v, want the base of the pull request and no closing to offer", got[0].Repos[0])
	}
	// A repository whose reading failed is offered the closing, with what the
	// reading said.
	web := got[0].Repos[1]
	if web.Close != nil {
		t.Errorf("close result of web = %+v, want nil on a repository that is not closed", web.Close)
	}
	if web.CheckError != "gh pr view: connection refused" || !web.CanClose {
		t.Errorf("web = %+v, want the failed reading and the closing offered", web)
	}
}

func TestFromArchivedCarriesTheDocumentsAndThePullRequests(t *testing.T) {
	t.Parallel()

	createdAt := time.Date(2026, 9, 1, 9, 0, 0, 0, time.UTC)
	archivedAt := time.Date(2026, 9, 8, 18, 30, 0, 0, time.UTC)
	tasks := []task.Task{{
		ID:              "task-1",
		Name:            "login-screen",
		WorkspacePath:   "/home/u/code",
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
				{Number: 1, File: "1-first.md", Title: "First", Repository: "api", RepoPath: "/home/u/code/api"},
				{Number: 2, File: "2-second.md", Title: "Second", Repository: "web", RepoPath: "/home/u/code/web"},
			},
		},
	}
	runs := []task.PRRun{
		{
			RepoPath: "/home/u/code/api",
			Status:   task.PRClosed,
			PR: task.PRDetails{
				Number: 7, URL: "https://github.com/acme/api/pull/7", State: task.PRStateMerged,
			},
		},
		{RepoPath: "/home/u/code/web", Status: task.PRClosed},
	}

	want := []bindings.ArchivedTask{{
		ID:          "task-1",
		Name:        "login-screen",
		HasPRD:      true,
		HasTechSpec: true,
		Steps: []bindings.ArchivedStep{
			{Number: 1, File: "1-first.md", Title: "First", Repository: "api"},
			{Number: 2, File: "2-second.md", Title: "Second", Repository: "web"},
		},
		Repos: []bindings.ArchivedRepo{
			{
				Repository: "api",
				RepoPath:   "/home/u/code/api",
				PRNumber:   7,
				PRURL:      "https://github.com/acme/api/pull/7",
				PRState:    "merged",
			},
			{Repository: "web", RepoPath: "/home/u/code/web"},
		},
		ArtifactVersion: 4,
		CreatedAt:       "2026-09-01T09:00:00Z",
		ArchivedAt:      "2026-09-08T18:30:00Z",
	}}

	got := bindings.FromArchived(
		tasks,
		func(string) task.Artifacts { return artifacts },
		func(string) []task.PRRun { return runs },
	)
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("history mismatch (-want +got):\n%s", diff)
	}
}

func TestFromArchivedAllocatesEveryList(t *testing.T) {
	t.Parallel()

	got := bindings.FromArchived(
		[]task.Task{{ID: "task-1", Name: "login-screen"}},
		func(string) task.Artifacts { return task.Artifacts{} },
		func(string) []task.PRRun { return nil },
	)
	if len(got) != 1 {
		t.Fatalf("len(FromArchived()) = %d, want 1", len(got))
	}
	// The frontend maps over both lists without checking for null.
	if got[0].Steps == nil || got[0].Repos == nil {
		t.Errorf("archived task = %+v, want empty slices", got[0])
	}
}

func TestFromDeletePreviewCarriesWhatWouldBeDestroyed(t *testing.T) {
	t.Parallel()

	preview := flow.DeletePreview{
		SessionRunning: true,
		Worktrees: []flow.WorktreePreview{{
			Repository: "api",
			RepoPath:   "/home/u/code/api",
			Path:       "/home/u/code/.myspec/worktrees/api/login-screen",
			Dirty:      true,
			Files:      2,
		}},
		Branches: []flow.BranchPreview{{
			Repository: "api",
			RepoPath:   "/home/u/code/api",
			Name:       "login-screen",
			Error:      "git merge-base: bad revision",
		}},
		PRs: []flow.PRPreview{{
			Repository: "api",
			RepoPath:   "/home/u/code/api",
			Number:     7,
			URL:        "https://github.com/acme/api/pull/7",
			State:      task.PRStateOpen,
		}},
	}
	want := bindings.DeletePreview{
		SessionRunning: true,
		Worktrees: []bindings.WorktreePreview{{
			Repository: "api",
			RepoPath:   "/home/u/code/api",
			Path:       "/home/u/code/.myspec/worktrees/api/login-screen",
			Dirty:      true,
			Files:      2,
		}},
		Branches: []bindings.BranchPreview{{
			Repository: "api",
			RepoPath:   "/home/u/code/api",
			Name:       "login-screen",
			Error:      "git merge-base: bad revision",
		}},
		PRs: []bindings.PRPreview{{
			Repository: "api",
			RepoPath:   "/home/u/code/api",
			Number:     7,
			URL:        "https://github.com/acme/api/pull/7",
			State:      "open",
		}},
	}

	if diff := cmp.Diff(want, bindings.FromDeletePreview(preview)); diff != "" {
		t.Errorf("preview mismatch (-want +got):\n%s", diff)
	}
}

func TestFromDeletePreviewAndResultAllocateEveryList(t *testing.T) {
	t.Parallel()

	preview := bindings.FromDeletePreview(flow.DeletePreview{})
	if preview.Worktrees == nil || preview.Branches == nil || preview.PRs == nil {
		t.Errorf("preview = %+v, want empty slices", preview)
	}
	if leftovers := bindings.FromDeleteResult(flow.DeleteResult{}).Leftovers; leftovers == nil {
		t.Error("leftovers = nil, want an empty slice")
	}
}

func TestFromDeleteResultNamesTheRepositoryOfWhatStayed(t *testing.T) {
	t.Parallel()

	result := flow.DeleteResult{Leftovers: []flow.LeftoverInfo{{
		Repository: "api",
		RepoPath:   "/home/u/code/api",
		Path:       "/home/u/code/.myspec/worktrees/api/login-screen",
		Branch:     "login-screen",
		Error:      "git worktree remove: permission denied",
	}}}
	want := bindings.DeleteResult{Leftovers: []bindings.Leftover{{
		Repository: "api",
		RepoPath:   "/home/u/code/api",
		Path:       "/home/u/code/.myspec/worktrees/api/login-screen",
		Branch:     "login-screen",
		Error:      "git worktree remove: permission denied",
	}}}

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
		noRepos,
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
		noRepos,
		summaries,
		nil,
	)
	if got[0].SessionStatus != "waiting" {
		t.Errorf("sessionStatus = %q, want waiting: every step is committed", got[0].SessionStatus)
	}
}

func TestFromTasksCarriesTheRepositoriesOfThePRStage(t *testing.T) {
	t.Parallel()

	checkedAt := time.Date(2026, 9, 5, 10, 0, 0, 0, time.UTC)
	states := []flow.RepoState{
		{
			Repository:   "api",
			RepoPath:     "/home/u/code/api",
			Slug:         "api",
			Status:       flow.RepoReadyToApprove,
			WorktreePath: "/home/u/code/.myspec/worktrees/api/login-screen",
			Branch:       "login-screen",
			BaseBranch:   "origin/dev",
			Draft:        &task.Draft{Present: true, Title: "Add the login screen", Body: "It adds the screen."},
			Reports:      []task.ReviewReport{{Pass: 1, File: "api-review-1.md", Clean: false}},
			Review:       &review.Snapshot{Staged: 2, Total: 2},
			PR: task.PRDetails{
				Number: 7, URL: "https://github.com/acme/api/pull/7", State: task.PRStateOpen, CheckedAt: checkedAt,
			},
			SessionStage: "pr_review:api",
			Session: session.Summary{
				Status:         session.StatusWaiting,
				ContextPercent: 30,
				Choice:         models.Choice{Model: models.Opus5, Effort: models.Medium},
			},
		},
		{
			Repository: "web",
			RepoPath:   "/home/u/code/web",
			Slug:       "web",
			Status:     flow.RepoBlocked,
			Block:      &task.PRBlock{Reason: task.PRBlockGHAuth, Detail: "gh: not authenticated"},
		},
	}

	got := bindings.FromTasks(
		[]task.Task{{ID: "task-1", Name: "login-screen", Stage: task.StagePR}},
		func(string) task.Artifacts { return task.Artifacts{} },
		func(string) []flow.StepState { return nil },
		func(string) []flow.RepoState { return states },
		map[session.Key]session.Summary{
			{TaskID: "task-1", Stage: "pr_review:api"}: {Status: session.StatusWaiting},
		},
		nil,
	)
	if len(got) != 1 {
		t.Fatalf("len(FromTasks()) = %d, want 1", len(got))
	}

	want := []bindings.RepoPR{
		{
			Repository:   "api",
			RepoPath:     "/home/u/code/api",
			Slug:         "api",
			Status:       "ready_to_approve",
			WorktreePath: "/home/u/code/.myspec/worktrees/api/login-screen",
			Branch:       "login-screen",
			BaseBranch:   "origin/dev",
			Draft: &bindings.PRDraft{
				Title: "Add the login screen", Body: "It adds the screen.", File: "api-draft.md",
			},
			Reports: []bindings.PRReport{{Pass: 1, File: "api-review-1.md"}},
			Review: &bindings.Review{
				Files: []bindings.ReviewFile{}, Staged: 2, Total: 2, Percent: 100,
			},
			PRNumber:       7,
			PRURL:          "https://github.com/acme/api/pull/7",
			PRState:        "open",
			CheckedAt:      "2026-09-05T10:00:00Z",
			SessionStage:   "pr_review:api",
			SessionStatus:  "waiting",
			SessionModel:   "claude-opus-5",
			SessionEffort:  "medium",
			ContextPercent: 30,
		},
		{
			Repository: "web",
			RepoPath:   "/home/u/code/web",
			Slug:       "web",
			Status:     "blocked",
			Block:      &bindings.PRBlock{Reason: "gh_unauthenticated", Detail: "gh: not authenticated"},
			Reports:    []bindings.PRReport{},
		},
	}
	if diff := cmp.Diff(want, got[0].Repos); diff != "" {
		t.Errorf("repositories mismatch (-want +got):\n%s", diff)
	}
	// The PR stage has no conversation of its own: every one of them belongs
	// to a repository, and the fields of the task stay empty.
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
		noRepos,
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

func TestFromModelSetIsInWorkflowOrder(t *testing.T) {
	t.Parallel()

	want := []bindings.StageModel{
		{Stage: "prd", Model: "claude-fable-5-1", Effort: "high"},
		{Stage: "tech_spec", Model: "claude-fable-5-1", Effort: "high"},
		{Stage: "plan", Model: "claude-fable-5-1", Effort: "high"},
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
				Place:     attention.Place{Kind: attention.PlaceRepo, RepoPath: "/home/u/code/api", Repository: "api"},
				Kind:      attention.KindPRBlocked,
				StartedAt: startedAt.Add(time.Minute),
			},
			{
				ID:        "s3",
				TaskID:    "task-2",
				Place:     attention.Place{Kind: attention.PlaceRepo, RepoPath: "/home/u/code/web", Repository: "web"},
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
		noRepos,
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
				Place:     bindings.Place{Kind: "repo", RepoPath: "/home/u/code/api", Repository: "api"},
				StartedAt: "2026-09-11T09:31:00Z",
			},
			{
				ID:        "s3",
				TaskID:    "task-2",
				Kind:      "changes_review",
				Group:     "waiting",
				Form:      "staged",
				Percent:   50,
				Place:     bindings.Place{Kind: "repo", RepoPath: "/home/u/code/web", Repository: "web"},
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
