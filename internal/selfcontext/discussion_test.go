package selfcontext_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/discussionflow"
	"github.com/guilhermt/myspec/internal/divergence"
	"github.com/guilhermt/myspec/internal/selfcontext"
	"github.com/guilhermt/myspec/internal/session"
)

func TestTheStateOfADiscussionInRoundTwoTellsTheDraftsAndTheUnreadableOnes(t *testing.T) {
	t.Parallel()

	drafts := []discussionflow.DraftState{
		{Draft: discussion.Draft{
			ID: "d1", Round: 1, Kind: discussion.KindNew, Owner: "acme", Name: "app", Title: "Old card", Decision: discussion.DecisionApproved,
			Published: discussion.Publication{Outcome: discussion.OutcomeCreated, Number: 3, URL: "https://github.com/acme/app/issues/3"},
		}},
		{Draft: discussion.Draft{
			ID: "d2", Round: 2, Kind: discussion.KindNew, Owner: "acme", Name: "app", Title: "New card", Decision: discussion.DecisionApproved,
		}},
		{Draft: discussion.Draft{
			ID: "d3", Round: 2, Kind: discussion.KindUpdate, Owner: "acme", Name: "api", Title: "Rewrite the card", Decision: discussion.DecisionDiscarded,
			Card: &discussion.InputCard{Owner: "acme", Name: "api", Number: 8},
		}},
		{Draft: discussion.Draft{
			ID: "d4", Round: 2, Kind: discussion.KindEpic, Owner: "acme", Name: "app", Title: "The epic",
			PublishError: "no permission",
		}},
	}
	got := selfcontext.Discussion(selfcontext.DiscussionInput{
		State: discussionflow.State{
			Discussion: discussion.Discussion{ID: "x1", Title: "Cache plan", BoardTitle: "Roadmap", ArtifactsDir: "/disc/x1"},
			Status:     discussionflow.StatusDiverged,
			Drafts:     drafts, Round: 2, HasDocument: true,
			UnreadableDrafts: "drafts.md has no cards",
			ArchiveHint:      "a draft is still to decide",
			Divergence: &divergence.Divergence{
				ItemID: "x1", Stage: "discussion", Kind: divergence.KindDraftsUnreadable, StartedAt: openedAt,
				Facts: divergence.Facts{Reason: "drafts.md has no cards."},
			},
		},
		Stage:    "discussion",
		Sessions: sessionsOf(sessionOf("x1", "discussion", session.StatusNeedsAnswer)),
		Now:      readAt,
	})

	want := stateOf(
		headerOf("discussion"),
		"Discussion: Cache plan · board Roadmap",
		"This conversation: Discussion agent (discussion)",
		"Status: Not as expected · round 2",
		"Documents: discussion.md /disc/x1/discussion.md (written); drafts.md /disc/x1/drafts.md",
		"Drafts unreadable: drafts.md has no cards",
		"Drafts of round 2:",
		"- d2 · new card in acme/app · New card · Approved",
		"- d3 · update of acme/api#8 · Rewrite the card · Discarded",
		"- d4 · epic in acme/app · The epic · To decide · publish failed: no permission",
		"Published in earlier rounds: 1 drafts",
		"Ready to archive: no · a draft is still to decide",
		"Conversations: Discussion agent · waiting for an answer · this conversation",
		"Divergence: drafts_unreadable, shown as Not as expected, open since "+local(openedAt)+", in the conversation Discussion agent (discussion)",
		"- Expected: drafts.md in the format of the discussion",
		"- Found: drafts.md has no cards",
		"- Actions in the interface:",
		"  - Ask the agent again: asks the Discussion agent again to rewrite drafts.md in the format of the discussion",
		"  - Check again: reads git, the files and GitHub again, and the flow goes on if things are now as expected",
	)
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("state mismatch (-want +got):\n%s", diff)
	}
}

func TestTheStateOfADiscussionWithoutDraftsIsDiscussing(t *testing.T) {
	t.Parallel()

	got := selfcontext.Discussion(selfcontext.DiscussionInput{
		State: discussionflow.State{
			Discussion: discussion.Discussion{ID: "x2", Title: "Idea", BoardTitle: "Roadmap", ArtifactsDir: "/disc/x2"},
			CanArchive: true,
		},
		Stage: "discussion",
		Now:   readAt,
	})

	want := stateOf(
		headerOf("discussion"),
		"Discussion: Idea · board Roadmap",
		"This conversation: Discussion agent (discussion)",
		"Status: Discussing",
		"Documents: discussion.md /disc/x2/discussion.md (not written yet); drafts.md /disc/x2/drafts.md",
		"Drafts: none yet",
		"Ready to archive: yes",
		"Conversations: none open",
		"Divergence: none",
	)
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("state mismatch (-want +got):\n%s", diff)
	}
}
