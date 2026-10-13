package fswatch

import (
	"errors"
	"fmt"
	"sync"

	"github.com/fsnotify/fsnotify"
)

// Watcher follows folders in groups. On Windows each group has an fsnotify
// watcher of its own, and forgetting a group closes it: fsnotify releases
// every folder of a closed watcher once, and before Close returns, so the
// folders can be deleted right after.
type Watcher struct {
	handle func(fsnotify.Event)
	fail   func(error)

	mu     sync.Mutex
	groups map[string]*group
	closed bool
}

// group is the watcher of one group, with the calls to it in flight, which
// closing it waits for: fsnotify fails its Close, and never answers the call,
// when the two cross.
type group struct {
	fs    *fsnotify.Watcher
	calls sync.WaitGroup
}

// New starts a watcher that hands every event to handle and every error to
// fail, from a goroutine of each group.
func New(handle func(fsnotify.Event), fail func(error)) (*Watcher, error) {
	return &Watcher{handle: handle, fail: fail, groups: map[string]*group{}}, nil
}

// Add follows dir as a folder of group. After Close it returns
// fsnotify.ErrClosed.
func (w *Watcher) Add(name, dir string) error {
	w.mu.Lock()
	if w.closed {
		w.mu.Unlock()
		return fsnotify.ErrClosed
	}
	g, ok := w.groups[name]
	if !ok {
		fsw, err := fsnotify.NewWatcher()
		if err != nil {
			w.mu.Unlock()
			return fmt.Errorf("create watcher: %w", err)
		}
		go drain(fsw, w.handle, w.fail)
		g = &group{fs: fsw}
		w.groups[name] = g
	}
	g.calls.Add(1)
	w.mu.Unlock()
	defer g.calls.Done()

	return g.fs.Add(dir)
}

// Forget stops following group by closing its watcher, whatever folders it
// holds. A group not followed is not an error.
func (w *Watcher) Forget(name string, _ []string) error {
	w.mu.Lock()
	g, ok := w.groups[name]
	delete(w.groups, name)
	w.mu.Unlock()

	if !ok {
		return nil
	}
	return g.close()
}

// Close stops following every group.
func (w *Watcher) Close() error {
	w.mu.Lock()
	w.closed = true
	groups := w.groups
	w.groups = map[string]*group{}
	w.mu.Unlock()

	var errs []error
	for _, g := range groups {
		errs = append(errs, g.close())
	}
	return errors.Join(errs...)
}

// close closes the watcher of the group once the calls in flight returned.
func (g *group) close() error {
	g.calls.Wait()
	return g.fs.Close()
}
