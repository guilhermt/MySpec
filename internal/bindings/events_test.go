package bindings_test

import (
	"testing"

	"github.com/guilhermt/myspec/internal/bindings"
)

// TestRegisterEventsRegistersTheStateEvent registers the event and then proves
// it took: Wails panics when a name is registered twice.
func TestRegisterEventsRegistersTheStateEvent(t *testing.T) {
	bindings.RegisterEvents()

	defer func() {
		if recover() == nil {
			t.Error("registering the event twice did not panic, so the first call did nothing")
		}
	}()
	bindings.RegisterEvents()
}
