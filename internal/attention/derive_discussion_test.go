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
		},
		Title: discussionTitle,
	}
	if len(sum) > 0 {
		in.State.Session, in.State.SessionOpen = sum[0], true
	}
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
		{"every draft was published", discussionInput(discussionflow.StatusPublished, waiting), nil},
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
