package pulls_test

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/pulls"
)

func TestARefreshAskedWhileAReadingRunsBecomesOneReadingAfterIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.github.reply(queryList, load(t, "list_partial.json"), nil)
	release := f.github.hold()

	f.service.Refresh()
	waitCalls(t, f.github, queryList, 1)
	f.service.Refresh()
	f.service.Refresh()
	if !f.service.Reading() {
		t.Fatalf("Reading() = false while the first reading runs, want true")
	}
	release()
	waitReading(t, f.service)

	if got := len(f.github.made(queryList)); got != 2 {
		t.Errorf("the service made %d list queries, want two: the one that ran and one for both refreshes", got)
	}
	if got := f.service.ReadAt(); !got.Equal(base) {
		t.Errorf("ReadAt() = %v, want %v", got, base)
	}
}

func TestTheAccountOfGHIsReadOnceAcrossReadings(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.github.reply(queryList, load(t, "list_partial.json"), nil)
	if got := f.service.Viewer(); got != "" {
		t.Errorf("Viewer() = %q before the first reading, want it empty", got)
	}

	f.refresh(t)
	f.refresh(t)

	if got := f.service.Viewer(); got != "guilhermt" {
		t.Errorf("Viewer() = %q, want %q", got, "guilhermt")
	}
	if got := len(f.github.made(queryViewer)); got != 1 {
		t.Errorf("the service read the account %d times, want once", got)
	}
}

func TestAReadingThatFailedAltogetherKeepsWhatTheOneBeforeItFound(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.github.reply(queryList, load(t, "list_partial.json"), nil)
	f.refresh(t)

	f.github.reply(queryList, gh.Response{}, gh.ErrNotAuthenticated)
	f.refresh(t)

	for _, id := range []string{alphaID, betaID, gammaID} {
		reading := f.reading(t, id)
		if reading.Failure == nil || reading.Failure.Reason != pulls.ReasonUnauthenticated {
			t.Errorf("the failure of %s = %v, want %s", id, reading.Failure, pulls.ReasonUnauthenticated)
		}
	}
	if got := len(f.reading(t, alphaID).PullRequests); got != 2 {
		t.Errorf("acme/alpha kept %d pull requests, want the two the reading before found", got)
	}
}

func TestAReadingThatCouldNotReadTheAccountFailsEveryRepository(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.github.reply(queryViewer, gh.Response{}, gh.ErrNotFound)
	f.github.reply(queryList, load(t, "list_partial.json"), nil)
	f.refresh(t)

	if got := f.reading(t, alphaID).Failure; got == nil || got.Reason != pulls.ReasonGHMissing {
		t.Errorf("the failure of acme/alpha = %v, want %s", got, pulls.ReasonGHMissing)
	}
	if got := len(f.github.made(queryList)); got != 0 {
		t.Errorf("the service made %d list queries without an account, want none", got)
	}
}

func TestARepositoryNoLongerRegisteredLeavesTheReadings(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.github.reply(queryList, load(t, "list_partial.json"), nil)
	f.refresh(t)
	if got := len(f.service.Readings()); got != 3 {
		t.Fatalf("Readings() = %d repositories, want three", got)
	}

	f.remove(betaID)
	f.refresh(t)

	readings := f.service.Readings()
	got := make([]string, 0, len(readings))
	for _, r := range readings {
		got = append(got, r.RepositoryID)
	}
	if diff := cmp.Diff([]string{alphaID, gammaID}, got); diff != "" {
		t.Errorf("Readings() (-want +got):\n%s", diff)
	}
	if _, ok := f.service.Find(betaID, 1); ok {
		t.Errorf("Find() still answers for a repository nobody registered")
	}
}

func TestEveryReadingTellsTheAppThatSomethingChanged(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.github.reply(queryList, load(t, "list_partial.json"), nil)
	f.refresh(t)

	// One for the reading that started, one for the reading that ended.
	if got := f.changes.count(); got != 2 {
		t.Errorf("OnChange was called %d times, want twice", got)
	}
}

func TestAClosedServiceReadsNothingMore(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.github.reply(queryList, load(t, "list_partial.json"), nil)
	f.service.Close()
	f.service.Refresh()

	if f.service.Reading() {
		t.Errorf("Reading() = true after Close(), want false")
	}
	if got := len(f.github.made(queryList)); got != 0 {
		t.Errorf("the service made %d list queries after Close(), want none", got)
	}
}

func TestARefreshWaitingWhenTheServiceClosesIsDropped(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.github.reply(queryList, load(t, "list_partial.json"), nil)
	f.github.hold()

	f.service.Refresh()
	waitCalls(t, f.github, queryList, 1)
	f.service.Refresh()
	f.service.Close()
	waitReading(t, f.service)

	if got := len(f.github.made(queryList)); got != 1 {
		t.Errorf("the service made %d list queries, want only the one that ran before Close()", got)
	}
	// One for the reading that started, one for the reading Close() ended.
	if got := f.changes.count(); got != 2 {
		t.Errorf("OnChange was called %d times, want twice", got)
	}
}

func TestTheFiltersOfTheViewSurviveTheApp(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	want := pulls.Filters{
		BoardID:        "board-1",
		AuthorsExclude: []string{"dependabot"},
		AuthorsInclude: []string{},
		LabelsInclude:  []string{},
		LabelsExclude:  []string{},
		PendingOnly:    true,
	}
	if err := f.service.SetFilters(t.Context(), want); err != nil {
		t.Fatalf("SetFilters() = %v, want nil", err)
	}

	next := pulls.New(pulls.Deps{GitHub: f.github, Repositories: f.repositories, Settings: f.settings})
	t.Cleanup(next.Close)
	if err := next.Sync(t.Context()); err != nil {
		t.Fatalf("Sync() = %v, want nil", err)
	}
	if diff := cmp.Diff(want, next.Filters()); diff != "" {
		t.Errorf("Filters() (-want +got):\n%s", diff)
	}
	if !json.Valid([]byte(f.settings.get("review_filters"))) {
		t.Errorf("the stored filters are not JSON: %q", f.settings.get("review_filters"))
	}
}

func TestFiltersStoredUnreadableShowEverything(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	if err := f.settings.Set(t.Context(), "review_filters", "{"); err != nil {
		t.Fatalf("Set() = %v, want nil", err)
	}
	if err := f.service.Sync(t.Context()); err != nil {
		t.Fatalf("Sync() = %v, want nil", err)
	}

	want := pulls.Filters{
		AuthorsInclude: []string{}, AuthorsExclude: []string{},
		LabelsInclude: []string{}, LabelsExclude: []string{},
	}
	if diff := cmp.Diff(want, f.service.Filters()); diff != "" {
		t.Errorf("Filters() (-want +got):\n%s", diff)
	}
}

func TestSyncFailsWhenTheFiltersCannotBeRead(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.settings.getErr = errors.New("database is locked")
	if err := f.service.Sync(t.Context()); err == nil {
		t.Errorf("Sync() = nil, want the error of the settings")
	}
}

func TestSetFiltersFailsWhenTheyCannotBeStored(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.settings.setErr = errors.New("database is locked")
	if err := f.service.SetFilters(t.Context(), pulls.Filters{PendingOnly: true}); err == nil {
		t.Errorf("SetFilters() = nil, want the error of the settings")
	}
	if f.service.Filters().PendingOnly {
		t.Errorf("Filters() kept filters that were not stored")
	}
}

// waitCalls waits until the fake answered n queries of kind.
func waitCalls(t *testing.T, g *fakeGitHub, kind string, n int) {
	t.Helper()

	deadline := time.Now().Add(pollTimeout)
	for len(g.made(kind)) < n {
		if time.Now().After(deadline) {
			t.Fatalf("the fake answered %d queries of %q within %s, want %d", len(g.made(kind)), kind, pollTimeout, n)
		}
		time.Sleep(pollStep)
	}
}
