package task

import (
	"maps"

	"github.com/guilhermt/myspec/internal/models"
)

// Models are the model and effort the sessions of a task run with.
type Models struct {
	// Stages is the choice of every stage: the defaults of the app when the task
	// was created, with what the user adjusted, and what changed on it since.
	Stages models.Set `json:"stages"`
	// Steps are the steps that have a choice of their own, by number: the ones
	// the user adjusted before they started, and every step that started, which
	// keeps the choice it started with.
	Steps map[int]models.Choice `json:"steps,omitempty"`
}

// Stage is the choice of a stage. A task without one for it, which only a task
// built by hand lacks, has the factory choice.
func (m Models) Stage(stage models.Stage) models.Choice {
	if c, ok := m.Stages[stage]; ok {
		return c
	}
	return models.Factory()[stage]
}

// Step is the choice a step runs with: its own when it has one, the one of
// implementation otherwise.
func (m Models) Step(number int) models.Choice {
	if c, ok := m.Steps[number]; ok {
		return c
	}
	return m.Stage(models.Implementation)
}

// Adjusted reports whether a step has a choice of its own.
func (m Models) Adjusted(number int) bool {
	_, ok := m.Steps[number]
	return ok
}

// clone copies the maps, so that a change never reaches a task a caller holds.
func (m Models) clone() Models {
	return Models{Stages: maps.Clone(m.Stages), Steps: maps.Clone(m.Steps)}
}
