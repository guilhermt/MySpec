package bindings

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"path/filepath"
	"strconv"
	"time"

	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/pulls"
	"github.com/guilhermt/myspec/internal/reviewflow"
	"github.com/guilhermt/myspec/internal/worktree"
)

// publishTimeout bounds a publication, which sends a whole review to GitHub
// and waits for gh to answer.
const publishTimeout = time.Minute

// errNotAnchored is a finding the user asked to open that points at no line of
// the pull request.
var errNotAnchored = errors.New("bindings: the finding is not anchored to a file")

// Worktrees is the registry of worktrees the review service reads the folder
// of a review from. internal/app passes worktree.Service.
type Worktrees interface {
	Get(itemID string) (worktree.Worktree, bool)
}

// ReviewService is the pull request and review API the frontend calls. The
// conversation of a review goes through TaskService, like the one of a task:
// the id of the review is the id of the item behind it.
type ReviewService struct {
	flow      *reviewflow.Service
	reviews   *prreview.Service
	pulls     *pulls.Service
	worktrees Worktrees
	editor    Editor
	log       *slog.Logger
}

// NewReviewService builds the service over the reviews of pull requests.
func NewReviewService(
	flow *reviewflow.Service,
	reviews *prreview.Service,
	pullRequests *pulls.Service,
	worktrees Worktrees,
	editor Editor,
	log *slog.Logger,
) *ReviewService {
	return &ReviewService{
		flow:      flow,
		reviews:   reviews,
		pulls:     pullRequests,
		worktrees: worktrees,
		editor:    editor,
		log:       log,
	}
}

// RefreshPullRequests reads the open pull requests of every registered
// repository again. The reading runs in the background and reaches the
// interface with the state.
func (s *ReviewService) RefreshPullRequests() {
	s.pulls.Refresh()
}

// SetReviewFilters chooses what the Reviews view shows.
func (s *ReviewService) SetReviewFilters(f ReviewFilters) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.pulls.SetFilters(ctx, filtersOf(f)); err != nil {
		return s.fail("SetReviewFilters", err)
	}
	return nil
}

// StartReview reviews a pull request: it creates the review, its worktree and
// its conversation, and answers with the id of the review.
func (s *ReviewService) StartReview(req StartReviewRequest) (string, error) {
	choice, err := models.ParseChoice(req.Model, req.Effort)
	if err != nil {
		return "", s.fail("StartReview", err)
	}
	mode, err := prreview.ParseMode(req.Mode)
	if err != nil {
		return "", s.fail("StartReview", err)
	}

	// Starting a review fetches the pull request and creates a worktree, which
	// is git work.
	ctx, cancel := context.WithTimeout(context.Background(), removeTimeout)
	defer cancel()

	id, err := s.flow.Start(ctx, reviewflow.StartParams{
		RepositoryID: req.RepositoryID,
		Number:       req.Number,
		Instructions: req.Instructions,
		Choice:       choice,
		Mode:         mode,
	})
	if err != nil {
		return "", s.fail("StartReview", err)
	}
	return id, nil
}

// ReviewAgain asks the agent for another pass over the pull request as it is
// now.
func (s *ReviewService) ReviewAgain(id, instructions string) error {
	// Another pass brings the worktree to the head of the pull request, which
	// is git work.
	ctx, cancel := context.WithTimeout(context.Background(), removeTimeout)
	defer cancel()

	if err := s.flow.ReviewAgain(ctx, id, instructions); err != nil {
		return s.fail("ReviewAgain", err)
	}
	return nil
}

// DecideFinding records what the user decided about one finding: "", approved
// or discarded.
func (s *ReviewService) DecideFinding(id string, pass, number int, decision string) error {
	d, err := prreview.ParseDecision(decision)
	if err != nil {
		return s.fail("DecideFinding", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.Decide(ctx, id, pass, number, d); err != nil {
		return s.fail("DecideFinding", err)
	}
	return nil
}

// SetFindingText records the text of a finding as the user left it, which is
// what a published comment says.
func (s *ReviewService) SetFindingText(id string, pass, number int, text string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.SetFindingText(ctx, id, pass, number, text); err != nil {
		return s.fail("SetFindingText", err)
	}
	return nil
}

// SetReviewSummary records the summary of a pass as the user left it, which is
// what the body of a published review opens with.
func (s *ReviewService) SetReviewSummary(id string, pass int, text string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.SetSummary(ctx, id, pass, text); err != nil {
		return s.fail("SetReviewSummary", err)
	}
	return nil
}

// PublishReview sends the findings the user approved to GitHub as one review,
// with the verdict they chose: approve, request_changes or comment.
func (s *ReviewService) PublishReview(id, verdict string) error {
	v, err := prreview.ParseVerdict(verdict)
	if err != nil {
		return s.fail("PublishReview", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), publishTimeout)
	defer cancel()

	if err := s.flow.Publish(ctx, id, v); err != nil {
		return s.fail("PublishReview", err)
	}
	return nil
}

// ApplyReview asks the agent to fix the findings the user approved, in the
// worktree of the review.
func (s *ReviewService) ApplyReview(id string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.Apply(ctx, id); err != nil {
		return s.fail("ApplyReview", err)
	}
	return nil
}

// ApproveReview approves the changes the agent made and asks it to commit them
// and push them to the pull request.
func (s *ReviewService) ApproveReview(id string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.Approve(ctx, id); err != nil {
		return s.fail("ApproveReview", err)
	}
	return nil
}

// DeleteReview removes a review for good, active or archived, and answers with
// what git could not remove.
func (s *ReviewService) DeleteReview(id string) (DeleteResult, error) {
	// Deleting a review removes its worktree, which is git work.
	ctx, cancel := context.WithTimeout(context.Background(), removeTimeout)
	defer cancel()

	left, err := s.flow.Delete(ctx, id)
	if err != nil {
		return DeleteResult{}, s.fail("DeleteReview", err)
	}
	return FromReviewLeftover(left), nil
}

// ReadReviewArtifact returns the content of an artifact of a review by file
// name: its context document or the report of one pass.
func (s *ReviewService) ReadReviewArtifact(id, name string) (string, error) {
	content, err := s.reviews.ReadArtifact(id, name)
	if err != nil {
		return "", s.fail("ReadReviewArtifact", err)
	}
	return content, nil
}

// OpenReviewInEditor opens the worktree of a review in the user's editor.
func (s *ReviewService) OpenReviewInEditor(id string) error {
	path, err := s.worktreeOf(id)
	if err != nil {
		return s.fail("OpenReviewInEditor", err)
	}
	if err := s.editor(path); err != nil {
		return s.fail("OpenReviewInEditor", err)
	}
	return nil
}

// OpenFindingInEditor opens the line a finding points at, in the window of the
// worktree of the review. A finding about the pull request as a whole points at
// no line and cannot be opened.
func (s *ReviewService) OpenFindingInEditor(id string, pass, number int) error {
	finding, err := s.findingOf(id, pass, number)
	if err != nil {
		return s.fail("OpenFindingInEditor", err)
	}
	path, err := s.worktreeOf(id)
	if err != nil {
		return s.fail("OpenFindingInEditor", err)
	}
	// The line is what -g adds to opening the file: VS Code puts the cursor on
	// it instead of at the top.
	target := filepath.Join(path, finding.Path) + ":" + strconv.Itoa(finding.Line)
	if err := s.editor(path, "-g", target); err != nil {
		return s.fail("OpenFindingInEditor", err)
	}
	return nil
}

// findingOf is one finding of one pass of a review, refused when the review,
// the pass or the finding is gone, or when the finding is anchored to nothing.
func (s *ReviewService) findingOf(id string, pass, number int) (prreview.Finding, error) {
	for _, one := range s.reviews.Passes(id) {
		if one.Number != pass {
			continue
		}
		for _, finding := range one.Findings {
			if finding.Number != number {
				continue
			}
			if !finding.Anchored() {
				return prreview.Finding{}, fmt.Errorf(
					"open finding %d of pass %d of review %s: %w", number, pass, id, errNotAnchored,
				)
			}
			return finding, nil
		}
	}
	return prreview.Finding{}, fmt.Errorf(
		"open finding %d of pass %d of review %s: %w", number, pass, id, prreview.ErrNotFound,
	)
}

// worktreeOf is the folder of a review on disk.
func (s *ReviewService) worktreeOf(id string) (string, error) {
	wt, ok := s.worktrees.Get(id)
	if !ok {
		return "", fmt.Errorf("worktree of review %s: %w", id, reviewflow.ErrNoWorktree)
	}
	return wt.Path, nil
}

func (s *ReviewService) fail(method string, err error) error { return failure(s.log, method, err) }
