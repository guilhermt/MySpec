package app

import (
	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/update"
)

// checkForUpdates checks for a newer version, or joins the check that runs,
// as the user asked, and returns where the check stands after it.
func (a *App) checkForUpdates() bindings.Update {
	return bindings.FromUpdate(a.update.Check(a.pollCtx, true), update.InstallCommand)
}

// updateState is the check for a newer version as the frontend sees it.
func (a *App) updateState() bindings.Update {
	return bindings.FromUpdate(a.update.Status(), update.InstallCommand)
}
