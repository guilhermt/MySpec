package store_test

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/newdiscussion"
	"github.com/guilhermt/myspec/internal/store"
)

// newNewDiscussionDraft builds a draft of a board, ready to put.
func newNewDiscussionDraft(id, boardID string) newdiscussion.Draft {
	return newdiscussion.Draft{
		ID:        id,
		BoardID:   boardID,
		Title:     "  Rules ",
		Text:      "line one\nline two ",
		CreatedAt: fixedTime,
		SavedAt:   fixedTime,
	}
}

func listNewDiscussionDrafts(t *testing.T, s *store.Store) []newdiscussion.Draft {
	t.Helper()

	list, err := s.NewDiscussionDrafts(t.Context())
	if err != nil {
		t.Fatalf("NewDiscussionDrafts() = %v, want nil", err)
	}
	return list
}

func TestNewDiscussionDraftsPutAndList(t *testing.T) {
	t.Parallel()
	s := newStore(t)
	insertBoard(t, s, newBoard("board-1", "Roadmap", 1))

	older := newNewDiscussionDraft("draft-a", "board-1")
	newer := newNewDiscussionDraft("draft-b", "board-1")
	newer.SavedAt = fixedTime.Add(time.Hour)
	for _, d := range []newdiscussion.Draft{older, newer} {
		if err := s.PutNewDiscussionDraft(t.Context(), d); err != nil {
			t.Fatalf("PutNewDiscussionDraft() = %v, want nil", err)
		}
	}

	want := []newdiscussion.Draft{newer, older}
	if diff := cmp.Diff(want, listNewDiscussionDrafts(t, s)); diff != "" {
		t.Errorf("NewDiscussionDrafts() mismatch (-want +got):\n%s", diff)
	}
}

func TestNewDiscussionDraftsPutUpdatesAndKeepsWhenItWasCreated(t *testing.T) {
	t.Parallel()
	s := newStore(t)
	insertBoard(t, s, newBoard("board-1", "Roadmap", 1))
	insertBoard(t, s, newBoard("board-2", "Docs", 2))
	if err := s.PutNewDiscussionDraft(t.Context(), newNewDiscussionDraft("draft-a", "board-1")); err != nil {
		t.Fatalf("PutNewDiscussionDraft() = %v, want nil", err)
	}

	update := newNewDiscussionDraft("draft-a", "board-2")
	update.Title, update.Text = "Changed", "other"
	update.CreatedAt = fixedTime.Add(time.Minute)
	update.SavedAt = fixedTime.Add(time.Hour)
	if err := s.PutNewDiscussionDraft(t.Context(), update); err != nil {
		t.Fatalf("PutNewDiscussionDraft() = %v, want nil", err)
	}

	want := update
	want.CreatedAt = fixedTime
	if diff := cmp.Diff([]newdiscussion.Draft{want}, listNewDiscussionDrafts(t, s)); diff != "" {
		t.Errorf("NewDiscussionDrafts() mismatch (-want +got):\n%s", diff)
	}
}

func TestNewDiscussionDraftsDeleteRemovesTheDraftAndForgivesAMissingOne(t *testing.T) {
	t.Parallel()
	s := newStore(t)
	insertBoard(t, s, newBoard("board-1", "Roadmap", 1))
	if err := s.PutNewDiscussionDraft(t.Context(), newNewDiscussionDraft("draft-a", "board-1")); err != nil {
		t.Fatalf("PutNewDiscussionDraft() = %v, want nil", err)
	}

	for _, id := range []string{"draft-a", "draft-a", "missing"} {
		if err := s.DeleteNewDiscussionDraft(t.Context(), id); err != nil {
			t.Fatalf("DeleteNewDiscussionDraft(%s) = %v, want nil", id, err)
		}
	}

	if got := listNewDiscussionDrafts(t, s); len(got) != 0 {
		t.Errorf("NewDiscussionDrafts() = %v, want none", got)
	}
}

func TestNewDiscussionDraftsLeaveWithTheirBoard(t *testing.T) {
	t.Parallel()
	s := newStore(t)
	insertBoard(t, s, newBoard("board-1", "Roadmap", 1))
	insertBoard(t, s, newBoard("board-2", "Docs", 2))
	for _, d := range []newdiscussion.Draft{newNewDiscussionDraft("draft-a", "board-1"), newNewDiscussionDraft("draft-b", "board-2")} {
		if err := s.PutNewDiscussionDraft(t.Context(), d); err != nil {
			t.Fatalf("PutNewDiscussionDraft() = %v, want nil", err)
		}
	}

	if err := s.Boards.DeleteBoard(t.Context(), "board-1", nil); err != nil {
		t.Fatalf("DeleteBoard() = %v, want nil", err)
	}

	want := []newdiscussion.Draft{newNewDiscussionDraft("draft-b", "board-2")}
	if diff := cmp.Diff(want, listNewDiscussionDrafts(t, s)); diff != "" {
		t.Errorf("NewDiscussionDrafts() mismatch (-want +got):\n%s", diff)
	}
}

func TestNewDiscussionDraftsPutRefusesAnUnknownBoard(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	if err := s.PutNewDiscussionDraft(t.Context(), newNewDiscussionDraft("draft-a", "nowhere")); err == nil {
		t.Error("PutNewDiscussionDraft() = nil, want an error for a board the app lacks")
	}
}
