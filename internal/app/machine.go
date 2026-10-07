package app

import "github.com/guilhermt/myspec/internal/bindings"

// checkMachine checks the machine, or joins the check that runs, and returns
// where the check stands after it. When the check finds a Claude Code the
// catalog can be read from and the reading of this run failed, the catalog is
// read again in the background: that is what Check again offers instead of
// reopening the app.
func (a *App) checkMachine() bindings.Machine {
	if a.machine.Check(a.pollCtx).ClaudeUsable() {
		go a.retryModels(a.pollCtx, a.dirs.Data)
	}
	return a.machineState()
}

// machineState is the check of the machine as the frontend sees it.
func (a *App) machineState() bindings.Machine {
	return bindings.FromMachine(a.machine.Status())
}
