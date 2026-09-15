package task

import (
	"errors"
	"fmt"
	"maps"
	"slices"

	"github.com/guilhermt/myspec/internal/reviewmode"
)

// ReviewModes are who reviews the steps of a task.
type ReviewModes struct {
	// Task is the mode of the task: the default of the app when it was created,
	// and what changed on it since. A step without a mode of its own takes it.
	Task reviewmode.Mode `json:"task"`
	// Steps are the steps that have a mode of their own, by number: the ones the
	// user adjusted before they started, and every step that started, which
	// keeps the mode it started with.
	Steps map[int]reviewmode.Mode `json:"steps,omitempty"`
}

// Default is the mode of the task, which the steps without a mode of their own
// take. A task without a mode, which only a task built by hand lacks, is
// reviewed by the user.
func (m ReviewModes) Default() reviewmode.Mode {
	if m.Task == "" {
		return reviewmode.Manual
	}
	return m.Task
}

// Step is the mode a step runs with: its own when it has one, the one of the
// task otherwise.
func (m ReviewModes) Step(number int) reviewmode.Mode {
	if mode, ok := m.Steps[number]; ok {
		return mode
	}
	return m.Default()
}

// Adjusted reports whether a step has a mode of its own.
func (m ReviewModes) Adjusted(number int) bool {
	_, ok := m.Steps[number]
	return ok
}

// clone copies the map, so that a change never reaches a task a caller holds.
func (m ReviewModes) clone() ReviewModes {
	return ReviewModes{Task: m.Task, Steps: maps.Clone(m.Steps)}
}

// ReviewFallback is why a step that started under the agent review is reviewed
// by the user.
type ReviewFallback string

// Why the review of a step went back to the user.
const (
	FallbackTakenOver       ReviewFallback = "taken_over"       // the user asked for it
	FallbackRoundsExhausted ReviewFallback = "rounds_exhausted" // the last pass still asked for changes
	FallbackNoCommit        ReviewFallback = "commit_failed"    // the commit after a clean report did not happen
)

// reviewFallbacks lists every fallback a step run may carry.
var reviewFallbacks = []ReviewFallback{FallbackTakenOver, FallbackRoundsExhausted, FallbackNoCommit}

// ErrUnknownReviewFallback is a stored value that is not a fallback.
var ErrUnknownReviewFallback = errors.New("task: unknown review fallback")

// ParseReviewFallback narrows a stored string to a fallback. The empty string
// is a step whose mode holds.
func ParseReviewFallback(value string) (ReviewFallback, error) {
	fallback := ReviewFallback(value)
	if fallback != "" && !slices.Contains(reviewFallbacks, fallback) {
		return "", fmt.Errorf("parse review fallback %q: %w", value, ErrUnknownReviewFallback)
	}
	return fallback, nil
}
