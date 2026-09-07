package store_test

import (
	"errors"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

func TestSessionsInsertAndGet(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	taskID, sessionID := seedSession(t, s)

	got, err := s.Sessions.Get(t.Context(), taskID, string(task.StagePRD))
	if err != nil {
		t.Fatalf("Get() = %v, want nil", err)
	}
	if diff := cmp.Diff(newSession(sessionID, taskID, task.StagePRD), got); diff != "" {
		t.Errorf("Get() mismatch (-want +got):\n%s", diff)
	}
}

func TestSessionsGetMissingIsNotFound(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	taskID, _ := seedSession(t, s)

	if _, err := s.Sessions.Get(t.Context(), "nope", string(task.StagePRD)); !errors.Is(err, session.ErrNotFound) {
		t.Errorf("Get() of an unknown task = %v, want session.ErrNotFound", err)
	}
	if _, err := s.Sessions.Get(t.Context(), taskID, string(task.StageTechSpec)); !errors.Is(err, session.ErrNotFound) {
		t.Errorf("Get() of a stage without a session = %v, want session.ErrNotFound", err)
	}
}

func TestSessionsOfOneTaskCoexistPerStage(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	taskID, _ := seedSession(t, s)
	techSpec := newSession("sess-2", taskID, task.StageTechSpec)
	if err := s.Sessions.Insert(t.Context(), techSpec); err != nil {
		t.Fatalf("Insert() = %v, want nil", err)
	}

	got, err := s.Sessions.Get(t.Context(), taskID, string(task.StageTechSpec))
	if err != nil {
		t.Fatalf("Get() = %v, want nil", err)
	}
	if diff := cmp.Diff(techSpec, got); diff != "" {
		t.Errorf("Get() mismatch (-want +got):\n%s", diff)
	}
	if _, err := s.Sessions.Get(t.Context(), taskID, string(task.StagePRD)); err != nil {
		t.Errorf("Get() of the first stage = %v, want nil", err)
	}
}

func TestSessionsRejectTheSameStageTwice(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	taskID, _ := seedSession(t, s)

	if err := s.Sessions.Insert(t.Context(), newSession("sess-2", taskID, task.StagePRD)); err == nil {
		t.Error("Insert() of a repeated stage = nil, want error")
	}
}

func TestSessionsUpdateRewritesEveryMutableColumn(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	taskID, sessionID := seedSession(t, s)

	want := newSession(sessionID, taskID, task.StagePRD)
	want.Started = true
	want.Paused = true
	want.ContextTokens = 12_000
	want.ContextWindow = 200_000
	want.Corrections = 2
	want.LastError = "the process exited"
	want.UpdatedAt = fixedTime.Add(time.Minute)
	if err := s.Sessions.Update(t.Context(), want); err != nil {
		t.Fatalf("Update() = %v, want nil", err)
	}

	got, err := s.Sessions.Get(t.Context(), taskID, string(task.StagePRD))
	if err != nil {
		t.Fatalf("Get() = %v, want nil", err)
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("Get() mismatch (-want +got):\n%s", diff)
	}
}

func TestSessionsUpdateClearsTheLastError(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	taskID, sessionID := seedSession(t, s)

	failed := newSession(sessionID, taskID, task.StagePRD)
	failed.LastError = "boom"
	if err := s.Sessions.Update(t.Context(), failed); err != nil {
		t.Fatalf("Update() = %v, want nil", err)
	}

	healthy := newSession(sessionID, taskID, task.StagePRD)
	if err := s.Sessions.Update(t.Context(), healthy); err != nil {
		t.Fatalf("Update() = %v, want nil", err)
	}

	got, err := s.Sessions.Get(t.Context(), taskID, string(task.StagePRD))
	if err != nil {
		t.Fatalf("Get() = %v, want nil", err)
	}
	if got.LastError != "" {
		t.Errorf("LastError = %q, want empty", got.LastError)
	}
}

func TestSessionsInsertRejectsAnUnknownTask(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	if err := s.Sessions.Insert(t.Context(), newSession("sess-1", "nope", task.StagePRD)); err == nil {
		t.Error("Insert() = nil, want error")
	}
}

func TestSessionsDeleteTakesTheStagesAndTheirEntries(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	taskID, sessionID := seedSession(t, s)
	if err := s.Sessions.Insert(t.Context(), newSession("sess-2", taskID, task.StageTechSpec)); err != nil {
		t.Fatalf("Insert() = %v, want nil", err)
	}
	if err := s.Entries.Insert(t.Context(), sessionID, newEntry("entry-1", 1, "hello")); err != nil {
		t.Fatalf("Entries.Insert() = %v, want nil", err)
	}

	// The plan has no session at all, which Delete takes in its stride.
	stages := []string{string(task.StagePRD), string(task.StagePlan)}
	if err := s.Sessions.Delete(t.Context(), taskID, stages...); err != nil {
		t.Fatalf("Delete() = %v, want nil", err)
	}

	if _, err := s.Sessions.Get(t.Context(), taskID, string(task.StagePRD)); !errors.Is(err, session.ErrNotFound) {
		t.Errorf("Get() of the deleted stage = %v, want session.ErrNotFound", err)
	}
	if _, err := s.Sessions.Get(t.Context(), taskID, string(task.StageTechSpec)); err != nil {
		t.Errorf("Get() of the kept stage = %v, want nil", err)
	}
	entries, err := s.Entries.List(t.Context(), sessionID)
	if err != nil {
		t.Fatalf("Entries.List() = %v, want nil", err)
	}
	if len(entries) != 0 {
		t.Errorf("Entries.List() returned %d entries, want none", len(entries))
	}
}

func TestSessionsDeleteWithoutStagesDoesNothing(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	taskID, _ := seedSession(t, s)

	if err := s.Sessions.Delete(t.Context(), taskID); err != nil {
		t.Fatalf("Delete() = %v, want nil", err)
	}
	if _, err := s.Sessions.Get(t.Context(), taskID, string(task.StagePRD)); err != nil {
		t.Errorf("Get() = %v, want nil", err)
	}
}
