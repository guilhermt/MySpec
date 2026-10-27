package app

import "github.com/guilhermt/myspec/internal/bindings"

// openNotification brings the window forward on the place a clicked
// notification leads to: the Deploys view for a deploy, the task for a
// situation. A situation that ended since still names its task;
// the interface opens it if it is still there, and stays where it was if not.
func (a *App) openNotification(id string) {
	if repositoryID, branch, ok := deployTarget(id); ok {
		a.bringForward()
		position := a.deploys.Position(repositoryID, branch) // -1 when gone
		if wails, _ := a.handles(); wails != nil {
			wails.Event.Emit(bindings.EventDeployOpen, bindings.DeployOpen{RepositoryID: repositoryID, Position: position})
		}
		return
	}
	a.bringForward()
	target, ok := a.attention.Open(id)
	if !ok {
		return
	}
	if wails, _ := a.handles(); wails != nil {
		wails.Event.Emit(bindings.EventSituationOpen, bindings.SituationOpen{
			TaskID: target.TaskID, Place: bindings.FromPlace(target.Place),
		})
	}
}
