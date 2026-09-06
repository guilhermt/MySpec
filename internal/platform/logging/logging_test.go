package logging

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// records reads the file as a stream of JSON log lines.
func records(t *testing.T, path string) []map[string]any {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read log: %v", err)
	}

	var out []map[string]any
	for _, line := range strings.Split(strings.TrimSpace(string(data)), "\n") {
		if line == "" {
			continue
		}
		var rec map[string]any
		if err := json.Unmarshal([]byte(line), &rec); err != nil {
			t.Fatalf("parse log line %q: %v", line, err)
		}
		out = append(out, rec)
	}
	return out
}

func TestNewWritesJSONRecords(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "myspec.log")

	log, closer, err := New(Options{Path: path})
	if err != nil {
		t.Fatalf("New() = %v, want nil", err)
	}
	log.Info("app starting", "version", "0.1.0")
	if err := closer.Close(); err != nil {
		t.Fatalf("Close() = %v, want nil", err)
	}

	got := records(t, path)
	if len(got) != 1 {
		t.Fatalf("got %d records, want 1", len(got))
	}
	if got[0]["msg"] != "app starting" {
		t.Errorf("msg = %v, want %q", got[0]["msg"], "app starting")
	}
	if got[0]["version"] != "0.1.0" {
		t.Errorf("version = %v, want %q", got[0]["version"], "0.1.0")
	}
}

func TestNewDefaultsToInfoLevel(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "myspec.log")

	log, closer, err := New(Options{Path: path})
	if err != nil {
		t.Fatalf("New() = %v, want nil", err)
	}
	log.Debug("debug dropped")
	log.Info("info kept")
	if err := closer.Close(); err != nil {
		t.Fatalf("Close() = %v, want nil", err)
	}

	got := records(t, path)
	if len(got) != 1 || got[0]["msg"] != "info kept" {
		t.Fatalf("got %v, want only the info record", got)
	}
}

func TestNewHonoursLevel(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "myspec.log")

	log, closer, err := New(Options{Path: path, Level: slog.LevelWarn})
	if err != nil {
		t.Fatalf("New() = %v, want nil", err)
	}
	log.Info("info dropped")
	log.Warn("warn kept")
	if err := closer.Close(); err != nil {
		t.Fatalf("Close() = %v, want nil", err)
	}

	got := records(t, path)
	if len(got) != 1 || got[0]["msg"] != "warn kept" {
		t.Fatalf("got %v, want only the warn record", got)
	}
}

func TestNewAppendsToExistingFile(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "myspec.log")

	first, firstCloser, err := New(Options{Path: path})
	if err != nil {
		t.Fatalf("New() = %v, want nil", err)
	}
	first.Info("first run")
	if err = firstCloser.Close(); err != nil {
		t.Fatalf("Close() = %v, want nil", err)
	}

	second, secondCloser, err := New(Options{Path: path})
	if err != nil {
		t.Fatalf("New() = %v, want nil", err)
	}
	second.Info("second run")
	if err := secondCloser.Close(); err != nil {
		t.Fatalf("Close() = %v, want nil", err)
	}

	got := records(t, path)
	if len(got) != 2 {
		t.Fatalf("got %d records, want 2", len(got))
	}
	if got[0]["msg"] != "first run" || got[1]["msg"] != "second run" {
		t.Errorf("got %v, want both runs in order", got)
	}
}

func TestNewTruncatesOversizedFile(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "myspec.log")

	if err := os.WriteFile(path, []byte("stale\n"), 0o600); err != nil {
		t.Fatalf("write log: %v", err)
	}
	if err := os.Truncate(path, MaxSize+1); err != nil {
		t.Fatalf("grow log: %v", err)
	}

	log, closer, err := New(Options{Path: path})
	if err != nil {
		t.Fatalf("New() = %v, want nil", err)
	}
	log.Info("app starting")
	if err := closer.Close(); err != nil {
		t.Fatalf("Close() = %v, want nil", err)
	}

	got := records(t, path)
	if len(got) != 2 {
		t.Fatalf("got %d records, want 2", len(got))
	}
	if got[0]["msg"] != "log truncated" {
		t.Errorf("first record = %v, want the truncation warning", got[0])
	}
	if got[0]["path"] != path {
		t.Errorf("path = %v, want %q", got[0]["path"], path)
	}
}

func TestNewKeepsFileUnderMaxSize(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "myspec.log")

	if err := os.WriteFile(path, []byte(`{"msg":"stale"}`+"\n"), 0o600); err != nil {
		t.Fatalf("write log: %v", err)
	}

	log, closer, err := New(Options{Path: path})
	if err != nil {
		t.Fatalf("New() = %v, want nil", err)
	}
	log.Info("app starting")
	if err := closer.Close(); err != nil {
		t.Fatalf("Close() = %v, want nil", err)
	}

	got := records(t, path)
	if len(got) != 2 || got[0]["msg"] != "stale" {
		t.Fatalf("got %v, want the stale record kept", got)
	}
}

func TestNewRejectsEmptyPath(t *testing.T) {
	t.Parallel()

	if _, _, err := New(Options{}); err == nil {
		t.Fatal("New() = nil, want error")
	}
}

func TestNewFailsOnUnusablePath(t *testing.T) {
	t.Parallel()
	blocked := filepath.Join(t.TempDir(), "file")
	if err := os.WriteFile(blocked, nil, 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}

	// The parent of the log path is a regular file, so both stat and open fail.
	if _, _, err := New(Options{Path: filepath.Join(blocked, "myspec.log")}); err == nil {
		t.Fatal("New() = nil, want error")
	}
}

func TestNewWithStderrWritesToTheFile(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "myspec.log")

	log, closer, err := New(Options{Path: path, Stderr: true})
	if err != nil {
		t.Fatalf("New() = %v, want nil", err)
	}
	if _, ok := log.Handler().(*teeHandler); !ok {
		t.Fatalf("handler = %T, want *teeHandler", log.Handler())
	}
	log.Info("app starting")
	if err := closer.Close(); err != nil {
		t.Fatalf("Close() = %v, want nil", err)
	}

	if got := records(t, path); len(got) != 1 || got[0]["msg"] != "app starting" {
		t.Fatalf("got %v, want the record in the file", got)
	}
}

// teeBuffers builds a tee over two text handlers and returns their outputs.
func teeBuffers(t *testing.T, level slog.Level) (*slog.Logger, *bytes.Buffer, *bytes.Buffer) {
	t.Helper()
	var primary, secondary bytes.Buffer
	opts := &slog.HandlerOptions{
		Level: level,
		ReplaceAttr: func(_ []string, a slog.Attr) slog.Attr {
			if a.Key == slog.TimeKey {
				return slog.Attr{}
			}
			return a
		},
	}
	handler := newTee(slog.NewTextHandler(&primary, opts), slog.NewTextHandler(&secondary, opts))
	return slog.New(handler), &primary, &secondary
}

func TestTeeWritesToBothHandlers(t *testing.T) {
	t.Parallel()
	log, primary, secondary := teeBuffers(t, slog.LevelInfo)

	log.Info("app starting", "version", "0.1.0")

	want := "level=INFO msg=\"app starting\" version=0.1.0\n"
	if got := primary.String(); got != want {
		t.Errorf("primary = %q, want %q", got, want)
	}
	if got := secondary.String(); got != want {
		t.Errorf("secondary = %q, want %q", got, want)
	}
}

func TestTeeWithAttrsAndGroup(t *testing.T) {
	t.Parallel()
	log, primary, secondary := teeBuffers(t, slog.LevelInfo)

	log.With("run", "1").WithGroup("scan").Info("workspace opened", "repos", 3)

	want := "level=INFO msg=\"workspace opened\" run=1 scan.repos=3\n"
	if got := primary.String(); got != want {
		t.Errorf("primary = %q, want %q", got, want)
	}
	if got := secondary.String(); got != want {
		t.Errorf("secondary = %q, want %q", got, want)
	}
}

func TestTeeEnabledFollowsEitherHandler(t *testing.T) {
	t.Parallel()
	var quiet bytes.Buffer
	var verbose bytes.Buffer
	loud := newTee(
		slog.NewTextHandler(&quiet, &slog.HandlerOptions{Level: slog.LevelError}),
		slog.NewTextHandler(&verbose, &slog.HandlerOptions{Level: slog.LevelDebug}),
	)

	if !loud.Enabled(context.Background(), slog.LevelInfo) {
		t.Error("Enabled(Info) = false, want true")
	}

	slog.New(loud).Info("app starting")
	if quiet.Len() != 0 {
		t.Errorf("quiet handler wrote %q, want nothing", quiet.String())
	}
	if verbose.Len() == 0 {
		t.Error("verbose handler wrote nothing, want the record")
	}
}
