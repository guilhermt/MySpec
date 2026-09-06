// Package task owns the tasks of a workspace: their identity, their artifact
// folders and the stage derived from the artifacts on disk.
package task

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

// Stage is how far a task has gone in the workflow.
type Stage string

// The stages a task goes through in this version of the product.
const (
	StagePRD     Stage = "prd"
	StagePRDDone Stage = "prd_done"
)

// Task is a unit of work created in a workspace.
type Task struct {
	ID              string
	WorkspacePath   string
	Name            string
	RepoPath        string // "" for a root task
	InitialContext  string
	Stage           Stage
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

// PRDPath is the artifact that ends the PRD stage.
func (t Task) PRDPath() string {
	return filepath.Join(t.ArtifactsDir, PRDFile)
}

// PRDFile is the name of the PRD artifact inside the task folder.
const PRDFile = "PRD.md"

// The ways a task fails to be created or found.
var (
	ErrInvalidName  = errors.New("task: invalid name")
	ErrNameTaken    = errors.New("task: name already used in this workspace")
	ErrEmptyContext = errors.New("task: initial context is required")
	ErrNotFound     = errors.New("task: not found")
	ErrRepoOutside  = errors.New("task: repository is not in the workspace")
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
