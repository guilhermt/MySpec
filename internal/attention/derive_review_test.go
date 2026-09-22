package attention_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/attention"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/reviewflow"
	"github.com/guilhermt/myspec/internal/session"
)

// The review every input of DeriveReview is about.
const (
	reviewID    = "review-1"
	reviewTitle = "dev/web#42"
)

// reviewInput is a review in a status, with the conversation given when there
// is one.
func reviewInput(status reviewflow.Status, sum ...session.Summary) attention.ReviewInput {
	in := attention.ReviewInput{
		State: reviewflow.State{
			Review: prreview.Review{ID: reviewID, Mode: prreview.ModePublish},
			Status: status,
		},
		Title: reviewTitle,
	}
	if len(sum) > 0 {
		in.State.Session, in.State.SessionOpen = sum[0], true
	}
	return in
}

// reviewSituation is the one situation of the review, in the form given.
func reviewSituation(kind attention.Kind, form attention.Form, body string) []attention.Found {
	return []attention.Found{{
		TaskID: reviewID, Place: attention.Place{Kind: attention.PlaceReview},
		Kind: kind, Form: form, Title: reviewTitle, Body: body,
	}}
}

// staged is the situation of a review whose changes are partly staged.
func staged(situations []attention.Found, percent int) []attention.Found {
	situations[0].Percent = percent
	return situations
}

func TestDeriveTheSituationOfAReview(t *testing.T) {
	t.Parallel()

	working := summary(session.StatusWorking, false)
	waiting := summary(session.StatusWaiting, true)

	partly := reviewInput(reviewflow.StatusInReview)
	partly.State.Watch = &review.Snapshot{Staged: 1, Total: 4}
	unstaged := reviewInput(reviewflow.StatusInReview)
	unstaged.State.Watch = &review.Snapshot{Total: 4}
	noCommit := reviewInput(reviewflow.StatusReadyToApprove)
	noCommit.State.CommitFailed = true

	tests := []struct {
		name string
		in   attention.ReviewInput
		want []attention.Found
	}{
		{"the agent is reviewing", reviewInput(reviewflow.StatusReviewing, working), nil},
		{"the conversation is paused", reviewInput(reviewflow.StatusAwaitingDecision, summary(session.StatusPaused, false)), nil},
		{"the review was published", reviewInput(reviewflow.StatusPublished, waiting), nil},
		{"the agent is applying", reviewInput(reviewflow.StatusApplying, working), nil},
		{"the agent is committing", reviewInput(reviewflow.StatusCommitting, working), nil},
		{"the pass waits for the checks", reviewInput(reviewflow.StatusWaitingChecks, waiting), nil},
		{
			"the agent asks for a permission",
			reviewInput(reviewflow.StatusReviewing, summary(session.StatusNeedsPermission, false)),
			reviewSituation(attention.KindPermission, attention.FormNone, "Permission requested in the review."),
		},
		{
			"the agent has a question",
			reviewInput(reviewflow.StatusReviewing, summary(session.StatusNeedsAnswer, false)),
			reviewSituation(attention.KindQuestion, attention.FormNone, "The agent has a question in the review."),
		},
		{
			"the session stopped with an error",
			reviewInput(reviewflow.StatusReviewing, summary(session.StatusError, false)),
			reviewSituation(attention.KindSessionError, attention.FormNone, "The session stopped with an error in the review."),
		},
		{
			"the pass ended without a report",
			reviewInput(reviewflow.StatusAwaitingReply, waiting),
			reviewSituation(attention.KindReply, attention.FormNone, "The reviewer stopped without a report the app can read."),
		},
		{
			"the findings await a decision",
			reviewInput(reviewflow.StatusAwaitingDecision, waiting),
			reviewSituation(attention.KindReviewReport, attention.FormDecide, "The review has findings for you to decide."),
		},
		{
			"the review is ready to publish",
			reviewInput(reviewflow.StatusReadyToPublish, waiting),
			reviewSituation(attention.KindReviewReport, attention.FormPublish, "The review is ready to publish."),
		},
		{
			"the approved findings are ready to apply",
			reviewInput(reviewflow.StatusReadyToApply, waiting),
			reviewSituation(attention.KindReviewReport, attention.FormApply, "The approved findings are ready to apply."),
		},
		{
			"the publication failed",
			reviewInput(reviewflow.StatusPublishFailed, waiting),
			reviewSituation(attention.KindPublishFailed, attention.FormNone, "The review couldn't be published."),
		},
		{
			"the pass could not start",
			reviewInput(reviewflow.StatusPassBlocked, waiting),
			reviewSituation(attention.KindPassBlocked, attention.FormNone, "The next pass of the review couldn't start."),
		},
		{
			"the pull request has new commits",
			reviewInput(reviewflow.StatusNewCommits, waiting),
			reviewSituation(attention.KindNewCommits, attention.FormNone, "The pull request has new commits since your review."),
		},
		{
			"nothing of the changes is staged",
			unstaged,
			reviewSituation(attention.KindChangesReview, attention.FormReview,
				"The changes from the review of the pull request are ready for review."),
		},
		{
			"the changes await the rest of the review",
			partly,
			staged(reviewSituation(attention.KindChangesReview, attention.FormStaged,
				"The changes from the review of the pull request are ready for review."), 25),
		},
		{
			"the changes are ready to approve after a commit that did not happen",
			noCommit,
			reviewSituation(attention.KindChangesReview, attention.FormApprove,
				"The last approval of the pull request didn't produce a commit."),
		},
		{
			"the pull request is ready to merge",
			reviewInput(reviewflow.StatusReadyToMerge, waiting),
			reviewSituation(attention.KindMerge, attention.FormMerge, "The pull request is ready to merge."),
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if diff := cmp.Diff(test.want, attention.DeriveReview(test.in)); diff != "" {
				t.Errorf("DeriveReview() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
