package worktree_test

import (
	"context"
	"os"
	"path/filepath"
	"slices"
	"sync"
	"testing"

	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/git/gittest"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/worktree"
)

// taskName is the name every fixture task carries, and so the name of the
// branch and of the worktree folder.
const taskName = "login-screen"

// memStore is the registry of worktrees in memory.
type memStore struct {
	mu    sync.Mutex
	items []worktree.Worktree
}

func (m *memStore) ListByTasks(_ context.Context, taskIDs []string) ([]worktree.Worktree, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	var list []worktree.Worktree
	for _, wt := range m.items {
		if slices.Contains(taskIDs, wt.TaskID) {
			list = append(list, wt)
		}
	}
	return list, nil
}

func (m *memStore) Insert(_ context.Context, wt worktree.Worktree) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.items = append(m.items, wt)
	return nil
}

func (m *memStore) Delete(_ context.Context, taskID, repoPath string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.items = slices.DeleteFunc(m.items, func(wt worktree.Worktree) bool {
		return wt.TaskID == taskID && wt.RepoPath == repoPath
	})
	return nil
}

// all is every worktree the store holds.
func (m *memStore) all() []worktree.Worktree {
	m.mu.Lock()
	defer m.mu.Unlock()
	return slices.Clone(m.items)
}

// fixture is a workspace with one repository cloned from an origin, and the
// service that owns its worktrees.
type fixture struct {
	svc   *worktree.Service
	store *memStore
	ws    string
	repo  task.Repository
	task  task.Task
}

// newFixture builds a workspace with an "api" repository, whose origin has a
// dev branch when dev is true.
func newFixture(t *testing.T, dev bool) fixture {
	t.Helper()

	ws := t.TempDir()
	repoPath := gittest.Clone(t, gittest.Origin(t, dev), filepath.Join(ws, "api"))
	return newFixtureOf(t, ws, task.Repository{Rel: "api", Path: repoPath})
}

// newFixtureOf builds the service over a repository already cloned.
func newFixtureOf(t *testing.T, ws string, repo task.Repository) fixture {
	t.Helper()

	store := &memStore{}
	svc := worktree.New(worktree.Deps{
		Git:   git.New(git.Deps{Env: gittest.Env(t)}),
		Store: store,
	})
	return fixture{svc: svc, store: store, ws: ws, repo: repo, task: newTask("task-1", ws, taskName)}
}

// newTask builds a task of a workspace, the only thing Ensure reads of one.
func newTask(id, ws, name string) task.Task {
	return task.Task{ID: id, WorkspacePath: ws, Name: name}
}

// ensure creates the worktree of the fixture task, failing the test on error.
func (f fixture) ensure(t *testing.T) worktree.Worktree {
	t.Helper()

	wt, err := f.svc.Ensure(t.Context(), f.task, f.repo, nil)
	if err != nil {
		t.Fatalf("Ensure() = %v, want nil", err)
	}
	return wt
}

// status reads the status of a worktree, failing the test on error.
func (f fixture) status(t *testing.T, wt worktree.Worktree) git.Status {
	t.Helper()

	got, err := f.svc.Status(t.Context(), wt)
	if err != nil {
		t.Fatalf("Status() = %v, want nil", err)
	}
	return got
}

// breakOrigin points the remote of the repository at a path that is not there,
// so that any fetch from now on fails.
func (f fixture) breakOrigin(t *testing.T) {
	t.Helper()
	gittest.Run(t, f.repo.Path, "remote", "set-url", "origin", filepath.Join(t.TempDir(), "gone.git"))
}

// branchExists reports whether the repository has a local branch of that name.
func branchExists(t *testing.T, repoPath, name string) bool {
	t.Helper()
	return gittest.Run(t, repoPath, "branch", "--list", name) != ""
}

// upstreamOf is the remote the branch tracks, empty when it tracks none.
func upstreamOf(t *testing.T, repoPath, branch string) string {
	t.Helper()
	return gittest.Run(t, repoPath, "config", "--default", "", "--get", "branch."+branch+".remote")
}

// headOf is the commit the given revision points at.
func headOf(t *testing.T, dir, rev string) string {
	t.Helper()
	return gittest.Run(t, dir, "rev-parse", rev)
}

// exists reports whether a path is on disk.
func exists(t *testing.T, path string) bool {
	t.Helper()

	_, err := os.Stat(path)
	return err == nil
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

// read is the content of a file, failing the test when it cannot be read.
func read(t *testing.T, path string) string {
	t.Helper()

	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile(%s) = %v, want nil", path, err)
	}
	return string(content)
}

// repoWithoutBase clones into ws a repository whose origin has neither a dev
// nor a main branch.
func repoWithoutBase(t *testing.T, ws string) task.Repository {
	t.Helper()

	dir := t.TempDir()
	origin := filepath.Join(dir, "origin.git")
	gittest.Run(t, dir, "init", "--bare", "--initial-branch=trunk", origin)

	seed := filepath.Join(dir, "seed")
	gittest.Run(t, dir, "clone", origin, seed)
	gittest.Run(t, seed, "symbolic-ref", "HEAD", "refs/heads/trunk")
	gittest.Commit(t, seed, "README.md", "# seed\n", "Initial commit")
	gittest.Run(t, seed, "push", "origin", "trunk")

	path := filepath.Join(ws, "api")
	gittest.Run(t, ws, "clone", "--branch", "trunk", origin, path)
	return task.Repository{Rel: "api", Path: path}
}
