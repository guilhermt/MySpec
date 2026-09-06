// Package prompts owns the session prompts: the defaults embedded in the
// binary, the editable copies in the data directory and their rendering.
package prompts

import (
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
)

//go:embed defaults/*.md
var defaults embed.FS

// defaultsDir is where the embedded prompts live inside defaults.
const defaultsDir = "defaults"

// Stage names a prompt.
type Stage string

// StagePRD is the prompt that runs the PRD stage of a task.
const StagePRD Stage = "prd"

// dirPerm and filePerm keep the prompts private to the user.
const (
	dirPerm  = 0o700
	filePerm = 0o600
)

// The placeholders a prompt may carry.
const (
	taskNamePlaceholder       = "{{task_name}}"
	artifactsDirPlaceholder   = "{{artifacts_dir}}"
	prdPathPlaceholder        = "{{prd_path}}"
	initialContextPlaceholder = "{{initial_context}}"
)

// contextHeading opens the section Render appends when a prompt has no
// placeholder for the initial context.
const contextHeading = "\n\n## Initial context\n\n"

// Dir is the prompts directory inside the data directory.
func Dir(dataDir string) string {
	return filepath.Join(dataDir, "prompts")
}

// pathFor is the file a stage is read from.
func pathFor(dataDir string, stage Stage) string {
	return filepath.Join(Dir(dataDir), string(stage)+".md")
}

// Seed writes every default prompt that does not exist yet into Dir(dataDir).
// Existing files are never touched.
func Seed(dataDir string, log *slog.Logger) error {
	dir := Dir(dataDir)
	if err := os.MkdirAll(dir, dirPerm); err != nil {
		return fmt.Errorf("create prompts directory %s: %w", dir, err)
	}

	entries, err := fs.ReadDir(defaults, defaultsDir)
	if err != nil {
		return fmt.Errorf("read embedded prompts: %w", err)
	}

	for _, entry := range entries {
		name := entry.Name()
		content, err := defaults.ReadFile(defaultsDir + "/" + name)
		if err != nil {
			return fmt.Errorf("read embedded prompt %s: %w", name, err)
		}

		path := filepath.Join(dir, name)
		// O_EXCL is what makes "never overwrite" a single atomic step: an
		// existing file, however it got there, is left alone.
		file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, filePerm)
		if errors.Is(err, fs.ErrExist) {
			continue
		}
		if err != nil {
			return fmt.Errorf("create prompt %s: %w", path, err)
		}

		_, err = file.Write(content)
		if closeErr := file.Close(); err == nil {
			err = closeErr
		}
		if err != nil {
			return fmt.Errorf("write prompt %s: %w", path, err)
		}
		log.Info("prompt seeded", "stage", strings.TrimSuffix(name, ".md"), "path", path)
	}
	return nil
}

// Vars are the placeholders a prompt may use.
type Vars struct {
	TaskName       string
	ArtifactsDir   string
	PRDPath        string
	InitialContext string
}

// Render reads the prompt file for stage and replaces its placeholders. A
// prompt the user edited may have lost a placeholder, which is not an error;
// a prompt without the initial context one gets the context appended, so that
// what the user wrote is never dropped.
func Render(dataDir string, stage Stage, vars Vars) (string, error) {
	path := pathFor(dataDir, stage)
	raw, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read prompt %s: %w", path, err)
	}

	text := string(raw)
	rendered := strings.NewReplacer(
		taskNamePlaceholder, vars.TaskName,
		artifactsDirPlaceholder, vars.ArtifactsDir,
		prdPathPlaceholder, vars.PRDPath,
		initialContextPlaceholder, vars.InitialContext,
	).Replace(text)

	if !strings.Contains(text, initialContextPlaceholder) {
		rendered += contextHeading + vars.InitialContext
	}
	return rendered, nil
}
