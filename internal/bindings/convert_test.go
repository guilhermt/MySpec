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
				nil,
			)
			if got[0].CurrentStep != test.want {
				t.Errorf("currentStep = %d, want %d", got[0].CurrentStep, test.want)
			}
		})
	}
}

// stepsOf converts the steps of a single implementing task, which is what
// every step conversion test needs.
func stepsOf(t *testing.T, states []flow.StepState) []bindings.Step {
	t.Helper()

	got := bindings.FromTasks(
		[]task.Task{{ID: "task-1", Name: "login-screen", Stage: task.StageImplementation}},
		func(string) task.Artifacts { return task.Artifacts{} },
		func(string) []flow.StepState { return states },
		nil,
	)
	if len(got) != 1 {
		t.Fatalf("len(FromTasks()) = %d, want 1", len(got))
	}
	return got[0].Steps
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
