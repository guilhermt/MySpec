package bindings

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/guilhermt/myspec/internal/board"
)

// boardCallTimeout bounds a call that reads GitHub and scans the home folder.
const boardCallTimeout = 3 * time.Minute

// BoardService is the board API the frontend calls.
type BoardService struct {
	late      late[BoardService]
	boards    *board.Service
	documents func(owner, name string, number int) (string, bool)
	log       *slog.Logger
}

// NewBoardService builds the service over the board domain. documents is the
// understanding of the discussion that wrote a card, which the context of the
// card opens with; without it, no card has one.
func NewBoardService(
	boards *board.Service,
	documents func(owner, name string, number int) (string, bool),
	log *slog.Logger,
) *BoardService {
	if documents == nil {
		documents = func(string, string, int) (string, bool) { return "", false }
	}
	return &BoardService{boards: boards, documents: documents, log: log}
}

// PreviewBoard reads the board at url for registering it: its statuses, with
// the final ones pre-marked, and the repositories its issues are in.
func (s *BoardService) PreviewBoard(url string) (BoardPreview, error) {
	s, err := s.late.resolve(s)
	if err != nil {
		return BoardPreview{}, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), boardCallTimeout)
	defer cancel()

	preview, err := s.boards.Preview(ctx, url)
	if err != nil {
		return BoardPreview{}, s.fail("PreviewBoard", err)
	}
	return FromBoardPreview(preview), nil
}

// PreviewEditBoard reads a registered board again for editing it.
func (s *BoardService) PreviewEditBoard(id string) (BoardPreview, error) {
	s, err := s.late.resolve(s)
	if err != nil {
		return BoardPreview{}, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), boardCallTimeout)
	defer cancel()

	preview, err := s.boards.PreviewEdit(ctx, id)
	if err != nil {
		return BoardPreview{}, s.fail("PreviewEditBoard", err)
	}
	return FromBoardPreview(preview), nil
}

// CheckBoardRepository checks a repository the user typed as owner/name for the
// board of boardID, "" for a board not registered yet.
func (s *BoardService) CheckBoardRepository(boardID, fullName string) (BoardRepositoryOption, error) {
	s, err := s.late.resolve(s)
	if err != nil {
		return BoardRepositoryOption{}, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), boardCallTimeout)
	defer cancel()

	option, err := s.boards.CheckRepository(ctx, boardID, fullName)
	if err != nil {
		return BoardRepositoryOption{}, s.fail("CheckBoardRepository", err)
	}
	return FromBoardRepositoryOption(option), nil
}

// AddBoard registers the board at url with what the user chose, then reads it.
func (s *BoardService) AddBoard(url string, req SaveBoardRequest) error {
	s, err := s.late.resolve(s)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), boardCallTimeout)
	defer cancel()

	if _, err := s.boards.Add(ctx, url, saveParamsOf(req)); err != nil {
		return s.fail("AddBoard", err)
	}
	return nil
}

// UpdateBoard saves what the user chose for a registered board.
func (s *BoardService) UpdateBoard(id string, req SaveBoardRequest) error {
	s, err := s.late.resolve(s)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), boardCallTimeout)
	defer cancel()

	if err := s.boards.Update(ctx, id, saveParamsOf(req)); err != nil {
		return s.fail("UpdateBoard", err)
	}
	return nil
}

// PreviewRemoveBoard is what removing a board does to its repositories.
func (s *BoardService) PreviewRemoveBoard(id string) (BoardRemoval, error) {
	s, err := s.late.resolve(s)
	if err != nil {
		return BoardRemoval{}, err
	}
	removal, err := s.boards.RemovalPreview(id)
	if err != nil {
		return BoardRemoval{}, s.fail("PreviewRemoveBoard", err)
	}
	return FromRemoval(removal), nil
}

// RemoveBoard removes a board and releases every repository of it.
func (s *BoardService) RemoveBoard(id string) error {
	s, err := s.late.resolve(s)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.boards.Remove(ctx, id); err != nil {
		return s.fail("RemoveBoard", err)
	}
	return nil
}

// RefreshBoard starts a reading of a board. It returns at once; the reading
// arrives as state.
func (s *BoardService) RefreshBoard(id string) error {
	s, err := s.late.resolve(s)
	if err != nil {
		return err
	}
	if _, ok := s.boards.Get(id); !ok {
		return s.fail("RefreshBoard", fmt.Errorf("refresh board %s: %w", id, board.ErrNotFound))
	}
	s.boards.Refresh(id)
	return nil
}

// RefreshCard reads one card of a board again.
func (s *BoardService) RefreshCard(boardID, key string) error {
	s, err := s.late.resolve(s)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), boardCallTimeout)
	defer cancel()

	if err := s.boards.RefreshCard(ctx, boardID, key); err != nil {
		return s.fail("RefreshCard", err)
	}
	return nil
}

// CardContext is the context a task created from a card starts with, without
// the text the user adds.
func (s *BoardService) CardContext(boardID, key string) (string, error) {
	s, err := s.late.resolve(s)
	if err != nil {
		return "", err
	}
	card, ok := s.boards.Card(boardID, key)
	if !ok {
		return "", s.fail("CardContext", fmt.Errorf("context of card %s: %w", key, board.ErrCardNotFound))
	}
	document, _ := s.documents(card.Owner, card.Name, card.Number)
	text, err := s.boards.Context(boardID, key, document, "")
	if err != nil {
		return "", s.fail("CardContext", err)
	}
	return text, nil
}

// AddRepositoryToBoard ties one more repository to a board.
func (s *BoardService) AddRepositoryToBoard(boardID string, choice BoardRepositoryChoice) error {
	s, err := s.late.resolve(s)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), gitCallTimeout)
	defer cancel()

	if err := s.boards.AddRepository(ctx, boardID, repositoryChoiceOf(choice)); err != nil {
		return s.fail("AddRepositoryToBoard", err)
	}
	return nil
}

func (s *BoardService) fail(method string, err error) error { return failure(s.log, method, err) }
