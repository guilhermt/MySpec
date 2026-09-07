package bindings_test

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/flow"
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
