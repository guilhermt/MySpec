package update_test

import (
	"context"
	"errors"
	"net"
	"net/http"
	"os"
	"slices"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/update"
)

func TestInstallLocalBuild(t *testing.T) {
	t.Parallel()

	f := newInstallService(t, "dev")

	err := f.Install(t.Context())

	if !errors.Is(err, update.ErrLocalBuild) {
		t.Errorf("Install = %v, want ErrLocalBuild", err)
	}
	if n := f.scripts.callCount(); n != 0 {
		t.Errorf("Script was called %d times, want 0", n)
	}
}

func TestInstallSucceeds(t *testing.T) {
	t.Parallel()

	f := newInstallService(t, "0.4.0")
	f.runner.block = make(chan struct{})

	if err := f.Install(t.Context()); err != nil {
		t.Fatalf("Install: %v", err)
	}
	if got, want := f.phase(), update.Installing; got != want {
		t.Errorf("phase = %q, want %q", got, want)
	}
	if got := f.Status().Install.Target; got != installTarget {
		t.Errorf("Target while it installs = %q, want %q", got, installTarget)
	}
	waitFor(t, "the runner to start", func() bool { return f.runner.callCount() == 1 })
	close(f.runner.block)

	got := f.waitPhase(t, update.Installed)

	want := update.Install{Phase: update.Installed, Target: installTarget, Version: installTarget, Path: got.Path}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("Install (-want +got):\n%s", diff)
	}
	waitFor(t, "OnInstalled", func() bool { return len(f.installedList()) == 1 })
	if diff := cmp.Diff([]update.Install{want}, f.installedList()); diff != "" {
		t.Errorf("OnInstalled (-want +got):\n%s", diff)
	}
	events := f.eventList()
	if n := len(events); n < 2 || events[n-2] != "change" || events[n-1] != "installed" {
		t.Errorf("events = %v, want OnInstalled right after an OnChange", events)
	}
	if entries, err := os.ReadDir(f.dir); err != nil || len(entries) != 0 {
		t.Errorf("the temporary folder holds %v (%v), want it empty", entries, err)
	}
	if got := f.scripts.names; !slices.Equal(got, []string{"install.sh"}) && !slices.Equal(got, []string{"install.ps1"}) {
		t.Errorf("scripts asked for = %v", got)
	}
	waitFor(t, "the installation to be logged", func() bool { return len(f.logs.records(t, "update installed")) == 1 })
}

func TestInstallNotDoubled(t *testing.T) {
	t.Parallel()

	f := newInstallService(t, "0.4.0")
	f.runner.block = make(chan struct{})
	if err := f.Install(t.Context()); err != nil {
		t.Fatalf("Install: %v", err)
	}

	if err := f.Install(t.Context()); err != nil {
		t.Errorf("Install while it installs: %v", err)
	}
	close(f.runner.block)
	f.waitPhase(t, update.Installed)
	if err := f.Install(t.Context()); err != nil {
		t.Errorf("Install once installed: %v", err)
	}

	if n := f.runner.callCount(); n != 1 {
		t.Errorf("Run was called %d times, want 1", n)
	}
	if n := f.scripts.callCount(); n != 1 {
		t.Errorf("Script was called %d times, want 1", n)
	}
}

func TestInstallNewerThanShown(t *testing.T) {
	t.Parallel()

	f := newInstallService(t, "0.4.0")
	f.runner.set(installedResult(t, "0.5.1"), "", nil)

	if err := f.Install(t.Context()); err != nil {
		t.Fatalf("Install: %v", err)
	}

	got := f.waitPhase(t, update.Installed)
	if got.Target != "0.5.0" || got.Version != "0.5.1" {
		t.Errorf("Target, Version = %q, %q, want 0.5.0, 0.5.1", got.Target, got.Version)
	}
}

func TestInstallSameVersion(t *testing.T) {
	t.Parallel()

	f := newInstallService(t, "0.4.0")
	f.runner.set(installedResult(t, "0.4.0"), "", nil)
	checks := f.releases.callCount()

	if err := f.Install(t.Context()); err != nil {
		t.Fatalf("Install: %v", err)
	}

	waitFor(t, "a check after the installation", func() bool { return f.releases.callCount() > checks })
	if got := f.Status().Install; got != (update.Install{Phase: update.InstallIdle}) {
		t.Errorf("Install = %+v, want idle", got)
	}
	if n := len(f.installedList()); n != 0 {
		t.Errorf("OnInstalled was called %d times, want 0", n)
	}
	waitFor(t, "the installation to be logged", func() bool { return len(f.logs.records(t, "update already installed")) == 1 })
}

// failingGitHub is the install script server answering with the status.
func failingGitHub(t *testing.T, status int, headers map[string]string) update.Scripts {
	t.Helper()

	ts := serveFunc(t, func(w http.ResponseWriter, _ *http.Request) {
		for k, v := range headers {
			w.Header().Set(k, v)
		}
		w.WriteHeader(status)
	})
	return update.NewGitHub(update.GitHubDeps{RawBaseURL: ts.URL, UserAgent: "MySpec/test"})
}

func TestInstallFailures(t *testing.T) {
	t.Parallel()

	scriptError := func(err error) update.Scripts { return &fakeScripts{err: err} }
	tests := []struct {
		name         string
		scripts      update.Scripts
		result       string // what the script writes; "" writes no file
		timeout      time.Duration
		block        bool
		wantKind     update.FailureKind
		wantReason   string
		wantCommands []string
	}{
		{
			name: "no network", scripts: scriptError(&net.OpError{Op: "dial", Err: errors.New("refused")}),
			wantKind: update.Offline, wantReason: "Dial: refused.",
		},
		{
			name: "rate limited", scripts: failingGitHub(t, 429, map[string]string{"Retry-After": "60"}),
			wantKind: update.RateLimited, wantReason: "GitHub answered 429 Too Many Requests.",
		},
		{
			name: "no answer in time", scripts: scriptError(context.DeadlineExceeded),
			wantKind: update.Timeout, wantReason: "Context deadline exceeded.",
		},
		{
			name: "server error", scripts: failingGitHub(t, 500, nil),
			wantKind: update.Failed, wantReason: "GitHub answered 500 Internal Server Error.",
		},
		{
			name: "offline", result: "result: failed\nkind: offline\nreason: could not reach GitHub",
			wantKind: update.Offline, wantReason: "Could not reach GitHub.",
		},
		{
			name: "timeout", result: "result: failed\nkind: timeout\nreason: GitHub didn't answer in time",
			wantKind: update.Timeout, wantReason: "GitHub didn't answer in time.",
		},
		{
			name: "system", result: "result: failed\nkind: system\nreason: MySpec needs a 64-bit Linux.",
			wantKind: update.System, wantReason: "MySpec needs a 64-bit Linux.",
		},
		{
			name: "replace", result: "result: failed\nkind: replace\nreason: could not write /x; close MySpec",
			wantKind: update.Replace, wantReason: "Could not write /x; close MySpec.",
		},
		{
			name: "failed", result: "result: failed\nkind: failed\nreason: unexpected answer!",
			wantKind: update.Failed, wantReason: "Unexpected answer!",
		},
		{
			name: "unknown kind", result: "result: failed\nkind: cosmic\nreason: rays",
			wantKind: update.Failed, wantReason: "Rays.",
		},
		{
			name:     "libraries",
			result:   "result: failed\nkind: libraries\nreason: missing GTK 4\ncommand: sudo pacman -S gtk4\ncommand: sudo apt install libgtk-4-1\n",
			wantKind: update.Libraries, wantReason: "Missing GTK 4.",
			wantCommands: []string{"sudo pacman -S gtk4", "sudo apt install libgtk-4-1"},
		},
		{
			name: "commands of another kind are dropped", result: "result: failed\nkind: system\nreason: no\ncommand: sudo rm -rf /",
			wantKind: update.System, wantReason: "No.",
		},
		{
			name: "no reason", result: "result: failed\nkind: replace",
			wantKind: update.Replace, wantReason: "The install script failed.",
		},
		{
			name:     "no result file",
			wantKind: update.Failed, wantReason: "The install script ended without a result.",
		},
		{
			name: "result without result", result: "version: 0.5.0\n",
			wantKind: update.Failed, wantReason: "The install script ended without a result.",
		},
		{
			name: "unreadable version", result: "result: installed\nversion: abc\npath: " + os.TempDir() + "\n",
			wantKind: update.Failed, wantReason: "The install script reported a result the app can't read.",
		},
		{
			name: "relative path", result: "result: installed\nversion: 0.5.0\npath: bin/myspec\n",
			wantKind: update.Failed, wantReason: "The install script reported a result the app can't read.",
		},
		{
			name: "deadline", timeout: 50 * time.Millisecond, block: true,
			wantKind: update.Timeout, wantReason: "The update didn't finish in 0 minutes.",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			f := newInstallService(t, "0.4.0", func(d *update.Deps) {
				if tt.scripts != nil {
					d.Scripts = tt.scripts
				}
				d.InstallTimeout = tt.timeout
			})
			f.runner.set(tt.result, "output of the script", nil)
			if tt.block {
				f.runner.block = make(chan struct{})
			}

			if err := f.Install(t.Context()); err != nil {
				t.Fatalf("Install: %v", err)
			}

			got := f.waitPhase(t, update.InstallFailed)
			want := &update.InstallFailure{Kind: tt.wantKind, Reason: tt.wantReason, Commands: tt.wantCommands}
			if diff := cmp.Diff(want, got.Failure); diff != "" {
				t.Errorf("Failure (-want +got):\n%s", diff)
			}
			if got.Target != installTarget {
				t.Errorf("Target = %q, want %q", got.Target, installTarget)
			}
			if n := len(f.installedList()); n != 0 {
				t.Errorf("OnInstalled was called %d times, want 0", n)
			}
			waitFor(t, "the failure to be logged", func() bool { return len(f.logs.records(t, "update install failed")) == 1 })
		})
	}
}

func TestInstallAgainAfterFailure(t *testing.T) {
	t.Parallel()

	f := newInstallService(t, "0.4.0")
	f.runner.set("", "", nil)
	if err := f.Install(t.Context()); err != nil {
		t.Fatalf("Install: %v", err)
	}
	f.waitPhase(t, update.InstallFailed)
	f.runner.set(installedResult(t, installTarget), "", nil)

	if err := f.Install(t.Context()); err != nil {
		t.Fatalf("Install again: %v", err)
	}

	got := f.waitPhase(t, update.Installed)
	if got.Failure != nil {
		t.Errorf("Failure = %+v, want it cleared", got.Failure)
	}
	if n := f.runner.callCount(); n != 2 {
		t.Errorf("Run was called %d times, want 2", n)
	}
}

func TestParseResult(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		in   string
		want update.ScriptResult
		ok   bool
	}{
		{
			name: "installed", in: "result: installed\nversion: 0.5.0\npath: /bin/myspec\n", ok: true,
			want: update.ScriptResult{Result: "installed", Version: "0.5.0", Path: "/bin/myspec"},
		},
		{
			name: "a BOM and CRLF", in: "\ufeffresult: failed\r\nkind: system\r\nreason: no way\r\n", ok: true,
			want: update.ScriptResult{Result: "failed", Kind: "system", Reason: "no way"},
		},
		{
			name: "unknown key and line without a colon", in: "result: installed\nfuture: 1\nnonsense\nkey:novalue\n", ok: true,
			want: update.ScriptResult{Result: "installed"},
		},
		{
			name: "repeated command", in: "result: failed\ncommand: a\ncommand: b\n", ok: true,
			want: update.ScriptResult{Result: "failed", Commands: []string{"a", "b"}},
		},
		{
			name: "values are trimmed", in: "result:   installed  \nversion: 0.5.0 \n", ok: true,
			want: update.ScriptResult{Result: "installed", Version: "0.5.0"},
		},
		{name: "invalid result", in: "result: maybe\n", want: update.ScriptResult{Result: "maybe"}},
		{name: "empty", in: ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, ok := update.ParseResult([]byte(tt.in))

			if ok != tt.ok {
				t.Errorf("ok = %v, want %v", ok, tt.ok)
			}
			if diff := cmp.Diff(tt.want, got); diff != "" {
				t.Errorf("result (-want +got):\n%s", diff)
			}
		})
	}
}

func TestSentence(t *testing.T) {
	t.Parallel()

	tests := map[string]string{
		"":                       "",
		"   ":                    "",
		"could not write /x":     "Could not write /x.",
		"  already a sentence. ": "Already a sentence.",
		"Really?":                "Really?",
		"Stop!":                  "Stop!",
		"émoji ok":               "Émoji ok.",
	}
	for in, want := range tests {
		if got := update.Sentence(in); got != want {
			t.Errorf("Sentence(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestSetRestartError(t *testing.T) {
	t.Parallel()

	f := newInstallService(t, "0.4.0")
	f.SetRestartError("too early")
	if got := f.Status().Install.RestartError; got != "" {
		t.Errorf("RestartError while idle = %q, want it ignored", got)
	}

	if err := f.Install(t.Context()); err != nil {
		t.Fatalf("Install: %v", err)
	}
	f.waitPhase(t, update.Installed)
	changes := len(f.eventList())
	f.SetRestartError("the app couldn't start")

	if got := f.Status().Install.RestartError; got != "The app couldn't start." {
		t.Errorf("RestartError = %q", got)
	}
	if n := len(f.eventList()); n != changes+1 {
		t.Errorf("%d events after, %d before, want one more OnChange", n, changes)
	}
}

func TestStatusCopiesInstall(t *testing.T) {
	t.Parallel()

	f := newInstallService(t, "0.4.0")
	f.runner.set("result: failed\nkind: libraries\nreason: missing\ncommand: sudo a\n", "", nil)
	if err := f.Install(t.Context()); err != nil {
		t.Fatalf("Install: %v", err)
	}
	f.waitPhase(t, update.InstallFailed)

	first := f.Status().Install
	first.Failure.Commands[0] = "changed"
	first.Failure.Reason = "changed"

	got := f.Status().Install.Failure
	if got.Commands[0] != "sudo a" || got.Reason != "Missing." {
		t.Errorf("Failure = %+v, want it untouched", got)
	}
}
