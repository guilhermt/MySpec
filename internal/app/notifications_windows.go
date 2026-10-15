package app

import (
	"sync/atomic"

	"github.com/guilhermt/myspec/internal/platform/chime"
	"github.com/guilhermt/myspec/internal/platform/notify"
	"github.com/guilhermt/myspec/internal/platform/toast"
)

// appUserModelID is who the toasts of the app say they come from. The Start
// menu shortcut of the installer, when there is one, carries the same id.
const appUserModelID = "guilhermt.MySpec"

// startNotifications shows the notifications of the app as toasts, under the
// name and icon of the app whatever started it, and with the chime that the
// app rings itself when Windows would show the banner with sound. Windows
// without the toast platform is not a failure: the situations still show in
// the app and the reason goes to the log.
func (a *App) startNotifications(chimePath string) *notify.Notifier {
	iconPath, err := notify.InstallIcon(a.dirs.Data, a.notificationIcon)
	if err != nil {
		// The toasts still show, without the icon.
		a.log.Warn("install notification icon failed", "err", err)
	}

	// A click reaches the notifier once it exists: the toasts left from a run
	// before were cleared before the activator could hear them.
	var notifier atomic.Pointer[notify.Notifier]
	toaster, err := toast.New(toast.Deps{
		AppID:       appUserModelID,
		DisplayName: appName,
		IconPath:    iconPath,
		OnActivate: func(id uint32) {
			if n := notifier.Load(); n != nil {
				n.Activate(id)
			}
		},
		Log: a.log,
	})
	if err != nil {
		a.log.Warn("notifications unavailable", "err", err)
		return nil
	}

	var ringer notify.Chime
	if chimePath != "" {
		a.player = chime.New(chime.Deps{Path: chimePath, Quiet: toaster.Quiet, Log: a.log})
		ringer = a.player
	}
	n := notify.New(notify.Deps{
		Server:  toaster,
		OnClick: a.openNotification,
		Chime:   ringer,
		Log:     a.log,
	})
	notifier.Store(n)
	return n
}
