package review_test

import (
	"context"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/git/gittest"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/worktree"
)

// taskID is the task every fixture watches, and branch the branch its
// worktree is on.
const (
	taskID = "task-1"
	branch = "login-screen"
)

// settle is how long a test waits for something that should not happen. It is
// longer than the debounce, so a reading that was going to land already did.
const settle = 700 * time.Millisecond

// waitTimeout is how long a test waits for something that should happen before
// it fails.
const waitTimeout = 5 * time.Second

// counting is the worktree service the review reads through, with the
// readings counted.
type counting struct {
	review.Worktrees

	mu    sync.Mutex
	reads int
}

func (c *counting) Status(ctx context.Context, wt worktree.Worktree) (git.Status, error) {
	c.mu.Lock()
	c.reads++
	c.mu.Unlock()

	return c.Worktrees.Status(ctx, wt)
}

// count is how many readings the service has done.
func (c *counting) count() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.reads
}

// fixture is a repository with one worktree of it, and the review service
// watching that worktree under the id of its task.
type fixture struct {
	svc       *review.Service
	worktrees *counting
	wt        worktree.Worktree
	repo      string
	changes   chan string
}

// newFixture builds the service over a worktree of a fresh clone.
func newFixture(t *testing.T) *fixture {
	t.Helper()

	f := &fixture{changes: make(chan string, 32)}
	f.repo = gittest.Clone(t, gittest.Origin(t, true), filepath.Join(t.TempDir(), "api"))
	f.wt = f.worktreeOf(t, branch)
	f.worktrees = &counting{Worktrees: worktree.New(worktree.Deps{
		Git: git.New(git.Deps{Env: gittest.Env(t)}),
	})}

	svc, err := review.New(review.Deps{
		Worktrees: f.worktrees,
		OnChange:  func(id string) { f.changes <- id },
	})
	if err != nil {
		t.Fatalf("New() = %v, want nil", err)
	}
	t.Cleanup(func() {
		if err := svc.Close(); err != nil {
			t.Errorf("Close() = %v, want nil", err)
		}
	})

	f.svc = svc
	return f
}

// worktreeOf adds a worktree of the repository on a branch of its own.
func (f *fixture) worktreeOf(t *testing.T, name string) worktree.Worktree {
	t.Helper()

	path := filepath.Join(t.TempDir(), name)
	gittest.Run(t, f.repo, "worktree", "add", "--no-track", "-b", name, path, "main")
	return worktree.Worktree{TaskID: taskID, RepoPath: f.repo, Path: path, Branch: name}
}

// otherTask is a second task, in a repository and a worktree of its own.
func (f *fixture) otherTask(t *testing.T, name string) (string, worktree.Worktree) {
	t.Helper()

	repo := gittest.Clone(t, gittest.Origin(t, true), filepath.Join(t.TempDir(), name))
	path := filepath.Join(t.TempDir(), name+"-worktree")
	gittest.Run(t, repo, "worktree", "add", "--no-track", "-b", branch, path, "main")

	id := taskID + "-" + name
	wt := worktree.Worktree{TaskID: id, RepoPath: repo, Path: path, Branch: branch}
	return id, wt
}

// track puts the fixture worktree under watch and waits for the first reading.
func (f *fixture) track(t *testing.T) {
	t.Helper()

	f.svc.Track(taskID, f.wt, true)
	if _, ok := f.svc.Snapshot(taskID); !ok {
		t.Fatal("Snapshot() found nothing, want the reading Track does at once")
	}
	f.drain()
}

// waitFor polls the snapshot of the fixture worktree until it says what the
// test is waiting for.
func (f *fixture) waitFor(t *testing.T, what string, ok func(review.Snapshot) bool) review.Snapshot {
	t.Helper()

	return f.waitForTask(t, taskID, what, ok)
}

// waitForTask is waitFor over any task the fixture tracks.
func (f *fixture) waitForTask(
	t *testing.T, id, what string, ok func(review.Snapshot) bool,
) review.Snapshot {
	t.Helper()

	deadline := time.Now().Add(waitTimeout)
	for {
		snap, found := f.svc.Snapshot(id)
		if found && ok(snap) {
			return snap
		}
		if time.Now().After(deadline) {
			t.Fatalf("the reading never %s, it is %+v", what, snap)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// waitChange waits until a change of the fixture worktree is reported with a
// reading that says what the test is waiting for, and returns that reading. The
// service stores a reading before it reports it, so a test that only polls the
// snapshot can see the reading and drain the changes while its report is still
// on the way, and that report then lands on whatever the test watches next.
func (f *fixture) waitChange(t *testing.T, what string, ok func(review.Snapshot) bool) review.Snapshot {
	t.Helper()

	deadline := time.After(waitTimeout)
	for {
		select {
		case id := <-f.changes:
			// The reading behind a report is stored before it, so the snapshot
			// is at least as new as the change just received.
			if snap, found := f.svc.Snapshot(taskID); id == taskID && found && ok(snap) {
				return snap
			}
		case <-deadline:
			snap, _ := f.svc.Snapshot(taskID)
			t.Fatalf("no change was reported with a reading that %s, it is %+v", what, snap)
		}
	}
}

// wantNoChange fails when a change is reported while a worktree settles.
func (f *fixture) wantNoChange(t *testing.T) {
	t.Helper()

	select {
	case id := <-f.changes:
		t.Fatalf("OnChange(%q) was called, want nothing reported", id)
	case <-time.After(settle):
	}
}

// drain throws away the changes reported so far.
func (f *fixture) drain() {
	for {
		select {
		case <-f.changes:
		default:
			return
		}
	}
}

// write puts content in a file of dir, creating the directories it needs.
func write(t *testing.T, dir, name, content string) {
	t.Helper()

	path := filepath.Join(dir, name)
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		t.Fatalf("MkdirAll(%s) = %v, want nil", filepath.Dir(path), err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("WriteFile(%s) = %v, want nil", path, err)
	}
}

// paths are the paths of the files of a reading, in the order git gave them.
func paths(snap review.Snapshot) []string {
	list := make([]string, 0, len(snap.Files))
	for _, file := range snap.Files {
		list = append(list, file.Path)
	}
	return list
}
