package workspace

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
)

// ResolvePath makes raw absolute against cwd and cleans it. It does not follow
// symlinks.
func ResolvePath(raw, cwd string) string {
	if filepath.IsAbs(raw) {
		return filepath.Clean(raw)
	}
	return filepath.Join(cwd, raw)
}

// Validate reports whether path qualifies as a workspace, returning ErrNotFound,
// ErrNotDirectory or ErrNotReadable when it does not.
func Validate(path string) error {
	info, err := os.Stat(path)
	switch {
	case errors.Is(err, fs.ErrNotExist):
		return ErrNotFound
	case err != nil:
		return ErrNotReadable
	case !info.IsDir():
		return ErrNotDirectory
	}

	dir, err := os.Open(path)
	if err != nil {
		return ErrNotReadable
	}
	defer func() { _ = dir.Close() }()

	if _, err := dir.Readdirnames(1); err != nil && !errors.Is(err, io.EOF) {
		return ErrNotReadable
	}
	return nil
}

// ReasonFor maps a validation error to the reason shown to the user. It panics
// on any other error.
func ReasonFor(err error) NoticeReason {
	reason, ok := reasonFor(err)
	if !ok {
		panic(fmt.Sprintf("workspace: no notice reason for %v", err))
	}
	return reason
}

// reasonFor is ReasonFor without the panic, so callers can tell a validation
// error apart from any other failure.
func reasonFor(err error) (NoticeReason, bool) {
	switch {
	case errors.Is(err, ErrNotFound):
		return ReasonNotFound, true
	case errors.Is(err, ErrNotDirectory):
		return ReasonNotDirectory, true
	case errors.Is(err, ErrNotReadable):
		return ReasonNotReadable, true
	}
	return "", false
}
