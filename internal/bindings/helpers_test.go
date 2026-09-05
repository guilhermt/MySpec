package bindings_test

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"strings"
	"sync"
	"testing"

	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/store"
	"github.com/guilhermt/myspec/internal/theme"
	"github.com/guilhermt/myspec/internal/workspace"
)

// fakePicker stands in for the native folder chooser.
type fakePicker struct {
	path    string
	ok      bool
	err     error
	startIn string // what the service asked the dialog to open at
	calls   int
}

func (p *fakePicker) PickFolder(startIn string) (string, bool, error) {
	p.startIn = startIn
	p.calls++
	return p.path, p.ok, p.err
}

// fixture wires the services the way internal/app does, over an in-memory
// database and a scanner that answers with a fixed list.
type fixture struct {
	workspace *bindings.WorkspaceService
	settings  *bindings.SettingsService
	ws        *workspace.Service
	theme     *theme.Service
	store     *store.Store
	picker    *fakePicker
	logs      *bytes.Buffer

	mu      sync.Mutex
	repos   []string
	scanErr error
}

func newFixture(t *testing.T) *fixture {
	t.Helper()

	logs := &bytes.Buffer{}
	log := slog.New(slog.NewJSONHandler(logs, nil))

	st, err := store.OpenMemory(t.Context(), log)
	if err != nil {
		t.Fatalf("OpenMemory() = %v, want nil", err)
	}
	t.Cleanup(func() { _ = st.Close() })

	f := &fixture{store: st, picker: &fakePicker{}, logs: logs}

	f.theme, err = theme.New(t.Context(), st.Settings, false, log, func() {})
	if err != nil {
		t.Fatalf("theme.New() = %v, want nil", err)
	}
	f.ws = workspace.New(workspace.Deps{
		Recents: st.Recents,
		Scan:    f.scan,
		Log:     log,
	})

	f.workspace = bindings.NewWorkspaceService(f.ws, f.snapshot, f.picker, log)
	f.settings = bindings.NewSettingsService(f.theme, log)
	return f
}

// scan is the Scanner the workspace service uses.
func (f *fixture) scan(string) ([]string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.repos, f.scanErr
}

// setScan makes the next scan answer with repos, or fail with err.
func (f *fixture) setScan(repos []string, err error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.repos, f.scanErr = repos, err
}

// snapshot is the same state internal/app publishes.
func (f *fixture) snapshot() bindings.State {
	recents, err := f.ws.Recents(context.Background())
	if err != nil {
		recents = nil
	}
	return bindings.State{
		Workspace:  bindings.FromWorkspace(f.ws.Current()),
		Recents:    bindings.FromRecents(recents),
		Theme:      string(f.theme.Preference()),
		SystemDark: f.theme.SystemDark(),
		Notice:     bindings.FromNotice(f.ws.Notice()),
	}
}

// logged reports whether a record with the given message was written.
func (f *fixture) logged(t *testing.T, msg string) bool {
	t.Helper()

	for _, line := range strings.Split(strings.TrimSpace(f.logs.String()), "\n") {
		if line == "" {
			continue
		}
		var rec map[string]any
		if err := json.Unmarshal([]byte(line), &rec); err != nil {
			t.Fatalf("parse log line %q: %v", line, err)
		}
		if rec["msg"] == msg {
			return true
		}
	}
	return false
}
