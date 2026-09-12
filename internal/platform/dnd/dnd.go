// Package dnd tells whether the desktop holds notifications back, by asking
// the notification daemons that make it known: the Omarchy shell, KDE Plasma,
// dunst and swaync. A daemon that is not running, or does not answer, says
// nothing, and so does a desktop that keeps the state to itself.
package dnd

import (
	"bytes"
	"context"
	"fmt"
	"log/slog"
	"os/exec"
	"strings"
	"time"
)

// The command-line interface of the Omarchy shell, the call that reports its
// do-not-disturb state, and the answers that mean it is on or off.
const (
	shellBinary = "omarchy-shell"
	shellOn     = "on"
	shellOff    = "off"
)

// shellArgs is the call to the Omarchy shell that reports its do-not-disturb
// state.
var shellArgs = []string{"notifications", "isDnd"}

// The objects the daemons keep their do-not-disturb state on.
const (
	notificationsService = "org.freedesktop.Notifications"
	notificationsPath    = "/org/freedesktop/Notifications"
	kdeInterface         = "org.freedesktop.Notifications" // KDE Plasma: Inhibited
	kdeProperty          = "Inhibited"
	dunstInterface       = "org.dunstproject.cmd0" // dunst: paused
	dunstProperty        = "paused"
	swayncService        = "org.erikreider.swaync.cc"
	swayncPath           = "/org/erikreider/swaync/cc"
	swayncMethod         = "org.erikreider.swaync.cc.GetDnd"
)

// waitDelay is how long a killed omarchy-shell has to release its pipes.
const waitDelay = time.Second

// Bus is the session bus, reduced to the two reads the detector makes. Neither
// may start a daemon that is not running.
type Bus interface {
	// Property reads the property name of the interface iface of an object.
	Property(ctx context.Context, service, path, iface, name string) (any, error)
	// Call calls a method that takes no arguments and returns the body of its
	// reply.
	Call(ctx context.Context, service, path, method string) ([]any, error)
}

// Deps are what Detector needs from the outside.
type Deps struct {
	Bus   Bus      // nil: only the Omarchy shell is asked
	Shell string   // the omarchy-shell binary; empty means looking it up on PATH; tests use it
	Env   []string // environment of omarchy-shell; nil means the parent's; tests use it
	Log   *slog.Logger
}

// Detector asks the notification daemons whether do-not-disturb is on.
type Detector struct {
	bus   Bus
	shell string
	env   []string
	log   *slog.Logger
}

// source is one daemon the detector asks: its name for the log, and the
// question.
type source struct {
	name string
	ask  func(ctx context.Context) (bool, error)
}

// New makes a detector that asks the daemons deps gives it access to.
func New(deps Deps) *Detector {
	log := deps.Log
	if log == nil {
		log = slog.New(slog.DiscardHandler)
	}
	return &Detector{
		bus:   deps.Bus,
		shell: deps.Shell,
		env:   deps.Env,
		log:   log,
	}
}

// On reports whether a daemon says do-not-disturb is on. It asks the Omarchy
// shell, KDE Plasma, dunst and swaync in turn and stops at the first that says
// so. ctx bounds all of it: a daemon still to answer when it runs out says
// nothing.
func (d *Detector) On(ctx context.Context) bool {
	for _, src := range d.sources() {
		if ctx.Err() != nil {
			return false
		}
		on, err := src.ask(ctx)
		if err != nil {
			d.log.Debug("do not disturb unknown", "source", src.name, "err", err)
			continue
		}
		if on {
			d.log.Debug("do not disturb on", "source", src.name)
			return true
		}
	}
	return false
}

// sources are the daemons to ask, in order. Without a bus only the Omarchy
// shell can be asked.
func (d *Detector) sources() []source {
	omarchy := source{name: "omarchy", ask: d.askShell}
	if d.bus == nil {
		return []source{omarchy}
	}
	return []source{
		omarchy,
		{name: "kde", ask: d.property(kdeInterface, kdeProperty)},
		{name: "dunst", ask: d.property(dunstInterface, dunstProperty)},
		{name: "swaync", ask: d.askSwaync},
	}
}

// askShell asks the Omarchy shell, which answers on or off.
func (d *Detector) askShell(ctx context.Context) (bool, error) {
	binary := d.shell
	if binary == "" {
		var err error
		if binary, err = exec.LookPath(shellBinary); err != nil {
			return false, fmt.Errorf("%s: %w", shellBinary, err)
		}
	}

	cmd := exec.CommandContext(ctx, binary, shellArgs...)
	cmd.Env = d.env
	cmd.WaitDelay = waitDelay
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	out, err := cmd.Output()
	if err != nil {
		if ctxErr := ctx.Err(); ctxErr != nil {
			// The error of the process would only say it was killed.
			err = ctxErr
		}
		if said := strings.TrimSpace(stderr.String()); said != "" {
			return false, fmt.Errorf("%s: %w: %s", shellBinary, err, said)
		}
		return false, fmt.Errorf("%s: %w", shellBinary, err)
	}

	switch answer := strings.TrimSpace(string(out)); answer {
	case shellOn:
		return true, nil
	case shellOff:
		return false, nil
	default:
		return false, fmt.Errorf("%s answered %q", shellBinary, answer)
	}
}

// property asks a daemon that keeps its state on a boolean property of the
// notifications object.
func (d *Detector) property(iface, name string) func(ctx context.Context) (bool, error) {
	return func(ctx context.Context) (bool, error) {
		value, err := d.bus.Property(ctx, notificationsService, notificationsPath, iface, name)
		if err != nil {
			return false, err
		}
		on, ok := value.(bool)
		if !ok {
			return false, fmt.Errorf("%s.%s is %T, want a bool", iface, name, value)
		}
		return on, nil
	}
}

// askSwaync asks swaync, whose GetDnd answers a single bool.
func (d *Detector) askSwaync(ctx context.Context) (bool, error) {
	body, err := d.bus.Call(ctx, swayncService, swayncPath, swayncMethod)
	if err != nil {
		return false, err
	}
	if len(body) == 1 {
		if on, ok := body[0].(bool); ok {
			return on, nil
		}
	}
	return false, fmt.Errorf("%s answered %v, want a bool", swayncMethod, body)
}
