package release_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/git/gittest"
	"github.com/guilhermt/myspec/internal/release"
)

// fixture is a clone of a bare origin, both holding the commit that adds VERSION.
type fixture struct {
	origin string
	clone  string
	deps   release.Deps
}

// newFixture builds an origin and a clone whose main holds VERSION with
// version.
func newFixture(t *testing.T, version string) fixture {
	t.Helper()

	origin := gittest.Origin(t, false)
	clone := gittest.Clone(t, origin, filepath.Join(t.TempDir(), "clone"))
	gittest.Commit(t, clone, release.VersionFile, version+"\n", "Add VERSION")
	gittest.Run(t, clone, "push", "origin", "main")

	return fixture{
		origin: origin,
		clone:  clone,
		deps:   release.Deps{Git: git.New(git.Deps{Env: gittest.Env(t)})},
	}
}

// otherClone is a second clone of the origin of f.
func otherClone(t *testing.T, f fixture) string {
	t.Helper()
	return gittest.Clone(t, f.origin, filepath.Join(t.TempDir(), "other"))
}

// versionOf is what VERSION holds in dir.
func versionOf(t *testing.T, dir string) string {
	t.Helper()

	data, err := os.ReadFile(filepath.Join(dir, release.VersionFile))
	if err != nil {
		t.Fatalf("ReadFile(VERSION) = %v, want nil", err)
	}
	return string(data)
}

// assertUnchanged fails unless nothing changed: VERSION holds version, the
// clone is at the commit that added it, which is also the main of the origin,
// and neither has a tag.
func assertUnchanged(t *testing.T, f fixture, version string) {
	t.Helper()

	assertClonePristine(t, f, version)
	if got, want := gittest.Run(t, f.origin, "rev-parse", "refs/heads/main"), gittest.Run(t, f.clone, "rev-parse", "HEAD"); got != want {
		t.Errorf("origin main = %s, want %s", got, want)
	}
	if got := gittest.Run(t, f.origin, "tag", "--list"); got != "" {
		t.Errorf("origin tags = %q, want none", got)
	}
}

// assertClonePristine fails unless VERSION holds version and the clone has no
// commit past Add VERSION and no tag.
func assertClonePristine(t *testing.T, f fixture, version string) {
	t.Helper()

	if got, want := versionOf(t, f.clone), version+"\n"; got != want {
		t.Errorf("VERSION = %q, want %q", got, want)
	}
	if got := gittest.Run(t, f.clone, "log", "-1", "--format=%s"); got != "Add VERSION" {
		t.Errorf("HEAD subject = %q, want %q", got, "Add VERSION")
	}
	if got := gittest.Run(t, f.clone, "tag", "--list"); got != "" {
		t.Errorf("clone tags = %q, want none", got)
	}
}
