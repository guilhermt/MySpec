// Package xdg resolves the app directories: inside the XDG base directories on
// Linux, and in the local app data folder on Windows.
package xdg

import (
	"fmt"
	"os"
	"path/filepath"
)

// dirPerm keeps the app directories private to the user. Windows ignores it; the
// folder of the user is already private to them.
const dirPerm = 0o700

// Dirs holds the app directories.
type Dirs struct {
	Data  string // ~/.local/share/myspec on Linux, %LOCALAPPDATA%\MySpec\data on Windows
	State string // ~/.local/state/myspec on Linux, %LOCALAPPDATA%\MySpec\state on Windows
}

// Ensure creates the directories, private to the user.
func (d Dirs) Ensure() error {
	for _, dir := range []string{d.Data, d.State} {
		if err := os.MkdirAll(dir, dirPerm); err != nil {
			return fmt.Errorf("create %s: %w", dir, err)
		}
	}
	return nil
}

// DatabasePath is where the app database lives.
func (d Dirs) DatabasePath() string { return filepath.Join(d.Data, "myspec.db") }

// LogPath is where the app log file lives.
func (d Dirs) LogPath() string { return filepath.Join(d.State, "myspec.log") }
