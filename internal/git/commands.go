package git

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
)

// refNotFound is the exit code rev-parse --verify --quiet uses for a ref that
// does not exist.
const refNotFound = 1

// Fetch updates the remote-tracking branches of remote.
func (r *Runner) Fetch(ctx context.Context, dir, remote string) error {
	_, err := r.Run(ctx, dir, "fetch", remote)
	return err
}

// RefExists reports whether ref resolves in the repository. ref is always a
// full name, like refs/remotes/origin/dev, never an abbreviation.
func (r *Runner) RefExists(ctx context.Context, dir, ref string) (bool, error) {
	_, err := r.Run(ctx, dir, "rev-parse", "--verify", "--quiet", ref)
	if err == nil {
		return true, nil
	}

	var gitErr *Error
	if errors.As(err, &gitErr) && gitErr.ExitCode == refNotFound {
		return false, nil
	}
	return false, err
}

// BranchExists reports whether the repository has a local branch named name.
func (r *Runner) BranchExists(ctx context.Context, dir, name string) (bool, error) {
	return r.RefExists(ctx, dir, "refs/heads/"+name)
}

// AddWorktree adds a worktree at path on a new branch created from base.
// --no-track because branch.autoSetupMerge would make the branch track
// origin/dev; the upstream belongs to the PR stage.
func (r *Runner) AddWorktree(ctx context.Context, dir, path, branch, base string) error {
	_, err := r.Run(ctx, dir, "worktree", "add", "--no-track", "-b", branch, path, base)
	return err
}

// RemoveWorktree removes the worktree at path, whatever it has inside.
func (r *Runner) RemoveWorktree(ctx context.Context, dir, path string) error {
	_, err := r.Run(ctx, dir, "worktree", "remove", "--force", path)
	return err
}

// PruneWorktrees forgets the worktrees whose directory is gone.
func (r *Runner) PruneWorktrees(ctx context.Context, dir string) error {
	_, err := r.Run(ctx, dir, "worktree", "prune")
	return err
}

// DeleteBranch deletes the branch named name, merged or not.
func (r *Runner) DeleteBranch(ctx context.Context, dir, name string) error {
	_, err := r.Run(ctx, dir, "branch", "-D", name)
	return err
}

// Status returns the porcelain lines of the working tree at dir, in git's
// order, empty when nothing changed. --untracked-files=all lists every file of
// a new directory, so a count matches what the user sees.
func (r *Runner) Status(ctx context.Context, dir string) ([]string, error) {
	out, err := r.Run(ctx, dir, "status", "--porcelain=v1", "--untracked-files=all")
	if err != nil {
		return nil, err
	}

	var lines []string
	for _, line := range strings.Split(out, "\n") {
		if line != "" {
			lines = append(lines, line)
		}
	}
	return lines, nil
}

// Reset restores the tracked files of the working tree at dir.
func (r *Runner) Reset(ctx context.Context, dir string) error {
	_, err := r.Run(ctx, dir, "reset", "--hard", "--quiet")
	return err
}

// Clean removes the untracked files and directories of the working tree at
// dir. Without -x: ignored files are not dirt and are not deleted.
func (r *Runner) Clean(ctx context.Context, dir string) error {
	_, err := r.Run(ctx, dir, "clean", "-fd", "--quiet")
	return err
}

// ExcludePath is the absolute path of the info/exclude file of the repository
// at dir.
func (r *Runner) ExcludePath(ctx context.Context, dir string) (string, error) {
	out, err := r.Run(ctx, dir, "rev-parse", "--git-path", "info/exclude")
	if err != nil {
		return "", err
	}
	if filepath.IsAbs(out) {
		return out, nil
	}
	return filepath.Join(dir, out), nil
}
