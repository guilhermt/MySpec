package attention

import (
	"github.com/guilhermt/myspec/internal/discussionflow"
)

// DiscussionInput is what the situations of one discussion are derived from.
type DiscussionInput struct {
	State discussionflow.State
	// Title is the title of the notification: the title of the discussion.
	Title string
}

// DeriveDiscussion lists the situations of one discussion: one at most,
// because a discussion has a single place. What its conversation holds comes
// first, as in a review; the state the discussion waits in decides the rest.
func DeriveDiscussion(in DiscussionInput) []Found {
	state := in.State
	place := Place{Kind: PlaceDiscussion}
	found := Found{TaskID: state.Discussion.ID, Place: place, Title: in.Title}

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

	switch state.Waiting {
	case discussionflow.StatusAwaitingDrafts:
		found.Kind, found.Body = KindReply, unreadableDraftsBody()
	case discussionflow.StatusDiscussing:
		// The agent asks in the conversation and rests, as in a planning stage.
		if !state.SessionOpen || !state.Session.Idle || state.Discussion.DraftsRead {
			return nil
		}
		found.Kind, found.Body = KindReply, sessionBody(KindReply, placeName(place))
	case discussionflow.StatusDeciding:
		found.Kind, found.Body = KindDrafts, draftsBody()
	case discussionflow.StatusPublishFailed:
		found.Kind, found.Body = KindPublishFailed, draftsPublishFailedBody()
	case discussionflow.StatusEpicCantPublish:
		approved, cards, _ := state.ShortEpic()
		found.Kind, found.Body = KindEpicCantPublish, epicCantPublishBody(approved, cards)
	case discussionflow.StatusEpicDiscarded:
		approvedCards, _ := state.DiscardedEpic()
		found.Kind, found.Body = KindEpicDiscarded, epicDiscardedBody(approvedCards)
	case discussionflow.StatusReadyToArchive:
		found.Kind, found.Body = KindReadyToArchive, readyToArchiveBody()
	default:
		// A run under way, or about to start, with nothing else to ask.
		return nil
	}
	return []Found{found}
}
