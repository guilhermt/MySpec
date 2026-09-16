// Package repository owns the repositories the user registered: their identity
// on GitHub, the clone each one is tied to and whether that clone is still
// there. It also finds the clones under the home folder. What a repository
// holds, its tasks, belongs to internal/task.
package repository

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Repository is a GitHub repository the user registered, tied to a local clone
// once it has one.
type Repository struct {
	ID        string
	Owner     string
	Name      string
	Path      string // the root of the clone, absolute and cleaned; "" while the repository has no clone
	BoardID   string // the board that manages it; "" for none
	CreatedAt time.Time
}

// Cloned reports whether the repository is tied to a clone. A clone that is
// no longer there is still a clone: Missing says that.
func (r Repository) Cloned() bool { return r.Path != "" }

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

// The ways an action on a repository fails that the app tells apart.
var (
	ErrNotFound      = errors.New("repository: not found")       // a repository id nobody registered
	ErrCloned        = errors.New("repository: already cloned")  // a clone asked of a repository that has one
	ErrNoCloneFolder = errors.New("repository: no clone folder") // a clone asked before the user chose where clones go
)

// IsClone reports whether path is the root of a git repository: a directory
// with a .git directory in it. A worktree or a submodule, whose .git is a file,
// is not one.
func IsClone(path string) bool {
	info, err := os.Stat(filepath.Join(path, ".git"))
	return err == nil && info.IsDir()
}
