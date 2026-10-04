package attention

import (
	"github.com/guilhermt/myspec/internal/prreport"
	"github.com/guilhermt/myspec/internal/reviewflow"
)

// ReviewInput is what the situations of one review are derived from.
type ReviewInput struct {
	State reviewflow.State
	// Title is the title of the notification: owner/name#number · the title of
	// the pull request.
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
			found.Kind, found.Body = kind, sessionBody(kind, placeName(place, false))
			return []Found{found}
		}
	}

	switch state.Status {
	case reviewflow.StatusAwaitingReply:
		found.Kind, found.Body = KindReply, reviewReplyBody()
	case reviewflow.StatusAwaitingDecision:
		found.Kind, found.Form = KindReviewReport, FormDecide
		found.Body = reviewReportBody(FormDecide, undecidedFindings(state))
	case reviewflow.StatusReadyToPublish:
		found.Kind, found.Form = KindReviewReport, FormPublish
		found.Body = reviewReportBody(FormPublish, 0)
	case reviewflow.StatusReadyToApply:
		found.Kind, found.Form = KindReviewReport, FormApply
		found.Body = reviewReportBody(FormApply, 0)
	case reviewflow.StatusPublishFailed:
		found.Kind, found.Body = KindPublishFailed, publishFailedBody(state.Review.PublishError)
	case reviewflow.StatusPassBlocked:
		found.Kind, found.Body = KindPassBlocked, passBlockedBody(state.PassBlocked)
	case reviewflow.StatusNewCommits:
		found.Kind, found.Body = KindNewCommits, newCommitsBody(state.NewCommits)
	case reviewflow.StatusInReview:
		form, percent := FormReview, 0
		if state.Watch != nil && state.Watch.Staged > 0 {
			form, percent = FormStaged, state.Watch.Percent()
		}
		found.Kind, found.Form, found.Percent = KindChangesReview, form, percent
		found.Body = reviewChangesBody(form, state.CommitFailed)
	case reviewflow.StatusReadyToApprove:
		found.Kind, found.Form = KindChangesReview, FormApprove
		found.Body = reviewChangesBody(FormApprove, state.CommitFailed)
	case reviewflow.StatusReadyToMerge:
		found.Kind, found.Form = KindMerge, FormMerge
		found.Body = reviewMergeBody()
	case reviewflow.StatusTrouble:
		found.Kind, found.Form = KindPRTrouble, troubleForm(state.Review.Trouble)
		found.Body = troubleBody(state.Review.Trouble, state.Review.BaseBranch)
	default:
		// Reviewing, waiting for checks, applying, committing and published
		// wait for nobody.
		return nil
	}
	return []Found{found}
}

// undecidedFindings is how many findings of the last pass the user has yet to
// decide; 0 before a pass.
func undecidedFindings(state reviewflow.State) int {
	if len(state.Passes) == 0 {
		return 0
	}
	count := 0
	for _, finding := range state.Passes[len(state.Passes)-1].Findings {
		if finding.Decision == prreport.DecisionNone {
			count++
		}
	}
	return count
}
