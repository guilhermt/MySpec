package app

import (
	"context"
	"time"

	"github.com/guilhermt/myspec/internal/claude"
	"github.com/guilhermt/myspec/internal/models"
)

// catalogTimeout bounds the reading of the model catalog at startup: the CLI
// answers in about two seconds; a longer wait is a CLI that will not answer.
const catalogTimeout = 20 * time.Second

// catalogReader reads the catalog of the CLI found on the machine, in the
// data directory, so that the CLI never reads a project of the user.
func catalogReader(dataDir string) models.Reader {
	return func(ctx context.Context) ([]claude.ModelEntry, error) {
		binary, err := claude.Locate()
		if err != nil {
			return nil, err
		}
		return claude.ListModels(ctx, binary, dataDir)
	}
}

// discoverModels reads the catalog of the installed CLI once, in the
// background, and hands it to the models service. It stops when ctx ends, with
// the app.
func (a *App) discoverModels(ctx context.Context, dataDir string) {
	ctx, cancel := context.WithTimeout(ctx, catalogTimeout)
	defer cancel()

	a.models.Discover(ctx, catalogReader(dataDir))
}

// retryModels reads the catalog again when the reading of this run failed; it
// does nothing otherwise.
func (a *App) retryModels(ctx context.Context, dataDir string) {
	ctx, cancel := context.WithTimeout(ctx, catalogTimeout)
	defer cancel()

	a.models.Retry(ctx, catalogReader(dataDir))
}
