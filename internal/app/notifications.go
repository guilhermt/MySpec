package app

import (
	"context"
	"fmt"
	"time"

	"github.com/godbus/dbus/v5"

	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/platform/chime"
	"github.com/guilhermt/myspec/internal/platform/dnd"
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
	// soundHintFile and soundHintSuppress are the hints that ask the server for
	// a sound file or for no sound at all.
	soundHintFile     = "sound-file"
	soundHintSuppress = "suppress-sound"
)

// propertiesGet is the method of the bus that reads a property of an object.
const propertiesGet = "org.freedesktop.DBus.Properties.Get"

// startNotifications connects the notifier to the notification service of the
// desktop, on the session bus the theme portal already uses. It talks to the
// service directly instead of going through Wails, whose Linux notifier in
// v3.0.0-beta.16 reports a notification the user dismissed as a click. With the
// chime installed, a notification that makes a sound either hands it to the
// server or rings it through the player, which first asks the desktop about
// do-not-disturb. A desktop without the service is not a failure: the
// situations still show in the app and the reason goes to the log.
func (a *App) startNotifications(chimePath string) *notify.Notifier {
	conn, err := dbus.SessionBus()
	if err != nil {
		a.log.Warn("notifications unavailable", "err", err)
		return nil
	}

	var ringer notify.Chime
	if chimePath != "" {
		detector := dnd.New(dnd.Deps{Bus: sessionBus{conn: conn}, Log: a.log})
		a.player = chime.New(chime.Deps{Path: chimePath, Quiet: detector.On, Log: a.log})
		ringer = a.player
	}
	notifier := notify.New(notify.Deps{
		Server:  desktopServer{obj: conn.Object(notificationsService, notificationsPath), chime: chimePath},
		OnClick: a.openNotification,
		Chime:   ringer,
		Log:     a.log,
	})

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
	obj   dbus.BusObject
	chime string // the chime on disk, for a server that plays sounds
}

// Capabilities are the optional features the server announces.
func (d desktopServer) Capabilities() ([]string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), notifyTimeout)
	defer cancel()

	var capabilities []string
	if err := d.obj.CallWithContext(ctx, notificationsInterface+".GetCapabilities", 0).Store(&capabilities); err != nil {
		return nil, fmt.Errorf("notification capabilities: %w", err)
	}
	return capabilities, nil
}

// Notify shows a notification clickable as a whole, which stays on screen for
// as long as the settings of the server say. With sound the server plays the
// chime of the app; without, it is asked for silence, so that the sound of the
// theme never plays in its place.
func (d desktopServer) Notify(summary, body string, sound bool) (uint32, error) {
	ctx, cancel := context.WithTimeout(context.Background(), notifyTimeout)
	defer cancel()

	hints := map[string]dbus.Variant{"desktop-entry": dbus.MakeVariant(desktopEntry)}
	if sound {
		hints[soundHintFile] = dbus.MakeVariant(d.chime)
	} else {
		hints[soundHintSuppress] = dbus.MakeVariant(true)
	}

	var id uint32
	err := d.obj.CallWithContext(ctx, notificationsInterface+".Notify", 0,
		appName,
		uint32(0), // replaces no notification
		desktopEntry,
		summary,
		body,
		[]string{notify.DefaultAction, "Open"},
		hints,
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

// sessionBus is the session bus as the do-not-disturb detector reads it. Its
// calls never start a daemon that is not running: asking whether dunst is
// paused must not launch dunst on a desktop that runs another server.
type sessionBus struct {
	conn *dbus.Conn
}

// Property reads a property of an object.
func (b sessionBus) Property(ctx context.Context, service, path, iface, name string) (any, error) {
	var value dbus.Variant
	err := b.conn.Object(service, dbus.ObjectPath(path)).
		CallWithContext(ctx, propertiesGet, dbus.FlagNoAutoStart, iface, name).
		Store(&value)
	if err != nil {
		return nil, fmt.Errorf("read %s.%s: %w", iface, name, err)
	}
	return value.Value(), nil
}

// Call calls a method without arguments and returns the body of its reply.
func (b sessionBus) Call(ctx context.Context, service, path, method string) ([]any, error) {
	call := b.conn.Object(service, dbus.ObjectPath(path)).CallWithContext(ctx, method, dbus.FlagNoAutoStart)
	if call.Err != nil {
		return nil, fmt.Errorf("call %s: %w", method, call.Err)
	}
	return call.Body, nil
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
