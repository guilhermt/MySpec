package claude_test

import (
	"os"
	"path/filepath"
	"testing"
)

// writeExecutable creates an executable file named claude under dir.
func writeExecutable(t *testing.T, dir string) string {
	t.Helper()

	path := filepath.Join(dir, "claude")
	if err := os.WriteFile(path, []byte("#!/bin/sh\n"), 0o700); err != nil {
		t.Fatalf("WriteFile(%s) = %v, want nil", path, err)
	}
	return path
}
