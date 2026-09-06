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

// promptPath is where Seed writes a stage prompt under a data directory.
func promptPath(dataDir string, stage prompts.Stage) string {
	return filepath.Join(prompts.Dir(dataDir), string(stage)+".md")
}

// seed runs Seed, failing the test when it errors.
func seed(t *testing.T, dataDir string) {
	t.Helper()

	if err := prompts.Seed(dataDir, discard()); err != nil {
		t.Fatalf("Seed() = %v, want nil", err)
	}
}

// write puts content where Seed would write the prompt of a stage.
func write(t *testing.T, dataDir string, stage prompts.Stage, content string) {
	t.Helper()

	if err := os.MkdirAll(prompts.Dir(dataDir), 0o700); err != nil {
		t.Fatalf("create prompts directory: %v", err)
	}
	if err := os.WriteFile(promptPath(dataDir, stage), []byte(content), 0o600); err != nil {
		t.Fatalf("write prompt: %v", err)
	}
}

// read returns the seeded prompt file of a stage.
func read(t *testing.T, dataDir string, stage prompts.Stage) string {
	t.Helper()

	content, err := os.ReadFile(promptPath(dataDir, stage))
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

func TestSeedWritesTheDefaultPromptOfEveryStage(t *testing.T) {
	t.Parallel()

	tests := []struct {
		stage    prompts.Stage
		contains []string
	}{
		{prompts.StagePRD, []string{"# PRD Creator", "{{prd_path}}", "{{initial_context}}"}},
		{prompts.StageTechSpec, []string{"# Technical Specification Creator", "{{tech_spec_path}}", "{{repositories}}"}},
		{prompts.StagePlan, []string{"# Step Planner", "{{steps_dir}}", "{{repositories}}"}},
	}

	dataDir := t.TempDir()
	seed(t, dataDir)

	for _, test := range tests {
		content := read(t, dataDir, test.stage)
		for _, want := range test.contains {
			if !strings.Contains(content, want) {
				t.Errorf("seeded %s prompt does not contain %q", test.stage, want)
			}
		}

		info, err := os.Stat(promptPath(dataDir, test.stage))
		if err != nil {
			t.Fatalf("stat prompt: %v", err)
		}
		if got, want := info.Mode().Perm(), os.FileMode(0o600); got != want {
			t.Errorf("%s prompt mode = %v, want %v", test.stage, got, want)
		}
	}
}

func TestSeedNeverOverwritesAnExistingPrompt(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	const mine = "my own prompt"
	for _, stage := range []prompts.Stage{prompts.StagePRD, prompts.StageTechSpec, prompts.StagePlan} {
		write(t, dataDir, stage, mine)
	}

	seed(t, dataDir)

	for _, stage := range []prompts.Stage{prompts.StagePRD, prompts.StageTechSpec, prompts.StagePlan} {
		if got := read(t, dataDir, stage); got != mine {
			t.Errorf("%s prompt = %q, want it untouched as %q", stage, got, mine)
		}
	}
}

func TestSeedIsIdempotent(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	seed(t, dataDir)
	first := read(t, dataDir, prompts.StagePRD)

	seed(t, dataDir)

	if got := read(t, dataDir, prompts.StagePRD); got != first {
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
	write(t, dataDir, prompts.StagePRD, "name {{task_name}} dir {{artifacts_dir}} prd {{prd_path}} context {{initial_context}} end")

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
	write(t, dataDir, prompts.StagePRD, "write to {{prd_path}}")

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

// everyVar fills every placeholder a prompt may carry except the initial
// context, which only the PRD stage passes.
func everyVar() prompts.Vars {
	return prompts.Vars{
		TaskName:     "add-login",
		ArtifactsDir: "/data/tasks/add-login",
		PRDPath:      "/data/tasks/add-login/PRD.md",
		TechSpecPath: "/data/tasks/add-login/tech-spec.md",
		StepsDir:     "/data/tasks/add-login/steps",
		Repositories: []string{"api", "web"},
	}
}

// prdVars are the vars the PRD stage renders with.
func prdVars() prompts.Vars {
	vars := everyVar()
	vars.InitialContext = "a login screen"
	return vars
}

func TestRenderTheSeededPromptsKeepNoPlaceholder(t *testing.T) {
	t.Parallel()

	tests := []struct {
		stage    prompts.Stage
		vars     prompts.Vars
		contains []string
	}{
		{prompts.StagePRD, prdVars(), []string{"add-login", "/data/tasks/add-login/PRD.md", "a login screen"}},
		{prompts.StageTechSpec, everyVar(), []string{"add-login", "/data/tasks/add-login/tech-spec.md", "- `api`\n- `web`"}},
		{prompts.StagePlan, everyVar(), []string{"add-login", "/data/tasks/add-login/steps", "- `api`\n- `web`"}},
	}

	dataDir := t.TempDir()
	seed(t, dataDir)

	for _, test := range tests {
		got, err := prompts.Render(dataDir, test.stage, test.vars)
		if err != nil {
			t.Fatalf("Render(%s) = %v, want nil", test.stage, err)
		}

		if strings.Contains(got, "{{") {
			t.Errorf("rendered %s prompt still carries a placeholder", test.stage)
		}
		for _, want := range test.contains {
			if !strings.Contains(got, want) {
				t.Errorf("rendered %s prompt does not contain %q", test.stage, want)
			}
		}
	}
}

func TestRenderTheSeededPromptsOtherThanPRDGetNoInitialContext(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	seed(t, dataDir)

	for _, stage := range []prompts.Stage{prompts.StageTechSpec, prompts.StagePlan} {
		got, err := prompts.Render(dataDir, stage, everyVar())
		if err != nil {
			t.Fatalf("Render(%s) = %v, want nil", stage, err)
		}

		if strings.Contains(got, "## Initial context") {
			t.Errorf("rendered %s prompt carries the initial context section", stage)
		}
	}
}

func TestRenderTurnsTheRepositoriesIntoAList(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		repositories []string
		want         string
	}{
		{"none", nil, "repos: - (none)"},
		{"one", []string{"api"}, "repos: - `api`"},
		{"many", []string{"api", "web/app"}, "repos: - `api`\n- `web/app`"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			dataDir := t.TempDir()
			write(t, dataDir, prompts.StageTechSpec, "repos: {{repositories}}")

			got, err := prompts.Render(dataDir, prompts.StageTechSpec, prompts.Vars{Repositories: test.repositories})
			if err != nil {
				t.Fatalf("Render() = %v, want nil", err)
			}
			if got != test.want {
				t.Errorf("Render() = %q, want %q", got, test.want)
			}
		})
	}
}

func TestRenderAppendsNoContextSectionWhenThereIsNoContext(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	write(t, dataDir, prompts.StagePlan, "steps go to {{steps_dir}}")

	got, err := prompts.Render(dataDir, prompts.StagePlan, prompts.Vars{StepsDir: "/data/steps"})
	if err != nil {
		t.Fatalf("Render() = %v, want nil", err)
	}

	if want := "steps go to /data/steps"; got != want {
		t.Errorf("Render() = %q, want %q", got, want)
	}
}

func TestRenderAPromptThatLostTheRepositories(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	write(t, dataDir, prompts.StagePlan, "steps go to {{steps_dir}}, spec at {{tech_spec_path}}")

	got, err := prompts.Render(dataDir, prompts.StagePlan, everyVar())
	if err != nil {
		t.Fatalf("Render() = %v, want nil", err)
	}

	if want := "steps go to /data/tasks/add-login/steps, spec at /data/tasks/add-login/tech-spec.md"; got != want {
		t.Errorf("Render() = %q, want %q", got, want)
	}
}

func TestRenderFailsWhenThePromptIsMissing(t *testing.T) {
	t.Parallel()

	if _, err := prompts.Render(t.TempDir(), prompts.StagePRD, prompts.Vars{}); err == nil {
		t.Error("Render() = nil, want an error")
	}
}
