package store_test

import (
	"database/sql"
	"path/filepath"
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

func TestTheBoardOfARepositoryRoundTrips(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "myspec.db")
	s, err := store.Open(t.Context(), path, newLogCapture().log, nil)
	if err != nil {
		t.Fatalf("Open() = %v, want nil", err)
	}
	t.Cleanup(func() {
		if err := s.Close(); err != nil {
			t.Errorf("Close() = %v, want nil", err)
		}
	})
	seedBoard(t, path, "board-1")

	managed := newRepository("repo-1", "acme", "api", "/code/api")
	managed.BoardID = "board-1"
	insertRepository(t, s, managed)
	free := newRepository("repo-2", "acme", "web", "/code/web")
	insertRepository(t, s, free)
	if diff := cmp.Diff([]repository.Repository{managed, free}, listRepositories(t, s)); diff != "" {
		t.Errorf("List() mismatch (-want +got):\n%s", diff)
	}

	if err := s.Repositories.UpdateBoard(t.Context(), managed.ID, ""); err != nil {
		t.Fatalf("UpdateBoard(none) = %v, want nil", err)
	}
	if err := s.Repositories.UpdateBoard(t.Context(), free.ID, "board-1"); err != nil {
		t.Fatalf("UpdateBoard(board-1) = %v, want nil", err)
	}
	managed.BoardID, free.BoardID = "", "board-1"
	if diff := cmp.Diff([]repository.Repository{managed, free}, listRepositories(t, s)); diff != "" {
		t.Errorf("List() after UpdateBoard mismatch (-want +got):\n%s", diff)
	}
}

func TestARepositoryWithoutACloneHasAnEmptyPath(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	repo := newRepository("repo-1", "acme", "api", "")
	insertRepository(t, s, repo)

	if diff := cmp.Diff([]repository.Repository{repo}, listRepositories(t, s)); diff != "" {
		t.Errorf("List() mismatch (-want +got):\n%s", diff)
	}
}

// seedBoard inserts a board with id into the database at path through a
// connection of its own, since no store method registers boards yet.
func seedBoard(t *testing.T, path, id string) {
	t.Helper()

	db, err := sql.Open("sqlite", "file:"+path)
	if err != nil {
		t.Fatalf("sql.Open() = %v, want nil", err)
	}
	defer func() { _ = db.Close() }()
	const insert = `INSERT INTO boards (id, owner, owner_type, number, title, url, created_at)
		VALUES (?, 'acme', 'organization', 1, 'Roadmap', 'https://github.com/orgs/acme/projects/1',
			'2026-09-06T10:00:00Z')`
	if _, err := db.ExecContext(t.Context(), insert, id); err != nil {
		t.Fatalf("insert board %s: %v", id, err)
	}
}
