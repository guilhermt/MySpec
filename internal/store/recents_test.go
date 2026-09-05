package store_test

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/store"
	"github.com/guilhermt/myspec/internal/workspace"
)

// base is a fixed instant every recents test builds its timestamps from.
var base = time.Date(2026, time.September, 5, 12, 0, 0, 0, time.UTC)

func recent(path string, offset time.Duration) workspace.Recent {
	return workspace.Recent{Path: path, Name: path[1:], LastOpenedAt: base.Add(offset)}
}

// paths returns the paths of recents, in order.
func paths(recents []workspace.Recent) []string {
	out := make([]string, len(recents))
	for i, rec := range recents {
		out[i] = rec.Path
	}
	return out
}

func touchAll(t *testing.T, s *store.Store, keep int, recents ...workspace.Recent) {
	t.Helper()
	for _, rec := range recents {
		if err := s.Recents.Touch(t.Context(), rec, keep); err != nil {
			t.Fatalf("Touch(%s) = %v, want nil", rec.Path, err)
		}
	}
}

func listRecents(t *testing.T, s *store.Store) []workspace.Recent {
	t.Helper()
	recents, err := s.Recents.List(t.Context())
	if err != nil {
		t.Fatalf("List() = %v, want nil", err)
	}
	return recents
}

func TestRecentsListIsEmptyOnAFreshDatabase(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	if got := listRecents(t, s); len(got) != 0 {
		t.Errorf("List() = %v, want empty", got)
	}
}

func TestRecentsTouchInsertsAndReadsBack(t *testing.T) {
	t.Parallel()
	s := newStore(t)
	want := recent("/home/dev/work", 0)

	touchAll(t, s, workspace.MaxRecents, want)

	got := listRecents(t, s)
	if diff := cmp.Diff([]workspace.Recent{want}, got); diff != "" {
		t.Errorf("List() mismatch (-want +got):\n%s", diff)
	}
}

func TestRecentsTouchStoresTimestampsInUTC(t *testing.T) {
	t.Parallel()
	s := newStore(t)
	zone := time.FixedZone("UTC-3", -3*60*60)
	rec := workspace.Recent{Path: "/home/dev/work", Name: "work", LastOpenedAt: base.In(zone)}

	touchAll(t, s, workspace.MaxRecents, rec)

	got := listRecents(t, s)
	if len(got) != 1 {
		t.Fatalf("List() = %v, want one entry", got)
	}
	if !got[0].LastOpenedAt.Equal(base) {
		t.Errorf("LastOpenedAt = %v, want %v", got[0].LastOpenedAt, base)
	}
	if name := got[0].LastOpenedAt.Location().String(); name != time.UTC.String() {
		t.Errorf("location = %s, want %s", name, time.UTC)
	}
}

func TestRecentsTouchUpdatesInPlace(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	touchAll(t, s, workspace.MaxRecents, workspace.Recent{Path: "/home/dev/work", Name: "old", LastOpenedAt: base})
	updated := workspace.Recent{Path: "/home/dev/work", Name: "new", LastOpenedAt: base.Add(time.Hour)}
	touchAll(t, s, workspace.MaxRecents, updated)

	got := listRecents(t, s)
	if diff := cmp.Diff([]workspace.Recent{updated}, got); diff != "" {
		t.Errorf("List() mismatch (-want +got):\n%s", diff)
	}
}

func TestRecentsListOrdersNewestFirst(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	touchAll(t, s, workspace.MaxRecents,
		recent("/middle", time.Hour),
		recent("/oldest", 0),
		recent("/newest", 2*time.Hour),
	)

	want := []string{"/newest", "/middle", "/oldest"}
	if diff := cmp.Diff(want, paths(listRecents(t, s))); diff != "" {
		t.Errorf("List() order mismatch (-want +got):\n%s", diff)
	}
}

func TestRecentsListBreaksTiesByPath(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	touchAll(t, s, workspace.MaxRecents, recent("/b", 0), recent("/a", 0), recent("/c", 0))

	want := []string{"/a", "/b", "/c"}
	if diff := cmp.Diff(want, paths(listRecents(t, s))); diff != "" {
		t.Errorf("List() order mismatch (-want +got):\n%s", diff)
	}
}

func TestRecentsTouchKeepsOnlyTheNewest(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	for i := range workspace.MaxRecents + 2 {
		touchAll(t, s, workspace.MaxRecents, recent("/w"+string(rune('a'+i)), time.Duration(i)*time.Hour))
	}

	got := listRecents(t, s)
	if len(got) != workspace.MaxRecents {
		t.Fatalf("List() has %d entries, want %d", len(got), workspace.MaxRecents)
	}
	if got[0].Path != "/wl" {
		t.Errorf("newest = %s, want /wl", got[0].Path)
	}
	if oldest := got[len(got)-1].Path; oldest != "/wc" {
		t.Errorf("oldest = %s, want /wc", oldest)
	}
}

func TestRecentsDelete(t *testing.T) {
	t.Parallel()
	s := newStore(t)
	touchAll(t, s, workspace.MaxRecents, recent("/a", 0), recent("/b", time.Hour), recent("/c", 2*time.Hour))

	if err := s.Recents.Delete(t.Context(), "/a", "/c"); err != nil {
		t.Fatalf("Delete() = %v, want nil", err)
	}

	if diff := cmp.Diff([]string{"/b"}, paths(listRecents(t, s))); diff != "" {
		t.Errorf("List() mismatch (-want +got):\n%s", diff)
	}
}

func TestRecentsDeleteWithoutPathsDoesNothing(t *testing.T) {
	t.Parallel()
	s := newStore(t)
	touchAll(t, s, workspace.MaxRecents, recent("/a", 0))

	if err := s.Recents.Delete(t.Context()); err != nil {
		t.Fatalf("Delete() = %v, want nil", err)
	}

	if diff := cmp.Diff([]string{"/a"}, paths(listRecents(t, s))); diff != "" {
		t.Errorf("List() mismatch (-want +got):\n%s", diff)
	}
}

func TestRecentsDeleteUnknownPathIsNotAnError(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	if err := s.Recents.Delete(t.Context(), "/never/opened"); err != nil {
		t.Errorf("Delete() = %v, want nil", err)
	}
}
