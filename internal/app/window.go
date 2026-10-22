package app

import (
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"

	"github.com/guilhermt/myspec/internal/theme"
)

// The window geometry. The window always starts maximised: on Wayland the
// compositor owns placement, so no window state is read or saved.
const (
	windowWidth     = 1200
	windowHeight    = 800
	windowMinWidth  = 800
	windowMinHeight = 500
)

// openWindow creates the one window the app has.
func (a *App) openWindow(cfg Config, mode theme.Mode) {
	wails, _ := a.handles()

	window := wails.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:             "main",
		Title:            appName,
		Width:            windowWidth,
		Height:           windowHeight,
		MinWidth:         windowMinWidth,
		MinHeight:        windowMinHeight,
		StartState:       application.WindowStateMaximised,
		BackgroundColour: backgroundFor(mode),
		URL:              "/",
		Linux:            application.LinuxWindow{Icon: cfg.Icon},
		Windows:          application.WindowsWindow{Theme: windowTheme(mode)},
	})

	window.OnWindowEvent(events.Common.WindowRuntimeReady, func(*application.WindowEvent) {
		a.backdrop.ready(func(colour application.RGBA) { window.SetBackgroundColour(colour) })
	})

	window.RegisterHook(events.Common.WindowClosing, a.onWindowClosing)

	a.mu.Lock()
	a.window = window
	a.mu.Unlock()
}

// onWindowClosing holds the close of the window back while a subagent runs,
// for the user to confirm it in the app.
func (a *App) onWindowClosing(e *application.WindowEvent) {
	if !a.isReady() || a.quitConfirmedNow() || !a.sessions.SubagentRunning() {
		return
	}
	e.Cancel()
	a.askQuit()
}

// quitConfirmedNow says the user already confirmed closing the app.
func (a *App) quitConfirmedNow() bool {
	a.quitMu.Lock()
	defer a.quitMu.Unlock()
	return a.quitConfirmed
}

// quitAskedNow says the close of the window is held back, waiting for the user.
func (a *App) quitAskedNow() bool {
	a.quitMu.Lock()
	defer a.quitMu.Unlock()
	return a.quitAsked
}

// askQuit shows the quit warning.
func (a *App) askQuit() {
	a.quitMu.Lock()
	a.quitAsked = true
	a.quitMu.Unlock()
	a.publish()
}

// quitAnyway closes the app after the user confirmed the warning.
func (a *App) quitAnyway() {
	a.quitMu.Lock()
	a.quitConfirmed, a.quitAsked = true, false
	a.quitMu.Unlock()
	if wails, _ := a.handles(); wails != nil {
		go wails.Quit()
	}
}

// cancelQuit dismisses the quit warning and keeps the app open.
func (a *App) cancelQuit() {
	a.quitMu.Lock()
	a.quitAsked = false
	a.quitMu.Unlock()
	a.publish()
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
