package bindings_test

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/repository"
)

func TestBoardServiceTellsTheUserWhatWentWrong(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		github error
		call   func(s *bindings.BoardService) error
		want   string
	}{
		{
			name: "a URL that is not a project",
			call: func(s *bindings.BoardService) error {
				_, err := s.PreviewBoard("https://github.com/acme/web")
				return err
			},
			want: "This isn't the URL of a GitHub project.",
		},
		{
			name: "a repository not typed as owner/name",
			call: func(s *bindings.BoardService) error {
				_, err := s.CheckBoardRepository("", "web")
				return err
			},
			want: "Type the repository as owner/name.",
		},
		{
			name:   "gh without the project scope",
			github: gh.ErrMissingScope,
			call: func(s *bindings.BoardService) error {
				_, err := s.PreviewBoard("https://github.com/orgs/acme/projects/3")
				return err
			},
			want: "gh can't read projects. Run gh auth refresh -s read:project.",
		},
		{
			name: "a board nobody registered",
			call: func(s *bindings.BoardService) error { return s.RefreshBoard("board-9") },
			want: "This board isn't registered.",
		},
		{
			name: "a URL typed into the add dialog that is not a project",
			call: func(s *bindings.BoardService) error {
				return s.AddBoard("https://example.com", bindings.SaveBoardRequest{})
			},
			want: "This isn't the URL of a GitHub project.",
		},
		{
			name:   "gh signed out while checking a repository",
			github: gh.ErrNotAuthenticated,
			call: func(s *bindings.BoardService) error {
				_, err := s.CheckBoardRepository("", "acme/web")
				return err
			},
			want: "gh is not authenticated. Run gh auth login.",
		},
		{
			name: "editing a board nobody registered",
			call: func(s *bindings.BoardService) error {
				_, err := s.PreviewEditBoard("board-9")
				return err
			},
			want: "This board isn't registered.",
		},
		{
			name: "saving a board nobody registered",
			call: func(s *bindings.BoardService) error {
				return s.UpdateBoard("board-9", bindings.SaveBoardRequest{})
			},
			want: "This board isn't registered.",
		},
		{
			name: "previewing the removal of a board nobody registered",
			call: func(s *bindings.BoardService) error {
				_, err := s.PreviewRemoveBoard("board-9")
				return err
			},
			want: "This board isn't registered.",
		},
		{
			name: "removing a board nobody registered",
			call: func(s *bindings.BoardService) error { return s.RemoveBoard("board-9") },
			want: "This board isn't registered.",
		},
		{
			name: "refreshing a card of a board nobody registered",
			call: func(s *bindings.BoardService) error { return s.RefreshCard("board-9", "acme/web#1") },
			want: "This board isn't registered.",
		},
		{
			name: "adding a repository to a board nobody registered",
			call: func(s *bindings.BoardService) error {
				return s.AddRepositoryToBoard("board-9", bindings.BoardRepositoryChoice{Owner: "acme", Name: "web"})
			},
			want: "This board isn't registered.",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			if tt.github != nil {
				f.github.fail(tt.github)
			}

			err := tt.call(f.boardService)
			if err == nil || err.Error() != tt.want {
				t.Errorf("error = %v, want %q", err, tt.want)
			}
			if f.logged(t, "binding failed") {
				t.Error("the mistake was logged, want nothing logged")
			}
		})
	}
}

func TestCardContextRefusesACardTheReadingDoesNotHold(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	f.registerBoard(t, true, webCard(12))

	_, err := f.boardService.CardContext(testBoardID, "dev/web#7")

	if want := "This card isn't in the last reading of the board."; err == nil || err.Error() != want {
		t.Errorf("CardContext() = %v, want %q", err, want)
	}
	if f.logged(t, "binding failed") {
		t.Error("the mistake was logged, want nothing logged")
	}
}

func TestCardContextIsTheContextOfTheCardWithoutAdditionalText(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	card := webCard(12)
	f.registerBoard(t, true, card)

	got, err := f.boardService.CardContext(testBoardID, "dev/web#12")
	if err != nil {
		t.Fatalf("CardContext() = %v, want nil", err)
	}
	if want := board.Context(card, "", ""); got != want {
		t.Errorf("CardContext() = %q, want %q", got, want)
	}
}

func TestPreviewRemoveBoardCountsTheRepositoriesThatGoToNoBoard(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	f.registerBoard(t, true)

	got, err := f.boardService.PreviewRemoveBoard(testBoardID)
	if err != nil {
		t.Fatalf("PreviewRemoveBoard() = %v, want nil", err)
	}
	if diff := cmp.Diff(bindings.BoardRemoval{ToNoBoard: 1}, got); diff != "" {
		t.Errorf("PreviewRemoveBoard() mismatch (-want +got):\n%s", diff)
	}
}

func TestFromBoardPreviewCarriesTheStatusesAndTheRepositories(t *testing.T) {
	t.Parallel()

	preview := board.Preview{
		Locator:   board.Locator{Owner: "acme", OwnerType: board.OwnerUser, Number: 3},
		URL:       "https://github.com/users/acme/projects/3",
		Title:     "Roadmap",
		HasStatus: true,
		Statuses: []board.StatusOption{
			{Option: board.Option{ID: "todo", Name: "Todo"}},
			{Option: board.Option{ID: "done", Name: "Done"}, Final: true},
		},
		NewCardStatus: "todo",
		Repositories: []board.RepositoryOption{
			{
				Identity: repository.Identity{Owner: "acme", Name: "api"}, Cards: 2, Checked: true,
				Link: board.LinkClone, Path: "/src/api", Clones: []string{"/src/api", "/work/api"},
			},
			{
				Identity: repository.Identity{Owner: "acme", Name: "web"}, Cards: 5,
				Link: board.LinkOtherBoard, RepositoryID: "repo-1", OtherBoard: "Platform",
			},
		},
	}

	got := bindings.FromBoardPreview(preview)

	want := bindings.BoardPreview{
		URL: "https://github.com/users/acme/projects/3", Owner: "acme", OwnerType: "user", Number: 3,
		Title: "Roadmap", HasStatus: true,
		Statuses:      []bindings.BoardStatus{{ID: "todo", Name: "Todo"}, {ID: "done", Name: "Done", Final: true}},
		NewCardStatus: "todo",
		Repositories: []bindings.BoardRepositoryOption{
			{
				Owner: "acme", Name: "api", FullName: "acme/api", Cards: 2, Checked: true, Link: "clone",
				Path: "/src/api", Clones: []string{"/src/api", "/work/api"},
			},
			{
				Owner: "acme", Name: "web", FullName: "acme/web", Cards: 5, Link: "other_board",
				RepositoryID: "repo-1", Clones: []string{}, OtherBoard: "Platform",
			},
		},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("FromBoardPreview() mismatch (-want +got):\n%s", diff)
	}
	if empty := bindings.FromBoardPreview(board.Preview{}); empty.Statuses == nil || empty.Repositories == nil {
		t.Errorf("FromBoardPreview(empty) = %+v, want empty slices", empty)
	}
}

func TestRemoveBoardLeavesItsRepositoriesWithoutABoard(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	f.registerBoard(t, true)

	if err := f.boardService.RemoveBoard(testBoardID); err != nil {
		t.Fatalf("RemoveBoard() = %v, want nil", err)
	}

	state := f.state.GetState()
	if len(state.Boards) != 0 {
		t.Errorf("boards = %+v, want none", state.Boards)
	}
	if len(state.Repositories) != 1 || state.Repositories[0].BoardID != "" {
		t.Errorf("repositories = %+v, want the repository without a board", state.Repositories)
	}
}

func TestRefreshBoardRecordsAReadingThatFailed(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.registerBoard(t, false)
	f.github.fail(gh.ErrMissingScope)

	if err := f.boardService.RefreshBoard(testBoardID); err != nil {
		t.Fatalf("RefreshBoard() = %v, want nil", err)
	}

	deadline := time.Now().Add(pollTimeout)
	for {
		boards := f.state.GetState().Boards
		if len(boards) == 1 && !boards[0].Reading && boards[0].Failure != nil {
			if boards[0].Failure.Reason != "missing_scope" {
				t.Errorf("failure = %+v, want missing_scope", boards[0].Failure)
			}
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("boards = %+v, want the failed reading recorded", boards)
		}
		time.Sleep(pollStep)
	}
}

// roadmapStructure is what the fake gh answers the structure query of the
// board Roadmap with: a Status field with two options.
const roadmapStructure = `{
	"viewer": {"login": "dev"},
	"owner": {"projectV2": {
		"id": "project-1",
		"title": "Roadmap",
		"url": "https://github.com/orgs/acme/projects/3",
		"field": {"id": "field-status", "options": [
			{"id": "todo", "name": "Todo"},
			{"id": "done", "name": "Done"}
		]},
		"fields": {"nodes": []}
	}}
}`

func TestUpdateBoardSavesTheStatusACardOfADiscussionGets(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.registerBoard(t, true)
	f.github.reply(roadmapStructure)

	req := bindings.SaveBoardRequest{FinalStatuses: []string{"done"}, NewCardStatus: "todo"}
	if err := f.boardService.UpdateBoard(testBoardID, req); err != nil {
		t.Fatalf("UpdateBoard() = %v, want nil", err)
	}

	boards := f.state.GetState().Boards
	if len(boards) != 1 || boards[0].NewCardStatus != "todo" {
		t.Fatalf("boards = %+v, want the status a new card gets", boards)
	}
	if b, ok := f.boards.Get(testBoardID); !ok || b.NewCardStatus != "todo" {
		t.Errorf("board = %+v, want the status recorded", b)
	}
}
