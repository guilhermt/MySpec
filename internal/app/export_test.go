package app

import (
	"context"
	"log/slog"
	"time"

	"github.com/guilhermt/myspec/internal/bindings"
)

// BackgroundFor exposes backgroundFor to the external tests of the package.
var BackgroundFor = backgroundFor

// NewThrottle exposes newThrottle to the external tests of the package.
var NewThrottle = newThrottle

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
