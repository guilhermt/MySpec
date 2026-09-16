// Package task owns the tasks: their identity, the repository they belong to,
// their artifact folders and the stage they were told to record. It reports
// what changed on disk; deciding what to do about it belongs elsewhere.
package task

import (
	"errors"
	"fmt"
	"path/filepath"
	"regexp"
	"slices"
	"time"
)

// Stage is how far a task has gone in the workflow.
type Stage string

// The stages a task may be in, in either mode.
const (
	StagePRD            Stage = "prd"
	StageTechSpec       Stage = "tech_spec"
	StagePlan           Stage = "plan"
	StageOneShot        Stage = "one_shot"
	StageImplementation Stage = "implementation"
	StagePR             Stage = "pr"
)

// Stages lists every stage a task may be in; the order of each mode is
// Mode.Stages.
var Stages = []Stage{StagePRD, StageTechSpec, StagePlan, StageOneShot, StageImplementation, StagePR}

// ParseStage narrows a stored or received string to a stage.
func ParseStage(value string) (Stage, error) {
	stage := Stage(value)
	if !slices.Contains(Stages, stage) {
		return "", fmt.Errorf("parse stage %q: %w", value, ErrUnknownStage)
	}
	return stage, nil
}

// HasSession reports whether the stage is driven by a conversation of its own.
// Implementation and PR have conversations too, one per step and one for the
// pull request, and neither is the task's.
func (s Stage) HasSession() bool {
	return slices.Contains(Stages, s) && s != StageImplementation && s != StagePR
}

// Task is a unit of work conducted in one repository.
type Task struct {
	ID              string
	RepositoryID    string // the repository it belongs to; chosen at creation, never changed
	Name            string
	Mode            Mode // how the task is conducted; chosen at creation, never changed
	InitialContext  string
	Stage           Stage
	Revisiting      bool
	ArtifactsDir    string
	ArtifactVersion int
	Models          Models      // the model and effort of its stages and steps
	ReviewModes     ReviewModes // who reviews its steps
	ArchivedAt      time.Time   // zero while the task is active
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// Archived reports whether the task left the list for the history.
func (t Task) Archived() bool { return !t.ArchivedAt.IsZero() }

// The names of the artifacts inside the task folder.
const (
	PRDFile      = "PRD.md"
	TechSpecFile = "tech-spec.md"
	OneShotFile  = "one-shot.md"
	StepsDirName = "steps"
)

// PRDPath is the artifact that ends the PRD stage.
func (t Task) PRDPath() string {
	return filepath.Join(t.ArtifactsDir, PRDFile)
}

// TechSpecPath is the artifact that ends the tech spec stage.
func (t Task) TechSpecPath() string {
	return filepath.Join(t.ArtifactsDir, TechSpecFile)
}

// OneShotPath is the artifact that ends the planning of a One-Shot task.
func (t Task) OneShotPath() string {
	return filepath.Join(t.ArtifactsDir, OneShotFile)
}

// StepsDir is the folder the plan stage fills with step files.
func (t Task) StepsDir() string {
	return filepath.Join(t.ArtifactsDir, StepsDirName)
}

// StepPath is the file that is the prompt of a step: the document of a
// One-Shot task, the step file of a Structured one.
func (t Task) StepPath(step Step) string {
	if t.Mode == ModeOneShot {
		return t.OneShotPath()
	}
	return filepath.Join(t.StepsDir(), step.File)
}

// The ways a task fails to be created or found.
var (
	ErrInvalidName       = errors.New("task: invalid name")
	ErrNameTaken         = errors.New("task: name already used in this repository")
	ErrEmptyContext      = errors.New("task: initial context is required")
	ErrNotFound          = errors.New("task: not found")
	ErrUnknownRepository = errors.New("task: unknown repository")
	ErrUnknownStage      = errors.New("task: unknown stage")
	ErrUnknownMode       = errors.New("task: unknown mode")
)

// NameMaxLen bounds the task name.
const NameMaxLen = 64

// namePattern is the branch-safe name rule: lowercase words joined by hyphens.
var namePattern = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

// ValidateName enforces the branch-safe name rule.
func ValidateName(name string) error {
	if len(name) > NameMaxLen || !namePattern.MatchString(name) {
		return ErrInvalidName
	}
	return nil
}

// tasksDirName is the folder of the artifacts of every task inside the data
// directory.
const tasksDirName = "tasks"

// ArtifactsDir is where the artifacts of a task live: one folder per
// repository, as GitHub names it, and one per task, so that two repositories
// never mix tasks of the same name.
func ArtifactsDir(dataDir, owner, name, taskName string) string {
	return filepath.Join(dataDir, tasksDirName, owner, name, taskName)
}
