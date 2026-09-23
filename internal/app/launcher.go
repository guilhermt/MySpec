package app

import (
	"context"
	"log/slog"

	"github.com/guilhermt/myspec/internal/claude"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/session"
)

// claudeLauncher adapts internal/claude to session.Launcher, which is what
// keeps the session domain free of the CLI's own types beyond its protocol.
type claudeLauncher struct {
	log *slog.Logger
	// effort is the effort rule of the catalog: what a choice runs with.
	effort func(models.Choice) models.Effort
}

// Locate finds the Claude Code executable.
func (l claudeLauncher) Locate() (string, error) {
	return claude.Locate()
}

// Preflight checks that the user is logged in.
func (l claudeLauncher) Preflight(ctx context.Context, binary string) error {
	return claude.Preflight(ctx, binary)
}

// Start runs a session process.
func (l claudeLauncher) Start(ctx context.Context, cfg claude.Config) (session.Process, error) {
	// The catalog says whether the model takes an effort; a model that takes none
	// runs without the flag, whatever the session holds.
	cfg.Effort = string(l.effort(models.Choice{Model: models.Model(cfg.Model), Effort: models.Effort(cfg.Effort)}))

	// A typed nil would reach the caller as a non-nil interface, so the
	// failure is returned before the process becomes one.
	proc, err := claude.Start(ctx, cfg, l.log)
	if err != nil {
		return nil, err
	}
	return proc, nil
}
