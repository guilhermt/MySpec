package bindings_test

import (
	"testing"

	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/guilhermt/myspec/internal/bindings"
)

// TestRegisterEventsRegistersEveryEvent registers the events and then proves
// each one took: Wails panics when a name is registered twice.
func TestRegisterEventsRegistersEveryEvent(t *testing.T) {
	bindings.RegisterEvents()

	for _, name := range []string{
		bindings.EventStateChanged,
		bindings.EventTranscriptChanged,
		bindings.EventSituationStarted,
		bindings.EventSituationOpen,
	} {
		t.Run(name, func(t *testing.T) {
			defer func() {
				if recover() == nil {
					t.Errorf("registering %s again did not panic, so RegisterEvents did not register it", name)
				}
			}()
			application.RegisterEvent[struct{}](name)
		})
	}
}
