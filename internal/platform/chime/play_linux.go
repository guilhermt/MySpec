package chime

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os/exec"
	"slices"
	"strings"
	"time"
)

// waitDelay is how long a killed player has to release the pipe of its stderr.
const waitDelay = time.Second

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

// stop does nothing: cancelling the context already kills the player.
func (p *Player) stop() {}
