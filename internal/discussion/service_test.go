package discussion_test

import (
	"errors"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/discussion"
)

func TestCreatingADiscussionWritesTheContextInItsOwnFolder(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()

	want := discussion.ArtifactsDir(f.dataDir, "acme", 7, d.ID)
	if d.ArtifactsDir != want {
		t.Errorf("artifacts directory = %q, want %q", d.ArtifactsDir, want)
	}
	content, err := os.ReadFile(d.ContextPath())
	if err != nil {
		t.Fatalf("read context: %v", err)
	}
	if string(content) != "# Invoices\n" {
		t.Errorf("context = %q, want the initial context", content)
	}

	if got := f.service.List(); len(got) != 1 || got[0].ID != d.ID {
		t.Errorf("list = %+v, want the discussion", got)
	}
	if f.changeCount() != 1 {
		t.Errorf("changes = %d, want one", f.changeCount())
	}
}

func TestCreatingADiscussionIsRefusedWithoutATitleOrSomethingToDiscuss(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name   string
		params discussion.CreateParams
		want   error
	}{
		{"without a title", discussion.CreateParams{Title: "  ", Text: "Something"}, discussion.ErrEmptyTitle},
		{
			"with a title longer than the longest",
			discussion.CreateParams{Title: strings.Repeat("a", discussion.TitleMaxLen+1), Text: "Something"},
			discussion.ErrTitleTooLong,
		},
		{"with nothing to discuss", discussion.CreateParams{Title: "Invoices"}, discussion.ErrNothingToDiscuss},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			if _, err := f.service.Create(t.Context(), c.params); !errors.Is(err, c.want) {
				t.Errorf("error = %v, want %v", err, c.want)
			}
		})
	}
}

func TestAFailedInsertTakesTheFolderWithIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.store.insertErr = os.ErrPermission

	if _, err := f.service.Create(t.Context(), discussion.CreateParams{
		BoardOwner: "acme", BoardNumber: 7, Title: "Invoices", Text: "Export invoices",
	}); !errors.Is(err, os.ErrPermission) {
		t.Fatalf("error = %v, want the error of the store", err)
	}

	entries, err := os.ReadDir(filepath.Join(f.dataDir, "discussions", "acme", "7"))
	if err == nil && len(entries) > 0 {
		t.Errorf("folders = %d, want none left behind", len(entries))
	}
}

func TestTheUserEditsADraftUntilItIsPublished(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()
	f.record(d.ID, artifactOf(
		draftOf("epic", "Kind: epic", "Repository: acme/web"),
		draftOf("one", "Kind: new", "Repository: acme/web"),
		draftOf("two", "Kind: update", "Card: acme/api#12"),
	))

	ctx := t.Context()
	if err := f.service.SetDraftText(ctx, d.ID, "one", " Mine ", " My body. "); err != nil {
		t.Fatalf("set text: %v", err)
	}
	if err := f.service.SetDraftRepository(ctx, d.ID, "one", "acme", "api"); err != nil {
		t.Fatalf("set repository: %v", err)
	}
	if err := f.service.SetDraftModule(ctx, d.ID, "one", "Billing"); err != nil {
		t.Fatalf("set module: %v", err)
	}
	if err := f.service.SetDraftEpic(ctx, d.ID, "one", "epic"); err != nil {
		t.Fatalf("set epic: %v", err)
	}
	if err := f.service.AddDraftDependency(ctx, d.ID, "one", "two"); err != nil {
		t.Fatalf("add dependency: %v", err)
	}
	if err := f.service.AddDraftDependency(ctx, d.ID, "one", "acme/api#42"); err != nil {
		t.Fatalf("add dependency: %v", err)
	}
	if err := f.service.RemoveDraftDependency(ctx, d.ID, "one", "acme/api#42"); err != nil {
		t.Fatalf("remove dependency: %v", err)
	}

	got := f.draft(d.ID, "one")
	if got.Title != "Mine" || got.Body != "My body." || got.FullName() != "acme/api" || got.Module != "Billing" {
		t.Errorf("draft = %+v, want what the user left", got)
	}
	if got.Epic != "epic" || got.InEpicDraft() != true || got.Loose() {
		t.Errorf("epic = %q, want the epic draft", got.Epic)
	}
	want := []discussion.Dependency{{Ref: discussion.Ref{Draft: "two"}}}
	if diff := cmp.Diff(want, got.Dependencies); diff != "" {
		t.Errorf("dependencies (-want +got):\n%s", diff)
	}

	if err := f.service.RecordPublication(ctx, d.ID, "one", func(draft *discussion.Draft) {
		draft.Published.Outcome, draft.Published.Number = discussion.OutcomeCreated, 31
	}); err != nil {
		t.Fatalf("record publication: %v", err)
	}
	if err := f.service.SetDraftText(ctx, d.ID, "one", "Other", "Other body."); !errors.Is(err, discussion.ErrPublished) {
		t.Errorf("error = %v, want ErrPublished", err)
	}
}

func TestAnEditIsRefusedWhenItDoesNotFitTheDraft(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()
	f.record(d.ID, artifactOf(
		draftOf("epic", "Kind: epic", "Repository: acme/web"),
		draftOf("one", "Kind: new", "Repository: acme/web"),
		draftOf("two", "Kind: update", "Card: acme/api#12"),
	))

	ctx := t.Context()
	cases := []struct {
		name string
		call func() error
		want error
	}{
		{
			"a blank title",
			func() error { return f.service.SetDraftText(ctx, d.ID, "one", " ", "Body.") },
			discussion.ErrEmptyText,
		},
		{
			"a blank body on a card",
			func() error { return f.service.SetDraftText(ctx, d.ID, "one", "Title", " ") },
			discussion.ErrEmptyText,
		},
		{
			"a blank body on an epic of the agent",
			func() error { return f.service.SetDraftText(ctx, d.ID, "epic", "Title", " ") },
			discussion.ErrEmptyText,
		},
		{
			"the repository of an update",
			func() error { return f.service.SetDraftRepository(ctx, d.ID, "two", "acme", "web") },
			discussion.ErrInvalidRef,
		},
		{
			"a module on an epic",
			func() error { return f.service.SetDraftModule(ctx, d.ID, "epic", "Billing") },
			discussion.ErrInvalidRef,
		},
		{
			"an epic that is a card",
			func() error { return f.service.SetDraftEpic(ctx, d.ID, "one", "two") },
			discussion.ErrNotEpic,
		},
		{
			"an epic that is no reference",
			func() error { return f.service.SetDraftEpic(ctx, d.ID, "one", "Not a ref") },
			discussion.ErrInvalidRef,
		},
		{
			"a dependency on itself",
			func() error { return f.service.AddDraftDependency(ctx, d.ID, "one", "one") },
			discussion.ErrInvalidRef,
		},
		{
			"a dependency that is an epic",
			func() error { return f.service.AddDraftDependency(ctx, d.ID, "one", "epic") },
			discussion.ErrInvalidRef,
		},
		{
			"a dependency the draft does not have",
			func() error { return f.service.RemoveDraftDependency(ctx, d.ID, "one", "acme/api#42") },
			discussion.ErrInvalidRef,
		},
		{
			"a draft that is not there",
			func() error { return f.service.Decide(ctx, d.ID, "missing", discussion.DecisionApproved) },
			discussion.ErrDraftNotFound,
		},
		{
			"a decision that is no decision",
			func() error { return f.service.Decide(ctx, d.ID, "one", discussion.Decision("maybe")) },
			discussion.ErrUnknownDecision,
		},
		{
			"a discussion that is not there",
			func() error { return f.service.Decide(ctx, "missing", "one", discussion.DecisionApproved) },
			discussion.ErrNotFound,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			if err := c.call(); !errors.Is(err, c.want) {
				t.Errorf("error = %v, want %v", err, c.want)
			}
		})
	}
}

func TestTheSameDependencyIsNeverAddedTwiceAndALinkedOneStays(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()
	f.record(d.ID, artifactOf(draftOf("one", "Kind: new", "Repository: acme/web", "Depends on: acme/api#42")))

	ctx := t.Context()
	if err := f.service.AddDraftDependency(ctx, d.ID, "one", "ACME/API#42"); !errors.Is(err, discussion.ErrInvalidRef) {
		t.Errorf("error = %v, want ErrInvalidRef", err)
	}

	if err := f.service.RecordPublication(ctx, d.ID, "one", func(draft *discussion.Draft) {
		draft.Dependencies[0].Linked = true
	}); err != nil {
		t.Fatalf("record publication: %v", err)
	}
	err := f.service.RemoveDraftDependency(ctx, d.ID, "one", "acme/api#42")
	if !errors.Is(err, discussion.ErrDependencyLinked) {
		t.Errorf("error = %v, want ErrDependencyLinked", err)
	}
}

func TestGroupingCardsIntoAnEpicPointsEveryOneOfThemAtIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()
	f.record(d.ID, artifactOf(
		draftOf("one", "Kind: new", "Repository: acme/api"),
		draftOf("two", "Kind: new", "Repository: acme/web"),
		draftOf("three", "Kind: new", "Repository: acme/web"),
		draftOf("four", "Kind: new", "Repository: acme/web"),
		draftOf("five", "Kind: new", "Repository: acme/web"),
	))

	epic, err := f.service.GroupIntoEpic(t.Context(), d.ID, []string{"one", "two", "three"}, "  Billing  ", "acme", "ios")
	if err != nil {
		t.Fatalf("group into epic: %v", err)
	}

	if epic.ID != "user-epic-1" || epic.Source != discussion.SourceUser || epic.Kind != discussion.KindEpic {
		t.Errorf("epic = %+v, want an epic of the user", epic)
	}
	if epic.FullName() != "acme/ios" {
		t.Errorf("repository = %s, want the one the user chose", epic.FullName())
	}
	if epic.Title != "Billing" || epic.Body != "" || epic.Round != 1 {
		t.Errorf("epic = %+v, want the title of the user, no body and the current round", epic)
	}
	if got := f.draft(d.ID, epic.ID); got.Title != "Billing" || got.TitleOriginal != "" {
		t.Errorf("stored epic = %+v, want the title as the user left it", got)
	}
	for _, id := range []string{"one", "two", "three"} {
		if got := f.draft(d.ID, id); got.Epic != epic.ID {
			t.Errorf("epic of %s = %q, want %q", id, got.Epic, epic.ID)
		}
	}

	second, err := f.service.GroupIntoEpic(t.Context(), d.ID, []string{"four", "five"}, "Second", "acme", "web")
	if err != nil {
		t.Fatalf("group into epic: %v", err)
	}
	if second.ID != "user-epic-2" {
		t.Errorf("id = %q, want the next epic of the user", second.ID)
	}
}

func TestGroupingIsRefusedWithoutTwoCardsThatCanStillMove(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()
	f.record(d.ID, artifactOf(
		draftOf("epic", "Kind: epic", "Repository: acme/web"),
		draftOf("one", "Kind: new", "Repository: acme/web"),
		draftOf("two", "Kind: new", "Repository: acme/web"),
	))

	ctx := t.Context()
	if _, err := f.service.GroupIntoEpic(ctx, d.ID, []string{"one", "one"}, "Epic", "acme", "web"); !errors.Is(err, discussion.ErrTooFewCards) {
		t.Errorf("error = %v, want ErrTooFewCards", err)
	}
	if _, err := f.service.GroupIntoEpic(ctx, d.ID, []string{"one", "epic"}, "Epic", "acme", "web"); !errors.Is(err, discussion.ErrDraftNotFound) {
		t.Errorf("error = %v, want ErrDraftNotFound", err)
	}

	if err := f.service.RecordPublication(ctx, d.ID, "one", func(draft *discussion.Draft) {
		draft.Published.Outcome = discussion.OutcomeCreated
	}); err != nil {
		t.Fatalf("record publication: %v", err)
	}
	if _, err := f.service.GroupIntoEpic(ctx, d.ID, []string{"one", "two"}, "Epic", "acme", "web"); !errors.Is(err, discussion.ErrNotGroupable) {
		t.Errorf("error = %v, want ErrNotGroupable", err)
	}
}

func TestGroupingNeedsATitleOfAtMostTheLimit(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()
	f.record(d.ID, twoDrafts)
	ctx := t.Context()

	cards := []string{"one", "two"}
	if _, err := f.service.GroupIntoEpic(ctx, d.ID, cards, "  ", "acme", "web"); !errors.Is(err, discussion.ErrEpicUntitled) {
		t.Errorf("blank title = %v, want ErrEpicUntitled", err)
	}
	if _, err := f.service.GroupIntoEpic(ctx, d.ID, cards, strings.Repeat("é", discussion.EpicTitleMaxLen+1), "acme", "web"); !errors.Is(err, discussion.ErrEpicTitleTooLong) {
		t.Errorf("long title = %v, want ErrEpicTitleTooLong", err)
	}
	if _, err := f.service.GroupIntoEpic(ctx, d.ID, cards, strings.Repeat("é", discussion.EpicTitleMaxLen), "acme", "web"); err != nil {
		t.Errorf("title at the limit = %v, want nil", err)
	}
}

func TestGroupingRefusesACardThatCanNotGoIntoAnEpic(t *testing.T) {
	t.Parallel()

	for _, c := range []struct {
		name  string
		setUp func(f *fixture, id string)
	}{
		{"of another round", func(f *fixture, id string) {
			// The round 1 closes with everything discarded, and taking back the
			// decision on one leaves it a loose card of the round 1, undecided.
			f.record(id, plain("one", "two"))
			f.decide(id, "one", discussion.DecisionDiscarded)
			f.decide(id, "two", discussion.DecisionDiscarded)
			f.record(id, plain("one", "two", "three", "four"))
			f.decide(id, "one", discussion.DecisionNone)
		}},
		{"of another epic draft", func(f *fixture, id string) {
			f.record(id, artifactOf(
				draftOf("epic", "Kind: epic", "Repository: acme/web"),
				draftOf("one", "Kind: new", "Repository: acme/web", "Epic: epic"),
				draftOf("two", "Kind: new", "Repository: acme/web"),
				draftOf("three", "Kind: new", "Repository: acme/web"),
				draftOf("four", "Kind: new", "Repository: acme/web"),
			))
		}},
		{"discarded", func(f *fixture, id string) {
			f.record(id, fourCards)
			f.decide(id, "one", discussion.DecisionDiscarded)
		}},
		{"started", func(f *fixture, id string) {
			f.record(id, fourCards)
			f.start(id, "one")
		}},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			d := f.create()
			c.setUp(f, d.ID)

			_, err := f.service.GroupIntoEpic(t.Context(), d.ID, []string{"one", "three"}, "Epic", "acme", "web")
			if !errors.Is(err, discussion.ErrNotGroupable) {
				t.Errorf("error = %v, want ErrNotGroupable", err)
			}
		})
	}
}

func TestAFailedPublicationIsRecordedAndForgottenOnARetry(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()
	f.record(d.ID, twoDrafts)

	ctx := t.Context()
	if err := f.service.SetPublishError(ctx, d.ID, "one", "GitHub said no."); err != nil {
		t.Fatalf("set publish error: %v", err)
	}
	if got := f.draft(d.ID, "one").PublishError; got != "GitHub said no." {
		t.Errorf("publish error = %q, want what the publication said", got)
	}

	if err := f.service.ClearPublishErrors(ctx, d.ID, []string{"one", "two"}); err != nil {
		t.Fatalf("clear publish errors: %v", err)
	}
	if got := f.draft(d.ID, "one").PublishError; got != "" {
		t.Errorf("publish error = %q, want it forgotten", got)
	}
}

func TestArchivingADiscussionTakesItToTheHistoryAndRefusesEveryEdit(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()
	f.record(d.ID, twoDrafts)

	archived, err := f.service.Archive(t.Context(), d.ID)
	if err != nil {
		t.Fatalf("archive: %v", err)
	}
	if !archived.Archived() {
		t.Error("the discussion is not archived")
	}
	if len(f.service.List()) != 0 {
		t.Error("the discussion is still active")
	}
	if got := f.service.ListArchived(); len(got) != 1 || got[0].ID != d.ID {
		t.Errorf("history = %+v, want the discussion", got)
	}
	if _, ok := f.service.Get(d.ID); ok {
		t.Error("Get found an archived discussion")
	}
	if _, ok := f.service.Lookup(d.ID); !ok {
		t.Error("Lookup lost an archived discussion")
	}

	err = f.service.Decide(t.Context(), d.ID, "one", discussion.DecisionApproved)
	if !errors.Is(err, discussion.ErrArchived) {
		t.Errorf("error = %v, want ErrArchived", err)
	}
}

func TestDeletingADiscussionTakesItsFolderWithIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()
	f.record(d.ID, twoDrafts)

	if err := f.service.Delete(t.Context(), d.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, ok := f.service.Lookup(d.ID); ok {
		t.Error("the discussion is still there")
	}
	if len(f.service.Drafts(d.ID)) != 0 {
		t.Error("the drafts are still there")
	}
	if _, err := os.Stat(d.ArtifactsDir); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("stat artifacts directory = %v, want it gone", err)
	}

	if err := f.service.Delete(t.Context(), d.ID); !errors.Is(err, discussion.ErrNotFound) {
		t.Errorf("error = %v, want ErrNotFound", err)
	}
}

func TestReadingAnArtifactOfTheDiscussionRefusesAFileItDoesNotOwn(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()

	got, err := f.service.ReadArtifact(d.ID, discussion.ContextFile)
	if err != nil {
		t.Fatalf("read artifact: %v", err)
	}
	if got != "# Invoices\n" {
		t.Errorf("context = %q, want the initial context", got)
	}

	if _, err = f.service.ReadArtifact(d.ID, "notes.md"); !errors.Is(err, discussion.ErrUnknownArtifact) {
		t.Errorf("error = %v, want ErrUnknownArtifact", err)
	}
	if _, err = f.service.ReadArtifact("missing", discussion.ContextFile); !errors.Is(err, discussion.ErrNotFound) {
		t.Errorf("error = %v, want ErrNotFound", err)
	}
}

func TestTheDocumentOfACardIsTheOneOfTheDiscussionThatPublishedItLast(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	first, second := f.create(), f.create()
	for i, d := range []discussion.Discussion{first, second} {
		f.record(d.ID, artifactOf(draftOf("one", "Kind: new", "Repository: acme/web")))
		if err := os.WriteFile(d.DocumentPath(), []byte("document "+string(rune('a'+i))), 0o600); err != nil {
			t.Fatalf("write document: %v", err)
		}
	}

	ctx := t.Context()
	publish := func(d discussion.Discussion) {
		t.Helper()
		if err := f.service.RecordPublication(ctx, d.ID, "one", func(draft *discussion.Draft) {
			draft.Published.Outcome, draft.Published.Number = discussion.OutcomeCreated, 31
			draft.Published.At = f.now()
		}); err != nil {
			t.Fatalf("record publication: %v", err)
		}
	}
	publish(second)
	publish(first)

	got, ok := f.service.DocumentOfCard("ACME", "Web", 31)
	if !ok || got != "document a" {
		t.Errorf("document = %q, ok = %v, want the one published last", got, ok)
	}
	if _, ok = f.service.DocumentOfCard("acme", "web", 99); ok {
		t.Error("a card nobody published has a document")
	}
}

// publishedBy makes d publish the issue acme/web#31 at the given time; a zero
// time is a publication still running.
func (f *fixture) publishedBy(d discussion.Discussion, at time.Time) {
	f.t.Helper()

	f.record(d.ID, artifactOf(draftOf("one", "Kind: new", "Repository: ACME/Web")))
	if err := f.service.RecordPublication(f.t.Context(), d.ID, "one", func(draft *discussion.Draft) {
		draft.Published.Outcome, draft.Published.Number = discussion.OutcomeCreated, 31
		draft.Published.At = at
	}); err != nil {
		f.t.Fatalf("record publication: %v", err)
	}
}

// writerScenarios are the cases of the discussion that wrote a card. older is
// created before newer, and want is the one that wins.
var writerScenarios = []struct {
	name string
	// publish makes the discussions publish, and archive says which of the two
	// leave the active list; deleted is dropped.
	publish func(f *fixture, older, newer discussion.Discussion)
	archive []string
	deleted []string
	want    string // "older", "newer" or "" for none
	wantArc bool
}{
	{
		name: "the most recent publication wins",
		publish: func(f *fixture, older, newer discussion.Discussion) {
			f.publishedBy(older, base.Add(time.Hour))
			f.publishedBy(newer, base.Add(time.Minute))
		},
		want: "older",
	},
	{
		name: "a tie goes to the newer discussion",
		publish: func(f *fixture, older, newer discussion.Discussion) {
			f.publishedBy(newer, base.Add(time.Hour))
			f.publishedBy(older, base.Add(time.Hour))
		},
		want: "newer",
	},
	{
		name: "an archived discussion counts",
		publish: func(f *fixture, older, _ discussion.Discussion) {
			f.publishedBy(older, base.Add(time.Hour))
		},
		archive: []string{"older"},
		want:    "older",
		wantArc: true,
	},
	{
		name: "a deleted discussion is out",
		publish: func(f *fixture, older, newer discussion.Discussion) {
			f.publishedBy(older, base.Add(time.Hour))
			f.publishedBy(newer, base.Add(2*time.Hour))
		},
		deleted: []string{"newer"},
		want:    "older",
	},
	{
		name: "a publication still running counts",
		publish: func(f *fixture, older, _ discussion.Discussion) {
			f.publishedBy(older, time.Time{})
		},
		want: "older",
	},
	{
		name: "no publication is no writer",
		publish: func(*fixture, discussion.Discussion, discussion.Discussion) {
		},
		want: "",
	},
}

// writerFixture runs a scenario and answers the discussions it made.
func writerFixture(t *testing.T, scenario int) (f *fixture, chosen map[string]discussion.Discussion) {
	t.Helper()

	sc := writerScenarios[scenario]
	f = newFixture(t)
	older, newer := f.create(), f.create()
	chosen = map[string]discussion.Discussion{"older": older, "newer": newer}
	for _, d := range []discussion.Discussion{older, newer} {
		if err := os.WriteFile(d.DocumentPath(), []byte("document of "+d.ID), 0o600); err != nil {
			t.Fatalf("write document: %v", err)
		}
	}
	sc.publish(f, older, newer)
	for _, name := range sc.archive {
		if _, err := f.service.Archive(t.Context(), chosen[name].ID); err != nil {
			t.Fatalf("archive: %v", err)
		}
	}
	for _, name := range sc.deleted {
		if err := f.service.Delete(t.Context(), chosen[name].ID); err != nil {
			t.Fatalf("delete: %v", err)
		}
	}
	return f, chosen
}

func TestCardWritersIsTheDiscussionOfTheMostRecentPublication(t *testing.T) {
	t.Parallel()

	for i, sc := range writerScenarios {
		t.Run(sc.name, func(t *testing.T) {
			t.Parallel()

			f, chosen := writerFixture(t, i)
			got := f.service.CardWriters()
			if got == nil {
				t.Fatal("CardWriters() = nil, want a map")
			}
			want := map[string]discussion.Writer{}
			if sc.want != "" {
				d := chosen[sc.want]
				want["acme/web#31"] = discussion.Writer{ID: d.ID, Title: d.Title, Archived: sc.wantArc}
			}
			if diff := cmp.Diff(want, got); diff != "" {
				t.Errorf("CardWriters() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestDocumentOfCardReadsTheDocumentOfTheCardWriter(t *testing.T) {
	t.Parallel()

	for i, sc := range writerScenarios {
		t.Run(sc.name, func(t *testing.T) {
			t.Parallel()

			f, chosen := writerFixture(t, i)
			got, ok := f.service.DocumentOfCard("ACME", "Web", 31)
			if sc.want == "" {
				if ok {
					t.Errorf("DocumentOfCard() = %q, want none", got)
				}
				return
			}
			if want := "document of " + chosen[sc.want].ID; !ok || got != want {
				t.Errorf("DocumentOfCard() = %q, %v, want %q", got, ok, want)
			}
		})
	}
}

func TestCardWritersDoesNotDistinguishTheCaseOfTheRepository(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()
	f.publishedBy(d, base.Add(time.Hour)) // drafted as ACME/Web

	got := f.service.CardWriters()
	if _, ok := got["acme/web#31"]; !ok || len(got) != 1 {
		t.Errorf("CardWriters() = %+v, want one writer under acme/web#31", got)
	}
}

func TestTheDocumentOfACardIsReadFromTheHistoryToo(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()
	f.record(d.ID, artifactOf(draftOf("one", "Kind: new", "Repository: acme/web")))
	if err := os.WriteFile(d.DocumentPath(), []byte("the understanding"), 0o600); err != nil {
		t.Fatalf("write document: %v", err)
	}

	ctx := t.Context()
	if err := f.service.RecordPublication(ctx, d.ID, "one", func(draft *discussion.Draft) {
		draft.Published.Outcome, draft.Published.Number = discussion.OutcomeCreated, 31
		draft.Published.At = f.now()
	}); err != nil {
		t.Fatalf("record publication: %v", err)
	}
	if _, err := f.service.Archive(ctx, d.ID); err != nil {
		t.Fatalf("archive: %v", err)
	}

	got, ok := f.service.DocumentOfCard("acme", "web", 31)
	if !ok || got != "the understanding" {
		t.Errorf("document = %q, ok = %v, want the one of the archived discussion", got, ok)
	}
}

func TestSyncLoadsTheDiscussionsAndTheDraftsOfEachOne(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()
	f.record(d.ID, twoDrafts)
	if _, err := f.service.Archive(t.Context(), d.ID); err != nil {
		t.Fatalf("archive: %v", err)
	}

	loaded := discussion.New(discussion.Deps{Store: f.store, DataDir: f.dataDir})
	if err := loaded.Sync(t.Context()); err != nil {
		t.Fatalf("sync: %v", err)
	}

	if got := loaded.ListArchived(); len(got) != 1 || got[0].ID != d.ID {
		t.Errorf("history = %+v, want the discussion", got)
	}
	if got := loaded.Drafts(d.ID); len(got) != 2 {
		t.Errorf("drafts = %d, want 2", len(got))
	}
}

// approve approves drafts of a discussion, failing the test when one is refused.
func (f *fixture) approve(id string, draftIDs ...string) {
	f.t.Helper()

	for _, draftID := range draftIDs {
		if err := f.service.Decide(f.t.Context(), id, draftID, discussion.DecisionApproved); err != nil {
			f.t.Fatalf("approve %s: %v", draftID, err)
		}
	}
}

// chainArtifact has two epics, a card in one of them and three loose cards.
var chainArtifact = artifactOf(
	draftOf("epic", "Kind: epic", "Repository: acme/web"),
	draftOf("other", "Kind: epic", "Repository: acme/web"),
	draftOf("one", "Kind: new", "Repository: acme/web", "Epic: epic"),
	draftOf("two", "Kind: new", "Repository: acme/web"),
	draftOf("three", "Kind: new", "Repository: acme/web"),
)

func TestAChangeOfTheChainTakesBackTheApproval(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name   string
		change func(f *fixture, id string) error
		// undecided are the drafts that go back to be decided; every other one stays approved.
		undecided []string
	}{
		{
			"another repository",
			func(f *fixture, id string) error {
				return f.service.SetDraftRepository(f.t.Context(), id, "two", "acme", "api")
			},
			[]string{"two"},
		},
		{
			"the same repository",
			func(f *fixture, id string) error {
				return f.service.SetDraftRepository(f.t.Context(), id, "two", "acme", "web")
			},
			nil,
		},
		{
			"another epic",
			func(f *fixture, id string) error { return f.service.SetDraftEpic(f.t.Context(), id, "one", "other") },
			[]string{"one", "epic", "other"},
		},
		{
			"the same epic",
			func(f *fixture, id string) error { return f.service.SetDraftEpic(f.t.Context(), id, "one", "epic") },
			nil,
		},
		{
			"a dependency added",
			func(f *fixture, id string) error {
				return f.service.AddDraftDependency(f.t.Context(), id, "two", "three")
			},
			[]string{"two"},
		},
		{
			"a dependency removed",
			func(f *fixture, id string) error {
				if err := f.service.AddDraftDependency(f.t.Context(), id, "two", "three"); err != nil {
					return err
				}
				f.approve(id, "two")
				return f.service.RemoveDraftDependency(f.t.Context(), id, "two", "three")
			},
			[]string{"two"},
		},
		{
			"another text",
			func(f *fixture, id string) error {
				return f.service.SetDraftText(f.t.Context(), id, "two", "Other", "Other body.")
			},
			nil,
		},
		{
			"another module",
			func(f *fixture, id string) error {
				return f.service.SetDraftModule(f.t.Context(), id, "two", "Billing")
			},
			nil,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			d := f.create()
			f.record(d.ID, chainArtifact)
			ids := []string{"epic", "other", "one", "two", "three"}
			f.approve(d.ID, ids...)

			if err := c.change(f, d.ID); err != nil {
				t.Fatalf("change: %v", err)
			}

			for _, id := range ids {
				want := discussion.DecisionApproved
				if slices.Contains(c.undecided, id) {
					want = discussion.DecisionNone
				}
				if got := f.draft(d.ID, id).Decision; got != want {
					t.Errorf("decision of %s = %q, want %q", id, got, want)
				}
			}
		})
	}
}

func TestTakingBackAnApprovalClearsTheFailureOfTheDraft(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()
	f.record(d.ID, chainArtifact)
	f.approve(d.ID, "two")
	ctx := t.Context()
	if err := f.service.SetPublishError(ctx, d.ID, "two", "GitHub said no."); err != nil {
		t.Fatalf("set publish error: %v", err)
	}

	if err := f.service.SetDraftRepository(ctx, d.ID, "two", "acme", "api"); err != nil {
		t.Fatalf("set repository: %v", err)
	}

	got := f.draft(d.ID, "two")
	if got.Decision != discussion.DecisionNone || got.PublishError != "" {
		t.Errorf("draft = decision %q, failure %q, want it undecided and without a failure", got.Decision, got.PublishError)
	}
}

func TestAStartedEpicKeepsItsApprovalWhenACardMoves(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()
	f.record(d.ID, chainArtifact)
	f.approve(d.ID, "epic", "one")
	ctx := t.Context()
	if err := f.service.RecordPublication(ctx, d.ID, "epic", func(draft *discussion.Draft) {
		draft.Published.Outcome = discussion.OutcomeCreated
	}); err != nil {
		t.Fatalf("record publication: %v", err)
	}

	if err := f.service.SetDraftEpic(ctx, d.ID, "one", ""); err != nil {
		t.Fatalf("set epic: %v", err)
	}

	if got := f.draft(d.ID, "epic").Decision; got != discussion.DecisionApproved {
		t.Errorf("decision of the started epic = %q, want it kept", got)
	}
	if got := f.draft(d.ID, "one").Decision; got != discussion.DecisionNone {
		t.Errorf("decision of the card = %q, want it taken back", got)
	}
}

func TestApprovingADraftWithoutATitleIsRefused(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()
	f.record(d.ID, chainArtifact)
	ctx := t.Context()
	epic, err := f.service.GroupIntoEpic(ctx, d.ID, []string{"two", "three"}, "Epic", "acme", "web")
	if err != nil {
		t.Fatalf("group into epic: %v", err)
	}
	// A draft stored without a title: grouping always names the epic.
	if err = f.service.RecordPublication(ctx, d.ID, epic.ID, func(draft *discussion.Draft) { draft.Title = "" }); err != nil {
		t.Fatalf("clear title: %v", err)
	}

	if err = f.service.Decide(ctx, d.ID, epic.ID, discussion.DecisionApproved); !errors.Is(err, discussion.ErrUntitled) {
		t.Errorf("approve = %v, want ErrUntitled", err)
	}
	if err = f.service.Decide(ctx, d.ID, epic.ID, discussion.DecisionDiscarded); err != nil {
		t.Errorf("discard = %v, want it accepted", err)
	}
	if err = f.service.SetDraftText(ctx, d.ID, epic.ID, "Billing", "The billing."); err != nil {
		t.Fatalf("set text: %v", err)
	}
	if err = f.service.Decide(ctx, d.ID, epic.ID, discussion.DecisionApproved); err != nil {
		t.Errorf("approve with a title = %v, want it accepted", err)
	}
}

func TestDecidingADraftAgainClearsItsFailure(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()
	f.record(d.ID, chainArtifact)
	f.approve(d.ID, "two")
	ctx := t.Context()
	if err := f.service.SetPublishError(ctx, d.ID, "two", "GitHub said no."); err != nil {
		t.Fatalf("set publish error: %v", err)
	}

	if err := f.service.Decide(ctx, d.ID, "two", discussion.DecisionDiscarded); err != nil {
		t.Fatalf("decide: %v", err)
	}

	if got := f.draft(d.ID, "two"); got.PublishError != "" {
		t.Errorf("failure = %q, want it cleared by the new decision", got.PublishError)
	}
}

func TestGroupingRefusesACardOfAnEpicDraftAndTakesBackTheApprovalOfTheCards(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()
	f.record(d.ID, chainArtifact)
	f.approve(d.ID, "one", "two", "three")
	ctx := t.Context()

	if _, err := f.service.GroupIntoEpic(ctx, d.ID, []string{"one", "two"}, "Epic", "acme", "web"); !errors.Is(err, discussion.ErrNotGroupable) {
		t.Errorf("group a card of an epic = %v, want ErrNotGroupable", err)
	}
	if got := f.draft(d.ID, "two").Decision; got != discussion.DecisionApproved {
		t.Errorf("decision after a refusal = %q, want it kept", got)
	}

	if _, err := f.service.GroupIntoEpic(ctx, d.ID, []string{"two", "three"}, "Epic", "acme", "web"); err != nil {
		t.Fatalf("group into epic: %v", err)
	}
	for _, id := range []string{"two", "three"} {
		if got := f.draft(d.ID, id).Decision; got != discussion.DecisionNone {
			t.Errorf("decision of %s = %q, want it taken back", id, got)
		}
	}
}

func TestAnEpicOfTheUserTakesAnEmptyBody(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	d := f.create()
	f.record(d.ID, twoDrafts)
	epic, err := f.service.GroupIntoEpic(t.Context(), d.ID, []string{"one", "two"}, "Billing", "acme", "web")
	if err != nil {
		t.Fatalf("group into epic: %v", err)
	}

	if err = f.service.SetDraftText(t.Context(), d.ID, epic.ID, "Billing", "  "); err != nil {
		t.Fatalf("set text with an empty body = %v, want nil", err)
	}
	if got := f.draft(d.ID, epic.ID); got.Title != "Billing" || got.Body != "" {
		t.Errorf("epic = %+v, want the title and no body", got)
	}
	if err = f.service.SetDraftText(t.Context(), d.ID, epic.ID, " ", "Body."); !errors.Is(err, discussion.ErrEmptyText) {
		t.Errorf("set text with an empty title = %v, want ErrEmptyText", err)
	}
}

func TestDecidingClearsTheClearedApproval(t *testing.T) {
	t.Parallel()

	for _, decision := range []discussion.Decision{discussion.DecisionApproved, discussion.DecisionNone} {
		t.Run("decision "+string(decision), func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			d := f.create()
			f.record(d.ID, plain("one", "two"))
			f.approve(d.ID, "one")
			f.record(d.ID, withBody(plain("one", "two"), "one", "Another body."))
			if !f.draft(d.ID, "one").ApprovalCleared {
				t.Fatal("approval cleared = false after a revision of an approved draft, want true")
			}

			f.decide(d.ID, "one", decision)

			if f.draft(d.ID, "one").ApprovalCleared {
				t.Errorf("approval cleared = true after deciding %q, want it cleared", decision)
			}
		})
	}
}
