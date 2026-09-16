package bindings_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/bindings"
)

func TestGetStateHandsTheFrontendTheSnapshot(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	dir := t.TempDir()
	f.register(t, dir)

	got := f.state.GetState()

	want := []bindings.Repository{{
		ID:       testRepoID,
		Owner:    "dev",
		Name:     "web",
		FullName: "dev/web",
		Path:     dir,
	}}
	if diff := cmp.Diff(want, got.Repositories); diff != "" {
		t.Errorf("repositories mismatch (-want +got):\n%s", diff)
	}
	if got.RepositoryFilter != "" {
		t.Errorf("filter = %q, want every repository", got.RepositoryFilter)
	}
	// The frontend maps over both lists without checking for null.
	if got.Tasks == nil || got.History == nil {
		t.Errorf("state = %+v, want empty slices", got)
	}
}

func TestGetStateCountsTheTasksOfEachRepository(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())

	id, err := f.tasks.CreateTask(newTask("login-screen"))
	if err != nil {
		t.Fatalf("CreateTask() = %v, want nil", err)
	}
	f.waitForStatus(t, id, "waiting")

	got := f.state.GetState().Repositories
	if len(got) != 1 {
		t.Fatalf("repositories = %+v, want the one registered", got)
	}
	if got[0].ActiveTasks != 1 || got[0].ArchivedTasks != 0 {
		t.Errorf("counts = %d active, %d archived, want 1 and 0", got[0].ActiveTasks, got[0].ArchivedTasks)
	}
}
