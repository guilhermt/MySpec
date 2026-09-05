// Package bindings exposes the app services to the frontend and owns the state
// snapshot they exchange.
package bindings

// EventStateChanged carries a whole State every time anything changes.
const EventStateChanged = "state:changed"

// Repo is a git repository inside the open workspace.
type Repo struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

// Workspace is the open folder and the repositories found in it.
type Workspace struct {
	Name  string `json:"name"`
	Path  string `json:"path"`
	Repos []Repo `json:"repos"`
}

// Recent is a workspace the user opened before.
type Recent struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

// Notice is a path the app refused to open.
type Notice struct {
	Path string `json:"path"`
	// Reason is not_found, not_directory, not_readable or last_recent_missing.
	// It stays a string so the generated bindings leave the narrowing to the
	// frontend union types instead of emitting a TypeScript enum.
	Reason string `json:"reason"`
}

// State is everything the interface renders, produced by Go and never derived
// on the frontend.
type State struct {
	Workspace *Workspace `json:"workspace"` // nil on the welcome screen
	Recents   []Recent   `json:"recents"`   // never nil
	// Theme is system, light or dark, a string for the same reason as
	// Notice.Reason.
	Theme      string  `json:"theme"`
	SystemDark bool    `json:"systemDark"`
	Notice     *Notice `json:"notice"`
}
