package reviewflow

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/pulls"
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/worktree"
)

// noDescription is what the context document says when the pull request was
// opened with an empty body.
const noDescription = "_The pull request has no description._"

// StartParams is the review the user asked for in the dialog of the Reviews
// view.
type StartParams struct {
	RepositoryID string
	Number       int
	Instructions string
	Choice       models.Choice
	Mode         prreview.Mode
}

// Start reviews a pull request: it reads the pull request, creates the
// review with its worktree on a detached HEAD, writes the document that tells
// the agent what it is reviewing, and opens the conversation on the first
// pass. It answers with the id of the review.
func (s *Service) Start(ctx context.Context, p StartParams) (string, error) {
	repo, err := s.repositories.Check(p.RepositoryID)
	if err != nil {
		return "", err
	}
	detail, err := s.detailOf(ctx, repo, p.Number)
	if err != nil {
		return "", err
	}
	if err = s.startable(repo, detail); err != nil {
		return "", err
	}
	own := strings.EqualFold(detail.Author, s.pulls.Viewer())
	if p.Mode == prreview.ModeApply && !own {
		return "", fmt.Errorf("review %s: %w", reference(repo, p.Number), ErrApplyNotOwn)
	}

	created, err := s.reviews.Create(ctx, prreview.CreateParams{
		RepositoryID: repo.ID,
		Number:       detail.Number,
		Title:        detail.Title,
		Author:       detail.Author,
		URL:          detail.URL,
		HeadBranch:   detail.HeadBranch,
		BaseBranch:   detail.BaseBranch,
		HeadCommit:   detail.HeadCommit,
		Own:          own,
		Mode:         p.Mode,
		Card:         s.cardOf(repo, detail.Number),
	})
	if err != nil {
		return "", err
	}

	l := s.lockOf(created.ID)
	l.mu.Lock()
	defer l.mu.Unlock()

	wt, err := s.worktrees.EnsureDetached(
		ctx, created.ID, repo, worktree.ReviewDirName(detail.Number), detail.HeadBranch, detail.BaseBranch,
	)
	if err != nil {
		// The review is the app's own and nothing of it was used yet: it goes
		// with the worktree it could not have.
		if delErr := s.reviews.Delete(ctx, created.ID); delErr != nil {
			s.log.Error("delete review failed", "review", created.ID, "error", delErr)
		}
		return "", err
	}

	started, err := s.firstPass(ctx, created, repo, wt, detail, p)
	if err != nil {
		s.rollBack(ctx, created.ID)
		return "", err
	}

	s.log.Info("review started", "review", started.ID, "repository", repo.FullName(),
		"number", started.Number, "mode", string(started.Mode))
	s.notify(started.ID)
	return started.ID, nil
}

// firstPass writes the document of a new review and opens its conversation on
// the first pass. A process that fails to start is no error here: the session
// records it in the conversation, where the user tries again.
func (s *Service) firstPass(
	ctx context.Context, created prreview.Review, repo repository.Repository, wt worktree.Worktree,
	detail pulls.Detail, p StartParams,
) (prreview.Review, error) {
	created, err := s.writeContext(ctx, created, repo, detail)
	if err != nil {
		return prreview.Review{}, err
	}
	if created, err = s.reviews.AskPass(ctx, created.ID, 1, p.Instructions); err != nil {
		return prreview.Review{}, err
	}
	if err = s.sessions.Start(ctx, info(created, wt, repo, 1, p.Instructions, p.Choice), false); err != nil {
		return prreview.Review{}, err
	}
	return created, nil
}

// rollBack takes away a review whose start failed after its worktree was
// created, with its conversation and its worktree: a review left half started
// could neither start again nor take another pass. What fails here only goes
// to the log, because the failure of the start is what the user reads.
func (s *Service) rollBack(ctx context.Context, id string) {
	if err := s.sessions.DiscardTask(ctx, id); err != nil {
		s.log.Error("discard review session failed", "review", id, "error", err)
	}
	if err := s.worktrees.Remove(ctx, id); err != nil {
		s.log.Warn("remove review worktree failed", "review", id, "error", err)
	}
	if err := s.reviews.Delete(ctx, id); err != nil {
		s.log.Error("delete review failed", "review", id, "error", err)
	}
}

// detailOf reads the pull request a review is asked for from GitHub.
func (s *Service) detailOf(ctx context.Context, repo repository.Repository, number int) (pulls.Detail, error) {
	ref := pulls.Ref{Owner: repo.Owner, Name: repo.Name, Number: number}
	details, err := s.pulls.ReadDetails(ctx, []pulls.Ref{ref})
	if err != nil {
		return pulls.Detail{}, fmt.Errorf("read %s: %w", reference(repo, number), err)
	}
	detail, found := details[ref]
	if !found {
		return pulls.Detail{}, fmt.Errorf("read %s: %w", reference(repo, number), ErrPullRequestGone)
	}
	return detail, nil
}

// startable says whether a pull request can be reviewed on its own at all.
func (s *Service) startable(repo repository.Repository, detail pulls.Detail) error {
	ref := reference(repo, detail.Number)
	switch {
	case detail.State != string(prreview.PROpen):
		return fmt.Errorf("review %s: %w", ref, ErrNotOpen)
	case detail.Fork:
		return fmt.Errorf("review %s: %w", ref, ErrFork)
	}
	for _, taskPR := range s.tasks() {
		if taskPR.RepositoryID == repo.ID && taskPR.Number == detail.Number {
			return fmt.Errorf("review %s: %w", ref, ErrTaskPullRequest)
		}
	}
	if active, exists := s.reviews.ActiveOf(repo.ID, detail.Number); exists {
		return fmt.Errorf("review %s: %w", active.Reference(repo.FullName()), prreview.ErrActiveExists)
	}
	return nil
}

// cardOf is the card the pull request is linked to on a board of the user,
// nil when it is linked to none.
func (s *Service) cardOf(repo repository.Repository, number int) *prreview.Card {
	boardID, card, ok := s.boards.CardOfPullRequest(repo.Owner, repo.Name, number)
	if !ok {
		return nil
	}
	return storedCard(boardID, card)
}

// storedCard is the card as a review keeps it: what the header of the review
// shows and what the context document is written from.
func storedCard(boardID string, card board.Card) *prreview.Card {
	return &prreview.Card{
		BoardID: boardID,
		Owner:   card.Owner,
		Name:    card.Name,
		Number:  card.Number,
		Title:   card.Title,
		URL:     card.URL,
		Status:  card.Status,
	}
}

// writeContext writes the document that tells the agent which pull request it
// reviews, and brings the card the review keeps in step with the board, which
// is read again every time the document is written.
func (s *Service) writeContext(
	ctx context.Context, stored prreview.Review, repo repository.Repository, detail pulls.Detail,
) (prreview.Review, error) {
	boardID, card, hasCard := s.boards.CardOfPullRequest(repo.Owner, repo.Name, stored.Number)

	section := ""
	if hasCard {
		section = board.ReviewContext(card)
	}
	if err := s.reviews.WriteContext(stored.ID, contextDoc(detail, repo.FullName(), section)); err != nil {
		return prreview.Review{}, err
	}
	if !hasCard {
		return stored, nil
	}

	updated, err := s.reviews.Update(ctx, stored.ID, func(r *prreview.Review) {
		r.Card = storedCard(boardID, card)
	})
	if err != nil {
		return prreview.Review{}, err
	}
	return updated, nil
}

// contextDoc is the document of a review: the pull request as GitHub has it
// and, when there is one, the card it was opened for.
func contextDoc(detail pulls.Detail, fullName, cardSection string) string {
	description := strings.TrimSpace(detail.Body)
	if description == "" {
		description = noDescription
	}
	sections := []string{
		"# " + detail.Title,
		strings.Join([]string{
			fmt.Sprintf("- Pull request: %s#%d", fullName, detail.Number),
			"- Link: " + detail.URL,
			"- Author: " + detail.Author,
			fmt.Sprintf("- Branch `%s`, against `%s`", detail.HeadBranch, detail.BaseBranch),
		}, "\n"),
		"## Description",
		description,
	}
	if cardSection != "" {
		sections = append(sections, "## Card", cardSection)
	}
	return strings.Join(sections, "\n\n") + "\n"
}

// info is what the conversation of a review needs to know about it: the
// worktree it runs in, the document it reviews against and the report of the
// pass it is about to write.
func info(
	stored prreview.Review, wt worktree.Worktree, repo repository.Repository,
	pass int, passInstructions string, choice models.Choice,
) session.TaskInfo {
	return session.TaskInfo{
		ID:               stored.ID,
		Name:             stored.Reference(repo.FullName()),
		Dir:              wt.Path,
		ArtifactsDir:     stored.ArtifactsDir,
		Stage:            session.ReviewStage,
		Prompt:           prompts.StagePRReview,
		ContextPath:      stored.ContextPath(),
		Repository:       repo.FullName(),
		Branch:           stored.HeadBranch,
		BaseBranch:       remoteRef(stored.BaseBranch),
		ReviewPath:       stored.ReportPath(pass),
		PRNumber:         strconv.Itoa(stored.Number),
		PRURL:            stored.URL,
		External:         true,
		Publish:          stored.Mode == prreview.ModePublish,
		Instructions:     repo.ReviewInstructions,
		PassInstructions: passInstructions,
		Choice:           choice,
	}
}

// remoteRef is the base branch as the worktree of a review sees it: there is
// no local branch, so everything is read against origin.
func remoteRef(branch string) string { return "origin/" + branch }

// reference names a pull request the app has no review of yet.
func reference(repo repository.Repository, number int) string {
	return fmt.Sprintf("%s#%d", repo.FullName(), number)
}
