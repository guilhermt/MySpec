package update_test

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/update"
)

const (
	waitTimeout = 5 * time.Second
	waitPoll    = time.Millisecond
	runTick     = time.Millisecond
)

// waitFor polls cond until it holds, failing the test after waitTimeout.
func waitFor(t *testing.T, what string, cond func() bool) {
	t.Helper()

	deadline := time.Now().Add(waitTimeout)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatalf("timed out waiting for %s", what)
		}
		time.Sleep(waitPoll)
	}
}

// ver builds the Version a test names as "1.2.3".
func ver(t *testing.T, s string) update.Version {
	t.Helper()

	v, ok := update.ParseVersion(s)
	if !ok {
		t.Fatalf("%q is not a version", s)
	}
	return v
}

// rel builds a release of the version, with notes "notes <version>".
func rel(t *testing.T, version string) update.Release {
	t.Helper()

	return update.Release{
		Version:     ver(t, version),
		PublishedAt: time.Date(2026, 10, 16, 12, 0, 0, 0, time.UTC),
		Notes:       "notes " + version,
	}
}

// fakeReleases is an in-memory update.Releases.
type fakeReleases struct {
	mu       sync.Mutex
	releases []update.Release
	err      error
	calls    int
	block    chan struct{} // makes Read wait for it to close, or for its context to end
}

func (f *fakeReleases) set(releases []update.Release, err error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.releases, f.err = releases, err
}

func (f *fakeReleases) callCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()

	return f.calls
}

func (f *fakeReleases) Read(ctx context.Context, _ update.Version) ([]update.Release, error) {
	f.mu.Lock()
	f.calls++
	releases, err, block := f.releases, f.err, f.block
	f.mu.Unlock()

	if block != nil {
		select {
		case <-block:
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	return releases, err
}

// clock is a wall clock that moves only when the test says so.
type clock struct {
	mu  sync.Mutex
	now time.Time
}

func (c *clock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.now
}

func (c *clock) Advance(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.now = c.now.Add(d)
}

// fixture is an update.Service over the doubles, with what it tells.
type fixture struct {
	*update.Service
	releases *fakeReleases
	clock    *clock
	logs     logCapture

	mu      sync.Mutex
	changes int
}

func (f *fixture) changeCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()

	return f.changes
}

func newFixture(t *testing.T, installed string) *fixture {
	t.Helper()

	f := &fixture{
		releases: &fakeReleases{},
		clock:    &clock{now: time.Date(2026, 10, 16, 12, 0, 0, 0, time.UTC)},
		logs:     newLogCapture(),
	}
	f.Service = update.New(update.Deps{
		Installed: installed,
		Releases:  f.releases,
		Log:       f.logs.log,
		OnChange: func() {
			f.mu.Lock()
			f.changes++
			f.mu.Unlock()
		},
		Now:  f.clock.Now,
		Tick: runTick,
	})
	return f
}

// logCapture is a logger writing JSON records into a buffer.
type logCapture struct {
	log *slog.Logger
	buf *syncBuffer
}

func newLogCapture() logCapture {
	buf := &syncBuffer{}
	return logCapture{log: slog.New(slog.NewJSONHandler(buf, nil)), buf: buf}
}

// records returns the records that carry the given message.
func (c logCapture) records(t *testing.T, msg string) []map[string]any {
	t.Helper()

	var found []map[string]any
	for _, line := range strings.Split(strings.TrimSpace(c.buf.String()), "\n") {
		if line == "" {
			continue
		}
		var rec map[string]any
		if err := json.Unmarshal([]byte(line), &rec); err != nil {
			t.Fatalf("parse log line %q: %v", line, err)
		}
		if rec["msg"] == msg {
			found = append(found, rec)
		}
	}
	return found
}

type syncBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *syncBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	return b.buf.Write(p)
}

func (b *syncBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()

	return b.buf.String()
}
