package toast

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
)

// The copy of the icon of the app inside the data directory, which the
// notification platform reads.
const (
	iconDir  = "icons"
	iconFile = "myspec.png"
	dirPerm  = 0o700
	filePerm = 0o600
)

// IconPath is where InstallIcon puts the icon inside the data directory.
func IconPath(dataDir string) string {
	return filepath.Join(dataDir, iconDir, iconFile)
}

// InstallIcon copies the icon to the data directory unless the same bytes are
// already there, and returns the path of the copy.
func InstallIcon(dataDir string, png []byte) (string, error) {
	path := IconPath(dataDir)
	if current, err := os.ReadFile(path); err == nil && bytes.Equal(current, png) {
		return path, nil
	}

	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, dirPerm); err != nil {
		return "", fmt.Errorf("create icons directory %s: %w", dir, err)
	}
	if err := os.WriteFile(path, png, filePerm); err != nil {
		return "", fmt.Errorf("install icon %s: %w", path, err)
	}
	return path, nil
}
