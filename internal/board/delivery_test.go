package board_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/task"
)

// deliveryStructure is the structure the board of the fixture answers.
func deliveryStructure() board.Structure {
	return board.Structure{
		ProjectID:     projectID,
		Title:         "Roadmap",
		Viewer:        "dev",
		Statuses:      []board.Option{todo, doing, done},
		HasStatus:     true,
		StatusFieldID: statusFieldID,
	}
}

// openItems are the cards a first delivery reads, from the items given.
func openItems(t *testing.T, items ...node) []board.ItemCard {
	t.Helper()

	cards := make([]board.ItemCard, 0, len(items))
	for _, it := range items {
		raw, err := json.Marshal(it)
		if err != nil {
			t.Fatal(err)
		}
		c, err := board.ItemOf(raw)
		if err != nil {
			t.Fatalf("ItemOf() = %v, want nil", err)
		}
		cards = append(cards, c)
	}
	return cards
}

// openIssue is the item of the issue n of fullName, with a body and in status.
func openIssue(fullName string, n int, body string, status board.Option) node {
	return item(with(issueNode(fullName, n), "body", body), statusValue(status))
}

// delivered is the first delivery of the items over stored.
func delivered(t *testing.T, stored *board.Reading, items ...node) board.Reading {
	t.Helper()

	return board.FirstDelivery(deliveryStructure(), "acme", stored, openItems(t, items...), base)
}

// storedCard is a card of a stored reading.
func storedCard(fullName string, n int, status board.Option) board.Card {
	return board.Card{
		Issue:        cardIssue(fullName, n),
		StatusID:     status.ID,
		Status:       status.Name,
		PullRequests: []board.PullRequest{},
		Siblings:     []board.Related{},
		Dependencies: []board.Dependency{},
		ReadAt:       base.Add(-time.Hour),
	}
}

func related(fullName string, n int, status board.Option, onBoard bool) board.Related {
	return board.Related{Issue: cardIssue(fullName, n), Status: status.Name, OnBoard: onBoard}
}

func TestFirstDeliveryPutsTheOpenCardsFirstAndKeepsTheOthers(t *testing.T) {
	t.Parallel()

	stale := storedCard("acme/web", 2, todo)
	closed := storedCard("acme/web", 3, done)
	closed.State = task.IssueClosed
	stored := &board.Reading{
		ProjectID:      projectID,
		Title:          "Old title",
		Statuses:       []board.Option{todo},
		Cards:          []board.Card{stale, closed, storedCard("acme/web", 1, todo)},
		StructureStamp: "stamp",
		Index:          map[string]board.IndexedIssue{"acme/api#20": {}},
	}
	before, err := json.Marshal(stored)
	if err != nil {
		t.Fatal(err)
	}

	got := delivered(t, stored,
		openIssue("acme/web", 4, "", doing),
		openIssue("acme/web", 1, "", doing),
	)

	keys := make([]string, 0, len(got.Cards))
	for _, c := range got.Cards {
		keys = append(keys, c.Key())
	}
	if diff := cmp.Diff([]string{"acme/web#4", "acme/web#1", "acme/web#2", "acme/web#3"}, keys); diff != "" {
		t.Errorf("the cards (-want +got):\n%s", diff)
	}
	for _, c := range got.Cards {
		if !c.Unconfirmed {
			t.Errorf("card %s is confirmed, want Unconfirmed", c.Key())
		}
	}
	if got.Title != "Roadmap" || got.Viewer != "dev" || !got.HasStatus || got.StatusFieldID != statusFieldID || len(got.Statuses) != 3 {
		t.Errorf("the structure of the delivery = %q, %q, %v, %q, %d statuses, want the board's", got.Title, got.Viewer, got.HasStatus, got.StatusFieldID, len(got.Statuses))
	}
	if got.Cards[1].Status != doing.Name || !got.Cards[1].ReadAt.Equal(base) {
		t.Errorf("open card %s = %q read at %v, want %q read at %v", got.Cards[1].Key(), got.Cards[1].Status, got.Cards[1].ReadAt, doing.Name, base)
	}
	if got.Cards[2].Status != todo.Name || !got.Cards[2].ReadAt.Equal(stale.ReadAt) {
		t.Errorf("preserved card %s = %q read at %v, want it as it was", got.Cards[2].Key(), got.Cards[2].Status, got.Cards[2].ReadAt)
	}
	if got.StructureStamp != "stamp" || len(got.Index) != 1 {
		t.Errorf("the delivery holds stamp %q and %d indexed issues, want the stored ones", got.StructureStamp, len(got.Index))
	}

	after, err := json.Marshal(stored)
	if err != nil {
		t.Fatal(err)
	}
	if string(before) != string(after) {
		t.Errorf("firstDelivery changed the stored reading:\n%s\n%s", before, after)
	}
}

func TestFirstDeliveryWithoutAStoredReadingHasOnlyTheOpenCards(t *testing.T) {
	t.Parallel()

	got := delivered(t, nil, openIssue("acme/web", 1, "", todo))

	if len(got.Cards) != 1 || !got.Cards[0].Unconfirmed || got.StructureStamp != "" || got.Index != nil {
		t.Errorf("delivery = %d cards, stamp %q, index %v, want one unconfirmed card without stamp or index", len(got.Cards), got.StructureStamp, got.Index)
	}
}

// relations are what a delivery decides about a card.
type relations struct {
	Epic            *board.Epic
	EpicUnconfirmed bool
	Siblings        []board.Related
	Dependencies    []board.Dependency
}

func relationsOf(c board.Card) relations {
	return relations{c.Epic, c.EpicUnconfirmed, c.Siblings, c.Dependencies}
}

func TestFirstDeliveryDecidesTheEpicAndTheSiblings(t *testing.T) {
	t.Parallel()

	epic10 := &board.Epic{Issue: cardIssue("acme/web", 10), Body: "The epic."}
	withEpic := func(c board.Card, e *board.Epic, siblings ...board.Related) board.Card {
		c.Epic, c.Siblings = e, append([]board.Related{}, siblings...)
		return c
	}
	nativeParent := with(brief("acme/web", 10), "body", "The epic.")

	tests := []struct {
		name  string
		old   *board.Card
		items []node
		want  relations
	}{
		{
			name:  "a native parent is the epic, confirmed",
			items: []node{item(with(issueNode("acme/web", 1), "parent", nativeParent))},
			want:  relations{Epic: epic10, Siblings: []board.Related{}, Dependencies: []board.Dependency{}},
		},
		{
			name: "an epic of the convention that is an open card is that card",
			items: []node{
				openIssue("acme/web", 1, "Epic: acme/web#10", todo),
				item(with(issueNode("acme/web", 10), "body", "The epic.")),
			},
			want: relations{Epic: epic10, Siblings: []board.Related{}, Dependencies: []board.Dependency{}},
		},
		{
			name:  "an epic of the convention that no card holds is the stored one, unconfirmed",
			old:   ptr(withEpic(storedCard("acme/web", 1, todo), epic10)),
			items: []node{openIssue("acme/web", 1, "Epic: acme/web#10", todo)},
			want:  relations{Epic: epic10, EpicUnconfirmed: true, Siblings: []board.Related{}, Dependencies: []board.Dependency{}},
		},
		{
			name:  "an epic of the convention that differs from the stored one is nil, unconfirmed",
			old:   ptr(withEpic(storedCard("acme/web", 1, todo), epic10)),
			items: []node{openIssue("acme/web", 1, "Epic: acme/web#11", todo)},
			want:  relations{EpicUnconfirmed: true, Siblings: []board.Related{}, Dependencies: []board.Dependency{}},
		},
		{
			name:  "an epic of the convention with nothing stored is nil, unconfirmed",
			items: []node{openIssue("acme/web", 1, "Epic: acme/web#10", todo)},
			want:  relations{EpicUnconfirmed: true, Siblings: []board.Related{}, Dependencies: []board.Dependency{}},
		},
		{
			name:  "no epic is nil, confirmed",
			old:   ptr(withEpic(storedCard("acme/web", 1, todo), epic10)),
			items: []node{openIssue("acme/web", 1, "", todo)},
			want:  relations{Siblings: []board.Related{}, Dependencies: []board.Dependency{}},
		},
		{
			name: "the siblings stay when the epic is the same, and the open ones take their card",
			old: ptr(withEpic(storedCard("acme/web", 1, todo), epic10,
				related("acme/web", 2, todo, true), related("acme/web", 5, todo, false))),
			items: []node{
				item(with(issueNode("acme/web", 1), "parent", nativeParent)),
				openIssue("acme/web", 2, "", doing),
			},
			want: relations{
				Epic:         epic10,
				Siblings:     []board.Related{related("acme/web", 2, doing, true), related("acme/web", 5, todo, false)},
				Dependencies: []board.Dependency{},
			},
		},
		{
			name: "the siblings are empty when the epic changed",
			old: ptr(withEpic(storedCard("acme/web", 1, todo), &board.Epic{Issue: cardIssue("acme/web", 11)},
				related("acme/web", 2, todo, true))),
			items: []node{item(with(issueNode("acme/web", 1), "parent", nativeParent))},
			want:  relations{Epic: epic10, Siblings: []board.Related{}, Dependencies: []board.Dependency{}},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var stored *board.Reading
			if tt.old != nil {
				stored = &board.Reading{Cards: []board.Card{*tt.old}}
			}
			got := delivered(t, stored, tt.items...)
			if diff := cmp.Diff(tt.want, relationsOf(got.Cards[0])); diff != "" {
				t.Errorf("card %s (-want +got):\n%s", got.Cards[0].Key(), diff)
			}
		})
	}
}

func ptr[T any](v T) *T { return &v }

func TestFirstDeliveryDecidesTheDependencies(t *testing.T) {
	t.Parallel()

	merged := board.PullRequest{Owner: "acme", Name: "api", Number: 5, URL: "https://github.com/acme/api/pull/5", State: board.PRMerged}
	withDeps := func(c board.Card, deps ...board.Dependency) board.Card {
		c.Dependencies = deps
		return c
	}
	unconfirmed := func(fullName string, n int, s board.Option) board.Dependency {
		return board.Dependency{Related: related(fullName, n, s, false), PullRequests: []board.PullRequest{}, Unconfirmed: true}
	}
	blocker := func(state string, prs ...node) node {
		b := with(brief("acme/api", 20), "state", state)
		b["closedByPullRequestsReferences"] = nodes(prs...)
		return b
	}
	blockedBy := func(b node) node {
		return item(with(issueNode("acme/web", 1), "blockedBy", nodes(b)))
	}

	tests := []struct {
		name   string
		stored []board.Card // the stored cards; the first is the card of the delivery
		items  []node
		want   []board.Dependency
	}{
		{
			name: "an open card is confirmed with its data",
			items: []node{
				openIssue("acme/web", 1, "Depends on: acme/web#2", todo),
				openIssue("acme/web", 2, "", doing),
			},
			want: []board.Dependency{{Related: related("acme/web", 2, doing, true), PullRequests: []board.PullRequest{}}},
		},
		{
			name:   "a native blocker is confirmed with the status of the stored card",
			stored: []board.Card{storedCard("acme/web", 1, todo), storedCard("acme/api", 20, doing)},
			items:  []node{blockedBy(blocker("OPEN"))},
			want:   []board.Dependency{{Related: related("acme/api", 20, doing, true), PullRequests: []board.PullRequest{}}},
		},
		{
			name:  "a native blocker with nothing stored has no status, and a merged pull request satisfies it",
			items: []node{blockedBy(blocker("OPEN", pr("acme/api", 5, "MERGED")))},
			want: []board.Dependency{{
				Related:      board.Related{Issue: cardIssue("acme/api", 20)},
				PullRequests: []board.PullRequest{merged},
				Satisfied:    true,
			}},
		},
		{
			name: "a satisfied dependency stays as it is",
			stored: []board.Card{withDeps(storedCard("acme/web", 1, todo),
				board.Dependency{Related: related("acme/api", 20, done, false), PullRequests: []board.PullRequest{merged}, Satisfied: true})},
			items: []node{openIssue("acme/web", 1, "Depends on: acme/api#20", todo)},
			want:  []board.Dependency{{Related: related("acme/api", 20, done, false), PullRequests: []board.PullRequest{merged}, Satisfied: true}},
		},
		{
			name: "a dependency not satisfied is unconfirmed, without pull requests",
			stored: []board.Card{withDeps(storedCard("acme/web", 1, todo),
				board.Dependency{Related: related("acme/api", 20, doing, false), PullRequests: []board.PullRequest{merged}})},
			items: []node{openIssue("acme/web", 1, "Depends on: acme/api#20", todo)},
			want:  []board.Dependency{unconfirmed("acme/api", 20, doing)},
		},
		{
			name:   "a dependency only the stored card knows takes its data",
			stored: []board.Card{storedCard("acme/web", 1, todo), storedCard("acme/web", 2, doing)},
			items:  []node{openIssue("acme/web", 1, "Depends on: acme/web#2", todo)},
			want: []board.Dependency{{
				Related: related("acme/web", 2, doing, true), PullRequests: []board.PullRequest{}, Unconfirmed: true,
			}},
		},
		{
			name:  "a dependency nobody knows is built from its reference",
			items: []node{openIssue("acme/web", 1, "Depends on: acme/api#20", todo)},
			want: []board.Dependency{{
				Related: board.Related{Issue: board.Issue{
					Owner: "acme", Name: "api", Number: 20, URL: "https://github.com/acme/api/issues/20", State: task.IssueOpen,
				}},
				PullRequests: []board.PullRequest{},
				Unconfirmed:  true,
			}},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var stored *board.Reading
			if tt.stored != nil {
				stored = &board.Reading{Cards: tt.stored}
			}
			got := delivered(t, stored, tt.items...)
			if diff := cmp.Diff(tt.want, got.Cards[0].Dependencies); diff != "" {
				t.Errorf("dependencies of %s (-want +got):\n%s", got.Cards[0].Key(), diff)
			}
		})
	}
}

func TestFirstDeliveryDoesNotWarnFromAPreservedCard(t *testing.T) {
	t.Parallel()

	satisfiedDep := board.Dependency{Related: related("acme/api", 21, done, false), PullRequests: []board.PullRequest{}, Satisfied: true}
	waiting := board.Dependency{Related: related("acme/api", 20, doing, false), PullRequests: []board.PullRequest{}}
	onOpenCard := board.Dependency{Related: related("acme/web", 2, doing, true), PullRequests: []board.PullRequest{}}
	preserved := storedCard("acme/web", 3, todo)
	preserved.Dependencies = []board.Dependency{satisfiedDep, waiting, onOpenCard}
	stored := &board.Reading{Cards: []board.Card{preserved}}

	got := delivered(t, stored, openIssue("acme/web", 2, "", doing))

	waiting.Unconfirmed = true
	want := []board.Dependency{satisfiedDep, waiting, onOpenCard}
	if diff := cmp.Diff(want, got.Cards[1].Dependencies); diff != "" {
		t.Errorf("dependencies of the preserved card (-want +got):\n%s", diff)
	}
	if preserved.Dependencies[1].Unconfirmed {
		t.Error("firstDelivery marked a dependency of the stored card")
	}
}
