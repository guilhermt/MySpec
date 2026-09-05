package app

import "github.com/wailsapp/wails/v3/pkg/application"

// The window geometry. The window always starts maximised: on Wayland the
// compositor owns placement, so no window state is read or saved.
const (
	windowWidth     = 1200
	windowHeight    = 800
	windowMinWidth  = 800
	windowMinHeight = 500
)

// openWindow creates the one window the app has.
func (a *App) openWindow(cfg Config) {
	wails, _ := a.handles()

	window := wails.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:             "main",
		Title:            a.title(),
		Width:            windowWidth,
		Height:           windowHeight,
		MinWidth:         windowMinWidth,
		MinHeight:        windowMinHeight,
		StartState:       application.WindowStateMaximised,
		BackgroundColour: backgroundFor(a.theme.Effective()),
		URL:              "/",
		Linux:            application.LinuxWindow{Icon: cfg.Icon},
	})

	a.mu.Lock()
	a.window = window
	a.mu.Unlock()
}
