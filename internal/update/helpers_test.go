package update_test

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"os"
	"path/filepath"
	"slices"
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

// fakeScripts is an in-memory update.Scripts.
type fakeScripts struct {
	mu     sync.Mutex
	script []byte
	err    error
	names  []string
}

func (f *fakeScripts) Script(_ context.Context, name string) ([]byte, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.names = append(f.names, name)
	return f.script, f.err
}

func (f *fakeScripts) callCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()

	return len(f.names)
}

// fakeRunner is an update.Runner that writes what the test says as the result
// of the script, instead of running one.
type fakeRunner struct {
	mu     sync.Mutex
	result []byte // written to the result file; nil writes none
	output []byte
	err    error
	calls  int
	block  chan struct{} // makes Run wait for it to close, or for its context to end
	script string        // the path Run was given
}

func (f *fakeRunner) set(result string, output string, err error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.result, f.output, f.err = nil, []byte(output), err
	if result != "" {
		f.result = []byte(result)
	}
}

func (f *fakeRunner) callCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()

	return f.calls
}

func (f *fakeRunner) Run(ctx context.Context, script, result string) ([]byte, error) {
	f.mu.Lock()
	f.calls++
	f.script = script
	content, output, err, block := f.result, f.output, f.err, f.block
	f.mu.Unlock()

	if block != nil {
		select {
		case <-block:
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	if content != nil {
		if werr := os.WriteFile(result, content, 0o600); werr != nil {
			return nil, werr
		}
	}
	return output, err
}

// installFixture is an update.Service that installs through the doubles.
type installFixture struct {
	*update.Service
	releases *fakeReleases
	scripts  *fakeScripts
	runner   *fakeRunner
	dir      string
	logs     logCapture

	mu        sync.Mutex
	events    []string // "change" for each OnChange and "installed" for each OnInstalled, in order
	installed []update.Install
}

func (f *installFixture) eventList() []string {
	f.mu.Lock()
	defer f.mu.Unlock()

	return slices.Clone(f.events)
}

func (f *installFixture) installedList() []update.Install {
	f.mu.Lock()
	defer f.mu.Unlock()

	return slices.Clone(f.installed)
}

// phase is where the installation stands.
func (f *installFixture) phase() update.InstallPhase {
	return f.Status().Install.Phase
}

// waitPhase waits for the installation to reach the phase.
func (f *installFixture) waitPhase(t *testing.T, phase update.InstallPhase) update.Install {
	t.Helper()

	waitFor(t, "the installation to be "+string(phase), func() bool { return f.phase() == phase })
	return f.Status().Install
}

// installTarget is the newer version a service made by newInstallService knows.
const installTarget = "0.5.0"

// installedResult is what a script writes when it installed the version.
func installedResult(t *testing.T, version string) string {
	t.Helper()

	return "result: installed\nversion: " + version + "\npath: " + filepath.Join(t.TempDir(), "myspec") + "\n"
}

// newInstallService builds a service on version installed that has checked and
// found installTarget, whose script installs it.
func newInstallService(t *testing.T, installed string, opts ...func(*update.Deps)) *installFixture {
	t.Helper()

	f := &installFixture{
		releases: &fakeReleases{},
		scripts:  &fakeScripts{script: []byte("echo install")},
		runner:   &fakeRunner{},
		dir:      t.TempDir(),
		logs:     newLogCapture(),
	}
	f.releases.set([]update.Release{rel(t, installTarget)}, nil)
	f.runner.set(installedResult(t, installTarget), "installing\n", nil)
	deps := update.Deps{
		Installed: installed,
		Releases:  f.releases,
		Scripts:   f.scripts,
		Runner:    f.runner,
		Log:       f.logs.log,
		OnChange: func() {
			f.mu.Lock()
			f.events = append(f.events, "change")
			f.mu.Unlock()
		},
		OnInstalled: func(i update.Install) {
			f.mu.Lock()
			f.events = append(f.events, "installed")
			f.installed = append(f.installed, i)
			f.mu.Unlock()
		},
		Tick:    runTick,
		TempDir: f.dir,
	}
	for _, opt := range opts {
		opt(&deps)
	}
	f.Service = update.New(deps)
	f.Check(t.Context(), false)
	return f
}
