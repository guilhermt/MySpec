package repository_test

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/repository"
)

// scan runs the scan of the fixture, failing the test on error.
func (f fixture) scan(t *testing.T) []repository.Candidate {
	t.Helper()

	got, err := f.service.Scan(t.Context())
	if err != nil {
		t.Fatalf("Scan() = %v, want nil", err)
	}
	return got
}

// identified creates a clone at the path under the scan root and makes
// Identify read it as owner/name.
func (f fixture) identified(t *testing.T, rel, owner, name string) string {
	t.Helper()

	path := clone(t, f.scanRoot, rel)
	f.answers[path] = answer{identity: repository.Identity{Owner: owner, Name: name}}
	return path
}

// paths are the paths of the candidates, in order.
func paths(candidates []repository.Candidate) []string {
	out := make([]string, len(candidates))
	for i, candidate := range candidates {
		out[i] = candidate.Path
	}
	return out
}

func TestTheScanFindsClonesUpToSixFoldersDeep(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	first := f.identified(t, "api", "dev", "api")
	deepest := f.identified(t, "a/b/c/d/e/web", "dev", "web")
	f.identified(t, "a/b/c/d/e/f/cli", "dev", "cli")

	want := []repository.Candidate{
		{Identity: repository.Identity{Owner: "dev", Name: "api"}, Path: first},
		{Identity: repository.Identity{Owner: "dev", Name: "web"}, Path: deepest},
	}
	if diff := cmp.Diff(want, f.scan(t)); diff != "" {
		t.Errorf("Scan() mismatch (-want +got):\n%s", diff)
	}
}

func TestTheScanSkipsHiddenFoldersAndNodeModules(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.identified(t, ".config/web", "dev", "web")
	f.identified(t, "projects/.cache/api", "dev", "api")
	f.identified(t, "projects/node_modules/cli", "dev", "cli")
	f.identified(t, "node_modules/deep/lib", "dev", "lib")

	if got := f.scan(t); len(got) != 0 {
		t.Errorf("Scan() = %+v, want nothing", got)
	}
}

func TestTheScanDoesNotDescendIntoAWorktreeOrAClone(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	worktree := filepath.Join(f.scanRoot, "worktree")
	if err := os.MkdirAll(worktree, 0o750); err != nil {
		t.Fatalf("MkdirAll(%s) = %v, want nil", worktree, err)
	}
	if err := os.WriteFile(filepath.Join(worktree, ".git"), []byte("gitdir: elsewhere\n"), 0o600); err != nil {
		t.Fatalf("WriteFile() = %v, want nil", err)
	}
	f.answers[worktree] = answer{identity: repository.Identity{Owner: "dev", Name: "tree"}}
	f.identified(t, "worktree/inner", "dev", "inner")
	outer := f.identified(t, "web", "dev", "web")
	f.identified(t, "web/vendor/lib", "dev", "lib")

	if diff := cmp.Diff([]string{outer}, paths(f.scan(t))); diff != "" {
		t.Errorf("paths mismatch (-want +got):\n%s", diff)
	}
}

func TestTheScanLeavesOutTheClonesIdentifyRefusesSilently(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	clone(t, f.scanRoot, "no-origin")
	offGitHub := clone(t, f.scanRoot, "gitlab")
	f.answers[offGitHub] = answer{err: &repository.Refusal{Reason: repository.ReasonNotGitHub, Path: offGitHub}}
	web := f.identified(t, "web", "dev", "web")

	if diff := cmp.Diff([]string{web}, paths(f.scan(t))); diff != "" {
		t.Errorf("paths mismatch (-want +got):\n%s", diff)
	}
	if got := f.logs.count(t, "clone not identified"); got != 0 {
		t.Errorf("clone not identified logged %d times, want none", got)
	}
}

func TestTheScanLeavesOutAndLogsACloneGitFailsOn(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	broken := clone(t, f.scanRoot, "broken")
	f.answers[broken] = answer{err: errors.New("git exploded")}

	if got := f.scan(t); len(got) != 0 {
		t.Errorf("Scan() = %+v, want nothing", got)
	}
	if got := f.logs.count(t, "clone not identified"); got != 1 {
		t.Errorf("clone not identified logged %d times, want 1", got)
	}
}

func TestTheScanMarksEveryCloneOfARegisteredRepository(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	registered := clone(t, f.scanRoot, "web")
	f.register(t, registered, "dev", "web")
	again := f.identified(t, "copies/web", "Dev", "WEB")
	other := f.identified(t, "api", "dev", "api")

	want := []repository.Candidate{
		{Identity: repository.Identity{Owner: "dev", Name: "api"}, Path: other},
		{Identity: repository.Identity{Owner: "Dev", Name: "WEB"}, Path: again, Registered: true},
		{Identity: repository.Identity{Owner: "dev", Name: "web"}, Path: registered, Registered: true},
	}
	if diff := cmp.Diff(want, f.scan(t)); diff != "" {
		t.Errorf("Scan() mismatch (-want +got):\n%s", diff)
	}
}

func TestTheScanIsSortedByOwnerAndNameIgnoringCaseThenPath(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	second := f.identified(t, "b/web", "dev", "web")
	first := f.identified(t, "a/web", "Dev", "Web")
	api := f.identified(t, "z/api", "dev", "API")
	acme := f.identified(t, "acme", "acme", "site")

	if diff := cmp.Diff([]string{acme, api, first, second}, paths(f.scan(t))); diff != "" {
		t.Errorf("paths mismatch (-want +got):\n%s", diff)
	}
}

func TestTheScanOfAnEmptyFolderIsAnEmptyList(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	got := f.scan(t)
	if got == nil || len(got) != 0 {
		t.Errorf("Scan() = %#v, want an empty non-nil slice", got)
	}
}

func TestTheScanFailsWhenTheRootDoesNotExist(t *testing.T) {
	t.Parallel()
	service := repository.New(repository.Deps{ScanRoot: filepath.Join(t.TempDir(), "gone")})

	if _, err := service.Scan(t.Context()); err == nil {
		t.Error("Scan() = nil, want an error")
	}
}
