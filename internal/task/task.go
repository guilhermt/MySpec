// Package task owns the tasks of a workspace: their identity, their artifact
// folders and the stage they were told to record. It reports what changed on
// disk; deciding what to do about it belongs elsewhere.
package task

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
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
// Implementation and PR have conversations too, one per step and one per
// repository, and neither is the task's.
func (s Stage) HasSession() bool {
	return slices.Contains(Stages, s) && s != StageImplementation && s != StagePR
}

// Repository is a repository a task may touch, as the prompts name it and as
// the app finds it.
type Repository struct {
	Rel  string // path relative to the workspace root, the value a step carries
	Path string // absolute
}

// Task is a unit of work created in a workspace.
type Task struct {
	ID              string
	WorkspacePath   string
	Name            string
	RepoPath        string // "" for a root task
	Mode            Mode   // how the task is conducted; chosen at creation, never changed
	InitialContext  string
	Stage           Stage
	Revisiting      bool
	ArtifactsDir    string
	ArtifactVersion int
	Models          Models      // the model and effort of its stages and steps
	ReviewModes     ReviewModes // who reviews its steps
	ArchivedAt      time.Time   // zero while the task is in the workspace
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// Archived reports whether the task left the workspace for the history.
func (t Task) Archived() bool { return !t.ArchivedAt.IsZero() }

// Dir is where the task's sessions run: the repository, or the workspace root.
func (t Task) Dir() string {
	if t.RepoPath != "" {
		return t.RepoPath
	}
	return t.WorkspacePath
}

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
	ErrInvalidName   = errors.New("task: invalid name")
	ErrNameTaken     = errors.New("task: name already used in this workspace")
	ErrEmptyContext  = errors.New("task: initial context is required")
	ErrNotFound      = errors.New("task: not found")
	ErrRepoOutside   = errors.New("task: repository is not in the workspace")
	ErrUnknownStage  = errors.New("task: unknown stage")
	ErrUnknownMode   = errors.New("task: unknown mode")
	ErrOneShotAtRoot = errors.New("task: a One-Shot task is created in a repository")
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

// slugHashLen is how many hex characters of the path digest name the folder.
const slugHashLen = 8

// nonSlug matches every run of characters a folder name may not carry.
var nonSlug = regexp.MustCompile(`[^a-z0-9]+`)

// WorkspaceSlug names the workspace folder inside the data directory:
// "<base>-<8 hex of sha256(path)>".
func WorkspaceSlug(workspacePath string) string {
	base := strings.Trim(nonSlug.ReplaceAllString(strings.ToLower(filepath.Base(workspacePath)), "-"), "-")
	if base == "" {
		base = "workspace"
	}
	sum := sha256.Sum256([]byte(workspacePath))
	return base + "-" + hex.EncodeToString(sum[:])[:slugHashLen]
}

// ArtifactsDir is where a task's artifacts live.
func ArtifactsDir(dataDir, workspacePath, name string) string {
	return filepath.Join(dataDir, "workspaces", WorkspaceSlug(workspacePath), "tasks", name)
}
