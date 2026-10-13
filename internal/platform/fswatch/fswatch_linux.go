package fswatch

import (
	"errors"
	"fmt"
	"sync"

	"github.com/fsnotify/fsnotify"
)

// Watcher follows folders in groups. On Linux every group shares one inotify
// instance, which the system limits per user, and a folder is removed from it
// on its own.
type Watcher struct {
	fs *fsnotify.Watcher

	mu     sync.Mutex
	closed bool
	calls  sync.WaitGroup // the calls to fs in flight, which Close waits for
}

// Group is folders followed together, until it is forgotten.
type Group struct {
	w *Watcher

	mu        sync.Mutex
	dirs      []string
	forgotten bool
}

// New starts a watcher that hands every event to handle and every error to
// fail, from a goroutine of its own.
func New(handle func(fsnotify.Event), fail func(error)) (*Watcher, error) {
	fsw, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, fmt.Errorf("create watcher: %w", err)
	}
	go drain(fsw, handle, fail)
	return &Watcher{fs: fsw}, nil
}

// Open starts a group with no folder in it.
func (w *Watcher) Open() *Group {
	return &Group{w: w}
}

// Add follows dir as a folder of the group. Once the group is forgotten, or
// the watcher closed, it returns fsnotify.ErrClosed and follows nothing.
func (g *Group) Add(dir string) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	if g.forgotten {
		return fsnotify.ErrClosed
	}
	if err := g.w.use(func() error { return g.w.fs.Add(dir) }); err != nil {
		return err
	}
	g.dirs = append(g.dirs, dir)
	return nil
}

// Forget stops following every folder of the group, once the Add in flight
// returned. A folder no longer followed is not an error, nor is a group
// forgotten twice or a watcher already closed.
func (g *Group) Forget() error {
	g.mu.Lock()
	if g.forgotten {
		g.mu.Unlock()
		return nil
	}
	g.forgotten = true
	dirs := g.dirs
	g.dirs = nil
	g.mu.Unlock()

	var errs []error
	for _, dir := range dirs {
		err := g.w.use(func() error { return g.w.fs.Remove(dir) })
		if err != nil && !errors.Is(err, fsnotify.ErrNonExistentWatch) && !errors.Is(err, fsnotify.ErrClosed) {
			errs = append(errs, fmt.Errorf("stop following %s: %w", dir, err))
		}
	}
	return errors.Join(errs...)
}

// Close stops following every group, once the calls in flight returned.
func (w *Watcher) Close() error {
	w.mu.Lock()
	w.closed = true
	w.mu.Unlock()

	w.calls.Wait()
	return w.fs.Close()
}

// use runs call, a call to fs, unless the watcher is closed, and keeps Close
// from closing fs until it returns.
func (w *Watcher) use(call func() error) error {
	w.mu.Lock()
	if w.closed {
		w.mu.Unlock()
		return fsnotify.ErrClosed
	}
	w.calls.Add(1)
	w.mu.Unlock()
	defer w.calls.Done()

	return call()
}
