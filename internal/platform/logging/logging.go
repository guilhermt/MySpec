// Package logging builds the app logger over a JSON log file.
package logging

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"os"
)

// MaxSize is the size above which the log file is truncated when it is opened.
const MaxSize = 5 << 20 // 5 MiB

// filePerm keeps the log file private to the user.
const filePerm = 0o600

// Options configures New.
type Options struct {
	Path   string     // JSON log file; required
	Level  slog.Level // defaults to Info
	Stderr bool       // also write readable text to stderr (dev mode)
}

// New opens the log file in append mode, truncating it beforehand when it is
// over MaxSize. It returns the logger and a Closer for the file.
func New(opts Options) (*slog.Logger, io.Closer, error) {
	if opts.Path == "" {
		return nil, nil, errors.New("logging: path is required")
	}

	truncated, err := truncateIfLarge(opts.Path)
	if err != nil {
		return nil, nil, err
	}

	file, err := os.OpenFile(opts.Path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, filePerm)
	if err != nil {
		return nil, nil, fmt.Errorf("open log %s: %w", opts.Path, err)
	}

	handlerOpts := &slog.HandlerOptions{Level: opts.Level}
	var handler slog.Handler = slog.NewJSONHandler(file, handlerOpts)
	if opts.Stderr {
		handler = newTee(handler, slog.NewTextHandler(os.Stderr, handlerOpts))
	}

	log := slog.New(handler)
	if truncated {
		log.Warn("log truncated", "path", opts.Path)
	}
	return log, file, nil
}

// truncateIfLarge empties the file when it grew past MaxSize, reporting whether
// it did. A missing file is not an error: New creates it.
func truncateIfLarge(path string) (bool, error) {
	info, err := os.Stat(path)
	switch {
	case errors.Is(err, fs.ErrNotExist):
		return false, nil
	case err != nil:
		return false, fmt.Errorf("stat log %s: %w", path, err)
	case info.Size() <= MaxSize:
		return false, nil
	}

	if err := os.Truncate(path, 0); err != nil {
		return false, fmt.Errorf("truncate log %s: %w", path, err)
	}
	return true, nil
}
