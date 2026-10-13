package fswatch_test

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/fsnotify/fsnotify"

	"github.com/guilhermt/myspec/internal/platform/fswatch"
)

// quiet is how long a test waits for an event that should not come.
const quiet = 300 * time.Millisecond

// waitTimeout is how long a test waits for an event that should come.
const waitTimeout = 10 * time.Second

// start builds a watcher whose events land on the returned channel, closed
// with the test.
func start(t *testing.T) (*fswatch.Watcher, <-chan fsnotify.Event) {
	t.Helper()

	events := make(chan fsnotify.Event, 64)
	w, err := fswatch.New(
		func(ev fsnotify.Event) {
			select {
			case events <- ev:
			default:
			}
		},
		func(err error) { t.Errorf("watcher failed: %v", err) },
	)
	if err != nil {
		t.Fatalf("New() = %v, want nil", err)
	}
	t.Cleanup(func() {
		if err := w.Close(); err != nil {
			t.Errorf("Close() = %v, want nil", err)
		}
	})
	return w, events
}

// writeIn writes a file named name in dir and returns its path.
func writeIn(t *testing.T, dir, name string) string {
	t.Helper()

	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte("x"), 0o600); err != nil {
		t.Fatalf("WriteFile(%s) = %v, want nil", path, err)
	}
	return path
}

// waitEvent waits for an event on path.
func waitEvent(t *testing.T, events <-chan fsnotify.Event, path string) {
	t.Helper()

	timeout := time.After(waitTimeout)
	for {
		select {
		case ev := <-events:
			if ev.Name == path {
				return
			}
		case <-timeout:
			t.Fatalf("no event on %s", path)
		}
	}
}

// wantQuiet fails when an event on path comes within quiet.
func wantQuiet(t *testing.T, events <-chan fsnotify.Event, path string) {
	t.Helper()

	timeout := time.After(quiet)
	for {
		select {
		case ev := <-events:
			if ev.Name == path {
				t.Fatalf("event on %s, want none", path)
			}
		case <-timeout:
			return
		}
	}
}

func TestAFolderAddedReportsWhatIsWrittenInIt(t *testing.T) {
	t.Parallel()
	w, events := start(t)
	dir := t.TempDir()

	if err := w.Open().Add(dir); err != nil {
		t.Fatalf("Add() = %v, want nil", err)
	}

	waitEvent(t, events, writeIn(t, dir, "notes.md"))
}

func TestAForgottenGroupReportsNothingAndTheOthersCarryOn(t *testing.T) {
	t.Parallel()
	w, events := start(t)
	forgotten, kept := w.Open(), w.Open()
	forgottenDir, keptDir := t.TempDir(), t.TempDir()
	if err := forgotten.Add(forgottenDir); err != nil {
		t.Fatalf("Add(forgotten) = %v, want nil", err)
	}
	if err := kept.Add(keptDir); err != nil {
		t.Fatalf("Add(kept) = %v, want nil", err)
	}

	if err := forgotten.Forget(); err != nil {
		t.Fatalf("Forget() = %v, want nil", err)
	}
	gone := writeIn(t, forgottenDir, "notes.md")
	waitEvent(t, events, writeIn(t, keptDir, "notes.md"))

	wantQuiet(t, events, gone)
}

func TestAnAddAfterTheGroupIsForgottenIsRefusedAndReportsNothing(t *testing.T) {
	t.Parallel()
	w, events := start(t)
	group := w.Open()
	if err := group.Add(t.TempDir()); err != nil {
		t.Fatalf("Add() = %v, want nil", err)
	}
	if err := group.Forget(); err != nil {
		t.Fatalf("Forget() = %v, want nil", err)
	}

	late := t.TempDir()
	if err := group.Add(late); !errors.Is(err, fsnotify.ErrClosed) {
		t.Fatalf("Add() after Forget = %v, want ErrClosed", err)
	}

	wantQuiet(t, events, writeIn(t, late, "notes.md"))
}

func TestAGroupForgottenAgainOrNeverGivenAFolderIsNotAnError(t *testing.T) {
	t.Parallel()
	w, _ := start(t)
	group := w.Open()
	if err := group.Add(t.TempDir()); err != nil {
		t.Fatalf("Add() = %v, want nil", err)
	}

	if err := group.Forget(); err != nil {
		t.Errorf("Forget() = %v, want nil", err)
	}
	if err := group.Forget(); err != nil {
		t.Errorf("Forget() again = %v, want nil", err)
	}
	if err := w.Open().Forget(); err != nil {
		t.Errorf("Forget() of a group never given a folder = %v, want nil", err)
	}
}

func TestAddAfterCloseIsRefused(t *testing.T) {
	t.Parallel()
	w, err := fswatch.New(func(fsnotify.Event) {}, func(error) {})
	if err != nil {
		t.Fatalf("New() = %v, want nil", err)
	}
	followed := w.Open()
	if err := followed.Add(t.TempDir()); err != nil {
		t.Fatalf("Add() = %v, want nil", err)
	}
	if err := w.Close(); err != nil {
		t.Fatalf("Close() = %v, want nil", err)
	}

	if err := w.Open().Add(t.TempDir()); !errors.Is(err, fsnotify.ErrClosed) {
		t.Errorf("Add() to a new group after Close = %v, want ErrClosed", err)
	}
	if err := followed.Add(t.TempDir()); !errors.Is(err, fsnotify.ErrClosed) {
		t.Errorf("Add() to a group followed before Close = %v, want ErrClosed", err)
	}
	if err := followed.Forget(); err != nil {
		t.Errorf("Forget() after Close = %v, want nil", err)
	}
}
