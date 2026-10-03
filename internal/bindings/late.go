package bindings

import (
	"errors"
	"sync/atomic"
)

// startingMessage is what a call answers before the app is ready, as the
// interface shows it.
const startingMessage = "MySpec is starting."

// late is how a binding service registered with Wails before the app is ready
// reaches the one built when the startup ends. A service New builds is ready
// already; a placeholder waits until it is bound. Wails calls the methods from
// goroutines of its own, so the bound service is an atomic pointer.
type late[T any] struct {
	waiting bool
	bound   atomic.Pointer[T]
}

// resolve is the service a call runs on: self when it was built ready, the bound
// one for a placeholder, or an error before the app is ready.
func (l *late[T]) resolve(self *T) (*T, error) {
	if !l.waiting {
		return self, nil
	}
	if b := l.bound.Load(); b != nil {
		return b, nil
	}
	return nil, errors.New(startingMessage) //nolint:staticcheck // ST1005: the interface shows the sentence as it is
}
