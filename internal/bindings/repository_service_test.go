package bindings_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/repository"
)

// clone is a folder the identifier reads as a clone of owner/name.
func clone(t *testing.T, f *fixture, name, owner, repo string) string {
	t.Helper()

	path := filepath.Join(t.TempDir(), name)
	if err := os.MkdirAll(filepath.Join(path, ".git"), 0o750); err != nil {
		t.Fatalf("MkdirAll(%s) = %v, want nil", path, err)
	}
	f.setIdentity(path, repository.Identity{Owner: owner, Name: repo})
	return path
}

func TestBrowseRepositoryRegistersTheFolderTheUserChose(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	path := clone(t, f, "web", "dev", "web")
	f.picker.answer(path, true, nil)

	registered, err := f.repoService.BrowseRepository()
	if err != nil || !registered {
		t.Fatalf("BrowseRepository() = %t, %v, want true, nil", registered, err)
	}

	got := f.state.GetState().Repositories
	if len(got) != 1 || got[0].FullName != "dev/web" || got[0].Path != path {
		t.Errorf("repositories = %+v, want dev/web at %s", got, path)
	}
	title, startIn, calls := f.picker.asked()
	if title != "Add repository" || calls != 1 {
		t.Errorf("picker = %q after %d calls, want the add dialog once", title, calls)
	}
	if startIn != os.Getenv("HOME") {
		t.Errorf("startIn = %q, want the home directory", startIn)
	}
}

func TestBrowseRepositoryCancelledChangesNothing(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.picker.answer("", false, nil)

	registered, err := f.repoService.BrowseRepository()
	if err != nil || registered {
		t.Fatalf("BrowseRepository() = %t, %v, want false, nil", registered, err)
	}
	if got := f.state.GetState().Repositories; len(got) != 0 {
		t.Errorf("repositories = %+v, want none", got)
	}
}

func TestBrowseRepositoryRefusesAFolderTheAppCannotTake(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	registered := clone(t, f, "web", "dev", "web")
	f.picker.answer(registered, true, nil)
	if _, err := f.repoService.BrowseRepository(); err != nil {
		t.Fatalf("BrowseRepository() = %v, want nil", err)
	}

	// The refusals share the fixture and run in order, because each one reads
	// the repositories the one before it left.
	refusals := []struct {
		name string
		path string
		want string
	}{
		{
			name: "a folder that is not a clone",
			path: t.TempDir(),
			want: " is not the root of a git repository.",
		},
		{
			name: "a second clone of a repository already registered",
			path: clone(t, f, "web-again", "dev", "web"),
			want: "dev/web is already registered at " + registered + ".",
		},
	}

	for _, refusal := range refusals {
		f.picker.answer(refusal.path, true, nil)

		registered, err := f.repoService.BrowseRepository()
		if registered {
			t.Errorf("%s: BrowseRepository() = true, want false", refusal.name)
		}
		if err == nil {
			t.Fatalf("%s: BrowseRepository() = nil, want the folder refused", refusal.name)
		}
		if !strings.Contains(err.Error(), refusal.want) {
			t.Errorf("%s: BrowseRepository() error = %q, want it to mention %q", refusal.name, err, refusal.want)
		}
		if got := f.state.GetState().Repositories; len(got) != 1 {
			t.Errorf("%s: repositories = %+v, want only the one registered", refusal.name, got)
		}
	}
}

func TestAddRepositoryRegistersTheCloneAtThePathWithoutThePicker(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	path := clone(t, f, "web", "dev", "web")

	if err := f.repoService.AddRepository(path); err != nil {
		t.Fatalf("AddRepository() = %v, want nil", err)
	}

	got := f.state.GetState().Repositories
	if len(got) != 1 || got[0].FullName != "dev/web" || got[0].Path != path {
		t.Errorf("repositories = %+v, want dev/web at %s", got, path)
	}
	if _, _, calls := f.picker.asked(); calls != 0 {
		t.Errorf("the picker was opened %d times, want none", calls)
	}
}

func TestAddRepositoryRefusesAFolderTheAppCannotTake(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	folder := t.TempDir()

	err := f.repoService.AddRepository(folder)
	if want := folder + " is not the root of a git repository."; err == nil || err.Error() != want {
		t.Errorf("AddRepository() error = %v, want %q", err, want)
	}
	if got := f.state.GetState().Repositories; len(got) != 0 {
		t.Errorf("repositories = %+v, want none", got)
	}
}

func TestScanRepositoriesListsTheClonesUnderTheHomeFolder(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	web := filepath.Join(f.scanRoot, "web")
	f.register(t, web)
	api := filepath.Join(f.scanRoot, "projects", "api")
	if err := os.MkdirAll(filepath.Join(api, ".git"), 0o750); err != nil {
		t.Fatalf("MkdirAll(%s) = %v, want nil", api, err)
	}
	f.setIdentity(api, repository.Identity{Owner: "dev", Name: "api"})

	got, err := f.repoService.ScanRepositories()
	if err != nil {
		t.Fatalf("ScanRepositories() = %v, want nil", err)
	}
	want := []bindings.RepositoryCandidate{
		{Owner: "dev", Name: "api", FullName: "dev/api", Path: api},
		{Owner: "dev", Name: "web", FullName: "dev/web", Path: web, Registered: true},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("ScanRepositories() mismatch (-want +got):\n%s", diff)
	}
}

func TestChangeRepositoryPathOpensAtTheParentOfTheClone(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	first := clone(t, f, "web", "dev", "web")
	f.picker.answer(first, true, nil)
	if _, err := f.repoService.BrowseRepository(); err != nil {
		t.Fatalf("BrowseRepository() = %v, want nil", err)
	}

	moved := clone(t, f, "web-moved", "dev", "web")
	f.picker.answer(moved, true, nil)
	if err := f.repoService.ChangeRepositoryPath(testRepoID); err != nil {
		t.Fatalf("ChangeRepositoryPath() = %v, want nil", err)
	}

	title, startIn, _ := f.picker.asked()
	if title != "Change the path of dev/web" {
		t.Errorf("title = %q, want the repository named", title)
	}
	if want := filepath.Dir(first); startIn != want {
		t.Errorf("startIn = %q, want %q", startIn, want)
	}
	if got := f.state.GetState().Repositories; len(got) != 1 || got[0].Path != moved {
		t.Errorf("repositories = %+v, want the path moved to %s", got, moved)
	}
}

func TestChangeRepositoryPathRefusesAnotherRepository(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	first := clone(t, f, "web", "dev", "web")
	f.picker.answer(first, true, nil)
	if _, err := f.repoService.BrowseRepository(); err != nil {
		t.Fatalf("BrowseRepository() = %v, want nil", err)
	}

	other := clone(t, f, "api", "dev", "api")
	f.picker.answer(other, true, nil)

	err := f.repoService.ChangeRepositoryPath(testRepoID)
	if err == nil {
		t.Fatal("ChangeRepositoryPath() = nil, want the folder refused")
	}
	if want := other + " is a clone of dev/api, not of dev/web."; err.Error() != want {
		t.Errorf("ChangeRepositoryPath() error = %q, want %q", err, want)
	}
	if got := f.state.GetState().Repositories; got[0].Path != first {
		t.Errorf("path = %q, want it unchanged", got[0].Path)
	}
}

func TestChangeRepositoryPathOfARepositoryNobodyRegistered(t *testing.T) {
	t.Parallel()

	f := newFixture(t)

	err := f.repoService.ChangeRepositoryPath("nobody")
	if err == nil || err.Error() != "This repository isn't registered." {
		t.Errorf("ChangeRepositoryPath() error = %v, want the unregistered notice", err)
	}
	if _, _, calls := f.picker.asked(); calls != 0 {
		t.Errorf("the picker was opened %d times, want none", calls)
	}
}

func TestRemoveRepositoryIsRefusedWhileItHasTasks(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())

	id, err := f.tasks.CreateTask(newTask("login-screen"))
	if err != nil {
		t.Fatalf("CreateTask() = %v, want nil", err)
	}
	f.waitForStatus(t, id, "waiting")

	err = f.repoService.RemoveRepository(testRepoID)
	if err == nil {
		t.Fatal("RemoveRepository() = nil, want the removal refused")
	}
	want := "dev/web has 1 active task and 0 archived tasks. Delete them before removing the repository."
	if err.Error() != want {
		t.Errorf("RemoveRepository() error = %q, want %q", err, want)
	}

	if _, err := f.tasks.DeleteTask(id); err != nil {
		t.Fatalf("DeleteTask() = %v, want nil", err)
	}
	if err := f.repoService.RemoveRepository(testRepoID); err != nil {
		t.Fatalf("RemoveRepository() = %v, want nil once the task is gone", err)
	}
	if got := f.state.GetState().Repositories; len(got) != 0 {
		t.Errorf("repositories = %+v, want none", got)
	}
}

func TestSetRepositoryFilterIsRememberedAndRefusesAnUnknownOne(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())

	if err := f.repoService.SetRepositoryFilter(testRepoID); err != nil {
		t.Fatalf("SetRepositoryFilter() = %v, want nil", err)
	}
	if got := f.state.GetState().RepositoryFilter; got != testRepoID {
		t.Errorf("filter = %q, want %q", got, testRepoID)
	}

	err := f.repoService.SetRepositoryFilter("nobody")
	if err == nil || err.Error() != "This repository isn't registered." {
		t.Errorf("SetRepositoryFilter(nobody) = %v, want the unregistered notice", err)
	}

	if err := f.repoService.SetRepositoryFilter(""); err != nil {
		t.Fatalf("SetRepositoryFilter() = %v, want nil", err)
	}
	if got := f.state.GetState().RepositoryFilter; got != "" {
		t.Errorf("filter = %q, want every repository", got)
	}
}

func TestCloneRepositoryCancelledAtTheFolderChooserChangesNothing(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	f.picker.answer("", false, nil)

	started, err := f.repoService.CloneRepository(testRepoID)
	if err != nil || started {
		t.Fatalf("CloneRepository() = %t, %v, want false, nil", started, err)
	}
	title, startIn, calls := f.picker.asked()
	if title != "Choose the clone folder" || startIn != os.Getenv("HOME") || calls != 1 {
		t.Errorf("picker = %q at %q after %d calls, want the clone folder chooser at home once", title, startIn, calls)
	}
	if got := f.state.GetState().CloneFolder; got != "" {
		t.Errorf("cloneFolder = %q, want none", got)
	}
}

func TestCloneRepositoryKeepsTheFolderChosenAndRefusesARepositoryWithAClone(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	folder := t.TempDir()
	f.picker.answer(folder, true, nil)

	started, err := f.repoService.CloneRepository(testRepoID)
	if want := "This repository is already cloned."; started || err == nil || err.Error() != want {
		t.Errorf("CloneRepository() = %t, %v, want false, %q", started, err, want)
	}
	if got := f.state.GetState().CloneFolder; got != folder {
		t.Errorf("cloneFolder = %q, want %q", got, folder)
	}
}

func TestChooseCloneFolderStartsAtTheCurrentFolder(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	first, second := t.TempDir(), t.TempDir()

	f.picker.answer(first, true, nil)
	if err := f.repoService.ChooseCloneFolder(); err != nil {
		t.Fatalf("ChooseCloneFolder() = %v, want nil", err)
	}
	if _, startIn, _ := f.picker.asked(); startIn != os.Getenv("HOME") {
		t.Errorf("startIn = %q, want the home directory", startIn)
	}

	f.picker.answer(second, false, nil)
	if err := f.repoService.ChooseCloneFolder(); err != nil {
		t.Fatalf("ChooseCloneFolder() cancelled = %v, want nil", err)
	}
	if _, startIn, _ := f.picker.asked(); startIn != first {
		t.Errorf("startIn = %q, want %q", startIn, first)
	}
	if got := f.state.GetState().CloneFolder; got != first {
		t.Errorf("cloneFolder = %q, want %q", got, first)
	}
}
