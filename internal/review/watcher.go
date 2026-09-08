package review

import (
	"context"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/fsnotify/fsnotify"

	"github.com/guilhermt/myspec/internal/worktree"
)

// reviewOps are the events that can change what git says about a worktree.
// Staging in VS Code rewrites the index, which is a create and a rename.
const reviewOps = fsnotify.Create | fsnotify.Write | fsnotify.Rename | fsnotify.Remove

// gitDirName is the directory a walk never descends into: a worktree of the
// app has a .git file, but a repository cloned inside one would have its own.
const gitDirName = ".git"

// run drains the watcher until Close shuts its channels.
func (s *Service) run() {
	for {
		select {
		case ev, ok := <-s.fs.Events:
			if !ok {
				return
			}
			s.handle(ev)
		case err, ok := <-s.fs.Errors:
			if !ok {
				return
			}
			s.log.Warn("review watcher failed", "error", err)
		}
	}
}

// handle arms the wait of the key the event belongs to, following a new
// directory before it does.
func (s *Service) handle(ev fsnotify.Event) {
	if !ev.Has(reviewOps) {
		return
	}

	s.mu.Lock()
	k, ok := s.owners[filepath.Dir(ev.Name)]
	s.mu.Unlock()
	if !ok {
		return
	}

	if ev.Has(fsnotify.Create) {
		if info, err := os.Lstat(ev.Name); err == nil && info.IsDir() {
			s.follow(k, ev.Name)
		}
	}
	s.arm(k)
}

// follow adds a directory that appeared inside a worktree, and everything
// under it, unless git ignores it. An ignored directory is written down and
// never asked about again while the key is tracked.
func (s *Service) follow(k Key, root string) {
	s.mu.Lock()
	item, ok := s.items[k]
	if !ok || s.closed || !inside(item.wt.Path, root) {
		s.mu.Unlock()
		return
	}
	if _, skip := item.ignored[root]; skip {
		s.mu.Unlock()
		return
	}
	wt := item.wt
	s.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), readTimeout)
	defer cancel()

	ignored, err := s.worktrees.IsIgnored(ctx, wt, root)
	if err != nil {
		s.log.Warn("review ignore check failed", "task", k.TaskID, "repo", k.RepoPath, "path", root, "error", err)
		return
	}
	if ignored {
		s.mu.Lock()
		if item, ok = s.items[k]; ok && item.wt.Path == wt.Path {
			if item.ignored == nil {
				item.ignored = map[string]struct{}{}
			}
			item.ignored[root] = struct{}{}
		}
		s.mu.Unlock()
		return
	}

	s.add(k, wt, tree(root))
}

// tree is root and every directory under it, skipping the git directory of a
// repository that happens to live inside. What cannot be walked is left out:
// the worst case is a blind spot, never a lost review.
func tree(root string) []string {
	var dirs []string
	_ = filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return nil //nolint:nilerr // an unreadable directory is skipped, not fatal
		}
		if !entry.IsDir() {
			return nil
		}
		if entry.Name() == gitDirName {
			return filepath.SkipDir
		}
		dirs = append(dirs, path)
		return nil
	})
	return dirs
}

// watch follows the directories a worktree needs for its review to be seen.
func (s *Service) watch(k Key, wt worktree.Worktree) {
	s.add(k, wt, s.dirsOf(k, wt))
}

// add puts directories under watch and records who owns them. A directory the
// watcher cannot follow is a warning and nothing more: the git directory goes
// in first, so the worst case is missing a hand edit, not the review.
func (s *Service) add(k Key, wt worktree.Worktree, dirs []string) {
	for _, dir := range dirs {
		s.mu.Lock()
		item, ok := s.items[k]
		if !ok || s.closed || item.wt.Path != wt.Path {
			s.mu.Unlock()
			return
		}
		_, watched := s.owners[dir]
		s.mu.Unlock()
		if watched {
			continue
		}

		if err := s.fs.Add(dir); err != nil {
			s.log.Warn("review watch failed", "task", k.TaskID, "repo", k.RepoPath, "path", dir, "error", err)
			continue
		}

		s.mu.Lock()
		if item, ok = s.items[k]; ok && !s.closed && item.wt.Path == wt.Path {
			s.owners[dir] = k
			item.dirs = append(item.dirs, dir)
		}
		s.mu.Unlock()
	}
}

// remove stops following directories a key no longer owns.
func (s *Service) remove(k Key, dirs []string) {
	for _, dir := range dirs {
		if err := s.fs.Remove(dir); err != nil && !errors.Is(err, fsnotify.ErrNonExistentWatch) {
			s.log.Warn("review unwatch failed", "task", k.TaskID, "repo", k.RepoPath, "path", dir, "error", err)
		}
	}
}

// arm restarts the wait of a key. An event of a key whose numbers do not
// matter arms nothing: Track reads it anyway when it becomes active again.
func (s *Service) arm(k Key) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.closed {
		return
	}
	item, ok := s.items[k]
	if !ok || !item.active {
		return
	}

	s.disarmLocked(item)
	gen := item.gen
	item.timer = time.AfterFunc(reviewDebounce, func() { s.fire(k, gen) })
}

// fire reads a worktree that went quiet, unless a later event replaced the
// wait or the key stopped being watched while it ran down.
func (s *Service) fire(k Key, gen uint64) {
	s.mu.Lock()
	item, ok := s.items[k]
	current := ok && item.gen == gen && item.active && !s.closed
	if current {
		item.timer = nil
	}
	s.mu.Unlock()

	if !current {
		return
	}
	s.read(k)
}

// inside reports whether path is base or something under it.
func inside(base, path string) bool {
	return path == base || strings.HasPrefix(path, base+string(os.PathSeparator))
}
