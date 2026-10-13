package app

import "github.com/guilhermt/myspec/internal/platform/notify"

// startNotifications has no notification service to reach on Windows yet: the
// situations still show in the app, and nothing rings.
func (a *App) startNotifications(string) *notify.Notifier { return nil }
