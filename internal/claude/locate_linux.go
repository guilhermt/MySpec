package claude

import "os"

// fallbackName is the file the native installer writes in ~/.local/bin.
const fallbackName = "claude"

// executable reports whether path is an existing file with an execute bit.
func executable(path string) bool {
	//nolint:gosec // G703: locating a user-configured executable is the point;
	// this stat is the check that the path is usable, not a traversal.
	info, err := os.Stat(path)
	return err == nil && !info.IsDir() && info.Mode()&0o111 != 0
}
