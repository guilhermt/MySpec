package discussionflow_test

import (
	"errors"
	"strings"
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

func TestACardThatLeavesAnEpicTakesBackTheApprovalOfTheEpicAndOfItself(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, wideEpicArtifact)
	// The approvals are quiet so that no run starts before the edit the test
	// asks for: with the evaluation, the last approval would publish the epic.
	f.approveQuietly(id, "invoices-epic", "invoice-schema", "export-invoices", "invoice-report")

	if err := f.flow.SetDraftEpic(t.Context(), id, "invoice-report", ""); err != nil {
		t.Fatalf("set the epic of a card: %v", err)
	}
	for _, draftID := range []string{"invoice-report", "invoices-epic"} {
		if got := f.draftState(id, draftID).Draft.Decision; got != discussion.DecisionNone {
			t.Errorf("decision of %s = %q, want it taken back", draftID, got)
		}
	}

	f.approve(id, "invoice-report")
	f.sessions.idle(id)
	f.flow.Check(id)
	f.waitPublished(id, "invoice-report")
	if f.draftState(id, "invoices-epic").Draft.Published.Started() {
		t.Errorf("the epic went to GitHub without the decision of the user")
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

func TestDiscardingEveryDraftLeavesTheDiscussionReadyToArchive(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, draftsArtifact)

	for _, draftID := range []string{"invoices-epic", "export-invoices", "invoice-schema"} {
		f.decide(id, draftID, discussion.DecisionDiscarded)
	}

	if state := f.state(id); state.Status != discussionflow.StatusReadyToArchive {
		t.Errorf("the discussion is %s, want %s", state.Status, discussionflow.StatusReadyToArchive)
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

	epic, err := f.flow.GroupIntoEpic(t.Context(), id, []string{"export-invoices", "invoice-schema"}, "Epic", "acme", "web")
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
	if hold := f.draftState(id, epic.ID).Hold; hold != (discussionflow.Hold{}) {
		t.Errorf("the epic of undecided cards is held by %+v, want nothing: it is not approved", hold)
	}
}

func TestAPublishedDraftLeavesTheDiscussionReadyToArchive(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, draftsArtifact)

	f.decide(id, "invoices-epic", discussion.DecisionDiscarded)
	f.decide(id, "invoice-schema", discussion.DecisionDiscarded)
	f.decide(id, "export-invoices", discussion.DecisionApproved)
	f.publish(id, "export-invoices")

	if state := f.state(id); state.Status != discussionflow.StatusReadyToArchive {
		t.Errorf("the discussion is %s, want %s", state.Status, discussionflow.StatusReadyToArchive)
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
	if diff := cmp.Diff("A publication failed: Retry it, or discard the draft.", state.ArchiveHint); diff != "" {
		t.Errorf("the discussion says the wrong reason not to archive (-want +got):\n%s", diff)
	}
}

func TestDiscardingADraftThatFailedBeforeWritingClearsItsFailureAndFreesItsDependent(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, draftsArtifact)
	f.approveQuietly(id, "invoice-schema", "export-invoices")
	err := f.discussions.SetPublishError(t.Context(), id, "invoice-schema", "Couldn't write to GitHub: boom")
	if err != nil {
		t.Fatalf("set the publish error: %v", err)
	}
	wantHold := discussionflow.Hold{Reason: discussionflow.HoldDraft, Title: "Invoice schema"}
	if got := f.draftState(id, "export-invoices").Hold; got != wantHold {
		t.Fatalf("the dependent is held by %+v, want %+v", got, wantHold)
	}

	f.decide(id, "invoice-schema", discussion.DecisionDiscarded)

	if got := f.draftState(id, "invoice-schema").Draft; got.PublishError != "" {
		t.Errorf("the discarded draft still says %q", got.PublishError)
	}
	f.waitPublished(id, "export-invoices")
}

func TestDecidingADraftThatFailedBeforeWritingClearsTheFailureOnlyMemoryHolds(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, looseArtifact)
	// GitHub refuses the issue, and the store refuses the write of the
	// failure: only memory holds it.
	f.gh.failCreate("Invoice report", errGitHub)
	f.store.failWrites(1, errStore, func(d discussion.Draft) bool { return d.PublishError != "" })
	f.approve(id, "invoice-report")
	f.waitFailed(id, "invoice-report")
	for _, d := range f.discussions.Drafts(id) {
		if d.PublishError != "" {
			t.Fatalf("the store holds the failure of %s: %q", d.ID, d.PublishError)
		}
	}

	f.decide(id, "invoice-report", discussion.DecisionDiscarded)

	state := f.state(id)
	if got := f.draftIn(state, "invoice-report"); got.PublishError != "" {
		t.Errorf("the discarded draft still says %q", got.PublishError)
	}
	if state.Status != discussionflow.StatusReadyToArchive {
		t.Errorf("the discussion is %s, want %s", state.Status, discussionflow.StatusReadyToArchive)
	}
}

func TestADraftMemoryHoldsAsStartedRefusesDecisionsAndEdits(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, looseCardsArtifact)
	f.store.failWrites(2, errStore, onTheIssue)
	f.approve(id, "invoice-report")
	f.waitFailed(id, "invoice-report")

	actions := map[string]struct {
		do   func() error
		want error
	}{
		"decide": {func() error {
			return f.flow.Decide(t.Context(), id, "invoice-report", discussion.DecisionDiscarded)
		}, discussion.ErrPublished},
		"edit the text": {func() error {
			return f.flow.SetDraftText(t.Context(), id, "invoice-report", "Another title", "Another body")
		}, discussion.ErrPublished},
		"group": {func() error {
			_, err := f.flow.GroupIntoEpic(t.Context(), id, []string{"invoice-report", "audit-log"}, "Epic", "acme", "web")
			return err
		}, discussion.ErrNotGroupable},
	}
	for name, action := range actions {
		if err := action.do(); !errors.Is(err, action.want) {
			t.Errorf("%s a draft memory holds as started: got %v, want %v", name, err, action.want)
		}
	}
}

func TestTheAgentRewritingADraftThatFailedBeforeWritingBringsItBackUndecided(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, looseArtifact)
	f.approveQuietly(id, "invoice-report")
	err := f.discussions.SetPublishError(t.Context(), id, "invoice-report", "Couldn't write to GitHub: boom")
	if err != nil {
		t.Fatalf("set the publish error: %v", err)
	}

	f.write(id, discussion.DraftsFile, strings.Replace(looseArtifact, "The report of the invoices.", "Another report.", 1))
	f.flow.Check(id)

	state := f.waitFor(id, func(s discussionflow.State) bool {
		return f.draftIn(s, "invoice-report").PublishError == ""
	})
	got := f.draftIn(state, "invoice-report")
	if got.Decision != discussion.DecisionNone {
		t.Errorf("the rewritten draft is %q, want it undecided", got.Decision)
	}
	if state.Status != discussionflow.StatusDeciding {
		t.Errorf("the discussion is %s, want %s", state.Status, discussionflow.StatusDeciding)
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
