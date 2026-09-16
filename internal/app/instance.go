package app

import (
	"github.com/wailsapp/wails/v3/pkg/application"
)

// onSecondInstance brings the window forward. What the second invocation was
// given is ignored: the app opens no folder.
func (a *App) onSecondInstance(data application.SecondInstanceData) {
	a.log.Info("second instance", "args", data.Args)
	a.bringForward()
}
