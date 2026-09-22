package attention

import (
	"github.com/guilhermt/myspec/internal/reviewflow"
)

// ReviewInput is what the situations of one review are derived from.
type ReviewInput struct {
	State reviewflow.State
	// Title is the title of the notification: owner/name#number.
	Title string
}

// DeriveReview lists the situations of one review of a pull request: one at
// most, because a review has a single place. What its conversation holds comes
// first, as in a task; the state of the review decides the rest.
func DeriveReview(in ReviewInput) []Found {
	state := in.State
	place := Place{Kind: PlaceReview}
	found := Found{TaskID: state.Review.ID, Place: place, Title: in.Title}

	if state.SessionOpen {
		if kind, decided := sessionKind(state.Session); decided {
			if kind == "" {
				// The user paused the conversation: it waits for nobody.
				return nil
			}
			found.Kind, found.Body = kind, sessionBody(kind, placeName(place))
			return []Found{found}
		}
	}

	switch state.Status {
	case reviewflow.StatusAwaitingReply:
		found.Kind, found.Body = KindReply, reviewReplyBody()
	case reviewflow.StatusAwaitingDecision:
		found.Kind, found.Form = KindReviewReport, FormDecide
		found.Body = reviewReportBody(FormDecide)
	case reviewflow.StatusReadyToPublish:
		found.Kind, found.Form = KindReviewReport, FormPublish
		found.Body = reviewReportBody(FormPublish)
	case reviewflow.StatusReadyToApply:
		found.Kind, found.Form = KindReviewReport, FormApply
		found.Body = reviewReportBody(FormApply)
	case reviewflow.StatusPublishFailed:
		found.Kind, found.Body = KindPublishFailed, publishFailedBody()
	case reviewflow.StatusPassBlocked:
		found.Kind, found.Body = KindPassBlocked, passBlockedBody()
	case reviewflow.StatusNewCommits:
		found.Kind, found.Body = KindNewCommits, newCommitsBody()
	case reviewflow.StatusInReview:
		form, percent := FormReview, 0
		if state.Watch != nil && state.Watch.Staged > 0 {
			form, percent = FormStaged, state.Watch.Percent()
		}
		found.Kind, found.Form, found.Percent = KindChangesReview, form, percent
		found.Body = changesReviewBody(form, state.CommitFailed)
	case reviewflow.StatusReadyToApprove:
		found.Kind, found.Form = KindChangesReview, FormApprove
		found.Body = changesReviewBody(FormApprove, state.CommitFailed)
	case reviewflow.StatusReadyToMerge:
		found.Kind, found.Form = KindMerge, FormMerge
		found.Body = mergeBody(FormMerge)
	default:
		// Reviewing, waiting for checks, applying, committing and published
		// wait for nobody.
		return nil
	}
	return []Found{found}
}
