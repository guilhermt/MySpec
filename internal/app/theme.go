package app

import (
	"fmt"

	"github.com/godbus/dbus/v5"
	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/guilhermt/myspec/internal/theme"
)

// The XDG desktop settings portal, where the desktop publishes its colour
// scheme, and the values it answers with.
const (
	portalService    = "org.freedesktop.portal.Desktop"
	portalPath       = "/org/freedesktop/portal/desktop"
	portalSettings   = "org.freedesktop.portal.Settings"
	portalNamespace  = "org.freedesktop.appearance"
	portalKey        = "color-scheme"
	schemePreferDark = uint32(1)
)

// signalBuffer is how many portal signals may queue up before they are dropped.
const signalBuffer = 10

// watchSystemTheme reads the desktop colour scheme and follows its changes.
//
// It talks to the portal directly instead of going through Wails, which cannot
// answer either question in v3.0.0-beta.16: Env.IsDarkMode reports false until
// Run builds the platform application, which happens after the window is
// created, and the GTK4 backend never starts the watcher that would raise
// events.Common.ThemeChanged. See README, "Target machine notes".
//
// A desktop without the portal is not a failure: the app stays on the light
// theme until the user picks one.
func (a *App) watchSystemTheme() {
	conn, err := dbus.SessionBus()
	if err != nil {
		a.log.Warn("system theme unavailable", "err", err)
		return
	}

	dark, err := systemDark(conn)
	if err != nil {
		a.log.Warn("system theme unavailable", "err", err)
		return
	}
	a.applySystemDark(dark)

	if err := conn.AddMatchSignal(
		dbus.WithMatchObjectPath(portalPath),
		dbus.WithMatchInterface(portalSettings),
		dbus.WithMatchMember("SettingChanged"),
	); err != nil {
		a.log.Warn("system theme changes unavailable", "err", err)
		return
	}

	signals := make(chan *dbus.Signal, signalBuffer)
	conn.Signal(signals)
	go a.followSystemTheme(signals)
}

// followSystemTheme applies the colour scheme changes the portal announces.
func (a *App) followSystemTheme(signals <-chan *dbus.Signal) {
	for signal := range signals {
		if dark, ok := darkFromSignal(signal); ok {
			a.applySystemDark(dark)
		}
	}
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

// systemDark asks the portal whether the desktop wants a dark interface.
func systemDark(conn *dbus.Conn) (bool, error) {
	call := conn.Object(portalService, portalPath).
		Call(portalSettings+".Read", 0, portalNamespace, portalKey)
	if call.Err != nil {
		return false, fmt.Errorf("read %s %s: %w", portalNamespace, portalKey, call.Err)
	}

	var result dbus.Variant
	if err := call.Store(&result); err != nil {
		return false, fmt.Errorf("read %s %s: %w", portalNamespace, portalKey, err)
	}

	// The portal wraps the value in a second variant.
	inner, ok := result.Value().(dbus.Variant)
	if !ok {
		return false, fmt.Errorf("%s %s is %s, want a variant", portalNamespace, portalKey, result.Signature())
	}
	scheme, ok := inner.Value().(uint32)
	if !ok {
		return false, fmt.Errorf("%s %s is %s, want a uint32", portalNamespace, portalKey, inner.Signature())
	}
	return scheme == schemePreferDark, nil
}

// darkFromSignal reads a colour scheme out of a portal SettingChanged signal,
// reporting false for every other setting it carries.
func darkFromSignal(signal *dbus.Signal) (dark, ok bool) {
	if len(signal.Body) < 3 {
		return false, false
	}
	if namespace, isString := signal.Body[0].(string); !isString || namespace != portalNamespace {
		return false, false
	}
	if key, isString := signal.Body[1].(string); !isString || key != portalKey {
		return false, false
	}
	value, isVariant := signal.Body[2].(dbus.Variant)
	if !isVariant {
		return false, false
	}
	scheme, isScheme := value.Value().(uint32)
	if !isScheme {
		return false, false
	}
	return scheme == schemePreferDark, true
}

// backgroundFor is the colour painted behind the webview until the frontend
// draws: --surface-1 of the design system in each mode, in sRGB.
func backgroundFor(mode theme.Mode) application.RGBA {
	if mode == theme.ModeDark {
		return application.NewRGB(25, 23, 21)
	}
	return application.NewRGB(254, 253, 253)
}
