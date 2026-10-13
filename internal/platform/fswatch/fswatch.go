// Package fswatch follows folders in groups, so that the folders of one group
// stop being followed together: one fsnotify watcher for every group on Linux,
// and one watcher of its own for each group on Windows. On Windows fsnotify
// can close a handle twice when a single folder is removed from a watcher
// while it has events in flight (fsnotify/fsnotify#768), which kills the
// process; closing a whole watcher there is the safe way to stop following.
package fswatch

import "github.com/fsnotify/fsnotify"

// drain hands every event and every error of fsw over until it is closed.
func drain(fsw *fsnotify.Watcher, handle func(fsnotify.Event), fail func(error)) {
	for {
		select {
		case ev, ok := <-fsw.Events:
			if !ok {
				return
			}
			handle(ev)
		case err, ok := <-fsw.Errors:
			if !ok {
				return
			}
			fail(err)
		}
	}
}
