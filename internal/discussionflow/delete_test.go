package discussionflow_test

import (
	"errors"
	"os"
	"strings"
	"testing"

	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/discussionflow"
)

func TestArchivingIsRefusedWhileAnApprovedDraftIsWaitingToBePublished(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, draftsArtifact)
	f.decide(id, "export-invoices", discussion.DecisionApproved)

	err := f.flow.Archive(t.Context(), id)

	if !errors.Is(err, discussionflow.ErrCannotArchive) {
		t.Fatalf("archive discussion: got %v, want %v", err, discussionflow.ErrCannotArchive)
	}
	var refusal *discussionflow.ArchiveRefusal
	if !errors.As(err, &refusal) || refusal.Hint != "Approved drafts are waiting to be published." {
		t.Errorf("the refusal says %q, want the reason the user reads", err)
	}
	if !strings.Contains(err.Error(), "Approved drafts are waiting to be published.") {
		t.Errorf("the refusal reads %q, want the reason in it", err)
	}
	if _, ok := f.discussions.Get(id); !ok {
		t.Errorf("the discussion left the list anyway")
	}
}

func TestArchivingADiscussionClosesItsConversationAndKeepsItInTheHistory(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, draftsArtifact)
	for _, draftID := range []string{"invoices-epic", "export-invoices", "invoice-schema"} {
		f.decide(id, draftID, discussion.DecisionDiscarded)
	}

	if err := f.flow.Archive(t.Context(), id); err != nil {
		t.Fatalf("archive discussion: %v", err)
	}

	if _, ok := f.flow.State(id); ok {
		t.Errorf("the archived discussion is still an active one")
	}
	if history := f.discussions.ListArchived(); len(history) != 1 || history[0].ID != id {
		t.Errorf("the discussion is not in the history: %v", history)
	}
	if calls := f.sessions.made(); !contains(calls, "close:"+id) {
		t.Errorf("the conversation of the discussion was not closed: %v", calls)
	}
}

func TestDeletingADiscussionTakesItsConversationAndItsArtifacts(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	stored, ok := f.discussions.Get(id)
	if !ok {
		t.Fatalf("the discussion %s is not there", id)
	}

	if err := f.flow.Delete(t.Context(), id); err != nil {
		t.Fatalf("delete discussion: %v", err)
	}

	if _, found := f.discussions.Lookup(id); found {
		t.Errorf("the discussion stayed")
	}
	if _, err := os.Stat(stored.ArtifactsDir); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("the artifacts of the discussion stayed: %v", err)
	}
	if calls := f.sessions.made(); !contains(calls, "discardTask:"+id) {
		t.Errorf("the conversation of the discussion was not discarded: %v", calls)
	}
}

func TestDeletingADiscussionThatIsNotThereIsRefused(t *testing.T) {
	t.Parallel()

	f := newFixture(t)

	err := f.flow.Delete(t.Context(), "no-such-discussion")
	if !errors.Is(err, discussion.ErrNotFound) {
		t.Fatalf("delete discussion: got %v, want %v", err, discussion.ErrNotFound)
	}
}

func TestADeletedDiscussionIsNoLongerEvaluated(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	if err := f.flow.Delete(t.Context(), id); err != nil {
		t.Fatalf("delete discussion: %v", err)
	}

	before := f.changeCount()
	f.flow.Check(id)
	if got := f.changeCount(); got != before {
		t.Errorf("the flow reported %d changes of a deleted discussion", got-before)
	}
}
