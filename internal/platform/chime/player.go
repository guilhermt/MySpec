package chime

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os/exec"
	"slices"
	"strings"
	"sync"
	"time"
)

// Command is an audio player the chime can run: its binary, and the arguments
// that go before the path of the file.
type Command struct {
	Binary string
	Args   []string
}

// DefaultCommands are the players tried in order: PipeWire, PulseAudio (which
// PipeWire serves too) and bare ALSA. Each reads a 16-bit PCM WAV and plays
// it on the default output at the volume of the system.
var DefaultCommands = []Command{
	{Binary: "pw-play"},
	{Binary: "paplay"},
	{Binary: "aplay", Args: []string{"-q"}},
}

// ringTimeout bounds one ring, the do-not-disturb check and the playback
// together. The chime lasts under a second, so a player still running at the
// deadline is hung.
const ringTimeout = 5 * time.Second

// quietTimeout bounds the do-not-disturb check, so that a daemon that does not
// answer delays the chime by at most this much.
const quietTimeout = 500 * time.Millisecond

// waitDelay is how long a killed player has to release the pipe of its stderr.
const waitDelay = time.Second

// Deps are what Player needs from the outside.
type Deps struct {
	Path     string                         // the chime on disk
	Commands []Command                      // nil means DefaultCommands
	Env      []string                       // environment of the players; nil means the parent's; tests use it
	Quiet    func(ctx context.Context) bool // whether the desktop holds notifications back; nil counts as never
	Log      *slog.Logger
}

// Player plays the chime on a goroutine of its own, one ring at a time, so
// that a slow or hung audio system never holds up the app.
type Player struct {
	path     string
	commands []Command
	env      []string
	quiet    func(ctx context.Context) bool
	log      *slog.Logger

	ctx    context.Context // cancelled by Close, which kills a player still running
	cancel context.CancelFunc

	mu      sync.Mutex // guards closed and ringing
	closed  bool
	ringing bool
	wg      sync.WaitGroup // the ring in progress
}

// New makes a player of the chime at deps.Path. It plays nothing until Ring.
func New(deps Deps) *Player {
	commands := deps.Commands
	if commands == nil {
		commands = DefaultCommands
	}
	log := deps.Log
	if log == nil {
		log = slog.New(slog.DiscardHandler)
	}
	ctx, cancel := context.WithCancel(context.Background())
	return &Player{
		path:     deps.Path,
		commands: commands,
		env:      deps.Env,
		quiet:    deps.Quiet,
		log:      log,
		ctx:      ctx,
		cancel:   cancel,
	}
}

// Ring plays the chime and returns at once. A ring while the previous one is
// still in progress, or after Close, is dropped: the chime never overlaps
// itself.
func (p *Player) Ring() {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.closed {
		return
	}
	if p.ringing {
		p.log.Debug("chime dropped")
		return
	}
	p.ringing = true
	p.wg.Add(1)
	go p.ring()
}

// ring checks do-not-disturb and plays the chime, within ringTimeout.
func (p *Player) ring() {
	defer p.wg.Done()
	// Registered after wg.Done so that it runs first: Close returns with the
	// ring fully over.
	defer func() {
		p.mu.Lock()
		p.ringing = false
		p.mu.Unlock()
	}()

	ctx, cancel := context.WithTimeout(p.ctx, ringTimeout)
	defer cancel()

	if p.silenced(ctx) {
		p.log.Info("chime silenced")
		return
	}
	if err := p.play(ctx); err != nil {
		p.log.Warn("play chime failed", "err", err)
	}
}

// silenced asks whether the desktop holds notifications back, within
// quietTimeout. A player without Quiet is never silenced.
func (p *Player) silenced(ctx context.Context) bool {
	if p.quiet == nil {
		return false
	}
	qctx, cancel := context.WithTimeout(ctx, quietTimeout)
	defer cancel()

	return p.quiet(qctx)
}

// play runs each player in turn until one plays the chime. A player that is
// missing or fails hands over to the next; a context that ran out stops at
// once, because the next player would be killed just the same.
func (p *Player) play(ctx context.Context) error {
	var errs []error
	for _, command := range p.commands {
		err := p.run(ctx, command)
		if err == nil {
			p.log.Debug("chime played", "player", command.Binary)
			return nil
		}
		errs = append(errs, err)
		if ctx.Err() != nil {
			break
		}
	}
	return errors.Join(errs...)
}

// run plays the chime with one player. The error names the player and carries
// what it said on stderr.
func (p *Player) run(ctx context.Context, command Command) error {
	binary, err := exec.LookPath(command.Binary)
	if err != nil {
		return fmt.Errorf("%s: %w", command.Binary, err)
	}

	args := append(slices.Clone(command.Args), p.path)
	// No process group: the players spawn no children, so killing the player
	// is all it takes.
	cmd := exec.CommandContext(ctx, binary, args...)
	cmd.Env = p.env
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	cmd.WaitDelay = waitDelay

	if err = cmd.Run(); err == nil {
		return nil
	}
	if ctxErr := ctx.Err(); ctxErr != nil {
		// The error of the process would only say it was killed.
		err = ctxErr
	}
	if out := strings.TrimSpace(stderr.String()); out != "" {
		return fmt.Errorf("%s: %w: %s", command.Binary, err, out)
	}
	return fmt.Errorf("%s: %w", command.Binary, err)
}

// Close stops the player: a chime still playing is cut off and nothing rings
// after it. It returns once the ring in progress is gone, which the
// cancellation makes immediate: the player process is killed and the
// do-not-disturb check gives up.
func (p *Player) Close() {
	p.mu.Lock()
	p.closed = true
	p.mu.Unlock()

	p.cancel()
	p.wg.Wait()
}
