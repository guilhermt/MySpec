// Package notify shows desktop notifications through the freedesktop
// notification service and follows what the user does with them. A
// notification dismissed by the user is only forgotten; a click on it is what
// the app hears about. A notification that starts a burst makes a sound: the
// server plays the chime of the app when it plays sounds, and the app rings it
// otherwise.
package notify

import (
	"log/slog"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/godbus/dbus/v5"
)

// DefaultAction is the action a server invokes when the notification itself
// is clicked.
const DefaultAction = "default"

// The signals of the notification service the notifier follows.
const (
	actionInvoked      = "org.freedesktop.Notifications.ActionInvoked"
	notificationClosed = "org.freedesktop.Notifications.NotificationClosed"
)

// queueSize bounds the work waiting for the server. Notifications are few; a
// full queue means the server stopped answering.
const queueSize = 64

// soundCapability is what a server that plays sounds for notifications
// announces.
const soundCapability = "sound"

// burstWindow is how long the notifications after one that made a sound stay
// silent: situations that start together are heard once, and two unrelated
// ones a few seconds apart are each heard.
const burstWindow = 2 * time.Second

// markupEscaper escapes what a server that reads markup in the body would take
// for a tag or an entity.
var markupEscaper = strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;")

// Server is the freedesktop notification service, reduced to the calls the
// app makes.
type Server interface {
	// Capabilities are the optional features the server announces.
	Capabilities() ([]string, error)
	// Notify shows a notification. With sound, the server plays the chime of
	// the app along with it; without, it is asked to play nothing.
	Notify(summary, body string, sound bool) (uint32, error)
	CloseNotification(id uint32) error
}

// Chime is the sound of the app, when the app plays it itself.
type Chime interface {
	// Ring plays the chime without waiting for it.
	Ring()
}

// Deps are what Notifier needs from the outside.
type Deps struct {
	Server  Server
	OnClick func(id string) // receives the id of a notification the user clicked; see New
	Chime   Chime           // nil: notifications make no sound
	Log     *slog.Logger
	Now     func() time.Time // defaults to time.Now
}

// Notifier shows notifications on a goroutine of its own, in the order they
// were asked for, so that a slow server never holds up the app.
type Notifier struct {
	server  Server
	onClick func(id string)
	chime   Chime
	log     *slog.Logger
	now     func() time.Time

	mu     sync.Mutex // guards closed, and the sends on ops and its closing
	closed bool
	ops    chan func()
	done   chan struct{} // closed once the goroutine is gone

	// Owned by the goroutine.
	shown map[string]uint32 // server id, by the id the app gave, until it is withdrawn, clicked or goes away
	ids   map[uint32]string // the id the app gave, by server id, until it is clicked or the server says it went away

	soundedAt time.Time // when the last notification that made a sound was sent; zero before the first
}

// New starts a notifier. OnClick receives the id of a notification the user
// clicked.
//
// OnClick runs on the goroutine of the notifier, which does nothing else until
// it returns. It must not block for long: a blocked OnClick holds up every send
// and withdraw asked for after the click. It must never call Close, which waits
// for that same goroutine.
func New(deps Deps) *Notifier {
	log := deps.Log
	if log == nil {
		log = slog.New(slog.DiscardHandler)
	}
	now := deps.Now
	if now == nil {
		now = time.Now
	}
	n := &Notifier{
		server:  deps.Server,
		onClick: deps.OnClick,
		chime:   deps.Chime,
		log:     log,
		now:     now,
		ops:     make(chan func(), queueSize),
		done:    make(chan struct{}),
		shown:   map[string]uint32{},
		ids:     map[uint32]string{},
	}
	go n.loop()
	return n
}

// Send shows a notification. It returns at once; a failure goes to the log.
func (n *Notifier) Send(id, title, body string) {
	n.enqueue(func() {
		now := n.now()
		sound := n.soundDue(now)
		serverPlays := sound && n.serverPlaysSounds()
		serverID, err := n.server.Notify(title, escapeMarkup(body), serverPlays)
		if err != nil {
			n.log.Warn("send notification failed", "id", id, "err", err)
			return
		}
		n.shown[id] = serverID
		n.ids[serverID] = id
		if !sound {
			return
		}
		n.soundedAt = now
		if !serverPlays {
			n.chime.Ring()
		}
	})
}

// soundDue reports whether a notification sent at now makes a sound: the app
// has a chime, and no notification made one within the burst window.
func (n *Notifier) soundDue(now time.Time) bool {
	return n.chime != nil && (n.soundedAt.IsZero() || now.Sub(n.soundedAt) >= burstWindow)
}

// serverPlaysSounds reports whether the server plays sounds for notifications
// itself, and so applies its own do-not-disturb and sound preferences. A server
// that cannot say counts as one that does not, and the app rings the chime.
func (n *Notifier) serverPlaysSounds() bool {
	capabilities, err := n.server.Capabilities()
	if err != nil {
		n.log.Warn("read notification capabilities failed", "err", err)
		return false
	}
	return slices.Contains(capabilities, soundCapability)
}

// Withdraw takes a notification off the screen and out of the list the
// desktop keeps. An id it does not show is ignored.
func (n *Notifier) Withdraw(id string) {
	n.enqueue(func() { n.withdraw(id) })
}

// HandleSignal follows what the server says about the notifications: a click
// on one, or one that went away. Every other signal is ignored: the session bus
// hands every signal the connection matched to every channel on it, so the
// signals of the other watchers of the app arrive here too.
//
// The body is read here, and the effect waits its turn on the goroutine behind
// what was asked for before it: the send of a notification has recorded its
// server id by the time a click on it is looked up.
func (n *Notifier) HandleSignal(signal *dbus.Signal) {
	switch signal.Name {
	case actionInvoked:
		if len(signal.Body) < 2 {
			return
		}
		serverID, isID := signal.Body[0].(uint32)
		action, isAction := signal.Body[1].(string)
		if !isID || !isAction || action != DefaultAction {
			return
		}
		n.enqueue(func() {
			id, known := n.ids[serverID]
			if !known {
				return
			}
			n.forget(serverID)
			n.onClick(id)
		})
	case notificationClosed:
		if len(signal.Body) == 0 {
			return
		}
		serverID, isID := signal.Body[0].(uint32)
		if !isID {
			return
		}
		// Why it closed does not matter: dismissing a notification never opens
		// anything.
		n.enqueue(func() { n.forget(serverID) })
	}
}

// Close withdraws every notification still shown and stops. It returns once
// what was asked for before it has run and the goroutine is gone. Calls after
// it do nothing.
//
// It never waits holding the mutex: closing the queue takes no room in it, so a
// Send that comes in meanwhile still returns at once, even with the queue full
// and the goroutine held up by onClick.
func (n *Notifier) Close() {
	n.mu.Lock()
	if !n.closed {
		n.closed = true
		close(n.ops)
	}
	n.mu.Unlock()

	<-n.done
}

// loop runs what was asked for, in order, until the notifier closes. Then it
// withdraws what is still shown, because a notification left behind would lead
// to an app that is gone.
func (n *Notifier) loop() {
	defer close(n.done)

	for op := range n.ops {
		op()
	}
	for id := range n.shown {
		n.withdraw(id)
	}
}

// enqueue hands op to the goroutine without ever waiting for it: its callers
// may hold locks of their own, and a server that stopped answering must not
// hold them up too. A full queue drops op; a closed notifier ignores it.
func (n *Notifier) enqueue(op func()) {
	n.mu.Lock()
	defer n.mu.Unlock()

	if n.closed {
		return
	}
	select {
	case n.ops <- op:
	default:
		n.log.Warn("notification dropped")
	}
}

// withdraw asks the server to close a notification still shown. Its server id
// stays known until the server says the notification went away: a click the
// user made on it before the close reached the server is still on its way, and
// still reaches the app.
func (n *Notifier) withdraw(id string) {
	serverID, ok := n.shown[id]
	if !ok {
		return
	}
	delete(n.shown, id)
	if err := n.server.CloseNotification(serverID); err != nil {
		n.log.Warn("withdraw notification failed", "id", id, "err", err)
	}
}

// forget drops a notification the server no longer has.
func (n *Notifier) forget(serverID uint32) {
	id, ok := n.ids[serverID]
	if !ok {
		return
	}
	delete(n.ids, serverID)
	delete(n.shown, id)
}

// escapeMarkup keeps the body as it was written on a server that announces
// body-markup, as most do, and reads the body as markup: a repository named
// with an & would otherwise lose part of its name. The title is plain text by
// the specification and goes as it is.
func escapeMarkup(body string) string {
	return markupEscaper.Replace(body)
}
