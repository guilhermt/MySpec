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
	groups map[*Group]struct{} // the groups with a watcher, which Close forgets
	closed bool
}

// Group is folders followed together, until it is forgotten. Its watcher
// starts with the first folder.
type Group struct {
	w *Watcher

	mu        sync.Mutex
	fs        *fsnotify.Watcher
	forgotten bool
	// calls are the calls to fs in flight, which Forget waits for: fsnotify
	// fails its Close, and never answers the call, when the two cross. An Add
	// can't hold mu while it waits, because the reader it waits for may be
	// handing an event over to a handle that adds a folder to this group.
	calls sync.WaitGroup
}

// New starts a watcher that hands every event to handle and every error to
// fail, from a goroutine of each group.
func New(handle func(fsnotify.Event), fail func(error)) (*Watcher, error) {
	return &Watcher{handle: handle, fail: fail, groups: map[*Group]struct{}{}}, nil
}

// Open starts a group with no folder in it.
func (w *Watcher) Open() *Group {
	return &Group{w: w}
}

// Add follows dir as a folder of the group. Once the group is forgotten, or
// the watcher closed, it returns fsnotify.ErrClosed and follows nothing.
func (g *Group) Add(dir string) error {
	g.mu.Lock()
	if g.forgotten {
		g.mu.Unlock()
		return fsnotify.ErrClosed
	}
	if g.fs == nil {
		if err := g.start(); err != nil {
			g.mu.Unlock()
			return err
		}
	}
	fsw := g.fs
	g.calls.Add(1)
	g.mu.Unlock()
	defer g.calls.Done()

	return fsw.Add(dir)
}

// start gives the group its watcher, unless the watcher of every group is
// closed. It runs under mu.
func (g *Group) start() error {
	fsw, err := fsnotify.NewWatcher()
	if err != nil {
		return fmt.Errorf("create watcher: %w", err)
	}

	g.w.mu.Lock()
	if g.w.closed {
		g.w.mu.Unlock()
		_ = fsw.Close()
		return fsnotify.ErrClosed
	}
	g.w.groups[g] = struct{}{}
	g.w.mu.Unlock()

	go drain(fsw, g.w.handle, g.w.fail)
	g.fs = fsw
	return nil
}

// Forget stops following every folder of the group by closing its watcher,
// once the Add in flight returned. A group forgotten twice is not an error.
func (g *Group) Forget() error {
	g.mu.Lock()
	if g.forgotten {
		g.mu.Unlock()
		return nil
	}
	g.forgotten = true
	fsw := g.fs
	g.mu.Unlock()

	g.w.mu.Lock()
	delete(g.w.groups, g)
	g.w.mu.Unlock()

	if fsw == nil {
		return nil
	}
	g.calls.Wait()
	return fsw.Close()
}

// Close stops following every group.
func (w *Watcher) Close() error {
	w.mu.Lock()
	w.closed = true
	groups := w.groups
	w.groups = map[*Group]struct{}{}
	w.mu.Unlock()

	var errs []error
	for g := range groups {
		errs = append(errs, g.Forget())
	}
	return errors.Join(errs...)
}
