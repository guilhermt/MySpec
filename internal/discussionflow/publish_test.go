package discussionflow_test

import (
	"errors"
	"slices"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/discussionflow"
)

// errGitHub is what the fake gh answers with when a test asks it to refuse a
// write.
var errGitHub = errors.New("gh: the server said no")

// errStore is what the fake store answers with when a test asks it to refuse
// a write of a draft.
var errStore = errors.New("store: the write did not happen")

// looseArtifact holds a single card of its own, which one approval sends to
// GitHub.
const looseArtifact = `---
status: drafts
---

## Draft: invoice-report
- Kind: new
- Repository: acme/api

### Title
Invoice report

### Body
The report of the invoices.
`

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

func TestAStepTheStoreDidNotRecordIsKeptWithItsErrorAndARetryTakesTheRunUp(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, looseArtifact)
	f.store.failWrites(1, errStore, onTheIssue)

	f.approve(id, "invoice-report")

	failed := f.waitFailed(id, "invoice-report")
	if failed.PublishError != "Couldn't record the publication: store: the write did not happen" {
		t.Errorf("the card says %q about the publication the store did not take", failed.PublishError)
	}
	if failed.Published.Outcome != discussion.OutcomeCreated || failed.Published.NodeID == "" {
		t.Fatalf("the issue GitHub created was not kept with the error: %+v", failed.Published)
	}

	if err := f.flow.Retry(t.Context(), id, "invoice-report"); err != nil {
		t.Fatalf("retry the card: %v", err)
	}

	f.waitPublished(id, "invoice-report")
	if got := count(f.gh.made(), "createIssue:R_acme/api:Invoice report"); got != 1 {
		t.Errorf("the issue was created %d times, want once", got)
	}
	if !slices.Contains(f.gh.made(), "addProjectItem:PVT_1:I_Invoice report") {
		t.Errorf("the retry did not take the run up at the step after the issue: %v", f.gh.made())
	}
}

func TestAPublicationNoWriteHeldIsRetriedIntoTheStoreBeforeItGoesOn(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, looseArtifact)
	f.store.failWrites(2, errStore, onTheIssue)

	f.approve(id, "invoice-report")
	f.waitFor(id, func(s discussionflow.State) bool { return !s.Publishing && len(f.gh.made()) > 0 })

	card := f.draftState(id, "invoice-report").Draft
	if card.PublishError != "Couldn't record the publication: store: the write did not happen" {
		t.Fatalf("the card says %q about the publication no write held", card.PublishError)
	}
	if card.Published.NodeID == "" {
		t.Fatalf("the state forgot the issue GitHub created: %+v", card.Published)
	}

	// The card has a failure of its own, so no run takes it: an evaluation
	// that finds it writes nothing more for it.
	made := len(f.gh.made())
	f.write(id, discussion.DocumentFile, "# Invoices\n")
	f.flow.Check(id)
	f.waitFor(id, func(s discussionflow.State) bool { return s.HasDocument })
	if got := len(f.gh.made()); got != made {
		t.Errorf("the card was sent to GitHub again: %v", f.gh.made())
	}

	f.store.failWrites(1, errStore, onTheIssue)
	if err := f.flow.Retry(t.Context(), id, "invoice-report"); !errors.Is(err, errStore) {
		t.Fatalf("retry while the store still refuses: got %v, want %v", err, errStore)
	}
	if got := f.draftState(id, "invoice-report").Draft; got.Published.NodeID == "" || got.PublishError == "" {
		t.Fatalf("the retry that failed lost the publication: %+v", got.Published)
	}

	if err := f.flow.Retry(t.Context(), id, "invoice-report"); err != nil {
		t.Fatalf("retry the card: %v", err)
	}

	f.waitPublished(id, "invoice-report")
	if got := count(f.gh.made(), "createIssue:R_acme/api:Invoice report"); got != 1 {
		t.Errorf("the issue was created %d times, want once", got)
	}
}

func TestADependencyOnAPublicationOnlyMemoryHoldsIsRecordedAnyway(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, draftsArtifact)
	// GitHub took every step of the card the other one depends on: the write
	// that closes its publication and the write of the failure with it are the
	// ones the store refuses, so only memory knows it is published.
	f.store.failWrites(2, errStore, func(d discussion.Draft) bool { return !d.Published.At.IsZero() })

	f.approve(id, "invoice-schema")
	f.waitFailed(id, "invoice-schema")
	if got := f.draftState(id, "invoice-schema").Draft; !got.Published.Done() {
		t.Fatalf("the publication memory holds did not get to the end: %+v", got.Published)
	}

	f.approve(id, "export-invoices")

	card := f.waitPublished(id, "export-invoices")
	if len(card.Dependencies) != 1 || !card.Dependencies[0].Linked {
		t.Fatalf("the dependency of the card is %v, want it recorded on GitHub", card.Dependencies)
	}
	want := "addBlockedBy:I_Export invoices as CSV:I_acme/web#12"
	if !slices.Contains(f.gh.made(), want) {
		t.Errorf("the dependency of the card did not go to GitHub: %v", f.gh.made())
	}
	if len(card.Warnings) != 0 {
		t.Errorf("the card was warned about a dependency it kept: %v", card.Warnings)
	}
}

func TestADiscussionWhoseDraftNoWriteHeldCannotBeArchived(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, looseArtifact)
	f.store.failWrites(2, errStore, onTheIssue)

	f.approve(id, "invoice-report")

	state := f.waitFor(id, func(s discussionflow.State) bool {
		return s.Status == discussionflow.StatusPublishFailed
	})
	if state.CanArchive || state.ArchiveHint != "A publication failed." {
		t.Errorf("the discussion says %q about the archive and can be archived: %t",
			state.ArchiveHint, state.CanArchive)
	}
}

func TestOnlyTheDraftsOfTheRunUnderWaySayTheyArePublishing(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, wideEpicArtifact)
	if err := f.flow.SetDraftEpic(t.Context(), id, "invoice-report", ""); err != nil {
		t.Fatalf("take the card out of the epic: %v", err)
	}
	for _, draftID := range []string{"invoices-epic", "invoice-schema", "export-invoices"} {
		f.approve(id, draftID)
	}
	release := f.gh.holdCreate("Invoice report")
	t.Cleanup(release)

	f.approve(id, "invoice-report")
	// The discussion says it is publishing before the run reads its targets,
	// so the card the run writes is what says the run is under way.
	f.waitFor(id, func(s discussionflow.State) bool {
		return s.Publishing && f.draftStateIn(s, "invoice-report").Publishing
	})

	if epic := f.draftState(id, "invoices-epic"); epic.Publishing || !epic.CanPublish {
		t.Errorf("the epic nobody asked to publish says it is publishing: %t, ready: %t",
			epic.Publishing, epic.CanPublish)
	}
	for _, draftID := range []string{"invoice-schema", "export-invoices"} {
		if f.draftState(id, draftID).Publishing {
			t.Errorf("the card %s, outside the run, says it is publishing", draftID)
		}
	}

	release()
	f.waitPublished(id, "invoice-report")
}

func TestACardOfAnEpicAlreadyPublishedGoesOnItsOwnUnderIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, wideEpicArtifact)
	if err := f.flow.SetDraftEpic(t.Context(), id, "invoice-report", ""); err != nil {
		t.Fatalf("take the card out of the epic: %v", err)
	}
	for _, draftID := range []string{"invoices-epic", "invoice-schema", "export-invoices"} {
		f.approve(id, draftID)
	}
	if err := f.flow.PublishEpic(t.Context(), id, "invoices-epic"); err != nil {
		t.Fatalf("publish epic: %v", err)
	}
	epic := f.waitPublished(id, "invoices-epic")
	f.waitPublished(id, "export-invoices")

	if err := f.flow.SetDraftEpic(t.Context(), id, "invoice-report", "invoices-epic"); err != nil {
		t.Fatalf("move the card into the published epic: %v", err)
	}
	f.approve(id, "invoice-report")

	card := f.waitPublished(id, "invoice-report")
	if !card.Published.ParentSet {
		t.Errorf("the card was published outside the epic it belongs to")
	}
	want := "addSubIssue:" + epic.Published.NodeID + ":I_Invoice report"
	if !slices.Contains(f.gh.made(), want) {
		t.Errorf("the card did not become a sub-issue of the published epic: %v", f.gh.made())
	}
	if state := f.state(id); !state.CanArchive {
		t.Errorf("the discussion says %q and cannot be archived", state.ArchiveHint)
	}
}

func TestAModuleTheBoardNoLongerHasIsAWarningTheCardSaysOnce(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, strings.Replace(looseArtifact, "- Repository: acme/api", "- Repository: acme/api\n- Module: Billing", 1))
	f.boards.forgetModuleOption("Billing")
	// The last write of the publication is the one the store refuses, after
	// the module of the card was settled with its warning.
	f.store.failWrites(1, errStore, func(d discussion.Draft) bool { return d.Published.Done() })

	f.approve(id, "invoice-report")

	f.waitFailed(id, "invoice-report")
	if err := f.flow.Retry(t.Context(), id, "invoice-report"); err != nil {
		t.Fatalf("retry the card: %v", err)
	}

	card := f.waitPublished(id, "invoice-report")
	want := []string{"The module Billing is no longer an option of the board."}
	if diff := cmp.Diff(want, card.Warnings); diff != "" {
		t.Errorf("the card says the wrong thing about its module (-want +got):\n%s", diff)
	}
}

// onTheIssue says the write is the one that records the issue GitHub created
// for a draft, which a second run must never create again.
func onTheIssue(d discussion.Draft) bool { return d.Published.Outcome != "" }

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
