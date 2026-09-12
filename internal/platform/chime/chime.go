// Package chime owns the sound of the notifications of the app: the WAV
// embedded in the binary, its copy on disk that a notification server reads,
// and playing it through the audio player the desktop has.
package chime

import (
	"bytes"
	_ "embed" // for the chime embedded below
	"fmt"
	"os"
	"path/filepath"
)

//go:generate go run gen.go

// The copy of the chime inside the data directory. The notification server
// runs as the same user, so private permissions don't stop it reading the
// file.
const (
	dirName  = "sounds"
	fileName = "chime.wav"
	dirPerm  = 0o700
	filePerm = 0o600
)

// wav is the chime, as gen.go synthesizes it.
//
//go:embed chime.wav
var wav []byte

// Path is where Install puts the chime inside the data directory.
func Path(dataDir string) string {
	return filepath.Join(dataDir, dirName, fileName)
}

// Install copies the chime to the data directory, where a notification server
// that plays sounds reads it, unless the same bytes are already there. It
// returns the path of the copy.
func Install(dataDir string) (string, error) {
	path := Path(dataDir)
	// Rewriting on any difference keeps the copy in step with the binary across
	// versions, and repairs a truncated file.
	if current, err := os.ReadFile(path); err == nil && bytes.Equal(current, wav) {
		return path, nil
	}

	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, dirPerm); err != nil {
		return "", fmt.Errorf("create sounds directory %s: %w", dir, err)
	}
	if err := os.WriteFile(path, wav, filePerm); err != nil {
		return "", fmt.Errorf("install chime %s: %w", path, err)
	}
	return path, nil
}
