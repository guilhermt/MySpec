package bindings_test

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/git"
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
	}

	got := bindings.FromTasks(
		tasks,
		func(string) task.Artifacts { return task.Artifacts{} },
		func(string) []flow.StepState { return states },
		noRepos,
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
			Session:      session.Summary{Status: session.StatusWaiting, ContextPercent: 30},
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
