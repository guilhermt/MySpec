// Package reviewmode names who reviews the steps of a task, the user or an
// agent, and keeps the mode a new task starts with.
package reviewmode

import (
	"errors"
	"fmt"
	"slices"
)

// Mode is who reviews a step.
type Mode string

// The review modes.
const (
	// Manual is the user: every changed file is staged in the editor, and the
	// step is approved at 100%.
	Manual Mode = "manual"
	// Agent is an agent that reviews the step with its implementer; the app has
	// the step committed once a report comes clean.
	Agent Mode = "agent"
)

// Modes lists the modes in the order the interface offers them.
var Modes = []Mode{Manual, Agent}

// ErrUnknownMode is a received value that is not a review mode.
var ErrUnknownMode = errors.New("reviewmode: unknown mode")

// ParseMode narrows a received string to a mode.
func ParseMode(value string) (Mode, error) {
	if !slices.Contains(Modes, Mode(value)) {
		return "", fmt.Errorf("parse review mode %q: %w", value, ErrUnknownMode)
	}
	return Mode(value), nil
}
