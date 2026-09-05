// Package scan finds the git repositories of a workspace folder.
package scan

import (
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// Repos returns the absolute paths of the repositories that are direct children
// of root, plus root itself when it is a repository. They are sorted by folder
// name ignoring case, ties broken by byte order. The only error it returns is
// root itself being unreadable.
func Repos(root string, log *slog.Logger) ([]string, error) {
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil, fmt.Errorf("scan %s: %w", root, err)
	}

	repos := make([]string, 0, len(entries)+1)
	if isRepo(root, log) {
		repos = append(repos, root)
	}
	for _, entry := range entries {
		name := entry.Name()
		if strings.HasPrefix(name, ".") || entry.Type()&fs.ModeSymlink != 0 || !entry.IsDir() {
			continue
		}
		path := filepath.Join(root, name)
		if isRepo(path, log) {
			repos = append(repos, path)
		}
	}

	sort.SliceStable(repos, func(i, j int) bool {
		a, b := filepath.Base(repos[i]), filepath.Base(repos[j])
		if lowerA, lowerB := strings.ToLower(a), strings.ToLower(b); lowerA != lowerB {
			return lowerA < lowerB
		}
		return a < b
	})
	return repos, nil
}

// isRepo reports whether dir holds a .git entry that is not a symlink. A .git
// entry that cannot be stat'ed is logged and treated as absent.
func isRepo(dir string, log *slog.Logger) bool {
	gitPath := filepath.Join(dir, ".git")

	info, err := os.Lstat(gitPath)
	switch {
	case errors.Is(err, fs.ErrNotExist):
		return false
	case err != nil:
		log.Warn("scan skipped entry", "path", gitPath, "reason", "unreadable", "err", err)
		return false
	}
	return info.Mode()&fs.ModeSymlink == 0
}
