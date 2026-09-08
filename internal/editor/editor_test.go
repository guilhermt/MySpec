package editor_test

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/editor"
)

// The bounds the test puts on the fake editor, which runs as another process.
const (
	pollTimeout = 10 * time.Second
	pollStep    = 10 * time.Millisecond
)

// These tests replace the PATH of the process, so they cannot run in parallel.

func TestOpenStartsTheEditorWithoutWaitingForIt(t *testing.T) {
	dir := t.TempDir()
	record := filepath.Join(dir, "args")
	fakeCode(t, dir, record)

	if err := editor.Open("/home/dev/code/api"); err != nil {
		t.Fatalf("Open() = %v, want nil", err)
	}
	// The script sleeps before it writes, so a call that waited for the editor
	// would only come back with the file already there.
	if _, err := os.Stat(record); !os.IsNotExist(err) {
		t.Errorf("Stat(%s) = %v, want Open to have returned before the editor did", record, err)
	}

	if got := waitForRecord(t, record); got != "/home/dev/code/api\n" {
		t.Errorf("editor arguments = %q, want the path", got)
	}
}

func TestOpenPassesAFolderAndAFileToTheEditor(t *testing.T) {
	dir := t.TempDir()
	record := filepath.Join(dir, "args")
	fakeCode(t, dir, record)

	if err := editor.Open("/home/dev/code/api", "/home/dev/code/api/main.go"); err != nil {
		t.Fatalf("Open() = %v, want nil", err)
	}

	want := "/home/dev/code/api\n/home/dev/code/api/main.go\n"
	if got := waitForRecord(t, record); got != want {
		t.Errorf("editor arguments = %q, want %q", got, want)
	}
}

// waitForRecord polls until the fake editor has written what it was called
// with. The redirection of the script creates the file before it fills it, so
// an empty read means the write is still on its way.
func waitForRecord(t *testing.T, record string) string {
	t.Helper()

	deadline := time.Now().Add(pollTimeout)
	for {
		content, err := os.ReadFile(record)
		if err == nil && len(content) > 0 {
			return string(content)
		}
		if time.Now().After(deadline) {
			t.Fatalf("the editor never wrote %s", record)
		}
		time.Sleep(pollStep)
	}
}

func TestOpenReportsAnEditorThatIsNotInstalled(t *testing.T) {
	t.Setenv("PATH", "")

	err := editor.Open("/home/dev/code/api")
	if !errors.Is(err, editor.ErrNotFound) {
		t.Errorf("Open() = %v, want ErrNotFound", err)
	}
}

// fakeCode puts a "code" on the PATH that records the arguments it was called
// with, a moment after it started.
func fakeCode(t *testing.T, dir, record string) {
	t.Helper()

	script := "#!/bin/sh\nsleep 0.2\nprintf '%s\\n' \"$@\" > " + record + "\n"
	path := filepath.Join(dir, "code")
	if err := os.WriteFile(path, []byte(script), 0o700); err != nil {
		t.Fatalf("WriteFile(%s) = %v, want nil", path, err)
	}
	t.Setenv("PATH", dir)
}
