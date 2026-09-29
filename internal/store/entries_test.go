package store_test

import (
	"errors"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/session"
)

func TestEntriesInsertAndListInSeqOrder(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	_, sessionID := seedSession(t, s)
	for _, e := range []session.Entry{
		newEntry("entry-2", 2, "second"),
		newEntry("entry-1", 1, "first"),
	} {
		if err := s.Entries.Insert(t.Context(), sessionID, e); err != nil {
			t.Fatalf("Insert(%s) = %v, want nil", e.ID, err)
		}
	}

	entries, err := s.Entries.List(t.Context(), sessionID)
	if err != nil {
		t.Fatalf("List() = %v, want nil", err)
	}
	want := []session.Entry{newEntry("entry-1", 1, "first"), newEntry("entry-2", 2, "second")}
	if diff := cmp.Diff(want, entries); diff != "" {
		t.Errorf("List() mismatch (-want +got):\n%s", diff)
	}
}

func TestEntriesListDecodesEveryKind(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	_, sessionID := seedSession(t, s)
	want := []session.Entry{
		newEntry("entry-1", 1, "hello"),
		{
			ID: "entry-2", Seq: 2, TurnID: "entry-1", Kind: session.KindAssistant, CreatedAt: fixedTime,
			Assistant: &session.AssistantEntry{MessageID: "msg_1", Text: "hi", Complete: true},
		},
		{
			ID: "entry-3", Seq: 3, TurnID: "entry-1", Kind: session.KindAction, CreatedAt: fixedTime,
			Action: &session.ActionEntry{ToolUseID: "toolu_1", Tool: "Read", Label: "Reading", Status: session.ActionDone},
		},
		{
			ID: "entry-4", Seq: 4, TurnID: "entry-1", Kind: session.KindMarker, CreatedAt: fixedTime,
			Marker: &session.MarkerEntry{Type: session.MarkerPRDWritten},
		},
		{
			ID: "entry-5", Seq: 5, TurnID: "entry-1", Kind: session.KindError, CreatedAt: fixedTime,
			Error: &session.ErrorEntry{Kind: session.ErrorTurn, Message: "boom", Retryable: true},
		},
	}
	for _, e := range want {
		if err := s.Entries.Insert(t.Context(), sessionID, e); err != nil {
			t.Fatalf("Insert(%s) = %v, want nil", e.ID, err)
		}
	}

	entries, err := s.Entries.List(t.Context(), sessionID)
	if err != nil {
		t.Fatalf("List() = %v, want nil", err)
	}
	if diff := cmp.Diff(want, entries); diff != "" {
		t.Errorf("List() mismatch (-want +got):\n%s", diff)
	}
}

func TestEntriesUpdateRewritesThePayload(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	_, sessionID := seedSession(t, s)
	entry := newEntry("entry-1", 1, "queued")
	entry.User.Pending = true
	if err := s.Entries.Insert(t.Context(), sessionID, entry); err != nil {
		t.Fatalf("Insert() = %v, want nil", err)
	}

	entry.Seq = 4
	entry.TurnID = "turn-9"
	entry.User.Pending = false
	if err := s.Entries.Update(t.Context(), entry); err != nil {
		t.Fatalf("Update() = %v, want nil", err)
	}

	entries, err := s.Entries.List(t.Context(), sessionID)
	if err != nil {
		t.Fatalf("List() = %v, want nil", err)
	}
	if diff := cmp.Diff([]session.Entry{entry}, entries); diff != "" {
		t.Errorf("List() mismatch (-want +got):\n%s", diff)
	}
}

func TestEntriesDelete(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	_, sessionID := seedSession(t, s)
	if err := s.Entries.Insert(t.Context(), sessionID, newEntry("entry-1", 1, "hello")); err != nil {
		t.Fatalf("Insert() = %v, want nil", err)
	}
	if err := s.Entries.Delete(t.Context(), "entry-1"); err != nil {
		t.Fatalf("Delete() = %v, want nil", err)
	}
	if err := s.Entries.Delete(t.Context(), "entry-1"); err != nil {
		t.Errorf("Delete() of a missing entry = %v, want nil", err)
	}

	entries, err := s.Entries.List(t.Context(), sessionID)
	if err != nil {
		t.Fatalf("List() = %v, want nil", err)
	}
	if len(entries) != 0 {
		t.Errorf("List() returned %d entries, want none", len(entries))
	}
}

func TestEntriesMaxSeq(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	_, sessionID := seedSession(t, s)
	got, err := s.Entries.MaxSeq(t.Context(), sessionID)
	if err != nil {
		t.Fatalf("MaxSeq() = %v, want nil", err)
	}
	if got != 0 {
		t.Errorf("MaxSeq() of an empty session = %d, want 0", got)
	}

	for _, e := range []session.Entry{newEntry("entry-1", 1, "a"), newEntry("entry-2", 7, "b")} {
		if err = s.Entries.Insert(t.Context(), sessionID, e); err != nil {
			t.Fatalf("Insert(%s) = %v, want nil", e.ID, err)
		}
	}

	if got, err = s.Entries.MaxSeq(t.Context(), sessionID); err != nil {
		t.Fatalf("MaxSeq() = %v, want nil", err)
	}
	if got != 7 {
		t.Errorf("MaxSeq() = %d, want 7", got)
	}
}

func TestEntriesInsertRejectsAnEntryWithoutItsPayload(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	_, sessionID := seedSession(t, s)
	broken := session.Entry{ID: "entry-1", Seq: 1, Kind: session.KindUser, CreatedAt: fixedTime}
	if err := s.Entries.Insert(t.Context(), sessionID, broken); err == nil {
		t.Error("Insert() = nil, want error")
	}
	if err := s.Entries.Update(t.Context(), broken); err == nil {
		t.Error("Update() = nil, want error")
	}
}

func TestEntriesSaveOutputReplacesTheOutputOfAnEntry(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	_, sessionID := seedSession(t, s)
	if err := s.Entries.Insert(t.Context(), sessionID, newEntry("entry-1", 1, "run")); err != nil {
		t.Fatalf("Insert() = %v, want nil", err)
	}
	if _, err := s.Entries.Output(t.Context(), "entry-1"); !errors.Is(err, session.ErrNotFound) {
		t.Errorf("Output() before any = %v, want session.ErrNotFound", err)
	}

	want := session.Output{Text: "b\nc", Lines: 2, Truncated: true}
	for _, o := range []session.Output{{Text: "a", Lines: 1}, want} {
		if err := s.Entries.SaveOutput(t.Context(), "entry-1", o); err != nil {
			t.Fatalf("SaveOutput() = %v, want nil", err)
		}
	}

	got, err := s.Entries.Output(t.Context(), "entry-1")
	if err != nil {
		t.Fatalf("Output() = %v, want nil", err)
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("Output() mismatch (-want +got):\n%s", diff)
	}
}
