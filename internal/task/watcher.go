package task

import (
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

// artifactDebounce is how long a folder must stay quiet before the artifact in
// it is read. An agent writing a file produces a burst of events and the
// product only cares about the file left behind.
const artifactDebounce = 300 * time.Millisecond

// artifactOps are the events that can make an artifact appear or disappear.
const artifactOps = fsnotify.Create | fsnotify.Write | fsnotify.Rename | fsnotify.Remove

// debounce is the wait in flight for one task, with the artifacts touched
// while it ran down. The generation tells a timer that already fired from the
// one that replaced it, so a write landing at the moment of the deadline
// reports the folder once, not twice.
type debounce struct {
	timer *time.Timer
	gen   uint64
	kinds map[ArtifactKind]struct{}
}

// watched is a folder the watcher follows: the task it belongs to, and which
// artifact it holds. An empty kind is the artifact folder of the task itself,
// where the file tells the artifact apart.
type watched struct {
	taskID string
	kind   ArtifactKind
}

// watcher turns the filesystem noise of the artifact folders into one settled
// call per task.
type watcher struct {
	fs      *fsnotify.Watcher
	log     *slog.Logger
	settled func(taskID string, kinds []ArtifactKind)

	mu      sync.Mutex
	dirs    map[string]watched  // watched folder -> what it is
	pending map[string]debounce // task id -> wait in flight
	closed  bool
}

// newWatcher starts a watcher that calls settled for every task whose artifact
// folder went quiet.
func newWatcher(log *slog.Logger, settled func(taskID string, kinds []ArtifactKind)) (*watcher, error) {
	fsw, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, fmt.Errorf("create artifact watcher: %w", err)
	}

	w := &watcher{
		fs:      fsw,
		log:     log,
		settled: settled,
		dirs:    map[string]watched{},
		pending: map[string]debounce{},
	}
	go w.run()
	return w, nil
}

// watch follows the artifact folder of a task, creating it when it is gone,
// and the steps and pr folders inside it when a stage already made them.
func (w *watcher) watch(taskID, dir string) error {
	if err := os.MkdirAll(dir, dirPerm); err != nil {
		return fmt.Errorf("create artifacts directory %s: %w", dir, err)
	}

	w.mu.Lock()
	w.dirs[dir] = watched{taskID: taskID}
	w.mu.Unlock()

	if err := w.fs.Add(dir); err != nil {
		return fmt.Errorf("watch artifacts directory %s: %w", dir, err)
	}

	for _, sub := range subFolders {
		path := filepath.Join(dir, sub.name)
		if info, err := os.Stat(path); err == nil && info.IsDir() {
			w.addFolder(taskID, path, sub.kind)
		}
	}
	return nil
}

// subFolders are the folders of artifacts inside the folder of a task, each
// one followed on its own.
var subFolders = []struct {
	name string
	kind ArtifactKind
}{
	{name: StepsDirName, kind: ArtifactPlan},
	{name: PRDirName, kind: ArtifactPR},
}

// unwatch stops following the folders of a task and drops its pending wait.
func (w *watcher) unwatch(taskID, dir string) {
	paths := make([]string, 0, 1+len(subFolders))
	paths = append(paths, dir)
	for _, sub := range subFolders {
		paths = append(paths, filepath.Join(dir, sub.name))
	}
	for _, path := range paths {
		if err := w.fs.Remove(path); err != nil && !errors.Is(err, fsnotify.ErrNonExistentWatch) {
			w.log.Warn("unwatch artifacts directory failed", "path", path, "error", err)
		}
	}

	w.mu.Lock()
	defer w.mu.Unlock()

	for _, path := range paths {
		delete(w.dirs, path)
	}
	if p, ok := w.pending[taskID]; ok {
		p.timer.Stop()
		delete(w.pending, taskID)
	}
}

// addFolder follows a folder of artifacts inside the folder of a task. A
// folder the watcher cannot follow only costs the automatic detection of what
// is written into it.
func (w *watcher) addFolder(taskID, dir string, kind ArtifactKind) {
	if err := w.fs.Add(dir); err != nil {
		w.log.Warn("watch artifact directory failed", "task", taskID, "path", dir, "error", err)
		return
	}

	w.mu.Lock()
	defer w.mu.Unlock()

	w.dirs[dir] = watched{taskID: taskID, kind: kind}
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

// handle arms the wait of the task the event belongs to, recording which
// artifact it touched.
func (w *watcher) handle(ev fsnotify.Event) {
	if !ev.Has(artifactOps) {
		return
	}

	w.mu.Lock()
	where, ok := w.dirs[filepath.Dir(ev.Name)]
	w.mu.Unlock()
	if !ok {
		return
	}

	kind, ok := w.kindOf(ev, where)
	if !ok {
		return
	}
	w.arm(where.taskID, kind)
}

// kindOf names the artifact an event touched, and follows the folders of
// artifacts as they come and go.
func (w *watcher) kindOf(ev fsnotify.Event, where watched) (ArtifactKind, bool) {
	name := filepath.Base(ev.Name)
	if where.kind != "" {
		// The agent writes the drafts and the reports whole; a hidden file is
		// an editor of its own passing through.
		if where.kind == ArtifactPR && strings.HasPrefix(name, ".") {
			return "", false
		}
		return where.kind, true
	}

	switch name {
	case PRDFile:
		return ArtifactPRD, true
	case TechSpecFile:
		return ArtifactTechSpec, true
	case StepsDirName, PRDirName:
		kind := ArtifactPlan
		if name == PRDirName {
			kind = ArtifactPR
		}
		if ev.Has(fsnotify.Create) {
			w.addFolder(where.taskID, ev.Name, kind)
		}
		if ev.Has(fsnotify.Remove | fsnotify.Rename) {
			w.mu.Lock()
			delete(w.dirs, ev.Name)
			w.mu.Unlock()
		}
		return kind, true
	default:
		return "", false
	}
}

// arm restarts the wait of a task with the artifact added to what it saw.
func (w *watcher) arm(taskID string, kind ArtifactKind) {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.closed {
		return
	}

	p := w.pending[taskID]
	if p.timer != nil {
		p.timer.Stop()
	}
	if p.kinds == nil {
		p.kinds = map[ArtifactKind]struct{}{}
	}
	p.kinds[kind] = struct{}{}
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

	if !current {
		return
	}
	kinds := slices.Sorted(maps.Keys(p.kinds))
	w.settled(taskID, kinds)
}
