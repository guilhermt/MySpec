package review_test

import (
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/git/gittest"
	"github.com/guilhermt/myspec/internal/review"
)

func TestTrackReadsTheWorktreeAtOnce(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	f.svc.Track(taskID, f.wt, true)

	snap, ok := f.svc.Snapshot(taskID)
	if !ok {
		t.Fatal("Snapshot() found nothing, want the first reading")
	}
	if !snap.Empty() {
		t.Errorf("Snapshot() = %+v, want an untouched worktree", snap)
	}
	if snap.Head != gittest.Run(t, f.wt.Path, "rev-parse", "HEAD") {
		t.Errorf("Head = %q, want the commit the worktree is on", snap.Head)
	}
	if snap.ReadAt.IsZero() {
		t.Error("ReadAt is zero, want when the reading happened")
	}
	// A first reading is news even when it found nothing: the flow tells a
	// worktree with no change from one it has not read yet.
	if id := <-f.changes; id != taskID {
		t.Errorf("OnChange(%s), want %s", id, taskID)
	}
}

func TestTrackReadsNothingWhenItChangesNothing(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	f.track(t)
	f.svc.Track(taskID, f.wt, true)
	f.svc.Track(taskID, f.wt, true)

	if got := f.worktrees.count(); got != 1 {
		t.Errorf("readings = %d, want the one Track did", got)
	}
}

func TestSnapshotFindsNothingForATaskThatIsNotTracked(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	if _, ok := f.svc.Snapshot(taskID); ok {
		t.Error("Snapshot() found a reading, want none before Track")
	}
	if _, ok := f.svc.Refresh(taskID); ok {
		t.Error("Refresh() read something, want nothing before Track")
	}
}

func TestStagingAFileRaisesTheProgress(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.track(t)

	write(t, f.wt.Path, "README.md", "# changed\n")
	write(t, f.wt.Path, "notes.md", "notes\n")
	got := f.waitFor(t, "saw the two files", func(s review.Snapshot) bool { return s.Total == 2 })
	if got.Staged != 0 || got.Percent() != 0 || got.Ready() {
		t.Errorf("Snapshot() = %+v, want nothing staged yet", got)
	}
	if want := []string{"README.md", "notes.md"}; !slices.Equal(paths(got), want) {
		t.Errorf("files = %q, want %q", paths(got), want)
	}

	gittest.Run(t, f.wt.Path, "add", "README.md")
	got = f.waitFor(t, "saw the staged file", func(s review.Snapshot) bool { return s.Staged == 1 })
	if got.Percent() != 50 || got.Ready() {
		t.Errorf("Snapshot() = %+v, want half of the review done", got)
	}

	gittest.Run(t, f.wt.Path, "add", "notes.md")
	got = f.waitFor(t, "reached every file", func(s review.Snapshot) bool { return s.Ready() })
	if got.Percent() != 100 {
		t.Errorf("Percent() = %d, want 100", got.Percent())
	}
	for _, file := range got.Files {
		if !file.Staged {
			t.Errorf("file %q is pending, want it staged", file.Path)
		}
	}
}

func TestAReadingThatFoundTheSameThingIsNotReported(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.track(t)

	write(t, f.wt.Path, "README.md", "# changed\n")
	f.waitFor(t, "saw the file", func(s review.Snapshot) bool { return s.Total == 1 })
	f.drain()

	// The same content again: git says exactly what it said before.
	write(t, f.wt.Path, "README.md", "# changed\n")
	f.wantNoChange(t)
}

func TestAnInactiveTaskIsWatchedButNotRead(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	f.svc.Track(taskID, f.wt, false)
	if _, ok := f.svc.Snapshot(taskID); ok {
		t.Error("Snapshot() found a reading, want none while the agent works")
	}

	write(t, f.wt.Path, "README.md", "# changed\n")
	f.wantNoChange(t)
	if got := f.worktrees.count(); got != 0 {
		t.Errorf("readings = %d, want none for an inactive task", got)
	}

	// Becoming active reads the worktree, so nothing depends on an event that
	// happened while the numbers did not matter.
	f.svc.Track(taskID, f.wt, true)
	got, ok := f.svc.Snapshot(taskID)
	if !ok {
		t.Fatal("Snapshot() found nothing, want the reading of an active task")
	}
	if want := []string{"README.md"}; !slices.Equal(paths(got), want) {
		t.Errorf("files = %q, want %q", paths(got), want)
	}
}

func TestADirectoryThatAppearsIsFollowed(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.track(t)

	write(t, f.wt.Path, "pkg/one.go", "package pkg\n")
	f.waitFor(t, "saw the file of the new directory", func(s review.Snapshot) bool { return s.Total == 1 })
	f.drain()

	// The second file only shows up if the directory itself is now watched.
	write(t, f.wt.Path, "pkg/two.go", "package pkg\n")
	got := f.waitFor(t, "saw the second file", func(s review.Snapshot) bool { return s.Total == 2 })
	if want := []string{"pkg/one.go", "pkg/two.go"}; !slices.Equal(paths(got), want) {
		t.Errorf("files = %q, want %q", paths(got), want)
	}
}

func TestAnIgnoredDirectoryIsNeitherFollowedNorCounted(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	gittest.Commit(t, f.wt.Path, ".gitignore", "build/\n", "Ignore the build folder")
	f.track(t)

	if err := os.Mkdir(filepath.Join(f.wt.Path, "build"), 0o750); err != nil {
		t.Fatalf("Mkdir(build) = %v, want nil", err)
	}
	f.wantNoChange(t)
	reads := f.worktrees.count()

	// Nothing inside an ignored folder reaches the watcher, so what a build
	// writes there costs neither a reading nor a number.
	write(t, f.wt.Path, "build/out.js", "console.log(1)\n")
	f.wantNoChange(t)
	if got := f.worktrees.count(); got != reads {
		t.Errorf("readings = %d, want the %d of before the build wrote", got, reads)
	}
	if got, _ := f.svc.Refresh(taskID); !got.Empty() {
		t.Errorf("Snapshot() = %+v, want nothing about an ignored folder", got)
	}
}

func TestRefreshReadsWithoutWaitingForTheDebounce(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.track(t)

	write(t, f.wt.Path, "README.md", "# changed\n")
	got, ok := f.svc.Refresh(taskID)
	if !ok {
		t.Fatal("Refresh() read nothing, want the worktree")
	}
	if want := []string{"README.md"}; !slices.Equal(paths(got), want) {
		t.Errorf("files = %q, want %q", paths(got), want)
	}
	if snap, _ := f.svc.Snapshot(taskID); !slices.Equal(paths(snap), paths(got)) {
		t.Errorf("Snapshot() = %+v, want what Refresh() found", snap)
	}
}

func TestAFailedReadingCarriesWhatGitSaidAndNoNumbers(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.track(t)

	write(t, f.wt.Path, "README.md", "# changed\n")
	f.waitFor(t, "saw the file", func(s review.Snapshot) bool { return s.Total == 1 })
	if err := os.RemoveAll(f.wt.Path); err != nil {
		t.Fatalf("RemoveAll(%s) = %v, want nil", f.wt.Path, err)
	}

	got, ok := f.svc.Refresh(taskID)
	if !ok {
		t.Fatal("Refresh() read nothing, want the failure")
	}
	if got.Err == "" {
		t.Fatalf("Snapshot() = %+v, want what git said", got)
	}
	if got.Files != nil || got.Total != 0 || got.Staged != 0 || got.Head != "" {
		t.Errorf("Snapshot() = %+v, want no numbers behind the failure", got)
	}
	if got.Ready() || got.Empty() {
		t.Errorf("Snapshot() = %+v, want an unreadable worktree to be neither ready nor empty", got)
	}
}

func TestTrackFollowsATaskThatMovesToAnotherWorktree(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	write(t, f.wt.Path, "README.md", "# changed\n")
	f.track(t)

	other := f.worktreeOf(t, "other-step")
	f.svc.Track(taskID, other, true)

	got, ok := f.svc.Snapshot(taskID)
	if !ok {
		t.Fatal("Snapshot() found nothing, want the reading of the new worktree")
	}
	if !got.Empty() {
		t.Errorf("Snapshot() = %+v, want the untouched worktree of the next step", got)
	}
	f.drain()

	// The worktree it left says nothing about the task any more.
	write(t, f.wt.Path, "notes.md", "notes\n")
	f.wantNoChange(t)

	write(t, other.Path, "notes.md", "notes\n")
	f.waitFor(t, "saw the file of the new worktree", func(s review.Snapshot) bool { return s.Total == 1 })
}

func TestForgetStopsWatchingAndDropsTheReading(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.track(t)

	f.svc.Forget(taskID)
	if _, ok := f.svc.Snapshot(taskID); ok {
		t.Error("Snapshot() found a reading, want it dropped")
	}

	write(t, f.wt.Path, "README.md", "# changed\n")
	f.wantNoChange(t)
	if got := f.worktrees.count(); got != 1 {
		t.Errorf("readings = %d, want no reading after Forget", got)
	}

	f.svc.Forget(taskID) // forgetting twice is not a failure
}

func TestCloseStopsEveryWaitInFlight(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.track(t)

	write(t, f.wt.Path, "README.md", "# changed\n")
	if err := f.svc.Close(); err != nil {
		t.Fatalf("Close() = %v, want nil", err)
	}
	f.wantNoChange(t)
	if _, ok := f.svc.Snapshot(taskID); ok {
		t.Error("Snapshot() found a reading, want none after Close")
	}

	// A closed service takes no task back.
	f.svc.Track(taskID, f.wt, true)
	if _, ok := f.svc.Snapshot(taskID); ok {
		t.Error("Track() after Close was taken, want it ignored")
	}
}

func TestTheKindOfEachFileComesFromGit(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	gittest.Commit(t, f.wt.Path, "gone.txt", "gone\n", "Add gone")
	f.track(t)

	write(t, f.wt.Path, "README.md", "# changed\n")
	gittest.Run(t, f.wt.Path, "rm", "--quiet", "gone.txt")
	write(t, f.wt.Path, "new.txt", "new\n")

	got := f.waitFor(t, "saw the three changes", func(s review.Snapshot) bool { return s.Total == 3 })
	want := []review.File{
		{Path: "README.md", Kind: git.KindModified, Staged: false},
		{Path: "gone.txt", Kind: git.KindDeleted, Staged: true},
		{Path: "new.txt", Kind: git.KindUntracked, Staged: false},
	}
	if !slices.Equal(got.Files, want) {
		t.Errorf("files = %+v, want %+v", got.Files, want)
	}
	if got.Percent() != 33 {
		t.Errorf("Percent() = %d, want 33", got.Percent())
	}
}
