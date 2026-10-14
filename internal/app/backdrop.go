package app

import (
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// backdrop paints the colour behind the webview once the webview can take it.
// On Windows Wails paints it through the WebView2 controller, which exists only
// after the webview has started, and a repaint before that crashes the app. A
// colour asked for earlier waits for the runtime of the page to be ready, which
// comes after the webview has started; the window opens with the colour of its
// options meanwhile. The zero value waits.
type backdrop struct {
	mu      sync.Mutex
	paint   func(application.RGBA) // nil until the webview is ready
	pending *application.RGBA      // the last colour asked for before it was
}

// set paints a colour now, or once the webview is ready.
func (b *backdrop) set(colour application.RGBA) {
	b.mu.Lock()
	paint := b.paint
	if paint == nil {
		b.pending = &colour
	}
	b.mu.Unlock()
	// Outside the lock: the repaint waits for the main thread.
	if paint != nil {
		paint(colour)
	}
}

// ready records that the webview takes a repaint from now on and paints the
// colour asked for while it was not. A reload of the page makes it ready again,
// which changes nothing.
func (b *backdrop) ready(paint func(application.RGBA)) {
	b.mu.Lock()
	b.paint = paint
	pending := b.pending
	b.pending = nil
	b.mu.Unlock()
	if pending != nil {
		paint(*pending)
	}
}
