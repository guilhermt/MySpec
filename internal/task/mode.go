package task

import (
	"fmt"
	"slices"

	"github.com/guilhermt/myspec/internal/models"
)

// Mode is how a task is conducted: the structured flow, or One-Shot.
type Mode string

// The modes a task is conducted in.
const (
	// ModeStructured is a PRD, a tech spec and a plan of steps, each step its
	// own commit.
	ModeStructured Mode = "structured"
	// ModeOneShot is one planning conversation that writes a single document,
	// implemented in one step.
	ModeOneShot Mode = "one_shot"
)

// Modes lists the modes in the order the interface offers them.
var Modes = []Mode{ModeStructured, ModeOneShot}

// ParseMode narrows a received string to a mode.
func ParseMode(value string) (Mode, error) {
	if !slices.Contains(Modes, Mode(value)) {
		return "", fmt.Errorf("parse mode %q: %w", value, ErrUnknownMode)
	}
	return Mode(value), nil
}

// The stages of each mode, in order.
var (
	structuredStages = []Stage{StagePRD, StageTechSpec, StagePlan, StageImplementation, StagePR}
	oneShotStages    = []Stage{StageOneShot, StageImplementation, StagePR}
)

// The stages that carry a choice of model in each mode, in order.
var (
	structuredModelStages = []models.Stage{
		models.PRD, models.TechSpec, models.Plan, models.Implementation, models.StepReview, models.PR, models.PRReview,
	}
	oneShotModelStages = []models.Stage{
		models.OneShot, models.Implementation, models.StepReview, models.PR, models.PRReview,
	}
)

// Stages lists the stages a task of the mode goes through, in order. Any
// value but One-Shot, "" included, is Structured. The slice is shared: the
// caller never changes it.
func (m Mode) Stages() []Stage {
	if m == ModeOneShot {
		return oneShotStages
	}
	return structuredStages
}

// Index is the position of a stage in the mode, -1 for a stage the mode does
// not have.
func (m Mode) Index(s Stage) int {
	return slices.Index(m.Stages(), s)
}

// Next is the stage after s in the mode; ok is false for the last one and for
// a stage the mode does not have.
func (m Mode) Next(s Stage) (next Stage, ok bool) {
	stages := m.Stages()
	index := slices.Index(stages, s)
	if index < 0 || index == len(stages)-1 {
		return "", false
	}
	return stages[index+1], true
}

// From lists s and every stage after it in the mode, in order. A stage the
// mode does not have lists nothing.
func (m Mode) From(s Stage) []Stage {
	stages := m.Stages()
	index := slices.Index(stages, s)
	if index < 0 {
		return nil
	}
	return slices.Clone(stages[index:])
}

// ModelStages lists the stages of the mode that carry a choice of model, in
// order. The slice is shared: the caller never changes it.
func (m Mode) ModelStages() []models.Stage {
	if m == ModeOneShot {
		return oneShotModelStages
	}
	return structuredModelStages
}
