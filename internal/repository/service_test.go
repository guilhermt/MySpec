package repository_test

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/repository"
)

func TestAddingACloneRegistersItsRepository(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	path := clone(t, t.TempDir(), "web")
	f.answers[path] = answer{identity: repository.Identity{Owner: "dev", Name: "web"}}

	got, err := f.service.Add(t.Context(), path+"/")
	if err != nil {
		t.Fatalf("Add(%s) = %v, want nil", path, err)
	}

	want := repository.Repository{ID: "repo-1", Owner: "dev", Name: "web", Path: path, CreatedAt: base}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("Add() mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]repository.Repository{want}, f.service.List()); diff != "" {
		t.Errorf("List() mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]repository.Repository{want}, f.store.all(t)); diff != "" {
		t.Errorf("stored repositories mismatch (-want +got):\n%s", diff)
	}
	if registered, ok := f.service.Get("repo-1"); !ok || registered != want {
		t.Errorf("Get(repo-1) = %+v, %t, want %+v, true", registered, ok, want)
	}
	if f.service.Missing("repo-1") {
		t.Error("Missing(repo-1) = true, want false")
	}
	if diff := cmp.Diff([]string{"change"}, f.events.take()); diff != "" {
		t.Errorf("events mismatch (-want +got):\n%s", diff)
	}
	if got := f.logs.count(t, "repository registered"); got != 1 {
		t.Errorf("registrations logged = %d, want 1", got)
	}
}

func TestTheRepositoriesAreListedByOwnerAndNameIgnoringCase(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	root := t.TempDir()
	f.register(t, filepath.Join(root, "zed-api"), "zed", "api")
	f.register(t, filepath.Join(root, "acme-web"), "Acme", "web")
	f.register(t, filepath.Join(root, "acme-api"), "acme", "Api")

	list := f.service.List()
	got := make([]string, 0, len(list))
	for _, repo := range list {
		got = append(got, repo.FullName())
	}
	if diff := cmp.Diff([]string{"acme/Api", "Acme/web", "zed/api"}, got); diff != "" {
		t.Errorf("List() mismatch (-want +got):\n%s", diff)
	}
}

func TestGetDoesNotFindARepositoryNobodyRegistered(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	if repo, ok := f.service.Get("nope"); ok {
		t.Errorf("Get(nope) = %+v, true, want false", repo)
	}
}

func TestAddingARepositoryAlreadyRegisteredIsRefusedWithTheRegisteredPath(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	root := t.TempDir()
	first := f.register(t, filepath.Join(root, "web"), "dev", "web")
	f.events.take()
	second := filepath.Join(root, "web-copy")
	f.answers[second] = answer{identity: repository.Identity{Owner: "Dev", Name: "WEB"}}

	_, err := f.service.Add(t.Context(), second)

	wantRefusal(t, err,
		&repository.Refusal{Reason: repository.ReasonRegistered, Repository: "dev/web", Path: first.Path},
		"dev/web is already registered at "+first.Path+".")
	if got := len(f.store.all(t)); got != 1 {
		t.Errorf("stored repositories = %d, want 1", got)
	}
	if got := f.events.take(); len(got) != 0 {
		t.Errorf("events = %v, want none", got)
	}
}

func TestAddingGivesBackWhatIdentifyRefused(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	path := filepath.Join(t.TempDir(), "notes")
	f.answers[path] = answer{err: &repository.Refusal{Reason: repository.ReasonNotGitRoot, Path: path}}

	_, err := f.service.Add(t.Context(), path)

	wantRefusal(t, err,
		&repository.Refusal{Reason: repository.ReasonNotGitRoot, Path: path},
		path+" is not the root of a git repository.")
	if got := f.service.List(); len(got) != 0 {
		t.Errorf("List() = %v, want nothing registered", got)
	}
}

func TestAddingFailsWhenGitFails(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	path := filepath.Join(t.TempDir(), "web")
	boom := errors.New("git: boom")
	f.answers[path] = answer{err: boom}

	if _, err := f.service.Add(t.Context(), path); !errors.Is(err, boom) {
		t.Fatalf("Add(%s) = %v, want %v", path, err, boom)
	}
}

func TestAddingFailsWhenTheStoreFails(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	path := filepath.Join(t.TempDir(), "web")
	f.answers[path] = answer{identity: repository.Identity{Owner: "dev", Name: "web"}}
	boom := errors.New("store: boom")
	f.store.fail(boom)

	if _, err := f.service.Add(t.Context(), path); !errors.Is(err, boom) {
		t.Fatalf("Add(%s) = %v, want %v", path, err, boom)
	}
	if got := f.service.List(); len(got) != 0 {
		t.Errorf("List() = %v, want nothing registered", got)
	}
}

func TestChangingThePathToACloneOfTheSameRepositoryKeepsIt(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	root := t.TempDir()
	repo := f.register(t, filepath.Join(root, "gone"), "dev", "web")
	if _, err := f.service.Check(repo.ID); err == nil {
		t.Fatal("Check() = nil, want the clone missing")
	}
	f.events.take()
	path := clone(t, root, "web")
	f.answers[path] = answer{identity: repository.Identity{Owner: "DEV", Name: "web"}}

	got, err := f.service.ChangePath(t.Context(), repo.ID, path)
	if err != nil {
		t.Fatalf("ChangePath(%s) = %v, want nil", path, err)
	}

	want := repo
	want.Path = path
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("ChangePath() mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]repository.Repository{want}, f.service.List()); diff != "" {
		t.Errorf("List() mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]repository.Repository{want}, f.store.all(t)); diff != "" {
		t.Errorf("stored repositories mismatch (-want +got):\n%s", diff)
	}
	if f.service.Missing(repo.ID) {
		t.Error("Missing() = true, want false after the path changed")
	}
	if diff := cmp.Diff([]string{"path changed repo-1", "change"}, f.events.take()); diff != "" {
		t.Errorf("events mismatch (-want +got):\n%s", diff)
	}
	if got := f.logs.count(t, "repository path changed"); got != 1 {
		t.Errorf("path changes logged = %d, want 1", got)
	}
}

func TestChangingThePathToACloneOfAnotherRepositoryIsRefused(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	root := t.TempDir()
	repo := f.register(t, filepath.Join(root, "web"), "dev", "web")
	f.events.take()
	other := filepath.Join(root, "api")
	f.answers[other] = answer{identity: repository.Identity{Owner: "dev", Name: "api"}}

	_, err := f.service.ChangePath(t.Context(), repo.ID, other)

	wantRefusal(t, err,
		&repository.Refusal{
			Reason:     repository.ReasonOtherRepository,
			Path:       other,
			Other:      "dev/api",
			Repository: "dev/web",
		},
		other+" is a clone of dev/api, not of dev/web.")
	if diff := cmp.Diff([]repository.Repository{repo}, f.store.all(t)); diff != "" {
		t.Errorf("stored repositories mismatch (-want +got):\n%s", diff)
	}
	if got := f.events.take(); len(got) != 0 {
		t.Errorf("events = %v, want none", got)
	}
}

func TestChangingThePathGivesBackWhatIdentifyRefused(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	repo := f.register(t, filepath.Join(t.TempDir(), "web"), "dev", "web")
	path := t.TempDir()

	_, err := f.service.ChangePath(t.Context(), repo.ID, path)

	wantRefusal(t, err,
		&repository.Refusal{Reason: repository.ReasonNoOrigin, Path: path},
		path+" has no origin remote.")
}

func TestChangingThePathOfARepositoryNobodyRegisteredFails(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	if _, err := f.service.ChangePath(t.Context(), "nope", t.TempDir()); !errors.Is(err, repository.ErrNotFound) {
		t.Fatalf("ChangePath(nope) = %v, want repository.ErrNotFound", err)
	}
}

func TestRemovingARepositoryWithTasksIsRefused(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		counts   [2]int
		sentence string
	}{
		{"one active task", [2]int{1, 0}, "dev/web has 1 active task and 0 archived tasks."},
		{"one archived task", [2]int{0, 1}, "dev/web has 0 active tasks and 1 archived task."},
		{"several of each", [2]int{2, 3}, "dev/web has 2 active tasks and 3 archived tasks."},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			f := newFixture(t)
			repo := f.register(t, filepath.Join(t.TempDir(), "web"), "dev", "web")
			f.counts[repo.ID] = tt.counts

			err := f.service.Remove(t.Context(), repo.ID)

			wantRefusal(t, err,
				&repository.Refusal{
					Reason:     repository.ReasonHasTasks,
					Repository: "dev/web",
					Active:     tt.counts[0],
					Archived:   tt.counts[1],
				},
				tt.sentence+" Delete them before removing the repository.")
			if got := len(f.store.all(t)); got != 1 {
				t.Errorf("stored repositories = %d, want 1", got)
			}
		})
	}
}

func TestRemovingTheFilteredRepositoryShowsEveryRepositoryAgain(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	repo := f.register(t, filepath.Join(t.TempDir(), "web"), "dev", "web")
	if err := f.service.SetFilter(t.Context(), repo.ID); err != nil {
		t.Fatalf("SetFilter(%s) = %v, want nil", repo.ID, err)
	}
	f.events.take()

	if err := f.service.Remove(t.Context(), repo.ID); err != nil {
		t.Fatalf("Remove(%s) = %v, want nil", repo.ID, err)
	}

	if got := f.service.Filter(); got != "" {
		t.Errorf("Filter() = %q, want every repository", got)
	}
	if got, ok := f.settings.filter(); !ok || got != "" {
		t.Errorf("stored filter = %q, %t, want \"\", true", got, ok)
	}
	if got := f.service.List(); len(got) != 0 {
		t.Errorf("List() = %v, want nothing registered", got)
	}
	if got := f.store.all(t); len(got) != 0 {
		t.Errorf("stored repositories = %v, want none", got)
	}
	if _, ok := f.service.Get(repo.ID); ok {
		t.Errorf("Get(%s) found the removed repository", repo.ID)
	}
	if diff := cmp.Diff([]string{"change"}, f.events.take()); diff != "" {
		t.Errorf("events mismatch (-want +got):\n%s", diff)
	}
	if got := f.logs.count(t, "repository removed"); got != 1 {
		t.Errorf("removals logged = %d, want 1", got)
	}
}

func TestRemovingAnotherRepositoryKeepsTheFilter(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	root := t.TempDir()
	web := f.register(t, filepath.Join(root, "web"), "dev", "web")
	api := f.register(t, filepath.Join(root, "api"), "dev", "api")
	if err := f.service.SetFilter(t.Context(), web.ID); err != nil {
		t.Fatalf("SetFilter(%s) = %v, want nil", web.ID, err)
	}

	if err := f.service.Remove(t.Context(), api.ID); err != nil {
		t.Fatalf("Remove(%s) = %v, want nil", api.ID, err)
	}

	if got := f.service.Filter(); got != web.ID {
		t.Errorf("Filter() = %q, want %q", got, web.ID)
	}
	if diff := cmp.Diff([]repository.Repository{web}, f.service.List()); diff != "" {
		t.Errorf("List() mismatch (-want +got):\n%s", diff)
	}
}

func TestRemovingGoesThroughWhenTheFilterCannotBeStored(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	repo := f.register(t, filepath.Join(t.TempDir(), "web"), "dev", "web")
	if err := f.service.SetFilter(t.Context(), repo.ID); err != nil {
		t.Fatalf("SetFilter(%s) = %v, want nil", repo.ID, err)
	}
	f.events.take()
	f.settings.failSet(errors.New("settings: boom"))

	if err := f.service.Remove(t.Context(), repo.ID); err != nil {
		t.Fatalf("Remove(%s) = %v, want nil once the repository is deleted", repo.ID, err)
	}

	if got := f.service.Filter(); got != "" {
		t.Errorf("Filter() = %q, want every repository", got)
	}
	if got := f.service.List(); len(got) != 0 {
		t.Errorf("List() = %v, want nothing registered", got)
	}
	if got := f.store.all(t); len(got) != 0 {
		t.Errorf("stored repositories = %v, want none", got)
	}
	if diff := cmp.Diff([]string{"change"}, f.events.take()); diff != "" {
		t.Errorf("events mismatch (-want +got):\n%s", diff)
	}
	if got := f.logs.count(t, "repository filter not cleared"); got != 1 {
		t.Errorf("filters left behind logged = %d, want 1", got)
	}
	if got := f.logs.count(t, "repository removed"); got != 1 {
		t.Errorf("removals logged = %d, want 1", got)
	}
	if got, _ := f.settings.filter(); got != repo.ID {
		t.Errorf("stored filter = %q, want the failed write to have left %q", got, repo.ID)
	}
}

func TestRemovingFailsWhenTheStoreFails(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	repo := f.register(t, filepath.Join(t.TempDir(), "web"), "dev", "web")
	boom := errors.New("store: boom")
	f.store.fail(boom)

	if err := f.service.Remove(t.Context(), repo.ID); !errors.Is(err, boom) {
		t.Fatalf("Remove(%s) = %v, want %v", repo.ID, err, boom)
	}
	if got := len(f.service.List()); got != 1 {
		t.Errorf("registered repositories = %d, want 1", got)
	}
}

func TestRemovingARepositoryNobodyRegisteredFails(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	if err := f.service.Remove(t.Context(), "nope"); !errors.Is(err, repository.ErrNotFound) {
		t.Fatalf("Remove(nope) = %v, want repository.ErrNotFound", err)
	}
}

func TestCheckTellsWhenTheCloneGoesAndWhenItComesBack(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	path := clone(t, t.TempDir(), "web")
	repo := f.register(t, path, "dev", "web")
	f.events.take()

	if _, err := f.service.Check(repo.ID); err != nil {
		t.Fatalf("Check() = %v, want nil", err)
	}
	if got := f.events.take(); len(got) != 0 {
		t.Errorf("events = %v, want none while the clone is there", got)
	}

	if err := os.RemoveAll(filepath.Join(path, ".git")); err != nil {
		t.Fatalf("RemoveAll(.git) = %v, want nil", err)
	}
	for range 2 {
		_, err := f.service.Check(repo.ID)
		wantRefusal(t, err,
			&repository.Refusal{Reason: repository.ReasonCloneMissing, Path: path},
			"The clone at "+path+" is missing.")
	}
	if !f.service.Missing(repo.ID) {
		t.Error("Missing() = false, want true once the clone is gone")
	}
	if diff := cmp.Diff([]string{"change"}, f.events.take()); diff != "" {
		t.Errorf("events after the clone went mismatch (-want +got):\n%s", diff)
	}
	if got := f.logs.count(t, "repository clone missing"); got != 1 {
		t.Errorf("missing clones logged = %d, want 1", got)
	}

	clone(t, filepath.Dir(path), "web")
	got, err := f.service.Check(repo.ID)
	if err != nil {
		t.Fatalf("Check() = %v, want nil once the clone is back", err)
	}
	if diff := cmp.Diff(repo, got); diff != "" {
		t.Errorf("Check() mismatch (-want +got):\n%s", diff)
	}
	if f.service.Missing(repo.ID) {
		t.Error("Missing() = true, want false once the clone is back")
	}
	if diff := cmp.Diff([]string{"change"}, f.events.take()); diff != "" {
		t.Errorf("events after the clone came back mismatch (-want +got):\n%s", diff)
	}
	if got := f.logs.count(t, "repository clone found"); got != 1 {
		t.Errorf("found clones logged = %d, want 1", got)
	}
}

func TestCheckOfARepositoryNobodyRegisteredFails(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	if _, err := f.service.Check("nope"); !errors.Is(err, repository.ErrNotFound) {
		t.Fatalf("Check(nope) = %v, want repository.ErrNotFound", err)
	}
}

func TestSyncLoadsTheRepositoriesAndFindsTheClonesThatAreMissing(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	root := t.TempDir()
	web := repository.Repository{ID: "b", Owner: "dev", Name: "web", Path: clone(t, root, "web"), CreatedAt: base}
	api := repository.Repository{ID: "a", Owner: "dev", Name: "api", Path: filepath.Join(root, "api"), CreatedAt: base}
	for _, repo := range []repository.Repository{web, api} {
		if err := f.store.Insert(t.Context(), repo); err != nil {
			t.Fatalf("Insert(%s) = %v, want nil", repo.FullName(), err)
		}
	}
	if err := f.settings.Set(t.Context(), filterSetting, web.ID); err != nil {
		t.Fatalf("Set(filter) = %v, want nil", err)
	}

	if err := f.service.Sync(t.Context()); err != nil {
		t.Fatalf("Sync() = %v, want nil", err)
	}

	if diff := cmp.Diff([]repository.Repository{api, web}, f.service.List()); diff != "" {
		t.Errorf("List() mismatch (-want +got):\n%s", diff)
	}
	if !f.service.Missing(api.ID) {
		t.Errorf("Missing(%s) = false, want true", api.FullName())
	}
	if f.service.Missing(web.ID) {
		t.Errorf("Missing(%s) = true, want false", web.FullName())
	}
	if got := f.service.Filter(); got != web.ID {
		t.Errorf("Filter() = %q, want %q", got, web.ID)
	}
	if got := f.logs.count(t, "repository clone missing"); got != 1 {
		t.Errorf("missing clones logged = %d, want 1", got)
	}
	if got := f.events.take(); len(got) != 0 {
		t.Errorf("events = %v, want none", got)
	}
}

func TestSyncIgnoresAFilterThatNamesNoRepository(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	if err := f.settings.Set(t.Context(), filterSetting, "gone"); err != nil {
		t.Fatalf("Set(filter) = %v, want nil", err)
	}

	if err := f.service.Sync(t.Context()); err != nil {
		t.Fatalf("Sync() = %v, want nil", err)
	}

	if got := f.service.Filter(); got != "" {
		t.Errorf("Filter() = %q, want every repository", got)
	}
	if got, _ := f.settings.filter(); got != "gone" {
		t.Errorf("stored filter = %q, want it left as %q", got, "gone")
	}
}

func TestSyncFailsWhenTheStoreFails(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	boom := errors.New("store: boom")
	f.store.fail(boom)

	if err := f.service.Sync(t.Context()); !errors.Is(err, boom) {
		t.Fatalf("Sync() = %v, want %v", err, boom)
	}
}

func TestSetFilterAcceptsOnlyARegisteredRepository(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	repo := f.register(t, filepath.Join(t.TempDir(), "web"), "dev", "web")
	f.events.take()

	if err := f.service.SetFilter(t.Context(), "nope"); !errors.Is(err, repository.ErrNotFound) {
		t.Fatalf("SetFilter(nope) = %v, want repository.ErrNotFound", err)
	}
	if _, ok := f.settings.filter(); ok {
		t.Error("the filter was stored for a repository nobody registered")
	}

	for _, id := range []string{repo.ID, ""} {
		if err := f.service.SetFilter(t.Context(), id); err != nil {
			t.Fatalf("SetFilter(%q) = %v, want nil", id, err)
		}
		if got := f.service.Filter(); got != id {
			t.Errorf("Filter() = %q, want %q", got, id)
		}
		if got, _ := f.settings.filter(); got != id {
			t.Errorf("stored filter = %q, want %q", got, id)
		}
	}
	if diff := cmp.Diff([]string{"change", "change"}, f.events.take()); diff != "" {
		t.Errorf("events mismatch (-want +got):\n%s", diff)
	}
}

func TestANewServiceWorksWithoutTheOptionalDeps(t *testing.T) {
	t.Parallel()
	settings := &memSettings{values: map[string]string{}}
	service := repository.New(repository.Deps{
		Store:    &memStore{},
		Settings: settings,
		Identify: func(_ context.Context, _ string) (repository.Identity, error) {
			return repository.Identity{Owner: "dev", Name: "web"}, nil
		},
	})
	path := filepath.Join(t.TempDir(), "web")

	repo, err := service.Add(t.Context(), path)
	if err != nil {
		t.Fatalf("Add(%s) = %v, want nil", path, err)
	}
	if repo.ID == "" || repo.CreatedAt.IsZero() {
		t.Errorf("Add() = %+v, want an id and a creation time", repo)
	}
	if _, err := service.ChangePath(t.Context(), repo.ID, path); err != nil {
		t.Fatalf("ChangePath(%s) = %v, want nil", path, err)
	}
	if err := service.Remove(t.Context(), repo.ID); err != nil {
		t.Fatalf("Remove(%s) = %v, want nil without tasks to count", repo.ID, err)
	}
}

func TestSyncSkipsTheRepositoriesWithoutAClone(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	repo := f.uncloned(t, "repo-1", "dev", "web")

	if diff := cmp.Diff([]repository.Repository{repo}, f.service.List()); diff != "" {
		t.Errorf("List() mismatch (-want +got):\n%s", diff)
	}
	if f.service.Missing(repo.ID) {
		t.Error("Missing() = true, want false for a repository without a clone")
	}
	if got := f.logs.count(t, "repository clone missing"); got != 0 {
		t.Errorf("missing clones logged = %d, want 0", got)
	}
}

func TestCheckRefusesARepositoryWithoutAClone(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	repo := f.uncloned(t, "repo-1", "dev", "web")

	_, err := f.service.Check(repo.ID)

	wantRefusal(t, err,
		&repository.Refusal{Reason: repository.ReasonNotCloned, Repository: "dev/web"},
		"dev/web isn't cloned yet.")
	if f.service.Missing(repo.ID) {
		t.Error("Missing() = true, want false for a repository without a clone")
	}
	if got := f.events.take(); len(got) != 0 {
		t.Errorf("events = %v, want none", got)
	}
}

func TestAddingACloneOfARepositoryWithoutOneLinksIt(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	repo := f.uncloned(t, "repo-1", "dev", "web")
	path := clone(t, t.TempDir(), "web")
	f.answers[path] = answer{identity: repository.Identity{Owner: "Dev", Name: "Web"}}

	got, err := f.service.Add(t.Context(), path)
	if err != nil {
		t.Fatalf("Add(%s) = %v, want nil", path, err)
	}

	repo.Path = path
	if diff := cmp.Diff(repo, got); diff != "" {
		t.Errorf("Add() mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]repository.Repository{repo}, f.store.all(t)); diff != "" {
		t.Errorf("stored repositories mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]string{"path changed repo-1", "change"}, f.events.take()); diff != "" {
		t.Errorf("events mismatch (-want +got):\n%s", diff)
	}
	if got := f.logs.count(t, "repository clone linked"); got != 1 {
		t.Errorf("linked clones logged = %d, want 1", got)
	}
}

func TestCloningIntoAFreeFolderLinksTheClone(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	repo := f.uncloned(t, "repo-1", "dev", "web")
	folder := t.TempDir()
	if err := f.service.SetCloneFolder(t.Context(), folder); err != nil {
		t.Fatalf("SetCloneFolder() = %v, want nil", err)
	}
	f.events.take()
	dir := filepath.Join(folder, "web")

	for range 2 {
		if err := f.service.Clone(t.Context(), repo.ID); err != nil {
			t.Fatalf("Clone() = %v, want nil", err)
		}
	}
	waitFor(t, "the clone to start", func() bool { return len(f.cloner.taken()) == 1 })

	if running, failure := f.service.Cloning(repo.ID); !running || failure != "" {
		t.Errorf("Cloning() = %t, %q, want true, \"\" while the clone runs", running, failure)
	}
	if got, _ := f.service.Get(repo.ID); got.Cloned() {
		t.Errorf("Get() = %+v, want no clone while the clone runs", got)
	}

	close(f.cloner.release)
	waitFor(t, "the clone to end", func() bool {
		running, _ := f.service.Cloning(repo.ID)
		return !running
	})

	if diff := cmp.Diff([]string{"dev/web " + dir}, f.cloner.taken()); diff != "" {
		t.Errorf("clones mismatch (-want +got):\n%s", diff)
	}
	if _, failure := f.service.Cloning(repo.ID); failure != "" {
		t.Errorf("Cloning() failure = %q, want none", failure)
	}
	repo.Path = dir
	if got, _ := f.service.Get(repo.ID); got != repo {
		t.Errorf("Get() = %+v, want %+v", got, repo)
	}
	if diff := cmp.Diff([]repository.Repository{repo}, f.store.all(t)); diff != "" {
		t.Errorf("stored repositories mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]string{"change", "path changed repo-1", "change"}, f.events.take()); diff != "" {
		t.Errorf("events mismatch (-want +got):\n%s", diff)
	}
	if got := f.logs.count(t, "repository clone started"); got != 1 {
		t.Errorf("started clones logged = %d, want 1", got)
	}
	if got := f.logs.count(t, "repository cloned"); got != 1 {
		t.Errorf("clones logged = %d, want 1", got)
	}
}

func TestAFailedCloneKeepsNoPathAndRecordsWhatGHSaid(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	repo := f.uncloned(t, "repo-1", "dev", "web")
	folder := t.TempDir()
	if err := f.service.SetCloneFolder(t.Context(), folder); err != nil {
		t.Fatalf("SetCloneFolder() = %v, want nil", err)
	}
	const said = "GraphQL: Could not resolve to a Repository with the name 'dev/web'."
	f.cloner.err = &gh.Error{Args: []string{"repo", "clone"}, Output: said, ExitCode: 1}
	close(f.cloner.release)

	if err := f.service.Clone(t.Context(), repo.ID); err != nil {
		t.Fatalf("Clone() = %v, want nil", err)
	}
	waitFor(t, "the clone to fail", func() bool {
		running, failure := f.service.Cloning(repo.ID)
		return !running && failure != ""
	})

	if _, failure := f.service.Cloning(repo.ID); failure != said {
		t.Errorf("Cloning() failure = %q, want %q", failure, said)
	}
	if got, _ := f.service.Get(repo.ID); got.Cloned() {
		t.Errorf("Get() = %+v, want no clone", got)
	}
	if diff := cmp.Diff([]repository.Repository{repo}, f.store.all(t)); diff != "" {
		t.Errorf("stored repositories mismatch (-want +got):\n%s", diff)
	}
	if _, err := os.Stat(filepath.Join(folder, "web")); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("Stat(half-written clone) = %v, want it removed", err)
	}
	if got := f.logs.count(t, "repository clone failed"); got != 1 {
		t.Errorf("failed clones logged = %d, want 1", got)
	}
}

func TestRemovingARepositoryWhileItsCloneRunsForgetsTheClone(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	repo := f.uncloned(t, "repo-1", "dev", "web")
	if err := f.service.SetCloneFolder(t.Context(), t.TempDir()); err != nil {
		t.Fatalf("SetCloneFolder() = %v, want nil", err)
	}

	if err := f.service.Clone(t.Context(), repo.ID); err != nil {
		t.Fatalf("Clone() = %v, want nil", err)
	}
	waitFor(t, "the clone to start", func() bool { return len(f.cloner.taken()) == 1 })
	if err := f.service.Remove(t.Context(), repo.ID); err != nil {
		t.Fatalf("Remove() = %v, want nil", err)
	}

	if running, failure := f.service.Cloning(repo.ID); running || failure != "" {
		t.Errorf("Cloning() = %t, %q, want nothing for a repository that is gone", running, failure)
	}

	// The clone that outlived the removal ends before the test does; a clone
	// that ended announces a change.
	f.events.take()
	close(f.cloner.release)
	waitFor(t, "the clone to end", func() bool { return len(f.events.take()) > 0 })
}

func TestCloningLinksAnExistingCloneOfTheSameRepositoryWithoutCloning(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	repo := f.uncloned(t, "repo-1", "dev", "web")
	folder := t.TempDir()
	if err := f.service.SetCloneFolder(t.Context(), folder); err != nil {
		t.Fatalf("SetCloneFolder() = %v, want nil", err)
	}
	f.events.take()
	dir := clone(t, folder, "web")
	f.answers[dir] = answer{identity: repository.Identity{Owner: "dev", Name: "web"}}

	if err := f.service.Clone(t.Context(), repo.ID); err != nil {
		t.Fatalf("Clone() = %v, want nil", err)
	}

	if got := f.cloner.taken(); len(got) != 0 {
		t.Errorf("clones = %v, want none", got)
	}
	repo.Path = dir
	if got, _ := f.service.Get(repo.ID); got != repo {
		t.Errorf("Get() = %+v, want %+v", got, repo)
	}
	if running, _ := f.service.Cloning(repo.ID); running {
		t.Error("Cloning() = true, want false")
	}
	if diff := cmp.Diff([]string{"path changed repo-1", "change"}, f.events.take()); diff != "" {
		t.Errorf("events mismatch (-want +got):\n%s", diff)
	}
}

func TestCloningIntoAFolderOfOtherContentIsRefused(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	repo := f.uncloned(t, "repo-1", "dev", "web")
	folder := t.TempDir()
	if err := f.service.SetCloneFolder(t.Context(), folder); err != nil {
		t.Fatalf("SetCloneFolder() = %v, want nil", err)
	}
	dir := filepath.Join(folder, "web")
	if err := os.Mkdir(dir, 0o750); err != nil {
		t.Fatalf("Mkdir(%s) = %v, want nil", dir, err)
	}

	err := f.service.Clone(t.Context(), repo.ID)

	wantRefusal(t, err,
		&repository.Refusal{Reason: repository.ReasonPathTaken, Path: dir, Repository: "dev/web"},
		dir+" already exists and is not a clone of dev/web.")
	if got := f.cloner.taken(); len(got) != 0 {
		t.Errorf("clones = %v, want none", got)
	}
}

func TestCloningIsRefusedWithoutAFolderForARepositoryWithACloneAndForAnUnknownOne(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	uncloned := f.uncloned(t, "repo-web", "dev", "web")
	cloned := f.register(t, clone(t, t.TempDir(), "api"), "dev", "api")

	if err := f.service.Clone(t.Context(), uncloned.ID); !errors.Is(err, repository.ErrNoCloneFolder) {
		t.Errorf("Clone(without a folder) = %v, want repository.ErrNoCloneFolder", err)
	}
	if err := f.service.SetCloneFolder(t.Context(), t.TempDir()); err != nil {
		t.Fatalf("SetCloneFolder() = %v, want nil", err)
	}
	if err := f.service.Clone(t.Context(), cloned.ID); !errors.Is(err, repository.ErrCloned) {
		t.Errorf("Clone(cloned) = %v, want repository.ErrCloned", err)
	}
	if err := f.service.Clone(t.Context(), "nope"); !errors.Is(err, repository.ErrNotFound) {
		t.Errorf("Clone(nope) = %v, want repository.ErrNotFound", err)
	}
	if got := f.cloner.taken(); len(got) != 0 {
		t.Errorf("clones = %v, want none", got)
	}
}

func TestSetCloneFolderPersists(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	if err := f.service.SetCloneFolder(t.Context(), "/home/dev/code/"); err != nil {
		t.Fatalf("SetCloneFolder() = %v, want nil", err)
	}

	const want = "/home/dev/code"
	if got := f.service.CloneFolder(); got != want {
		t.Errorf("CloneFolder() = %q, want %q", got, want)
	}
	if diff := cmp.Diff([]string{"change"}, f.events.take()); diff != "" {
		t.Errorf("events mismatch (-want +got):\n%s", diff)
	}
	again := repository.New(repository.Deps{Store: f.store, Settings: f.settings})
	if err := again.Sync(t.Context()); err != nil {
		t.Fatalf("Sync() = %v, want nil", err)
	}
	if got := again.CloneFolder(); got != want {
		t.Errorf("CloneFolder() after Sync = %q, want %q", got, want)
	}
	if got := f.settings.values[cloneFolderSetting]; got != want {
		t.Errorf("stored clone folder = %q, want %q", got, want)
	}
}
