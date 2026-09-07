package worktree

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/task"
)

// baseBranches are the branches a worktree is created from, in the order they
// are tried.
var baseBranches = []string{"origin/dev", "origin/main"}

// remote is the only remote the app talks to.
const remote = "origin"

// Deps are what Service needs from the outside.
type Deps struct {
	Git   *git.Runner
	Store Store
	Log   *slog.Logger
	Now   func() time.Time // defaults to time.Now
}

// Service is the registry of the worktrees of the open workspace and the
// policy of their life cycle. Git runs one command at a time per repository.
type Service struct {
	git   *git.Runner
	store Store
	log   *slog.Logger
	now   func() time.Time

	mu     sync.Mutex
	items  map[string][]Worktree  // by task id
	repoMu map[string]*sync.Mutex // by repository path
}

// New builds a Service from deps.
func New(deps Deps) *Service {
	now := deps.Now
	if now == nil {
		now = time.Now
	}
	log := deps.Log
	if log == nil {
		log = slog.New(slog.DiscardHandler)
	}
	return &Service{
		git:    deps.Git,
		store:  deps.Store,
		log:    log,
		now:    now,
		items:  map[string][]Worktree{},
		repoMu: map[string]*sync.Mutex{},
	}
}

// Sync loads the worktrees of the given tasks, replacing what was loaded
// before. internal/app calls it right after task.Service.Sync.
func (s *Service) Sync(ctx context.Context, taskIDs []string) error {
	list, err := s.store.ListByTasks(ctx, taskIDs)
	if err != nil {
		return fmt.Errorf("list worktrees: %w", err)
	}

	items := make(map[string][]Worktree, len(taskIDs))
	for _, wt := range list {
		items[wt.TaskID] = append(items[wt.TaskID], wt)
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.items = items
	return nil
}

// Get is the registered worktree of a task in a repository.
func (s *Service) Get(taskID, repoPath string) (Worktree, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, wt := range s.items[taskID] {
		if wt.RepoPath == repoPath {
			return wt, true
		}
	}
	return Worktree{}, false
}

// List is every registered worktree of a task, by repository path.
func (s *Service) List(taskID string) []Worktree {
	s.mu.Lock()
	defer s.mu.Unlock()

	list := slices.Clone(s.items[taskID])
	slices.SortFunc(list, func(a, b Worktree) int { return strings.Compare(a.RepoPath, b.RepoPath) })
	return list
}

// Ensure returns the worktree of a task in a repository, creating it when the
// task has none there. onPhase, which may be nil, hears every phase of a
// creation. It never fetches for a worktree that already exists.
func (s *Service) Ensure(
	ctx context.Context, t task.Task, repo task.Repository, onPhase func(Phase),
) (Worktree, error) {
	if onPhase == nil {
		onPhase = func(Phase) {}
	}

	registered, found := s.Get(t.ID, repo.Path)
	if found {
		if _, err := os.Stat(registered.Path); err == nil {
			return registered, nil
		}
	}

	unlock := s.lockRepo(repo.Path)
	defer unlock()

	if found {
		// The folder is gone: the user deleted it by hand. The worktree and the
		// branch are the app's own, so it takes them back before creating again.
		if err := s.discard(ctx, registered); err != nil {
			return Worktree{}, err
		}
		s.log.Info("worktree recreated", "task", t.Name, "path", registered.Path)
	}

	onPhase(PhaseFetching)
	if err := do(ctx, FetchTimeout, func(ctx context.Context) error {
		return s.git.Fetch(ctx, repo.Path, remote)
	}); err != nil {
		return Worktree{}, fmt.Errorf("%w: %w", ErrFetchFailed, err)
	}

	base, err := s.base(ctx, repo.Path)
	if err != nil {
		return Worktree{}, err
	}

	path := Path(t.WorkspacePath, repo.Rel, t.Name)
	// Nothing found here is reused or deleted: the app only owns what it made.
	if _, err = os.Lstat(path); err == nil {
		return Worktree{}, fmt.Errorf("%w: %s", ErrPathExists, path)
	}
	exists, err := ask(ctx, CommandTimeout, func(ctx context.Context) (bool, error) {
		return s.git.BranchExists(ctx, repo.Path, t.Name)
	})
	if err != nil {
		return Worktree{}, err
	}
	if exists {
		return Worktree{}, fmt.Errorf("%w: %s", ErrBranchExists, t.Name)
	}

	if err = os.MkdirAll(filepath.Dir(path), dirPerm); err != nil {
		return Worktree{}, fmt.Errorf("create worktree directory: %w", err)
	}
	if repo.Rel == "." {
		// The worktrees of a root repository live inside it, so it is told to
		// ignore them. It is the only thing the app writes in a user repository.
		if err = s.exclude(ctx, repo.Path); err != nil {
			s.log.Warn("exclude update failed", "repo", repo.Path, "error", err)
		}
	}

	wt := Worktree{
		TaskID:    t.ID,
		RepoPath:  repo.Path,
		Path:      path,
		Branch:    t.Name,
		CreatedAt: s.now().UTC(),
	}
	// Registered before the command, so that a creation that fails or is
	// cancelled halfway is still the app's to clean up.
	if err = s.store.Insert(ctx, wt); err != nil {
		return Worktree{}, fmt.Errorf("insert worktree %s: %w", path, err)
	}

	onPhase(PhaseCreating)
	if err = do(ctx, CommandTimeout, func(ctx context.Context) error {
		return s.git.AddWorktree(ctx, repo.Path, path, t.Name, base)
	}); err != nil {
		s.rollback(wt)
		return Worktree{}, err
	}

	s.remember(wt)
	s.log.Info("worktree created",
		"task", t.Name, "repo", repo.Path, "path", path, "branch", t.Name, "base", base)
	return wt, nil
}

// Status reads git status of a worktree.
func (s *Service) Status(ctx context.Context, wt Worktree) (Status, error) {
	unlock := s.lockRepo(wt.RepoPath)
	defer unlock()

	entries, err := ask(ctx, CommandTimeout, func(ctx context.Context) ([]string, error) {
		return s.git.Status(ctx, wt.Path)
	})
	if err != nil {
		return Status{}, err
	}
	return Status{Entries: entries}, nil
}

// Clean throws away every change of a worktree: tracked files are restored,
// untracked ones removed. Ignored files stay.
func (s *Service) Clean(ctx context.Context, wt Worktree) error {
	unlock := s.lockRepo(wt.RepoPath)
	defer unlock()

	if err := do(ctx, CommandTimeout, func(ctx context.Context) error {
		return s.git.Reset(ctx, wt.Path)
	}); err != nil {
		return err
	}
	if err := do(ctx, CommandTimeout, func(ctx context.Context) error {
		return s.git.Clean(ctx, wt.Path)
	}); err != nil {
		return err
	}

	s.log.Info("worktree cleaned", "task", wt.TaskID, "path", wt.Path)
	return nil
}

// RemoveAll removes every worktree of a task with its branch. It stops at the
// first failure, with what git said, leaving the rest untouched.
func (s *Service) RemoveAll(ctx context.Context, taskID string) error {
	for _, wt := range s.List(taskID) {
		if err := s.remove(ctx, wt); err != nil {
			return err
		}
	}
	return nil
}

// remove takes one worktree down, under the mutex of its repository.
func (s *Service) remove(ctx context.Context, wt Worktree) error {
	unlock := s.lockRepo(wt.RepoPath)
	defer unlock()

	if err := s.discard(ctx, wt); err != nil {
		return err
	}
	s.log.Info("worktree removed", "task", wt.TaskID, "path", wt.Path, "branch", wt.Branch)
	return nil
}

// discard undoes a worktree the app created: the folder when it is still
// there, the registration git keeps, the branch and the record. The caller
// holds the mutex of the repository. The order matters: branch -D fails while
// the branch is checked out in a worktree.
func (s *Service) discard(ctx context.Context, wt Worktree) error {
	if _, err := os.Stat(wt.Path); err == nil {
		if err = do(ctx, CommandTimeout, func(ctx context.Context) error {
			return s.git.RemoveWorktree(ctx, wt.RepoPath, wt.Path)
		}); err != nil {
			return err
		}
	}
	if err := do(ctx, CommandTimeout, func(ctx context.Context) error {
		return s.git.PruneWorktrees(ctx, wt.RepoPath)
	}); err != nil {
		return err
	}

	exists, err := ask(ctx, CommandTimeout, func(ctx context.Context) (bool, error) {
		return s.git.BranchExists(ctx, wt.RepoPath, wt.Branch)
	})
	if err != nil {
		return err
	}
	if exists {
		if err = do(ctx, CommandTimeout, func(ctx context.Context) error {
			return s.git.DeleteBranch(ctx, wt.RepoPath, wt.Branch)
		}); err != nil {
			return err
		}
	}

	if err = s.store.Delete(ctx, wt.TaskID, wt.RepoPath); err != nil {
		return fmt.Errorf("delete worktree %s: %w", wt.Path, err)
	}
	s.forget(wt)
	return nil
}

// rollback undoes what a failed or cancelled creation left behind. It runs on
// a context of its own, because the one that failed may be cancelled, and only
// logs what goes wrong: the caller reports the failure that brought it here.
func (s *Service) rollback(wt Worktree) {
	ctx, cancel := context.WithTimeout(context.Background(), CommandTimeout)
	defer cancel()

	if err := s.discard(ctx, wt); err != nil {
		s.log.Warn("worktree rollback failed", "path", wt.Path, "error", err)
	}
}

// base is the branch a new worktree starts from: origin/dev, or origin/main
// when the repository has no dev.
func (s *Service) base(ctx context.Context, repoPath string) (string, error) {
	for _, branch := range baseBranches {
		exists, err := ask(ctx, CommandTimeout, func(ctx context.Context) (bool, error) {
			return s.git.RefExists(ctx, repoPath, "refs/remotes/"+branch)
		})
		if err != nil {
			return "", err
		}
		if exists {
			return branch, nil
		}
	}
	return "", ErrNoBaseBranch
}

// exclude tells a repository that is itself the workspace root to ignore the
// folder its worktrees live in, once.
func (s *Service) exclude(ctx context.Context, repoPath string) error {
	path, err := ask(ctx, CommandTimeout, func(ctx context.Context) (string, error) {
		return s.git.ExcludePath(ctx, repoPath)
	})
	if err != nil {
		return err
	}
	if err = os.MkdirAll(filepath.Dir(path), dirPerm); err != nil {
		return fmt.Errorf("create exclude directory: %w", err)
	}

	content, err := os.ReadFile(path)
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		return fmt.Errorf("read %s: %w", path, err)
	}
	for line := range strings.SplitSeq(string(content), "\n") {
		if strings.TrimSpace(line) == excludeLine {
			return nil
		}
	}

	file, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, filePerm)
	if err != nil {
		return fmt.Errorf("open %s: %w", path, err)
	}
	defer func() { _ = file.Close() }()

	if _, err = file.WriteString("\n# MySpec worktrees\n" + excludeLine + "\n"); err != nil {
		return fmt.Errorf("write %s: %w", path, err)
	}
	return nil
}

// remember puts a worktree in the cache.
func (s *Service) remember(wt Worktree) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.items[wt.TaskID] = append(s.items[wt.TaskID], wt)
}

// forget takes a worktree out of the cache.
func (s *Service) forget(wt Worktree) {
	s.mu.Lock()
	defer s.mu.Unlock()

	list := slices.DeleteFunc(s.items[wt.TaskID], func(item Worktree) bool {
		return item.RepoPath == wt.RepoPath
	})
	if len(list) == 0 {
		delete(s.items, wt.TaskID)
		return
	}
	s.items[wt.TaskID] = list
}

// lockRepo holds the mutex of a repository, so that two tasks never run git in
// it at the same time, and returns how to let it go.
func (s *Service) lockRepo(repoPath string) func() {
	s.mu.Lock()
	mu, ok := s.repoMu[repoPath]
	if !ok {
		mu = &sync.Mutex{}
		s.repoMu[repoPath] = mu
	}
	s.mu.Unlock()

	mu.Lock()
	return mu.Unlock
}

// do runs a git command that answers nothing under a timeout of its own.
func do(ctx context.Context, timeout time.Duration, fn func(context.Context) error) error {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	return fn(ctx)
}

// ask runs a git command that answers something under a timeout of its own.
func ask[T any](ctx context.Context, timeout time.Duration, fn func(context.Context) (T, error)) (T, error) {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	return fn(ctx)
}
