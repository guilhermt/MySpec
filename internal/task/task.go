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

// The stages a task goes through in this version of the product, in order.
const (
	StagePRD            Stage = "prd"
	StageTechSpec       Stage = "tech_spec"
	StagePlan           Stage = "plan"
	StageImplementation Stage = "implementation"
	StagePR             Stage = "pr"
)

// Stages lists the stages in workflow order.
var Stages = []Stage{StagePRD, StageTechSpec, StagePlan, StageImplementation, StagePR}

// ParseStage narrows a stored or received string to a stage.
func ParseStage(value string) (Stage, error) {
	stage := Stage(value)
	if stage.Index() < 0 {
		return "", fmt.Errorf("parse stage %q: %w", value, ErrUnknownStage)
	}
	return stage, nil
}

// Index is the position of the stage in Stages, -1 for an unknown one.
func (s Stage) Index() int {
	return slices.Index(Stages, s)
}

// Next is the stage after s; ok is false for the last one and for an unknown
// stage.
func (s Stage) Next() (next Stage, ok bool) {
	index := s.Index()
	if index < 0 || index == len(Stages)-1 {
		return "", false
	}
	return Stages[index+1], true
}

// HasSession reports whether the stage is driven by a conversation of its own.
// Implementation and PR have conversations too, one per step and one per
// repository, and neither is the task's.
func (s Stage) HasSession() bool {
	return s.Index() >= 0 && s != StageImplementation && s != StagePR
}

// From lists s and every stage after it, in order. An unknown stage lists
// nothing.
func (s Stage) From() []Stage {
	index := s.Index()
	if index < 0 {
		return nil
	}
	return slices.Clone(Stages[index:])
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
	InitialContext  string
	Stage           Stage
	Revisiting      bool
	ArtifactsDir    string
	ArtifactVersion int
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

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

// StepsDir is the folder the plan stage fills with step files.
func (t Task) StepsDir() string {
	return filepath.Join(t.ArtifactsDir, StepsDirName)
}

// The ways a task fails to be created or found.
var (
	ErrInvalidName  = errors.New("task: invalid name")
	ErrNameTaken    = errors.New("task: name already used in this workspace")
	ErrEmptyContext = errors.New("task: initial context is required")
	ErrNotFound     = errors.New("task: not found")
	ErrRepoOutside  = errors.New("task: repository is not in the workspace")
	ErrUnknownStage = errors.New("task: unknown stage")
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
