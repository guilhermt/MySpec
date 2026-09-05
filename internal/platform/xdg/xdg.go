// Package xdg resolves the app directories inside the XDG base directory spec.
package xdg

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/adrg/xdg"
)

// appDir is the directory name the app owns inside each XDG base directory.
const appDir = "myspec"

// dirPerm keeps the app directories private to the user.
const dirPerm = 0o700

// Dirs holds the app directories inside the XDG base directory spec.
type Dirs struct {
	Data  string // $XDG_DATA_HOME/myspec  (~/.local/share/myspec)
	State string // $XDG_STATE_HOME/myspec (~/.local/state/myspec)
}

// Resolve returns the app directories for the current environment.
func Resolve() Dirs {
	return Dirs{
		Data:  filepath.Join(xdg.DataHome, appDir),
		State: filepath.Join(xdg.StateHome, appDir),
	}
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
