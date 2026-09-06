package scan_test

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/scan"
)

// logCapture is a logger writing JSON records into a buffer.
type logCapture struct {
	log *slog.Logger
	buf *bytes.Buffer
}

func newLogCapture() logCapture {
	buf := &bytes.Buffer{}
	return logCapture{log: slog.New(slog.NewJSONHandler(buf, nil)), buf: buf}
}

// count returns how many records carry the given message.
func (c logCapture) count(t *testing.T, msg string) int {
	t.Helper()

	total := 0
	for _, line := range strings.Split(strings.TrimSpace(c.buf.String()), "\n") {
		if line == "" {
			continue
		}
		var rec map[string]any
		if err := json.Unmarshal([]byte(line), &rec); err != nil {
			t.Fatalf("parse log line %q: %v", line, err)
		}
		if rec["msg"] == msg {
			total++
		}
	}
	return total
}

// repoDir creates dir under root with a .git directory in it.
func repoDir(t *testing.T, root, name string) string {
	t.Helper()

	path := filepath.Join(root, name)
	if err := os.MkdirAll(filepath.Join(path, ".git"), 0o700); err != nil {
		t.Fatalf("create repo %s: %v", name, err)
	}
	return path
}

// plainDir creates dir under root without a .git entry.
func plainDir(t *testing.T, root, name string) string {
	t.Helper()

	path := filepath.Join(root, name)
	if err := os.MkdirAll(path, 0o700); err != nil {
		t.Fatalf("create dir %s: %v", name, err)
	}
	return path
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()

	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

func symlink(t *testing.T, target, link string) {
	t.Helper()

	if err := os.Symlink(target, link); err != nil {
		t.Fatalf("symlink %s: %v", link, err)
	}
}

// repos runs Repos and fails the test on error.
func repos(t *testing.T, root string, log *slog.Logger) []string {
	t.Helper()

	got, err := scan.Repos(root, log)
	if err != nil {
		t.Fatalf("Repos(%s) = %v, want nil", root, err)
	}
	return got
}

func TestReposFindsAFolderWithAGitDirectory(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	want := repoDir(t, root, "api")

	if diff := cmp.Diff([]string{want}, repos(t, root, newLogCapture().log)); diff != "" {
		t.Errorf("Repos() mismatch (-want +got):\n%s", diff)
	}
}

func TestReposFindsAFolderWhoseGitIsAFile(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	worktree := plainDir(t, root, "worktree")
	writeFile(t, filepath.Join(worktree, ".git"), "gitdir: /elsewhere/.git/worktrees/wt")

	if diff := cmp.Diff([]string{worktree}, repos(t, root, newLogCapture().log)); diff != "" {
		t.Errorf("Repos() mismatch (-want +got):\n%s", diff)
	}
}

func TestReposSkipsHiddenFolders(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	repoDir(t, root, ".hidden")

	if got := repos(t, root, newLogCapture().log); len(got) != 0 {
		t.Errorf("Repos() = %v, want empty", got)
	}
}

func TestReposSkipsSymlinkedFolders(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	target := repoDir(t, t.TempDir(), "api")
	symlink(t, target, filepath.Join(root, "linked"))

	if got := repos(t, root, newLogCapture().log); len(got) != 0 {
		t.Errorf("Repos() = %v, want empty", got)
	}
}

func TestReposSkipsFoldersWhoseGitIsASymlink(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	target := repoDir(t, t.TempDir(), "elsewhere")
	linked := plainDir(t, root, "linked-git")
	symlink(t, filepath.Join(target, ".git"), filepath.Join(linked, ".git"))

	if got := repos(t, root, newLogCapture().log); len(got) != 0 {
		t.Errorf("Repos() = %v, want empty", got)
	}
}

func TestReposSkipsLooseFiles(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "README.md"), "# notes")

	if got := repos(t, root, newLogCapture().log); len(got) != 0 {
		t.Errorf("Repos() = %v, want empty", got)
	}
}

func TestReposSkipsFoldersWithoutGit(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	plainDir(t, root, "notes")

	if got := repos(t, root, newLogCapture().log); len(got) != 0 {
		t.Errorf("Repos() = %v, want empty", got)
	}
}

func TestReposIgnoresRepositoriesBelowTheFirstLevel(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	nested := plainDir(t, root, "group")
	repoDir(t, nested, "api")

	if got := repos(t, root, newLogCapture().log); len(got) != 0 {
		t.Errorf("Repos() = %v, want empty", got)
	}
}

func TestReposIncludesTheRootWhenItIsARepository(t *testing.T) {
	t.Parallel()
	root := repoDir(t, t.TempDir(), "work")
	api := repoDir(t, root, "api")

	if diff := cmp.Diff([]string{api, root}, repos(t, root, newLogCapture().log)); diff != "" {
		t.Errorf("Repos() mismatch (-want +got):\n%s", diff)
	}
}

func TestReposSortsByNameIgnoringCase(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	gamma := repoDir(t, root, "Gamma")
	alpha := repoDir(t, root, "Alpha")
	beta := repoDir(t, root, "beta")

	if diff := cmp.Diff([]string{alpha, beta, gamma}, repos(t, root, newLogCapture().log)); diff != "" {
		t.Errorf("Repos() mismatch (-want +got):\n%s", diff)
	}
}

func TestReposSkipsAndLogsUnreadableFolders(t *testing.T) {
	t.Parallel()
	if os.Geteuid() == 0 {
		t.Skip("root reads directories regardless of their mode")
	}
	root := t.TempDir()
	locked := plainDir(t, root, "locked")
	if err := os.Chmod(locked, 0o000); err != nil {
		t.Fatalf("chmod %s: %v", locked, err)
	}
	t.Cleanup(func() {
		if err := os.Chmod(locked, 0o700); err != nil {
			t.Errorf("restore %s: %v", locked, err)
		}
	})
	capture := newLogCapture()

	if got := repos(t, root, capture.log); len(got) != 0 {
		t.Errorf("Repos() = %v, want empty", got)
	}
	if got := capture.count(t, "scan skipped entry"); got != 1 {
		t.Errorf("skipped entries logged = %d, want 1", got)
	}
}

func TestReposFailsOnAMissingRoot(t *testing.T) {
	t.Parallel()
	root := filepath.Join(t.TempDir(), "gone")

	if _, err := scan.Repos(root, newLogCapture().log); err == nil {
		t.Fatal("Repos() = nil, want an error")
	}
}

func TestReposReturnsNothingForAnEmptyRoot(t *testing.T) {
	t.Parallel()

	if got := repos(t, t.TempDir(), newLogCapture().log); len(got) != 0 {
		t.Errorf("Repos() = %v, want empty", got)
	}
}
