package bindings

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/discussionflow"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/repository"
)

// DiscussionService is the discussion API the frontend calls. The conversation
// of a discussion goes through TaskService, like the one of a task: the id of
// the discussion is the id of the item behind it.
type DiscussionService struct {
	flow         *discussionflow.Service
	discussions  *discussion.Service
	repositories *repository.Service
	log          *slog.Logger
}

// NewDiscussionService builds the service over the discussions of a board.
func NewDiscussionService(
	flow *discussionflow.Service,
	discussions *discussion.Service,
	repositories *repository.Service,
	log *slog.Logger,
) *DiscussionService {
	return &DiscussionService{
		flow:         flow,
		discussions:  discussions,
		repositories: repositories,
		log:          log,
	}
}

// StartDiscussion opens a discussion of a demand of a board: it creates the
// discussion with its artifact folder and its conversation, and answers with
// the id of the discussion.
func (s *DiscussionService) StartDiscussion(req StartDiscussionRequest) (string, error) {
	choice, err := models.ParseChoice(req.Model, req.Effort)
	if err != nil {
		return "", s.fail("StartDiscussion", err)
	}

	// Starting a discussion reads the clones of the board, which is git work.
	ctx, cancel := context.WithTimeout(context.Background(), gitCallTimeout)
	defer cancel()

	id, err := s.flow.Start(ctx, discussionflow.StartParams{
		BoardID: req.BoardID,
		Title:   req.Title,
		Text:    req.Text,
		Cards:   req.Cards,
		Choice:  choice,
	})
	if err != nil {
		var undone *discussionflow.UndoneError
		if errors.As(err, &undone) {
			return "", undoneFailure(s.fail("StartDiscussion", undone.Err), nil, "The discussion was undone.")
		}
		return "", s.fail("StartDiscussion", err)
	}
	return id, nil
}

// DiscussionContext is the context a discussion would start with, built from
// the stored reading of the board. It creates nothing: the dialog shows it
// while the user is still choosing what to discuss, with no title yet.
func (s *DiscussionService) DiscussionContext(req DiscussionContextRequest) (string, error) {
	text, err := s.flow.Context(req.BoardID, "", req.Text, req.Cards)
	if err != nil {
		return "", s.fail("DiscussionContext", err)
	}
	return text, nil
}

// SetDraftText records the title and the body the user left on a draft, which
// is what a publication sends.
func (s *DiscussionService) SetDraftText(id, draftID, title, body string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.SetDraftText(ctx, id, draftID, title, body); err != nil {
		return s.fail("SetDraftText", err)
	}
	return nil
}

// SetDraftRepository records the registered repository a new card or an epic
// is created in.
func (s *DiscussionService) SetDraftRepository(id, draftID, repositoryID string) error {
	repo, ok := s.repositories.Get(repositoryID)
	if !ok {
		return s.fail("SetDraftRepository", fmt.Errorf(
			"repository %s of draft %s: %w", repositoryID, draftID, repository.ErrNotFound,
		))
	}
	// A card of a discussion is created in a repository of the board it is
	// about, the same rule the cards it started from answer to.
	if stored, found := s.discussions.Get(id); found && stored.BoardID != repo.BoardID {
		return s.fail("SetDraftRepository", &board.Refusal{
			Reason: board.RefusalNotManaged, Repository: repo.FullName(),
		})
	}

	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.SetDraftRepository(ctx, id, draftID, repo.Owner, repo.Name); err != nil {
		return s.fail("SetDraftRepository", err)
	}
	return nil
}

// SetDraftModule records the module of a card; "" is a card with none.
func (s *DiscussionService) SetDraftModule(id, draftID, module string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.SetDraftModule(ctx, id, draftID, module); err != nil {
		return s.fail("SetDraftModule", err)
	}
	return nil
}

// SetDraftEpic records the epic of a card: an epic draft of the discussion, an
// issue as owner/name#number, or "" for none.
func (s *DiscussionService) SetDraftEpic(id, draftID, ref string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.SetDraftEpic(ctx, id, draftID, ref); err != nil {
		return s.fail("SetDraftEpic", err)
	}
	return nil
}

// AddDraftDependency records that a card can only start after another one.
func (s *DiscussionService) AddDraftDependency(id, draftID, ref string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.AddDraftDependency(ctx, id, draftID, ref); err != nil {
		return s.fail("AddDraftDependency", err)
	}
	return nil
}

// RemoveDraftDependency drops a dependency of a card.
func (s *DiscussionService) RemoveDraftDependency(id, draftID, ref string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.RemoveDraftDependency(ctx, id, draftID, ref); err != nil {
		return s.fail("RemoveDraftDependency", err)
	}
	return nil
}

// DecideDraft records what the user decided about one draft: "", approved or
// discarded.
func (s *DiscussionService) DecideDraft(id, draftID, decision string) error {
	d, err := discussion.ParseDecision(decision)
	if err != nil {
		return s.fail("DecideDraft", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.Decide(ctx, id, draftID, d); err != nil {
		return s.fail("DecideDraft", err)
	}
	return nil
}

// GroupIntoEpic puts loose card drafts of the current round under a new epic
// with this title, in this repository of the board, and answers with its id.
func (s *DiscussionService) GroupIntoEpic(id string, draftIDs []string, title, repositoryID string) (string, error) {
	repo, ok := s.repositories.Get(repositoryID)
	if !ok {
		return "", s.fail("GroupIntoEpic", fmt.Errorf(
			"repository %s of the epic: %w", repositoryID, repository.ErrNotFound,
		))
	}
	if stored, found := s.discussions.Get(id); found && stored.BoardID != repo.BoardID {
		return "", s.fail("GroupIntoEpic", &board.Refusal{
			Reason: board.RefusalNotManaged, Repository: repo.FullName(),
		})
	}

	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	epic, err := s.flow.GroupIntoEpic(ctx, id, draftIDs, title, repo.Owner, repo.Name)
	if err != nil {
		return "", s.fail("GroupIntoEpic", err)
	}
	return epic.ID, nil
}

// RetryPublish sends a draft whose publication failed to GitHub again, from
// the step it stopped at.
func (s *DiscussionService) RetryPublish(id, draftID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.Retry(ctx, id, draftID); err != nil {
		return s.fail("RetryPublish", err)
	}
	return nil
}

// ArchiveDiscussion takes a discussion out of the list and into the history,
// with its conversation kept for the user to read.
func (s *DiscussionService) ArchiveDiscussion(id string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.Archive(ctx, id); err != nil {
		return s.fail("ArchiveDiscussion", err)
	}
	return nil
}

// DeleteDiscussion removes a discussion for good, active or in the history.
// What it already published on GitHub stays there.
func (s *DiscussionService) DeleteDiscussion(id string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.Delete(ctx, id); err != nil {
		return s.fail("DeleteDiscussion", err)
	}
	return nil
}

// ReadDiscussionArtifact returns the content of an artifact of a discussion by
// file name: context.md, discussion.md or drafts.md.
func (s *DiscussionService) ReadDiscussionArtifact(id, name string) (string, error) {
	content, err := s.discussions.ReadArtifact(id, name)
	if err != nil {
		return "", s.fail("ReadDiscussionArtifact", err)
	}
	return content, nil
}

func (s *DiscussionService) fail(method string, err error) error { return failure(s.log, method, err) }
