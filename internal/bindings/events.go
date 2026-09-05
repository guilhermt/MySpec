package bindings

import "github.com/wailsapp/wails/v3/pkg/application"

// RegisterEvents registers the typed event with Wails so the bindings generator
// emits its data type. internal/app calls it once, before application.New.
func RegisterEvents() {
	application.RegisterEvent[State](EventStateChanged)
}
