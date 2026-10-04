package worktree

import (
	"context"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"

	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/task"
)

// Close takes down the worktree of a task whose pull request was merged and
// brings the base branch of the clone up to date. It never stops
// halfway: each of the three parts records its own outcome, and the record of
// the worktree goes whatever happened, because nothing here is the app's any
// more. base is the local branch the pull request merged into.
func (s *Service) Close(ctx context.Context, wt Worktree, base string, policy BranchPolicy) task.CloseResult {
	unlock := s.lockRepo(wt.RepoPath)
	defer unlock()

	result := task.CloseResult{WorktreePath: wt.Path, BranchName: wt.Branch, BaseBranch: base}
	result.Worktree = s.closeWorktree(ctx, wt)
	result.Branch = s.closeBranch(ctx, wt, base, policy)
	result.Base, result.BaseCommits = s.closeBase(ctx, wt.RepoPath, base)

	if err := s.store.Delete(ctx, wt.TaskID); err != nil {
		s.log.Error("delete worktree record failed", "task", wt.TaskID, "path", wt.Path, "error", err)
	}
	s.forget(wt)
	result.ClosedAt = s.now().UTC()

	s.log.Info("worktree closed",
		"task", wt.TaskID, "path", wt.RepoPath,
		"worktree", string(result.Worktree.Outcome),
		"branch", string(result.Branch.Outcome),
		"base", string(result.Base.Outcome))
	return result
}

// Purge removes the worktree of a task with its branch, whatever state they
// are in, and forgets them. What git cannot remove is returned, never kept:
// the task is going away and nothing here is worth stopping it over.
func (s *Service) Purge(ctx context.Context, taskID string) (Leftover, bool) {
	wt, ok := s.Get(taskID)
	if !ok {
		return Leftover{}, false
	}

	left, kept := s.purge(ctx, wt)
	if !kept {
		return Leftover{}, false
	}
	s.log.Warn("worktree left behind",
		"task", taskID, "path", left.Path, "path_kept", left.PathKept, "path_error", left.PathError,
		"branch", left.Branch, "branch_kept", left.BranchKept, "branch_error", left.BranchError)
	return left, true
}

// closeWorktree removes the folder of a worktree and, whatever came of it,
// tells git to forget the worktrees whose folder is gone. The caller holds the
// mutex of the repository.
func (s *Service) closeWorktree(ctx context.Context, wt Worktree) task.CloseStep {
	step := s.removeWorktree(ctx, wt)
	s.prune(ctx, wt.RepoPath)
	return step
}

// removeWorktree is git removing the folder of a worktree, as one part of a
// close result.
func (s *Service) removeWorktree(ctx context.Context, wt Worktree) task.CloseStep {
	if _, err := os.Stat(wt.Path); err != nil {
		// The user removed the folder by hand; there is nothing to take down.
		return skipped(task.SkipMissing)
	}
	if err := do(ctx, CommandTimeout, func(ctx context.Context) error {
		return s.git.RemoveWorktree(ctx, wt.RepoPath, wt.Path)
	}); err != nil {
		return failed(err)
	}
	return task.CloseStep{Outcome: task.OutcomeDone}
}

// closeBranch deletes the branch of a worktree when the policy allows it. The
// caller holds the mutex of the repository.
func (s *Service) closeBranch(
	ctx context.Context, wt Worktree, base string, policy BranchPolicy,
) task.CloseStep {
	exists, err := s.branchExists(ctx, wt.RepoPath, wt.Branch)
	if err != nil {
		return failed(err)
	}
	if !exists {
		return skipped(task.SkipMissing)
	}

	if policy == DeleteBranchIfMerged {
		merged, err := s.mergedInto(ctx, wt, base)
		if err != nil {
			return failed(err)
		}
		if !merged {
			// The merge was never confirmed and git does not see the commits in
			// the base branch, so the work of the branch stays where it is.
			return task.CloseStep{
				Outcome: task.OutcomeSkipped, Reason: task.SkipNotMerged, Detail: wt.Branch,
			}
		}
	}

	if err := do(ctx, CommandTimeout, func(ctx context.Context) error {
		return s.git.DeleteBranch(ctx, wt.RepoPath, wt.Branch)
	}); err != nil {
		return failed(err)
	}
	return task.CloseStep{Outcome: task.OutcomeDone}
}

// mergedInto reports whether git sees the branch of a worktree in the local
// base branch. A base branch that is not there holds nothing.
func (s *Service) mergedInto(ctx context.Context, wt Worktree, base string) (bool, error) {
	if base == "" {
		return false, nil
	}
	exists, err := s.branchExists(ctx, wt.RepoPath, base)
	if err != nil || !exists {
		return false, err
	}
	return ask(ctx, CommandTimeout, func(ctx context.Context) (bool, error) {
		return s.git.IsAncestor(ctx, wt.RepoPath, "refs/heads/"+wt.Branch, "refs/heads/"+base)
	})
}

// closeBase brings the base branch of the repository up to date with its
// remote, and only when a fast-forward of a checked out, clean branch is all it
// takes. Anything else leaves the repository as it is and says why. The caller
// holds the mutex of the repository.
func (s *Service) closeBase(ctx context.Context, repoPath, base string) (task.CloseStep, int) {
	if base == "" {
		return skipped(task.SkipMissing), 0
	}
	exists, err := s.branchExists(ctx, repoPath, base)
	if err != nil {
		return failed(err), 0
	}
	if !exists {
		return skipped(task.SkipMissing), 0
	}

	current, err := ask(ctx, CommandTimeout, func(ctx context.Context) (string, error) {
		return s.git.CurrentBranch(ctx, repoPath)
	})
	if err != nil {
		return failed(err), 0
	}
	if current != base {
		detail := current
		if detail == "" {
			detail = "detached HEAD"
		}
		return task.CloseStep{
			Outcome: task.OutcomeSkipped, Reason: task.SkipNotCheckedOut, Detail: detail,
		}, 0
	}

	status, err := ask(ctx, CommandTimeout, func(ctx context.Context) (git.Status, error) {
		return s.git.Status(ctx, repoPath)
	})
	if err != nil {
		return failed(err), 0
	}
	if !status.Clean() {
		return task.CloseStep{
			Outcome: task.OutcomeSkipped,
			Reason:  task.SkipDirty,
			Detail:  strings.Join(status.Lines(), "\n"),
		}, 0
	}

	upstream, err := ask(ctx, CommandTimeout, func(ctx context.Context) (string, error) {
		return s.git.Upstream(ctx, repoPath, base)
	})
	if err != nil {
		return failed(err), 0
	}
	if upstream == "" {
		return skipped(task.SkipNoUpstream), 0
	}

	if err := do(ctx, FetchTimeout, func(ctx context.Context) error {
		return s.git.Fetch(ctx, repoPath, remote)
	}); err != nil {
		return failed(err), 0
	}
	return s.fastForward(ctx, repoPath, base, upstream)
}

// fastForward moves a base branch that is behind its remote up to it, once
// everything else about the repository has been checked.
func (s *Service) fastForward(ctx context.Context, repoPath, base, upstream string) (task.CloseStep, int) {
	ahead, err := ask(ctx, CommandTimeout, func(ctx context.Context) (int, error) {
		return s.git.CountCommits(ctx, repoPath, upstream, base)
	})
	if err != nil {
		return failed(err), 0
	}
	if ahead > 0 {
		return task.CloseStep{
			Outcome: task.OutcomeSkipped,
			Reason:  task.SkipDiverged,
			Detail:  strconv.Itoa(ahead) + " commits not on " + upstream,
		}, 0
	}

	behind, err := ask(ctx, CommandTimeout, func(ctx context.Context) (int, error) {
		return s.git.CountCommits(ctx, repoPath, base, upstream)
	})
	if err != nil {
		return failed(err), 0
	}
	if behind == 0 {
		return skipped(task.SkipUpToDate), 0
	}

	if err := do(ctx, CommandTimeout, func(ctx context.Context) error {
		return s.git.MergeFastForward(ctx, repoPath, upstream)
	}); err != nil {
		return failed(err), 0
	}
	return task.CloseStep{Outcome: task.OutcomeDone}, behind
}

// purge takes one worktree down with its branch, under the mutex of its
// repository, and says what stayed behind, if anything did.
func (s *Service) purge(ctx context.Context, wt Worktree) (Leftover, bool) {
	unlock := s.lockRepo(wt.RepoPath)
	defer unlock()

	left := Leftover{RepoPath: wt.RepoPath, Path: wt.Path, Branch: wt.Branch}
	if _, err := os.Stat(wt.Path); err == nil {
		if err = do(ctx, CommandTimeout, func(ctx context.Context) error {
			return s.git.RemoveWorktree(ctx, wt.RepoPath, wt.Path)
		}); err != nil {
			left.PathKept, left.PathError = true, err.Error()
		}
	}
	s.prune(ctx, wt.RepoPath)
	if left.PathKept {
		listed := s.Registration(ctx, wt.RepoPath, wt.Path)
		left.PathRegistered, left.PathLocked = listed.Registered, listed.Locked
	}

	if err := s.deleteBranch(ctx, wt); err != nil {
		left.BranchKept, left.BranchError = true, err.Error()
	}

	// The record goes whatever git managed to do: the task is going away, and a
	// record of a worktree nobody owns would only be in the way.
	if err := s.store.Delete(ctx, wt.TaskID); err != nil {
		s.log.Error("delete worktree record failed", "task", wt.TaskID, "path", wt.Path, "error", err)
	}
	s.forget(wt)

	return left, left.PathKept || left.BranchKept
}

// Registration is how git lists a folder that stayed after its removal failed.
type Registration struct {
	// Registered says that git lists the folder as a worktree of the clone it
	// can remove, not one it would forget on the next prune.
	Registered bool
	// Locked says that the worktree is locked: git removes it only with
	// --force twice.
	Locked bool
}

// Registration says how git lists path among the worktrees of the clone at
// repoPath. A listing that fails counts as registered and unlocked: git
// worktree remove is what the user is told to run when nothing says otherwise.
func (s *Service) Registration(ctx context.Context, repoPath, path string) Registration {
	listed, err := ask(ctx, CommandTimeout, func(ctx context.Context) ([]git.ListedWorktree, error) {
		return s.git.Worktrees(ctx, repoPath)
	})
	if err != nil {
		s.log.Warn("worktree list failed", "path", repoPath, "error", err)
		return Registration{Registered: true}
	}
	path = filepath.Clean(path)
	i := slices.IndexFunc(listed, func(wt git.ListedWorktree) bool {
		return !wt.Prunable && filepath.Clean(wt.Path) == path
	})
	if i < 0 {
		return Registration{}
	}
	return Registration{Registered: true, Locked: listed[i].Locked}
}

// deleteBranch deletes the branch of a worktree when it is still there,
// whatever git thinks of what it holds.
func (s *Service) deleteBranch(ctx context.Context, wt Worktree) error {
	exists, err := s.branchExists(ctx, wt.RepoPath, wt.Branch)
	if err != nil {
		return err
	}
	if !exists {
		return nil
	}
	return do(ctx, CommandTimeout, func(ctx context.Context) error {
		return s.git.DeleteBranch(ctx, wt.RepoPath, wt.Branch)
	})
}

// branchExists reports whether a repository has a local branch of that name.
func (s *Service) branchExists(ctx context.Context, repoPath, name string) (bool, error) {
	return ask(ctx, CommandTimeout, func(ctx context.Context) (bool, error) {
		return s.git.BranchExists(ctx, repoPath, name)
	})
}

// prune tells git to forget the worktrees whose folder is gone. A prune that
// fails changes nothing the user asked for, so it only goes to the log.
func (s *Service) prune(ctx context.Context, repoPath string) {
	if err := do(ctx, CommandTimeout, func(ctx context.Context) error {
		return s.git.PruneWorktrees(ctx, repoPath)
	}); err != nil {
		s.log.Warn("worktree prune failed", "path", repoPath, "error", err)
	}
}

// failed is a part of the closing git refused, quoting what it said.
func failed(err error) task.CloseStep {
	return task.CloseStep{Outcome: task.OutcomeFailed, Detail: err.Error()}
}

// skipped is a part of the closing the app left alone on purpose.
func skipped(reason string) task.CloseStep {
	return task.CloseStep{Outcome: task.OutcomeSkipped, Reason: reason}
}
