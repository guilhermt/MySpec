package update_test

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/update"
)

// settle is how long a test lets Run tick to see that nothing more is read.
const settle = 50 * time.Millisecond

func TestADevBuildNeverReadsGitHub(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "dev")
	status := f.Check(t.Context(), true)
	f.Run(t.Context()) // returns at once

	if status.Enabled || f.Status().Enabled {
		t.Error("a dev build is enabled")
	}
	if status.Installed != "dev" {
		t.Errorf("Installed = %q, want dev", status.Installed)
	}
	if n := f.releases.callCount(); n != 0 {
		t.Errorf("Read was called %d times, want 0", n)
	}
}

func TestACheckKeepsTheReleasesNewerThanTheInstalledOneNewestFirst(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "0.2.0")
	f.releases.set([]update.Release{
		rel(t, "0.3.0"), rel(t, "0.4.0"), rel(t, "0.2.1"), rel(t, "0.2.0"), rel(t, "0.1.0"), rel(t, "0.3.0"),
	}, nil)

	status := f.Check(t.Context(), false)

	want := []update.Release{rel(t, "0.4.0"), rel(t, "0.3.0"), rel(t, "0.2.1")}
	if diff := cmp.Diff(want, status.Newer); diff != "" {
		t.Errorf("Newer (-want +got):\n%s", diff)
	}
	latest, ok := status.Latest()
	if !ok || latest.Version != ver(t, "0.4.0") {
		t.Errorf("Latest() = %v, %v, want 0.4.0", latest.Version, ok)
	}
	if status.CheckedAt.IsZero() {
		t.Error("CheckedAt is zero after a successful check")
	}
}

func TestACheckWithoutANewerReleaseClearsWhatAnEarlierOneFound(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "0.2.0")
	f.releases.set([]update.Release{rel(t, "0.3.0")}, nil)
	f.Check(t.Context(), false)
	f.releases.set([]update.Release{rel(t, "0.2.0")}, nil)

	status := f.Check(t.Context(), false)

	if status.Newer != nil {
		t.Errorf("Newer = %v, want nil", status.Newer)
	}
	if _, ok := status.Latest(); ok {
		t.Error("Latest() found a release")
	}
}

func TestAFailedCheckKeepsWhatTheAppKnew(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "0.2.0")
	f.releases.set([]update.Release{rel(t, "0.3.0")}, nil)
	before := f.Check(t.Context(), false)
	f.clock.Advance(time.Minute)
	f.releases.set(nil, errors.New("boom"))

	after := f.Check(t.Context(), true)

	if diff := cmp.Diff(before.Newer, after.Newer); diff != "" {
		t.Errorf("Newer changed (-before +after):\n%s", diff)
	}
	if !before.CheckedAt.Equal(after.CheckedAt) {
		t.Errorf("CheckedAt moved from %v to %v", before.CheckedAt, after.CheckedAt)
	}
	if after.Failure == nil {
		t.Error("Failure is nil after a failed check the user asked for")
	}
}

func TestAFailureShowsOnlyWhenTheUserAskedForTheCheck(t *testing.T) {
	t.Parallel()

	type step struct {
		requested bool
		fails     bool
		wantShown bool
	}
	tests := []struct {
		name  string
		steps []step
	}{
		{"a requested check that fails shows", []step{{true, true, true}}},
		{"an automatic check that fails does not show", []step{{false, true, false}}},
		{"an automatic check that succeeds clears a shown failure", []step{{true, true, true}, {false, false, false}}},
		{"an automatic check that fails clears a shown failure", []step{{true, true, true}, {false, true, false}}},
		{"a requested check that succeeds shows nothing", []step{{true, false, false}}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t, "0.2.0")
			for i, s := range tt.steps {
				var err error
				if s.fails {
					err = errors.New("boom")
				}
				f.releases.set(nil, err)

				status := f.Check(t.Context(), s.requested)

				if got := status.Failure != nil; got != s.wantShown {
					t.Fatalf("step %d: failure shown = %v, want %v", i, got, s.wantShown)
				}
				if s.wantShown {
					want := &update.Failure{Kind: update.Failed, Detail: "boom"}
					if diff := cmp.Diff(want, status.Failure); diff != "" {
						t.Errorf("step %d: Failure (-want +got):\n%s", i, diff)
					}
				}
			}
		})
	}
}

func TestACheckJoinsTheOneThatRunsAndNeverDoublesIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "0.2.0")
	f.releases.block = make(chan struct{})
	f.releases.set(nil, errors.New("boom"))

	var wg sync.WaitGroup
	var automatic, requested update.Status
	wg.Go(func() { automatic = f.Check(t.Context(), false) })
	waitFor(t, "the check to run", func() bool { return f.Status().Running })
	wg.Go(func() { requested = f.Check(t.Context(), true) })
	time.Sleep(settle) // the second call must be waiting on the first by now
	close(f.releases.block)
	wg.Wait()

	if n := f.releases.callCount(); n != 1 {
		t.Errorf("Read was called %d times, want 1", n)
	}
	if requested.Failure == nil || automatic.Failure == nil {
		t.Errorf("the failure is not shown once the user asked: automatic %v, requested %v", automatic.Failure, requested.Failure)
	}
}

func TestRunChecksAtOnceAndAgainAfterAnHourOfWallClock(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "0.2.0")
	ctx, cancel := context.WithCancel(t.Context())
	done := make(chan struct{})
	go func() {
		f.Run(ctx)
		close(done)
	}()
	defer func() {
		cancel()
		<-done
	}()

	waitFor(t, "the first check", func() bool { return f.releases.callCount() == 1 && !f.Status().CheckedAt.IsZero() })
	f.clock.Advance(update.Interval - time.Second)
	time.Sleep(settle)
	if n := f.releases.callCount(); n != 1 {
		t.Fatalf("Read was called %d times before the hour, want 1", n)
	}

	f.clock.Advance(time.Second)

	waitFor(t, "the second check", func() bool { return f.releases.callCount() == 2 })
}

func TestACheckTheUserAskedForRestartsTheHour(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "0.2.0")
	ctx, cancel := context.WithCancel(t.Context())
	done := make(chan struct{})
	go func() {
		f.Run(ctx)
		close(done)
	}()
	defer func() {
		cancel()
		<-done
	}()
	waitFor(t, "the first check", func() bool { return !f.Status().CheckedAt.IsZero() })

	f.clock.Advance(30 * time.Minute)
	f.Check(ctx, true)
	f.clock.Advance(45 * time.Minute) // 75 minutes after the first check, 45 after the last
	time.Sleep(settle)
	if n := f.releases.callCount(); n != 2 {
		t.Fatalf("Read was called %d times, want 2", n)
	}

	f.clock.Advance(15 * time.Minute)

	waitFor(t, "the third check", func() bool { return f.releases.callCount() == 3 })
}

func TestAnAutomaticCheckDoesNotStartWhileOneRuns(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "0.2.0")
	f.releases.block = make(chan struct{})
	ctx, cancel := context.WithCancel(t.Context())
	done := make(chan struct{})
	go func() {
		f.Run(ctx)
		close(done)
	}()
	defer func() {
		cancel()
		<-done
	}()
	waitFor(t, "the check to run", func() bool { return f.Status().Running })

	f.clock.Advance(3 * update.Interval)
	time.Sleep(settle)
	close(f.releases.block)
	waitFor(t, "the check to end", func() bool { return !f.Status().Running })
	time.Sleep(settle)

	if n := f.releases.callCount(); n != 1 {
		t.Errorf("Read was called %d times, want 1", n)
	}
}

func TestOnChangeIsCalledWhenACheckStartsAndEnds(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "0.2.0")
	f.releases.block = make(chan struct{})

	done := make(chan struct{})
	go func() {
		f.Check(t.Context(), false)
		close(done)
	}()
	waitFor(t, "the start", func() bool { return f.changeCount() == 1 })
	if !f.Status().Running {
		t.Error("Running is false while the check runs")
	}
	close(f.releases.block)
	<-done

	if n := f.changeCount(); n != 2 {
		t.Errorf("OnChange was called %d times, want 2", n)
	}
	if f.Status().Running {
		t.Error("Running is true after the check")
	}
}

func TestACheckCutByTheAppClosingRecordsNothing(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "0.2.0")
	f.releases.block = make(chan struct{})
	ctx, cancel := context.WithCancel(t.Context())
	done := make(chan update.Status)
	go func() { done <- f.Check(ctx, true) }()
	waitFor(t, "the check to run", func() bool { return f.Status().Running })

	cancel()
	status := <-done

	if status.Running || status.Failure != nil || !status.CheckedAt.IsZero() {
		t.Errorf("status = %+v, want nothing recorded", status)
	}
	if n := f.changeCount(); n != 1 {
		t.Errorf("OnChange was called %d times, want 1", n)
	}
	if got := len(f.logs.records(t, "update check failed")) + len(f.logs.records(t, "update checked")); got != 0 {
		t.Errorf("%d records were logged, want none", got)
	}
}

func TestTheCheckLogsItsResult(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "0.2.0")
	f.releases.set([]update.Release{rel(t, "0.4.0"), rel(t, "0.3.0")}, nil)
	f.Check(t.Context(), true)
	f.releases.set(nil, errors.New("boom"))
	f.Check(t.Context(), false)

	checked := f.logs.records(t, "update checked")
	if len(checked) != 1 {
		t.Fatalf("got %d update checked records, want 1", len(checked))
	}
	wantChecked := map[string]any{"installed": "0.2.0", "latest": "0.4.0", "newer": float64(2), "requested": true}
	for k, want := range wantChecked {
		if got := checked[0][k]; got != want {
			t.Errorf("update checked %s = %v, want %v", k, got, want)
		}
	}
	if _, ok := checked[0]["duration_ms"]; !ok {
		t.Error("update checked has no duration_ms")
	}

	failed := f.logs.records(t, "update check failed")
	if len(failed) != 1 {
		t.Fatalf("got %d update check failed records, want 1", len(failed))
	}
	wantFailed := map[string]any{"installed": "0.2.0", "kind": "failed", "requested": false, "error": "boom"}
	for k, want := range wantFailed {
		if got := failed[0][k]; got != want {
			t.Errorf("update check failed %s = %v, want %v", k, got, want)
		}
	}
	if _, ok := failed[0]["duration_ms"]; !ok {
		t.Error("update check failed has no duration_ms")
	}
}
