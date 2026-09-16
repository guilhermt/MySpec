package store_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/store"
)

// newRepository builds a registered repository, ready to insert.
func newRepository(id, owner, name, path string) repository.Repository {
	return repository.Repository{ID: id, Owner: owner, Name: name, Path: path, CreatedAt: fixedTime}
}

// listRepositories reads the registered repositories, failing the test on
// error.
func listRepositories(t *testing.T, s *store.Store) []repository.Repository {
	t.Helper()

	list, err := s.Repositories.List(t.Context())
	if err != nil {
		t.Fatalf("List() = %v, want nil", err)
	}
	return list
}

// insertRepository registers a repository, failing the test on error.
func insertRepository(t *testing.T, s *store.Store, repo repository.Repository) {
	t.Helper()

	if err := s.Repositories.Insert(t.Context(), repo); err != nil {
		t.Fatalf("Insert(%s) = %v, want nil", repo.FullName(), err)
	}
}

func TestRepositoriesInsertAndList(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	repo := newRepository("repo-1", "guilhermt", "myspec", "/home/me/code/myspec")
	insertRepository(t, s, repo)

	if diff := cmp.Diff([]repository.Repository{repo}, listRepositories(t, s)); diff != "" {
		t.Errorf("List() mismatch (-want +got):\n%s", diff)
	}
}

func TestRepositoriesAreListedInAlphabeticalOrderOfOwnerAndName(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	web := newRepository("repo-3", "acme", "web", "/code/web")
	api := newRepository("repo-2", "acme", "api", "/code/api")
	spec := newRepository("repo-1", "Guilhermt", "myspec", "/code/myspec")
	for _, repo := range []repository.Repository{web, api, spec} {
		insertRepository(t, s, repo)
	}

	want := []repository.Repository{api, web, spec}
	if diff := cmp.Diff(want, listRepositories(t, s)); diff != "" {
		t.Errorf("List() mismatch (-want +got):\n%s", diff)
	}
}

func TestARepositoryIsRegisteredOnlyOnceWhateverTheCaseOfItsIdentity(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	insertRepository(t, s, newRepository("repo-1", "guilhermt", "myspec", "/code/myspec"))

	again := newRepository("repo-2", "GuilhermT", "MySpec", "/elsewhere/myspec")
	if err := s.Repositories.Insert(t.Context(), again); err == nil {
		t.Fatal("Insert() = nil, want the identity to be taken")
	}
}

func TestUpdatePathPointsARepositoryAtAnotherClone(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	repo := newRepository("repo-1", "guilhermt", "myspec", "/code/myspec")
	insertRepository(t, s, repo)

	const moved = "/elsewhere/myspec"
	if err := s.Repositories.UpdatePath(t.Context(), repo.ID, moved); err != nil {
		t.Fatalf("UpdatePath() = %v, want nil", err)
	}

	repo.Path = moved
	if diff := cmp.Diff([]repository.Repository{repo}, listRepositories(t, s)); diff != "" {
		t.Errorf("List() mismatch (-want +got):\n%s", diff)
	}
}

func TestDeleteRemovesARepositoryAndIgnoresAMissingOne(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	repo := newRepository("repo-1", "guilhermt", "myspec", "/code/myspec")
	insertRepository(t, s, repo)

	if err := s.Repositories.Delete(t.Context(), repo.ID); err != nil {
		t.Fatalf("Delete() = %v, want nil", err)
	}
	if err := s.Repositories.Delete(t.Context(), "repo-missing"); err != nil {
		t.Fatalf("Delete(missing) = %v, want nil", err)
	}

	if got := listRepositories(t, s); len(got) != 0 {
		t.Errorf("List() = %v, want nothing left", got)
	}
}
