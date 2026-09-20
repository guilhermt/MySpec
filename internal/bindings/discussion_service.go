package bindings

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"strings"

	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/discussionflow"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/repository"
)

// emptyTitleHeading is what the context of a discussion opens with while the
// dialog has no title: the preview starts at the board instead.
const emptyTitleHeading = "# \n\n"

// DiscussionService is the discussion API the frontend calls. The conversation
// of a discussion goes through TaskService, like the one of a task: the id of
// the discussion is the id of the item behind it.
type DiscussionService struct {
	flow         *discussionflow.Service
	discussions  *discussion.Service
	boards       *board.Service
	repositories *repository.Service
	log          *slog.Logger
}

// NewDiscussionService builds the service over the discussions of a board.
func NewDiscussionService(
	flow *discussionflow.Service,
	discussions *discussion.Service,
	boards *board.Service,
	repositories *repository.Service,
	log *slog.Logger,
) *DiscussionService {
	return &DiscussionService{
		flow:         flow,
		discussions:  discussions,
		boards:       boards,
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
		return "", s.fail("StartDiscussion", err)
	}
	return id, nil
}

// DiscussionContext is the context a discussion would start with, built from
// the stored reading of the board. It creates nothing: the dialog shows it
// while the user is still choosing what to discuss.
func (s *DiscussionService) DiscussionContext(req DiscussionContextRequest) (string, error) {
	b, ok := s.boards.Get(req.BoardID)
	if !ok {
		return "", s.fail("DiscussionContext", fmt.Errorf("context of board %s: %w", req.BoardID, board.ErrNotFound))
	}
	repos := s.boardRepositories(req.BoardID)
	cards, err := s.cardsOf(req.BoardID, req.Cards, repos)
	if err != nil {
		return "", s.fail("DiscussionContext", err)
	}

	text := board.DiscussionContext(board.DiscussionContextInput{
		BoardTitle:   b.Title,
		BoardURL:     b.URL,
		Repositories: contextRepositories(repos),
		Text:         req.Text,
		Cards:        cards,
	})
	return strings.TrimPrefix(text, emptyTitleHeading), nil
}

// boardRepositories are the repositories a board manages, in alphabetical
// order of owner/name.
func (s *DiscussionService) boardRepositories(boardID string) []repository.Repository {
	var repos []repository.Repository
	for _, repo := range s.repositories.List() {
		if repo.BoardID == boardID {
			repos = append(repos, repo)
		}
	}
	slices.SortFunc(repos, func(a, b repository.Repository) int {
		return strings.Compare(a.FullName(), b.FullName())
	})
	return repos
}

// contextRepositories are the repositories of the board as the context lists
// them, with the clone of each one.
func contextRepositories(repos []repository.Repository) []board.DiscussionRepository {
	listed := make([]board.DiscussionRepository, 0, len(repos))
	for _, repo := range repos {
		listed = append(listed, board.DiscussionRepository{FullName: repo.FullName(), Path: repo.Path})
	}
	return listed
}

// cardsOf are the cards of the stored reading the context is built from, in
// the order the user picked them. A card of a repository the board does not
// manage is refused, as it is when the discussion starts.
func (s *DiscussionService) cardsOf(
	boardID string, keys []string, repos []repository.Repository,
) ([]board.Card, error) {
	cards := make([]board.Card, 0, len(keys))
	for _, key := range keys {
		card, ok := s.boards.Card(boardID, key)
		if !ok {
			return nil, fmt.Errorf("context of card %s: %w", key, board.ErrCardNotFound)
		}
		if !slices.ContainsFunc(repos, func(r repository.Repository) bool {
			return strings.EqualFold(r.FullName(), card.FullName())
		}) {
			return nil, &board.Refusal{Reason: board.RefusalNotManaged, Repository: card.FullName()}
		}
		cards = append(cards, card)
	}
	return cards, nil
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

// GroupIntoEpic creates an epic over the given cards and points every one of
// them at it. It answers with the id of the epic.
func (s *DiscussionService) GroupIntoEpic(id string, draftIDs []string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	epic, err := s.flow.GroupIntoEpic(ctx, id, draftIDs)
	if err != nil {
		return "", s.fail("GroupIntoEpic", err)
	}
	return epic.ID, nil
}

// PublishEpic asks for an epic and the cards under it to go to GitHub
// together. It returns as soon as the publication is asked for; what it writes
// arrives as state.
func (s *DiscussionService) PublishEpic(id, draftID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.PublishEpic(ctx, id, draftID); err != nil {
		return s.fail("PublishEpic", err)
	}
	return nil
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
		// A discussion that cannot be archived yet says why in its own words,
		// which is the hint the panel shows next to the button.
		if state, ok := s.flow.State(id); ok && errors.Is(err, discussionflow.ErrCannotArchive) && state.ArchiveHint != "" {
			return errors.New(state.ArchiveHint)
		}
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
