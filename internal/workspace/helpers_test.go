package workspace_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/workspace"
)

// base is the fixed instant the tests build their timestamps from.
var base = time.Date(2026, time.September, 5, 12, 0, 0, 0, time.UTC)

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

// recentsMemRepo is an in-memory workspace.RecentsRepository.
type recentsMemRepo struct {
	mu      sync.Mutex
	items   []workspace.Recent
	listErr error
}

func (r *recentsMemRepo) List(context.Context) ([]workspace.Recent, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.listErr != nil {
		return nil, r.listErr
	}
	return r.sorted(), nil
}

func (r *recentsMemRepo) Touch(_ context.Context, rec workspace.Recent, keep int) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	replaced := false
	for i, item := range r.items {
		if item.Path == rec.Path {
			r.items[i] = rec
			replaced = true
			break
		}
	}
	if !replaced {
		r.items = append(r.items, rec)
	}

	r.items = r.sorted()
	if len(r.items) > keep {
		r.items = r.items[:keep]
	}
	return nil
}

func (r *recentsMemRepo) Delete(_ context.Context, paths ...string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	kept := make([]workspace.Recent, 0, len(r.items))
	for _, item := range r.items {
		if !slices.Contains(paths, item.Path) {
			kept = append(kept, item)
		}
	}
	r.items = kept
	return nil
}

// sorted returns the entries newest first, ties broken by path. The caller holds
// the mutex.
func (r *recentsMemRepo) sorted() []workspace.Recent {
	out := append([]workspace.Recent(nil), r.items...)
	sort.SliceStable(out, func(i, j int) bool {
		if !out[i].LastOpenedAt.Equal(out[j].LastOpenedAt) {
			return out[i].LastOpenedAt.After(out[j].LastOpenedAt)
		}
		return out[i].Path < out[j].Path
	})
	return out
}

// fixture is a Service with its collaborators, ready to assert on.
type fixture struct {
	service *workspace.Service
	repo    *recentsMemRepo
	logs    logCapture
	changes *int
	scanned *[]string
}

// scanStub is what the Scanner of a fixture answers with.
type scanStub struct {
	repos []string
	err   error
}

func newFixture(t *testing.T, stub scanStub) fixture {
	t.Helper()

	repo := &recentsMemRepo{}
	logs := newLogCapture()
	changes := 0
	scanned := []string{}

	service := workspace.New(workspace.Deps{
		Recents: repo,
		Scan: func(root string) ([]string, error) {
			scanned = append(scanned, root)
			if stub.err != nil {
				return nil, stub.err
			}
			return stub.repos, nil
		},
		Log:      logs.log,
		Now:      func() time.Time { return base },
		OnChange: func() { changes++ },
	})
	return fixture{service: service, repo: repo, logs: logs, changes: &changes, scanned: &scanned}
}

// recents lists the recents of the fixture, failing the test on error.
func (f fixture) recents(t *testing.T) []workspace.Recent {
	t.Helper()

	recents, err := f.service.Recents(t.Context())
	if err != nil {
		t.Fatalf("Recents() = %v, want nil", err)
	}
	return recents
}

// paths returns the paths of recents, in order.
func paths(recents []workspace.Recent) []string {
	out := make([]string, len(recents))
	for i, rec := range recents {
		out[i] = rec.Path
	}
	return out
}

// tempRepo seeds the repository with a recent pointing at an existing folder.
func tempRepo(t *testing.T, repo *recentsMemRepo, path string, offset time.Duration) {
	t.Helper()

	rec := workspace.Recent{Path: path, Name: filepath.Base(path), LastOpenedAt: base.Add(offset)}
	if err := repo.Touch(t.Context(), rec, workspace.MaxRecents); err != nil {
		t.Fatalf("Touch(%s) = %v, want nil", path, err)
	}
}

// mkdir creates a folder under parent and returns its path.
func mkdir(t *testing.T, parent, name string) string {
	t.Helper()

	path := filepath.Join(parent, name)
	if err := os.MkdirAll(path, 0o700); err != nil {
		t.Fatalf("create %s: %v", path, err)
	}
	return path
}

// wantErrIs fails the test unless err matches want.
func wantErrIs(t *testing.T, err, want error) {
	t.Helper()

	if !errors.Is(err, want) {
		t.Fatalf("error = %v, want %v", err, want)
	}
}
