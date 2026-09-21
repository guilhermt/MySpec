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

// laterArtifact is the artifact written again with one more card, as the agent
// writes it while a publication is under way.
const laterArtifact = looseArtifact + `
## Draft: invoice-emails
- Kind: new
- Repository: acme/api

### Title
Email the invoices

### Body
The customer gets the invoice by email.
`

func TestTheDraftsAreNotReadWhileAPublicationIsWritingThem(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, looseArtifact)
	release := f.gh.holdCreate("Invoice report")
	t.Cleanup(release)

	f.approve(id, "invoice-report")
	f.waitFor(id, func(s discussionflow.State) bool { return s.Publishing })

	// The agent rested with another artifact while the run writes on GitHub.
	f.write(id, discussion.DraftsFile, laterArtifact)
	f.write(id, discussion.DocumentFile, "# Invoices\n")
	f.flow.Check(id)
	f.waitFor(id, func(s discussionflow.State) bool { return s.HasDocument })
	if got := len(f.state(id).Drafts); got != 1 {
		t.Errorf("the discussion has %d drafts, want the ones the run is writing", got)
	}

	release()

	f.waitPublished(id, "invoice-report")
	state := f.waitFor(id, func(s discussionflow.State) bool { return len(s.Drafts) == 2 })
	if !f.draftIn(state, "invoice-report").Published.Done() {
		t.Errorf("the card the run published was lost when the artifact was read again")
	}
}

// withoutTheReportArtifact is the artifact written again without the card of
// the discussion: a reconciliation of it takes the card out.
const withoutTheReportArtifact = `---
status: drafts
---

## Draft: invoice-emails
- Kind: new
- Repository: acme/api

### Title
Email the invoices

### Body
The customer gets the invoice by email.
`

// rewrittenReportArtifact is the artifact written again with the card of the
// discussion saying something else, next to a card that is new: a
// reconciliation of it replaces the first one and records the second.
const rewrittenReportArtifact = `---
status: drafts
---

## Draft: invoice-report
- Kind: new
- Repository: acme/api

### Title
Invoice report, by month

### Body
The report of the invoices of every month.

## Draft: invoice-emails
- Kind: new
- Repository: acme/api

### Title
Email the invoices

### Body
The customer gets the invoice by email.
`

func TestTheDraftsAreNotReadWhileMemoryHoldsAPublicationTheStoreCouldNot(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, looseArtifact)
	f.store.failWrites(2, errStore, onTheIssue)

	f.approve(id, "invoice-report")
	f.waitFor(id, func(s discussionflow.State) bool { return !s.Publishing && len(f.gh.made()) > 0 })
	held := f.draftState(id, "invoice-report").Draft
	if held.Published.NodeID == "" || held.PublishError == "" {
		t.Fatalf("the publication no write held is not there: %+v", held)
	}

	// The agent rests with an artifact that drops the card, then with one that
	// rewrites it, and then leaves both as they are. An evaluation stamps the
	// document of the turn before it reads the artifact, and the evaluations
	// of a discussion run one at a time, so the third revision says the
	// reading of the second artifact is over.
	for turn, artifact := range []string{withoutTheReportArtifact, rewrittenReportArtifact, rewrittenReportArtifact} {
		f.write(id, discussion.DraftsFile, artifact)
		f.write(id, discussion.DocumentFile, "# Invoices\n"+strings.Repeat(".", turn+1))
		f.flow.Check(id)
		f.waitFor(id, func(s discussionflow.State) bool { return s.DocumentRevision > turn })
	}

	state := f.state(id)
	if len(state.Drafts) != 1 {
		t.Fatalf("the discussion has %d drafts, want the one whose publication memory holds", len(state.Drafts))
	}
	if diff := cmp.Diff(held, f.draftIn(state, "invoice-report")); diff != "" {
		t.Errorf("the artifact changed the draft memory holds the publication of (-want +got):\n%s", diff)
	}

	if err := f.flow.Retry(t.Context(), id, "invoice-report"); err != nil {
		t.Fatalf("retry the card: %v", err)
	}

	// The retry wrote the entry down, so the check it asks for reads the
	// artifact again, and the card it published is the one it kept.
	after := f.waitFor(id, func(s discussionflow.State) bool {
		return len(s.Drafts) == 2 && !s.Publishing && f.draftIn(s, "invoice-report").Published.Done()
	})
	if got := f.draftIn(after, "invoice-emails").Title; got != "Email the invoices" {
		t.Errorf("the artifact read after the retry left the card it added out: %q", got)
	}
	if got := f.draftIn(after, "invoice-report").Title; got != held.Title {
		t.Errorf("the published card says %q, want the text it went to GitHub with", got)
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
