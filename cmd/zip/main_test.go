package main

import (
	"archive/zip"
	"bytes"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
)

func writeFiles(t *testing.T, files map[string]string) string {
	t.Helper()
	dir := t.TempDir()
	for name, content := range files {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	return dir
}

func TestTheSameFilesPackIntoTheSameBytes(t *testing.T) {
	t.Parallel()
	dir := writeFiles(t, map[string]string{"a.ico": "icon", "b.exe": "program"})
	out := t.TempDir()
	first, second := filepath.Join(out, "first.zip"), filepath.Join(out, "second.zip")
	args := func(o string) []string {
		return []string{"-o", o, "-C", dir, "-mtime", "1700000000", "b.exe", "a.ico"}
	}

	var stderr bytes.Buffer
	if code := run(args(first), &stderr); code != 0 {
		t.Fatalf("first run = %d: %s", code, stderr.String())
	}
	later := time.Now().Add(time.Hour)
	for _, name := range []string{"a.ico", "b.exe"} {
		if err := os.Chtimes(filepath.Join(dir, name), later, later); err != nil {
			t.Fatal(err)
		}
	}
	if code := run(args(second), &stderr); code != 0 {
		t.Fatalf("second run = %d: %s", code, stderr.String())
	}

	a, err := os.ReadFile(first)
	if err != nil {
		t.Fatal(err)
	}
	b, err := os.ReadFile(second)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(a, b) {
		t.Error("the two archives differ")
	}
}

func TestTheArchiveHoldsTheFilesAtTheRootInTheOrderGivenWithTheDate(t *testing.T) {
	t.Parallel()
	contents := map[string]string{"a.ico": "icon", "b.exe": "program"}
	dir := writeFiles(t, contents)
	archive := filepath.Join(t.TempDir(), "out.zip")
	const mtime = 1700000000

	var stderr bytes.Buffer
	args := []string{"-o", archive, "-C", dir, "-mtime", strconv.Itoa(mtime), "b.exe", "a.ico"}
	if code := run(args, &stderr); code != 0 {
		t.Fatalf("run = %d: %s", code, stderr.String())
	}

	r, err := zip.OpenReader(archive)
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()

	names := make([]string, 0, len(r.File))
	for _, f := range r.File {
		names = append(names, f.Name)
		if want := time.Unix(mtime, 0); !f.Modified.Equal(want) {
			t.Errorf("%s modified = %v, want %v", f.Name, f.Modified, want)
		}
		rc, err := f.Open()
		if err != nil {
			t.Fatal(err)
		}
		var body bytes.Buffer
		if _, err := body.ReadFrom(rc); err != nil {
			t.Fatal(err)
		}
		if err := rc.Close(); err != nil {
			t.Fatal(err)
		}
		if body.String() != contents[f.Name] {
			t.Errorf("%s content = %q, want %q", f.Name, body.String(), contents[f.Name])
		}
	}
	if diff := cmp.Diff([]string{"b.exe", "a.ico"}, names); diff != "" {
		t.Errorf("entries mismatch (-want +got):\n%s", diff)
	}
}

func TestAMissingFileFailsTheRun(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	archive := filepath.Join(t.TempDir(), "out.zip")

	var stderr bytes.Buffer
	code := run([]string{"-o", archive, "-C", dir, "-mtime", "1", "missing.exe"}, &stderr)
	if code != 1 {
		t.Errorf("run = %d, want 1", code)
	}
	if !strings.Contains(stderr.String(), "missing.exe") {
		t.Errorf("stderr = %q, want the file name", stderr.String())
	}
}

func TestAnIncompleteCommandLineIsRefusedWithTheUsage(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name string
		args []string
	}{
		{"no files", []string{"-o", "out.zip", "-mtime", "1"}},
		{"no output", []string{"-mtime", "1", "a.ico"}},
		{"no mtime", []string{"-o", "out.zip", "a.ico"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			var stderr bytes.Buffer
			if code := run(tt.args, &stderr); code != 2 {
				t.Errorf("run = %d, want 2", code)
			}
			if !strings.Contains(stderr.String(), "usage:") {
				t.Errorf("stderr = %q, want the usage", stderr.String())
			}
		})
	}
}
