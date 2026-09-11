// Package models names the models and the effort levels the Claude Code
// sessions run with, the stages that carry a choice of them, and the defaults
// a new task starts with.
package models

import (
	"errors"
	"fmt"
	"slices"
)

// Model is a model a session runs with, by the full name Claude Code takes.
type Model string

// The models the app offers. The full name pins the version the interface
// shows; each of them has a 1M context window of its own.
const (
	Fable51 Model = "claude-fable-5-1"
	Opus5   Model = "claude-opus-5"
	Sonnet5 Model = "claude-sonnet-5"
)

// Models lists the models in the order the interface offers them.
var Models = []Model{Fable51, Opus5, Sonnet5}

// Effort is how much a session thinks before it answers.
type Effort string

// The effort levels, from the least.
const (
	Low    Effort = "low"
	Medium Effort = "medium"
	High   Effort = "high"
	XHigh  Effort = "xhigh"
	Max    Effort = "max"
)

// Efforts lists the effort levels in the order the interface offers them.
var Efforts = []Effort{Low, Medium, High, XHigh, Max}

// Choice is a model and an effort level. Every combination is valid.
type Choice struct {
	Model  Model  `json:"model"`
	Effort Effort `json:"effort"`
}

// Valid reports whether the choice names a model and an effort the app offers.
func (c Choice) Valid() bool {
	return slices.Contains(Models, c.Model) && slices.Contains(Efforts, c.Effort)
}

// Stage is a part of the workflow that carries a choice of its own. The commit
// has none: it runs in the session of a step or of a pull request review.
type Stage string

// The stages that carry a choice, in workflow order.
const (
	PRD            Stage = "prd"
	TechSpec       Stage = "tech_spec"
	Plan           Stage = "plan"
	Implementation Stage = "implementation"
	PR             Stage = "pr"
	PRReview       Stage = "pr_review"
)

// Stages lists the stages in workflow order.
var Stages = []Stage{PRD, TechSpec, Plan, Implementation, PR, PRReview}

// Set is a choice for every stage.
type Set map[Stage]Choice

// The ways a received value fails to be a choice.
var (
	ErrUnknownModel  = errors.New("models: unknown model")
	ErrUnknownEffort = errors.New("models: unknown effort")
	ErrUnknownStage  = errors.New("models: unknown stage")
)

// ParseChoice narrows a received model and effort to a choice.
func ParseChoice(model, effort string) (Choice, error) {
	if !slices.Contains(Models, Model(model)) {
		return Choice{}, fmt.Errorf("parse model %q: %w", model, ErrUnknownModel)
	}
	if !slices.Contains(Efforts, Effort(effort)) {
		return Choice{}, fmt.Errorf("parse effort %q: %w", effort, ErrUnknownEffort)
	}
	return Choice{Model: Model(model), Effort: Effort(effort)}, nil
}

// ParseStage narrows a received string to a stage.
func ParseStage(value string) (Stage, error) {
	if !slices.Contains(Stages, Stage(value)) {
		return "", fmt.Errorf("parse stage %q: %w", value, ErrUnknownStage)
	}
	return Stage(value), nil
}

// Factory is the choice of every stage the app ships with.
func Factory() Set {
	return Set{
		PRD:            {Model: Fable51, Effort: High},
		TechSpec:       {Model: Fable51, Effort: High},
		Plan:           {Model: Fable51, Effort: High},
		Implementation: {Model: Opus5, Effort: High},
		PR:             {Model: Opus5, Effort: Medium},
		PRReview:       {Model: Opus5, Effort: High},
	}
}

// Complete is a copy of set with a choice for every stage: the valid choices
// set has, and the factory one for each stage it lacks or holds an invalid
// choice for.
func Complete(set Set) Set {
	factory := Factory()
	complete := make(Set, len(Stages))
	for _, stage := range Stages {
		if c, ok := set[stage]; ok && c.Valid() {
			complete[stage] = c
			continue
		}
		complete[stage] = factory[stage]
	}
	return complete
}
