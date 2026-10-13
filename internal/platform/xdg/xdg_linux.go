package xdg

import (
	"path/filepath"

	"github.com/adrg/xdg"
)

// appDir is the directory name the app owns inside each XDG base directory.
const appDir = "myspec"

// Resolve returns the app directories for the current environment.
func Resolve() Dirs {
	return Dirs{
		Data:  filepath.Join(xdg.DataHome, appDir),
		State: filepath.Join(xdg.StateHome, appDir),
	}
}
