package store_test

import (
	"errors"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

func TestTasksInsertAndGet(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	want := newTask("task-1", "/ws", "one", fixedTime)
	want.RepoPath = "/ws/api"
	if err := s.Tasks.Insert(t.Context(), want); err != nil {
		t.Fatalf("Insert() = %v, want nil", err)
	}

	got, err := s.Tasks.Get(t.Context(), want.ID)
	if err != nil {
		t.Fatalf("Get() = %v, want nil", err)
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("Get() mismatch (-want +got):\n%s", diff)
	}
}

func TestTasksInsertKeepsARootTaskWithoutARepository(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	want := newTask("task-1", "/ws", "one", fixedTime)
	if err := s.Tasks.Insert(t.Context(), want); err != nil {
		t.Fatalf("Insert() = %v, want nil", err)
	}

	got, err := s.Tasks.Get(t.Context(), want.ID)
	if err != nil {
		t.Fatalf("Get() = %v, want nil", err)
	}
	if got.RepoPath != "" {
		t.Errorf("RepoPath = %q, want empty", got.RepoPath)
	}
}

func TestTasksGetMissingIsNotFound(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	if _, err := s.Tasks.Get(t.Context(), "nope"); !errors.Is(err, task.ErrNotFound) {
		t.Errorf("Get() = %v, want task.ErrNotFound", err)
	}
}

func TestTasksListByWorkspaceIsInCreationOrder(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	later := fixedTime.Add(time.Hour)
	for _, tk := range []task.Task{
		newTask("task-2", "/ws", "second", later),
		newTask("task-1", "/ws", "first", fixedTime),
		newTask("task-3", "/other", "elsewhere", fixedTime),
	} {
		if err := s.Tasks.Insert(t.Context(), tk); err != nil {
			t.Fatalf("Insert(%s) = %v, want nil", tk.Name, err)
		}
	}

	tasks, err := s.Tasks.ListByWorkspace(t.Context(), "/ws")
	if err != nil {
		t.Fatalf("ListByWorkspace() = %v, want nil", err)
	}

	got := make([]string, 0, len(tasks))
	for _, tk := range tasks {
		got = append(got, tk.Name)
	}
	if diff := cmp.Diff([]string{"first", "second"}, got); diff != "" {
		t.Errorf("ListByWorkspace() mismatch (-want +got):\n%s", diff)
	}
}

func TestTasksInsertRejectsARepeatedName(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	if err := s.Tasks.Insert(t.Context(), newTask("task-1", "/ws", "one", fixedTime)); err != nil {
		t.Fatalf("Insert() = %v, want nil", err)
	}

	err := s.Tasks.Insert(t.Context(), newTask("task-2", "/ws", "one", fixedTime))
	if !errors.Is(err, task.ErrNameTaken) {
		t.Errorf("Insert() = %v, want task.ErrNameTaken", err)
	}
}

func TestTasksInsertAllowsTheSameNameInAnotherWorkspace(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	if err := s.Tasks.Insert(t.Context(), newTask("task-1", "/ws", "one", fixedTime)); err != nil {
		t.Fatalf("Insert() = %v, want nil", err)
	}
	if err := s.Tasks.Insert(t.Context(), newTask("task-2", "/other", "one", fixedTime)); err != nil {
		t.Errorf("Insert() = %v, want nil", err)
	}
}

func TestTasksUpdateStage(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	tk := newTask("task-1", "/ws", "one", fixedTime)
	tk.ArtifactVersion = 3
	if err := s.Tasks.Insert(t.Context(), tk); err != nil {
		t.Fatalf("Insert() = %v, want nil", err)
	}

	updatedAt := fixedTime.Add(time.Minute)
	if err := s.Tasks.UpdateStage(t.Context(), tk.ID, string(task.StageTechSpec), true, updatedAt); err != nil {
		t.Fatalf("UpdateStage() = %v, want nil", err)
	}

	got, err := s.Tasks.Get(t.Context(), tk.ID)
	if err != nil {
		t.Fatalf("Get() = %v, want nil", err)
	}
	if got.Stage != task.StageTechSpec || !got.Revisiting || !got.UpdatedAt.Equal(updatedAt) {
		t.Errorf("Get() = %q revisiting=%t %v, want %q revisiting=true %v",
			got.Stage, got.Revisiting, got.UpdatedAt, task.StageTechSpec, updatedAt)
	}
	if got.ArtifactVersion != 3 {
		t.Errorf("ArtifactVersion = %d, want the stage update to leave it alone", got.ArtifactVersion)
	}
}

func TestTasksUpdateArtifactVersion(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	tk := newTask("task-1", "/ws", "one", fixedTime)
	tk.Stage = task.StagePlan
	tk.Revisiting = true
	if err := s.Tasks.Insert(t.Context(), tk); err != nil {
		t.Fatalf("Insert() = %v, want nil", err)
	}

	updatedAt := fixedTime.Add(time.Minute)
	if err := s.Tasks.UpdateArtifactVersion(t.Context(), tk.ID, 7, updatedAt); err != nil {
		t.Fatalf("UpdateArtifactVersion() = %v, want nil", err)
	}

	got, err := s.Tasks.Get(t.Context(), tk.ID)
	if err != nil {
		t.Fatalf("Get() = %v, want nil", err)
	}
	if got.ArtifactVersion != 7 || !got.UpdatedAt.Equal(updatedAt) {
		t.Errorf("Get() = %d %v, want 7 %v", got.ArtifactVersion, got.UpdatedAt, updatedAt)
	}
	if got.Stage != task.StagePlan || !got.Revisiting {
		t.Errorf("Get() = %q revisiting=%t, want the stage left alone", got.Stage, got.Revisiting)
	}
}

func TestTasksDeleteCascadesToTheSessionAndItsEntries(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	taskID, sessionID := seedSession(t, s)
	if err := s.Entries.Insert(t.Context(), sessionID, newEntry("entry-1", 1, "hello")); err != nil {
		t.Fatalf("Entries.Insert() = %v, want nil", err)
	}

	if err := s.Tasks.Delete(t.Context(), taskID); err != nil {
		t.Fatalf("Delete() = %v, want nil", err)
	}

	if _, err := s.Tasks.Get(t.Context(), taskID); !errors.Is(err, task.ErrNotFound) {
		t.Errorf("Get() = %v, want task.ErrNotFound", err)
	}
	if _, err := s.Sessions.Get(t.Context(), taskID, string(task.StagePRD)); !errors.Is(err, session.ErrNotFound) {
		t.Errorf("Sessions.Get() = %v, want session.ErrNotFound", err)
	}
	entries, err := s.Entries.List(t.Context(), sessionID)
	if err != nil {
		t.Fatalf("Entries.List() = %v, want nil", err)
	}
	if len(entries) != 0 {
		t.Errorf("Entries.List() returned %d entries, want none", len(entries))
	}
}

func TestTasksDeleteMissingIsNotAnError(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	if err := s.Tasks.Delete(t.Context(), "nope"); err != nil {
		t.Errorf("Delete() = %v, want nil", err)
	}
}
