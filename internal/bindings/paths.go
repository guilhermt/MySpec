package bindings

import (
	"os"
	"strings"
)

// homeTilde is path with the home directory of the user written as ~, the way
// the interface shows a path.
func homeTilde(path string) string {
	home, err := os.UserHomeDir()
	if err != nil || home == "" {
		return path
	}
	switch {
	case path == home:
		return "~"
	case strings.HasPrefix(path, home+string(os.PathSeparator)):
		return "~" + strings.TrimPrefix(path, home)
	default:
		return path
	}
}
