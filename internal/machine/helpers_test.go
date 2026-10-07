package machine_test

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/claude"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/machine"
)

const testTimeout = 50 * time.Millisecond

// wait blocks until block closes or ctx ends, and returns what the call that
// waited should return; a nil block does not wait.
func wait(ctx context.Context, block chan struct{}) error {
	if block == nil {
		return nil
	}
	select {
	case <-block:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// fakeClaude is an in-memory machine.Claude.
type fakeClaude struct {
	path         string
	locateErr    error
	preflightErr error
	version      claude.Version
	versionErr   error

	// block, when set, makes every call wait for it to close, or for its
	// context to end.
	block chan struct{}

	mu             sync.Mutex
	locates        int
	preflights     int
	versionReads   int
	locateEntered  chan struct{} // receives one value per Locate call, when set
	preflightBlock chan struct{} // makes only Preflight wait
}

func (f *fakeClaude) Locate() (string, error) {
	f.mu.Lock()
	f.locates++
	entered := f.locateEntered
	f.mu.Unlock()

	if entered != nil {
		entered <- struct{}{}
	}
	if f.block != nil {
		<-f.block
	}
	return f.path, f.locateErr
}

func (f *fakeClaude) Preflight(ctx context.Context, _ string) error {
	f.mu.Lock()
	f.preflights++
	f.mu.Unlock()

	if err := wait(ctx, f.preflightBlock); err != nil {
		return err
	}
	return f.preflightErr
}

func (f *fakeClaude) ReadVersion(_ context.Context, _ string) (claude.Version, error) {
	f.mu.Lock()
	f.versionReads++
	f.mu.Unlock()

	return f.version, f.versionErr
}

func (f *fakeClaude) calls() (locates, preflights, versionReads int) {
	f.mu.Lock()
	defer f.mu.Unlock()

	return f.locates, f.preflights, f.versionReads
}

// fakeGitHub is an in-memory machine.GitHub.
type fakeGitHub struct {
	signedInErr error
	account     gh.Account
	accountErr  error

	// accountBlock makes Account wait for it to close, or for its context to end.
	accountBlock chan struct{}

	mu       sync.Mutex
	signedIn int
	accounts int
}

func (f *fakeGitHub) SignedIn(context.Context) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.signedIn++
	return f.signedInErr
}

func (f *fakeGitHub) Account(ctx context.Context) (gh.Account, error) {
	f.mu.Lock()
	f.accounts++
	f.mu.Unlock()

	if err := wait(ctx, f.accountBlock); err != nil {
		return gh.Account{}, err
	}
	return f.account, f.accountErr
}

func (f *fakeGitHub) accountCalls() int {
	f.mu.Lock()
	defer f.mu.Unlock()

	return f.accounts
}

// goodClaude and goodGitHub are a machine with everything in place.
func goodClaude() *fakeClaude {
	return &fakeClaude{path: "/usr/bin/claude", version: claude.MustParseVersion(claude.MinVersion)}
}

func goodGitHub() *fakeGitHub {
	return &fakeGitHub{account: gh.Account{Login: "octocat", Scopes: []string{"gist", "project", "read:org", "repo"}}}
}

// service is a machine.Service over the doubles, with what it tells.
type service struct {
	*machine.Service
	logs logCapture

	mu      sync.Mutex
	changes int
}

func (s *service) changeCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.changes
}

func newService(t *testing.T, c machine.Claude, g machine.GitHub) *service {
	t.Helper()

	s := &service{logs: newLogCapture()}
	s.Service = machine.New(machine.Deps{
		Claude: c,
		GitHub: g,
		Log:    s.logs.log,
		OnChange: func() {
			s.mu.Lock()
			s.changes++
			s.mu.Unlock()
		},
		Timeout: testTimeout,
	})
	return s
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
