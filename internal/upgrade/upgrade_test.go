package upgrade_test

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/store"
	"github.com/guilhermt/myspec/internal/upgrade"
)

// base is the instant the repositories the upgrade registers are stamped with.
var base = time.Date(2026, time.September, 15, 12, 0, 0, 0, time.UTC)

// answer is what the fake Identify says about a clone.
type answer struct {
	identity repository.Identity
	err      error
}

// fixture is the upgrade with the data directory it works in and the clones it
// knows about.
type fixture struct {
	dataDir string
	answers map[string]answer
	upgrade store.Upgrade
}

func newFixture(t *testing.T) fixture {
	t.Helper()

	f := fixture{dataDir: t.TempDir(), answers: map[string]answer{}}
	ids := 0
	f.upgrade = upgrade.New(upgrade.Deps{
		Identify: func(_ context.Context, path string) (repository.Identity, error) {
			got, ok := f.answers[path]
			if !ok {
				return repository.Identity{}, &repository.Refusal{
					Reason: repository.ReasonCloneMissing, Path: path,
				}
			}
			return got.identity, got.err
		},
		DataDir: f.dataDir,
		Now:     func() time.Time { return base },
		NewID: func() string {
			ids++
			return "repo-" + strconv.Itoa(ids)
		},
	})
	return f
}

// clone tells the upgrade that the folder at path is a clone of owner/name.
func (f fixture) clone(path, owner, name string) string {
	f.answers[path] = answer{identity: repository.Identity{Owner: owner, Name: name}}
	return path
}

// artifacts creates the folder a workspace kept the artifacts of a task in,
// with the files it held, and returns its path.
func (f fixture) artifacts(t *testing.T, workspace, name string, files ...string) string {
	t.Helper()

	dir := filepath.Join(f.dataDir, "workspaces", workspace, name)
	for _, file := range files {
		path := filepath.Join(dir, file)
		if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
			t.Fatalf("MkdirAll(%s) = %v, want nil", filepath.Dir(path), err)
		}
		if err := os.WriteFile(path, []byte(file), 0o600); err != nil {
			t.Fatalf("WriteFile(%s) = %v, want nil", path, err)
		}
	}
	return dir
}

// taskDir is the folder the artifacts of a task live in from now on.
func (f fixture) taskDir(owner, name, taskName string) string {
	return filepath.Join(f.dataDir, "tasks", owner, name, taskName)
}

// files are the paths inside dir, relative to it, in order.
func files(t *testing.T, dir string) []string {
	t.Helper()

	var found []string
	err := filepath.WalkDir(dir, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			return nil
		}
		rel, relErr := filepath.Rel(dir, path)
		if relErr != nil {
			return relErr
		}
		found = append(found, rel)
		return nil
	})
	if err != nil {
		t.Fatalf("walk %s: %v", dir, err)
	}
	slices.Sort(found)
	return found
}

// refusal fails the test unless err is a refused upgrade, and returns its cases.
func refusal(t *testing.T, err error) []upgrade.Case {
	t.Helper()

	var refused *upgrade.RefusedError
	if !errors.As(err, &refused) {
		t.Fatalf("error = %v, want a *upgrade.RefusedError", err)
	}
	return refused.Cases
}

// exists reports whether there is anything at path.
func exists(path string) bool {
	_, err := os.Lstat(path)
	return err == nil
}

func TestAnActiveTaskAtTheRootRefusesTheUpgrade(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	legacy := []store.LegacyTask{{
		ID: "task-1", Name: "login-screen", WorkspacePath: "/home/dev/work",
		ArtifactsDir: f.artifacts(t, "work", "login-screen"), CreatedAt: base,
	}}

	plan, err := f.upgrade(t.Context(), legacy)

	want := []upgrade.Case{{
		Kind:    upgrade.CaseRootTask,
		Entries: []upgrade.Entry{{Task: "login-screen", Workspace: "/home/dev/work"}},
	}}
	if diff := cmp.Diff(want, refusal(t, err)); diff != "" {
		t.Errorf("cases mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff(store.UpgradePlan{}, plan, cmp.Comparer(sameFunc)); diff != "" {
		t.Errorf("plan mismatch (-want +got):\n%s", diff)
	}
}

// sameFunc compares the callbacks of a plan, which only a refusal leaves nil.
func sameFunc(a, b func()) bool { return (a == nil) == (b == nil) }

func TestAnArchivedTaskAtTheRootIsDiscardedWithItsArtifacts(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	dir := f.artifacts(t, "work", "old-idea", "PRD.md")
	legacy := []store.LegacyTask{{
		ID: "task-1", Name: "old-idea", WorkspacePath: "/home/dev/work",
		ArtifactsDir: dir, CreatedAt: base, ArchivedAt: base.Add(time.Hour),
	}}

	plan, err := f.upgrade(t.Context(), legacy)
	if err != nil {
		t.Fatalf("upgrade() = %v, want nil", err)
	}
	if diff := cmp.Diff([]string{"task-1"}, plan.Discarded); diff != "" {
		t.Errorf("discarded mismatch (-want +got):\n%s", diff)
	}
	if len(plan.Repositories) != 0 || len(plan.Tasks) != 0 {
		t.Errorf("plan carried %d repositories and %d tasks, want none",
			len(plan.Repositories), len(plan.Tasks))
	}

	plan.Done()

	if exists(dir) {
		t.Errorf("artifacts %s still exist", dir)
	}
	if workspaces := filepath.Join(f.dataDir, "workspaces"); exists(workspaces) {
		t.Errorf("%s still exists", workspaces)
	}
}

func TestATaskWhoseCloneHasNoGitHubOriginRefusesTheUpgrade(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	path := filepath.Join(f.dataDir, "clones", "web")
	f.answers[path] = answer{err: &repository.Refusal{
		Reason: repository.ReasonNotGitHub, Path: path, URL: "git@gitlab.com:dev/web.git",
	}}
	legacy := []store.LegacyTask{{
		ID: "task-1", Name: "login-screen", WorkspacePath: "/home/dev/work", RepoPath: path,
		ArtifactsDir: f.artifacts(t, "work", "login-screen"), CreatedAt: base,
	}}

	_, err := f.upgrade(t.Context(), legacy)

	want := []upgrade.Case{{
		Kind:       upgrade.CaseNoOrigin,
		Repository: path,
		Detail:     "The origin remote of " + path + " is not on GitHub: git@gitlab.com:dev/web.git.",
		Entries: []upgrade.Entry{
			{Task: "login-screen", Workspace: "/home/dev/work", Path: path},
		},
	}}
	if diff := cmp.Diff(want, refusal(t, err)); diff != "" {
		t.Errorf("cases mismatch (-want +got):\n%s", diff)
	}
}

func TestTwoTasksWithTheSameNameInOneRepositoryRefuseTheUpgrade(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	shared := f.clone(filepath.Join(f.dataDir, "clones", "web"), "dev", "web")
	legacy := []store.LegacyTask{
		{
			ID: "task-1", Name: "login-screen", WorkspacePath: "/home/dev/work", RepoPath: shared,
			ArtifactsDir: f.artifacts(t, "work", "login-screen"), CreatedAt: base,
		},
		{
			ID: "task-2", Name: "login-screen", WorkspacePath: "/home/dev/other", RepoPath: shared,
			ArtifactsDir: f.artifacts(t, "other", "login-screen"), CreatedAt: base.Add(time.Hour),
		},
	}

	_, err := f.upgrade(t.Context(), legacy)

	want := []upgrade.Case{{
		Kind:       upgrade.CaseNameConflict,
		Repository: "dev/web",
		Entries: []upgrade.Entry{
			{Task: "login-screen", Workspace: "/home/dev/work", Path: shared},
			{Task: "login-screen", Workspace: "/home/dev/other", Path: shared},
		},
	}}
	if diff := cmp.Diff(want, refusal(t, err)); diff != "" {
		t.Errorf("cases mismatch (-want +got):\n%s", diff)
	}
}

func TestARepositoryFoundAtTwoPathsTakesThePathOfTheLatestActiveTask(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	first := f.clone(filepath.Join(f.dataDir, "clones", "web"), "dev", "web")
	second := f.clone(filepath.Join(f.dataDir, "elsewhere", "web"), "Dev", "Web")
	third := f.clone(filepath.Join(f.dataDir, "old", "web"), "dev", "web")
	legacy := []store.LegacyTask{
		{
			ID: "task-1", Name: "login-screen", WorkspacePath: "/home/dev/work", RepoPath: first,
			ArtifactsDir: f.artifacts(t, "work", "login-screen"), CreatedAt: base,
		},
		{
			ID: "task-2", Name: "sign-up", WorkspacePath: "/home/dev/other", RepoPath: second,
			ArtifactsDir: f.artifacts(t, "other", "sign-up"), CreatedAt: base.Add(time.Hour),
		},
		{
			ID: "task-3", Name: "old-idea", WorkspacePath: "/home/dev/old", RepoPath: third,
			ArtifactsDir: f.artifacts(t, "old", "old-idea"),
			CreatedAt:    base, ArchivedAt: base.Add(2 * time.Hour),
		},
	}

	plan, err := f.upgrade(t.Context(), legacy)
	if err != nil {
		t.Fatalf("upgrade() = %v, want nil", err)
	}

	want := []repository.Repository{
		{ID: "repo-1", Owner: "Dev", Name: "Web", Path: second, CreatedAt: base},
	}
	if diff := cmp.Diff(want, plan.Repositories); diff != "" {
		t.Errorf("repositories mismatch (-want +got):\n%s", diff)
	}
	wantTasks := []store.UpgradedTask{
		{ID: "task-1", RepositoryID: "repo-1", ArtifactsDir: f.taskDir("Dev", "Web", "login-screen")},
		{ID: "task-2", RepositoryID: "repo-1", ArtifactsDir: f.taskDir("Dev", "Web", "sign-up")},
		{ID: "task-3", RepositoryID: "repo-1", ArtifactsDir: f.taskDir("Dev", "Web", "old-idea")},
	}
	if diff := cmp.Diff(wantTasks, plan.Tasks); diff != "" {
		t.Errorf("tasks mismatch (-want +got):\n%s", diff)
	}
}

func TestTheArtifactsMoveToTheFolderOfTheTaskWithThePRFilesRenamed(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	path := f.clone(filepath.Join(f.dataDir, "clones", "web"), "dev", "web")
	old := f.artifacts(t, "work", "login-screen",
		"PRD.md",
		filepath.Join("steps", "1-first.md"),
		filepath.Join("pr", "web-draft.md"),
		filepath.Join("pr", "web-review-1.md"),
		filepath.Join("pr", "web-review-2.md"),
	)
	legacy := []store.LegacyTask{{
		ID: "task-1", Name: "login-screen", WorkspacePath: "/home/dev/work", RepoPath: path,
		ArtifactsDir: old, CreatedAt: base,
	}}

	plan, err := f.upgrade(t.Context(), legacy)
	if err != nil {
		t.Fatalf("upgrade() = %v, want nil", err)
	}

	dir := f.taskDir("dev", "web", "login-screen")
	if got := plan.Tasks[0].ArtifactsDir; got != dir {
		t.Errorf("ArtifactsDir = %q, want %q", got, dir)
	}
	want := []string{
		"PRD.md",
		filepath.Join("pr", "draft.md"),
		filepath.Join("pr", "review-1.md"),
		filepath.Join("pr", "review-2.md"),
		filepath.Join("steps", "1-first.md"),
	}
	if diff := cmp.Diff(want, files(t, dir)); diff != "" {
		t.Errorf("files mismatch (-want +got):\n%s", diff)
	}
	if exists(old) {
		t.Errorf("artifacts %s still exist", old)
	}
}

func TestUndoPutsTheArtifactsBackWhereTheyWere(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	path := f.clone(filepath.Join(f.dataDir, "clones", "web"), "dev", "web")
	old := f.artifacts(t, "work", "login-screen", "PRD.md", filepath.Join("pr", "web-draft.md"))
	legacy := []store.LegacyTask{{
		ID: "task-1", Name: "login-screen", WorkspacePath: "/home/dev/work", RepoPath: path,
		ArtifactsDir: old, CreatedAt: base,
	}}

	plan, err := f.upgrade(t.Context(), legacy)
	if err != nil {
		t.Fatalf("upgrade() = %v, want nil", err)
	}

	plan.Undo()

	want := []string{"PRD.md", filepath.Join("pr", "web-draft.md")}
	if diff := cmp.Diff(want, files(t, old)); diff != "" {
		t.Errorf("files mismatch (-want +got):\n%s", diff)
	}
	if dir := f.taskDir("dev", "web", "login-screen"); exists(dir) {
		t.Errorf("%s still exists", dir)
	}
}

func TestARefusedUpgradeMovesNothing(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	path := f.clone(filepath.Join(f.dataDir, "clones", "web"), "dev", "web")
	carried := f.artifacts(t, "work", "login-screen", "PRD.md")
	legacy := []store.LegacyTask{
		{
			ID: "task-1", Name: "login-screen", WorkspacePath: "/home/dev/work", RepoPath: path,
			ArtifactsDir: carried, CreatedAt: base,
		},
		{
			ID: "task-2", Name: "whole-product", WorkspacePath: "/home/dev/work",
			ArtifactsDir: f.artifacts(t, "work", "whole-product", "PRD.md"),
			CreatedAt:    base.Add(time.Hour),
		},
	}

	_, err := f.upgrade(t.Context(), legacy)
	if cases := refusal(t, err); len(cases) != 1 || cases[0].Kind != upgrade.CaseRootTask {
		t.Fatalf("cases = %v, want one root task", cases)
	}

	if diff := cmp.Diff([]string{"PRD.md"}, files(t, carried)); diff != "" {
		t.Errorf("files mismatch (-want +got):\n%s", diff)
	}
	if dir := filepath.Join(f.dataDir, "tasks"); exists(dir) {
		t.Errorf("%s exists, want nothing moved", dir)
	}
}
