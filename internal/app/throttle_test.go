package app_test

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/app"
)

// testWindow is short enough for the tests and long enough for a burst to fit.
const testWindow = 20 * time.Millisecond

// waitRuns waits until fn ran want times.
func waitRuns(t *testing.T, runs *atomic.Int32, want int32) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for runs.Load() != want {
		if time.Now().After(deadline) {
			t.Fatalf("runs = %d, want %d", runs.Load(), want)
		}
		time.Sleep(time.Millisecond)
	}
}

func TestAThrottleRunsAtOnceWhenIdle(t *testing.T) {
	t.Parallel()
	var runs atomic.Int32
	th := app.NewThrottle(testWindow, func() { runs.Add(1) })

	th.Request()

	if got := runs.Load(); got != 1 {
		t.Fatalf("runs = %d right after the request, want 1", got)
	}
}

func TestAThrottleRunsABurstOnceMoreAWindowAfterItBegan(t *testing.T) {
	// No t.Parallel: it proves nothing more runs, which needs time passing.
	var (
		mu    sync.Mutex
		times []time.Time
		runs  atomic.Int32
	)
	th := app.NewThrottle(testWindow, func() {
		mu.Lock()
		times = append(times, time.Now())
		mu.Unlock()
		runs.Add(1)
	})

	began := time.Now()
	for range 10 {
		th.Request()
	}
	if got := runs.Load(); got != 1 {
		t.Fatalf("runs = %d within the window, want 1", got)
	}
	waitRuns(t, &runs, 2)
	time.Sleep(3 * testWindow)

	if got := runs.Load(); got != 2 {
		t.Fatalf("runs = %d after the burst, want 2", got)
	}
	mu.Lock()
	defer mu.Unlock()
	// Timers fire late, never early, so the bound only holds from below.
	if gap := times[1].Sub(began); gap < testWindow {
		t.Errorf("trailing run came %v after the burst began, want at least %v", gap, testWindow)
	}
}

func TestAStoppedThrottleDropsThePendingRun(t *testing.T) {
	// No t.Parallel: it proves nothing more runs, which needs time passing.
	var runs atomic.Int32
	th := app.NewThrottle(testWindow, func() { runs.Add(1) })

	th.Request()
	th.Request()
	th.Stop()
	time.Sleep(3 * testWindow)

	if got := runs.Load(); got != 1 {
		t.Fatalf("runs = %d after the stop, want 1", got)
	}
}

func TestAStoppedThrottleNeverRunsAgain(t *testing.T) {
	t.Parallel()
	var runs atomic.Int32
	th := app.NewThrottle(testWindow, func() { runs.Add(1) })

	th.Stop()
	// Idle, a request runs at once, so none running now means none ever will.
	th.Request()

	if got := runs.Load(); got != 0 {
		t.Fatalf("runs = %d after the stop, want 0", got)
	}
}
