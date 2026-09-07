// Package editor opens a folder in the user's editor. In this version the
// editor is VS Code, found as "code" on the PATH; making it configurable is a
// later task.
package editor

import (
	"errors"
	"fmt"
	"os/exec"
)

// ErrNotFound reports that code is not on the PATH.
var ErrNotFound = errors.New("editor: code was not found on the PATH")

// binary is the executable the editor is started with.
const binary = "code"

// Open opens path in the editor. VS Code opens a new window for the folder or
// focuses the one already showing it, and returns at once; Open does not wait.
func Open(path string) error {
	code, err := exec.LookPath(binary)
	if err != nil {
		return fmt.Errorf("%w: %w", ErrNotFound, err)
	}

	cmd := exec.Command(code, path)
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("open %s in the editor: %w", path, err)
	}
	// Nobody waits for the editor, and an unreaped child would linger as a
	// zombie for as long as the app runs.
	go func() { _ = cmd.Wait() }()
	return nil
}
