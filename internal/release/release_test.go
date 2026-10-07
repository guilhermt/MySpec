package release_test

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/git/gittest"
	"github.com/guilhermt/myspec/internal/release"
)

func TestBumpComputesTheNextVersion(t *testing.T) {
	t.Parallel()

	tests := []struct {
		from string
		bump release.Bump
		want string
	}{
		{"0.3.0", release.BumpPatch, "0.3.1"},
		{"0.3.0", release.BumpMinor, "0.4.0"},
		{"0.3.0", release.BumpMajor, "1.0.0"},
		{"0.0.0", release.BumpMinor, "0.1.0"},
		{"1.2.9", release.BumpPatch, "1.2.10"},
		{"1.9.3", release.BumpMinor, "1.10.0"},
	}
	for _, tt := range tests {
		t.Run(tt.from+" "+string(tt.bump), func(t *testing.T) {
			t.Parallel()

			from, err := release.ParseVersion(tt.from)
			if err != nil {
				t.Fatalf("ParseVersion(%q) = %v, want nil", tt.from, err)
			}
			if got := from.Bump(tt.bump).String(); got != tt.want {
				t.Errorf("%s.Bump(%s) = %s, want %s", tt.from, tt.bump, got, tt.want)
			}
		})
	}
}

func TestParseBumpRefusesAnythingButPatchMinorMajor(t *testing.T) {
	t.Parallel()

	for _, s := range []string{"", "Minor", " patch", "fix", "--dry-run"} {
		t.Run(s, func(t *testing.T) {
			t.Parallel()

			if _, err := release.ParseBump(s); !errors.Is(err, release.ErrUnknownBump) {
				t.Errorf("ParseBump(%q) error = %v, want ErrUnknownBump", s, err)
			}
		})
	}
}

func TestParseVersionReadsTheVersionAroundTheNewline(t *testing.T) {
	t.Parallel()

	got, err := release.ParseVersion("0.4.0\n")
	if err != nil {
		t.Fatalf("ParseVersion() = %v, want nil", err)
	}
	if diff := cmp.Diff(release.Version{Major: 0, Minor: 4, Patch: 0}, got); diff != "" {
		t.Errorf("ParseVersion() mismatch (-want +got):\n%s", diff)
	}
}

func TestParseVersionRefusesWhatIsNotMajorMinorPatch(t *testing.T) {
	t.Parallel()

	for _, s := range []string{"", "1.2", "v1.2.3", "1.2.3-rc.1", "1.2.3+build", "01.2.3", "1.2.3.4", "99999999999999999999.0.0"} {
		t.Run(s, func(t *testing.T) {
			t.Parallel()

			if _, err := release.ParseVersion(s); !errors.Is(err, release.ErrBadVersion) {
				t.Errorf("ParseVersion(%q) error = %v, want ErrBadVersion", s, err)
			}
		})
	}
}

func TestVersionNamesItsTag(t *testing.T) {
	t.Parallel()

	v := release.Version{Major: 0, Minor: 4, Patch: 0}
	if got := v.Tag(); got != "v0.4.0" {
		t.Errorf("Tag() = %q, want v0.4.0", got)
	}
	if got := v.String(); got != "0.4.0" {
		t.Errorf("String() = %q, want 0.4.0", got)
	}
}

func TestAReleaseCommitsTheVersionTagsItAndPushesBoth(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "0.3.0")

	got, err := release.Run(t.Context(), f.deps, f.clone, release.BumpMinor)
	if err != nil {
		t.Fatalf("Run() = %v, want nil", err)
	}

	if diff := cmp.Diff(release.Version{Major: 0, Minor: 4, Patch: 0}, got.Version); diff != "" {
		t.Errorf("Run() version mismatch (-want +got):\n%s", diff)
	}
	if got := versionOf(t, f.clone); got != "0.4.0\n" {
		t.Errorf("VERSION = %q, want %q", got, "0.4.0\n")
	}
	if got := gittest.Run(t, f.origin, "log", "-1", "--format=%s", "refs/heads/main"); got != "Release v0.4.0" {
		t.Errorf("origin main subject = %q, want %q", got, "Release v0.4.0")
	}
	if got := gittest.Run(t, f.origin, "show", "--name-only", "--format=", "refs/heads/main"); got != "VERSION" {
		t.Errorf("files of the release commit = %q, want VERSION", got)
	}
	if got := gittest.Run(t, f.origin, "cat-file", "-t", "refs/tags/v0.4.0"); got != "tag" {
		t.Errorf("type of v0.4.0 = %q, want tag", got)
	}
	tagged := gittest.Run(t, f.origin, "rev-parse", "refs/tags/v0.4.0^{commit}")
	if main := gittest.Run(t, f.origin, "rev-parse", "refs/heads/main"); tagged != main {
		t.Errorf("v0.4.0 points at %s, want main at %s", tagged, main)
	}
	if got := gittest.Run(t, f.clone, "status", "--porcelain"); got != "" {
		t.Errorf("status = %q, want clean", got)
	}
}

func TestTheFirstReleaseIsVersionZeroOneZero(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "0.0.0")

	got, err := release.Run(t.Context(), f.deps, f.clone, release.BumpMinor)
	if err != nil {
		t.Fatalf("Run() = %v, want nil", err)
	}
	if got.Version.Tag() != "v0.1.0" {
		t.Errorf("Run() tag = %s, want v0.1.0", got.Version.Tag())
	}
	if got := gittest.Run(t, f.origin, "tag", "--list"); got != "v0.1.0" {
		t.Errorf("origin tags = %q, want v0.1.0", got)
	}
}

func TestAReleaseIgnoresFilesTheRepositoryIgnores(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "0.3.0")
	gittest.Commit(t, f.clone, ".gitignore", "ignored.txt\n", "Ignore a file")
	gittest.Run(t, f.clone, "push", "origin", "main")
	if err := os.WriteFile(filepath.Join(f.clone, "ignored.txt"), []byte("x"), 0o600); err != nil {
		t.Fatalf("WriteFile() = %v, want nil", err)
	}

	if _, err := release.Run(t.Context(), f.deps, f.clone, release.BumpPatch); err != nil {
		t.Fatalf("Run() = %v, want nil", err)
	}
}

func TestAReleaseIsRefusedOnABranchOtherThanMain(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "0.3.0")
	gittest.Run(t, f.clone, "switch", "-c", "feature")

	_, err := release.Run(t.Context(), f.deps, f.clone, release.BumpMinor)
	if !errors.Is(err, release.ErrNotOnMain) {
		t.Fatalf("Run() error = %v, want ErrNotOnMain", err)
	}
	if !strings.Contains(err.Error(), "on feature") {
		t.Errorf("Run() error = %q, want it to name the branch", err)
	}
	assertUnchanged(t, f, "0.3.0")
}

func TestAReleaseIsRefusedOnADetachedHead(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "0.3.0")
	gittest.Run(t, f.clone, "checkout", "--detach")

	_, err := release.Run(t.Context(), f.deps, f.clone, release.BumpMinor)
	if !errors.Is(err, release.ErrNotOnMain) {
		t.Fatalf("Run() error = %v, want ErrNotOnMain", err)
	}
	if !strings.Contains(err.Error(), "detached HEAD") {
		t.Errorf("Run() error = %q, want it to say the HEAD is detached", err)
	}
	assertUnchanged(t, f, "0.3.0")
}

func TestAReleaseIsRefusedWithAModifiedFile(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "0.3.0")
	if err := os.WriteFile(filepath.Join(f.clone, "README.md"), []byte("changed\n"), 0o600); err != nil {
		t.Fatalf("WriteFile() = %v, want nil", err)
	}

	_, err := release.Run(t.Context(), f.deps, f.clone, release.BumpMinor)
	if !errors.Is(err, release.ErrDirty) {
		t.Fatalf("Run() error = %v, want ErrDirty", err)
	}
	if !strings.Contains(err.Error(), "README.md") {
		t.Errorf("Run() error = %q, want it to list README.md", err)
	}
	assertUnchanged(t, f, "0.3.0")
}

func TestAReleaseIsRefusedWithAnUntrackedFile(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "0.3.0")
	if err := os.WriteFile(filepath.Join(f.clone, "scratch.txt"), []byte("x"), 0o600); err != nil {
		t.Fatalf("WriteFile() = %v, want nil", err)
	}

	_, err := release.Run(t.Context(), f.deps, f.clone, release.BumpMinor)
	if !errors.Is(err, release.ErrDirty) {
		t.Fatalf("Run() error = %v, want ErrDirty", err)
	}
	if !strings.Contains(err.Error(), "scratch.txt") {
		t.Errorf("Run() error = %q, want it to list scratch.txt", err)
	}
	assertUnchanged(t, f, "0.3.0")
}

func TestAReleaseIsRefusedWhenOriginMovedAhead(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "0.3.0")
	other := otherClone(t, f)
	gittest.Commit(t, other, "news.md", "news\n", "Add news")
	gittest.Run(t, other, "push", "origin", "main")

	_, err := release.Run(t.Context(), f.deps, f.clone, release.BumpMinor)
	if !errors.Is(err, release.ErrOutOfSync) {
		t.Fatalf("Run() error = %v, want ErrOutOfSync", err)
	}
	if !strings.Contains(err.Error(), "1 behind, 0 ahead") {
		t.Errorf("Run() error = %q, want it to count 1 behind, 0 ahead", err)
	}
	assertClonePristine(t, f, "0.3.0")
	if got := gittest.Run(t, f.origin, "tag", "--list"); got != "" {
		t.Errorf("origin tags = %q, want none", got)
	}
}

func TestAReleaseIsRefusedWithACommitOnlyMainHas(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "0.3.0")
	gittest.Commit(t, f.clone, "local.md", "local\n", "Add a local commit")

	_, err := release.Run(t.Context(), f.deps, f.clone, release.BumpMinor)
	if !errors.Is(err, release.ErrOutOfSync) {
		t.Fatalf("Run() error = %v, want ErrOutOfSync", err)
	}
	if !strings.Contains(err.Error(), "0 behind, 1 ahead") {
		t.Errorf("Run() error = %q, want it to count 0 behind, 1 ahead", err)
	}
	if got := versionOf(t, f.clone); got != "0.3.0\n" {
		t.Errorf("VERSION = %q, want %q", got, "0.3.0\n")
	}
	if got := gittest.Run(t, f.clone, "log", "-1", "--format=%s"); got != "Add a local commit" {
		t.Errorf("HEAD subject = %q, want %q", got, "Add a local commit")
	}
	if got := gittest.Run(t, f.clone, "tag", "--list"); got != "" {
		t.Errorf("clone tags = %q, want none", got)
	}
	if got := gittest.Run(t, f.origin, "log", "-1", "--format=%s", "refs/heads/main"); got != "Add VERSION" {
		t.Errorf("origin main subject = %q, want %q", got, "Add VERSION")
	}
	if got := gittest.Run(t, f.origin, "tag", "--list"); got != "" {
		t.Errorf("origin tags = %q, want none", got)
	}
}

func TestAReleaseIsRefusedWhenTheTagExistsInTheClone(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "0.3.0")
	gittest.Run(t, f.clone, "tag", "v0.4.0")

	_, err := release.Run(t.Context(), f.deps, f.clone, release.BumpMinor)
	if !errors.Is(err, release.ErrTagExists) {
		t.Fatalf("Run() error = %v, want ErrTagExists", err)
	}
	if !strings.Contains(err.Error(), "in this clone") {
		t.Errorf("Run() error = %q, want it to say the tag is in this clone", err)
	}
	if got := versionOf(t, f.clone); got != "0.3.0\n" {
		t.Errorf("VERSION = %q, want %q", got, "0.3.0\n")
	}
	if got := gittest.Run(t, f.clone, "log", "-1", "--format=%s"); got != "Add VERSION" {
		t.Errorf("HEAD subject = %q, want %q", got, "Add VERSION")
	}
}

func TestAReleaseIsRefusedWhenTheTagExistsOnOrigin(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "0.3.0")
	other := otherClone(t, f)
	gittest.Run(t, other, "switch", "-c", "elsewhere")
	gittest.Commit(t, other, "else.md", "else\n", "Add elsewhere")
	gittest.Run(t, other, "tag", "v0.4.0")
	gittest.Run(t, other, "push", "origin", "refs/tags/v0.4.0")

	_, err := release.Run(t.Context(), f.deps, f.clone, release.BumpMinor)
	if !errors.Is(err, release.ErrTagExists) {
		t.Fatalf("Run() error = %v, want ErrTagExists", err)
	}
	if !strings.Contains(err.Error(), "on origin") {
		t.Errorf("Run() error = %q, want it to say the tag is on origin", err)
	}
	assertClonePristine(t, f, "0.3.0")
}

func TestAReleaseIsRefusedWhenVersionIsNotMajorMinorPatch(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "v0.3.0")

	_, err := release.Run(t.Context(), f.deps, f.clone, release.BumpMinor)
	if !errors.Is(err, release.ErrBadVersion) {
		t.Fatalf("Run() error = %v, want ErrBadVersion", err)
	}
	assertUnchanged(t, f, "v0.3.0")
}

func TestAFailedPushLeavesOriginUntouchedAndSaysHowToUndo(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "0.3.0")
	gittest.Run(t, f.origin, "config", "receive.maxInputSize", "1")

	_, err := release.Run(t.Context(), f.deps, f.clone, release.BumpMinor)
	if !errors.Is(err, release.ErrPush) {
		t.Fatalf("Run() error = %v, want ErrPush", err)
	}
	for _, want := range []string{"git tag -d v0.4.0", "git reset --hard HEAD~1"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("Run() error = %q, want it to contain %q", err, want)
		}
	}
	if got := gittest.Run(t, f.origin, "log", "-1", "--format=%s", "refs/heads/main"); got != "Add VERSION" {
		t.Errorf("origin main subject = %q, want %q", got, "Add VERSION")
	}
	if got := gittest.Run(t, f.origin, "tag", "--list"); got != "" {
		t.Errorf("origin tags = %q, want none", got)
	}

	gittest.Run(t, f.clone, "tag", "-d", "v0.4.0")
	gittest.Run(t, f.clone, "reset", "--hard", "HEAD~1")
	gittest.Run(t, f.origin, "config", "--unset", "receive.maxInputSize")

	got, err := release.Run(t.Context(), f.deps, f.clone, release.BumpMinor)
	if err != nil {
		t.Fatalf("Run() after the undo = %v, want nil", err)
	}
	if got.Version.Tag() != "v0.4.0" {
		t.Errorf("Run() after the undo tag = %s, want v0.4.0", got.Version.Tag())
	}
}

func TestLinksForAGitHubRemote(t *testing.T) {
	t.Parallel()

	want := release.Links{
		Workflow: "https://github.com/guilhermt/MySpec/actions/workflows/release.yml",
		Release:  "https://github.com/guilhermt/MySpec/releases/tag/v0.4.0",
	}
	for _, url := range []string{"https://github.com/guilhermt/MySpec.git", "git@github.com:guilhermt/MySpec.git"} {
		t.Run(url, func(t *testing.T) {
			t.Parallel()

			got, ok := release.LinksFor(url, release.Version{Major: 0, Minor: 4, Patch: 0})
			if !ok {
				t.Fatalf("LinksFor(%q) ok = false, want true", url)
			}
			if diff := cmp.Diff(want, got); diff != "" {
				t.Errorf("LinksFor(%q) mismatch (-want +got):\n%s", url, diff)
			}
		})
	}
}

func TestLinksForARemoteOffGitHubAreNone(t *testing.T) {
	t.Parallel()

	if _, ok := release.LinksFor("/tmp/origin.git", release.Version{Major: 0, Minor: 4, Patch: 0}); ok {
		t.Error("LinksFor(/tmp/origin.git) ok = true, want false")
	}
}
