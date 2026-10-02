package discussion_test

import (
	"slices"
	"strings"
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

	if changed := f.record(d.ID, twoDrafts).Changed; !changed {
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
		Round:              1,
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

	if changed := f.record(d.ID, twoDrafts).Changed; changed {
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
	if changed := f.record(d.ID, rewritten).Changed; !changed {
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
	if _, err := f.service.GroupIntoEpic(ctx, d.ID, []string{"one", "two"}, "Epic", "acme", "web"); err != nil {
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

func TestAPublishedDraftKeepsWhatItPointsAtWhenThatDraftLeaves(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()
	f.record(d.ID, artifactOf(
		draftOf("epic", "Kind: epic", "Repository: acme/web"),
		draftOf("one", "Kind: new", "Repository: acme/web", "Epic: epic", "Depends on: two"),
		draftOf("two", "Kind: new", "Repository: acme/web"),
	))

	if err := f.service.RecordPublication(t.Context(), d.ID, "one", func(draft *discussion.Draft) {
		draft.Published.Outcome, draft.Published.Number = discussion.OutcomeCreated, 31
	}); err != nil {
		t.Fatalf("record publication: %v", err)
	}

	f.record(d.ID, artifactOf(draftOf("one", "Kind: new", "Repository: acme/web", "Epic: epic", "Depends on: two")))

	got := f.draft(d.ID, "one")
	if got.Epic != "epic" || len(got.Dependencies) != 1 {
		t.Errorf("draft = %+v, want the published draft to keep what it points at", got)
	}
	if len(got.Warnings) != 0 {
		t.Errorf("warnings = %v, want none on a published draft", got.Warnings)
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
		"The dependency on two is no longer among the drafts.",
	}
	if diff := cmp.Diff(want, got.Warnings); diff != "" {
		t.Errorf("warnings (-want +got):\n%s", diff)
	}

	f.record(d.ID, artifactOf(draftOf("one", "Kind: new", "Repository: acme/web", "Epic: epic", "Depends on: two")))
	// The second reading replaces the draft, and the draft it points at is no
	// longer stored to be named.
	want = []string{
		"The epic Untitled draft is no longer among the drafts.",
		"The dependency on Untitled draft is no longer among the drafts.",
	}
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
	if _, err := f.service.GroupIntoEpic(ctx, d.ID, []string{"one", "two"}, "Epic", "acme", "web"); err != nil {
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

	if changed := f.record(d.ID, twoDrafts).Changed; changed {
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

	if changed := f.record(d.ID, "---\nstatus: none\n---\n").Changed; changed {
		t.Error("changed = true, want an empty artifact to add no draft")
	}

	stored, _ := f.service.Get(d.ID)
	if !stored.DraftsRead || stored.DraftsRevision != 0 {
		t.Errorf("read = %v, revision = %d, want the artifact read and no revision",
			stored.DraftsRead, stored.DraftsRevision)
	}
}

func TestAnUpdateDraftStoresWhatTheBoardKnowsAboutItsCard(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()
	f.recordValidated(d.ID, artifactOf(draftOf("one", "Kind: update", "Card: acme/api#12")))

	got := f.draft(d.ID, "one").Card
	want := &discussion.InputCard{Owner: "acme", Name: "api", Number: 12, Title: "Invoices", URL: cardURL}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("card (-want +got):\n%s", diff)
	}
}

func TestACardStoredWithoutItsTitleTakesTheOneTheBoardHas(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()
	drafts := artifactOf(draftOf("one", "Kind: update", "Card: acme/api#12"))

	f.record(d.ID, drafts)
	if got := f.draft(d.ID, "one").Card; got.Title != "" || got.URL != "" {
		t.Fatalf("card = %+v, want one stored before the board answered for it", got)
	}

	if changed := f.recordValidated(d.ID, drafts).Changed; !changed {
		t.Error("changed = false, want the card of the draft filled")
	}
	got := f.draft(d.ID, "one")
	if got.Card.Title != "Invoices" || got.Card.URL != cardURL {
		t.Errorf("card = %+v, want the title and the url of the board", got.Card)
	}
	if got.Revision != 1 {
		t.Errorf("revision = %d, want the draft left as the artifact has it", got.Revision)
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

	if changed := f.record(d.ID, artifactOf(draftOf("one", "Kind: update", "Card: acme/api#13"))).Changed; !changed {
		t.Error("changed = false, want another card to change the draft")
	}
	got := f.draft(d.ID, "one")
	if got.Card.Number != 13 || got.Revision != 2 {
		t.Errorf("draft = %+v, want the new card and a revision", got)
	}
}

func TestARewriteThatMovesAKeptDraftTakesBackItsApproval(t *testing.T) {
	t.Parallel()

	epic := draftOf("epic", "Kind: epic", "Repository: acme/web")
	one := draftOf("one", "Kind: new", "Repository: acme/web", "Epic: epic")
	two := draftOf("two", "Kind: new", "Repository: acme/web", "Epic: epic")
	three := draftOf("three", "Kind: new", "Repository: acme/web", "Epic: epic")
	dependent := draftOf("dependent", "Kind: new", "Repository: acme/web", "Depends on: one")
	original := artifactOf(epic, one, two, dependent)

	cases := []struct {
		name      string
		rewrite   string
		undecided []string
		failed    string // a draft with a failure standing before the rewrite
	}{
		{"the epic of a card leaves", artifactOf(one, two, dependent), []string{"one", "two"}, ""},
		{"the dependency of a draft leaves", artifactOf(epic, two, dependent), []string{"dependent", "epic"}, ""},
		{"a card of the epic leaves the artifact", artifactOf(epic, one, dependent), []string{"epic"}, ""},
		{"a new card enters the epic", artifactOf(epic, one, two, dependent, three), []string{"epic"}, ""},
		{"nothing moves", original, nil, ""},
		{"a draft with a failure loses its epic", artifactOf(one, two, dependent), []string{"one", "two"}, "one"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			d := f.create()
			f.record(d.ID, original)
			ids := []string{"epic", "one", "two", "dependent"}
			f.approve(d.ID, ids...)
			if c.failed != "" {
				if err := f.service.SetPublishError(t.Context(), d.ID, c.failed, "GitHub said no."); err != nil {
					t.Fatalf("set publish error: %v", err)
				}
			}

			f.record(d.ID, c.rewrite)

			for _, id := range ids {
				got, ok := f.find(d.ID, id)
				if !ok {
					continue
				}
				want := discussion.DecisionApproved
				if slices.Contains(c.undecided, id) {
					want = discussion.DecisionNone
				}
				if got.Decision != want {
					t.Errorf("decision of %s = %q, want %q", id, got.Decision, want)
				}
				if want == discussion.DecisionNone && got.PublishError != "" {
					t.Errorf("failure of %s = %q, want it cleared", id, got.PublishError)
				}
			}
		})
	}
}

// find is one draft of a discussion by id, when it is still there.
func (f *fixture) find(id, draftID string) (discussion.Draft, bool) {
	for _, d := range f.service.Drafts(id) {
		if d.ID == draftID {
			return d, true
		}
	}
	return discussion.Draft{}, false
}

// plain is the artifact of independent new cards, one per id.
func plain(ids ...string) string {
	drafts := make([]string, 0, len(ids))
	for _, id := range ids {
		drafts = append(drafts, draftOf(id, "Kind: new", "Repository: acme/web"))
	}
	return artifactOf(drafts...)
}

// withBody rewrites the body of one draft of an artifact.
func withBody(artifact, id, body string) string {
	return strings.Replace(artifact, "The body of "+id+".", body, 1)
}

// withTitle rewrites the title of one draft of an artifact.
func withTitle(artifact, id, title string) string {
	return strings.Replace(artifact, "### Title\n"+id+"\n", "### Title\n"+title+"\n", 1)
}

func TestAReadingPutsEachDraftInItsRound(t *testing.T) {
	t.Parallel()

	publishOneDiscardTwo := func(f *fixture, id string) {
		f.publish(id, "one")
		f.decide(id, "two", discussion.DecisionDiscarded)
	}
	cases := []struct {
		name        string
		first, then string
		settle      func(f *fixture, id string)
		want        map[string]int
	}{
		{
			name:  "the first reading",
			first: plain("one", "two"),
			want:  map[string]int{"one": 1, "two": 1},
		},
		{
			name:   "a revision of a round that is partly published",
			first:  plain("one", "two"),
			settle: func(f *fixture, id string) { f.publish(id, "one") },
			then:   withBody(plain("one", "two"), "two", "Another body."),
			want:   map[string]int{"one": 1, "two": 1},
		},
		{
			name:   "a closed round and a new id",
			first:  plain("one", "two"),
			settle: publishOneDiscardTwo,
			then:   plain("one", "two", "three"),
			want:   map[string]int{"one": 1, "two": 1, "three": 2},
		},
		{
			name:   "a discarded draft of a closed round that the artifact no longer has",
			first:  plain("one", "two"),
			settle: publishOneDiscardTwo,
			then:   plain("one", "three"),
			want:   map[string]int{"one": 1, "two": 1, "three": 2},
		},
		{
			name:   "an id reused with another content",
			first:  plain("one", "two"),
			settle: publishOneDiscardTwo,
			then:   withBody(plain("one", "two"), "two", "Another body."),
			want:   map[string]int{"one": 1, "two": 2},
		},
		{
			name:   "an id reused the same",
			first:  plain("one", "two"),
			settle: publishOneDiscardTwo,
			then:   plain("one", "two"),
			want:   map[string]int{"one": 1, "two": 1},
		},
		{
			name:  "everything discarded and a new reading",
			first: plain("one", "two"),
			settle: func(f *fixture, id string) {
				f.decide(id, "one", discussion.DecisionDiscarded)
				f.decide(id, "two", discussion.DecisionDiscarded)
			},
			then: plain("three"),
			want: map[string]int{"one": 1, "two": 1, "three": 2},
		},
		{
			name:  "a reading that changes nothing after the round closed",
			first: plain("one", "two"),
			settle: func(f *fixture, id string) {
				f.publish(id, "one", "two")
			},
			then: plain("one", "two"),
			want: map[string]int{"one": 1, "two": 1},
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			d := f.create()
			f.record(d.ID, c.first)
			if c.settle != nil {
				c.settle(f, d.ID)
			}
			if c.then != "" {
				f.record(d.ID, c.then)
			}

			got := map[string]int{}
			for _, draft := range f.service.Drafts(d.ID) {
				got[draft.ID] = draft.Round
			}
			if diff := cmp.Diff(c.want, got); diff != "" {
				t.Errorf("rounds (-want +got):\n%s", diff)
			}
		})
	}
}

func TestARevisionSaysWhatChangedInEachDraft(t *testing.T) {
	t.Parallel()

	epicAndCards := artifactOf(
		draftOf("epic", "Kind: epic", "Repository: acme/web"),
		draftOf("one", "Kind: new", "Repository: acme/web", "Epic: epic"),
		draftOf("two", "Kind: new", "Repository: acme/web", "Epic: epic"),
	)
	cases := []struct {
		name         string
		first        string
		approve      []string
		then         string
		want         discussion.Recorded
		revised      []string // the drafts that carry the mark of the reading
		approvalLost []string // the drafts whose approval a reading cleared
	}{
		{
			name:  "a title that changed",
			first: plain("one", "two"),
			then:  withTitle(plain("one", "two"), "one", "Uno"),
			want: discussion.Recorded{
				Changed: true, Round: 1, Drafts: 2, Replaced: 1,
				Before: []discussion.BeforeDraft{
					{Title: "one", Kind: discussion.KindNew, Changes: []string{"title"}},
					{Title: "two", Kind: discussion.KindNew},
				},
			},
			revised: []string{"one"},
		},
		{
			name:  "a draft added and a draft taken out",
			first: plain("one", "two"),
			then:  plain("one", "three"),
			want: discussion.Recorded{
				Changed: true, Round: 1, Drafts: 2, Added: 1, Dropped: 1,
				Before: []discussion.BeforeDraft{
					{Title: "one", Kind: discussion.KindNew},
					{Title: "two", Kind: discussion.KindNew, Dropped: true},
					{Title: "three", Kind: discussion.KindNew, Added: true},
				},
			},
		},
		{
			name:    "an approved draft that was replaced",
			first:   plain("one", "two"),
			approve: []string{"one"},
			then:    withBody(plain("one", "two"), "one", "Another body."),
			want: discussion.Recorded{
				Changed: true, Round: 1, Drafts: 2, Replaced: 1,
				Before: []discussion.BeforeDraft{
					{
						Title: "one", Kind: discussion.KindNew, Decision: discussion.DecisionApproved,
						Changes: []string{"body"}, ApprovalCleared: true,
					},
					{Title: "two", Kind: discussion.KindNew},
				},
			},
			revised:      []string{"one"},
			approvalLost: []string{"one"},
		},
		{
			name: "an epic the reading took out of an approved card it kept",
			first: artifactOf(
				draftOf("epic", "Kind: epic", "Repository: acme/web"),
				draftOf("one", "Kind: new", "Repository: acme/web", "Epic: epic"),
			),
			approve: []string{"one"},
			then:    artifactOf(draftOf("one", "Kind: new", "Repository: acme/web", "Epic: epic")),
			want: discussion.Recorded{
				Changed: true, Round: 1, Drafts: 1, Replaced: 1, Dropped: 1,
				Before: []discussion.BeforeDraft{
					{Title: "epic", Kind: discussion.KindEpic, Dropped: true},
					{
						Title: "one", Kind: discussion.KindNew, Decision: discussion.DecisionApproved,
						Changes: []string{"epic"}, ApprovalCleared: true,
					},
				},
			},
			revised:      []string{"one"},
			approvalLost: []string{"one"},
		},
		{
			name: "a dependency the reading took out of an approved card it kept",
			first: artifactOf(
				draftOf("one", "Kind: new", "Repository: acme/web", "Depends on: two"),
				draftOf("two", "Kind: new", "Repository: acme/web"),
			),
			approve: []string{"one"},
			then:    artifactOf(draftOf("one", "Kind: new", "Repository: acme/web", "Depends on: two")),
			want: discussion.Recorded{
				Changed: true, Round: 1, Drafts: 1, Replaced: 1, Dropped: 1,
				Before: []discussion.BeforeDraft{
					{
						Title: "one", Kind: discussion.KindNew, Decision: discussion.DecisionApproved,
						Changes: []string{"dependencies"}, ApprovalCleared: true,
					},
					{Title: "two", Kind: discussion.KindNew, Dropped: true},
				},
			},
			revised:      []string{"one"},
			approvalLost: []string{"one"},
		},
		{
			name:    "an epic that kept its place and lost a card",
			first:   epicAndCards,
			approve: []string{"epic"},
			then: artifactOf(
				draftOf("epic", "Kind: epic", "Repository: acme/web"),
				draftOf("one", "Kind: new", "Repository: acme/web", "Epic: epic"),
				draftOf("two", "Kind: new", "Repository: acme/web"),
			),
			want: discussion.Recorded{
				Changed: true, Round: 1, Drafts: 3, Replaced: 2,
				Before: []discussion.BeforeDraft{
					{
						Title: "epic", Kind: discussion.KindEpic, Decision: discussion.DecisionApproved,
						Changes: []string{"cards"}, ApprovalCleared: true,
					},
					{Title: "one", Kind: discussion.KindNew},
					{Title: "two", Kind: discussion.KindNew, Changes: []string{"epic"}},
				},
			},
			revised:      []string{"epic", "two"},
			approvalLost: []string{"epic"},
		},
		{
			name:  "a reading that changes nothing",
			first: plain("one", "two"),
			then:  plain("one", "two"),
			want:  discussion.Recorded{Round: 1},
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			d := f.create()
			f.record(d.ID, c.first)
			f.approve(d.ID, c.approve...)

			got := f.record(d.ID, c.then)

			if diff := cmp.Diff(c.want, got); diff != "" {
				t.Errorf("Recorded (-want +got):\n%s", diff)
			}
			stored, _ := f.service.Get(d.ID)
			for _, draft := range f.service.Drafts(d.ID) {
				if got := draft.RevisedReading == stored.DraftsRevision && draft.RevisedReading > 0; got != slices.Contains(c.revised, draft.ID) {
					t.Errorf("%s revised = %v, want %v", draft.ID, got, !got)
				}
				if got := draft.ApprovalCleared; got != slices.Contains(c.approvalLost, draft.ID) {
					t.Errorf("%s approval cleared = %v, want %v", draft.ID, got, !got)
				}
			}
		})
	}
}

func TestTheFirstReadingOfARoundIsFirst(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()

	first := f.record(d.ID, plain("one", "two"))
	if !first.First || first.Round != 1 || first.Drafts != 2 || first.Before != nil {
		t.Errorf("first reading = %+v, want the first of round 1 with two drafts and nothing before", first)
	}

	revision := f.record(d.ID, withBody(plain("one", "two"), "one", "Another body."))
	if revision.First {
		t.Errorf("revision = %+v, want it not to be the first reading", revision)
	}

	f.publish(d.ID, "one", "two")
	next := f.record(d.ID, plain("one", "two", "three"))
	if !next.First || next.Round != 2 || next.Drafts != 1 {
		t.Errorf("reading that opens the next round = %+v, want the first of round 2 with one draft", next)
	}
}
