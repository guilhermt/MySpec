package discussionflow_test

import (
	"errors"
	"slices"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/discussion"
)

// errGitHub is what the fake gh answers with when a test asks it to refuse a
// write.
var errGitHub = errors.New("gh: the server said no")

func TestApprovingACardRewritesTheIssueAndPutsItOnTheBoard(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, draftsArtifact)

	f.approve(id, "invoice-schema")

	draft := f.waitPublished(id, "invoice-schema")
	if draft.Published.Outcome != discussion.OutcomeUpdated || draft.Published.Number != 12 {
		t.Errorf("the draft was published as %s of %d, want an update of the card",
			draft.Published.Outcome, draft.Published.Number)
	}
	want := []string{"updateIssue:I_acme/web#12", "addProjectItem:PVT_1:I_acme/web#12"}
	if diff := cmp.Diff(want, f.gh.made()); diff != "" {
		t.Errorf("the publication wrote the wrong things (-want +got):\n%s", diff)
	}
	if f.boards.refreshed() == 0 {
		t.Errorf("the board was not read again after the publication")
	}
}

func TestACardIsPublishedOnlyAfterTheDraftItDependsOn(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, draftsArtifact)

	f.approve(id, "export-invoices")
	if got := f.draftState(id, "export-invoices"); got.Waits != "Invoice schema" {
		t.Fatalf("the card waits for %q, want the draft it depends on", got.Waits)
	}
	if calls := f.gh.made(); len(calls) != 0 {
		t.Fatalf("a card that waits was published anyway: %v", calls)
	}

	f.approve(id, "invoice-schema")

	f.waitPublished(id, "invoice-schema")
	card := f.waitPublished(id, "export-invoices")
	want := []string{
		"updateIssue:I_acme/web#12",
		"addProjectItem:PVT_1:I_acme/web#12",
		"createIssue:R_acme/web:Export invoices as CSV",
		"addProjectItem:PVT_1:I_Export invoices as CSV",
		"setField:PVTI_I_Export invoices as CSV:field-status:opt-todo",
		"setField:PVTI_I_Export invoices as CSV:field-module:opt-billing",
		"addBlockedBy:I_Export invoices as CSV:I_acme/web#12",
	}
	if diff := cmp.Diff(want, f.gh.made()); diff != "" {
		t.Errorf("the publications went in the wrong order (-want +got):\n%s", diff)
	}
	if len(card.Dependencies) != 1 || !card.Dependencies[0].Linked {
		t.Errorf("the dependency of the card was not recorded on GitHub: %v", card.Dependencies)
	}
}

func TestADependencyOnADiscardedDraftIsDroppedWithAWarning(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, draftsArtifact)

	f.approve(id, "export-invoices")
	f.decide(id, "invoice-schema", discussion.DecisionDiscarded)

	card := f.waitPublished(id, "export-invoices")
	if len(card.Dependencies) != 1 || card.Dependencies[0].Dropped != discussion.DropDiscarded {
		t.Fatalf("the dependency of the card is %v, want a discarded one", card.Dependencies)
	}
	want := []string{"The dependency on Invoice schema was discarded and dropped."}
	if diff := cmp.Diff(want, card.Warnings); diff != "" {
		t.Errorf("the card says the wrong thing about the dependency (-want +got):\n%s", diff)
	}
	if calls := f.gh.made(); slices.ContainsFunc(calls, func(c string) bool {
		return strings.HasPrefix(c, "addBlockedBy:")
	}) {
		t.Errorf("a discarded dependency was sent to GitHub anyway: %v", calls)
	}
}

func TestPublishingAnEpicCreatesItAndTheCardsUnderItInOrder(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, epicArtifact)

	for _, draftID := range []string{"invoices-epic", "invoice-schema", "export-invoices"} {
		f.approve(id, draftID)
	}
	if err := f.flow.PublishEpic(t.Context(), id, "invoices-epic"); err != nil {
		t.Fatalf("publish epic: %v", err)
	}

	for _, draftID := range []string{"invoices-epic", "invoice-schema", "export-invoices"} {
		f.waitPublished(id, draftID)
	}
	want := []string{
		"createIssue:R_acme/web:Invoices",
		"createIssue:R_acme/web:Invoice schema",
		"addSubIssue:I_Invoices:I_Invoice schema",
		"createIssue:R_acme/web:Export invoices as CSV",
		"addSubIssue:I_Invoices:I_Export invoices as CSV",
		"addBlockedBy:I_Export invoices as CSV:I_Invoice schema",
	}
	if diff := cmp.Diff(want, issueCalls(f.gh.made())); diff != "" {
		t.Errorf("the epic went to GitHub in the wrong order (-want +got):\n%s", diff)
	}
}

func TestAFailureInTheMiddleStopsTheRunAndARetryDoesNotCreateTwice(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, epicArtifact)
	f.gh.failCreate("Export invoices as CSV", errGitHub)

	for _, draftID := range []string{"invoices-epic", "invoice-schema", "export-invoices"} {
		f.approve(id, draftID)
	}
	if err := f.flow.PublishEpic(t.Context(), id, "invoices-epic"); err != nil {
		t.Fatalf("publish epic: %v", err)
	}

	failed := f.waitFailed(id, "export-invoices")
	if failed.PublishError != "Couldn't write to GitHub: gh: the server said no" {
		t.Errorf("the card says %q about the failure", failed.PublishError)
	}
	if !f.draftState(id, "invoices-epic").Draft.Published.Done() {
		t.Errorf("the epic written before the failure was not kept")
	}

	if err := f.flow.Retry(t.Context(), id, "invoices-epic"); err != nil {
		t.Fatalf("retry the epic: %v", err)
	}

	f.waitPublished(id, "export-invoices")
	for _, title := range []string{"Invoices", "Invoice schema", "Export invoices as CSV"} {
		if got := count(f.gh.made(), "createIssue:R_acme/web:"+title); got != 1 {
			t.Errorf("the issue %s was created %d times, want once", title, got)
		}
	}
	if got := f.draftState(id, "export-invoices").Draft.PublishError; got != "" {
		t.Errorf("the card still says %q after the retry", got)
	}
}

func TestRetryingTheCardThatFailedSendsTheEpicOfItAgain(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, epicArtifact)
	f.gh.failCreate("Export invoices as CSV", errGitHub)

	for _, draftID := range []string{"invoices-epic", "invoice-schema", "export-invoices"} {
		f.approve(id, draftID)
	}
	if err := f.flow.PublishEpic(t.Context(), id, "invoices-epic"); err != nil {
		t.Fatalf("publish epic: %v", err)
	}
	f.waitFailed(id, "export-invoices")

	if err := f.flow.Retry(t.Context(), id, "export-invoices"); err != nil {
		t.Fatalf("retry the card of the epic: %v", err)
	}

	card := f.waitPublished(id, "export-invoices")
	if !card.Published.ParentSet {
		t.Errorf("the card was published outside the epic it belongs to")
	}
	if got := count(f.gh.made(), "createIssue:R_acme/web:Invoice schema"); got != 1 {
		t.Errorf("the card published before the failure was created %d times, want once", got)
	}
}

func TestADependencyGitHubRefusesIsDroppedWithAWarning(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, draftsArtifact)
	f.gh.failBlockedBy(errGitHub)

	f.approve(id, "invoice-schema")
	f.waitPublished(id, "invoice-schema")
	f.approve(id, "export-invoices")

	card := f.waitPublished(id, "export-invoices")
	if len(card.Dependencies) != 1 || card.Dependencies[0].Dropped != discussion.DropUnavailable {
		t.Fatalf("the dependency of the card is %v, want an unavailable one", card.Dependencies)
	}
	detail := "Couldn't write to GitHub: gh: the server said no"
	if card.Dependencies[0].Detail != detail {
		t.Errorf("the dependency says %q about GitHub", card.Dependencies[0].Detail)
	}
	want := []string{"Couldn't record the dependency on invoice-schema: " + detail}
	if diff := cmp.Diff(want, card.Warnings); diff != "" {
		t.Errorf("the card says the wrong thing about the dependency (-want +got):\n%s", diff)
	}
	if card.PublishError != "" {
		t.Errorf("a dependency GitHub refused failed the whole card: %s", card.PublishError)
	}
}

// cycleArtifact holds an epic whose two cards depend on each other, which is a
// cycle the order of a run has to break.
const cycleArtifact = `---
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
- Depends on: export-invoices

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

func TestACycleIsBrokenByPositionAndTheDependencyItDropsIsAWarning(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, cycleArtifact)

	for _, draftID := range []string{"invoices-epic", "invoice-schema", "export-invoices"} {
		f.approve(id, draftID)
	}
	if err := f.flow.PublishEpic(t.Context(), id, "invoices-epic"); err != nil {
		t.Fatalf("publish epic: %v", err)
	}

	first := f.waitPublished(id, "invoice-schema")
	second := f.waitPublished(id, "export-invoices")
	if len(first.Dependencies) != 1 || first.Dependencies[0].Dropped != discussion.DropUnavailable {
		t.Fatalf("the dependency of the first card is %v, want an unavailable one", first.Dependencies)
	}
	if len(first.Warnings) != 1 || !strings.Contains(first.Warnings[0], "depend on each other") {
		t.Errorf("the first card says %v about the dependency it lost", first.Warnings)
	}
	if len(second.Dependencies) != 1 || !second.Dependencies[0].Linked {
		t.Errorf("the dependency of the second card is %v, want it recorded", second.Dependencies)
	}
}

// issueCalls are the writes of a run that are about issues, which is where the
// order of a publication is read.
func issueCalls(calls []string) []string {
	kept := make([]string, 0, len(calls))
	for _, call := range calls {
		if strings.HasPrefix(call, "addProjectItem:") || strings.HasPrefix(call, "setField:") {
			continue
		}
		kept = append(kept, call)
	}
	return kept
}

// count is how many times a call was made.
func count(calls []string, call string) int {
	total := 0
	for _, made := range calls {
		if made == call {
			total++
		}
	}
	return total
}
