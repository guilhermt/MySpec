package task_test

import (
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/task"
)

func TestWatcherFinishesTheStageOnceForABurstOfWrites(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")

	// The agent writes the file in pieces, the way a tool call streams it out.
	for i := range 5 {
		writePRD(t, created, "# PRD "+strconv.Itoa(i))
		time.Sleep(20 * time.Millisecond)
	}

	waitFor(t, "the PRD to finish the stage", func() bool {
		return len(f.artifactCalls()) > 0
	})
	// Long enough for a second debounce to have fired, had one been armed.
	time.Sleep(400 * time.Millisecond)

	calls := f.artifactCalls()
	if len(calls) != 1 {
		t.Fatalf("OnArtifact ran %d times, want 1", len(calls))
	}
	if !calls[0].First {
		t.Error("first = false, want true for the PRD appearing")
	}
	if got := calls[0].Task.Stage; got != task.StagePRDDone {
		t.Errorf("Stage = %q, want %q", got, task.StagePRDDone)
	}
	if got := calls[0].Task.ArtifactVersion; got != 1 {
		t.Errorf("ArtifactVersion = %d, want 1", got)
	}

	loaded, _ := f.service.Get(created.ID)
	if loaded.Stage != task.StagePRDDone {
		t.Errorf("loaded stage = %q, want %q", loaded.Stage, task.StagePRDDone)
	}
	if stored := f.repo.get(t, created.ID); stored.Stage != task.StagePRDDone || stored.ArtifactVersion != 1 {
		t.Errorf("stored task = %q/%d, want prd_done/1", stored.Stage, stored.ArtifactVersion)
	}
}

func TestWatcherReportsARewriteWithoutLeavingTheStage(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")

	writePRD(t, created, "# PRD")
	waitFor(t, "the PRD to appear", func() bool { return len(f.artifactCalls()) == 1 })

	writePRD(t, created, "# PRD, adjusted")
	waitFor(t, "the PRD to be rewritten", func() bool { return len(f.artifactCalls()) == 2 })

	calls := f.artifactCalls()
	if calls[1].First {
		t.Error("first = true on the rewrite, want false")
	}
	if got := calls[1].Task.Stage; got != task.StagePRDDone {
		t.Errorf("Stage = %q, want the stage to stay %q", got, task.StagePRDDone)
	}
	if got := calls[1].Task.ArtifactVersion; got != 2 {
		t.Errorf("ArtifactVersion = %d, want 2", got)
	}
}

func TestWatcherLeavesTheStageWhenThePRDIsRemoved(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")

	writePRD(t, created, "# PRD")
	waitFor(t, "the PRD to appear", func() bool { return len(f.artifactCalls()) == 1 })
	changes := f.changeCount()

	if err := os.Remove(created.PRDPath()); err != nil {
		t.Fatalf("remove PRD: %v", err)
	}

	waitFor(t, "the stage to go back", func() bool {
		loaded, ok := f.service.Get(created.ID)
		return ok && loaded.Stage == task.StagePRD
	})
	if got := len(f.artifactCalls()); got != 1 {
		t.Errorf("OnArtifact ran %d times, want the removal to be silent", got)
	}
	if f.changeCount() <= changes {
		t.Error("OnChange did not run for the removal")
	}
}

func TestWatcherIgnoresOtherFilesInTheFolder(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")

	if err := os.WriteFile(created.ArtifactsDir+"/notes.md", []byte("notes"), 0o600); err != nil {
		t.Fatalf("write notes: %v", err)
	}
	time.Sleep(400 * time.Millisecond)

	if got := len(f.artifactCalls()); got != 0 {
		t.Errorf("OnArtifact ran %d times, want 0", got)
	}
	if got, _ := f.service.Get(created.ID); got.Stage != task.StagePRD {
		t.Errorf("Stage = %q, want %q", got.Stage, task.StagePRD)
	}
}

func TestWatcherKeepsTheTasksApart(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	first := f.create(t, "add-login", "")
	second := f.create(t, "fix-signup", "")

	writePRD(t, first, "# PRD of the first")
	waitFor(t, "the first PRD to appear", func() bool { return len(f.artifactCalls()) == 1 })

	if got := f.artifactCalls()[0].Task.ID; got != first.ID {
		t.Errorf("OnArtifact task = %q, want %q", got, first.ID)
	}
	if loaded, _ := f.service.Get(second.ID); loaded.Stage != task.StagePRD {
		t.Errorf("second task stage = %q, want %q", loaded.Stage, task.StagePRD)
	}
}

func TestWatcherStopsAtTheDeletedTask(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	dir := created.ArtifactsDir

	if err := f.service.Delete(t.Context(), created.ID); err != nil {
		t.Fatalf("Delete() = %v, want nil", err)
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatalf("recreate artifacts directory: %v", err)
	}
	writePRD(t, created, "# PRD")
	time.Sleep(400 * time.Millisecond)

	if got := len(f.artifactCalls()); got != 0 {
		t.Errorf("OnArtifact ran %d times for a deleted task, want 0", got)
	}
}

func TestWatcherStaysQuietAfterClose(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")

	// Closing twice is what the fixture cleanup does next, and it is fine.
	if err := f.service.Close(); err != nil {
		t.Fatalf("Close() = %v, want nil", err)
	}

	writePRD(t, created, "# PRD")
	time.Sleep(400 * time.Millisecond)

	if got := len(f.artifactCalls()); got != 0 {
		t.Errorf("OnArtifact ran %d times after Close, want 0", got)
	}
}
