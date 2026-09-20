package discussionflow_test

import (
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/discussionflow"
)

// draftsArtifact is what the agent writes at the end of a turn: an epic, a new
// card under it and an update of the card the discussion started from.
const draftsArtifact = `---
status: drafts
---

## Draft: invoices-epic
- Kind: epic
- Repository: acme/web

### Title
Invoices

### Body
The invoices of the customer.

## Draft: export-invoices
- Kind: new
- Repository: acme/web
- Module: Billing
- Depends on: invoice-schema

### Title
Export invoices as CSV

### Body
The user exports the invoices.

## Draft: invoice-schema
- Kind: update
- Card: acme/web#12

### Title
Invoice schema

### Body
The schema of an invoice.
`

func TestAnIdleConversationRecordsTheDraftsOfTheArtifact(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, draftsArtifact)

	state := f.state(id)
	ids := make([]string, 0, len(state.Drafts))
	for _, d := range state.Drafts {
		ids = append(ids, d.Draft.ID)
	}
	if diff := cmp.Diff([]string{"invoices-epic", "export-invoices", "invoice-schema"}, ids); diff != "" {
		t.Errorf("the drafts of the discussion are wrong (-want +got):\n%s", diff)
	}
	if state.Status != discussionflow.StatusDeciding {
		t.Errorf("the discussion is %s, want %s", state.Status, discussionflow.StatusDeciding)
	}
	if state.UnreadableDrafts != "" {
		t.Errorf("the drafts read as unreadable: %s", state.UnreadableDrafts)
	}
	if card := f.draftState(id, "export-invoices").Draft; card.Module != "Billing" {
		t.Errorf("the module of the card is %q, want Billing", card.Module)
	}
}

func TestAnArtifactTheAppCannotReadLeavesTheDiscussionAwaitingDrafts(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)

	f.write(id, discussion.DraftsFile, strings.Replace(draftsArtifact, "- Module: Billing", "- Module: Payroll", 1))
	f.sessions.idle(id)
	f.flow.Check(id)

	state := f.waitFor(id, func(s discussionflow.State) bool { return s.UnreadableDrafts != "" })
	if state.Status != discussionflow.StatusAwaitingDrafts {
		t.Errorf("the discussion is %s, want %s", state.Status, discussionflow.StatusAwaitingDrafts)
	}
	if !strings.Contains(state.UnreadableDrafts, "Payroll") {
		t.Errorf("the reason says nothing about the module: %s", state.UnreadableDrafts)
	}
	if len(state.Drafts) != 0 {
		t.Errorf("the drafts of an unreadable artifact were recorded: %d", len(state.Drafts))
	}
}

func TestAnArtifactWrittenAgainSettlesTheWarningThatItCouldNotBeRead(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)

	f.write(id, discussion.DraftsFile, "## Draft: broken\n")
	f.sessions.idle(id)
	f.flow.Check(id)
	f.waitFor(id, func(s discussionflow.State) bool { return s.UnreadableDrafts != "" })

	f.record(id, draftsArtifact)

	if state := f.state(id); state.UnreadableDrafts != "" {
		t.Errorf("the drafts still read as unreadable: %s", state.UnreadableDrafts)
	}
}

func TestTheDocumentTheAgentWritesIsNoticedEveryTimeItChanges(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)

	if state := f.state(id); state.HasDocument {
		t.Fatalf("the discussion has a document before the agent wrote one")
	}

	f.write(id, discussion.DocumentFile, "# Invoices\n\nThe understanding.\n")
	f.flow.Check(id)
	first := f.waitFor(id, func(s discussionflow.State) bool { return s.HasDocument })
	if first.DocumentRevision != 1 {
		t.Errorf("the document is at revision %d, want 1", first.DocumentRevision)
	}

	f.write(id, discussion.DocumentFile, "# Invoices\n\nThe understanding, written again.\n")
	f.flow.Check(id)
	f.waitFor(id, func(s discussionflow.State) bool { return s.DocumentRevision == 2 })
}

func TestSyncOpensTheConversationOfEveryDiscussionThatHasOne(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.sessions.idle(id)
	f.write(id, discussion.DraftsFile, draftsArtifact)

	f.flow.Sync(t.Context())

	state := f.waitFor(id, func(s discussionflow.State) bool { return s.Discussion.DraftsRead })
	if len(state.Drafts) != 3 {
		t.Errorf("the drafts of the discussion are %d, want 3", len(state.Drafts))
	}
	if calls := f.sessions.made(); !contains(calls, "open:"+id) {
		t.Errorf("the conversation of the discussion was not opened: %v", calls)
	}
}

// contains reports whether the fake was asked to do something.
func contains(calls []string, call string) bool {
	for _, made := range calls {
		if made == call {
			return true
		}
	}
	return false
}
