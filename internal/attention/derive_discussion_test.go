package attention_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/attention"
	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/discussionflow"
	"github.com/guilhermt/myspec/internal/session"
)

// The discussion every input of DeriveDiscussion is about.
const (
	discussionID    = "discussion-1"
	discussionTitle = "Invoices of the quarter"
)

// discussionInput is a discussion in a status, with the conversation given
// when there is one.
func discussionInput(status discussionflow.Status, sum ...session.Summary) attention.DiscussionInput {
	in := attention.DiscussionInput{
		State: discussionflow.State{
			Discussion: discussion.Discussion{ID: discussionID},
			Status:     status,
			Waiting:    status,
		},
		Title: discussionTitle,
	}
	if len(sum) > 0 {
		in.State.Session, in.State.SessionOpen = sum[0], true
	}
	return in
}

// withDrafts gives the discussion the drafts of its state.
func withDrafts(in attention.DiscussionInput, drafts ...discussionflow.DraftState) attention.DiscussionInput {
	in.State.Drafts = drafts
	return in
}

// short is an epic that can't publish: approved of cards.
func short(approved, cards int) discussionflow.DraftState {
	return discussionflow.DraftState{
		Draft: discussion.Draft{ID: "epic", Kind: discussion.KindEpic},
		Hold:  discussionflow.Hold{Reason: discussionflow.HoldEpicShort, Approved: approved, Cards: cards},
	}
}

// discardedEpic is a discarded epic with that many approved cards.
func discardedEpic(approvedCards int) []discussionflow.DraftState {
	drafts := make([]discussionflow.DraftState, 0, 1+approvedCards)
	drafts = append(drafts, discussionflow.DraftState{
		Draft: discussion.Draft{ID: "epic", Kind: discussion.KindEpic, Decision: discussion.DecisionDiscarded},
	})
	for range approvedCards {
		drafts = append(drafts, discussionflow.DraftState{
			Draft: discussion.Draft{
				Kind: discussion.KindNew, Epic: "epic", Decision: discussion.DecisionApproved,
			},
		})
	}
	return drafts
}

// publishingWhileWaiting is a discussion that shows a run and still waits for
// the user in another state.
func publishingWhileWaiting(waiting discussionflow.Status, sum session.Summary) attention.DiscussionInput {
	in := draftsRead(discussionInput(discussionflow.StatusPublishing, sum))
	in.State.Waiting = waiting
	return in
}

// discussionSituation is the one situation of the discussion.
func discussionSituation(kind attention.Kind, body string) []attention.Found {
	return []attention.Found{{
		TaskID: discussionID, Place: attention.Place{Kind: attention.PlaceDiscussion},
		Kind: kind, Title: discussionTitle, Body: body,
	}}
}

// draftsRead is the discussion with the drafts artifact already recorded.
func draftsRead(in attention.DiscussionInput) attention.DiscussionInput {
	in.State.Discussion.DraftsRead = true
	return in
}

func TestDeriveTheSituationOfADiscussion(t *testing.T) {
	t.Parallel()

	working := summary(session.StatusWorking, false)
	waiting := summary(session.StatusWaiting, true)

	tests := []struct {
		name string
		in   attention.DiscussionInput
		want []attention.Found
	}{
		{"the agent is writing", discussionInput(discussionflow.StatusDiscussing, working), nil},
		{"the conversation is paused", discussionInput(discussionflow.StatusDeciding, summary(session.StatusPaused, false)), nil},
		{"the publication is under way", discussionInput(discussionflow.StatusPublishing, waiting), nil},
		{"a run is about to start with nothing else to ask", publishingWhileWaiting(discussionflow.StatusNone, waiting), nil},
		{
			"nothing waits for the user",
			draftsRead(discussionInput(discussionflow.StatusNone, waiting)),
			nil,
		},
		{
			"the conversation is paused over an epic that can't publish",
			discussionInput(discussionflow.StatusEpicCantPublish, summary(session.StatusPaused, false)),
			nil,
		},
		{"the conversation is gone", discussionInput(discussionflow.StatusDiscussing), nil},
		{
			"the drafts were read and every one of them discarded",
			draftsRead(discussionInput(discussionflow.StatusDiscussing, waiting)),
			nil,
		},
		{
			"the agent asks for a permission",
			discussionInput(discussionflow.StatusDiscussing, summary(session.StatusNeedsPermission, false)),
			discussionSituation(attention.KindPermission, "Permission requested in the discussion."),
		},
		{
			"the agent has a question",
			discussionInput(discussionflow.StatusDiscussing, summary(session.StatusNeedsAnswer, false)),
			discussionSituation(attention.KindQuestion, "The agent has a question in the discussion."),
		},
		{
			"the session stopped with an error",
			discussionInput(discussionflow.StatusDiscussing, summary(session.StatusError, false)),
			discussionSituation(attention.KindSessionError, "The session stopped with an error in the discussion."),
		},
		{
			"the agent asked in the conversation and rested",
			discussionInput(discussionflow.StatusDiscussing, waiting),
			discussionSituation(attention.KindReply, "The agent is waiting for your reply in the discussion."),
		},
		{
			"the drafts the agent wrote can't be read",
			discussionInput(discussionflow.StatusAwaitingDrafts, waiting),
			discussionSituation(attention.KindReply, "The agent wrote drafts the app can't read in the discussion."),
		},
		{
			"there are drafts to decide",
			draftsRead(discussionInput(discussionflow.StatusDeciding, waiting)),
			discussionSituation(attention.KindDrafts, "There are drafts to decide in the discussion."),
		},
		{
			"a run under way leaves the drafts to decide standing",
			publishingWhileWaiting(discussionflow.StatusDeciding, waiting),
			discussionSituation(attention.KindDrafts, "There are drafts to decide in the discussion."),
		},
		{
			"an epic with one approved card of three can't publish",
			withDrafts(draftsRead(discussionInput(discussionflow.StatusEpicCantPublish, waiting)), short(1, 3)),
			discussionSituation(attention.KindEpicCantPublish, "The epic can't publish: approve one more of its cards, or discard it."),
		},
		{
			"an epic with no approved card of three can't publish",
			withDrafts(draftsRead(discussionInput(discussionflow.StatusEpicCantPublish, waiting)), short(0, 3)),
			discussionSituation(attention.KindEpicCantPublish, "The epic can't publish: approve two more of its cards, or discard it."),
		},
		{
			"an epic with one card can't publish",
			withDrafts(draftsRead(discussionInput(discussionflow.StatusEpicCantPublish, waiting)), short(1, 1)),
			discussionSituation(attention.KindEpicCantPublish, "The epic can't publish: it has one card. Move another into it, or discard it."),
		},
		{
			"an epic without cards can't publish",
			withDrafts(draftsRead(discussionInput(discussionflow.StatusEpicCantPublish, waiting)), short(0, 0)),
			discussionSituation(attention.KindEpicCantPublish, "The epic can't publish: it has no cards. Move two into it, or discard it."),
		},
		{
			"a discarded epic has an approved card",
			withDrafts(draftsRead(discussionInput(discussionflow.StatusEpicDiscarded, waiting)), discardedEpic(1)...),
			discussionSituation(attention.KindEpicDiscarded, "The epic is discarded, and its approved card won't publish."),
		},
		{
			"a discarded epic has two approved cards",
			withDrafts(draftsRead(discussionInput(discussionflow.StatusEpicDiscarded, waiting)), discardedEpic(2)...),
			discussionSituation(attention.KindEpicDiscarded, "The epic is discarded, and 2 of its approved cards won't publish."),
		},
		{
			"every draft was published or discarded",
			draftsRead(discussionInput(discussionflow.StatusReadyToArchive, waiting)),
			discussionSituation(attention.KindReadyToArchive, "Every draft is published or discarded. The discussion is ready to archive."),
		},
		{
			"the publication failed",
			draftsRead(discussionInput(discussionflow.StatusPublishFailed, waiting)),
			discussionSituation(attention.KindPublishFailed, "The drafts couldn't be published."),
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if diff := cmp.Diff(test.want, attention.DeriveDiscussion(test.in)); diff != "" {
				t.Errorf("DeriveDiscussion() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
