package discussionflow_test

import (
	"errors"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/discussionflow"
)

// epicArtifact holds an epic with two cards under it, the second one waiting
// for the first.
const epicArtifact = `---
status: drafts
---

## Draft: invoices-epic
- Kind: epic
- Repository: acme/web

### Title
Invoices

### Body
The invoices of the customer.

## Draft: invoice-schema
- Kind: new
- Repository: acme/web
- Epic: invoices-epic

### Title
Invoice schema

### Body
The schema of an invoice.

## Draft: export-invoices
- Kind: new
- Repository: acme/web
- Epic: invoices-epic
- Depends on: invoice-schema

### Title
Export invoices as CSV

### Body
The user exports the invoices.
`

// outsideArtifact holds an epic of two cards, one of them waiting for a card
// that is published on its own.
const outsideArtifact = `---
status: drafts
---

## Draft: invoices-epic
- Kind: epic
- Repository: acme/web

### Title
Invoices

### Body
The invoices of the customer.

## Draft: invoice-schema
- Kind: new
- Repository: acme/web
- Epic: invoices-epic

### Title
Invoice schema

### Body
The schema of an invoice.

## Draft: export-invoices
- Kind: new
- Repository: acme/web
- Epic: invoices-epic
- Depends on: invoice-schema, invoice-report

### Title
Export invoices as CSV

### Body
The user exports the invoices.

## Draft: invoice-report
- Kind: new
- Repository: acme/api

### Title
Invoice report

### Body
The report of the invoices.
`

// wideEpicArtifact holds an epic of three cards that depend on nothing, so
// that one of them leaves it and the epic is still worth publishing.
const wideEpicArtifact = `---
status: drafts
---

## Draft: invoices-epic
- Kind: epic
- Repository: acme/web

### Title
Invoices

### Body
The invoices of the customer.

## Draft: invoice-schema
- Kind: new
- Repository: acme/web
- Epic: invoices-epic

### Title
Invoice schema

### Body
The schema of an invoice.

## Draft: export-invoices
- Kind: new
- Repository: acme/web
- Epic: invoices-epic

### Title
Export invoices as CSV

### Body
The user exports the invoices.

## Draft: invoice-report
- Kind: new
- Repository: acme/api
- Epic: invoices-epic

### Title
Invoice report

### Body
The report of the invoices.
`

func TestACardThatLeavesAnEpicTakesTheRequestToPublishItAlong(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, wideEpicArtifact)
	// The conversation is closed while the user decides, so that the request
	// to publish the epic waits for the evaluation the test asks for.
	f.sessions.shut(id)
	for _, draftID := range []string{"invoices-epic", "invoice-schema", "export-invoices", "invoice-report"} {
		f.approve(id, draftID)
	}
	if err := f.flow.PublishEpic(t.Context(), id, "invoices-epic"); err != nil {
		t.Fatalf("publish epic: %v", err)
	}

	if err := f.flow.SetDraftEpic(t.Context(), id, "invoice-report", ""); err != nil {
		t.Fatalf("set the epic of a card: %v", err)
	}

	f.sessions.idle(id)
	f.flow.Check(id)
	f.waitPublished(id, "invoice-report")
	if got := count(f.gh.made(), "createIssue:R_acme/web:Invoices"); got != 0 {
		t.Errorf("the epic was published %d times, want the request forgotten with the card", got)
	}
	if f.draftState(id, "invoices-epic").Draft.Published.Started() {
		t.Errorf("the epic went to GitHub after the card that was asked for left it")
	}
}

func TestTheActionsOfTheUserAreRefusedWhileAPublicationIsUnderWay(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, looseArtifact)
	release := f.gh.holdCreate("Invoice report")
	t.Cleanup(release)

	f.approve(id, "invoice-report")
	f.waitFor(id, func(s discussionflow.State) bool { return s.Publishing })

	actions := map[string]func() error{
		"decide on a draft": func() error {
			return f.flow.Decide(t.Context(), id, "invoice-report", discussion.DecisionDiscarded)
		},
		"set the text of a draft": func() error {
			return f.flow.SetDraftText(t.Context(), id, "invoice-report", "Another title", "Another body")
		},
		"retry a draft":          func() error { return f.flow.Retry(t.Context(), id, "invoice-report") },
		"archive the discussion": func() error { return f.flow.Archive(t.Context(), id) },
		"delete the discussion":  func() error { return f.flow.Delete(t.Context(), id) },
	}
	for name, action := range actions {
		if err := action(); !errors.Is(err, discussionflow.ErrPublishing) {
			t.Errorf("%s while the publication is under way: got %v, want %v",
				name, err, discussionflow.ErrPublishing)
		}
	}

	release()
	f.waitPublished(id, "invoice-report")
}

func TestDiscardingEveryDraftBringsTheDiscussionBackToTheConversation(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, draftsArtifact)

	for _, draftID := range []string{"invoices-epic", "export-invoices", "invoice-schema"} {
		f.decide(id, draftID, discussion.DecisionDiscarded)
	}

	if state := f.state(id); state.Status != discussionflow.StatusDiscussing {
		t.Errorf("the discussion is %s, want %s", state.Status, discussionflow.StatusDiscussing)
	}
}

func TestEditingADraftOfAnArchivedDiscussionIsRefused(t *testing.T) {
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

	err := f.flow.SetDraftText(t.Context(), id, "export-invoices", "Another title", "Another body")
	if !errors.Is(err, discussion.ErrArchived) {
		t.Fatalf("set the text of a draft: got %v, want %v", err, discussion.ErrArchived)
	}
}

func TestGroupingCardsIntoAnEpicPointsThemAtIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, draftsArtifact)

	epic, err := f.flow.GroupIntoEpic(t.Context(), id, []string{"export-invoices", "invoice-schema"})
	if err != nil {
		t.Fatalf("group into epic: %v", err)
	}

	if epic.Kind != discussion.KindEpic || epic.Source != discussion.SourceUser {
		t.Errorf("the epic is %s of %s, want an epic of the user", epic.Kind, epic.Source)
	}
	for _, draftID := range []string{"export-invoices", "invoice-schema"} {
		if got := f.draftState(id, draftID).Draft.Epic; got != epic.ID {
			t.Errorf("the epic of %s is %q, want %s", draftID, got, epic.ID)
		}
	}
	if hint := f.draftState(id, epic.ID).Hint; hint != "An epic needs at least two cards." {
		t.Errorf("the epic of undecided cards says %q", hint)
	}
}

func TestAnEpicSaysWhatIsMissingBeforeItCanBePublished(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, epicArtifact)

	if got := f.draftState(id, "invoices-epic"); got.CanPublish || got.Hint != "An epic needs at least two cards." {
		t.Errorf("the epic of undecided cards says %q and can publish: %t", got.Hint, got.CanPublish)
	}

	f.decide(id, "invoice-schema", discussion.DecisionApproved)
	f.decide(id, "export-invoices", discussion.DecisionApproved)
	if got := f.draftState(id, "invoices-epic"); got.CanPublish || got.Hint != "Approve the epic." {
		t.Errorf("the epic of approved cards says %q and can publish: %t", got.Hint, got.CanPublish)
	}

	f.decide(id, "invoices-epic", discussion.DecisionApproved)
	if got := f.draftState(id, "invoices-epic"); !got.CanPublish || got.Hint != "" {
		t.Errorf("the epic says %q and can publish: %t, want it ready", got.Hint, got.CanPublish)
	}
}

func TestAnEpicWhoseCardDependsOnAnIssueThatExistsIsReady(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, epicArtifact)

	f.decide(id, "invoices-epic", discussion.DecisionApproved)
	f.decide(id, "invoice-schema", discussion.DecisionApproved)
	f.decide(id, "export-invoices", discussion.DecisionApproved)
	if err := f.flow.AddDraftDependency(t.Context(), id, "export-invoices", "acme/api#7"); err != nil {
		t.Fatalf("add dependency: %v", err)
	}

	if got := f.draftState(id, "invoices-epic"); !got.CanPublish {
		t.Errorf("an epic whose card depends on an issue that exists says %q, want it ready", got.Hint)
	}
}

func TestAnEpicWaitsForACardOutsideItThatIsStillToDecide(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, outsideArtifact)

	f.decide(id, "invoices-epic", discussion.DecisionApproved)
	f.decide(id, "invoice-schema", discussion.DecisionApproved)
	f.decide(id, "export-invoices", discussion.DecisionApproved)

	if got := f.draftState(id, "invoices-epic"); got.CanPublish || got.Hint != "Waits for Invoice report" {
		t.Errorf("the epic says %q and can publish: %t, want it waiting", got.Hint, got.CanPublish)
	}

	f.decide(id, "invoice-report", discussion.DecisionDiscarded)
	if got := f.draftState(id, "invoices-epic"); !got.CanPublish {
		t.Errorf("the epic says %q after the card it waited for was discarded, want it ready", got.Hint)
	}
}

func TestAnEpicWithACardStillToDecideAsksForEveryCardToBeDecided(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, outsideArtifact)
	if err := f.flow.SetDraftEpic(t.Context(), id, "invoice-report", "invoices-epic"); err != nil {
		t.Fatalf("set the epic of a draft: %v", err)
	}

	f.decide(id, "invoices-epic", discussion.DecisionApproved)
	f.decide(id, "invoice-schema", discussion.DecisionApproved)
	f.decide(id, "export-invoices", discussion.DecisionApproved)

	if got := f.draftState(id, "invoices-epic"); got.CanPublish ||
		got.Hint != "Approve or discard every card of the epic." {
		t.Errorf("the epic says %q and can publish: %t", got.Hint, got.CanPublish)
	}
}

func TestACardWaitsForTheDraftItDependsOn(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, draftsArtifact)

	f.decide(id, "export-invoices", discussion.DecisionApproved)

	if got := f.draftState(id, "export-invoices").Waits; got != "Invoice schema" {
		t.Errorf("the card waits for %q, want the draft it depends on", got)
	}

	f.decide(id, "invoice-schema", discussion.DecisionDiscarded)
	if got := f.draftState(id, "export-invoices").Waits; got != "" {
		t.Errorf("the card still waits for %q after the draft was discarded", got)
	}
}

func TestACardOfADiscardedEpicSaysThatItGoesNowhere(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, epicArtifact)

	f.decide(id, "invoices-epic", discussion.DecisionDiscarded)

	if got := f.draftState(id, "export-invoices").Hint; got != "The epic is discarded." {
		t.Errorf("the card of a discarded epic says %q", got)
	}
}

func TestAPublishedDraftLeavesTheDiscussionPublished(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, draftsArtifact)

	f.decide(id, "invoices-epic", discussion.DecisionDiscarded)
	f.decide(id, "invoice-schema", discussion.DecisionDiscarded)
	f.decide(id, "export-invoices", discussion.DecisionApproved)
	f.publish(id, "export-invoices")

	if state := f.state(id); state.Status != discussionflow.StatusPublished {
		t.Errorf("the discussion is %s, want %s", state.Status, discussionflow.StatusPublished)
	}
}

func TestAFailedPublicationLeavesTheDiscussionSayingSo(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, draftsArtifact)

	f.decide(id, "export-invoices", discussion.DecisionApproved)
	if err := f.discussions.SetPublishError(t.Context(), id, "export-invoices", "Couldn't write to GitHub."); err != nil {
		t.Fatalf("set the publish error: %v", err)
	}

	state := f.state(id)
	if state.Status != discussionflow.StatusPublishFailed {
		t.Errorf("the discussion is %s, want %s", state.Status, discussionflow.StatusPublishFailed)
	}
	if diff := cmp.Diff("A publication failed.", state.ArchiveHint); diff != "" {
		t.Errorf("the discussion says the wrong reason not to archive (-want +got):\n%s", diff)
	}
}

// publish records a draft as published, which is what a run of a publication
// leaves behind.
func (f *fixture) publish(id, draftID string) {
	f.t.Helper()

	err := f.discussions.RecordPublication(f.t.Context(), id, draftID, func(d *discussion.Draft) {
		d.Published = discussion.Publication{
			Outcome: discussion.OutcomeCreated, Number: 40, URL: "https://github.com/acme/web/issues/40",
			NodeID: "I_40", ItemID: "PVTI_40", At: base.Add(time.Minute),
		}
	})
	if err != nil {
		f.t.Fatalf("record the publication of %s: %v", draftID, err)
	}
}
