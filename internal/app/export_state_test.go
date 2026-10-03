package app

import (
	"context"
	"log/slog"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/platform/xdg"
)

// startedTimeout bounds how long StartedForTest waits for the startup to end.
const startedTimeout = 30 * time.Second

// StartedForTest starts an app over dirs the way Run does once the window is
// open, without the window, and returns the services the interface calls once
// the startup ended ready. The app shuts down with the test.
func StartedForTest(t *testing.T, dirs xdg.Dirs) *bindings.Services {
	t.Helper()
	if err := dirs.Ensure(); err != nil {
		t.Fatalf("prepare the directories: %v", err)
	}
	a := &App{log: slog.New(slog.DiscardHandler), dirs: dirs, services: bindings.NewWaitingServices()}
	a.deps = a.desktopDeps()
	a.publisher = newThrottle(publishWindow, a.publishNow)
	a.startup = newStartup(a.attempt, func() {}, a.log, false, dirs.Data, dirs.LogPath())
	a.pollCtx, a.stopPoll = context.WithCancel(context.Background())
	t.Cleanup(func() {
		a.shutdown()
		a.mu.Lock()
		closers := a.closers
		a.mu.Unlock()
		for i := len(closers) - 1; i >= 0; i-- {
			closers[i]()
		}
	})

	a.startup.start()
	deadline := time.Now().Add(startedTimeout)
	for {
		snapshot := a.startup.snapshot()
		switch {
		case snapshot.Phase == string(phaseReady):
			return a.services
		case snapshot.Phase == string(phaseFailed):
			t.Fatalf("the startup failed: %+v", snapshot.Failure)
		case time.Now().After(deadline):
			t.Fatalf("the startup did not end in %s: %+v", startedTimeout, snapshot)
		}
		time.Sleep(10 * time.Millisecond)
	}
}
