package store_test

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/store"
)

// newBoard builds a registered board, ready to insert.
func newBoard(id, title string, number int) board.Board {
	return board.Board{
		ID:            id,
		Owner:         "acme",
		OwnerType:     board.OwnerOrganization,
		Number:        number,
		Title:         title,
		URL:           "https://github.com/orgs/acme/projects/1",
		FinalStatuses: []string{},
		CreatedAt:     fixedTime,
	}
}

// insertBoard registers a board, failing the test on error.
func insertBoard(t *testing.T, s *store.Store, b board.Board, links ...board.Link) {
	t.Helper()

	if err := s.Boards.InsertBoard(t.Context(), b, links); err != nil {
		t.Fatalf("InsertBoard(%s) = %v, want nil", b.ID, err)
	}
}

// listBoards reads the registered boards, failing the test on error.
func listBoards(t *testing.T, s *store.Store) []board.Board {
	t.Helper()

	list, err := s.Boards.ListBoards(t.Context())
	if err != nil {
		t.Fatalf("ListBoards() = %v, want nil", err)
	}
	return list
}

// listReadings reads the stored readings, failing the test on error.
func listReadings(t *testing.T, s *store.Store) map[string]board.Stored {
	t.Helper()

	readings, err := s.Boards.ListReadings(t.Context())
	if err != nil {
		t.Fatalf("ListReadings() = %v, want nil", err)
	}
	return readings
}

// withBoard is a repository tied to a board.
func withBoard(repo repository.Repository, boardID string) repository.Repository {
	repo.BoardID = boardID
	return repo
}

func TestBoardsInsertWithNewAndExistingLinks(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	uncloned := newRepository("repo-docs", "acme", "docs", "")
	insertRepository(t, s, uncloned)

	b := newBoard("board-1", "Roadmap", 1)
	b.FinalStatuses = []string{"opt-done"}
	insertBoard(t, s, b,
		board.Link{RepositoryID: webRepo, Path: "/elsewhere/web"},
		board.Link{RepositoryID: uncloned.ID, Path: "/home/dev/docs"},
		board.Link{NewID: "repo-new", Owner: "acme", Name: "new", Path: "/home/dev/new", CreatedAt: fixedTime},
		board.Link{NewID: "repo-far", Owner: "acme", Name: "far", CreatedAt: fixedTime},
	)

	if diff := cmp.Diff([]board.Board{b}, listBoards(t, s)); diff != "" {
		t.Errorf("ListBoards() mismatch (-want +got):\n%s", diff)
	}
	wantReadings := map[string]board.Stored{b.ID: {}}
	if diff := cmp.Diff(wantReadings, listReadings(t, s)); diff != "" {
		t.Errorf("ListReadings() mismatch (-want +got):\n%s", diff)
	}

	want := []repository.Repository{
		withBoard(newRepository("repo-docs", "acme", "docs", "/home/dev/docs"), b.ID),
		withBoard(newRepository("repo-far", "acme", "far", ""), b.ID),
		withBoard(newRepository("repo-new", "acme", "new", "/home/dev/new"), b.ID),
		newRepository(apiRepo, "dev", "api", "/home/dev/api"),
		// A registered repository with a clone keeps it.
		withBoard(newRepository(webRepo, "dev", "web", "/home/dev/web"), b.ID),
	}
	if diff := cmp.Diff(want, listRepositories(t, s)); diff != "" {
		t.Errorf("List() mismatch (-want +got):\n%s", diff)
	}
}

func TestBoardsUpdateAppliesReleasesAndLinks(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	insertRepository(t, s, newRepository("repo-docs", "acme", "docs", ""))
	b := newBoard("board-1", "Roadmap", 1)
	insertBoard(t, s, b,
		board.Link{RepositoryID: webRepo},
		board.Link{RepositoryID: "repo-docs"},
	)

	b.Title = "Roadmap 2026"
	b.FinalStatuses = []string{"opt-done", "opt-closed"}
	err := s.Boards.UpdateBoard(t.Context(), b,
		[]board.Link{{RepositoryID: apiRepo}},
		[]board.Release{{RepositoryID: webRepo}, {RepositoryID: "repo-docs", Remove: true}},
	)
	if err != nil {
		t.Fatalf("UpdateBoard() = %v, want nil", err)
	}

	if diff := cmp.Diff([]board.Board{b}, listBoards(t, s)); diff != "" {
		t.Errorf("ListBoards() mismatch (-want +got):\n%s", diff)
	}
	want := []repository.Repository{
		withBoard(newRepository(apiRepo, "dev", "api", "/home/dev/api"), b.ID),
		newRepository(webRepo, "dev", "web", "/home/dev/web"),
	}
	if diff := cmp.Diff(want, listRepositories(t, s)); diff != "" {
		t.Errorf("List() mismatch (-want +got):\n%s", diff)
	}
}

func TestBoardsDeleteKeepsTheRepositoriesWithAClone(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	insertRepository(t, s, newRepository("repo-docs", "acme", "docs", ""))
	b := newBoard("board-1", "Roadmap", 1)
	insertBoard(t, s, b,
		board.Link{RepositoryID: webRepo},
		board.Link{RepositoryID: apiRepo},
		board.Link{RepositoryID: "repo-docs"},
	)

	// The api repository has no release: the board going leaves it without one.
	err := s.Boards.DeleteBoard(t.Context(), b.ID, []board.Release{
		{RepositoryID: webRepo},
		{RepositoryID: "repo-docs", Remove: true},
	})
	if err != nil {
		t.Fatalf("DeleteBoard() = %v, want nil", err)
	}

	if got := listBoards(t, s); got != nil {
		t.Errorf("ListBoards() = %v, want nil", got)
	}
	if got := listReadings(t, s); len(got) != 0 {
		t.Errorf("ListReadings() = %v, want empty", got)
	}
	want := []repository.Repository{
		newRepository(apiRepo, "dev", "api", "/home/dev/api"),
		newRepository(webRepo, "dev", "web", "/home/dev/web"),
	}
	if diff := cmp.Diff(want, listRepositories(t, s)); diff != "" {
		t.Errorf("List() mismatch (-want +got):\n%s", diff)
	}
}

func TestBoardsReadingIsSavedAndAFailureKeepsIt(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	b := newBoard("board-1", "Roadmap", 1)
	insertBoard(t, s, b)

	readAt := fixedTime.Add(time.Hour)
	reading := board.Reading{
		ProjectID: "PVT_1",
		Title:     "Roadmap renamed",
		Viewer:    "dev",
		Statuses:  []board.Option{{ID: "opt-todo", Name: "Todo"}},
		HasStatus: true,
		Cards: []board.Card{{
			Issue:    board.Issue{Owner: "acme", Name: "web", Number: 7, Title: "Login", URL: "https://github.com/acme/web/issues/7", State: "open"},
			StatusID: "opt-todo",
			Status:   "Todo",
			ReadAt:   readAt,
		}},
	}
	if err := s.Boards.SaveReading(t.Context(), b.ID, reading.Title, reading, readAt); err != nil {
		t.Fatalf("SaveReading() = %v, want nil", err)
	}

	failedAt := readAt.Add(time.Hour)
	failure := board.Failure{Reason: board.ReasonRateLimited, ResetAt: failedAt.Add(time.Minute)}
	if err := s.Boards.SaveFailure(t.Context(), b.ID, failure, failedAt); err != nil {
		t.Fatalf("SaveFailure() = %v, want nil", err)
	}

	want := map[string]board.Stored{b.ID: {
		Reading:  &reading,
		ReadAt:   readAt,
		Failure:  &failure,
		FailedAt: failedAt,
	}}
	if diff := cmp.Diff(want, listReadings(t, s)); diff != "" {
		t.Errorf("ListReadings() after failure mismatch (-want +got):\n%s", diff)
	}
	if got := listBoards(t, s)[0].Title; got != reading.Title {
		t.Errorf("board title = %q, want %q", got, reading.Title)
	}

	// A reading that succeeds clears the failure.
	if err := s.Boards.SaveReading(t.Context(), b.ID, reading.Title, reading, failedAt); err != nil {
		t.Fatalf("SaveReading() = %v, want nil", err)
	}
	want = map[string]board.Stored{b.ID: {Reading: &reading, ReadAt: failedAt}}
	if diff := cmp.Diff(want, listReadings(t, s)); diff != "" {
		t.Errorf("ListReadings() after reading mismatch (-want +got):\n%s", diff)
	}
}

func TestBoardsAreListedByTitleIgnoringCase(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	zeta := newBoard("board-1", "zeta", 1)
	alpha := newBoard("board-3", "Alpha", 2)
	beta := newBoard("board-2", "beta", 3)
	sameB := newBoard("board-0", "Beta", 4)
	for _, b := range []board.Board{zeta, alpha, beta, sameB} {
		insertBoard(t, s, b)
	}

	want := []board.Board{alpha, sameB, beta, zeta}
	if diff := cmp.Diff(want, listBoards(t, s)); diff != "" {
		t.Errorf("ListBoards() mismatch (-want +got):\n%s", diff)
	}
}
