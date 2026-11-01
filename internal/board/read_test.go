package board_test

import (
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/gh"
)

// heldClosed makes the closed query wait: entered closes as it arrives, and the
// returned function lets it answer with the reply given.
func heldClosed(f *fixture, closed reply) (entered <-chan struct{}, release func()) {
	enter, rel := make(chan struct{}), make(chan struct{})
	closed.entered, closed.release = enter, rel
	f.github.answer(itemsMatch, closedQ, closed)
	return enter, func() { close(rel) }
}

// waitDelivery waits until the stored reading of the board satisfies ok.
func waitDelivery(t *testing.T, f *fixture, ok func(board.Stored) bool) board.Stored {
	t.Helper()

	deadline := time.Now().Add(pollTimeout)
	for {
		if stored := f.service.Stored(boardID); ok(stored) {
			return stored
		}
		if time.Now().After(deadline) {
			t.Fatalf("the delivery did not arrive within %s", pollTimeout)
		}
		time.Sleep(pollStep)
	}
}

func hasReading(s board.Stored) bool { return s.Reading != nil }

func keysOf(cards []board.Card) []string {
	keys := make([]string, len(cards))
	for i, c := range cards {
		keys[i] = c.Key()
	}
	return keys
}

func TestTheOpenCardsAreDeliveredBeforeTheClosedOnesAreRead(t *testing.T) {
	t.Parallel()

	oldAt := base.Add(-time.Hour)
	stored := board.Stored{
		Reading: &board.Reading{
			ProjectID: projectID,
			Title:     "Old title",
			Cards:     []board.Card{storedCard("acme/web", 2, done), storedCard("acme/web", 1, todo)},
		},
		ReadAt: oldAt,
	}
	cases := []struct {
		name   string
		stored board.Stored
		readAt time.Time
		want   []string
	}{
		{"a board read before", stored, oldAt, []string{"acme/web#3", "acme/web#1", "acme/web#2"}},
		{"a board never read", board.Stored{}, base, []string{"acme/web#3", "acme/web#1"}},
		{"a board with a failure", board.Stored{Reading: stored.Reading, ReadAt: oldAt, Failure: &board.Failure{Reason: board.ReasonFailed}, FailedAt: oldAt}, oldAt, []string{"acme/web#3", "acme/web#1", "acme/web#2"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			f := newFixture(t, tc.stored)
			f.github.answer(structureMatch, "", structure("New title"))
			f.github.answer(itemsMatch, openQ, itemsPage("",
				openIssue("acme/web", 3, "", todo), openIssue("acme/web", 1, "", doing)))
			entered, release := heldClosed(f, itemsPage("", item(issueNode("acme/web", 2), statusValue(done))))

			f.service.Refresh(boardID)
			<-entered
			got := waitDelivery(t, f, func(s board.Stored) bool { return s.Reading != nil && s.Reading.Title == "New title" })

			if diff := cmp.Diff(tc.want, keysOf(got.Reading.Cards)); diff != "" {
				t.Errorf("cards at the delivery (-want +got):\n%s", diff)
			}
			if !got.ReadAt.Equal(tc.readAt) {
				t.Errorf("ReadAt at the delivery = %v, want %v", got.ReadAt, tc.readAt)
			}
			if b, _ := f.service.Get(boardID); b.Title != "New title" {
				t.Errorf("Get().Title = %q, want the title of the delivery", b.Title)
			}
			if !f.service.Reading(boardID) {
				t.Error("Reading() = false at the delivery, want the reading still running")
			}
			if first := got.Reading.Cards[0]; first.Status != todo.Name || !first.Unconfirmed {
				t.Errorf("first card = status %q, unconfirmed %v, want the new open card, unconfirmed", first.Status, first.Unconfirmed)
			}
			if tc.stored.Failure != nil && got.Failure == nil {
				t.Error("the delivery cleared the failure, want it kept until the conclusion")
			}

			release()
			waitReading(t, f.service, boardID)

			final := f.service.Stored(boardID)
			if final.Failure != nil || !final.ReadAt.Equal(base) {
				t.Errorf("Stored() at the conclusion = read at %v with failure %v, want read at %v without one", final.ReadAt, final.Failure, base)
			}
			for _, c := range final.Reading.Cards {
				if c.Unconfirmed {
					t.Errorf("card %s is unconfirmed at the conclusion", c.Key())
				}
			}
		})
	}
}

func TestOnReadHearsTheOpenCardsAtTheDeliveryAndEverythingAtTheConclusion(t *testing.T) {
	t.Parallel()
	f := newFixture(t, board.Stored{})
	f.taskCards = []string{"acme/web#99"}

	epic := with(issueNode("acme/web", 1), "body", "Open epic.")
	child := with(issueNode("acme/web", 2), "body", "Epic: acme/web#10")
	f.github.answer(structureMatch, "", structure("Roadmap"))
	f.github.answer(itemsMatch, openQ, itemsPage("", item(child), item(epic)))
	entered, release := heldClosed(f, itemsPage("", item(with(issueNode("acme/web", 3), "state", "CLOSED"))))
	f.github.answer(batchMatch, "", batch(issueNode("acme/web", 10), with(issueNode("acme/web", 99), "state", "CLOSED")))

	f.service.Refresh(boardID)
	<-entered
	waitDelivery(t, f, hasReading)
	deadline := time.Now().Add(pollTimeout)
	for len(f.reads.all()) == 0 && time.Now().Before(deadline) {
		time.Sleep(pollStep)
	}
	release()
	waitReading(t, f.service, boardID)

	reads := f.reads.all()
	if len(reads) != 2 {
		t.Fatalf("OnRead was called %d times, want 2", len(reads))
	}
	if diff := cmp.Diff([]string{"acme/web#1", "acme/web#2"}, sortedKeys(reads[0])); diff != "" {
		t.Errorf("OnRead at the delivery (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]string{"acme/web#1", "acme/web#2", "acme/web#3", "acme/web#99"}, sortedKeys(reads[1])); diff != "" {
		t.Errorf("OnRead at the conclusion (-want +got):\n%s", diff)
	}
	if !reads[0]["acme/web#2"].EpicUnconfirmed {
		t.Error("the card whose epic is outside the open cards lacks EpicUnconfirmed at the delivery")
	}
	if reads[0]["acme/web#1"].EpicUnconfirmed {
		t.Error("a card without an epic has EpicUnconfirmed")
	}
	if reads[1]["acme/web#2"].EpicUnconfirmed || reads[1]["acme/web#2"].Epic == nil {
		t.Error("the conclusion leaves EpicUnconfirmed or no epic on the card")
	}
}

func sortedKeys(cards map[string]board.Card) []string {
	keys := make([]string, 0, len(cards))
	for k := range cards {
		keys = append(keys, k)
	}
	slices.Sort(keys)
	return keys
}

func TestAFailureBeforeTheDeliveryChangesNothingButTheFailure(t *testing.T) {
	t.Parallel()
	oldAt := base.Add(-time.Hour)
	reading := &board.Reading{ProjectID: projectID, Title: "Roadmap", Cards: []board.Card{storedCard("acme/web", 1, todo)}}
	f := newFixture(t, board.Stored{Reading: reading, ReadAt: oldAt})
	f.github.answer(structureMatch, "", structure("Roadmap"))
	f.github.answer(itemsMatch, openQ, reply{err: errors.New("boom")})
	f.github.answer(itemsMatch, closedQ, itemsPage(""))

	f.refresh(t)

	got := f.service.Stored(boardID)
	if got.Failure == nil || !got.ReadAt.Equal(oldAt) {
		t.Errorf("Stored() = failure %v, read at %v, want a failure and the old read time", got.Failure, got.ReadAt)
	}
	if diff := cmp.Diff(keysOf(reading.Cards), keysOf(got.Reading.Cards)); diff != "" {
		t.Errorf("cards (-want +got):\n%s", diff)
	}
	if got.Reading.Cards[0].Unconfirmed {
		t.Error("the stored card became unconfirmed, want the reading untouched")
	}
	if len(f.reads.all()) != 0 {
		t.Error("OnRead was called, want no call")
	}
}

func TestAFailureOfTheClosedCardsKeepsTheDelivery(t *testing.T) {
	t.Parallel()
	oldAt := base.Add(-time.Hour)
	reading := &board.Reading{ProjectID: projectID, Title: "Roadmap", Cards: []board.Card{storedCard("acme/web", 2, done)}}
	cases := []struct {
		name   string
		stored board.Stored
		readAt time.Time
	}{
		{"a board read before", board.Stored{Reading: reading, ReadAt: oldAt}, oldAt},
		{"a board never read", board.Stored{}, base},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			f := newFixture(t, tc.stored)
			f.github.answer(structureMatch, "", structure("Roadmap"))
			f.github.answer(itemsMatch, openQ, itemsPage("", openIssue("acme/web", 1, "", doing)))
			f.github.answer(itemsMatch, closedQ, reply{err: errors.New("boom")})

			f.refresh(t)

			got := f.service.Stored(boardID)
			if got.Failure == nil {
				t.Error("Stored().Failure = nil, want the failure of the closed cards")
			}
			if !got.ReadAt.Equal(tc.readAt) {
				t.Errorf("ReadAt = %v, want %v: the time of the last complete reading", got.ReadAt, tc.readAt)
			}
			if got.Reading == nil || got.Reading.Cards[0].Key() != "acme/web#1" || !got.Reading.Cards[0].Unconfirmed {
				t.Errorf("Stored().Reading = %+v, want the delivery", got.Reading)
			}
			if f.store.get(boardID).Reading == nil {
				t.Error("the store holds no reading, want the delivery")
			}
		})
	}
}

func TestABoardNeverReadWithoutOpenCardsGetsNoDelivery(t *testing.T) {
	t.Parallel()
	f := newFixture(t, board.Stored{})
	f.github.answer(structureMatch, "", structure("Roadmap"))
	f.github.answer(itemsMatch, openQ, itemsPage(""))
	entered, release := heldClosed(f, itemsPage(""))

	f.service.Refresh(boardID)
	<-entered
	time.Sleep(5 * pollStep)
	if got := f.service.Stored(boardID); got.Reading != nil {
		t.Errorf("Stored().Reading = %+v before the conclusion, want nothing", got.Reading)
	}
	if writes := f.store.writes(); len(writes) != 0 {
		t.Errorf("the store took %d writes before the conclusion, want none", len(writes))
	}
	release()
	waitReading(t, f.service, boardID)

	if f.service.Stored(boardID).Reading == nil {
		t.Error("Stored().Reading = nil after the conclusion, want the empty reading")
	}
}

func TestABoardRemovedBetweenTheDeliveryAndTheConclusionKeepsNothing(t *testing.T) {
	t.Parallel()
	f := newFixture(t, board.Stored{})
	f.github.answer(structureMatch, "", structure("Roadmap"))
	f.github.answer(itemsMatch, openQ, itemsPage("", openIssue("acme/web", 1, "", todo)))
	entered, release := heldClosed(f, itemsPage(""))

	f.service.Refresh(boardID)
	<-entered
	waitDelivery(t, f, hasReading)
	deadline := time.Now().Add(pollTimeout)
	for len(f.reads.all()) < 1 && time.Now().Before(deadline) {
		time.Sleep(pollStep)
	}
	if err := f.service.Remove(t.Context(), boardID); err != nil {
		t.Fatalf("Remove() = %v, want nil", err)
	}
	reads := len(f.reads.all())
	if reads != 1 {
		t.Fatalf("OnRead was called %d times at the delivery, want 1", reads)
	}
	release()
	waitReading(t, f.service, boardID)

	if got := f.service.Stored(boardID); got.Reading != nil || got.Failure != nil {
		t.Errorf("Stored() = %+v, want nothing of the board removed", got)
	}
	if got := len(f.reads.all()); got != reads {
		t.Errorf("OnRead was called %d more times after the removal, want none", got-reads)
	}
}

func TestADeliveryThatCannotBeStoredDoesNotStopTheReading(t *testing.T) {
	t.Parallel()
	f := newFixture(t, board.Stored{})
	f.github.answer(structureMatch, "", structure("Roadmap"))
	f.github.answer(itemsMatch, openQ, itemsPage("", openIssue("acme/web", 1, "", todo)))
	f.github.answer(itemsMatch, closedQ, itemsPage(""))
	f.store.saveErr = errors.New("disk full")

	f.refresh(t)

	got := f.service.Stored(boardID)
	if got.Reading != nil || got.Failure == nil {
		t.Errorf("Stored() = %+v, want only the failure to save the conclusion", got)
	}
	if len(f.reads.all()) != 0 {
		t.Error("OnRead was called, want no call for readings that were not stored")
	}
}

func TestTheClosedCardsAreReadWhileTheStructureAnswers(t *testing.T) {
	t.Parallel()
	f := newFixture(t, board.Stored{})
	enter, rel := make(chan struct{}), make(chan struct{})
	slow := structure("Roadmap")
	slow.entered, slow.release = enter, rel
	f.github.answer(structureMatch, "", slow)
	f.github.answer(itemsMatch, openQ, itemsPage("", openIssue("acme/web", 1, "", todo)))
	f.github.answer(itemsMatch, closedQ, itemsPage(""))

	f.service.Refresh(boardID)
	<-enter
	deadline := time.Now().Add(pollTimeout)
	for len(f.github.received(itemsMatch)) < 2 && time.Now().Before(deadline) {
		time.Sleep(pollStep)
	}
	received := f.github.received(itemsMatch)
	qs := make([]string, 0, len(received))
	for _, c := range received {
		qs = append(qs, c.vars["q"].(string))
	}
	slices.Sort(qs)
	if diff := cmp.Diff([]string{closedQ, openQ}, qs); diff != "" {
		t.Errorf("queries while the structure waits (-want +got):\n%s", diff)
	}
	close(rel)
	waitReading(t, f.service, boardID)
}

func TestAFailedStructureEndsTheReadingWhileTheOtherQueriesWait(t *testing.T) {
	t.Parallel()
	f := newFixture(t, board.Stored{})
	f.github.answer(structureMatch, "", reply{err: &gh.Error{Args: []string{"api", "graphql"}, Err: errors.New("boom")}})
	enter, rel := make(chan struct{}), make(chan struct{})
	f.github.answer(itemsMatch, openQ, reply{entered: enter, release: rel})
	f.github.answer(itemsMatch, closedQ, itemsPage(""))

	f.refresh(t)
	close(rel)

	if f.service.Stored(boardID).Failure == nil {
		t.Error("Stored().Failure = nil, want the failure of the structure")
	}
}
