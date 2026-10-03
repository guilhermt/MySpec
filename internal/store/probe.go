package store

import (
	"errors"
	"fmt"
	"io"
	"os"
)

// Probe checks that dir can be read and written, the way the database will: it
// lists a name, then creates, writes and removes a file. The errors keep the
// errno of the system, which the database does not report for a folder it can't
// open, so PermissionDenied and DiskFull classify them.
func Probe(dir string) error {
	d, err := os.Open(dir)
	if err != nil {
		return fmt.Errorf("probe: %w", err)
	}
	_, err = d.Readdirnames(1)
	_ = d.Close()
	if err != nil && !errors.Is(err, io.EOF) {
		return fmt.Errorf("probe: %w", err)
	}

	f, err := os.CreateTemp(dir, ".probe-*")
	if err != nil {
		return fmt.Errorf("probe: %w", err)
	}
	name := f.Name()
	defer func() { _ = os.Remove(name) }()

	if _, err = f.Write([]byte{0}); err != nil {
		_ = f.Close()
		return fmt.Errorf("probe: %w", err)
	}
	if err = f.Close(); err != nil {
		return fmt.Errorf("probe: %w", err)
	}
	return nil
}
