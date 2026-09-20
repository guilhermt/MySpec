package discussion_test

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

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
	))

	epic, err := f.service.GroupIntoEpic(t.Context(), d.ID, []string{"one", "two", "three"})
	if err != nil {
		t.Fatalf("group into epic: %v", err)
	}

	if epic.ID != "user-epic-1" || epic.Source != discussion.SourceUser || epic.Kind != discussion.KindEpic {
		t.Errorf("epic = %+v, want an epic of the user", epic)
	}
	if epic.FullName() != "acme/web" {
		t.Errorf("repository = %s, want the one most cards are in", epic.FullName())
	}
	if epic.Title != "" || epic.Body != "" {
		t.Errorf("epic = %+v, want it written by the user", epic)
	}
	for _, id := range []string{"one", "two", "three"} {
		if got := f.draft(d.ID, id); got.Epic != epic.ID {
			t.Errorf("epic of %s = %q, want %q", id, got.Epic, epic.ID)
		}
	}

	second, err := f.service.GroupIntoEpic(t.Context(), d.ID, []string{"one", "two"})
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
	if _, err := f.service.GroupIntoEpic(ctx, d.ID, []string{"one", "one"}); !errors.Is(err, discussion.ErrTooFewCards) {
		t.Errorf("error = %v, want ErrTooFewCards", err)
	}
	if _, err := f.service.GroupIntoEpic(ctx, d.ID, []string{"one", "epic"}); !errors.Is(err, discussion.ErrDraftNotFound) {
		t.Errorf("error = %v, want ErrDraftNotFound", err)
	}

	if err := f.service.RecordPublication(ctx, d.ID, "one", func(draft *discussion.Draft) {
		draft.Published.Outcome = discussion.OutcomeCreated
	}); err != nil {
		t.Fatalf("record publication: %v", err)
	}
	if _, err := f.service.GroupIntoEpic(ctx, d.ID, []string{"one", "two"}); !errors.Is(err, discussion.ErrPublished) {
		t.Errorf("error = %v, want ErrPublished", err)
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
