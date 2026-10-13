package claude

import (
	"os"
	"path/filepath"
	"strings"
)

// fallbackName is the file the native installer writes in .local\bin.
const fallbackName = "claude.exe"

// defaultPathExt is what Windows runs when PATHEXT is not set.
const defaultPathExt = ".com;.exe;.bat;.cmd"

// executable reports whether path is an existing file Windows runs: one whose
// extension is in PATHEXT.
func executable(path string) bool {
	//nolint:gosec // G703: locating a user-configured executable is the point;
	// this stat is the check that the path is usable, not a traversal.
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		return false
	}

	pathExt := os.Getenv("PATHEXT")
	if pathExt == "" {
		pathExt = defaultPathExt
	}
	ext := filepath.Ext(path)
	for _, candidate := range strings.Split(pathExt, ";") {
		candidate = strings.TrimSpace(candidate)
		if candidate != "" && strings.EqualFold(candidate, ext) {
			return true
		}
	}
	return false
}
