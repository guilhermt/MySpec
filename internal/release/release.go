// Package release publishes a version of MySpec: it checks that the clone is
// ready, bumps VERSION, commits it on main, tags the commit and pushes both.
// The release workflow builds and publishes from the tag.
package release

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/repository"
)

const (
	// VersionFile is the file, at the root of the repository, that holds the
	// version of the latest release.
	VersionFile = "VERSION"
	branch      = "main"
	remote      = "origin"
)

// Bump is which part of the version a release increments.
type Bump string

// The bumps, from the smallest to the largest.
const (
	BumpPatch Bump = "patch" // a fix: 0.4.0 to 0.4.1
	BumpMinor Bump = "minor" // a feature: 0.4.1 to 0.5.0
	BumpMajor Bump = "major" // 0.5.0 to 1.0.0
)

// ErrUnknownBump reports a bump other than patch, minor or major.
var ErrUnknownBump = errors.New("release: the bump must be patch, minor or major")

// ParseBump narrows s to a Bump.
func ParseBump(s string) (Bump, error) {
	switch b := Bump(s); b {
	case BumpPatch, BumpMinor, BumpMajor:
		return b, nil
	default:
		return "", fmt.Errorf("%w, not %q", ErrUnknownBump, s)
	}
}

// Version is a MAJOR.MINOR.PATCH version, without prefix or suffix.
type Version struct{ Major, Minor, Patch int }

// ErrBadVersion reports a VERSION that is not MAJOR.MINOR.PATCH.
var ErrBadVersion = errors.New("release: VERSION is not MAJOR.MINOR.PATCH")

var versionPattern = regexp.MustCompile(`^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$`)

// ParseVersion reads s, as VERSION holds it, around spaces and newlines.
func ParseVersion(s string) (Version, error) {
	match := versionPattern.FindStringSubmatch(strings.TrimSpace(s))
	if match == nil {
		return Version{}, fmt.Errorf("%w: %q", ErrBadVersion, s)
	}

	var parts [3]int
	for i := range parts {
		n, err := strconv.Atoi(match[i+1])
		if err != nil {
			return Version{}, fmt.Errorf("%w: %q", ErrBadVersion, s)
		}
		parts[i] = n
	}
	return Version{Major: parts[0], Minor: parts[1], Patch: parts[2]}, nil
}

// Bump is the version that follows v by b.
func (v Version) Bump(b Bump) Version {
	switch b {
	case BumpPatch:
		return Version{v.Major, v.Minor, v.Patch + 1}
	case BumpMinor:
		return Version{v.Major, v.Minor + 1, 0}
	case BumpMajor:
		return Version{v.Major + 1, 0, 0}
	default:
		return v
	}
}

// String is v as VERSION holds it: 0.4.0.
func (v Version) String() string {
	return fmt.Sprintf("%d.%d.%d", v.Major, v.Minor, v.Patch)
}

// Tag is the name of the tag of v: v0.4.0.
func (v Version) Tag() string { return "v" + v.String() }

// The refusals: each says what is wrong, and the message says what to do.
var (
	ErrNotOnMain = errors.New("release: not on main")
	ErrDirty     = errors.New("release: the working tree has changes")
	ErrOutOfSync = errors.New("release: main is not the same as origin/main")
	ErrTagExists = errors.New("release: the tag already exists")
	ErrPush      = errors.New("release: the push failed")
)

// Deps are what Run needs from the outside.
type Deps struct {
	Git *git.Runner
}

// Links are where a published release is followed on GitHub.
type Links struct {
	Workflow string // the runs of the release workflow
	Release  string // the page the release gets once the workflow publishes it
}

// Result is what a release published.
type Result struct {
	Version Version
	Links   Links // zero when origin is not on GitHub
}

// Run checks the clone at dir and, when it is ready, bumps VERSION by bump,
// commits it on main as "Release vX.Y.Z", tags the commit and pushes both to
// origin at once. A refusal changes nothing.
func Run(ctx context.Context, deps Deps, dir string, bump Bump) (Result, error) {
	if err := checkClone(ctx, deps.Git, dir); err != nil {
		return Result{}, err
	}

	path := filepath.Join(dir, VersionFile)
	data, err := os.ReadFile(path)
	if err != nil {
		return Result{}, fmt.Errorf("read %s: %w", VersionFile, err)
	}
	current, err := ParseVersion(string(data))
	if err != nil {
		return Result{}, err
	}
	next := current.Bump(bump)
	tag := next.Tag()

	if err := checkTag(ctx, deps.Git, dir, tag); err != nil {
		return Result{}, err
	}

	// VERSION already exists, so WriteFile keeps its mode and the one here only
	// matters to a file that is not there.
	if err := os.WriteFile(path, []byte(next.String()+"\n"), 0o600); err != nil {
		return Result{}, fmt.Errorf("write %s: %w", VersionFile, err)
	}
	message := "Release " + tag
	if err := deps.Git.CommitPath(ctx, dir, VersionFile, message); err != nil {
		return Result{}, fmt.Errorf("commit %s: %w", VersionFile, err)
	}
	if err := deps.Git.AnnotatedTag(ctx, dir, tag, message); err != nil {
		return Result{}, fmt.Errorf("tag %s: %w", tag, err)
	}
	if err := deps.Git.PushAtomic(ctx, dir, remote, "refs/heads/"+branch, "refs/tags/"+tag); err != nil {
		return Result{}, fmt.Errorf("%w: %w\n\nNothing reached origin. To undo it here and try again:\n  git tag -d %s\n  git reset --hard HEAD~1", ErrPush, err, tag)
	}

	result := Result{Version: next}
	// The release is already out: a remote without a readable URL only loses
	// the links.
	if url, err := deps.Git.RemoteURL(ctx, dir, remote); err == nil {
		result.Links, _ = LinksFor(url, next)
	}
	return result, nil
}

// checkClone refuses a clone that is not on a clean main equal to origin/main.
func checkClone(ctx context.Context, g *git.Runner, dir string) error {
	current, err := g.CurrentBranch(ctx, dir)
	if err != nil {
		return fmt.Errorf("read the current branch: %w", err)
	}
	if current != branch {
		on := "on " + current
		if current == "" {
			on = "on a detached HEAD"
		}
		return fmt.Errorf("%w (%s): switch with git switch %s", ErrNotOnMain, on, branch)
	}

	status, err := g.Status(ctx, dir)
	if err != nil {
		return fmt.Errorf("read the status: %w", err)
	}
	if !status.Clean() {
		lines := status.Lines()
		return fmt.Errorf("%w: commit or discard them first\n  %s", ErrDirty, strings.Join(lines, "\n  "))
	}

	if err := g.Fetch(ctx, dir, remote); err != nil {
		return fmt.Errorf("fetch %s: %w", remote, err)
	}
	return checkInSync(ctx, g, dir)
}

// checkInSync refuses a main that differs from origin/main.
func checkInSync(ctx context.Context, g *git.Runner, dir string) error {
	const (
		local    = "refs/heads/" + branch
		upstream = "refs/remotes/" + remote + "/" + branch
	)

	exists, err := g.RefExists(ctx, dir, upstream)
	if err != nil {
		return fmt.Errorf("look for %s/%s: %w", remote, branch, err)
	}
	if !exists {
		return fmt.Errorf("%w (origin has no main): push main first", ErrOutOfSync)
	}

	mine, err := g.Commit(ctx, dir, local)
	if err != nil {
		return fmt.Errorf("read %s: %w", branch, err)
	}
	theirs, err := g.Commit(ctx, dir, upstream)
	if err != nil {
		return fmt.Errorf("read %s/%s: %w", remote, branch, err)
	}
	if mine.SHA == theirs.SHA {
		return nil
	}

	behind, err := g.CountCommits(ctx, dir, local, upstream)
	if err != nil {
		return fmt.Errorf("count the commits main is behind: %w", err)
	}
	ahead, err := g.CountCommits(ctx, dir, upstream, local)
	if err != nil {
		return fmt.Errorf("count the commits main is ahead: %w", err)
	}
	return fmt.Errorf("%w (%d behind, %d ahead): run git pull, and move any commit only main has to a branch", ErrOutOfSync, behind, ahead)
}

// checkTag refuses a tag that the clone or origin already has. Origin is asked
// directly because a fetch does not bring a tag outside the history of main.
func checkTag(ctx context.Context, g *git.Runner, dir, tag string) error {
	local, err := g.RefExists(ctx, dir, "refs/tags/"+tag)
	if err != nil {
		return fmt.Errorf("look for the tag %s: %w", tag, err)
	}
	if local {
		return fmt.Errorf("%w: %s, in this clone", ErrTagExists, tag)
	}

	onOrigin, err := g.RemoteTagExists(ctx, dir, remote, tag)
	if err != nil {
		return fmt.Errorf("look for the tag %s on %s: %w", tag, remote, err)
	}
	if onOrigin {
		return fmt.Errorf("%w: %s, on origin", ErrTagExists, tag)
	}
	return nil
}

// LinksFor are the links of the release of v of the repository at remoteURL;
// ok is false when remoteURL is not a GitHub repository.
func LinksFor(remoteURL string, v Version) (Links, bool) {
	id, ok := repository.ParseRemote(remoteURL)
	if !ok {
		return Links{}, false
	}

	base := "https://github.com/" + id.Owner + "/" + id.Name
	return Links{
		Workflow: base + "/actions/workflows/release.yml",
		Release:  base + "/releases/tag/" + v.Tag(),
	}, true
}
