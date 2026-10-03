package app

import (
	"context"
	"log/slog"
	"path/filepath"
	"time"

	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/platform/notify"
	"github.com/guilhermt/myspec/internal/platform/xdg"
	"github.com/guilhermt/myspec/internal/store"
)

// BackgroundFor exposes backgroundFor to the external tests of the package.
var BackgroundFor = backgroundFor

// NewThrottle exposes newThrottle to the external tests of the package.
var NewThrottle = newThrottle

// ModeFor exposes modeFor to the external tests of the package.
var ModeFor = modeFor

// SlowAfter exposes slowAfter to the external tests of the package.
const SlowAfter = slowAfter

// Request exposes request to the external tests of the package.
func (t *throttle) Request() { t.request() }

// Stop exposes stop to the external tests of the package.
func (t *throttle) Stop() { t.stop() }

// Startup exposes startup to the external tests of the package.
type Startup = startup

// Progress exposes progress to the external tests of the package.
type Progress = progress

// NewStartupForTest builds an executor over a fake attempt. Every snapshot it
// publishes arrives on the channel, which holds more than a test reads.
func NewStartupForTest(
	attempt func(ctx context.Context, p *Progress) error,
	now func() time.Time,
	slowAfter time.Duration,
) (*Startup, <-chan bindings.Startup) {
	published := make(chan bindings.Startup, 64)
	var s *startup
	s = newStartup(
		attempt,
		func() {
			select {
			case published <- s.snapshot():
			default:
			}
		},
		slog.New(slog.DiscardHandler),
		true,
		"/data",
		"/state/myspec.log",
	)
	s.now, s.slowAfter = now, slowAfter
	return s, published
}

// Start exposes start to the external tests of the package.
func (s *startup) Start() { s.start() }

// TryAgain exposes tryAgain to the external tests of the package.
func (s *startup) TryAgain() { s.tryAgain() }

// Close exposes close to the external tests of the package.
func (s *startup) Close() { s.close() }

// Snapshot exposes snapshot to the external tests of the package.
func (s *startup) Snapshot() bindings.Startup { return s.snapshot() }

// Begin exposes begin to the external tests of the package.
func (p *progress) Begin(id string) { p.begin(stepID(id)) }

// Finish exposes finish to the external tests of the package.
func (p *progress) Finish(id string) { p.finish(stepID(id)) }

// CloneCount exposes cloneCount to the external tests of the package.
func (p *progress) CloneCount(n int) { p.cloneCount(n) }

// Checking exposes checking to the external tests of the package.
func (p *progress) Checking(path string) func() { return p.checking(path) }

// AppOptions are what NewAppForTest builds an app over.
type AppOptions struct {
	DataDir    string
	SystemDark bool
	// Probe and OpenStore replace the probe of the data directory and the
	// opening of the database; nil keeps store.Probe and store.Open.
	Probe     func(dir string) error
	OpenStore func(ctx context.Context, path string, log *slog.Logger, upgrade store.Upgrade) (*store.Store, error)
	// OnStartup sees every snapshot the startup publishes, on the goroutine
	// that publishes it, before the channel does; nil sees none.
	OnStartup func(bindings.Startup)
}

// NewAppForTest builds an app whose data is in opts.DataDir, without a window,
// a desktop, a CLI or GitHub: gh is a path that does not exist, there are no
// notifications, and nothing runs in the background once the app is ready.
// Every snapshot the startup publishes arrives on the channel, which holds more
// than a test reads.
func NewAppForTest(opts AppOptions) (*App, <-chan bindings.Startup) {
	a := &App{
		log:        slog.New(slog.DiscardHandler),
		dirs:       xdg.Dirs{Data: opts.DataDir, State: filepath.Join(opts.DataDir, "state")},
		services:   bindings.NewWaitingServices(),
		systemDark: opts.SystemDark,
	}
	a.publisher = newThrottle(publishWindow, a.publishNow)
	a.pollCtx, a.stopPoll = context.WithCancel(context.Background())
	a.deps = attemptDeps{
		probe:         store.Probe,
		openStore:     store.Open,
		ghBinary:      filepath.Join(opts.DataDir, "no-gh"),
		notifications: func(string) *notify.Notifier { return nil },
		background:    func() {},
	}
	if opts.Probe != nil {
		a.deps.probe = opts.Probe
	}
	if opts.OpenStore != nil {
		a.deps.openStore = opts.OpenStore
	}
	published := make(chan bindings.Startup, 256)
	a.startup = newStartup(a.attempt, func() {
		snapshot := a.startup.snapshot()
		if opts.OnStartup != nil {
			opts.OnStartup(snapshot)
		}
		select {
		case published <- snapshot:
		default:
		}
	}, a.log, opts.SystemDark, opts.DataDir, a.dirs.LogPath())
	return a, published
}

// Start exposes the start of the startup to the external tests of the package.
func (a *App) Start() { a.startup.start() }

// TryAgain exposes tryAgain of the startup to the external tests of the package.
func (a *App) TryAgain() { a.startup.tryAgain() }

// Startup exposes the snapshot of the startup to the external tests of the
// package.
func (a *App) Startup() bindings.Startup { return a.startup.snapshot() }

// CancelAttempt cancels the attempt that runs without waiting for it, which is
// what a test that stops an attempt from inside it needs.
func (a *App) CancelAttempt() {
	a.startup.mu.Lock()
	cancel := a.startup.cancel
	a.startup.mu.Unlock()
	if cancel != nil {
		cancel()
	}
}

// Shutdown exposes shutdown to the external tests of the package.
func (a *App) Shutdown() { a.shutdown() }

// Close shuts the app down and closes what Run closes after it.
func (a *App) Close() {
	a.shutdown()
	a.mu.Lock()
	closers := a.closers
	a.closers = nil
	a.mu.Unlock()
	for i := len(closers) - 1; i >= 0; i-- {
		closers[i]()
	}
}

// IsReady exposes isReady to the external tests of the package.
func (a *App) IsReady() bool { return a.isReady() }

// State is the state the interface asks for, through the service bound to it.
func (a *App) State() bindings.State { return a.services.State.GetState() }

// PublishNow exposes publishNow to the external tests of the package.
func (a *App) PublishNow() { a.publishNow() }
