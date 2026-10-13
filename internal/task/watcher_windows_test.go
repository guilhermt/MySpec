package task_test

import (
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/task"
)

// writeUntilStopped writes path over and over, as an agent writing an artifact
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
			if err := os.WriteFile(path, []byte("# PRD "+strconv.Itoa(i)), 0o600); err == nil {
				once.Do(func() { close(started) })
			}
		}
	}()

	select {
	case <-started:
	case <-time.After(10 * time.Second):
		close(done)
		<-finished
		t.Fatalf("no write of %s landed", path)
	}
	return func() {
		close(done)
		<-finished
	}
}

// Stopping to follow the folder of a task while the agent writes in it could
// close a handle twice on Windows and kill the process; the fixture closes the
// service at the end and wants it to close cleanly.
func TestArchivingTasksWhileTheirArtifactsAreWrittenLeavesTheServiceWhole(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	for i := range 20 {
		created := f.create(t, "task-"+strconv.Itoa(i))
		stop := writeUntilStopped(t, filepath.Join(created.ArtifactsDir, task.PRDFile))
		if _, err := f.service.Archive(t.Context(), created.ID); err != nil {
			t.Fatalf("Archive(%s) = %v, want nil", created.ID, err)
		}
		stop()
	}
}
