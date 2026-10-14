package app

import (
	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/guilhermt/myspec/internal/theme"
)

// modeFor is the theme a desktop asking for dark or not gets before the
// preference is read.
func modeFor(dark bool) theme.Mode {
	if dark {
		return theme.ModeDark
	}
	return theme.ModeLight
}

// applySystemDark records what the desktop reports. The theme service only
// publishes when the value actually changes.
func (a *App) applySystemDark(dark bool) {
	a.theme.SetSystemDark(dark)

	// Repaint what shows behind the webview, once the webview takes it.
	a.backdrop.set(backgroundFor(a.theme.Effective()))
}

// backgroundFor is the colour painted behind the webview until the frontend
// draws: --surface-1 of the design system in each mode, in sRGB.
func backgroundFor(mode theme.Mode) application.RGBA {
	if mode == theme.ModeDark {
		return application.NewRGB(25, 23, 21)
	}
	return application.NewRGB(254, 253, 253)
}

// onThemeChanged publishes the new theme and paints the title bar in it.
func (a *App) onThemeChanged() {
	a.publish()
	a.paintTitleBar(a.theme.Effective())
}

// windowTheme is the theme the native title bar of Windows opens in for a
// mode. It is always a fixed one: SystemDefault would let Wails repaint the
// bar with the system even when the user fixed the theme of the app.
func windowTheme(mode theme.Mode) application.Theme {
	if mode == theme.ModeDark {
		return application.Dark
	}
	return application.Light
}
