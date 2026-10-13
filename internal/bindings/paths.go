package bindings

import (
	"os"
	"runtime"
	"strings"
)

// homeDir is the home directory of the user, empty when the system has none.
func homeDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return home
}

// homeTilde is path with the home directory of the user written as ~, the way
// the interface shows a path.
func homeTilde(path string) string {
	home := homeDir()
	if home == "" {
		return path
	}
	switch {
	case samePath(path, home):
		return "~"
	case len(path) > len(home) && samePath(path[:len(home)], home) && path[len(home)] == os.PathSeparator:
		return "~" + path[len(home):]
	default:
		return path
	}
}

// samePath says whether two clean paths name the same folder: as they are on
// Linux, and regardless of case on Windows, whose file system ignores it.
func samePath(a, b string) bool {
	if runtime.GOOS == "windows" {
		return strings.EqualFold(a, b)
	}
	return a == b
}
