package workspace

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// Deps are what Service needs from the outside.
type Deps struct {
	Recents  RecentsRepository
	Scan     Scanner
	Log      *slog.Logger
	Now      func() time.Time // defaults to time.Now
	OnChange func()           // runs after every state change; may be nil
}

// Service owns the workspace the window is showing.
type Service struct {
	recents  RecentsRepository
	scan     Scanner
	log      *slog.Logger
	now      func() time.Time
	onChange func()

	mu      sync.Mutex
	current *Workspace
	notice  *Notice
}

// New builds a Service from deps.
func New(deps Deps) *Service {
	now := deps.Now
	if now == nil {
		now = time.Now
	}
	return &Service{
		recents:  deps.Recents,
		scan:     deps.Scan,
		log:      deps.Log,
		now:      now,
		onChange: deps.OnChange,
	}
}

// Bootstrap picks the workspace the app starts on. With an argument it opens it,
// leaving a notice when the path does not qualify. Without one it opens the most
// recent workspace, leaving a notice and pruning it when it is gone, and stays
// on no workspace at all when there is no recent to open.
func (s *Service) Bootstrap(ctx context.Context, arg, cwd string) error {
	if arg != "" {
		return s.OpenArg(ctx, arg, cwd)
	}

	recents, err := s.recents.List(ctx)
	if err != nil {
		return fmt.Errorf("list recents: %w", err)
	}
	if len(recents) == 0 {
		return nil
	}

	last := recents[0]
	if Validate(last.Path) == nil {
		return s.Open(ctx, last.Path)
	}

	s.log.Info("recent pruned", "path", last.Path)
	if err := s.recents.Delete(ctx, last.Path); err != nil {
		return fmt.Errorf("delete recent %s: %w", last.Path, err)
	}
	s.setNotice(last.Path, ReasonLastRecentMissing)
	return nil
}

// Open scans path and makes it the current workspace, moving it to the top of
// the recents and clearing any notice. Reopening the current workspace scans it
// again; it is not a no-op.
func (s *Service) Open(ctx context.Context, path string) error {
	path = filepath.Clean(path)
	if err := Validate(path); err != nil {
		return err
	}

	started := s.now()
	paths, err := s.scan(path)
	if err != nil {
		return fmt.Errorf("scan workspace %s: %w", path, err)
	}

	repos := make([]Repo, len(paths))
	for i, repoPath := range paths {
		repos[i] = Repo{Name: filepath.Base(repoPath), Path: repoPath}
	}
	current := &Workspace{Name: filepath.Base(path), Path: path, Repos: repos}

	rec := Recent{Path: path, Name: current.Name, LastOpenedAt: s.now().UTC()}
	if err := s.recents.Touch(ctx, rec, MaxRecents); err != nil {
		return fmt.Errorf("touch recent %s: %w", path, err)
	}

	s.mu.Lock()
	s.current = current
	s.notice = nil
	s.mu.Unlock()

	s.log.Info("workspace opened",
		"path", path,
		"repos", len(repos),
		"duration_ms", s.now().Sub(started).Milliseconds(),
	)
	s.changed()
	return nil
}

// OpenArg opens a command line argument, resolved against cwd. A path that does
// not qualify leaves a notice and the current workspace untouched instead of
// returning an error.
func (s *Service) OpenArg(ctx context.Context, raw, cwd string) error {
	path := ResolvePath(raw, cwd)

	err := s.Open(ctx, path)
	if err == nil {
		return nil
	}
	reason, ok := reasonFor(err)
	if !ok {
		return err
	}
	s.setNotice(path, reason)
	return nil
}

// RemoveRecent drops path from the recent workspaces.
func (s *Service) RemoveRecent(ctx context.Context, path string) error {
	if err := s.recents.Delete(ctx, path); err != nil {
		return fmt.Errorf("delete recent %s: %w", path, err)
	}
	s.changed()
	return nil
}

// DismissNotice clears the notice shown to the user.
func (s *Service) DismissNotice() {
	s.mu.Lock()
	s.notice = nil
	s.mu.Unlock()
	s.changed()
}

// Current returns a copy of the open workspace, nil when there is none.
func (s *Service) Current() *Workspace {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.current == nil {
		return nil
	}
	current := *s.current
	current.Repos = append([]Repo(nil), s.current.Repos...)
	return &current
}

// Notice returns a copy of the current notice, nil when there is none.
func (s *Service) Notice() *Notice {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.notice == nil {
		return nil
	}
	notice := *s.notice
	return &notice
}

// Recents returns the recent workspaces, newest first, dropping the ones whose
// folder is gone from disk.
func (s *Service) Recents(ctx context.Context) ([]Recent, error) {
	all, err := s.recents.List(ctx)
	if err != nil {
		return nil, fmt.Errorf("list recents: %w", err)
	}

	kept := make([]Recent, 0, len(all))
	var gone []string
	for _, rec := range all {
		if _, err := os.Stat(rec.Path); err != nil {
			s.log.Info("recent pruned", "path", rec.Path)
			gone = append(gone, rec.Path)
			continue
		}
		kept = append(kept, rec)
	}
	if len(gone) > 0 {
		if err := s.recents.Delete(ctx, gone...); err != nil {
			return nil, fmt.Errorf("prune recents: %w", err)
		}
	}
	return kept, nil
}

// setNotice records a path the app refused to open and notifies the listener.
func (s *Service) setNotice(path string, reason NoticeReason) {
	s.log.Warn("invalid workspace path", "path", path, "reason", string(reason))

	s.mu.Lock()
	s.notice = &Notice{Path: path, Reason: reason}
	s.mu.Unlock()

	s.changed()
}

// changed runs the OnChange callback outside the mutex.
func (s *Service) changed() {
	if s.onChange != nil {
		s.onChange()
	}
}
