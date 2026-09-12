package dnd_test

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/platform/dnd"
)

// fakeVar names the behaviour of the fake omarchy-shell. Its presence is also
// what tells the test binary it was re-executed to be the shell.
const fakeVar = "DND_FAKE_SHELL"

// The exit codes of the fake shell: a shell that fails, and one asked for a
// call or a behaviour no test knows.
const (
	failExit    = 1
	unknownExit = 2
)

// hangFor is how long the hanging shell sleeps: longer than any test, so only
// a kill ends it.
const hangFor = time.Hour

// The keys of the fake bus for the daemons the detector reads through it.
const (
	kdeKey    = "org.freedesktop.Notifications /org/freedesktop/Notifications org.freedesktop.Notifications.Inhibited"
	dunstKey  = "org.freedesktop.Notifications /org/freedesktop/Notifications org.dunstproject.cmd0.paused"
	swayncKey = "org.erikreider.swaync.cc /org/erikreider/swaync/cc org.erikreider.swaync.cc.GetDnd"
)

// errServiceUnknown is what the bus answers for a daemon that is not running.
var errServiceUnknown = errors.New("org.freedesktop.DBus.Error.ServiceUnknown")

func TestMain(m *testing.M) {
	if behaviour := os.Getenv(fakeVar); behaviour != "" {
		os.Exit(fakeShell(behaviour, os.Args[1:]))
	}
	os.Exit(m.Run())
}

// fakeShell is the fake omarchy-shell. Asked for its do-not-disturb state, it
// answers on or off, fails, answers garbage or hangs, as behaviour says.
func fakeShell(behaviour string, args []string) int {
	if strings.Join(args, " ") != "notifications isDnd" {
		return unknownExit
	}

	switch behaviour {
	case "on":
		fmt.Println("on")
		return 0
	case "off":
		fmt.Println("off")
		return 0
	case "fail":
		fmt.Fprint(os.Stderr, "OMARCHY_PATH is not set")
		return failExit
	case "garbled":
		fmt.Println("maybe")
		return 0
	case "hang":
		time.Sleep(hangFor)
		return 0
	default:
		return unknownExit
	}
}

// shell is the fake omarchy-shell with the given behaviour: its binary, and the
// environment that sets the behaviour.
func shell(t *testing.T, behaviour string) (binary string, env []string) {
	t.Helper()

	exe, err := os.Executable()
	if err != nil {
		t.Fatalf("Executable() = %v, want nil", err)
	}
	return exe, append(os.Environ(), fakeVar+"="+behaviour)
}

// missingShell is an omarchy-shell that is not installed.
func missingShell(t *testing.T) string {
	t.Helper()

	return filepath.Join(t.TempDir(), "omarchy-shell")
}

// reply is what the fake bus answers for a key: the value of a property or
// the body of a call, an error, or, with block, nothing until the context
// runs out.
type reply struct {
	value any
	body  []any
	err   error
	block bool
}

// fakeBus is a dnd.Bus that answers from replies and records the key of each
// read: service, path and member, separated by spaces. A key without a reply
// is a daemon that is not running.
type fakeBus struct {
	mu      sync.Mutex
	replies map[string]reply
	calls   []string
}

func (b *fakeBus) Property(ctx context.Context, service, path, iface, name string) (any, error) {
	r, err := b.answer(ctx, service+" "+path+" "+iface+"."+name)
	return r.value, err
}

func (b *fakeBus) Call(ctx context.Context, service, path, method string) ([]any, error) {
	r, err := b.answer(ctx, service+" "+path+" "+method)
	return r.body, err
}

// answer records the read of key and returns its reply.
func (b *fakeBus) answer(ctx context.Context, key string) (reply, error) {
	b.mu.Lock()
	b.calls = append(b.calls, key)
	r, ok := b.replies[key]
	b.mu.Unlock()

	switch {
	case !ok:
		return reply{}, errServiceUnknown
	case r.block:
		<-ctx.Done()
		return reply{}, ctx.Err()
	default:
		return r, r.err
	}
}

// recorded returns the keys the bus was read at, in order.
func (b *fakeBus) recorded() []string {
	b.mu.Lock()
	defer b.mu.Unlock()

	return slices.Clone(b.calls)
}

// newDetector makes a detector over bus and the fake shell with the given
// behaviour, or a shell that is not installed when behaviour is empty.
func newDetector(t *testing.T, behaviour string, bus dnd.Bus) *dnd.Detector {
	t.Helper()

	deps := dnd.Deps{Bus: bus, Shell: missingShell(t)}
	if behaviour != "" {
		deps.Shell, deps.Env = shell(t, behaviour)
	}
	return dnd.New(deps)
}
