package app

import (
	"cmp"
	"errors"
	"fmt"
	"os"
	"slices"
	"strings"

	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/platform/relaunch"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/update"
)

// checkForUpdates checks for a newer version, or joins the check that runs,
// as the user asked, and returns where the check stands after it.
func (a *App) checkForUpdates() bindings.Update {
	a.update.Check(a.pollCtx, true)
	return a.updateState()
}

// installUpdate installs the newest version in the background and returns where
// the check and the installation stand.
func (a *App) installUpdate() (bindings.Update, error) {
	if err := a.update.Install(a.pollCtx); err != nil {
		return bindings.Update{}, err
	}
	return a.updateState(), nil
}

// onUpdateInstalled restarts into the installed version when no agent works;
// otherwise the page asks the user, and the app never restarts on its own.
func (a *App) onUpdateInstalled(install update.Install) {
	working := a.workingSessions()
	if len(working) > 0 {
		a.log.Info("update waits for a restart", "version", install.Version, "working", len(working))
		return
	}
	if err := a.restartForUpdate(); err != nil {
		a.log.Error("restart for update failed", "version", install.Version, "err", err)
	}
}

// restartForUpdate starts the installed version, told to wait for this one,
// and quits as a close by the user does: the sessions stop, the turns that run
// are cut. A start that fails keeps the app open, with the reason on the page.
func (a *App) restartForUpdate() error {
	install := a.update.Status().Install
	if install.Phase != update.Installed {
		return errors.New("no update is installed")
	}
	if !a.restarting.CompareAndSwap(false, true) {
		return nil
	}
	if err := relaunch.Start(install.Path, os.Getpid()); err != nil {
		a.restarting.Store(false)
		a.update.SetRestartError(err.Error())
		return fmt.Errorf("restart into MySpec %s: %w", install.Version, err)
	}
	a.log.Info("restarting for update", "version", install.Version, "working", len(a.workingSessions()))
	if wails, _ := a.handles(); wails != nil {
		go wails.Quit()
	}
	return nil
}

// workingSessions are the sessions whose agent works now, a turn running or
// starting: what a restart cuts. They come by item and stage.
func (a *App) workingSessions() []session.Key {
	return workingOf(a.sessions.Summaries())
}

// workingOf picks the sessions that work out of the summaries, by item and
// stage; nil when none does.
func workingOf(summaries map[session.Key]session.Summary) []session.Key {
	var working []session.Key
	for key, summary := range summaries {
		if summary.Status == session.StatusWorking {
			working = append(working, key)
		}
	}
	slices.SortFunc(working, func(x, y session.Key) int {
		return cmp.Or(strings.Compare(x.TaskID, y.TaskID), strings.Compare(x.Stage, y.Stage))
	})
	return working
}

// updateState is the check for a newer version and its installation as the
// frontend sees it.
func (a *App) updateState() bindings.Update {
	status := a.update.Status()
	var working []session.Key
	if status.Install.Phase == update.Installed {
		working = a.workingSessions()
	}
	return bindings.FromUpdate(status, update.InstallCommand, working)
}
