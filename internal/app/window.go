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

// bringForward shows the window in front of the user, restored when it was
// minimised. It hands the work to the main thread without waiting for it: a
// click on a notification runs on the goroutine of the notifier, which shutdown
// waits for on the main thread.
func (a *App) bringForward() {
	// Without a window there is no application either, and nothing to hand the
	// work to.
	_, window := a.handles()
	if window == nil {
		return
	}
	application.InvokeAsync(func() {
		if window.IsMinimised() {
			window.UnMinimise()
		}
		window.Show()
		window.Focus()
	})
}

// windowFocused reports whether the window is in front of the user. Before the
// window exists there is nothing to miss, so it counts as in front.
func (a *App) windowFocused() bool {
	_, window := a.handles()
	return window == nil || window.IsFocused()
}
