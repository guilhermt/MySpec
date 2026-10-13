package app

import "github.com/guilhermt/myspec/internal/bindings"

// openNotification brings the window forward on the place a clicked
// notification leads to. A situation that ended since still names its task;
// the interface opens it if it is still there, and stays where it was if not.
func (a *App) openNotification(id string) {
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
