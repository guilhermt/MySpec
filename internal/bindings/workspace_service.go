package bindings

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/guilhermt/myspec/internal/workspace"
)

// callTimeout bounds the database work behind a single binding call.
const callTimeout = 5 * time.Second

// FolderPicker opens the native folder chooser. ok is false when the user
// cancels.
type FolderPicker interface {
	PickFolder(startIn string) (path string, ok bool, err error)
}

// WorkspaceService is the workspace API the frontend calls.
type WorkspaceService struct {
	ws       *workspace.Service
	snapshot func() State
	picker   FolderPicker
	log      *slog.Logger
}

// NewWorkspaceService builds the service over the workspace domain.
func NewWorkspaceService(ws *workspace.Service, snapshot func() State, picker FolderPicker, log *slog.Logger) *WorkspaceService {
	return &WorkspaceService{ws: ws, snapshot: snapshot, picker: picker, log: log}
}

// GetState returns the current snapshot. It is how the frontend gets its first
// state; every later one arrives with EventStateChanged.
func (s *WorkspaceService) GetState() State {
	return s.snapshot()
}

// OpenPath opens an absolute path as the workspace. A path that no longer
// qualifies turns into a notice rather than an error, which is what the recent
// list needs when a folder is gone.
func (s *WorkspaceService) OpenPath(path string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	err := s.ws.Open(ctx, path)
	switch {
	case err == nil:
		return nil
	case isValidationError(err):
		// The path is already absolute, so the working directory is unused.
		return s.noticeFor(ctx, path)
	default:
		s.log.Error("binding failed", "method", "OpenPath", "err", err)
		return err
	}
}

// OpenFolderDialog asks the user for a folder and opens it. Cancelling changes
// nothing and is not an error.
func (s *WorkspaceService) OpenFolderDialog() error {
	path, ok, err := s.picker.PickFolder(s.dialogStart())
	if err != nil {
		s.log.Error("binding failed", "method", "OpenFolderDialog", "err", err)
		return err
	}
	if !ok {
		return nil
	}
	return s.OpenPath(path)
}

// RemoveRecent drops a path from the recent workspaces.
func (s *WorkspaceService) RemoveRecent(path string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.ws.RemoveRecent(ctx, path); err != nil {
		s.log.Error("binding failed", "method", "RemoveRecent", "err", err)
		return err
	}
	return nil
}

// DismissNotice clears the notice the interface is showing.
func (s *WorkspaceService) DismissNotice() {
	s.ws.DismissNotice()
}

// dialogStart is where the folder chooser opens: next to the current workspace,
// or the home directory when there is none.
func (s *WorkspaceService) dialogStart() string {
	if current := s.ws.Current(); current != nil {
		return filepath.Dir(current.Path)
	}
	return os.Getenv("HOME")
}

// noticeFor records the failed path as a notice, leaving the open workspace as
// it was.
func (s *WorkspaceService) noticeFor(ctx context.Context, path string) error {
	if err := s.ws.OpenArg(ctx, path, "/"); err != nil {
		s.log.Error("binding failed", "method", "OpenPath", "err", err)
		return err
	}
	return nil
}

// isValidationError reports whether err is a path the user can be told about.
func isValidationError(err error) bool {
	return errors.Is(err, workspace.ErrNotFound) ||
		errors.Is(err, workspace.ErrNotDirectory) ||
		errors.Is(err, workspace.ErrNotReadable)
}
