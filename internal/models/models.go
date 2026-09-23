// Package models names the models and the effort levels the Claude Code
// sessions run with, as the installed CLI reports them, the stages that carry
// a choice of them, and the defaults a new task starts with.
package models

import (
	"errors"
	"fmt"
	"slices"
)

// Model is a model a session runs with, by the full name Claude Code takes.
type Model string

// The models the factory defaults name, by the full name the reference CLI
// resolves today. They are pinned per release, never resolved against the
// catalog.
const (
	Fable51 Model = "claude-fable-5-1"
	Opus55  Model = "claude-opus-5-5[1m]"
	Sonnet5 Model = "claude-sonnet-5"
)

// Effort is how much a session thinks before it answers.
type Effort string

// The effort levels Claude Code knows today; the catalog says which of them a
// model accepts, and a model may accept none.
const (
	Low    Effort = "low"
	Medium Effort = "medium"
	High   Effort = "high"
	XHigh  Effort = "xhigh"
	Max    Effort = "max"
)

// Choice is a model and an effort level. The effort is "" for a model that
// takes none. A choice is not checked against the catalog: one the catalog
// lacks is kept and shown as unavailable.
type Choice struct {
	Model  Model  `json:"model"`
	Effort Effort `json:"effort"`
}

// Stage is a part of the workflow that carries a choice of its own. The commit
// has none: it runs in the session of a step or of a pull request review.
type Stage string

// The stages that carry a choice, in workflow order.
const (
	PRD            Stage = "prd"
	TechSpec       Stage = "tech_spec"
	Plan           Stage = "plan"
	OneShot        Stage = "one_shot"
	Implementation Stage = "implementation"
	StepReview     Stage = "step_review"
	PR             Stage = "pr"
	PRReview       Stage = "pr_review"
	Discussion     Stage = "discussion"
)

// Stages lists every stage that carries a choice, in the order the settings
// list them; the stages of a task are task.Mode.ModelStages.
var Stages = []Stage{PRD, TechSpec, Plan, OneShot, Implementation, StepReview, PR, PRReview, Discussion}

// Set is a choice for every stage.
type Set map[Stage]Choice

// The ways a received value fails to be a choice.
var (
	ErrEmptyModel   = errors.New("models: empty model")
	ErrUnknownStage = errors.New("models: unknown stage")
)

// ParseChoice narrows a received model and effort to a choice. Only the shape
// is checked: the catalog offers and marks, it never refuses.
func ParseChoice(model, effort string) (Choice, error) {
	if model == "" {
		return Choice{}, fmt.Errorf("parse model %q: %w", model, ErrEmptyModel)
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
		OneShot:        {Model: Fable51, Effort: High},
		Implementation: {Model: Opus55, Effort: High},
		StepReview:     {Model: Opus55, Effort: High},
		PR:             {Model: Opus55, Effort: Medium},
		PRReview:       {Model: Opus55, Effort: High},
		Discussion:     {Model: Fable51, Effort: High},
	}
}

// Complete is a copy of set with a choice for every stage: the choices set has
// whose model is not empty, and the factory one for each stage it lacks or
// holds an empty model for.
func Complete(set Set) Set {
	factory := Factory()
	complete := make(Set, len(Stages))
	for _, stage := range Stages {
		if c, ok := set[stage]; ok && c.Model != "" {
			complete[stage] = c
			continue
		}
		complete[stage] = factory[stage]
	}
	return complete
}
