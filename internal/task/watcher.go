package task

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

// artifactDebounce is how long a folder must stay quiet before the artifact in
// it is read. An agent writing a file produces a burst of events and the
// product only cares about the file left behind.
const artifactDebounce = 300 * time.Millisecond

// artifactOps are the events that can make the PRD appear or disappear.
const artifactOps = fsnotify.Create | fsnotify.Write | fsnotify.Rename | fsnotify.Remove

// debounce is the wait in flight for one task. The generation tells a timer
// that already fired from the one that replaced it, so a write landing at the
// moment of the deadline reports the folder once, not twice.
type debounce struct {
	timer *time.Timer
	gen   uint64
}

// watcher turns the filesystem noise of the artifact folders into one settled
// call per task.
type watcher struct {
	fs      *fsnotify.Watcher
	log     *slog.Logger
	settled func(taskID string)

	mu      sync.Mutex
	dirs    map[string]string   // artifacts folder -> task id
	pending map[string]debounce // task id -> wait in flight
	closed  bool
}

// newWatcher starts a watcher that calls settled for every task whose artifact
// folder went quiet.
func newWatcher(log *slog.Logger, settled func(taskID string)) (*watcher, error) {
	fsw, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, fmt.Errorf("create artifact watcher: %w", err)
	}

	w := &watcher{
		fs:      fsw,
		log:     log,
		settled: settled,
		dirs:    map[string]string{},
		pending: map[string]debounce{},
	}
	go w.run()
	return w, nil
}

// watch follows the artifact folder of a task, creating it when it is gone.
func (w *watcher) watch(taskID, dir string) error {
	if err := os.MkdirAll(dir, dirPerm); err != nil {
		return fmt.Errorf("create artifacts directory %s: %w", dir, err)
	}

	w.mu.Lock()
	w.dirs[dir] = taskID
	w.mu.Unlock()

	if err := w.fs.Add(dir); err != nil {
		return fmt.Errorf("watch artifacts directory %s: %w", dir, err)
	}
	return nil
}

// unwatch stops following the folder of a task and drops its pending wait.
func (w *watcher) unwatch(taskID, dir string) {
	if err := w.fs.Remove(dir); err != nil && !errors.Is(err, fsnotify.ErrNonExistentWatch) {
		w.log.Warn("unwatch artifacts directory failed", "path", dir, "error", err)
	}

	w.mu.Lock()
	defer w.mu.Unlock()

	delete(w.dirs, dir)
	if p, ok := w.pending[taskID]; ok {
		p.timer.Stop()
		delete(w.pending, taskID)
	}
}

// close stops the goroutine and every wait in flight.
func (w *watcher) close() error {
	w.mu.Lock()
	w.closed = true
	for id, p := range w.pending {
		p.timer.Stop()
		delete(w.pending, id)
	}
	w.mu.Unlock()

	if err := w.fs.Close(); err != nil {
		return fmt.Errorf("close artifact watcher: %w", err)
	}
	return nil
}

// run drains the watcher until close shuts its channels.
func (w *watcher) run() {
	for {
		select {
		case ev, ok := <-w.fs.Events:
			if !ok {
				return
			}
			w.handle(ev)
		case err, ok := <-w.fs.Errors:
			if !ok {
				return
			}
			w.log.Warn("artifact watcher failed", "error", err)
		}
	}
}

// handle arms the wait of the task the event belongs to.
func (w *watcher) handle(ev fsnotify.Event) {
	if filepath.Base(ev.Name) != PRDFile || !ev.Has(artifactOps) {
		return
	}

	w.mu.Lock()
	defer w.mu.Unlock()

	taskID, ok := w.dirs[filepath.Dir(ev.Name)]
	if !ok || w.closed {
		return
	}

	p := w.pending[taskID]
	if p.timer != nil {
		p.timer.Stop()
	}
	p.gen++
	gen := p.gen
	p.timer = time.AfterFunc(artifactDebounce, func() { w.fire(taskID, gen) })
	w.pending[taskID] = p
}

// fire reports a settled folder, unless a later event replaced the wait or the
// watcher closed while it ran down.
func (w *watcher) fire(taskID string, gen uint64) {
	w.mu.Lock()
	p, ok := w.pending[taskID]
	current := ok && p.gen == gen && !w.closed
	if current {
		delete(w.pending, taskID)
	}
	w.mu.Unlock()

	if current {
		w.settled(taskID)
	}
}
