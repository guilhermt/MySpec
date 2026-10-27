package newdiscussion_test

import (
	"errors"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/newdiscussion"
)

func ids(list []newdiscussion.Draft) []string {
	out := make([]string, 0, len(list))
	for _, d := range list {
		out = append(out, d.ID)
	}
	return out
}

func TestSavingCreatesADraftAsTyped(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	got := f.save(t, newdiscussion.SaveParams{BoardID: boardID, Title: " Rules ", Text: "a\nb "})

	want := newdiscussion.Draft{ID: "draft-1", BoardID: boardID, Title: " Rules ", Text: "a\nb ", CreatedAt: base, SavedAt: base}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("Save() mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]newdiscussion.Draft{want}, f.service.List()); diff != "" {
		t.Errorf("List() mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff(want, f.store.rows["draft-1"]); diff != "" {
		t.Errorf("the stored draft mismatch (-want +got):\n%s", diff)
	}
	if f.changes != 1 {
		t.Errorf("OnChange calls = %d, want 1", f.changes)
	}
}

func TestSavingAgainByIdUpdatesAndKeepsWhenItWasCreated(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	first := f.save(t, newdiscussion.SaveParams{BoardID: boardID, Title: "One"})

	f.now = base.Add(time.Hour)
	got := f.save(t, newdiscussion.SaveParams{ID: first.ID, BoardID: "board-2", Title: "Two", Text: "more"})

	want := newdiscussion.Draft{ID: first.ID, BoardID: "board-2", Title: "Two", Text: "more", CreatedAt: base, SavedAt: f.now}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("Save() mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]newdiscussion.Draft{want}, f.service.List()); diff != "" {
		t.Errorf("List() mismatch (-want +got):\n%s", diff)
	}
}

func TestSavingAnUnknownIdInsertsItWithThatId(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	got := f.save(t, newdiscussion.SaveParams{ID: "lost-draft", BoardID: boardID, Text: "kept"})

	if got.ID != "lost-draft" {
		t.Errorf("Save().ID = %q, want %q", got.ID, "lost-draft")
	}
	if diff := cmp.Diff([]string{"lost-draft"}, ids(f.service.List())); diff != "" {
		t.Errorf("List() ids (-want +got):\n%s", diff)
	}
}

func TestSavingWithNoTitleAndNoTextIsRefused(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	_, err := f.service.Save(t.Context(), newdiscussion.SaveParams{BoardID: boardID, Title: "  ", Text: "\n\t"})

	var refusal *newdiscussion.Refusal
	if !errors.As(err, &refusal) || refusal.Reason != newdiscussion.RefusalEmpty {
		t.Fatalf("Save() = %v, want a refusal for empty", err)
	}
	if got := refusal.Message(); got != "Write a title or what to discuss to save a draft." {
		t.Errorf("Message() = %q", got)
	}
	if len(f.service.List()) != 0 || f.changes != 0 {
		t.Error("a refused draft was kept or published")
	}
}

func TestSavingForABoardTheAppLacksIsRefused(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	_, err := f.service.Save(t.Context(), newdiscussion.SaveParams{BoardID: "gone", Title: "x"})

	var refusal *newdiscussion.Refusal
	if !errors.As(err, &refusal) || refusal.Reason != newdiscussion.RefusalBoardGone {
		t.Fatalf("Save() = %v, want a refusal for a board gone", err)
	}
	if got := refusal.Message(); got != "This board is no longer in the app." {
		t.Errorf("Message() = %q", got)
	}
}

func TestTheListIsTheMostRecentlySavedFirst(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	a := f.save(t, newdiscussion.SaveParams{BoardID: boardID, Title: "a"})
	f.now = base.Add(time.Hour)
	b := f.save(t, newdiscussion.SaveParams{BoardID: boardID, Title: "b"})
	f.now = base.Add(2 * time.Hour)
	f.save(t, newdiscussion.SaveParams{ID: a.ID, BoardID: boardID, Title: "a again"})
	c := f.save(t, newdiscussion.SaveParams{ID: "draft-0", BoardID: boardID, Title: "c"})

	want := []string{a.ID, c.ID, b.ID}
	if a.ID > c.ID {
		want = []string{c.ID, a.ID, b.ID}
	}
	if diff := cmp.Diff(want, ids(f.service.List())); diff != "" {
		t.Errorf("List() ids (-want +got):\n%s", diff)
	}
}

func TestTheListOfNoDraftsIsNotNil(t *testing.T) {
	t.Parallel()

	if got := newFixture(t).service.List(); got == nil {
		t.Error("List() = nil, want an empty list")
	}
}

func TestDeletingRemovesTheDraftAndAnUnknownIdIsFine(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	d := f.save(t, newdiscussion.SaveParams{BoardID: boardID, Title: "a"})

	if err := f.service.Delete(t.Context(), d.ID); err != nil {
		t.Fatalf("Delete() = %v, want nil", err)
	}
	changes := f.changes
	if err := f.service.Delete(t.Context(), "missing"); err != nil {
		t.Fatalf("Delete(unknown) = %v, want nil", err)
	}

	if len(f.service.List()) != 0 || len(f.store.rows) != 0 {
		t.Error("the draft was not removed")
	}
	if f.changes != changes {
		t.Error("deleting an unknown draft published a change")
	}
}

func TestForgetBoardDropsOnlyThatBoardsDrafts(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.save(t, newdiscussion.SaveParams{BoardID: boardID, Title: "a"})
	keep := f.save(t, newdiscussion.SaveParams{BoardID: "board-2", Title: "b"})
	changes := f.changes

	f.service.ForgetBoard(boardID)

	if diff := cmp.Diff([]string{keep.ID}, ids(f.service.List())); diff != "" {
		t.Errorf("List() ids (-want +got):\n%s", diff)
	}
	if f.changes != changes {
		t.Error("ForgetBoard published a change")
	}
}

func TestLoadFillsTheList(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.store.rows["draft-9"] = newdiscussion.Draft{ID: "draft-9", BoardID: boardID, Title: "t", CreatedAt: base, SavedAt: base}

	if err := f.service.Load(t.Context()); err != nil {
		t.Fatalf("Load() = %v, want nil", err)
	}

	if diff := cmp.Diff([]string{"draft-9"}, ids(f.service.List())); diff != "" {
		t.Errorf("List() ids (-want +got):\n%s", diff)
	}
}

func TestAStoreFailureLeavesTheCacheAsItWas(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	d := f.save(t, newdiscussion.SaveParams{BoardID: boardID, Title: "a"})
	f.store.fails = true

	if _, err := f.service.Save(t.Context(), newdiscussion.SaveParams{ID: d.ID, BoardID: boardID, Title: "changed"}); err == nil {
		t.Error("Save() = nil, want the store failure")
	}
	if err := f.service.Delete(t.Context(), d.ID); err == nil {
		t.Error("Delete() = nil, want the store failure")
	}

	if diff := cmp.Diff([]newdiscussion.Draft{d}, f.service.List()); diff != "" {
		t.Errorf("List() mismatch (-want +got):\n%s", diff)
	}
}
