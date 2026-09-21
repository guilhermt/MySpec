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
// first, as in a review; the state of the discussion decides the rest.
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

	switch state.Status {
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
	default:
		// Publishing and published wait for nobody.
		return nil
	}
	return []Found{found}
}
