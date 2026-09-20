package discussion_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/discussion"
)

// twoDrafts is the artifact most reconciliation tests start from.
var twoDrafts = artifactOf(
	draftOf("one", "Kind: new", "Repository: acme/web", "Module: Billing", "Depends on: two"),
	draftOf("two", "Kind: new", "Repository: acme/web"),
)

func TestRecordingTheFirstArtifactStoresEveryDraftAsTheAgentWroteIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()

	if changed := f.record(d.ID, twoDrafts); !changed {
		t.Error("changed = false, want the first artifact to change the drafts")
	}

	got := f.draft(d.ID, "one")
	want := discussion.Draft{
		DiscussionID:       d.ID,
		ID:                 "one",
		Kind:               discussion.KindNew,
		Source:             discussion.SourceAgent,
		Owner:              "acme",
		Name:               "web",
		RepositoryOriginal: "acme/web",
		TitleOriginal:      "one",
		Title:              "one",
		BodyOriginal:       "The body of one.",
		Body:               "The body of one.",
		ModuleOriginal:     "Billing",
		Module:             "Billing",
		Dependencies:       []discussion.Dependency{{Ref: discussion.Ref{Draft: "two"}, Original: true}},
		Revision:           1,
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("draft (-want +got):\n%s", diff)
	}

	stored, ok := f.service.Get(d.ID)
	if !ok {
		t.Fatalf("discussion %s is gone", d.ID)
	}
	if !stored.DraftsRead || stored.DraftsRevision != 1 {
		t.Errorf("read = %v, revision = %d, want the first artifact read once", stored.DraftsRead, stored.DraftsRevision)
	}
}

func TestADraftTheAgentLeftAloneKeepsWhatTheUserEditedAndDecided(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()
	f.record(d.ID, twoDrafts)

	ctx := t.Context()
	if err := f.service.SetDraftText(ctx, d.ID, "one", "Mine", "My body."); err != nil {
		t.Fatalf("set text: %v", err)
	}
	if err := f.service.Decide(ctx, d.ID, "one", discussion.DecisionApproved); err != nil {
		t.Fatalf("decide: %v", err)
	}

	if changed := f.record(d.ID, twoDrafts); changed {
		t.Error("changed = true, want the same artifact to change nothing")
	}

	got := f.draft(d.ID, "one")
	if got.Title != "Mine" || got.Body != "My body." || got.Decision != discussion.DecisionApproved {
		t.Errorf("draft = %+v, want the edit and the decision kept", got)
	}
	if got.Revision != 1 {
		t.Errorf("revision = %d, want 1", got.Revision)
	}
}

func TestADraftTheAgentRewroteIsReplacedAndAsksToBeDecidedAgain(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()
	f.record(d.ID, twoDrafts)

	ctx := t.Context()
	if err := f.service.SetDraftText(ctx, d.ID, "one", "Mine", "My body."); err != nil {
		t.Fatalf("set text: %v", err)
	}
	if err := f.service.Decide(ctx, d.ID, "one", discussion.DecisionApproved); err != nil {
		t.Fatalf("decide: %v", err)
	}

	rewritten := artifactOf(
		draftOf("one", "Kind: new", "Repository: acme/api", "Module: Billing", "Depends on: two"),
		draftOf("two", "Kind: new", "Repository: acme/web"),
	)
	if changed := f.record(d.ID, rewritten); !changed {
		t.Error("changed = false, want a rewritten draft to change the drafts")
	}

	got := f.draft(d.ID, "one")
	if got.Title != "one" || got.Body != "The body of one." {
		t.Errorf("draft = %+v, want the text of the artifact", got)
	}
	if got.Decision != discussion.DecisionNone {
		t.Errorf("decision = %q, want the draft to be decided again", got.Decision)
	}
	if got.Revision != 2 || got.FullName() != "acme/api" {
		t.Errorf("revision = %d, repository = %s, want 2 and acme/api", got.Revision, got.FullName())
	}
}

func TestADraftThatLeftTheArtifactGoesUnlessTheUserOwnsItOrItWasPublished(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()
	f.record(d.ID, artifactOf(
		draftOf("one", "Kind: new", "Repository: acme/web"),
		draftOf("two", "Kind: new", "Repository: acme/web"),
		draftOf("three", "Kind: new", "Repository: acme/web"),
	))

	ctx := t.Context()
	if _, err := f.service.GroupIntoEpic(ctx, d.ID, []string{"one", "two"}); err != nil {
		t.Fatalf("group into epic: %v", err)
	}
	if err := f.service.RecordPublication(ctx, d.ID, "three", func(draft *discussion.Draft) {
		draft.Published.Outcome, draft.Published.Number = discussion.OutcomeCreated, 31
	}); err != nil {
		t.Fatalf("record publication: %v", err)
	}

	f.record(d.ID, artifactOf(draftOf("one", "Kind: new", "Repository: acme/web")))

	want := []string{"one", "three", "user-epic-1"}
	if diff := cmp.Diff(want, f.draftIDs(d.ID)); diff != "" {
		t.Errorf("drafts (-want +got):\n%s", diff)
	}
}

func TestAPublishedDraftKeepsEveryThingTheArtifactNowSaysOtherwise(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()
	f.record(d.ID, twoDrafts)

	ctx := t.Context()
	if err := f.service.RecordPublication(ctx, d.ID, "one", func(draft *discussion.Draft) {
		draft.Published.Outcome, draft.Published.Number = discussion.OutcomeCreated, 31
		draft.Decision = discussion.DecisionApproved
	}); err != nil {
		t.Fatalf("record publication: %v", err)
	}

	f.record(d.ID, artifactOf(
		draftOf("two", "Kind: new", "Repository: acme/web"),
		draftOf("one", "Kind: new", "Repository: acme/api", "Module: Reports"),
	))

	got := f.draft(d.ID, "one")
	if got.FullName() != "acme/web" || got.Module != "Billing" || got.Revision != 1 {
		t.Errorf("draft = %+v, want the published draft untouched", got)
	}
	if got.Position != 1 {
		t.Errorf("position = %d, want the order of the artifact", got.Position)
	}
}

func TestAReferenceToADraftThatLeftIsDroppedWithAWarning(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()
	f.record(d.ID, artifactOf(
		draftOf("epic", "Kind: epic", "Repository: acme/web"),
		draftOf("one", "Kind: new", "Repository: acme/web", "Epic: epic", "Depends on: two"),
		draftOf("two", "Kind: new", "Repository: acme/web"),
	))

	f.record(d.ID, artifactOf(draftOf("one", "Kind: new", "Repository: acme/web", "Epic: epic", "Depends on: two")))

	got := f.draft(d.ID, "one")
	if got.Epic != "" || len(got.Dependencies) != 0 {
		t.Errorf("draft = %+v, want the references dropped", got)
	}
	want := []string{
		"The epic epic is no longer among the drafts.",
		"The dependency two is no longer among the drafts.",
	}
	if diff := cmp.Diff(want, got.Warnings); diff != "" {
		t.Errorf("warnings (-want +got):\n%s", diff)
	}

	f.record(d.ID, artifactOf(draftOf("one", "Kind: new", "Repository: acme/web", "Epic: epic", "Depends on: two")))
	if diff := cmp.Diff(want, f.draft(d.ID, "one").Warnings); diff != "" {
		t.Errorf("warnings after a second reading (-want +got):\n%s", diff)
	}
}

func TestAnArtifactWithoutDraftsLeavesOnlyWhatTheUserOwns(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()
	f.record(d.ID, twoDrafts)

	ctx := t.Context()
	if _, err := f.service.GroupIntoEpic(ctx, d.ID, []string{"one", "two"}); err != nil {
		t.Fatalf("group into epic: %v", err)
	}

	f.record(d.ID, "---\nstatus: none\n---\n")

	if diff := cmp.Diff([]string{"user-epic-1"}, f.draftIDs(d.ID)); diff != "" {
		t.Errorf("drafts (-want +got):\n%s", diff)
	}
}

func TestReadingTheSameArtifactTwiceWritesTheDraftsOnlyOnce(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()

	f.record(d.ID, twoDrafts)
	writes := f.store.writes

	if changed := f.record(d.ID, twoDrafts); changed {
		t.Error("changed = true, want the same artifact to change nothing")
	}
	if f.store.writes != writes {
		t.Errorf("writes = %d, want the store left alone", f.store.writes-writes)
	}

	stored, _ := f.service.Get(d.ID)
	if stored.DraftsRevision != 1 {
		t.Errorf("revision = %d, want 1", stored.DraftsRevision)
	}
}

func TestAnArtifactWithoutDraftsIsReadEvenWhenItAddsNothing(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()

	if changed := f.record(d.ID, "---\nstatus: none\n---\n"); changed {
		t.Error("changed = true, want an empty artifact to add no draft")
	}

	stored, _ := f.service.Get(d.ID)
	if !stored.DraftsRead || stored.DraftsRevision != 0 {
		t.Errorf("read = %v, revision = %d, want the artifact read and no revision",
			stored.DraftsRead, stored.DraftsRevision)
	}
}

func TestAnUpdateThatPointsAtAnotherCardIsAnotherDraft(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()
	f.record(d.ID, artifactOf(draftOf("one", "Kind: update", "Card: acme/api#12")))
	if got := f.draft(d.ID, "one"); got.FullName() != "acme/api" || got.Card.Number != 12 {
		t.Fatalf("draft = %+v, want the card of the artifact", got)
	}

	if changed := f.record(d.ID, artifactOf(draftOf("one", "Kind: update", "Card: acme/api#13"))); !changed {
		t.Error("changed = false, want another card to change the draft")
	}
	got := f.draft(d.ID, "one")
	if got.Card.Number != 13 || got.Revision != 2 {
		t.Errorf("draft = %+v, want the new card and a revision", got)
	}
}
