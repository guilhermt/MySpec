package claude

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// EnvPath is the environment variable that overrides where the CLI is found.
const EnvPath = "MYSPEC_CLAUDE_PATH"

// ErrNotFound reports that no claude executable could be located.
var ErrNotFound = errors.New("claude: executable not found")

// Locate returns the path of the claude executable. Order: EnvPath, PATH,
// ~/.local/bin/claude. It returns ErrNotFound when none exists.
func Locate() (string, error) {
	// An override that does not point at an executable is a mistake worth
	// reporting, not a reason to silently fall back to another candidate.
	if override := os.Getenv(EnvPath); override != "" {
		if executable(override) {
			return override, nil
		}
		return "", fmt.Errorf("locate claude at %s=%s: %w", EnvPath, override, ErrNotFound)
	}

	if path, err := exec.LookPath("claude"); err == nil && executable(path) {
		return path, nil
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("locate claude in the home directory: %w", err)
	}
	if fallback := filepath.Join(home, ".local", "bin", "claude"); executable(fallback) {
		return fallback, nil
	}

	return "", ErrNotFound
}

// executable reports whether path is an existing file with an execute bit.
func executable(path string) bool {
	//nolint:gosec // G703: locating a user-configured executable is the point;
	// this stat is the check that the path is usable, not a traversal.
	info, err := os.Stat(path)
	return err == nil && !info.IsDir() && info.Mode()&0o111 != 0
}
