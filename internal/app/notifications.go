package app

import (
	"context"
	"fmt"
	"time"

	"github.com/godbus/dbus/v5"

	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/platform/notify"
)

// The freedesktop notification service, and what the app tells it about
// itself.
const (
	notificationsService   = "org.freedesktop.Notifications"
	notificationsPath      = "/org/freedesktop/Notifications"
	notificationsInterface = "org.freedesktop.Notifications"
	// desktopEntry is the desktop file task install writes, which names the
	// app and its icon to the notification server.
	desktopEntry = "org.wails.myspec"
	// notifyTimeout bounds one call to the notification server.
	notifyTimeout = 5 * time.Second
)

// startNotifications connects the notifier to the notification service of the
// desktop, on the session bus the theme portal already uses. It talks to the
// service directly instead of going through Wails, whose Linux notifier in
// v3.0.0-beta.16 reports a notification the user dismissed as a click. A
// desktop without the service is not a failure: the situations still show in
// the app and the reason goes to the log.
func (a *App) startNotifications() *notify.Notifier {
	conn, err := dbus.SessionBus()
	if err != nil {
		a.log.Warn("notifications unavailable", "err", err)
		return nil
	}

	notifier := notify.New(
		desktopServer{obj: conn.Object(notificationsService, notificationsPath)},
		a.openNotification,
		a.log,
	)

	if err := conn.AddMatchSignal(
		dbus.WithMatchObjectPath(notificationsPath),
		dbus.WithMatchInterface(notificationsInterface),
	); err != nil {
		a.log.Warn("notification clicks unavailable", "err", err)
		return notifier
	}

	// The channel of the theme portal hears these signals too, and ignores
	// them: none of them carries a setting of the portal.
	signals := make(chan *dbus.Signal, signalBuffer)
	conn.Signal(signals)
	go func() {
		for signal := range signals {
			notifier.HandleSignal(signal)
		}
	}()
	return notifier
}

// desktopServer is the notification service of the session bus.
type desktopServer struct {
	obj dbus.BusObject
}

// Notify shows a notification clickable as a whole, which stays on screen for
// as long as the settings of the server say.
func (d desktopServer) Notify(summary, body string) (uint32, error) {
	ctx, cancel := context.WithTimeout(context.Background(), notifyTimeout)
	defer cancel()

	var id uint32
	err := d.obj.CallWithContext(ctx, notificationsInterface+".Notify", 0,
		appName,
		uint32(0), // replaces no notification
		desktopEntry,
		summary,
		body,
		[]string{notify.DefaultAction, "Open"},
		map[string]dbus.Variant{"desktop-entry": dbus.MakeVariant(desktopEntry)},
		int32(-1), // the expiration the server is configured with
	).Store(&id)
	if err != nil {
		return 0, fmt.Errorf("notify: %w", err)
	}
	return id, nil
}

// CloseNotification takes a notification away.
func (d desktopServer) CloseNotification(id uint32) error {
	ctx, cancel := context.WithTimeout(context.Background(), notifyTimeout)
	defer cancel()

	if err := d.obj.CallWithContext(ctx, notificationsInterface+".CloseNotification", 0, id).Err; err != nil {
		return fmt.Errorf("close notification %d: %w", id, err)
	}
	return nil
}

// openNotification brings the window forward on the place a clicked
// notification leads to. A situation that ended since still names its task;
// the interface opens it if it is still there, and stays where it was if not.
func (a *App) openNotification(id string) {
	a.bringForward()
	target, ok := a.attention.Open(id)
	if !ok {
		return
	}
	if wails, _ := a.handles(); wails != nil {
		wails.Event.Emit(bindings.EventSituationOpen, bindings.SituationOpen{
			TaskID: target.TaskID, Place: bindings.FromPlace(target.Place),
		})
	}
}
