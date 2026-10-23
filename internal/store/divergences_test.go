package store_test

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/divergence"
	"github.com/guilhermt/myspec/internal/store"
)

// newDivergenceRow builds the divergence of an item, ready to put.
func newDivergenceRow(itemID string) divergence.Row {
	return divergence.Row{
		ItemID:    itemID,
		Stage:     "step:3",
		Kind:      string(divergence.KindCommitMissing),
		Facts:     `{"branch":"153-x","files":2}`,
		StartedAt: fixedTime,
	}
}

func listDivergences(t *testing.T, s *store.Store) []divergence.Row {
	t.Helper()

	list, err := s.Divergences(t.Context())
	if err != nil {
		t.Fatalf("Divergences() = %v, want nil", err)
	}
	return list
}

func TestDivergencesPutAndList(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)
	taskID := seedTask(t, s)

	want := newDivergenceRow(taskID)
	if err := s.PutDivergence(t.Context(), want); err != nil {
		t.Fatalf("PutDivergence() = %v, want nil", err)
	}

	if diff := cmp.Diff([]divergence.Row{want}, listDivergences(t, s)); diff != "" {
		t.Errorf("Divergences() mismatch (-want +got):\n%s", diff)
	}
}

func TestDivergencesPutReplacesTheOneOfTheItem(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)
	taskID := seedTask(t, s)

	if err := s.PutDivergence(t.Context(), newDivergenceRow(taskID)); err != nil {
		t.Fatalf("PutDivergence() = %v, want nil", err)
	}
	want := newDivergenceRow(taskID)
	want.Stage, want.Kind, want.Facts = "pr", string(divergence.KindPRNotOpened), `{"base":"dev"}`
	want.StartedAt = fixedTime.Add(time.Hour)
	if err := s.PutDivergence(t.Context(), want); err != nil {
		t.Fatalf("PutDivergence() again = %v, want nil", err)
	}

	if diff := cmp.Diff([]divergence.Row{want}, listDivergences(t, s)); diff != "" {
		t.Errorf("Divergences() mismatch (-want +got):\n%s", diff)
	}
}

func TestDivergencesDelete(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)
	taskID := seedTask(t, s)

	if err := s.PutDivergence(t.Context(), newDivergenceRow(taskID)); err != nil {
		t.Fatalf("PutDivergence() = %v, want nil", err)
	}
	for range 2 {
		if err := s.DeleteDivergence(t.Context(), taskID); err != nil {
			t.Fatalf("DeleteDivergence() = %v, want nil", err)
		}
	}

	if got := listDivergences(t, s); len(got) != 0 {
		t.Errorf("Divergences() = %v, want none", got)
	}
}

func TestDivergencesGoWithTheirItem(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)
	taskID := seedTask(t, s)

	if err := s.PutDivergence(t.Context(), newDivergenceRow(taskID)); err != nil {
		t.Fatalf("PutDivergence() = %v, want nil", err)
	}
	if err := s.Tasks.Delete(t.Context(), taskID); err != nil {
		t.Fatalf("Delete() = %v, want nil", err)
	}

	if got := listDivergences(t, s); len(got) != 0 {
		t.Errorf("Divergences() = %v, want none after the item went", got)
	}
}

func TestDivergencesRefuseAnUnknownItem(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	if err := s.PutDivergence(t.Context(), newDivergenceRow("missing")); err == nil {
		t.Error("PutDivergence(unknown item) = nil, want an error")
	}
}
