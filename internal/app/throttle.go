package app

import (
	"sync"
	"time"
)

// throttle runs fn at once when it did not run for a window, and otherwise
// once more at the end of the window, however many times it was asked
// meanwhile. A burst costs at most one run per window, and the last request of
// a burst is never lost, until stop.
type throttle struct {
	window time.Duration
	fn     func()
	now    func() time.Time

	mu      sync.Mutex
	last    time.Time
	timer   *time.Timer // the trailing run, nil when none is pending
	stopped bool
	running sync.WaitGroup // the trailing run in progress
}

func newThrottle(window time.Duration, fn func()) *throttle {
	return &throttle{window: window, fn: fn, now: time.Now}
}

// request asks for a run of fn.
func (t *throttle) request() {
	t.mu.Lock()
	if t.stopped || t.timer != nil {
		t.mu.Unlock()
		return
	}
	since := t.now().Sub(t.last)
	if since >= t.window {
		t.last = t.now()
		t.mu.Unlock()
		t.fn()
		return
	}
	t.timer = time.AfterFunc(t.window-since, t.trail)
	t.mu.Unlock()
}

// trail is the run at the end of the window.
func (t *throttle) trail() {
	t.mu.Lock()
	if t.stopped {
		t.mu.Unlock()
		return
	}
	t.timer = nil
	t.last = t.now()
	t.running.Add(1)
	t.mu.Unlock()
	defer t.running.Done()
	t.fn()
}

// stop drops the pending run and every later request, and waits for a trailing
// run already in progress, so that fn never runs after stop returns on its own
// timer.
func (t *throttle) stop() {
	t.mu.Lock()
	t.stopped = true
	if t.timer != nil {
		t.timer.Stop()
		t.timer = nil
	}
	t.mu.Unlock()
	t.running.Wait()
}
