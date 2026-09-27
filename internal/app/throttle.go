package app

import (
	"sync"
	"time"
)

// throttle runs fn at once when it did not run for a window, and otherwise
// once more at the end of the window, however many times it was asked
// meanwhile. A burst costs at most one run per window, and the last request of
// a burst is never lost.
type throttle struct {
	window time.Duration
	fn     func()
	now    func() time.Time

	mu      sync.Mutex
	last    time.Time
	pending bool
}

func newThrottle(window time.Duration, fn func()) *throttle {
	return &throttle{window: window, fn: fn, now: time.Now}
}

// request asks for a run of fn.
func (t *throttle) request() {
	t.mu.Lock()
	if t.pending {
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
	t.pending = true
	t.mu.Unlock()
	time.AfterFunc(t.window-since, func() {
		t.mu.Lock()
		t.pending = false
		t.last = t.now()
		t.mu.Unlock()
		t.fn()
	})
}
