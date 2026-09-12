package chime_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/platform/chime"
)

// fakeVar names the directory the fake player records its runs in. Its
// presence is also what tells the test binary it was re-executed to be a
// player.
const fakeVar = "CHIME_FAKE_PLAYER"

// The files the fake player keeps in its directory: its runs, one per line,
// and the pid of the one that hangs.
const (
	callsFile = "calls"
	pidFile   = "pid"
)

// fakePerm is what the fake player writes its files with.
const fakePerm = 0o600

// The exit codes of the fake player: a player that fails, and one asked for a
// behaviour no test knows.
const (
	failExit    = 1
	unknownExit = 2
)

// hangFor is how long the hanging player sleeps: longer than any test, so only
// a kill ends it.
const hangFor = time.Hour

// pollTimeout and pollStep bound how long a test waits for the player, which
// rings on a goroutine of its own.
const (
	pollTimeout = 2 * time.Second
	pollStep    = 5 * time.Millisecond
)

func TestMain(m *testing.M) {
	if dir := os.Getenv(fakeVar); dir != "" {
		os.Exit(fakePlayer(dir, os.Args[1:]))
	}
	os.Exit(m.Run())
}

// fakePlayer is the fake audio player. args[0] is its behaviour and args[1]
// the file: it writes the command line down, then plays, fails or hangs.
func fakePlayer(dir string, args []string) int {
	if err := appendCall(dir, strings.Join(args, " ")); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return unknownExit
	}
	if len(args) == 0 {
		return unknownExit
	}

	switch args[0] {
	case "play":
		return 0
	case "fail":
		fmt.Fprint(os.Stderr, "no audio sink")
		return failExit
	case "hang":
		if err := os.WriteFile(filepath.Join(dir, pidFile), []byte(strconv.Itoa(os.Getpid())), fakePerm); err != nil {
			fmt.Fprintln(os.Stderr, err)
			return unknownExit
		}
		time.Sleep(hangFor)
		return 0
	default:
		return unknownExit
	}
}

// appendCall adds a line to the runs the fake player recorded in dir.
func appendCall(dir, line string) error {
	calls, err := os.OpenFile(filepath.Join(dir, callsFile), os.O_APPEND|os.O_CREATE|os.O_WRONLY, fakePerm)
	if err != nil {
		return err
	}
	_, err = calls.WriteString(line + "\n")
	return errors.Join(err, calls.Close())
}

// players are fake audio players, one per behaviour, with the environment
// that makes them record their runs in dir.
func players(t *testing.T, behaviours ...string) (commands []chime.Command, env []string, dir string) {
	t.Helper()

	dir = t.TempDir()
	exe, err := os.Executable()
	if err != nil {
		t.Fatalf("Executable() = %v, want nil", err)
	}
	commands = make([]chime.Command, 0, len(behaviours))
	for _, behaviour := range behaviours {
		commands = append(commands, chime.Command{Binary: exe, Args: []string{behaviour}})
	}
	return commands, append(os.Environ(), fakeVar+"="+dir), dir
}

// missing is a player that is not installed.
func missing(t *testing.T) chime.Command {
	t.Helper()

	return chime.Command{Binary: filepath.Join(t.TempDir(), "pw-play")}
}

// syncBuffer collects the log the goroutine of the player writes while the
// test reads it.
type syncBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *syncBuffer) Write(chunk []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	return b.buf.Write(chunk)
}

func (b *syncBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()

	return b.buf.String()
}

// fixture is a player over fake audio players, with its log at debug level.
type fixture struct {
	player *chime.Player
	dir    string // where the fake players record their runs
	path   string // the chime the player hands the fake players, which never read it
	logs   *syncBuffer
}

// newFixture makes a player over commands, whose fake players record in dir,
// closed when the test ends.
func newFixture(t *testing.T, commands []chime.Command, env []string, dir string, quiet func(context.Context) bool) *fixture {
	t.Helper()

	f := &fixture{dir: dir, path: filepath.Join(t.TempDir(), "chime.wav"), logs: &syncBuffer{}}
	f.player = chime.New(chime.Deps{
		Path:     f.path,
		Commands: commands,
		Env:      env,
		Quiet:    quiet,
		Log:      slog.New(slog.NewJSONHandler(f.logs, &slog.HandlerOptions{Level: slog.LevelDebug})),
	})
	t.Cleanup(f.player.Close)
	return f
}

// call is the run of a fake player with the given behaviour, as it records it.
func (f *fixture) call(behaviour string) string { return behaviour + " " + f.path }

// recorded returns the runs of the fake players, in order.
func (f *fixture) recorded(t *testing.T) []string {
	t.Helper()

	content, err := os.ReadFile(filepath.Join(f.dir, callsFile))
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	if err != nil {
		t.Fatalf("ReadFile(%s) = %v, want nil", callsFile, err)
	}
	trimmed := strings.TrimSpace(string(content))
	if trimmed == "" {
		return nil
	}
	return strings.Split(trimmed, "\n")
}

// waitCalls polls until the fake players ran exactly the calls given, in
// order.
func (f *fixture) waitCalls(t *testing.T, want ...string) {
	t.Helper()

	if !eventually(func() bool { return slices.Equal(f.recorded(t), want) }) {
		t.Fatalf("player calls mismatch (-want +got):\n%s", cmp.Diff(want, f.recorded(t)))
	}
}

// wantCalls fails the test unless the fake players ran exactly these calls, in
// order.
func (f *fixture) wantCalls(t *testing.T, want ...string) {
	t.Helper()

	if diff := cmp.Diff(want, f.recorded(t)); diff != "" {
		t.Errorf("player calls mismatch (-want +got):\n%s", diff)
	}
}

// waitPid polls until the hanging player wrote down its pid, and returns it.
func (f *fixture) waitPid(t *testing.T) int {
	t.Helper()

	var pid int
	if !eventually(func() bool {
		content, err := os.ReadFile(filepath.Join(f.dir, pidFile))
		if err != nil {
			return false
		}
		pid, err = strconv.Atoi(string(content))
		return err == nil
	}) {
		t.Fatal("the hanging player never wrote its pid")
	}
	return pid
}

// records returns every record of the log, in order.
func (f *fixture) records(t *testing.T) []map[string]any {
	t.Helper()

	var records []map[string]any
	for line := range strings.SplitSeq(strings.TrimSpace(f.logs.String()), "\n") {
		if line == "" {
			continue
		}
		var rec map[string]any
		if err := json.Unmarshal([]byte(line), &rec); err != nil {
			t.Fatalf("parse log line %q: %v", line, err)
		}
		records = append(records, rec)
	}
	return records
}

// logged returns the records of the log with the given message, in order.
func (f *fixture) logged(t *testing.T, msg string) []map[string]any {
	t.Helper()

	var records []map[string]any
	for _, rec := range f.records(t) {
		if rec["msg"] == msg {
			records = append(records, rec)
		}
	}
	return records
}

// waitLogged polls until the log holds a record with the given message, and
// returns the first one.
func (f *fixture) waitLogged(t *testing.T, msg string) map[string]any {
	t.Helper()

	var records []map[string]any
	if !eventually(func() bool {
		records = f.logged(t, msg)
		return len(records) > 0
	}) {
		t.Fatalf("no %q in the log:\n%s", msg, f.logs.String())
	}
	return records[0]
}

// eventually polls cond until it holds or pollTimeout passes, and reports
// whether it held. The player rings on a goroutine of its own, so tests wait
// for it instead of sleeping.
func eventually(cond func() bool) bool {
	deadline := time.Now().Add(pollTimeout)
	for {
		if cond() {
			return true
		}
		if time.Now().After(deadline) {
			return false
		}
		time.Sleep(pollStep)
	}
}
