package review_test

import (
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"testing"
	"time"
)

// writeUntilStopped writes path over and over, as an agent editing a file
// does, until the returned stop is called. It returns once a first write
// landed. A write that fails is ignored: the folder may go while it runs.
func writeUntilStopped(t *testing.T, path string) (stop func()) {
	t.Helper()

	done, finished, started := make(chan struct{}), make(chan struct{}), make(chan struct{})
	var once sync.Once
	go func() {
		defer close(finished)
		for i := 0; ; i++ {
			select {
			case <-done:
				return
			default:
			}
			if err := os.WriteFile(path, []byte(strconv.Itoa(i)), 0o600); err == nil {
				once.Do(func() { close(started) })
			}
		}
	}()

	select {
	case <-started:
	case <-time.After(waitTimeout):
		close(done)
		<-finished
		t.Fatalf("no write of %s landed", path)
	}
	return func() {
		close(done)
		<-finished
	}
}

// Stopping to follow a worktree while it is written could close a handle twice
// on Windows and kill the process. Each round forgets the worktree while a
// file in it is written; at the end the worktree folder goes, which Windows
// only allows once the watcher let go of it, and the fixture closes the
// service cleanly.
func TestForgettingAWorktreeWhileItIsWrittenLetsItGo(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	for range 20 {
		// Inactive, so the rounds watch without reading.
		f.svc.Track(taskID, f.wt, false)
		stop := writeUntilStopped(t, filepath.Join(f.wt.Path, "scratch.txt"))
		f.svc.Forget(taskID)
		stop()
	}

	if err := os.RemoveAll(f.wt.Path); err != nil {
		t.Errorf("RemoveAll(%s) = %v, want nil", f.wt.Path, err)
	}
}
