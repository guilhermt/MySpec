package bindings

import "github.com/wailsapp/wails/v3/pkg/application"

// RegisterEvents registers the typed events with Wails so the bindings
// generator emits their data types. internal/app calls it once, before
// application.New.
func RegisterEvents() {
	application.RegisterEvent[State](EventStateChanged)
	application.RegisterEvent[TranscriptEvent](EventTranscriptChanged)
}
