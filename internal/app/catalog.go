package app

import (
	"context"
	"time"

	"github.com/guilhermt/myspec/internal/claude"
)

// catalogTimeout bounds the reading of the model catalog at startup: the CLI
// answers in about two seconds; a longer wait is a CLI that will not answer.
const catalogTimeout = 20 * time.Second

// discoverModels reads the catalog of the installed CLI once, in the
// background, and hands it to the models service. It runs in the data
// directory, so that the CLI never reads a project of the user.
func (a *App) discoverModels(dataDir string) {
	ctx, cancel := context.WithTimeout(context.Background(), catalogTimeout)
	defer cancel()

	a.models.Discover(ctx, func(ctx context.Context) ([]claude.ModelEntry, error) {
		binary, err := claude.Locate()
		if err != nil {
			return nil, err
		}
		return claude.ListModels(ctx, binary, dataDir)
	})
}
