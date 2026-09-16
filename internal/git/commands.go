package git

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
)

// The exit codes the app reads as an answer instead of a failure.
const (
	// refNotFound is what rev-parse --verify --quiet uses for a ref that does
	// not exist.
	refNotFound = 1
	// pathNotIgnored is what check-ignore --quiet uses for a path the
	// repository does not ignore.
	pathNotIgnored = 1
	// detachedHead is what symbolic-ref --quiet uses for a HEAD that points at
	// a commit instead of a branch.
	detachedHead = 1
	// notAncestor is what merge-base --is-ancestor uses for a commit that is
	// not part of the ref.
	notAncestor = 1
	// noSuchRemote is what remote get-url uses for a remote the repository does
	// not have.
	noSuchRemote = 2
)

// ErrNoRemote reports that the repository has no remote of the name asked for.
var ErrNoRemote = errors.New("git: no such remote")

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

// Kind is what happened to a path, for the interface to label it.
type Kind string

// The kinds of change the app shows.
const (
	KindAdded     Kind = "added"
	KindModified  Kind = "modified"
	KindDeleted   Kind = "deleted"
	KindRenamed   Kind = "renamed"
	KindUntracked Kind = "untracked"
)

// Change is what git reports about one path of a working tree, with the two
// codes porcelain v2 uses: X, the index against HEAD, and Y, the working tree
// against the index. '.' means unchanged, and '?' marks an untracked path.
type Change struct {
	X, Y     byte
	Path     string // relative to the working tree root
	OrigPath string // where a rename or a copy came from; "" otherwise
}

// Staged reports whether nothing of the path is left outside the index: the
// index differs from HEAD and the working tree matches the index.
func (c Change) Staged() bool { return c.X != '.' && c.X != '?' && c.Y == '.' }

// Kind names the change for the interface.
func (c Change) Kind() Kind {
	switch {
	case c.X == '?':
		return KindUntracked
	case c.X == 'R' || c.X == 'C':
		return KindRenamed
	case c.X == 'D' || c.Y == 'D':
		return KindDeleted
	case c.X == 'A':
		return KindAdded
	default:
		return KindModified
	}
}

// Line renders the change the way git status --porcelain=v1 prints it, which
// is how the app quotes git back to the user.
func (c Change) Line() string {
	if c.X == '?' {
		return "?? " + c.Path
	}

	path := c.Path
	if c.OrigPath != "" {
		path = c.OrigPath + " -> " + c.Path
	}
	return string([]byte{code(c.X), code(c.Y)}) + " " + path
}

// code is how v1 prints one of the two codes: a space for an unchanged side.
func code(b byte) byte {
	if b == '.' {
		return ' '
	}
	return b
}

// Status is the state of a working tree at a point in time.
type Status struct {
	Head    string // the commit HEAD points at; "" on a branch with no commit yet
	Changes []Change
}

// Clean reports whether nothing is modified, staged, deleted or untracked.
func (s Status) Clean() bool { return len(s.Changes) == 0 }

// Lines renders the changes as git status --porcelain=v1 would print them.
func (s Status) Lines() []string {
	lines := make([]string, 0, len(s.Changes))
	for _, change := range s.Changes {
		lines = append(lines, change.Line())
	}
	return lines
}

// Status reads the state of the working tree at dir. --no-optional-locks keeps
// the read from refreshing the index, so it neither writes nor takes
// index.lock while the agent works in the same worktree.
// --untracked-files=all lists every file of a new directory, so a count
// matches what the user sees.
func (r *Runner) Status(ctx context.Context, dir string) (Status, error) {
	out, err := r.Run(ctx, dir,
		"--no-optional-locks", "status", "--porcelain=v2", "--branch", "-z", "--untracked-files=all")
	if err != nil {
		return Status{}, err
	}
	return parseStatus(out)
}

// The record headers of --porcelain=v2, and how many fields each one has
// before its path.
const (
	headerBranchOID = "# branch.oid "
	fieldsChanged   = 9  // 1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>
	fieldsRenamed   = 10 // 2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <Xscore> <path>
	fieldsUnmerged  = 11 // u <XY> <sub> <m1> <m2> <m3> <mW> <h1> <h2> <h3> <path>
)

// parseStatus reads the NUL separated records of --porcelain=v2 --branch.
func parseStatus(out string) (Status, error) {
	var status Status

	records := strings.Split(out, "\x00")
	for len(records) > 0 {
		record := records[0]
		records = records[1:]

		var (
			change Change
			err    error
		)
		switch {
		case record == "":
			continue
		case strings.HasPrefix(record, headerBranchOID):
			if oid := strings.TrimPrefix(record, headerBranchOID); oid != "(initial)" {
				status.Head = oid
			}
			continue
		case strings.HasPrefix(record, "# "):
			continue
		case strings.HasPrefix(record, "! "):
			// The command does not ask for ignored files; one is not a change.
			continue
		case strings.HasPrefix(record, "? "):
			change = Change{X: '?', Y: '?', Path: strings.TrimPrefix(record, "? ")}
		case strings.HasPrefix(record, "1 "):
			change, err = parseChange(record, fieldsChanged)
		case strings.HasPrefix(record, "2 "):
			if change, err = parseChange(record, fieldsRenamed); err == nil {
				// The path it came from is the record right after it.
				if len(records) == 0 {
					err = fmt.Errorf("parse git status: %q has no original path", record)
				} else {
					change.OrigPath, records = records[0], records[1:]
				}
			}
		case strings.HasPrefix(record, "u "):
			change, err = parseChange(record, fieldsUnmerged)
		default:
			err = fmt.Errorf("parse git status: unexpected record %q", record)
		}
		if err != nil {
			return Status{}, err
		}
		status.Changes = append(status.Changes, change)
	}
	return status, nil
}

// parseChange reads a record whose path is its last field, of fields in all.
func parseChange(record string, fields int) (Change, error) {
	parts := strings.SplitN(record, " ", fields)
	if len(parts) < fields || len(parts[1]) != 2 || parts[fields-1] == "" {
		return Change{}, fmt.Errorf("parse git status: unexpected record %q", record)
	}
	return Change{X: parts[1][0], Y: parts[1][1], Path: parts[fields-1]}, nil
}

// GitDir is the absolute git directory of the working tree at dir. For a
// linked worktree it is <repo>/.git/worktrees/<name>, where its index lives.
func (r *Runner) GitDir(ctx context.Context, dir string) (string, error) {
	return r.Run(ctx, dir, "rev-parse", "--absolute-git-dir")
}

// TrackedFiles lists the paths git tracks in the working tree at dir,
// relative to it.
func (r *Runner) TrackedFiles(ctx context.Context, dir string) ([]string, error) {
	out, err := r.Run(ctx, dir, "ls-files", "-z")
	if err != nil {
		return nil, err
	}

	var files []string
	for path := range strings.SplitSeq(out, "\x00") {
		if path != "" {
			files = append(files, path)
		}
	}
	return files, nil
}

// IsIgnored reports whether path, absolute or relative to dir, is ignored by
// the repository.
func (r *Runner) IsIgnored(ctx context.Context, dir, path string) (bool, error) {
	_, err := r.Run(ctx, dir, "check-ignore", "--quiet", "--", path)
	if err == nil {
		return true, nil
	}

	var gitErr *Error
	if errors.As(err, &gitErr) && gitErr.ExitCode == pathNotIgnored {
		return false, nil
	}
	return false, err
}

// Commit is one commit, as the app shows it.
type Commit struct {
	SHA     string
	Subject string
}

// Commit reads a commit of the repository at dir.
func (r *Runner) Commit(ctx context.Context, dir, rev string) (Commit, error) {
	out, err := r.Run(ctx, dir, "log", "-1", "--format=%H%x00%s", rev)
	if err != nil {
		return Commit{}, err
	}

	sha, subject, found := strings.Cut(out, "\x00")
	if !found {
		return Commit{}, fmt.Errorf("parse git log: unexpected output %q", out)
	}
	return Commit{SHA: sha, Subject: subject}, nil
}

// CountCommits is how many commits ref has that base does not.
func (r *Runner) CountCommits(ctx context.Context, dir, base, ref string) (int, error) {
	out, err := r.Run(ctx, dir, "rev-list", "--count", base+".."+ref)
	if err != nil {
		return 0, err
	}

	count, err := strconv.Atoi(out)
	if err != nil {
		return 0, fmt.Errorf("parse git rev-list --count: unexpected output %q", out)
	}
	return count, nil
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

// CurrentBranch is the branch checked out at dir, "" on a detached HEAD.
func (r *Runner) CurrentBranch(ctx context.Context, dir string) (string, error) {
	out, err := r.Run(ctx, dir, "symbolic-ref", "--short", "--quiet", "HEAD")
	if err == nil {
		return out, nil
	}

	var gitErr *Error
	// A HEAD that names no branch is an answer, not a failure: the app asks to
	// find out whether the base branch is the one checked out.
	if errors.As(err, &gitErr) && gitErr.ExitCode == detachedHead {
		return "", nil
	}
	return "", err
}

// Upstream is the remote-tracking branch of a local branch, like origin/dev,
// or "" when the branch tracks nothing.
func (r *Runner) Upstream(ctx context.Context, dir, branch string) (string, error) {
	return r.Run(ctx, dir, "for-each-ref", "--format=%(upstream:short)", "refs/heads/"+branch)
}

// RemoteURL is the URL of a remote of the repository at dir, as git resolves
// it, and ErrNoRemote when the repository has no remote of that name.
func (r *Runner) RemoteURL(ctx context.Context, dir, name string) (string, error) {
	out, err := r.Run(ctx, dir, "remote", "get-url", name)
	if err == nil {
		return out, nil
	}
	var gitErr *Error
	if errors.As(err, &gitErr) && gitErr.ExitCode == noSuchRemote {
		return "", fmt.Errorf("%w: %s", ErrNoRemote, name)
	}
	return "", err
}

// IsAncestor reports whether commit is reachable from ref: whether what
// commit holds is already part of ref.
func (r *Runner) IsAncestor(ctx context.Context, dir, commit, ref string) (bool, error) {
	_, err := r.Run(ctx, dir, "merge-base", "--is-ancestor", commit, ref)
	if err == nil {
		return true, nil
	}

	var gitErr *Error
	if errors.As(err, &gitErr) && gitErr.ExitCode == notAncestor {
		return false, nil
	}
	return false, err
}

// MergeFastForward moves the branch checked out at dir to ref, and only when
// that is a fast-forward: nothing is merged, rebased or rewritten.
func (r *Runner) MergeFastForward(ctx context.Context, dir, ref string) error {
	_, err := r.Run(ctx, dir, "merge", "--ff-only", "--quiet", ref)
	return err
}
