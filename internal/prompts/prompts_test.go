package prompts_test

import (
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/guilhermt/myspec/internal/prompts"
)

// discard is a logger the tests do not assert on.
func discard() *slog.Logger {
	return slog.New(slog.DiscardHandler)
}

// prdPath is where Seed writes the PRD prompt under a data directory.
func prdPath(dataDir string) string {
	return filepath.Join(prompts.Dir(dataDir), "prd.md")
}

// seed runs Seed, failing the test when it errors.
func seed(t *testing.T, dataDir string) {
	t.Helper()

	if err := prompts.Seed(dataDir, discard()); err != nil {
		t.Fatalf("Seed() = %v, want nil", err)
	}
}

// write puts content where Seed would write the PRD prompt.
func write(t *testing.T, dataDir, content string) {
	t.Helper()

	if err := os.MkdirAll(prompts.Dir(dataDir), 0o700); err != nil {
		t.Fatalf("create prompts directory: %v", err)
	}
	if err := os.WriteFile(prdPath(dataDir), []byte(content), 0o600); err != nil {
		t.Fatalf("write prompt: %v", err)
	}
}

// read returns the seeded prompt file.
func read(t *testing.T, dataDir string) string {
	t.Helper()

	content, err := os.ReadFile(prdPath(dataDir))
	if err != nil {
		t.Fatalf("read prompt: %v", err)
	}
	return string(content)
}

func TestDirIsUnderTheDataDirectory(t *testing.T) {
	t.Parallel()

	if got, want := prompts.Dir("/data"), filepath.Join("/data", "prompts"); got != want {
		t.Errorf("Dir() = %q, want %q", got, want)
	}
}

func TestSeedWritesTheDefaultPrompt(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	seed(t, dataDir)

	content := read(t, dataDir)
	for _, want := range []string{"# PRD Creator", "{{prd_path}}", "{{initial_context}}"} {
		if !strings.Contains(content, want) {
			t.Errorf("seeded prompt does not contain %q", want)
		}
	}

	info, err := os.Stat(prdPath(dataDir))
	if err != nil {
		t.Fatalf("stat prompt: %v", err)
	}
	if got, want := info.Mode().Perm(), os.FileMode(0o600); got != want {
		t.Errorf("prompt mode = %v, want %v", got, want)
	}
}

func TestSeedNeverOverwritesAnExistingPrompt(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	const mine = "my own prompt"
	write(t, dataDir, mine)

	seed(t, dataDir)

	if got := read(t, dataDir); got != mine {
		t.Errorf("prompt = %q, want it untouched as %q", got, mine)
	}
}

func TestSeedIsIdempotent(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	seed(t, dataDir)
	first := read(t, dataDir)

	seed(t, dataDir)

	if got := read(t, dataDir); got != first {
		t.Error("the second Seed changed the prompt, want it untouched")
	}
}

func TestSeedFailsWhenTheDirectoryCannotBeCreated(t *testing.T) {
	t.Parallel()

	dataDir := filepath.Join(t.TempDir(), "data")
	if err := os.WriteFile(dataDir, nil, 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}

	if err := prompts.Seed(dataDir, discard()); err == nil {
		t.Error("Seed() = nil, want an error")
	}
}

func TestRenderReplacesEveryPlaceholder(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	write(t, dataDir, "name {{task_name}} dir {{artifacts_dir}} prd {{prd_path}} context {{initial_context}} end")

	got, err := prompts.Render(dataDir, prompts.StagePRD, prompts.Vars{
		TaskName:       "add-login",
		ArtifactsDir:   "/data/tasks/add-login",
		PRDPath:        "/data/tasks/add-login/PRD.md",
		InitialContext: "a login screen",
	})
	if err != nil {
		t.Fatalf("Render() = %v, want nil", err)
	}

	want := "name add-login dir /data/tasks/add-login prd /data/tasks/add-login/PRD.md context a login screen end"
	if got != want {
		t.Errorf("Render() = %q, want %q", got, want)
	}
}

func TestRenderAppendsTheContextWhenThePlaceholderIsGone(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	write(t, dataDir, "write to {{prd_path}}")

	got, err := prompts.Render(dataDir, prompts.StagePRD, prompts.Vars{
		PRDPath:        "/data/PRD.md",
		InitialContext: "a login screen",
	})
	if err != nil {
		t.Fatalf("Render() = %v, want nil", err)
	}

	want := "write to /data/PRD.md\n\n## Initial context\n\na login screen"
	if got != want {
		t.Errorf("Render() = %q, want %q", got, want)
	}
}

func TestRenderTheSeededPromptKeepsNoPlaceholder(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	seed(t, dataDir)

	got, err := prompts.Render(dataDir, prompts.StagePRD, prompts.Vars{
		TaskName:       "add-login",
		ArtifactsDir:   "/data/tasks/add-login",
		PRDPath:        "/data/tasks/add-login/PRD.md",
		InitialContext: "a login screen",
	})
	if err != nil {
		t.Fatalf("Render() = %v, want nil", err)
	}

	if strings.Contains(got, "{{") {
		t.Error("rendered prompt still carries a placeholder")
	}
	for _, want := range []string{"add-login", "/data/tasks/add-login/PRD.md", "a login screen"} {
		if !strings.Contains(got, want) {
			t.Errorf("rendered prompt does not contain %q", want)
		}
	}
}

func TestRenderFailsWhenThePromptIsMissing(t *testing.T) {
	t.Parallel()

	if _, err := prompts.Render(t.TempDir(), prompts.StagePRD, prompts.Vars{}); err == nil {
		t.Error("Render() = nil, want an error")
	}
}
