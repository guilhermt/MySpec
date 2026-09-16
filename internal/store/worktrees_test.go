package store_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/store"
	"github.com/guilhermt/myspec/internal/worktree"
)

// listWorktrees reads the worktrees of the given tasks, failing the test on
// error.
func listWorktrees(t *testing.T, s *store.Store, taskIDs ...string) []worktree.Worktree {
	t.Helper()

	list, err := s.Worktrees.ListByTasks(t.Context(), taskIDs)
	if err != nil {
		t.Fatalf("ListByTasks(%v) = %v, want nil", taskIDs, err)
	}
	return list
}

func TestWorktreesInsertAndListByTask(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	taskID := seedTask(t, s)
	wt := newWorktree(taskID, "/home/dev/web", "/data/worktrees/dev/web/one", "one")
	if err := s.Worktrees.Insert(t.Context(), wt); err != nil {
		t.Fatalf("Insert() = %v, want nil", err)
	}

	if diff := cmp.Diff([]worktree.Worktree{wt}, listWorktrees(t, s, taskID)); diff != "" {
		t.Errorf("ListByTasks() mismatch (-want +got):\n%s", diff)
	}
}

func TestWorktreesAreListedForEveryTaskAsked(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	first := seedTask(t, s)
	const second = "task-2"
	if err := s.Tasks.Insert(t.Context(), newTask(second, webRepo, "two", fixedTime)); err != nil {
		t.Fatalf("Tasks.Insert(two) = %v, want nil", err)
	}

	one := newWorktree(first, "/home/dev/web", "/data/worktrees/dev/web/one", "one")
	two := newWorktree(second, "/home/dev/web", "/data/worktrees/dev/web/two", "two")
	for _, wt := range []worktree.Worktree{one, two} {
		if err := s.Worktrees.Insert(t.Context(), wt); err != nil {
			t.Fatalf("Insert(%s) = %v, want nil", wt.Path, err)
		}
	}

	want := []worktree.Worktree{one, two}
	if diff := cmp.Diff(want, listWorktrees(t, s, first, second)); diff != "" {
		t.Errorf("ListByTasks() mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]worktree.Worktree{one}, listWorktrees(t, s, first)); diff != "" {
		t.Errorf("ListByTasks(first) mismatch (-want +got):\n%s", diff)
	}
}

func TestWorktreesListOfNoTaskAsksNothing(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	if got := listWorktrees(t, s); got != nil {
		t.Errorf("ListByTasks() = %v, want nil", got)
	}
}

func TestWorktreesDeleteTakesTheOneOfTheTask(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	taskID := seedTask(t, s)
	wt := newWorktree(taskID, "/home/dev/web", "/data/worktrees/dev/web/one", "one")
	if err := s.Worktrees.Insert(t.Context(), wt); err != nil {
		t.Fatalf("Insert(%s) = %v, want nil", wt.Path, err)
	}

	if err := s.Worktrees.Delete(t.Context(), taskID); err != nil {
		t.Fatalf("Delete() = %v, want nil", err)
	}
	if got := listWorktrees(t, s, taskID); len(got) != 0 {
		t.Errorf("ListByTasks() returned %d worktrees, want none", len(got))
	}
	// A worktree that is not registered is not an error either.
	if err := s.Worktrees.Delete(t.Context(), taskID); err != nil {
		t.Errorf("Delete() again = %v, want nil", err)
	}
}

func TestWorktreesGoWithTheTask(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	taskID := seedTask(t, s)
	wt := newWorktree(taskID, "/home/dev/web", "/data/worktrees/dev/web/one", "one")
	if err := s.Worktrees.Insert(t.Context(), wt); err != nil {
		t.Fatalf("Insert() = %v, want nil", err)
	}

	if err := s.Tasks.Delete(t.Context(), taskID); err != nil {
		t.Fatalf("Tasks.Delete() = %v, want nil", err)
	}
	if got := listWorktrees(t, s, taskID); len(got) != 0 {
		t.Errorf("ListByTasks() returned %d worktrees, want the cascade to have taken them", len(got))
	}
}

func TestWorktreesRejectAnUnknownTask(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	wt := newWorktree("nope", "/home/dev/web", "/data/worktrees/dev/web/one", "one")
	if err := s.Worktrees.Insert(t.Context(), wt); err == nil {
		t.Error("Insert() = nil, want error")
	}
}
