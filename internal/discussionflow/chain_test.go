package discussionflow_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/discussionflow"
)

// A modifier changes a draft the helpers below made.
type modifier func(*discussion.Draft)

func epic(id string, mods ...modifier) discussion.Draft {
	return build(discussion.Draft{ID: id, Kind: discussion.KindEpic}, mods)
}

// card is a card of the epic given, or a loose one for "".
func card(id, epicID string, mods ...modifier) discussion.Draft {
	return build(discussion.Draft{ID: id, Kind: discussion.KindNew, Epic: epicID}, mods)
}

func build(d discussion.Draft, mods []modifier) discussion.Draft {
	d.Owner, d.Name, d.Title = "acme", "web", "The "+d.ID
	for _, mod := range mods {
		mod(&d)
	}
	return d
}

func approved(d *discussion.Draft)  { d.Decision = discussion.DecisionApproved }
func discarded(d *discussion.Draft) { d.Decision = discussion.DecisionDiscarded }
func failed(d *discussion.Draft)    { d.PublishError = "Couldn't write to GitHub: boom" }

func started(d *discussion.Draft) {
	d.Published.Outcome, d.Published.NodeID = discussion.OutcomeCreated, "node-"+d.ID
}

func done(d *discussion.Draft) {
	started(d)
	d.Published.At = base
}

func dependsOn(ids ...string) modifier {
	return func(d *discussion.Draft) {
		for _, id := range ids {
			d.Dependencies = append(d.Dependencies, discussion.Dependency{Ref: discussion.Ref{Draft: id}})
		}
	}
}

// list numbers the drafts of a row: the position of a draft is its index.
func list(drafts ...discussion.Draft) []discussion.Draft {
	for i := range drafts {
		drafts[i].Position = i
	}
	return drafts
}

func ids(values ...string) []string { return values }

const (
	waitingHint = "Approved drafts wait to be published."
	failedHint  = "A publication failed: Retry it, or discard the draft."
	runningHint = "A publication is running."
)

// shortHint is what a discussion with an epic that can't publish says it takes.
func shortHint(way string) string {
	return "The epic can't publish: " + way + ", or discard the epic."
}

// at adds what the discussion shows to what the chain says.
func at(status, waiting discussionflow.Status, hint string, v discussionflow.ChainView) discussionflow.ChainView {
	v.Status, v.Waiting, v.ArchiveHint = status, waiting, hint
	return v
}

func TestTheChainSaysWhatGoesAndWhatHoldsEachDraft(t *testing.T) {
	t.Parallel()

	short := func(approved, cards int) discussionflow.Hold {
		return discussionflow.Hold{Reason: discussionflow.HoldEpicShort, Approved: approved, Cards: cards}
	}
	cardsLeft := func(n int) discussionflow.Hold {
		return discussionflow.Hold{Reason: discussionflow.HoldCards, Left: n}
	}
	waits := func(title string) discussionflow.Hold {
		return discussionflow.Hold{Reason: discussionflow.HoldDraft, Title: title}
	}
	inEpic := discussionflow.Hold{Reason: discussionflow.HoldEpic}
	epicOut := discussionflow.Hold{Reason: discussionflow.HoldEpicDiscarded}

	tests := []struct {
		name       string
		drafts     []discussion.Draft
		publishing bool
		want       discussionflow.ChainView
	}{
		{
			name:   "1 a loose approved card goes",
			drafts: list(card("l1", "", approved)),
			want:   at(discussionflow.StatusPublishing, "", waitingHint, discussionflow.ChainView{Due: ids("l1")}),
		},
		{
			name:   "2 a card waits for an undecided dependency",
			drafts: list(card("l1", "", approved, dependsOn("l2")), card("l2", "")),
			want:   at(discussionflow.StatusDeciding, discussionflow.StatusDeciding, waitingHint, discussionflow.ChainView{Holds: map[string]discussionflow.Hold{"l1": waits("The l2")}}),
		},
		{
			name:   "2b a card goes after its approved dependency",
			drafts: list(card("l1", "", approved, dependsOn("l2")), card("l2", "", approved)),
			want:   at(discussionflow.StatusPublishing, "", waitingHint, discussionflow.ChainView{Due: ids("l2", "l1")}),
		},
		{
			name:   "3 a discarded dependency is no wait",
			drafts: list(card("l1", "", approved, dependsOn("l2")), card("l2", "", discarded)),
			want:   at(discussionflow.StatusPublishing, "", waitingHint, discussionflow.ChainView{Due: ids("l1")}),
		},
		{
			name:   "4 a card waits for an epic that is not approved",
			drafts: list(epic("e"), card("c1", "e", approved)),
			want:   at(discussionflow.StatusDeciding, discussionflow.StatusDeciding, waitingHint, discussionflow.ChainView{Holds: map[string]discussionflow.Hold{"c1": inEpic}}),
		},
		{
			name:   "5 an epic waits for the cards to be decided",
			drafts: list(epic("e", approved), card("c1", "e", approved), card("c2", "e"), card("c3", "e")),
			want: at(discussionflow.StatusDeciding, discussionflow.StatusDeciding, waitingHint, discussionflow.ChainView{Holds: map[string]discussionflow.Hold{
				"e": cardsLeft(2), "c1": cardsLeft(2),
			}}),
		},
		{
			name: "6 an epic goes with its approved cards",
			drafts: list(
				epic("e", approved), card("c1", "e", approved), card("c2", "e", approved), card("c3", "e", discarded),
			),
			want: at(discussionflow.StatusPublishing, "", waitingHint, discussionflow.ChainView{Due: ids("e", "c1", "c2")}),
		},
		{
			name: "7 one approved card of three is short",
			drafts: list(
				epic("e", approved), card("c1", "e", approved), card("c2", "e", discarded), card("c3", "e", discarded),
			),
			want: at(discussionflow.StatusEpicCantPublish, discussionflow.StatusEpicCantPublish, shortHint("approve one more card"), discussionflow.ChainView{Holds: map[string]discussionflow.Hold{"e": short(1, 3), "c1": short(1, 3)}}),
		},
		{
			name: "8 no approved card of three is short",
			drafts: list(
				epic("e", approved), card("c1", "e", discarded), card("c2", "e", discarded), card("c3", "e", discarded),
			),
			want: at(discussionflow.StatusEpicCantPublish, discussionflow.StatusEpicCantPublish, shortHint("approve two more cards"), discussionflow.ChainView{Holds: map[string]discussionflow.Hold{"e": short(0, 3)}}),
		},
		{
			name:   "9 one card of one is short",
			drafts: list(epic("e", approved), card("c1", "e", approved)),
			want:   at(discussionflow.StatusEpicCantPublish, discussionflow.StatusEpicCantPublish, shortHint("move another card into it"), discussionflow.ChainView{Holds: map[string]discussionflow.Hold{"e": short(1, 1), "c1": short(1, 1)}}),
		},
		{
			name:   "10 an epic without cards is short",
			drafts: list(epic("e", approved)),
			want:   at(discussionflow.StatusEpicCantPublish, discussionflow.StatusEpicCantPublish, shortHint("move two cards into it"), discussionflow.ChainView{Holds: map[string]discussionflow.Hold{"e": short(0, 0)}}),
		},
		{
			name:   "11 a card of a discarded epic won't publish",
			drafts: list(epic("e", discarded), card("c1", "e", approved)),
			want: at(discussionflow.StatusEpicDiscarded, discussionflow.StatusEpicDiscarded, "", discussionflow.ChainView{
				Holds:       map[string]discussionflow.Hold{"c1": epicOut},
				WontPublish: ids("c1"),
			}),
		},
		{
			name:   "12 what depends on such a card won't publish either",
			drafts: list(epic("e", discarded), card("c1", "e", approved), card("l1", "", approved, dependsOn("c1"))),
			want: at(discussionflow.StatusEpicDiscarded, discussionflow.StatusEpicDiscarded, "", discussionflow.ChainView{
				Holds:       map[string]discussionflow.Hold{"c1": epicOut, "l1": waits("The c1")},
				WontPublish: ids("c1", "l1"),
			}),
		},
		{
			name: "13 an epic that needs such a card won't publish, nor its cards",
			drafts: list(
				epic("e2", discarded), card("r", "e2", approved), epic("e", approved),
				card("c1", "e", approved, dependsOn("r")), card("c2", "e", approved),
			),
			want: at(discussionflow.StatusEpicDiscarded, discussionflow.StatusEpicDiscarded, "", discussionflow.ChainView{
				Holds: map[string]discussionflow.Hold{
					"r": epicOut, "e": waits("The r"), "c1": inEpic, "c2": inEpic,
				},
				WontPublish: ids("r", "e", "c1", "c2"),
			}),
		},
		{
			name:   "14 the cards of a discarded epic are held, decided or not",
			drafts: list(epic("e", discarded), card("c1", "e"), card("c2", "e")),
			want:   at(discussionflow.StatusDeciding, discussionflow.StatusDeciding, "", discussionflow.ChainView{Holds: map[string]discussionflow.Hold{"c1": epicOut, "c2": epicOut}}),
		},
		{
			name:   "15 a failed draft stops only itself",
			drafts: list(card("a", "", approved, failed), card("b", "", approved)),
			want:   at(discussionflow.StatusPublishFailed, discussionflow.StatusPublishFailed, failedHint, discussionflow.ChainView{Due: ids("b")}),
		},
		{
			name:   "16 what depends on a failed draft waits",
			drafts: list(card("a", "", approved, failed), card("c", "", approved, dependsOn("a"))),
			want:   at(discussionflow.StatusPublishFailed, discussionflow.StatusPublishFailed, failedHint, discussionflow.ChainView{Holds: map[string]discussionflow.Hold{"c": waits("The a")}}),
		},
		{
			name: "17 the cards wait for an epic that failed",
			drafts: list(
				epic("e", approved, started, failed), card("c1", "e", approved), card("c2", "e", approved),
			),
			want: at(discussionflow.StatusPublishFailed, discussionflow.StatusPublishFailed, failedHint, discussionflow.ChainView{Holds: map[string]discussionflow.Hold{"c1": inEpic, "c2": inEpic}}),
		},
		{
			name: "18 an epic on its way goes with what is left",
			drafts: list(
				epic("e", approved, started), card("c1", "e", approved), card("c2", "e", discarded), card("c3", "e", discarded),
			),
			want: at(discussionflow.StatusPublishing, "", waitingHint, discussionflow.ChainView{Due: ids("e", "c1")}),
		},
		{
			name: "19 an epic waits for what its cards depend on",
			drafts: list(
				epic("e", approved), card("c1", "e", approved, dependsOn("l")), card("c2", "e", approved), card("l", ""),
			),
			want: at(discussionflow.StatusDeciding, discussionflow.StatusDeciding, waitingHint, discussionflow.ChainView{Holds: map[string]discussionflow.Hold{
				"e": waits("The l"), "c1": inEpic, "c2": inEpic,
			}}),
		},
		{
			name: "19b an epic goes after what its cards depend on",
			drafts: list(
				epic("e", approved), card("c1", "e", approved, dependsOn("l")), card("c2", "e", approved), card("l", "", approved),
			),
			want: at(discussionflow.StatusPublishing, "", waitingHint, discussionflow.ChainView{Due: ids("e", "c2", "l", "c1")}),
		},
		{
			name:   "20 a cycle between cards is broken by position",
			drafts: list(card("l1", "", approved, dependsOn("l2")), card("l2", "", approved, dependsOn("l1"))),
			want:   at(discussionflow.StatusPublishing, "", waitingHint, discussionflow.ChainView{Due: ids("l1", "l2"), Cycle: true}),
		},
		{
			name: "21 a cycle through an epic is broken by position",
			drafts: list(
				epic("e", approved), card("c1", "e", approved, dependsOn("l")), card("c2", "e", approved),
				card("l", "", approved, dependsOn("c1")),
			),
			want: at(discussionflow.StatusPublishing, "", waitingHint, discussionflow.ChainView{Due: ids("e", "c2", "c1", "l"), Cycle: true}),
		},
		{
			name: "22 two epics that depend on each other",
			drafts: list(
				epic("e1", approved), card("a1", "e1", approved, dependsOn("b1")), card("a2", "e1", approved),
				epic("e2", approved), card("b1", "e2", approved, dependsOn("a1")), card("b2", "e2", approved),
			),
			want: at(discussionflow.StatusPublishing, "", waitingHint, discussionflow.ChainView{Due: ids("e1", "a2", "e2", "b2", "a1", "b1"), Cycle: true}),
		},
		{
			name:   "23 the card of an epic on GitHub goes on its own",
			drafts: list(epic("e", approved, done), card("c1", "e", approved)),
			want:   at(discussionflow.StatusPublishing, "", waitingHint, discussionflow.ChainView{Due: ids("c1")}),
		},
		{
			name:   "24 discarded drafts hold nothing",
			drafts: list(card("l1", "", discarded), card("l2", "", discarded)),
			want:   at(discussionflow.StatusReadyToArchive, discussionflow.StatusReadyToArchive, "", discussionflow.ChainView{}),
		},
		{
			name:   "25 published drafts hold nothing",
			drafts: list(card("l1", "", done), epic("e", done), card("c1", "e", done)),
			want:   at(discussionflow.StatusReadyToArchive, discussionflow.StatusReadyToArchive, "", discussionflow.ChainView{}),
		},
		{
			name:   "26 a published draft is no wait",
			drafts: list(card("l1", "", done), card("l2", "", approved)),
			want:   at(discussionflow.StatusPublishing, "", waitingHint, discussionflow.ChainView{Due: ids("l2")}),
		},
		{
			name:   "27 an undecided card of a discarded epic is not a root",
			drafts: list(epic("e", discarded), card("c1", "e", approved), card("l", "")),
			want: at(discussionflow.StatusEpicDiscarded, discussionflow.StatusEpicDiscarded, "", discussionflow.ChainView{
				Holds:       map[string]discussionflow.Hold{"c1": epicOut},
				WontPublish: ids("c1"),
			}),
		},
		{
			name: "28 an epic with a card outside of it still to decide",
			drafts: list(
				epic("e", approved), card("c1", "e", approved), card("c2", "e", discarded), card("l", ""),
			),
			want: at(discussionflow.StatusDeciding, discussionflow.StatusDeciding, shortHint("approve one more card"), discussionflow.ChainView{Holds: map[string]discussionflow.Hold{"e": short(1, 2), "c1": short(1, 2)}}),
		},
		{
			name:       "29a a run under way leaves the situation standing",
			drafts:     list(card("l1", "", approved), card("l2", "")),
			publishing: true,
			want: at(discussionflow.StatusPublishing, discussionflow.StatusDeciding, runningHint,
				discussionflow.ChainView{Due: ids("l1")}),
		},
		{
			name:       "29b a run under way with nothing to decide waits for nobody",
			drafts:     list(card("l1", "", approved), card("l2", "", done)),
			publishing: true,
			want:       at(discussionflow.StatusPublishing, "", runningHint, discussionflow.ChainView{Due: ids("l1")}),
		},
		{
			name:       "29c a run under way shows over a failure, which stands",
			drafts:     list(card("a", "", approved, failed), card("b", "", approved)),
			publishing: true,
			want: at(discussionflow.StatusPublishing, discussionflow.StatusPublishFailed, failedHint,
				discussionflow.ChainView{Due: ids("b")}),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := discussionflow.ChainOf(tt.drafts, tt.publishing)

			if diff := cmp.Diff(tt.want, got); diff != "" {
				t.Errorf("chain (-want +got):\n%s", diff)
			}
		})
	}
}
