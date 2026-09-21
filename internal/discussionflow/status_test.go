package discussionflow_test

import (
	"testing"

	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/discussionflow"
)

func TestTheStatusOfADiscussionIsWhatItsDraftsAndItsConversationSay(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name  string
		setup func(*testing.T, *fixture) string
		want  discussionflow.Status
	}{
		{
			name: "a conversation in the middle of a turn is discussing",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				return f.start(cardKey)
			},
			want: discussionflow.StatusDiscussing,
		},
		{
			name: "a run that writes on GitHub is publishing",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				id := f.start(cardKey)
				f.record(id, looseArtifact)
				release := f.gh.holdCreate("Invoice report")
				t.Cleanup(release)
				f.approve(id, "invoice-report")
				f.waitFor(id, func(s discussionflow.State) bool { return s.Publishing })
				return id
			},
			want: discussionflow.StatusPublishing,
		},
		{
			name: "a publication that failed waits for the user",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				id := f.start(cardKey)
				f.record(id, looseArtifact)
				f.gh.failCreate("Invoice report", errGitHub)
				f.approve(id, "invoice-report")
				f.waitFailed(id, "invoice-report")
				return id
			},
			want: discussionflow.StatusPublishFailed,
		},
		{
			name: "an artifact the app can't read awaits the drafts",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				id := f.start(cardKey)
				f.write(id, discussion.DraftsFile, "## Draft: broken\n")
				f.sessions.idle(id)
				f.flow.Check(id)
				f.waitFor(id, func(s discussionflow.State) bool { return s.UnreadableDrafts != "" })
				return id
			},
			want: discussionflow.StatusAwaitingDrafts,
		},
		{
			name: "a conversation at rest before any drafts is discussing",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				id := f.start(cardKey)
				f.sessions.idle(id)
				return id
			},
			want: discussionflow.StatusDiscussing,
		},
		{
			name: "drafts nobody decided on are to decide",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				id := f.start(cardKey)
				f.record(id, draftsArtifact)
				return id
			},
			want: discussionflow.StatusDeciding,
		},
		{
			name: "an approved card waiting for another one is still to decide",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				id := f.start(cardKey)
				f.record(id, draftsArtifact)
				f.decide(id, "invoices-epic", discussion.DecisionDiscarded)
				f.approve(id, "export-invoices")
				return id
			},
			want: discussionflow.StatusDeciding,
		},
		{
			name: "a discussion whose every draft is settled and one published is published",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				id := f.start(cardKey)
				f.record(id, looseArtifact)
				f.approve(id, "invoice-report")
				f.waitPublished(id, "invoice-report")
				return id
			},
			want: discussionflow.StatusPublished,
		},
		{
			name: "a discussion whose every draft was discarded is back in the conversation",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				id := f.start(cardKey)
				f.record(id, looseArtifact)
				f.decide(id, "invoice-report", discussion.DecisionDiscarded)
				return id
			},
			want: discussionflow.StatusDiscussing,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			id := c.setup(t, f)
			if got := f.state(id).Status; got != c.want {
				t.Errorf("the discussion is %s, want %s", got, c.want)
			}
		})
	}
}
