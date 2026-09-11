package store_test

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/attention"
	"github.com/guilhermt/myspec/internal/store"
)

// listSituations reads the situations of the given tasks, failing the test on
// error.
func listSituations(t *testing.T, s *store.Store, taskIDs ...string) []attention.Record {
	t.Helper()

	list, err := s.Situations.ListByTasks(t.Context(), taskIDs)
	if err != nil {
		t.Fatalf("ListByTasks(%v) = %v, want nil", taskIDs, err)
	}
	return list
}

// upsertSituations stores situations, failing the test on error.
func upsertSituations(t *testing.T, s *store.Store, recs ...attention.Record) {
	t.Helper()

	for _, rec := range recs {
		if err := s.Situations.Upsert(t.Context(), rec); err != nil {
			t.Fatalf("Upsert(%s of %s) = %v, want nil", rec.Place, rec.TaskID, err)
		}
	}
}

// newSituation builds the situation of a task at a place, ready to upsert.
func newSituation(taskID, place, id string, kind attention.Kind) attention.Record {
	return attention.Record{TaskID: taskID, Place: place, ID: id, Kind: kind, StartedAt: fixedTime}
}

func TestSituationsUpsertAndListByTasks(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	first := seedTask(t, s)
	const second = "task-2"
	if err := s.Tasks.Insert(t.Context(), newTask(second, "/ws", "two", fixedTime)); err != nil {
		t.Fatalf("Tasks.Insert(two) = %v, want nil", err)
	}

	web := newSituation(second, "repo:/ws/web", "situation-3", attention.KindDraft)
	api := newSituation(second, "repo:/ws/api", "situation-2", attention.KindFindings)
	prd := newSituation(first, "stage:prd", "situation-1", attention.KindReply)
	upsertSituations(t, s, web, api, prd)

	want := []attention.Record{prd, api, web}
	if diff := cmp.Diff(want, listSituations(t, s, first, second)); diff != "" {
		t.Errorf("ListByTasks() mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]attention.Record{prd}, listSituations(t, s, first)); diff != "" {
		t.Errorf("ListByTasks(first) mismatch (-want +got):\n%s", diff)
	}
}

func TestSituationsUpsertReplacesTheSituationOfAPlace(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	taskID := seedTask(t, s)
	upsertSituations(t, s, newSituation(taskID, "step:2", "situation-1", attention.KindPermission))

	replaced := attention.Record{
		TaskID:    taskID,
		Place:     "step:2",
		ID:        "situation-2",
		Kind:      attention.KindStepReview,
		StartedAt: fixedTime.Add(time.Hour),
	}
	upsertSituations(t, s, replaced)

	if diff := cmp.Diff([]attention.Record{replaced}, listSituations(t, s, taskID)); diff != "" {
		t.Errorf("ListByTasks() after the second upsert mismatch (-want +got):\n%s", diff)
	}
}

func TestSituationsDeleteRemovesOnlyItsPlace(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	taskID := seedTask(t, s)
	api := newSituation(taskID, "repo:/ws/api", "situation-1", attention.KindDraft)
	web := newSituation(taskID, "repo:/ws/web", "situation-2", attention.KindMerge)
	upsertSituations(t, s, api, web)

	if err := s.Situations.Delete(t.Context(), taskID, api.Place); err != nil {
		t.Fatalf("Delete() = %v, want nil", err)
	}
	if diff := cmp.Diff([]attention.Record{web}, listSituations(t, s, taskID)); diff != "" {
		t.Errorf("ListByTasks() after the delete mismatch (-want +got):\n%s", diff)
	}
	// A place without a situation is not an error either.
	if err := s.Situations.Delete(t.Context(), taskID, api.Place); err != nil {
		t.Errorf("Delete() again = %v, want nil", err)
	}
}

func TestSituationsGoWithTheirTask(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	taskID := seedTask(t, s)
	upsertSituations(t, s, newSituation(taskID, "stage:prd", "situation-1", attention.KindReply))

	if err := s.Tasks.Delete(t.Context(), taskID); err != nil {
		t.Fatalf("Tasks.Delete() = %v, want nil", err)
	}
	if got := listSituations(t, s, taskID); len(got) != 0 {
		t.Errorf("ListByTasks() returned %d situations, want the cascade to have taken them", len(got))
	}
}

func TestSituationsListByNoTasksAsksNothing(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	if got := listSituations(t, s); got != nil {
		t.Errorf("ListByTasks() = %v, want nil", got)
	}
}
