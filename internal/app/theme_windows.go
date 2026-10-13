package app

import (
	"errors"
	"fmt"
	"log/slog"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	"github.com/wailsapp/wails/v3/pkg/w32"
	"golang.org/x/sys/windows/registry"

	"github.com/guilhermt/myspec/internal/theme"
)

// Where Windows keeps the app mode, the "Choose your default app mode" of
// Personalization > Colors, which is the theme of the system for the app: the
// Windows mode only colours the taskbar and the Start menu.
const (
	personalizeKey    = `Software\Microsoft\Windows\CurrentVersion\Themes\Personalize`
	appsUseLightValue = "AppsUseLightTheme"
)

// readSystemDark reads the app mode before the window opens, so that the
// window, its title bar and the first screen open in the right theme. A
// Windows that does not answer gets the light theme.
func readSystemDark(log *slog.Logger) bool {
	dark, err := appsDark()
	if err != nil {
		log.Warn("system theme unavailable", "err", err)
		return false
	}
	return dark
}

// watchSystemTheme reads the app mode and follows its changes, which Wails
// announces as SystemThemeChanged when Windows broadcasts ImmersiveColorSet.
func (a *App) watchSystemTheme() {
	wails, _ := a.handles()
	if wails == nil {
		return
	}
	// The event also comes when only the Windows mode changes. Reading the app
	// mode again ignores it, because SetSystemDark publishes only on a change.
	wails.Event.OnApplicationEvent(events.Windows.SystemThemeChanged, func(*application.ApplicationEvent) {
		a.followSystemTheme()
	})

	// A change between the opening of the window and now.
	a.followSystemTheme()
}

// followSystemTheme applies the app mode Windows has now.
func (a *App) followSystemTheme() {
	dark, err := appsDark()
	if err != nil {
		a.log.Warn("system theme unavailable", "err", err)
		return
	}
	a.applySystemDark(dark)
}

// appsDark reads whether the app mode is dark. A missing value is the default
// of Windows, which is light.
func appsDark() (bool, error) {
	key, err := registry.OpenKey(registry.CURRENT_USER, personalizeKey, registry.QUERY_VALUE)
	if err != nil {
		return false, fmt.Errorf("read %s: %w", appsUseLightValue, err)
	}
	defer key.Close()

	light, _, err := key.GetIntegerValue(appsUseLightValue)
	if errors.Is(err, registry.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("read %s: %w", appsUseLightValue, err)
	}
	return light == 0, nil
}

// paintTitleBar paints the native title bar in a mode, on the main thread.
func (a *App) paintTitleBar(mode theme.Mode) {
	_, window := a.handles()
	if window == nil {
		return
	}
	application.InvokeAsync(func() {
		// The window has no native one yet, or it is already destroyed.
		hwnd := window.NativeWindow()
		if hwnd == nil {
			return
		}
		w32.SetTheme(uintptr(hwnd), mode == theme.ModeDark)
	})
}
