package worktree

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/task"
)

// baseBranches are the branches a worktree is created from, in the order they
// are tried.
var baseBranches = []string{"origin/dev", "origin/main"}

// remote is the only remote the app talks to.
const remote = "origin"

// Deps are what Service needs from the outside.
type Deps struct {
	Git     *git.Runner
	Store   Store
	DataDir string
	Log     *slog.Logger
	Now     func() time.Time // defaults to time.Now
}

// Service is the registry of the worktrees of the items and the policy of
// their life cycle. Git runs one command at a time per repository.
type Service struct {
	git     *git.Runner
	store   Store
	dataDir string
	log     *slog.Logger
	now     func() time.Time

	mu     sync.Mutex
	items  map[string]Worktree    // by item id
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
		git:     deps.Git,
		store:   deps.Store,
		dataDir: deps.DataDir,
		log:     log,
		now:     now,
		items:   map[string]Worktree{},
		repoMu:  map[string]*sync.Mutex{},
	}
}

// Sync loads the worktrees of the given items, replacing what was loaded
// before. internal/app calls it right after task.Service.Sync.
func (s *Service) Sync(ctx context.Context, itemIDs []string) error {
	list, err := s.store.ListByTasks(ctx, itemIDs)
	if err != nil {
		return fmt.Errorf("list worktrees: %w", err)
	}

	items := make(map[string]Worktree, len(itemIDs))
	for _, wt := range list {
		items[wt.TaskID] = wt
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.items = items
	return nil
}

// Get is the registered worktree of an item.
func (s *Service) Get(itemID string) (Worktree, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	wt, ok := s.items[itemID]
	return wt, ok
}

// Ensure returns the worktree of a task, creating it when the task has none.
// onPhase, which may be nil, hears every phase of a creation. It never fetches
// for a worktree that already exists.
func (s *Service) Ensure(
	ctx context.Context, t task.Task, repo repository.Repository, onPhase func(Phase),
) (Worktree, error) {
	if onPhase == nil {
		onPhase = func(Phase) {}
	}

	registered, found := s.Get(t.ID)
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

	path := Path(s.dataDir, repo.Owner, repo.Name, t.Name)
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

	wt := Worktree{
		TaskID:    t.ID,
		RepoPath:  repo.Path,
		Path:      path,
		Branch:    t.Name,
		Base:      base,
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
		"task", t.Name, "repository", repo.FullName(), "path", path, "branch", t.Name, "base", base)
	return wt, nil
}

// EnsureDetached returns the worktree of an item on a detached HEAD at the
// head of headBranch on origin, creating it when the item has none. It is how
// the review of a pull request gets a worktree: there is no local branch, so
// nothing of the pull request is ever pushed by accident.
func (s *Service) EnsureDetached(
	ctx context.Context, itemID string, repo repository.Repository, dirName, headBranch, baseBranch string,
) (Worktree, error) {
	unlock := s.lockRepo(repo.Path)
	defer unlock()

	registered, found := s.Get(itemID)
	if found {
		if _, err := os.Stat(registered.Path); err == nil {
			return registered, nil
		}
		// The folder is gone: the user deleted it by hand. The worktree is the
		// app's own, so it takes it back before creating again.
		if err := s.discard(ctx, registered); err != nil {
			return Worktree{}, err
		}
		s.log.Info("worktree recreated", "item", itemID, "path", registered.Path)
	}

	if err := do(ctx, FetchTimeout, func(ctx context.Context) error {
		return s.git.Fetch(ctx, repo.Path, remote)
	}); err != nil {
		return Worktree{}, fmt.Errorf("%w: %w", ErrFetchFailed, err)
	}

	head := remote + "/" + headBranch
	exists, err := ask(ctx, CommandTimeout, func(ctx context.Context) (bool, error) {
		return s.git.RefExists(ctx, repo.Path, "refs/remotes/"+head)
	})
	if err != nil {
		return Worktree{}, err
	}
	if !exists {
		return Worktree{}, fmt.Errorf("%w: %s", ErrNoHeadBranch, head)
	}

	path := Path(s.dataDir, repo.Owner, repo.Name, dirName)
	// Nothing found here is reused or deleted: the app only owns what it made.
	if _, err = os.Lstat(path); err == nil {
		return Worktree{}, fmt.Errorf("%w: %s", ErrPathExists, path)
	}
	if err = os.MkdirAll(filepath.Dir(path), dirPerm); err != nil {
		return Worktree{}, fmt.Errorf("create worktree directory: %w", err)
	}

	wt := Worktree{
		TaskID:    itemID,
		RepoPath:  repo.Path,
		Path:      path,
		Base:      remote + "/" + baseBranch,
		CreatedAt: s.now().UTC(),
	}
	// Registered before the command, so that a creation that fails or is
	// cancelled halfway is still the app's to clean up.
	if err = s.store.Insert(ctx, wt); err != nil {
		return Worktree{}, fmt.Errorf("insert worktree %s: %w", path, err)
	}

	if err = do(ctx, CommandTimeout, func(ctx context.Context) error {
		return s.git.AddDetachedWorktree(ctx, repo.Path, path, head)
	}); err != nil {
		s.rollback(wt)
		return Worktree{}, err
	}

	s.remember(wt)
	s.log.Info("detached worktree created",
		"item", itemID, "repository", repo.FullName(), "path", path, "head", head, "base", wt.Base)
	return wt, nil
}

// UpdateDetached brings a worktree on a detached HEAD to the head of
// headBranch on origin. A worktree with changes is refused: nothing the app
// did not put there is thrown away.
func (s *Service) UpdateDetached(ctx context.Context, wt Worktree, headBranch string) error {
	unlock := s.lockRepo(wt.RepoPath)
	defer unlock()

	status, err := ask(ctx, CommandTimeout, func(ctx context.Context) (git.Status, error) {
		return s.git.Status(ctx, wt.Path)
	})
	if err != nil {
		return err
	}
	if !status.Clean() {
		return fmt.Errorf("%w: %s", ErrDirty, wt.Path)
	}

	if err = do(ctx, FetchTimeout, func(ctx context.Context) error {
		return s.git.Fetch(ctx, wt.RepoPath, remote)
	}); err != nil {
		return fmt.Errorf("%w: %w", ErrFetchFailed, err)
	}

	head := remote + "/" + headBranch
	if err = do(ctx, CommandTimeout, func(ctx context.Context) error {
		return s.git.CheckoutDetached(ctx, wt.Path, head)
	}); err != nil {
		return err
	}

	s.log.Info("detached worktree updated", "item", wt.TaskID, "path", wt.Path, "head", head)
	return nil
}

// Status reads the state of the working tree of a worktree.
func (s *Service) Status(ctx context.Context, wt Worktree) (git.Status, error) {
	unlock := s.lockRepo(wt.RepoPath)
	defer unlock()

	return ask(ctx, CommandTimeout, func(ctx context.Context) (git.Status, error) {
		return s.git.Status(ctx, wt.Path)
	})
}

// GitDir is the git directory of a worktree, where its index lives.
func (s *Service) GitDir(ctx context.Context, wt Worktree) (string, error) {
	unlock := s.lockRepo(wt.RepoPath)
	defer unlock()

	return ask(ctx, CommandTimeout, func(ctx context.Context) (string, error) {
		return s.git.GitDir(ctx, wt.Path)
	})
}

// TrackedFiles lists the paths git tracks in a worktree, relative to it.
func (s *Service) TrackedFiles(ctx context.Context, wt Worktree) ([]string, error) {
	unlock := s.lockRepo(wt.RepoPath)
	defer unlock()

	return ask(ctx, CommandTimeout, func(ctx context.Context) ([]string, error) {
		return s.git.TrackedFiles(ctx, wt.Path)
	})
}

// IsIgnored reports whether a path of a worktree is ignored.
func (s *Service) IsIgnored(ctx context.Context, wt Worktree, path string) (bool, error) {
	unlock := s.lockRepo(wt.RepoPath)
	defer unlock()

	return ask(ctx, CommandTimeout, func(ctx context.Context) (bool, error) {
		return s.git.IsIgnored(ctx, wt.Path, path)
	})
}

// Base is the ref the branch of a worktree was created from. An old worktree
// registered before the column existed has none, and the rule is applied
// again.
func (s *Service) Base(ctx context.Context, wt Worktree) (string, error) {
	if wt.Base != "" {
		return wt.Base, nil
	}

	unlock := s.lockRepo(wt.RepoPath)
	defer unlock()

	return s.base(ctx, wt.RepoPath)
}

// Merged reports whether the branch of a worktree is already part of base.
func (s *Service) Merged(ctx context.Context, wt Worktree, base string) (bool, error) {
	unlock := s.lockRepo(wt.RepoPath)
	defer unlock()

	return ask(ctx, CommandTimeout, func(ctx context.Context) (bool, error) {
		return s.git.IsAncestor(ctx, wt.RepoPath, "refs/heads/"+wt.Branch, base)
	})
}

// Ahead is how many commits the branch of the worktree has that base does not.
func (s *Service) Ahead(ctx context.Context, wt Worktree, base string) (int, error) {
	unlock := s.lockRepo(wt.RepoPath)
	defer unlock()

	return ask(ctx, CommandTimeout, func(ctx context.Context) (int, error) {
		return s.git.CountCommits(ctx, wt.RepoPath, base, wt.Branch)
	})
}

// Commit reads a commit of the repository of a worktree.
func (s *Service) Commit(ctx context.Context, wt Worktree, rev string) (git.Commit, error) {
	unlock := s.lockRepo(wt.RepoPath)
	defer unlock()

	return ask(ctx, CommandTimeout, func(ctx context.Context) (git.Commit, error) {
		return s.git.Commit(ctx, wt.Path, rev)
	})
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

// Remove removes the worktree of an item with its branch, with what git said
// when it refuses. An item without one has nothing to remove.
func (s *Service) Remove(ctx context.Context, itemID string) error {
	wt, ok := s.Get(itemID)
	if !ok {
		return nil
	}

	unlock := s.lockRepo(wt.RepoPath)
	defer unlock()

	if err := s.discard(ctx, wt); err != nil {
		return err
	}
	s.log.Info("worktree removed", "item", wt.TaskID, "path", wt.Path, "branch", wt.Branch)
	return nil
}

// discard undoes a worktree the app created: the folder when it is still
// there, the registration git keeps, the branch when it has one, and the
// record. The caller holds the mutex of the repository. The order matters:
// branch -D fails while the branch is checked out in a worktree.
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

	// A worktree on a detached HEAD has no branch of its own to take back.
	if wt.Branch != "" {
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
	}

	if err := s.store.Delete(ctx, wt.TaskID); err != nil {
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

// remember puts a worktree in the cache.
func (s *Service) remember(wt Worktree) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.items[wt.TaskID] = wt
}

// forget takes a worktree out of the cache.
func (s *Service) forget(wt Worktree) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.items, wt.TaskID)
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
