// Package workspace owns the current workspace, its repositories and the list
// of recently opened workspaces.
package workspace

import (
	"context"
	"errors"
	"time"
)

// MaxRecents is how many recent workspaces are kept.
const MaxRecents = 10

// Repo is a git repository inside a workspace.
type Repo struct {
	Name string
	Path string
}

// Workspace is an open folder together with the repositories found in it.
type Workspace struct {
	Name  string // filepath.Base(Path)
	Path  string // absolute and cleaned
	Repos []Repo
}

// Recent is a workspace the user opened before.
type Recent struct {
	Path         string
	Name         string
	LastOpenedAt time.Time
}

// NoticeReason says why a workspace could not be opened.
type NoticeReason string

// The reasons a workspace path is reported back to the user.
const (
	ReasonNotFound          NoticeReason = "not_found"
	ReasonNotDirectory      NoticeReason = "not_directory"
	ReasonNotReadable       NoticeReason = "not_readable"
	ReasonLastRecentMissing NoticeReason = "last_recent_missing"
)

// Notice is a path the app refused to open, shown on the welcome screen.
type Notice struct {
	Path   string
	Reason NoticeReason
}

// The ways a path fails to qualify as a workspace.
var (
	ErrNotFound     = errors.New("path does not exist")
	ErrNotDirectory = errors.New("path is not a directory")
	ErrNotReadable  = errors.New("path is not readable")
)

// RecentsRepository persists the recent workspaces.
type RecentsRepository interface {
	List(ctx context.Context) ([]Recent, error)
	Touch(ctx context.Context, rec Recent, keep int) error
	Delete(ctx context.Context, paths ...string) error
}

// Scanner returns the repository paths under root. In production it is
// scan.Repos with the logger applied; in tests, a fixed function.
type Scanner func(root string) ([]string, error)
