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

	// Repaint what shows behind the webview. The window is nil on the first
	// reading, which happens before it is created, and picks the colour up from
	// its options instead.
	if _, window := a.handles(); window != nil {
		window.SetBackgroundColour(backgroundFor(a.theme.Effective()))
	}
}

// backgroundFor is the colour painted behind the webview until the frontend
// draws: --surface-1 of the design system in each mode, in sRGB.
func backgroundFor(mode theme.Mode) application.RGBA {
	if mode == theme.ModeDark {
		return application.NewRGB(25, 23, 21)
	}
	return application.NewRGB(254, 253, 253)
}
