package store_test

import (
	"errors"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/session"
)

func TestSessionsInsertAndGetByTask(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	taskID, sessionID := seedSession(t, s)

	got, err := s.Sessions.GetByTask(t.Context(), taskID)
	if err != nil {
		t.Fatalf("GetByTask() = %v, want nil", err)
	}
	if diff := cmp.Diff(newSession(sessionID, taskID), got); diff != "" {
		t.Errorf("GetByTask() mismatch (-want +got):\n%s", diff)
	}
}

func TestSessionsGetByTaskMissingIsNotFound(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	if _, err := s.Sessions.GetByTask(t.Context(), "nope"); !errors.Is(err, session.ErrNotFound) {
		t.Errorf("GetByTask() = %v, want session.ErrNotFound", err)
	}
}

func TestSessionsUpdateRewritesEveryMutableColumn(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	taskID, sessionID := seedSession(t, s)

	want := newSession(sessionID, taskID)
	want.Started = true
	want.Paused = true
	want.ContextTokens = 12_000
	want.ContextWindow = 200_000
	want.LastError = "the process exited"
	want.UpdatedAt = fixedTime.Add(time.Minute)
	if err := s.Sessions.Update(t.Context(), want); err != nil {
		t.Fatalf("Update() = %v, want nil", err)
	}

	got, err := s.Sessions.GetByTask(t.Context(), taskID)
	if err != nil {
		t.Fatalf("GetByTask() = %v, want nil", err)
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("GetByTask() mismatch (-want +got):\n%s", diff)
	}
}

func TestSessionsUpdateClearsTheLastError(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	taskID, sessionID := seedSession(t, s)

	failed := newSession(sessionID, taskID)
	failed.LastError = "boom"
	if err := s.Sessions.Update(t.Context(), failed); err != nil {
		t.Fatalf("Update() = %v, want nil", err)
	}

	healthy := newSession(sessionID, taskID)
	if err := s.Sessions.Update(t.Context(), healthy); err != nil {
		t.Fatalf("Update() = %v, want nil", err)
	}

	got, err := s.Sessions.GetByTask(t.Context(), taskID)
	if err != nil {
		t.Fatalf("GetByTask() = %v, want nil", err)
	}
	if got.LastError != "" {
		t.Errorf("LastError = %q, want empty", got.LastError)
	}
}

func TestSessionsInsertRejectsAnUnknownTask(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	if err := s.Sessions.Insert(t.Context(), newSession("sess-1", "nope")); err == nil {
		t.Error("Insert() = nil, want error")
	}
}
