package toast

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"runtime"
	"strconv"
	"sync"

	"golang.org/x/sys/windows"
)

// notificationSettingEnabled is NotificationSetting.Enabled: the toasts of the
// app may show.
const notificationSettingEnabled = 0

// Deps are what a Toaster needs from the outside.
type Deps struct {
	AppID       string          // the AppUserModelID the toasts carry
	DisplayName string          // the name the toasts show
	IconPath    string          // the icon the toasts show; empty shows none
	OnActivate  func(id uint32) // receives the id of a toast the user clicked
	Log         *slog.Logger
}

// Toaster shows the toasts of the app. Every WinRT call runs on one OS thread
// of its own, in the multithreaded apartment, which also keeps the activator
// registered for as long as the Toaster lives.
type Toaster struct {
	appID     string
	log       *slog.Logger
	calls     chan func()   // what runs on the apartment thread
	done      chan struct{} // closed once the apartment thread is gone
	closeOnce sync.Once
	closeErr  error

	// Owned by the apartment thread.
	statics  *object // IToastNotificationManagerStatics
	notifier *object // IToastNotifier of AppID
	history  *object // IToastNotificationHistory
	cookie   uint32  // of the registered class object
	next     uint32  // the id of the last toast shown
}

// New registers the app with the notification platform and starts a Toaster.
func New(deps Deps) (*Toaster, error) {
	log := deps.Log
	if log == nil {
		log = slog.New(slog.DiscardHandler)
	}
	t := &Toaster{
		appID: deps.AppID,
		log:   log,
		calls: make(chan func()),
		done:  make(chan struct{}),
	}

	ready := make(chan error, 1)
	go t.run(ready)
	if err := <-ready; err != nil {
		return nil, fmt.Errorf("start toasts: %w", err)
	}

	err := t.do(context.Background(), func() error { return t.start(deps) })
	if err != nil {
		_ = t.do(context.Background(), func() error { return t.shutdown(false) })
		t.stop()
		return nil, fmt.Errorf("start toasts: %w", err)
	}
	return t, nil
}

// run is the apartment thread: it enters the multithreaded apartment, runs what
// arrives in calls until the channel closes, and leaves. It never unlocks its
// thread, which dies with it.
func (t *Toaster) run(ready chan<- error) {
	runtime.LockOSThread()
	defer close(t.done)

	if err := windows.CoInitializeEx(0, windows.COINIT_MULTITHREADED); err != nil {
		ready <- fmt.Errorf("enter apartment: %w", err)
		return
	}
	defer windows.CoUninitialize()
	ready <- nil

	for f := range t.calls {
		f()
	}
}

// stop ends the apartment thread and waits for it.
func (t *Toaster) stop() {
	close(t.calls)
	<-t.done
}

// do runs f on the apartment thread and waits for it, or for ctx.
func (t *Toaster) do(ctx context.Context, f func() error) error {
	res := make(chan error, 1)
	select {
	case t.calls <- func() { res <- f() }:
	case <-ctx.Done():
		return ctx.Err()
	}
	select {
	case err := <-res:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
}

// start registers the identity of the app, gets its notifier and history, and
// registers the activator. It runs on the apartment thread.
func (t *Toaster) start(deps Deps) error {
	if err := register(deps.AppID, deps.DisplayName, deps.IconPath); err != nil {
		return err
	}
	if err := t.open(); err != nil {
		return err
	}
	if err := clearHistory(t.history, t.appID); err != nil {
		t.log.Warn("clear notifications failed", "err", err)
	}
	cookie, err := registerActivator(deps.OnActivate)
	if err != nil {
		return err
	}
	t.cookie = cookie
	return nil
}

// open gets the manager of the toasts and, from it, the notifier of the app and
// the history.
func (t *Toaster) open() error {
	statics, err := activationFactory(classToastManager, &iidToastManagerStatics)
	if err != nil {
		return err
	}
	t.statics = statics

	notifier, err := createToastNotifier(statics, t.appID)
	if err != nil {
		return fmt.Errorf("create notifier: %w", err)
	}
	t.notifier = notifier

	statics2, err := activationFactory(classToastManager, &iidToastManagerStatics2)
	if err != nil {
		return err
	}
	defer release(statics2)

	hist, err := getHistory(statics2)
	if err != nil {
		return fmt.Errorf("get history: %w", err)
	}
	t.history = hist
	return nil
}

// shutdown releases what the apartment holds, withdrawing the toasts of the app
// first when clear is set. It runs on the apartment thread.
func (t *Toaster) shutdown(clear bool) error {
	var errs []error
	if clear && t.history != nil {
		if err := clearHistory(t.history, t.appID); err != nil {
			errs = append(errs, fmt.Errorf("clear notifications: %w", err))
		}
	}
	if t.cookie != 0 {
		if err := revokeActivator(t.cookie); err != nil {
			errs = append(errs, err)
		}
		t.cookie = 0
	}
	release(t.history)
	release(t.notifier)
	release(t.statics)
	t.history, t.notifier, t.statics = nil, nil, nil
	return errors.Join(errs...)
}

// Capabilities reports none: Windows plays no sound of the app, and the
// notifier rings the chime itself.
func (t *Toaster) Capabilities() ([]string, error) {
	return nil, nil
}

// Notify shows a toast and returns the id it carries. The toast is always
// silent, so sound is ignored.
func (t *Toaster) Notify(summary, body string, _ bool) (uint32, error) {
	var id uint32
	err := t.do(context.Background(), func() (err error) {
		id, err = t.show(summary, body)
		return err
	})
	return id, err
}

// show runs on the apartment thread.
func (t *Toaster) show(summary, body string) (uint32, error) {
	s, err := setting(t.notifier)
	if err != nil {
		return 0, fmt.Errorf("read notification setting: %w", err)
	}
	if s != notificationSettingEnabled {
		return 0, fmt.Errorf("notifications are off in Windows: setting %d", s)
	}

	t.next++
	id := t.next
	xml, err := toastXML(id, summary, body)
	if err != nil {
		return 0, err
	}

	doc, err := activateInstance(classXMLDocument)
	if err != nil {
		return 0, err
	}
	defer release(doc)
	docIO, err := queryInterface(doc, &iidXMLDocumentIO)
	if err != nil {
		return 0, fmt.Errorf("xml document io: %w", err)
	}
	defer release(docIO)
	if err := loadXML(docIO, xml); err != nil {
		return 0, fmt.Errorf("load toast xml: %w", err)
	}
	xmlDoc, err := queryInterface(doc, &iidXMLDocument)
	if err != nil {
		return 0, fmt.Errorf("xml document: %w", err)
	}
	defer release(xmlDoc)

	toastFactory, err := activationFactory(classToast, &iidToastFactory)
	if err != nil {
		return 0, err
	}
	defer release(toastFactory)
	toast, err := createToastNotification(toastFactory, xmlDoc)
	if err != nil {
		return 0, fmt.Errorf("create toast: %w", err)
	}
	defer release(toast)

	toast2, err := queryInterface(toast, &iidToast2)
	if err != nil {
		return 0, fmt.Errorf("toast tag interface: %w", err)
	}
	defer release(toast2)
	if err := putTag(toast2, strconv.FormatUint(uint64(id), 10)); err != nil {
		return 0, fmt.Errorf("set toast tag: %w", err)
	}
	if err := putGroup(toast2, group); err != nil {
		return 0, fmt.Errorf("set toast group: %w", err)
	}

	if err := show(t.notifier, toast); err != nil {
		return 0, fmt.Errorf("show toast: %w", err)
	}
	return id, nil
}

// CloseNotification withdraws the toast the id names.
func (t *Toaster) CloseNotification(id uint32) error {
	err := t.do(context.Background(), func() error {
		return removeGroupedTag(t.history, strconv.FormatUint(uint64(id), 10), group, t.appID)
	})
	if err != nil {
		return fmt.Errorf("withdraw toast %d: %w", id, err)
	}
	return nil
}

// Quiet reports whether the chime stays quiet: Windows would show no banner, or
// none with sound, for a toast of the app now.
func (t *Toaster) Quiet(ctx context.Context) bool {
	mode := t.mode(ctx)
	r := readSettings(t.appID, t.log)
	c := r.conditions(mode)
	t.log.Debug("toast conditions", "mode", int(c.Mode), "banner", c.Banner, "app_sound", c.AppSound, "sounds", c.Sounds)
	return c.Silenced()
}

// mode reads the notification mode of Windows, or ModeUnknown where it has none.
func (t *Toaster) mode(ctx context.Context) Mode {
	mode := ModeUnknown
	err := t.do(ctx, func() error {
		m, err := t.readMode()
		if err == nil {
			mode = Mode(m)
		}
		return err
	})
	if err != nil {
		if !errors.Is(err, errNoInterface) {
			t.log.Debug("notification mode unknown", "err", err)
		}
		return ModeUnknown
	}
	return mode
}

// readMode runs on the apartment thread.
func (t *Toaster) readMode() (int32, error) {
	statics5, err := activationFactory(classToastManager, &iidToastManagerStatics5)
	if err != nil {
		return 0, err
	}
	defer release(statics5)
	manager, err := defaultManager(statics5)
	if err != nil {
		return 0, err
	}
	defer release(manager)
	user3, err := queryInterface(manager, &iidToastManagerForUser3)
	if err != nil {
		return 0, err
	}
	defer release(user3)
	return notificationMode(user3)
}

// Close withdraws the toasts of the app and stops the Toaster. Calls after the
// first return its result.
func (t *Toaster) Close() error {
	t.closeOnce.Do(func() {
		err := t.do(context.Background(), func() error { return t.shutdown(true) })
		t.stop()
		if err != nil {
			t.closeErr = fmt.Errorf("close toasts: %w", err)
		}
	})
	return t.closeErr
}
