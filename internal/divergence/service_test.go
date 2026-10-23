package divergence_test

import (
	"context"
	"errors"
	"log/slog"
	"slices"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/divergence"
)

var epoch = time.Date(2026, time.October, 1, 10, 0, 0, 0, time.UTC)

// fakeStore keeps the rows in memory.
type fakeStore struct {
	rows    map[string]divergence.Row
	failPut error
	failDel error
}

func newFakeStore() *fakeStore { return &fakeStore{rows: map[string]divergence.Row{}} }

func (f *fakeStore) Divergences(context.Context) ([]divergence.Row, error) {
	list := make([]divergence.Row, 0, len(f.rows))
	for _, row := range f.rows {
		list = append(list, row)
	}
	return list, nil
}

func (f *fakeStore) PutDivergence(_ context.Context, row divergence.Row) error {
	if f.failPut != nil {
		return f.failPut
	}
	f.rows[row.ItemID] = row
	return nil
}

func (f *fakeStore) DeleteDivergence(_ context.Context, itemID string) error {
	if f.failDel != nil {
		return f.failDel
	}
	delete(f.rows, itemID)
	return nil
}

// fixture is a service over a fake store, with the clock and the changes it
// told.
type fixture struct {
	svc     *divergence.Service
	store   *fakeStore
	now     time.Time
	changed []string
}

func newFixture(t *testing.T) *fixture {
	t.Helper()

	f := &fixture{store: newFakeStore(), now: epoch}
	f.svc = divergence.New(divergence.Deps{
		Store:    f.store,
		Log:      slog.New(slog.DiscardHandler),
		Now:      func() time.Time { return f.now },
		OnChange: func(id string) { f.changed = append(f.changed, id) },
	})
	return f
}

func commitMissing(files int) divergence.Divergence {
	return divergence.Divergence{
		ItemID: "task-1", Stage: "step:3", Kind: divergence.KindCommitMissing,
		Facts: divergence.Facts{Branch: "153-x", Files: files},
	}
}

func mustOpen(t *testing.T, f *fixture, d divergence.Divergence) bool {
	t.Helper()

	opened, err := f.svc.Open(t.Context(), d)
	if err != nil {
		t.Fatalf("Open() = %v, want nil", err)
	}
	return opened
}

func TestOpenRecordsTheDivergence(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	if !mustOpen(t, f, commitMissing(2)) {
		t.Fatal("Open() = false, want true for a new divergence")
	}

	want := commitMissing(2)
	want.StartedAt = epoch
	got, ok := f.svc.Get("task-1")
	if !ok {
		t.Fatal("Get() found nothing, want the divergence")
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("Get() mismatch (-want +got):\n%s", diff)
	}
	if len(f.store.rows) != 1 {
		t.Errorf("rows = %d, want 1", len(f.store.rows))
	}
	if diff := cmp.Diff([]string{"task-1"}, f.changed); diff != "" {
		t.Errorf("OnChange mismatch (-want +got):\n%s", diff)
	}
}

func TestOpenTheSameDivergenceAgainChangesNothing(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	mustOpen(t, f, commitMissing(2))
	f.now = epoch.Add(time.Hour)

	if mustOpen(t, f, commitMissing(2)) {
		t.Error("Open(same) = true, want false")
	}
	if len(f.changed) != 1 {
		t.Errorf("OnChange called %d times, want 1", len(f.changed))
	}
}

func TestOpenNewFactsOfTheSameKindKeepWhenItStarted(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	mustOpen(t, f, commitMissing(2))
	f.now = epoch.Add(time.Hour)

	if !mustOpen(t, f, commitMissing(5)) {
		t.Fatal("Open(new facts) = false, want true")
	}

	got, _ := f.svc.Get("task-1")
	if !got.StartedAt.Equal(epoch) || got.Facts.Files != 5 {
		t.Errorf("Get() = started %v, files %d, want started %v, files 5", got.StartedAt, got.Facts.Files, epoch)
	}
}

func TestOpenAnotherKindOrStageStartsAgain(t *testing.T) {
	t.Parallel()
	for name, mutate := range map[string]func(*divergence.Divergence){
		"kind":  func(d *divergence.Divergence) { d.Kind = divergence.KindReportMissing },
		"stage": func(d *divergence.Divergence) { d.Stage = "step:4" },
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			f := newFixture(t)
			mustOpen(t, f, commitMissing(2))
			f.now = epoch.Add(time.Hour)

			next := commitMissing(2)
			mutate(&next)
			if !mustOpen(t, f, next) {
				t.Fatal("Open() = false, want true")
			}

			got, _ := f.svc.Get("task-1")
			if !got.StartedAt.Equal(f.now) {
				t.Errorf("StartedAt = %v, want %v", got.StartedAt, f.now)
			}
			if len(f.store.rows) != 1 {
				t.Errorf("rows = %d, want 1: an item has one divergence", len(f.store.rows))
			}
		})
	}
}

func TestOpenWhenTheStoreFailsKeepsTheCache(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.store.failPut = errors.New("disk")

	if _, err := f.svc.Open(t.Context(), commitMissing(2)); err == nil {
		t.Fatal("Open() = nil, want the error")
	}
	if _, ok := f.svc.Get("task-1"); ok {
		t.Error("Get() found a divergence the store never kept")
	}
	if len(f.changed) != 0 {
		t.Errorf("OnChange called %d times, want none", len(f.changed))
	}
}

func TestClear(t *testing.T) {
	t.Parallel()
	for name, tc := range map[string]struct {
		kinds     []divergence.Kind
		wantAfter bool
		wantTold  int
	}{
		"without kinds":    {wantAfter: false, wantTold: 2},
		"a kind it is":     {kinds: []divergence.Kind{divergence.KindReportMissing, divergence.KindCommitMissing}, wantAfter: false, wantTold: 2},
		"only other kinds": {kinds: []divergence.Kind{divergence.KindReportMissing}, wantAfter: true, wantTold: 1},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			f := newFixture(t)
			mustOpen(t, f, commitMissing(2))

			if err := f.svc.Clear(t.Context(), "task-1", tc.kinds...); err != nil {
				t.Fatalf("Clear() = %v, want nil", err)
			}

			if _, ok := f.svc.Get("task-1"); ok != tc.wantAfter {
				t.Errorf("Get() found = %v, want %v", ok, tc.wantAfter)
			}
			if len(f.store.rows) == 1 != tc.wantAfter {
				t.Errorf("rows = %d, want the row kept = %v", len(f.store.rows), tc.wantAfter)
			}
			if len(f.changed) != tc.wantTold {
				t.Errorf("OnChange called %d times, want %d", len(f.changed), tc.wantTold)
			}
		})
	}
}

func TestClearWithNothingToClearIsQuiet(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	if err := f.svc.Clear(t.Context(), "task-1"); err != nil {
		t.Fatalf("Clear() = %v, want nil", err)
	}
	if len(f.changed) != 0 {
		t.Errorf("OnChange called %d times, want none", len(f.changed))
	}
}

func TestClearWhenTheStoreFailsKeepsTheDivergence(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	mustOpen(t, f, commitMissing(2))
	f.store.failDel = errors.New("disk")

	if err := f.svc.Clear(t.Context(), "task-1"); err == nil {
		t.Fatal("Clear() = nil, want the error")
	}
	if _, ok := f.svc.Get("task-1"); !ok {
		t.Error("Get() found nothing, want the divergence the store still has")
	}
}

func TestGetReturnsACopy(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	d := divergence.Divergence{
		ItemID: "task-1", Stage: "pr", Kind: divergence.KindPRsAmbiguous,
		Facts: divergence.Facts{PRs: []divergence.PR{{Number: 1}}, Candidates: []string{"a"}},
	}
	mustOpen(t, f, d)

	got, _ := f.svc.Get("task-1")
	got.Facts.PRs[0].Number = 99
	got.Facts.Candidates[0] = "z"

	again, _ := f.svc.Get("task-1")
	if again.Facts.PRs[0].Number != 1 || !slices.Equal(again.Facts.Candidates, []string{"a"}) {
		t.Errorf("Get() = %+v, want the cache untouched", again.Facts)
	}
}

func TestForgetDropsOnlyTheCache(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	mustOpen(t, f, commitMissing(2))

	f.svc.Forget("task-1")

	if _, ok := f.svc.Get("task-1"); ok {
		t.Error("Get() found the divergence of a forgotten item")
	}
}

func TestLoadReadsTheRowsAndDropsWhatItCannotRead(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.store.rows["ok"] = divergence.Row{
		ItemID: "ok", Stage: "pr", Kind: "push_rejected", Facts: `{"branch":"b","files":0}`, StartedAt: epoch,
	}
	f.store.rows["unknown"] = divergence.Row{ItemID: "unknown", Stage: "pr", Kind: "from_the_future", Facts: `{}`, StartedAt: epoch}
	f.store.rows["broken"] = divergence.Row{ItemID: "broken", Stage: "pr", Kind: "push_rejected", Facts: `{`, StartedAt: epoch}

	if err := f.svc.Load(t.Context()); err != nil {
		t.Fatalf("Load() = %v, want nil", err)
	}

	got, ok := f.svc.Get("ok")
	if !ok || got.Kind != divergence.KindPushRejected || got.Facts.Branch != "b" || got.Stage != "pr" {
		t.Errorf("Get(ok) = %+v, %v, want the push_rejected of branch b", got, ok)
	}
	for _, id := range []string{"unknown", "broken"} {
		if _, found := f.svc.Get(id); found {
			t.Errorf("Get(%s) found a divergence, want it dropped", id)
		}
	}
}
