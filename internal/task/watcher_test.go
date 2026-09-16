package task_test

import (
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/task"
)

// quietFor is how long a test waits to be sure no further debounce fires.
const quietFor = 400 * time.Millisecond

// kinds lists the artifacts a recorded call carried, in order.
func kinds(call artifactCall) []task.ArtifactKind {
	out := make([]task.ArtifactKind, 0, len(call.Changes))
	for _, c := range call.Changes {
		out = append(out, c.Kind)
	}
	return out
}

func TestWatcherReportsThePRDOnceForABurstOfWrites(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")

	// The agent writes the file in pieces, the way a tool call streams it out.
	for i := range 5 {
		writePRD(t, created, "# PRD "+strconv.Itoa(i))
		time.Sleep(20 * time.Millisecond)
	}

	waitFor(t, "the PRD to be reported", func() bool { return len(f.artifactCalls()) > 0 })
	// Long enough for a second debounce to have fired, had one been armed.
	time.Sleep(quietFor)

	calls := f.artifactCalls()
	if len(calls) != 1 {
		t.Fatalf("OnArtifact ran %d times, want 1", len(calls))
	}
	change, ok := calls[0].change(task.ArtifactPRD)
	if !ok {
		t.Fatalf("changes = %v, want the PRD", kinds(calls[0]))
	}
	if !change.First {
		t.Error("First = false, want true for the PRD appearing")
	}
	if got := calls[0].Task.ArtifactVersion; got != 1 {
		t.Errorf("ArtifactVersion = %d, want 1", got)
	}

	if cached, _ := f.service.Artifacts(created.ID); !cached.PRD {
		t.Error("Artifacts().PRD = false, want the cache refreshed")
	}
	if stored := f.repo.get(t, created.ID); stored.ArtifactVersion != 1 {
		t.Errorf("stored artifact version = %d, want 1", stored.ArtifactVersion)
	}
	if stored := f.repo.get(t, created.ID); stored.Stage != task.StagePRD {
		t.Errorf("stored stage = %q, want the watcher to leave the stage alone", stored.Stage)
	}
}

func TestWatcherReportsARewriteWithoutFirst(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")

	writePRD(t, created, "# PRD")
	waitFor(t, "the PRD to appear", func() bool { return len(f.artifactCalls()) == 1 })

	writePRD(t, created, "# PRD, adjusted")
	waitFor(t, "the PRD to be rewritten", func() bool { return len(f.artifactCalls()) == 2 })

	calls := f.artifactCalls()
	change, ok := calls[1].change(task.ArtifactPRD)
	if !ok {
		t.Fatalf("changes = %v, want the PRD", kinds(calls[1]))
	}
	if change.First {
		t.Error("First = true on the rewrite, want false")
	}
	if got := calls[1].Task.ArtifactVersion; got != 2 {
		t.Errorf("ArtifactVersion = %d, want 2", got)
	}
}

func TestWatcherReportsTheTechSpec(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")

	writeTechSpec(t, created, "# Tech spec")
	waitFor(t, "the tech spec to be reported", func() bool { return len(f.artifactCalls()) == 1 })

	call := f.artifactCalls()[0]
	if got := kinds(call); !slices.Equal(got, []task.ArtifactKind{task.ArtifactTechSpec}) {
		t.Fatalf("changes = %v, want the tech spec alone", got)
	}
	if change, _ := call.change(task.ArtifactTechSpec); !change.First {
		t.Error("First = false, want true for the tech spec appearing")
	}
}

func TestWatcherReportsTheOneShotDocument(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.createOneShot(t, "add-login")

	writeOneShot(t, created, "# Add the login — One-Shot")
	waitFor(t, "the One-Shot document to be reported", func() bool { return len(f.artifactCalls()) == 1 })

	call := f.artifactCalls()[0]
	if got := kinds(call); !slices.Equal(got, []task.ArtifactKind{task.ArtifactOneShot}) {
		t.Fatalf("changes = %v, want the One-Shot document alone", got)
	}
	if change, _ := call.change(task.ArtifactOneShot); !change.First {
		t.Error("First = false, want true for the One-Shot document appearing")
	}
	if cached, _ := f.service.Artifacts(created.ID); !cached.OneShot {
		t.Error("Artifacts().OneShot = false, want the cache refreshed")
	}
}

func TestWatcherReportsThePlanOnlyOnceItIsValid(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")

	// A step with no title is a plan with a problem, not a plan.
	if err := os.MkdirAll(created.StepsDir(), 0o700); err != nil {
		t.Fatalf("create steps directory: %v", err)
	}
	writeFile(t, filepath.Join(created.StepsDir(), "1-add-the-store.md"), "Just a paragraph.\n")

	waitFor(t, "the steps folder to settle", func() bool { return len(f.artifactCalls()) > 0 })
	time.Sleep(quietFor)

	calls := f.artifactCalls()
	if _, ok := calls[len(calls)-1].change(task.ArtifactPlan); ok {
		t.Errorf("changes = %v, want no plan for a plan with problems", kinds(calls[len(calls)-1]))
	}

	writeStep(t, created, "1-add-the-store.md", "Step 1: Add the store")
	waitFor(t, "the plan to be reported", func() bool {
		latest := f.artifactCalls()
		_, ok := latest[len(latest)-1].change(task.ArtifactPlan)
		return ok
	})

	latest := f.artifactCalls()
	change, _ := latest[len(latest)-1].change(task.ArtifactPlan)
	if !change.First {
		t.Error("First = false, want true for the plan becoming valid")
	}
}

func TestWatcherFollowsTheStepsFolderAsItComesAndGoes(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")

	writeStep(t, created, "1-add-the-store.md", "Step 1: Add the store")
	waitFor(t, "the plan to appear", func() bool {
		calls := f.artifactCalls()
		if len(calls) == 0 {
			return false
		}
		_, ok := calls[len(calls)-1].change(task.ArtifactPlan)
		return ok
	})
	seen := len(f.artifactCalls())

	if err := os.RemoveAll(created.StepsDir()); err != nil {
		t.Fatalf("remove steps directory: %v", err)
	}
	waitFor(t, "the removal to settle", func() bool { return len(f.artifactCalls()) > seen })

	calls := f.artifactCalls()
	if _, ok := calls[len(calls)-1].change(task.ArtifactPlan); ok {
		t.Error("the plan was reported although the folder is gone")
	}
	if cached, _ := f.service.Artifacts(created.ID); cached.Plan.Present {
		t.Error("Artifacts().Plan.Present = true, want the cache to follow the folder")
	}
}

func TestWatcherIgnoresOtherFilesInTheFolder(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")

	writeFile(t, filepath.Join(created.ArtifactsDir, "notes.md"), "notes")
	time.Sleep(quietFor)

	if got := len(f.artifactCalls()); got != 0 {
		t.Errorf("OnArtifact ran %d times, want 0", got)
	}
}

func TestWatcherKeepsTheTasksApart(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	first := f.create(t, "add-login")
	second := f.create(t, "fix-signup")

	writePRD(t, first, "# PRD of the first")
	waitFor(t, "the first PRD to appear", func() bool { return len(f.artifactCalls()) == 1 })

	if got := f.artifactCalls()[0].Task.ID; got != first.ID {
		t.Errorf("OnArtifact task = %q, want %q", got, first.ID)
	}
	if cached, _ := f.service.Artifacts(second.ID); cached.PRD {
		t.Error("the second task got the PRD of the first")
	}
}

func TestWatcherStopsAtTheDeletedTask(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")
	dir := created.ArtifactsDir

	if err := f.service.Delete(t.Context(), created.ID); err != nil {
		t.Fatalf("Delete() = %v, want nil", err)
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatalf("recreate artifacts directory: %v", err)
	}
	writePRD(t, created, "# PRD")
	time.Sleep(quietFor)

	if got := len(f.artifactCalls()); got != 0 {
		t.Errorf("OnArtifact ran %d times for a deleted task, want 0", got)
	}
}

func TestWatcherStaysQuietAfterClose(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")

	// Closing twice is what the fixture cleanup does next, and it is fine.
	if err := f.service.Close(); err != nil {
		t.Fatalf("Close() = %v, want nil", err)
	}

	writePRD(t, created, "# PRD")
	time.Sleep(quietFor)

	if got := len(f.artifactCalls()); got != 0 {
		t.Errorf("OnArtifact ran %d times after Close, want 0", got)
	}
}
