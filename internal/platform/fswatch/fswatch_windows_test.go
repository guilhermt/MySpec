package fswatch_test

import (
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"testing"
	"time"
)

// writeUntilStopped writes path over and over, as an agent writing a file
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

// Forgetting a group whose folder has events in flight is what makes fsnotify
// close a handle twice when a folder is removed on its own, and the process
// dies. Each round forgets a group while its folder is written, then deletes
// the folder, which Windows only allows once the watcher let go of it.
func TestForgettingAGroupWhileItsFolderIsWrittenLetsTheFolderGo(t *testing.T) {
	t.Parallel()
	w, _ := start(t)
	root := t.TempDir()

	for round := range 50 {
		name := strconv.Itoa(round)
		dir := filepath.Join(root, name)
		if err := os.Mkdir(dir, 0o700); err != nil {
			t.Fatalf("Mkdir(%s) = %v, want nil", dir, err)
		}
		if err := w.Add(name, dir); err != nil {
			t.Fatalf("Add(%s) = %v, want nil", dir, err)
		}

		stop := writeUntilStopped(t, filepath.Join(dir, "notes.md"))
		if err := w.Forget(name, []string{dir}); err != nil {
			t.Fatalf("Forget(%s) = %v, want nil", name, err)
		}
		stop()

		if err := os.RemoveAll(dir); err != nil {
			t.Fatalf("RemoveAll(%s) = %v, want nil", dir, err)
		}
	}
}
