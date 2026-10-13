package xdg

import (
	"path/filepath"

	"github.com/adrg/xdg"
)

// appDir is the folder the app owns in the local app data folder; data and
// state each have a folder of their own inside it.
const appDir = "MySpec"

// Resolve returns the app directories for the current environment.
func Resolve() Dirs {
	return Dirs{
		Data:  filepath.Join(xdg.DataHome, appDir, "data"),
		State: filepath.Join(xdg.StateHome, appDir, "state"),
	}
}
