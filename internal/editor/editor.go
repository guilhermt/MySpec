// Package editor opens a folder or a file in the user's editor. In this
// version the
// editor is VS Code, found as "code" on the PATH; making it configurable is a
// later task.
package editor

import (
	"errors"
	"fmt"
	"os/exec"
	"strings"
)

// ErrNotFound reports that code is not on the PATH.
var ErrNotFound = errors.New("editor: code was not found on the PATH")

// binary is the executable the editor is started with.
const binary = "code"

// Open opens paths in the editor: a folder alone opens or focuses its window,
// and a folder followed by a file opens the file in that window. VS Code
// returns at once; Open does not wait.
func Open(paths ...string) error {
	code, err := exec.LookPath(binary)
	if err != nil {
		return fmt.Errorf("%w: %w", ErrNotFound, err)
	}

	cmd := exec.Command(code, paths...)
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("open %s in the editor: %w", strings.Join(paths, " "), err)
	}
	// Nobody waits for the editor, and an unreaped child would linger as a
	// zombie for as long as the app runs.
	go func() { _ = cmd.Wait() }()
	return nil
}
