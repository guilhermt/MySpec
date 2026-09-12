package notify_test

import (
	"bytes"
	"encoding/json"
	"errors"
	"log/slog"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/godbus/dbus/v5"
	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/platform/notify"
)

// pollTimeout and pollStep bound how long a test waits for the notifier, which
// runs what it is asked on a goroutine of its own.
const (
	pollTimeout = 2 * time.Second
	pollStep    = 5 * time.Millisecond
)

// title is the title of every notification the tests send: the name of a task.
const title = "login-screen"

// The reasons a server gives for a notification that closed.
const (
	closedDismissed uint32 = 2 // the user dismissed it
	closedByCall    uint32 = 3 // CloseNotification closed it
)

// burstWindow is how long the notifications after one that made a sound stay
// silent.
const burstWindow = 2 * time.Second

// The capabilities of a server that plays no sounds, and of one that does.
var (
	silentServer   = []string{"actions", "body", "persistence"}
	soundingServer = []string{"actions", "body", "sound"}
)

// errServer is what a server that stopped working answers with.
var errServer = errors.New("org.freedesktop.DBus.Error.NoReply")

// fakeServer is a notify.Server that hands out ids from 1 and records its
// calls: capabilities, notify:<summary>:<body>, with :sound when it was asked to
// play the chime, and close:<id>. It fails Notify and CloseNotification with err
// when it is set, and answers Capabilities with what it announces.
type fakeServer struct {
	mu              sync.Mutex
	next            uint32
	calls           []string
	err             error
	capabilities    []string
	capabilitiesErr error
	hold            chan struct{} // when set, Notify waits on it before anything else
}

func (s *fakeServer) Capabilities() ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.calls = append(s.calls, "capabilities")
	return slices.Clone(s.capabilities), s.capabilitiesErr
}

func (s *fakeServer) Notify(summary, body string, sound bool) (uint32, error) {
	s.mu.Lock()
	hold := s.hold
	s.mu.Unlock()

	if hold != nil {
		<-hold
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	call := "notify:" + summary + ":" + body
	if sound {
		call += ":sound"
	}
	s.calls = append(s.calls, call)
	if s.err != nil {
		return 0, s.err
	}
	s.next++
	return s.next, nil
}

func (s *fakeServer) CloseNotification(id uint32) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.calls = append(s.calls, "close:"+strconv.FormatUint(uint64(id), 10))
	return s.err
}

// failWith makes every later Notify and CloseNotification fail with err.
func (s *fakeServer) failWith(err error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.err = err
}

// announce makes every later Capabilities answer with capabilities and err.
func (s *fakeServer) announce(capabilities []string, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.capabilities = capabilities
	s.capabilitiesErr = err
}

// holdNotify makes every later Notify wait until release is called, which is
// how a test plays a server that stopped answering.
func (s *fakeServer) holdNotify() (release func()) {
	s.mu.Lock()
	defer s.mu.Unlock()

	hold := make(chan struct{})
	s.hold = hold
	return sync.OnceFunc(func() { close(hold) })
}

// recorded returns the calls the server took, in order.
func (s *fakeServer) recorded() []string {
	s.mu.Lock()
	defer s.mu.Unlock()

	return slices.Clone(s.calls)
}

// fakeChime is a notify.Chime that counts its rings.
type fakeChime struct {
	mu    sync.Mutex
	rings int
}

func (c *fakeChime) Ring() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.rings++
}

// rung returns how many times the chime rang.
func (c *fakeChime) rung() int {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.rings
}

// fakeClock is the clock of the notifier, which moves only when the test
// advances it.
type fakeClock struct {
	mu  sync.Mutex
	now time.Time
}

// Now is the time on the clock.
func (c *fakeClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.now
}

// advance moves the clock forward by d.
func (c *fakeClock) advance(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.now = c.now.Add(d)
}

// syncBuffer collects the log the goroutine of the notifier writes while the
// test reads it.
type syncBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *syncBuffer) Write(chunk []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	return b.buf.Write(chunk)
}

func (b *syncBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()

	return b.buf.String()
}

// fixture is a notifier over a fake server, with what it told the app.
type fixture struct {
	notifier *notify.Notifier
	server   *fakeServer
	chime    *fakeChime // nil when the notifier has no chime
	clock    *fakeClock
	logs     *syncBuffer

	mu     sync.Mutex
	clicks []string // the ids onClick received, in order
}

// newFixture starts a notifier without a chime over a fake server, closed when
// the test ends.
func newFixture(t *testing.T) *fixture {
	t.Helper()

	return start(t, bareFixture())
}

// newChimeFixture starts a notifier with a fake chime over a fake server,
// closed when the test ends.
func newChimeFixture(t *testing.T) *fixture {
	t.Helper()

	f := bareFixture()
	f.chime = &fakeChime{}
	return start(t, f)
}

// bareFixture is a fixture whose notifier is still to start.
func bareFixture() *fixture {
	return &fixture{
		server: &fakeServer{},
		clock:  &fakeClock{now: time.Date(2026, 9, 12, 10, 0, 0, 0, time.UTC)},
		logs:   &syncBuffer{},
	}
}

// start starts the notifier of f, closed when the test ends.
func start(t *testing.T, f *fixture) *fixture {
	t.Helper()

	// A nil *fakeChime behind the interface would still be a chime to the
	// notifier.
	var ringer notify.Chime
	if f.chime != nil {
		ringer = f.chime
	}
	f.notifier = notify.New(notify.Deps{
		Server:  f.server,
		OnClick: f.click,
		Chime:   ringer,
		Log:     slog.New(slog.NewJSONHandler(f.logs, nil)),
		Now:     f.clock.Now,
	})
	t.Cleanup(f.notifier.Close)
	return f
}

// click is the onClick of the notifier.
func (f *fixture) click(id string) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.clicks = append(f.clicks, id)
}

// clicked returns the ids onClick received, in order.
func (f *fixture) clicked() []string {
	f.mu.Lock()
	defer f.mu.Unlock()

	return slices.Clone(f.clicks)
}

// waitCalls polls until the server took exactly the calls given, in order.
func (f *fixture) waitCalls(t *testing.T, want ...string) {
	t.Helper()

	if !eventually(func() bool { return slices.Equal(f.server.recorded(), want) }) {
		t.Fatalf("server calls mismatch (-want +got):\n%s", cmp.Diff(want, f.server.recorded()))
	}
}

// wantCalls fails the test unless the server took exactly these calls, in
// order.
func (f *fixture) wantCalls(t *testing.T, want ...string) {
	t.Helper()

	if diff := cmp.Diff(want, f.server.recorded()); diff != "" {
		t.Errorf("server calls mismatch (-want +got):\n%s", diff)
	}
}

// waitClicks polls until onClick received exactly the ids given, in order.
func (f *fixture) waitClicks(t *testing.T, want ...string) {
	t.Helper()

	if !eventually(func() bool { return slices.Equal(f.clicked(), want) }) {
		t.Fatalf("clicks mismatch (-want +got):\n%s", cmp.Diff(want, f.clicked()))
	}
}

// wantClicks fails the test unless onClick received exactly these ids, in
// order.
func (f *fixture) wantClicks(t *testing.T, want ...string) {
	t.Helper()

	if diff := cmp.Diff(want, f.clicked()); diff != "" {
		t.Errorf("clicks mismatch (-want +got):\n%s", diff)
	}
}

// waitRings polls until the chime rang exactly want times.
func (f *fixture) waitRings(t *testing.T, want int) {
	t.Helper()

	if !eventually(func() bool { return f.chime.rung() == want }) {
		t.Fatalf("chime rang %d times, want %d", f.chime.rung(), want)
	}
}

// wantRings fails the test unless the chime rang exactly want times.
func (f *fixture) wantRings(t *testing.T, want int) {
	t.Helper()

	if got := f.chime.rung(); got != want {
		t.Errorf("chime rang %d times, want %d", got, want)
	}
}

// logged returns the records of the log with the given message, in order.
func (f *fixture) logged(t *testing.T, msg string) []map[string]any {
	t.Helper()

	var records []map[string]any
	for line := range strings.SplitSeq(strings.TrimSpace(f.logs.String()), "\n") {
		if line == "" {
			continue
		}
		var rec map[string]any
		if err := json.Unmarshal([]byte(line), &rec); err != nil {
			t.Fatalf("parse log line %q: %v", line, err)
		}
		if rec["msg"] == msg {
			records = append(records, rec)
		}
	}
	return records
}

// waitLogged polls until the log holds a record with the given message, and
// returns the first one.
func (f *fixture) waitLogged(t *testing.T, msg string) map[string]any {
	t.Helper()

	var records []map[string]any
	if !eventually(func() bool {
		records = f.logged(t, msg)
		return len(records) > 0
	}) {
		t.Fatalf("no %q in the log:\n%s", msg, f.logs.String())
	}
	return records[0]
}

// wantFailure fails the test unless a log record names the notification and
// the error of the server.
func wantFailure(t *testing.T, rec map[string]any, id string) {
	t.Helper()

	want := map[string]any{"level": "WARN", "id": id, "err": errServer.Error()}
	got := map[string]any{"level": rec["level"], "id": rec["id"], "err": rec["err"]}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("log record mismatch (-want +got):\n%s", diff)
	}
}

// eventually polls cond until it holds or pollTimeout passes, and reports
// whether it held. The notifier works on a goroutine of its own, so tests wait
// for it instead of sleeping.
func eventually(cond func() bool) bool {
	deadline := time.Now().Add(pollTimeout)
	for {
		if cond() {
			return true
		}
		if time.Now().After(deadline) {
			return false
		}
		time.Sleep(pollStep)
	}
}

// notified is the call a notification of the task with the given body makes
// to the server.
func notified(body string) string { return "notify:" + title + ":" + body }

// soundNotified is the call a notification of the task with the given body
// makes to the server when the server plays the chime.
func soundNotified(body string) string { return notified(body) + ":sound" }

// signal is a signal of the notification service, as the session bus hands it
// over.
func signal(member string, body ...any) *dbus.Signal {
	return &dbus.Signal{
		Sender: ":1.42",
		Path:   "/org/freedesktop/Notifications",
		Name:   "org.freedesktop.Notifications." + member,
		Body:   body,
	}
}

// actionInvoked is the signal of an action the user invoked on a notification.
func actionInvoked(serverID uint32, action string) *dbus.Signal {
	return signal("ActionInvoked", serverID, action)
}

// notificationClosed is the signal of a notification that went away.
func notificationClosed(serverID, reason uint32) *dbus.Signal {
	return signal("NotificationClosed", serverID, reason)
}

func TestSendShowsTheNotificationWithItsBodyEscaped(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		body string
		want string
	}{
		{"plain text", "Step 2 is ready for review.", "Step 2 is ready for review."},
		{"an ampersand", "R&D has nothing to publish.", "R&amp;D has nothing to publish."},
		{"angle brackets", "The agent has a question in <api>.", "The agent has a question in &lt;api&gt;."},
		{"an entity", "The review of R&amp;D found changes.", "The review of R&amp;amp;D found changes."},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			f := newFixture(t)

			// The title is plain text, and goes as it is.
			f.notifier.Send("s1", "R&D <login>", test.body)

			f.waitCalls(t, "notify:R&D <login>:"+test.want)
		})
	}
}

func TestWithdrawClosesWhatItShows(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	review := notified("Step 2 is ready for review.")
	permission := notified("Permission requested in api.")

	f.notifier.Send("s1", title, "Step 2 is ready for review.")
	f.notifier.Send("s2", title, "Permission requested in api.")
	f.notifier.Withdraw("s2")
	f.waitCalls(t, review, permission, "close:2")

	// A withdrawn notification is not shown any more: withdrawing it again
	// closes nothing, and neither does the notifier on its way out.
	f.notifier.Withdraw("s2")
	f.notifier.Close()
	f.wantCalls(t, review, permission, "close:2", "close:1")
}

func TestWithdrawOfAnUnknownIDDoesNothing(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	f.notifier.Withdraw("s1")
	f.notifier.Send("s2", title, "Step 2 is ready for review.")
	f.notifier.Withdraw("s3")
	f.notifier.Withdraw("")
	f.notifier.Send("s4", title, "Permission requested in api.")

	// The queue runs in order: once the second notification is shown, every
	// withdrawal before it has run.
	f.waitCalls(t, notified("Step 2 is ready for review."), notified("Permission requested in api."))
}

func TestAClickReachesTheAppOnce(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	body := "The agent is waiting for your reply in tech spec."

	f.notifier.Send("s1", title, body)
	f.waitCalls(t, notified(body))

	f.notifier.HandleSignal(actionInvoked(1, notify.DefaultAction))
	f.waitClicks(t, "s1")

	// A clicked notification is done with: the same click again reaches
	// nobody, and there is nothing left to withdraw.
	f.notifier.HandleSignal(actionInvoked(1, notify.DefaultAction))
	f.notifier.Withdraw("s1")
	f.notifier.Close()
	f.wantClicks(t, "s1")
	f.wantCalls(t, notified(body))
}

func TestADismissedNotificationIsOnlyForgotten(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	body := "The pull request draft of api is ready for your OK."

	f.notifier.Send("s1", title, body)
	f.waitCalls(t, notified(body))

	f.notifier.HandleSignal(notificationClosed(1, closedDismissed))
	f.notifier.Withdraw("s1")
	f.notifier.HandleSignal(actionInvoked(1, notify.DefaultAction))
	f.notifier.Close()

	f.wantClicks(t)
	f.wantCalls(t, notified(body))
}

func TestAClickOnANotificationOnItsWayOutStillReachesTheApp(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	body := "Step 2 is ready for review."

	f.notifier.Send("s1", title, body)
	f.notifier.Withdraw("s1")
	f.waitCalls(t, notified(body), "close:1")

	// The user clicked it before the close reached the server, which reports
	// the click and then the notification going away.
	f.notifier.HandleSignal(actionInvoked(1, notify.DefaultAction))
	f.notifier.HandleSignal(notificationClosed(1, closedDismissed))
	f.waitClicks(t, "s1")

	// Once the server says the close went through, the notification is gone
	// for good.
	f.notifier.Send("s2", title, body)
	f.notifier.Withdraw("s2")
	f.notifier.HandleSignal(notificationClosed(2, closedByCall))
	f.notifier.HandleSignal(actionInvoked(2, notify.DefaultAction))
	f.notifier.Close()
	f.wantClicks(t, "s1")
	f.wantCalls(t, notified(body), "close:1", notified(body), "close:2")
}

func TestOtherActionsAndSignalsAreIgnored(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		signal *dbus.Signal
	}{
		{"another action", actionInvoked(1, "reply")},
		{"a click on a notification of another app", actionInvoked(7, notify.DefaultAction)},
		{"an action without its key", signal("ActionInvoked", uint32(1))},
		{"an action with an id of another type", signal("ActionInvoked", int32(1), notify.DefaultAction)},
		{"an action with a key of another type", signal("ActionInvoked", uint32(1), dbus.MakeVariant(notify.DefaultAction))},
		{"a close without a body", signal("NotificationClosed")},
		{"a close with an id of another type", signal("NotificationClosed", "1", closedDismissed)},
		{"a close of a notification of another app", notificationClosed(7, closedDismissed)},
		{"the activation token of a click", signal("ActivationToken", uint32(1), "token")},
		{"a setting the desktop portal changed", &dbus.Signal{
			Sender: ":1.7",
			Path:   "/org/freedesktop/portal/desktop",
			Name:   "org.freedesktop.portal.Settings.SettingChanged",
			Body:   []any{"org.freedesktop.appearance", "color-scheme", dbus.MakeVariant(uint32(1))},
		}},
		{"a name the bus gave the connection", &dbus.Signal{
			Sender: "org.freedesktop.DBus",
			Path:   "/org/freedesktop/DBus",
			Name:   "org.freedesktop.DBus.NameAcquired",
			Body:   []any{":1.42"},
		}},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			f := newFixture(t)
			body := "Permission requested in api."

			f.notifier.Send("s1", title, body)
			f.waitCalls(t, notified(body))

			f.notifier.HandleSignal(test.signal)
			f.notifier.Close()

			// The notification was still shown, so the notifier withdrew it on
			// its way out, and nobody heard of a click.
			f.wantCalls(t, notified(body), "close:1")
			f.wantClicks(t)
			if logs := f.logs.String(); logs != "" {
				t.Errorf("log = %q, want nothing", logs)
			}
		})
	}
}

func TestAFailedSendOnlyReachesTheLog(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	body := "The session stopped with an error in step 3."
	f.server.failWith(errServer)

	f.notifier.Send("s1", title, body)
	wantFailure(t, f.waitLogged(t, "send notification failed"), "s1")

	// Nothing was shown: there is nothing to withdraw, now or on the way out,
	// and a click on the id the server never gave reaches nobody.
	f.server.failWith(nil)
	f.notifier.Withdraw("s1")
	f.notifier.HandleSignal(actionInvoked(0, notify.DefaultAction))
	f.notifier.Close()
	f.wantCalls(t, notified(body))
	f.wantClicks(t)
}

func TestAFailedWithdrawOnlyReachesTheLog(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	body := "Step 2 is ready for review."

	f.notifier.Send("s1", title, body)
	f.waitCalls(t, notified(body))
	f.server.failWith(errServer)

	f.notifier.Withdraw("s1")
	wantFailure(t, f.waitLogged(t, "withdraw notification failed"), "s1")

	// The notifier does not try again on its way out.
	f.server.failWith(nil)
	f.notifier.Close()
	f.wantCalls(t, notified(body), "close:1")
}

func TestCloseWithdrawsEverythingAndStops(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	review := notified("Step 2 is ready for review.")
	permission := notified("Permission requested in api.")
	question := notified("The agent has a question in web.")

	f.notifier.Send("s1", title, "Step 2 is ready for review.")
	f.notifier.Send("s2", title, "Permission requested in api.")
	f.notifier.Withdraw("s1")
	f.waitCalls(t, review, permission, "close:1")

	// Asked for right before Close, without waiting: it still runs, and goes
	// away with the rest before Close returns, in no particular order.
	f.notifier.Send("s3", title, "The agent has a question in web.")
	f.notifier.Close()
	calls := f.server.recorded()
	sorted := slices.Clone(calls)
	if len(sorted) > 4 {
		slices.Sort(sorted[4:])
	}
	want := []string{review, permission, "close:1", question, "close:2", "close:3"}
	if diff := cmp.Diff(want, sorted); diff != "" {
		t.Fatalf("server calls after Close mismatch (-want +got):\n%s", diff)
	}

	// Nothing reaches the server or the app after it, and closing again
	// returns at once.
	f.notifier.Send("s4", title, "Step 3 is ready for review.")
	f.notifier.Withdraw("s2")
	f.notifier.HandleSignal(actionInvoked(3, notify.DefaultAction))
	f.notifier.Close()
	f.wantClicks(t)
	if diff := cmp.Diff(calls, f.server.recorded()); diff != "" {
		t.Errorf("server calls after a second Close mismatch (-want +got):\n%s", diff)
	}
}

func TestAServerThatStopsAnsweringNeverHoldsUpTheCaller(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	release := f.server.holdNotify()
	// Cleanups run in reverse order: the server answers again before the
	// notifier closes, even when the test fails.
	t.Cleanup(release)

	const sent = 200 // far more than the queue holds
	returned := make(chan struct{})
	go func() {
		defer close(returned)
		for i := range sent {
			f.notifier.Send("s"+strconv.Itoa(i), title, "Step 2 is ready for review.")
		}
	}()
	select {
	case <-returned:
	case <-time.After(pollTimeout):
		t.Fatal("Send waited for a server that does not answer")
	}

	dropped := len(f.logged(t, "notification dropped"))
	if dropped == 0 {
		t.Fatalf("no notification dropped with %d sent to a server that does not answer", sent)
	}

	// What the queue took reaches the server once it answers again.
	release()
	f.notifier.Close()
	shown := 0
	for _, call := range f.server.recorded() {
		if strings.HasPrefix(call, "notify:") {
			shown++
		}
	}
	if shown+dropped != sent {
		t.Errorf("%d shown and %d dropped, want %d in all", shown, dropped, sent)
	}
}

func TestWithoutAChimeANotificationAsksForSilence(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	body := "Step 2 is ready for review."
	f.server.announce(soundingServer, nil)

	f.notifier.Send("s1", title, body)

	// Without a chime there is nothing to hand the server, so it is not even
	// asked what it plays.
	f.waitCalls(t, notified(body))
}

func TestTheAppRingsTheChimeWhenTheServerPlaysNoSound(t *testing.T) {
	t.Parallel()
	f := newChimeFixture(t)
	body := "Step 2 is ready for review."
	f.server.announce(silentServer, nil)

	f.notifier.Send("s1", title, body)

	f.waitCalls(t, "capabilities", notified(body))
	f.waitRings(t, 1)
}

func TestAServerThatPlaysSoundsPlaysTheChimeItself(t *testing.T) {
	t.Parallel()
	f := newChimeFixture(t)
	body := "Step 2 is ready for review."
	f.server.announce(soundingServer, nil)

	f.notifier.Send("s1", title, body)
	f.waitCalls(t, "capabilities", soundNotified(body))

	// The server applies its own do-not-disturb and preferences: the app never
	// plays a second copy.
	f.notifier.Close()
	f.wantRings(t, 0)
}

func TestABurstOfNotificationsSoundsOnce(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		capabilities []string
		sounding     func(body string) string // the call of a notification that makes a sound
		rings        int
	}{
		{"the app rings", silentServer, notified, 2},
		{"the server plays", soundingServer, soundNotified, 0},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			f := newChimeFixture(t)
			f.server.announce(test.capabilities, nil)
			review := "Step 2 is ready for review."
			permission := "Permission requested in api."
			question := "The agent has a question in web."
			draft := "The pull request draft of api is ready for your OK."

			f.notifier.Send("s1", title, review)
			f.notifier.Send("s2", title, permission)
			f.waitCalls(t, "capabilities", test.sounding(review), notified(permission))

			// Still within the window of the first: shown, in silence.
			f.clock.advance(burstWindow - time.Millisecond)
			f.notifier.Send("s3", title, question)
			f.waitCalls(t, "capabilities", test.sounding(review), notified(permission), notified(question))

			// The window counts from the notification that made the sound, not
			// from the last one: this one sounds again.
			f.clock.advance(time.Millisecond)
			f.notifier.Send("s4", title, draft)
			f.waitCalls(t,
				"capabilities", test.sounding(review), notified(permission), notified(question),
				"capabilities", test.sounding(draft),
			)

			f.notifier.Close()
			f.wantRings(t, test.rings)
		})
	}
}

func TestAFailedSendMakesNoSoundAndOpensNoBurst(t *testing.T) {
	t.Parallel()
	f := newChimeFixture(t)
	review := "Step 2 is ready for review."
	permission := "Permission requested in api."
	f.server.announce(silentServer, nil)
	f.server.failWith(errServer)

	f.notifier.Send("s1", title, review)
	wantFailure(t, f.waitLogged(t, "send notification failed"), "s1")
	f.wantRings(t, 0)

	// With the clock where it was, the next notification is still the first to
	// make a sound.
	f.server.failWith(nil)
	f.notifier.Send("s2", title, permission)
	f.waitCalls(t, "capabilities", notified(review), "capabilities", notified(permission))
	f.waitRings(t, 1)
}

func TestUnreadableCapabilitiesLeaveTheChimeToTheApp(t *testing.T) {
	t.Parallel()
	f := newChimeFixture(t)
	body := "Step 2 is ready for review."
	f.server.announce(nil, errServer)

	f.notifier.Send("s1", title, body)

	rec := f.waitLogged(t, "read notification capabilities failed")
	want := map[string]any{"level": "WARN", "err": errServer.Error()}
	got := map[string]any{"level": rec["level"], "err": rec["err"]}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("log record mismatch (-want +got):\n%s", diff)
	}
	f.waitCalls(t, "capabilities", notified(body))
	f.waitRings(t, 1)
}

func TestOnlyASendMakesASound(t *testing.T) {
	t.Parallel()
	f := newChimeFixture(t)
	review := "Step 2 is ready for review."
	permission := "Permission requested in api."
	f.server.announce(silentServer, nil)

	f.notifier.Send("s1", title, review)
	f.waitRings(t, 1)
	f.clock.advance(time.Minute)

	f.notifier.HandleSignal(actionInvoked(1, notify.DefaultAction))
	f.waitClicks(t, "s1")
	f.notifier.Send("s2", title, permission)
	f.notifier.Withdraw("s2")
	f.waitCalls(t, "capabilities", notified(review), "capabilities", notified(permission), "close:2")
	f.notifier.HandleSignal(notificationClosed(2, closedByCall))
	f.notifier.Close()

	// The two sends made the only sounds: the click, the withdraw, the close
	// and Close made none.
	f.wantRings(t, 2)
}
