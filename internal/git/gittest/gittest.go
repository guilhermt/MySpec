// Package gittest builds the repositories the tests of the git-driven
// packages run against, with the real git binary.
package gittest

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// Env is the environment the tests run git in: the parent's without any GIT_*
// variable, an empty global config, no system config and a fixed identity, so
// that nothing of the machine (hooks, signing, aliases) reaches a test.
func Env(t *testing.T) []string {
	t.Helper()

	var env []string
	for _, entry := range os.Environ() {
		if !strings.HasPrefix(entry, "GIT_") {
			env = append(env, entry)
		}
	}

	global := filepath.Join(t.TempDir(), "gitconfig")
	if err := os.WriteFile(global, nil, 0o600); err != nil {
		t.Fatalf("WriteFile(%s) = %v, want nil", global, err)
	}

	return append(env,
		"GIT_CONFIG_GLOBAL="+global,
		"GIT_CONFIG_SYSTEM=/dev/null",
		"GIT_AUTHOR_NAME=MySpec Tests",
		"GIT_AUTHOR_EMAIL=tests@myspec.invalid",
		"GIT_COMMITTER_NAME=MySpec Tests",
		"GIT_COMMITTER_EMAIL=tests@myspec.invalid",
		"GIT_TERMINAL_PROMPT=0",
	)
}

// Run runs git in dir with Env and returns its trimmed stdout, failing the
// test when the command fails.
func Run(t *testing.T, dir string, args ...string) string {
	t.Helper()

	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	cmd.Env = Env(t)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %s in %s = %v, want nil: %s", strings.Join(args, " "), dir, err, out)
	}
	return strings.TrimSpace(string(out))
}

// Origin creates a bare repository under t.TempDir with one commit on main
// and returns its path. With dev, it also has a dev branch at that commit.
func Origin(t *testing.T, dev bool) string {
	t.Helper()

	dir := t.TempDir()
	origin := filepath.Join(dir, "origin.git")
	Run(t, dir, "init", "--bare", "--initial-branch=main", origin)

	// A plain clone of an empty repository has no branch yet, and the empty
	// global config leaves init.defaultBranch to git's own default, so the
	// first commit is put on main by hand.
	seed := filepath.Join(dir, "seed")
	Run(t, dir, "clone", origin, seed)
	Run(t, seed, "symbolic-ref", "HEAD", "refs/heads/main")
	Commit(t, seed, "README.md", "# seed\n", "Initial commit")
	Run(t, seed, "push", "origin", "main")
	if dev {
		Run(t, seed, "branch", "dev")
		Run(t, seed, "push", "origin", "dev")
	}
	return origin
}

// Clone clones origin into path, whose parent must exist, on main, and returns
// path.
func Clone(t *testing.T, origin, path string) string {
	t.Helper()

	Run(t, filepath.Dir(path), "clone", "--branch", "main", origin, path)
	return path
}

// Commit writes a file in dir and commits it on the current branch.
func Commit(t *testing.T, dir, file, content, message string) {
	t.Helper()

	full := filepath.Join(dir, file)
	if err := os.MkdirAll(filepath.Dir(full), 0o750); err != nil {
		t.Fatalf("MkdirAll(%s) = %v, want nil", filepath.Dir(full), err)
	}
	if err := os.WriteFile(full, []byte(content), 0o600); err != nil {
		t.Fatalf("WriteFile(%s) = %v, want nil", full, err)
	}
	Run(t, dir, "add", "--", file)
	Run(t, dir, "commit", "-m", message)
}
