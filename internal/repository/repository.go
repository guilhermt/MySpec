// Package repository owns the repositories the user registered: their identity
// on GitHub, the clone each one is tied to and whether that clone is still
// there. What a repository holds, its tasks, belongs to internal/task.
package repository

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Repository is a GitHub repository the user registered, tied to a local clone.
type Repository struct {
	ID        string
	Owner     string
	Name      string
	Path      string // the root of the clone, absolute and cleaned
	CreatedAt time.Time
}

// FullName is the repository as GitHub names it: owner/name.
func (r Repository) FullName() string { return r.Owner + "/" + r.Name }

// Identity is who the repository is on GitHub.
func (r Repository) Identity() Identity { return Identity{Owner: r.Owner, Name: r.Name} }

// Identity is the repository a clone belongs to, as its origin remote says.
type Identity struct {
	Owner string
	Name  string
}

// FullName is the identity as GitHub names it: owner/name.
func (i Identity) FullName() string { return i.Owner + "/" + i.Name }

// Same reports whether two identities name the same repository. GitHub ignores
// case in both parts.
func (i Identity) Same(other Identity) bool {
	return strings.EqualFold(i.Owner, other.Owner) && strings.EqualFold(i.Name, other.Name)
}

// ErrNotFound is a repository id nobody registered.
var ErrNotFound = errors.New("repository: not found")

// IsClone reports whether path is the root of a git repository: a directory
// with a .git directory in it. A worktree or a submodule, whose .git is a file,
// is not one.
func IsClone(path string) bool {
	info, err := os.Stat(filepath.Join(path, ".git"))
	return err == nil && info.IsDir()
}
