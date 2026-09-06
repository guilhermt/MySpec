package store_test

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"os"
	"strings"
	"testing"

	"github.com/guilhermt/myspec/internal/store"
)

// logCapture is a logger writing JSON records into a buffer.
type logCapture struct {
	log *slog.Logger
	buf *bytes.Buffer
}

func newLogCapture() logCapture {
	buf := &bytes.Buffer{}
	return logCapture{log: slog.New(slog.NewJSONHandler(buf, nil)), buf: buf}
}

// count returns how many records carry the given message.
func (c logCapture) count(t *testing.T, msg string) int {
	t.Helper()

	total := 0
	for _, line := range strings.Split(strings.TrimSpace(c.buf.String()), "\n") {
		if line == "" {
			continue
		}
		var rec map[string]any
		if err := json.Unmarshal([]byte(line), &rec); err != nil {
			t.Fatalf("parse log line %q: %v", line, err)
		}
		if rec["msg"] == msg {
			total++
		}
	}
	return total
}

// newStore opens an in-memory store closed at the end of the test.
func newStore(t *testing.T) *store.Store {
	t.Helper()

	s, err := store.OpenMemory(t.Context(), newLogCapture().log)
	if err != nil {
		t.Fatalf("OpenMemory() = %v, want nil", err)
	}
	t.Cleanup(func() {
		if err := s.Close(); err != nil {
			t.Errorf("Close() = %v, want nil", err)
		}
	})
	return s
}

// writeEmptyFile creates an empty file, used to block a directory path.
func writeEmptyFile(t *testing.T, path string) error {
	t.Helper()
	return os.WriteFile(path, nil, 0o600)
}
