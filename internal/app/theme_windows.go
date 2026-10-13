package app

import "log/slog"

// readSystemDark answers light: the colour scheme of Windows is not read yet,
// and a desktop that does not answer gets the light theme.
func readSystemDark(*slog.Logger) bool { return false }

// watchSystemTheme does nothing on Windows, where the theme of the system is
// not followed yet.
func (a *App) watchSystemTheme() {}
