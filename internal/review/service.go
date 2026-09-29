package review

import (
	"context"
	"fmt"
	"log/slog"
	"path/filepath"
	"slices"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"

	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/worktree"
)

// Worktrees is what review needs to read a worktree. internal/worktree
// provides it, and every call runs git under the mutex of the repository.
type Worktrees interface {
	Status(ctx context.Context, wt worktree.Worktree) (git.Status, error)
	GitDir(ctx context.Context, wt worktree.Worktree) (string, error)
	TrackedFiles(ctx context.Context, wt worktree.Worktree) ([]string, error)
	IsIgnored(ctx context.Context, wt worktree.Worktree, path string) (bool, error)
}

// Deps are what Service needs from the outside.
type Deps struct {
	Worktrees Worktrees
	Log       *slog.Logger
	// OnChange says a new reading landed and differs from the one before it;
	// it may be nil.
	OnChange func(taskID string)
}

// Service keeps every worktree under review under watch and holds the last
// reading of each of them.
type Service struct {
	worktrees Worktrees
	log       *slog.Logger
	onChange  func(taskID string)

	fs *fsnotify.Watcher

	mu     sync.Mutex
	items  map[string]*tracked
	owners map[string]string // watched directory -> the task that watches it
	closed bool
}

// tracked is one worktree under watch.
type tracked struct {
	wt      worktree.Worktree
	active  bool // readings only happen while the numbers matter
	dirs    []string
	ignored map[string]struct{} // directories git ignores, asked about once
	snap    Snapshot
	read    bool // a reading has landed
	timer   *time.Timer
	gen     uint64
}

// New builds a Service with its watcher running.
func New(deps Deps) (*Service, error) {
	fsw, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, fmt.Errorf("create review watcher: %w", err)
	}

	log := deps.Log
	if log == nil {
		log = slog.New(slog.DiscardHandler)
	}
	s := &Service{
		worktrees: deps.Worktrees,
		log:       log,
		onChange:  deps.OnChange,
		fs:        fsw,
		items:     map[string]*tracked{},
		owners:    map[string]string{},
	}
	go s.run()
	return s, nil
}

// Track puts the worktree of a task under watch and says whether its numbers
// matter now. It is idempotent: a call that changes nothing reads nothing.
// The first call, and every call that turns a task active or moves it to
// another worktree, reads the worktree at once.
func (s *Service) Track(taskID string, wt worktree.Worktree, active bool) {
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return
	}

	item, found := s.items[taskID]
	moved := found && item.wt.Path != wt.Path
	if found && !moved && item.active == active {
		s.mu.Unlock()
		return
	}

	var dropped []string
	switch {
	case !found:
		item = &tracked{wt: wt}
		s.items[taskID] = item
	case moved:
		// Another worktree: the one it was reading no longer says anything
		// about the review, and neither does its reading.
		dropped = s.releaseLocked(taskID, item)
		item.wt = wt
		item.snap, item.read = Snapshot{}, false
	}
	activated := active && (!found || moved || !item.active)
	item.active = active
	s.mu.Unlock()

	s.remove(taskID, dropped)
	if !found || moved {
		s.watch(taskID, wt)
	}
	if activated {
		s.read(taskID)
	}
}

// Refresh reads the worktree of a task now, ignoring the debounce, and
// returns what it found. It is what the flow uses when it has to decide on a
// reading that is certainly newer than the last event.
func (s *Service) Refresh(taskID string) (Snapshot, bool) {
	s.mu.Lock()
	item, ok := s.items[taskID]
	if !ok || s.closed {
		s.mu.Unlock()
		return Snapshot{}, false
	}
	s.disarmLocked(item)
	s.mu.Unlock()

	return s.read(taskID), true
}

// Snapshot is the last reading of the worktree of a task.
func (s *Service) Snapshot(taskID string) (Snapshot, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	item, ok := s.items[taskID]
	if !ok || !item.read {
		return Snapshot{}, false
	}
	return clone(item.snap), true
}

// Forget stops watching the worktree of a task and drops its reading.
func (s *Service) Forget(taskID string) {
	s.mu.Lock()
	item, ok := s.items[taskID]
	if !ok {
		s.mu.Unlock()
		return
	}
	dropped := s.releaseLocked(taskID, item)
	delete(s.items, taskID)
	s.mu.Unlock()

	s.remove(taskID, dropped)
}

// Close stops the watcher and every wait in flight.
func (s *Service) Close() error {
	s.mu.Lock()
	s.closed = true
	for _, item := range s.items {
		s.disarmLocked(item)
	}
	s.items = map[string]*tracked{}
	s.owners = map[string]string{}
	s.mu.Unlock()

	if err := s.fs.Close(); err != nil {
		return fmt.Errorf("close review watcher: %w", err)
	}
	return nil
}

// read runs git status over the worktree of a task, keeps what it found and
// reports it when it differs from the reading before. A failure is the whole
// snapshot: the interface says what git said instead of an old number.
func (s *Service) read(taskID string) Snapshot {
	s.mu.Lock()
	item, ok := s.items[taskID]
	if !ok || s.closed {
		s.mu.Unlock()
		return Snapshot{}
	}
	wt := item.wt
	s.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), readTimeout)
	defer cancel()

	snap := Snapshot{ReadAt: time.Now()}
	status, err := s.worktrees.Status(ctx, wt)
	if err != nil {
		s.log.Warn("review read failed", "task", taskID, "path", wt.Path, "error", err)
		snap.Err = err.Error()
	} else {
		snap.Head = status.Head
		snap.Total = len(status.Changes)
		snap.Files = make([]File, 0, len(status.Changes))
		for _, change := range status.Changes {
			file := File{Path: change.Path, Kind: change.Kind(), Staged: change.Staged(), Partial: change.Partial()}
			if file.Staged {
				snap.Staged++
			}
			snap.Files = append(snap.Files, file)
		}
	}

	s.mu.Lock()
	item, ok = s.items[taskID]
	if !ok || s.closed || item.wt.Path != wt.Path {
		// The task was forgotten or moved while git ran: this reading is about
		// a worktree nobody is watching any more.
		s.mu.Unlock()
		return snap
	}
	report := !item.read || differs(item.snap, snap)
	item.snap, item.read = snap, true
	s.mu.Unlock()

	if report && s.onChange != nil {
		s.onChange(taskID)
	}
	return snap
}

// differs reports whether two readings say anything different about a
// worktree. ReadAt is not part of it: a reading that found the same thing is
// not news.
func differs(before, after Snapshot) bool {
	return before.Head != after.Head ||
		before.Err != after.Err ||
		before.Staged != after.Staged ||
		before.Total != after.Total ||
		!slices.Equal(before.Files, after.Files)
}

// clone copies a snapshot, so that what a caller holds never changes under it.
func clone(snap Snapshot) Snapshot {
	snap.Files = slices.Clone(snap.Files)
	return snap
}

// dirsOf is what the watcher follows for a worktree: the git directory, where
// the index of a linked worktree lives, and the directories of the files git
// tracks. An ignored directory has no tracked file, so node_modules and dist
// stay out with no check of their own.
func (s *Service) dirsOf(taskID string, wt worktree.Worktree) []string {
	ctx, cancel := context.WithTimeout(context.Background(), readTimeout)
	defer cancel()

	var dirs []string
	gitDir, err := s.worktrees.GitDir(ctx, wt)
	if err != nil {
		s.log.Warn("review git directory failed", "task", taskID, "path", wt.Path, "error", err)
	} else {
		dirs = append(dirs, gitDir)
	}

	files, err := s.worktrees.TrackedFiles(ctx, wt)
	if err != nil {
		s.log.Warn("review tracked files failed", "task", taskID, "path", wt.Path, "error", err)
		return dirs
	}

	seen := map[string]struct{}{wt.Path: {}}
	dirs = append(dirs, wt.Path)
	for _, file := range files {
		dir := filepath.Join(wt.Path, filepath.Dir(file))
		if _, ok := seen[dir]; ok {
			continue
		}
		seen[dir] = struct{}{}
		dirs = append(dirs, dir)
	}
	return dirs
}

// releaseLocked drops the wait of a task and hands back the directories it
// owned, for the caller to unwatch outside the mutex.
func (s *Service) releaseLocked(taskID string, item *tracked) []string {
	s.disarmLocked(item)

	dirs := item.dirs
	for _, dir := range dirs {
		if s.owners[dir] == taskID {
			delete(s.owners, dir)
		}
	}
	item.dirs, item.ignored = nil, nil
	return dirs
}

// disarmLocked stops the wait of a task, so that a timer already running down
// finds itself out of date.
func (s *Service) disarmLocked(item *tracked) {
	if item.timer != nil {
		item.timer.Stop()
		item.timer = nil
	}
	item.gen++
}
