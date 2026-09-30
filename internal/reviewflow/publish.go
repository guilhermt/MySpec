package reviewflow

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/pulls"
	"github.com/guilhermt/myspec/internal/repository"
)

// rightSide is the side of the diff an inline comment of a review sits on:
// the app only ever comments on the new version of a file.
const rightSide = "RIGHT"

// Publish sends the review the user decided on to GitHub, as one review of
// the account gh is logged in as: every approved finding on a line of the diff
// becomes an inline comment, the rest goes in the body after the summary. A
// publication that fails leaves every decision and every edit where they are.
// The summary goes in the body only when withSummary says so.
func (s *Service) Publish(ctx context.Context, id string, verdict prreview.Verdict, withSummary bool) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	stored, repo, _, err := s.active(id)
	if err != nil {
		return fmt.Errorf("publish review %s: %w", id, err)
	}
	ref := stored.Reference(repo.FullName())
	state, _ := s.State(id)
	pass, err := s.publishable(state, verdict)
	if err != nil {
		return fmt.Errorf("publish review %s: %w", ref, err)
	}

	input, placements, summaryGoes, err := s.reviewInput(ctx, stored, repo, pass, verdict, withSummary)
	if errors.Is(err, ErrEmptyReview) {
		// Nothing failed: there is nothing to publish yet.
		return fmt.Errorf("publish review %s: %w", ref, err)
	}
	if err != nil {
		return s.publishFailed(ctx, stored, ref, err)
	}
	url, err := s.gh.CreateReview(ctx, repo.Owner, repo.Name, stored.Number, input)
	if err != nil {
		return s.publishFailed(ctx, stored, ref, err)
	}

	if err = s.reviews.MarkPublished(ctx, id, pass.Number, verdict,
		summaryGoes, url, input.CommitID, placements); err != nil {
		return err
	}
	s.pulls.Refresh()
	s.log.Info("review published", "review", id, "repository", repo.FullName(),
		"number", stored.Number, "pass", pass.Number, "verdict", string(verdict))
	s.notify(id)
	return nil
}

// publishable is the pass a publication would send: the last one recorded,
// with every finding decided and nothing published yet, of a review at rest.
// While the agent works, it may be rewriting the very report the user would
// publish.
func (s *Service) publishable(state State, verdict prreview.Verdict) (prreview.Pass, error) {
	if _, err := prreview.ParseVerdict(string(verdict)); err != nil {
		return prreview.Pass{}, err
	}
	if state.Status != StatusReadyToPublish && state.Status != StatusPublishFailed {
		return prreview.Pass{}, ErrNotReady
	}
	stored := state.Review
	if stored.Own && verdict != prreview.VerdictComment {
		// GitHub takes no verdict but a comment on a pull request of one's own.
		return prreview.Pass{}, ErrOwnVerdict
	}
	pass, ok := s.passOf(stored.ID, stored.ReportedPass)
	if !ok || !pass.Recorded || pass.Published() || !pass.Decided() {
		return prreview.Pass{}, ErrNotReady
	}
	return pass, nil
}

// reviewInput is the review as GitHub takes it, with where each approved
// finding went: a finding whose line left the diff between the pass and now
// goes in the body instead of failing the publication.
func (s *Service) reviewInput(
	ctx context.Context, stored prreview.Review, repo repository.Repository,
	pass prreview.Pass, verdict prreview.Verdict, withSummary bool,
) (gh.ReviewInput, map[int]prreview.Placement, bool, error) {
	detail, err := s.detailOf(ctx, repo, stored.Number)
	if err != nil {
		return gh.ReviewInput{}, nil, false, err
	}
	if detail.State != string(prreview.PROpen) {
		return gh.ReviewInput{}, nil, false, ErrNotOpen
	}
	diff, err := s.gh.PRDiff(ctx, repo.Owner, repo.Name, stored.Number)
	if err != nil {
		return gh.ReviewInput{}, nil, false, err
	}

	lines := prreview.RightLines(diff)
	placements := map[int]prreview.Placement{}
	comments := []gh.ReviewComment{}
	var general, demoted []prreview.Finding
	for _, finding := range pass.Approved() {
		switch {
		case !finding.Anchored():
			placements[finding.Number] = prreview.PlacementBody
			general = append(general, finding)
		case inDiff(lines, finding):
			placements[finding.Number] = prreview.PlacementInline
			comments = append(comments, gh.ReviewComment{
				Path: finding.Path, Line: finding.Line, Side: rightSide, Body: finding.Text,
			})
		default:
			placements[finding.Number] = prreview.PlacementBody
			demoted = append(demoted, finding)
		}
	}

	summary := ""
	if withSummary {
		summary = pass.Summary
	}
	body := prreview.PublishedBody(summary, general, demoted)
	if body == "" && len(comments) == 0 && verdict != prreview.VerdictApprove {
		return gh.ReviewInput{}, nil, false, ErrEmptyReview
	}
	if body == "" && verdict != prreview.VerdictApprove {
		// GitHub takes no request for changes or comment without a body.
		body = minimalBody(len(comments))
	}
	input := gh.ReviewInput{
		CommitID: detail.HeadCommit,
		Event:    reviewEvent(verdict),
		Body:     body,
		Comments: comments,
	}
	return input, placements, strings.TrimSpace(summary) != "", nil
}

// minimalBody is the body of a review that has inline comments and nothing
// else to say, which GitHub refuses to take empty.
func minimalBody(comments int) string {
	if comments == 1 {
		return "Review with 1 inline comment."
	}
	return fmt.Sprintf("Review with %d inline comments.", comments)
}

// publishFailed keeps why a publication failed, so that the review says it and
// waits for the user to try again.
func (s *Service) publishFailed(
	ctx context.Context, stored prreview.Review, ref string, cause error,
) error {
	if _, err := s.reviews.Update(ctx, stored.ID, func(r *prreview.Review) {
		r.PublishError = publishError(cause)
	}); err != nil {
		s.log.Error("record publish failure failed", "review", stored.ID, "error", err)
	}
	s.log.Warn("publish review failed", "review", stored.ID, "error", cause)
	s.notify(stored.ID)
	return fmt.Errorf("publish review %s: %w", ref, cause)
}

// publishError is why a publication failed, as the user reads it: a pull
// request that is gone or closed says so, and a failure of gh says what to do
// about it. A failure with no known reason happened while publishing, not
// while reading.
func publishError(err error) string {
	switch {
	case errors.Is(err, ErrPullRequestGone):
		return GoneMessage
	case errors.Is(err, ErrNotOpen):
		return NotOpenMessage
	}
	var failure *pulls.Failure
	if errors.As(err, &failure) {
		return failure.Message()
	}
	failure = pulls.FailureOf(err)
	if failure.Reason == pulls.ReasonFailed {
		return "Couldn't publish to GitHub: " + failure.Detail
	}
	return failure.Message()
}

// inDiff reports whether the line a finding points at is still part of the
// new side of the diff of the pull request.
func inDiff(lines map[string]map[int]struct{}, finding prreview.Finding) bool {
	_, ok := lines[finding.Path][finding.Line]
	return ok
}

// reviewEvent is the verdict of a review as GitHub names it.
func reviewEvent(verdict prreview.Verdict) gh.ReviewEvent {
	switch verdict {
	case prreview.VerdictApprove:
		return gh.EventApprove
	case prreview.VerdictRequestChanges:
		return gh.EventRequestChanges
	default:
		return gh.EventComment
	}
}
