package discussionflow

import (
	"context"
	"fmt"
	"slices"
	"strings"

	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/session"
)

// noOption is what the board section says about a field the board does not
// have.
const noOption = "none."

// StartParams is the discussion the user asked for in the dialog of a board.
type StartParams struct {
	BoardID string
	Title   string
	Text    string   // what the user wrote; "" for none
	Cards   []string // the keys of the cards of the stored reading
	Choice  models.Choice
}

// Start opens a discussion of a demand of a board: it builds the initial
// context from the board and the selected cards, creates the discussion with
// its artifact folder, and starts the conversation. It answers with the id of
// the discussion.
func (s *Service) Start(ctx context.Context, p StartParams) (string, error) {
	b, ok := s.boards.Get(p.BoardID)
	if !ok {
		return "", fmt.Errorf("start discussion on board %s: %w", p.BoardID, board.ErrNotFound)
	}
	if s.boards.Stored(p.BoardID).Reading == nil && len(p.Cards) > 0 {
		return "", fmt.Errorf("start discussion on board %s: %w", p.BoardID, ErrNoReading)
	}
	repos := s.boardRepositories(p.BoardID)
	cards, err := s.cardsOf(p.BoardID, p.Cards, repos)
	if err != nil {
		return "", err
	}

	created, err := s.discussions.Create(ctx, discussion.CreateParams{
		BoardID:     b.ID,
		BoardTitle:  b.Title,
		BoardOwner:  b.Owner,
		BoardNumber: b.Number,
		Title:       p.Title,
		Text:        p.Text,
		InitialContext: board.DiscussionContext(board.DiscussionContextInput{
			Title:        strings.TrimSpace(p.Title),
			BoardTitle:   b.Title,
			BoardURL:     b.URL,
			Repositories: contextRepositories(repos),
			Text:         p.Text,
			Cards:        cards,
		}),
		Cards: inputCards(cards),
	})
	if err != nil {
		return "", err
	}

	l := s.lockOf(created.ID)
	l.mu.Lock()
	defer l.mu.Unlock()

	if err = s.sessions.Start(ctx, s.info(created, p.Choice), false); err != nil {
		// The discussion is the app's own and nothing of it was used yet: it
		// goes with the conversation it could not have.
		if delErr := s.discussions.Delete(ctx, created.ID); delErr != nil {
			s.log.Error("delete discussion failed", "discussion", created.ID, "error", delErr)
		}
		return "", err
	}

	s.log.Info("discussion started", "discussion", created.ID, "board", b.ID, "cards", len(cards))
	s.notify(created.ID)
	return created.ID, nil
}

// cardsOf are the cards of the stored reading the discussion starts from, in
// the order the user picked them. A card of a repository the board does not
// manage is refused: the app answers for what it writes.
func (s *Service) cardsOf(boardID string, keys []string, repos []repository.Repository) ([]board.Card, error) {
	cards := make([]board.Card, 0, len(keys))
	for _, key := range keys {
		card, ok := s.boards.Card(boardID, key)
		if !ok {
			return nil, fmt.Errorf("start discussion on card %s: %w", key, board.ErrCardNotFound)
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

// boardRepositories are the repositories a board manages, in alphabetical
// order of owner/name.
func (s *Service) boardRepositories(boardID string) []repository.Repository {
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

// contextRepositories are the repositories of the board as the initial context
// lists them, with the clone of each one.
func contextRepositories(repos []repository.Repository) []board.DiscussionRepository {
	listed := make([]board.DiscussionRepository, 0, len(repos))
	for _, repo := range repos {
		listed = append(listed, board.DiscussionRepository{FullName: repo.FullName(), Path: repo.Path})
	}
	return listed
}

// inputCards are the cards the discussion keeps of the ones it started from.
func inputCards(cards []board.Card) []discussion.InputCard {
	kept := make([]discussion.InputCard, 0, len(cards))
	for _, card := range cards {
		kept = append(kept, inputCard(card))
	}
	return kept
}

// inputCard is a card of the board as a discussion names it.
func inputCard(card board.Card) discussion.InputCard {
	return discussion.InputCard{
		Owner:  card.Owner,
		Name:   card.Name,
		Number: card.Number,
		Title:  card.Title,
		URL:    card.URL,
	}
}

// info is what the conversation of a discussion needs to know about it: the
// artifact folder it runs in, the documents it writes and the board it writes
// cards for. The clones of the board come along as directories the agent may
// read, read again every time the conversation is opened.
func (s *Service) info(d discussion.Discussion, choice models.Choice) session.TaskInfo {
	var (
		section string
		clones  []string
	)
	if b, ok := s.boards.Get(d.BoardID); ok {
		repos := s.boardRepositories(d.BoardID)
		section = boardSection(b, s.boards.Stored(d.BoardID), repos)
		clones = s.clonesOf(repos)
	}
	return session.TaskInfo{
		ID:             d.ID,
		Name:           d.Title,
		Dir:            d.ArtifactsDir,
		ArtifactsDir:   d.ArtifactsDir,
		Stage:          session.DiscussionStage,
		Prompt:         prompts.StageDiscussion,
		InitialContext: d.InitialContext,
		DocumentPath:   d.DocumentPath(),
		DraftsPath:     d.DraftsPath(),
		Board:          section,
		ExtraDirs:      clones,
		Choice:         choice,
	}
}

// clonesOf are the paths of the repositories of the board that are cloned and
// there, which is what the agent reads the code in.
func (s *Service) clonesOf(repos []repository.Repository) []string {
	var clones []string
	for _, repo := range repos {
		if repo.Cloned() && !s.repositories.Missing(repo.ID) {
			clones = append(clones, repo.Path)
		}
	}
	return clones
}

// boardSection tells the agent what the board it writes cards for is: the
// repositories it manages, the module field a card takes and the status a new
// card gets.
func boardSection(b board.Board, stored board.Stored, repos []repository.Repository) string {
	fullNames := make([]string, 0, len(repos))
	for _, repo := range repos {
		fullNames = append(fullNames, repo.FullName())
	}
	managed := noOption
	if len(fullNames) > 0 {
		managed = strings.Join(fullNames, ", ")
	}
	return strings.Join([]string{
		"- Board: " + b.Title,
		"- Repositories managed by the board: " + managed,
		moduleLine(stored),
		statusLine(b, stored),
	}, "\n")
}

// moduleLine is the module field of the board with its options, or the word
// that says a draft takes no module.
func moduleLine(stored board.Stored) string {
	if stored.Reading == nil || stored.Reading.Module == nil {
		return "- Module field: none. Drafts have no module."
	}
	options := make([]string, 0, len(stored.Reading.Module.Options))
	for _, option := range stored.Reading.Module.Options {
		options = append(options, option.Name)
	}
	return "- Module field: `" + stored.Reading.Module.Name + "`, with the options: " + strings.Join(options, ", ")
}

// statusLine is the status a card created by the discussion gets.
func statusLine(b board.Board, stored board.Stored) string {
	name := noOption
	if stored.Reading != nil && b.NewCardStatus != "" {
		if option, ok := stored.Reading.StatusOption(b.NewCardStatus); ok {
			name = option.Name
		}
	}
	return "- Status for new cards: " + name
}
