package task

import (
	"log/slog"
	"os"
	"path/filepath"
	"testing"
)

// inspectFixture is a Service reading one task folder under a temp workspace.
func inspectFixture(t *testing.T) (*Service, Task) {
	t.Helper()

	workspace := t.TempDir()
	tk := Task{
		ID:            "task-1",
		WorkspacePath: workspace,
		Name:          "add-login",
		ArtifactsDir:  filepath.Join(t.TempDir(), "add-login"),
	}
	if err := os.MkdirAll(tk.ArtifactsDir, dirPerm); err != nil {
		t.Fatalf("create artifacts directory: %v", err)
	}

	return &Service{
		log:   slog.New(slog.DiscardHandler),
		repos: func() []string { return []string{filepath.Join(workspace, "api")} },
	}, tk
}

// writeArtifact puts content at path, failing the test on error.
func writeArtifact(t *testing.T, path, content string) {
	t.Helper()

	if err := os.MkdirAll(filepath.Dir(path), dirPerm); err != nil {
		t.Fatalf("create directory: %v", err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

func TestInspectAnEmptyFolder(t *testing.T) {
	t.Parallel()

	s, tk := inspectFixture(t)

	got := s.inspect(tk)

	if got.PRD || got.TechSpec || got.Plan.Present {
		t.Errorf("inspect() = %+v, want nothing written", got)
	}
}

func TestInspectReadsTheThreeArtifacts(t *testing.T) {
	t.Parallel()

	s, tk := inspectFixture(t)
	writeArtifact(t, tk.PRDPath(), "# PRD\n")
	writeArtifact(t, tk.TechSpecPath(), "# Tech spec\n")
	writeArtifact(t, filepath.Join(tk.StepsDir(), "1-add-the-store.md"),
		"---\nrepository: api\n---\n\n# Step 1: Add the store\n")

	got := s.inspect(tk)

	if !got.PRD || !got.TechSpec {
		t.Errorf("inspect() = %+v, want the PRD and the tech spec written", got)
	}
	if !got.Plan.Valid() {
		t.Errorf("plan = %+v, want it valid", got.Plan)
	}
	if want := filepath.Join(tk.WorkspacePath, "api"); got.Plan.Steps[0].RepoPath != want {
		t.Errorf("RepoPath = %q, want %q", got.Plan.Steps[0].RepoPath, want)
	}
}

func TestInspectIgnoresAnEmptyFile(t *testing.T) {
	t.Parallel()

	s, tk := inspectFixture(t)
	writeArtifact(t, tk.PRDPath(), "")

	if s.inspect(tk).PRD {
		t.Error("PRD = true, want false for a file with no content")
	}
}
