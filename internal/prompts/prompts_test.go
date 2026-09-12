package prompts_test

import (
	"errors"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/prompts"
)

// discard is a logger the tests do not assert on.
func discard() *slog.Logger {
	return slog.New(slog.DiscardHandler)
}

// promptPath is where the edit of a stage prompt lives under a data directory.
func promptPath(dataDir string, stage prompts.Stage) string {
	return filepath.Join(prompts.Dir(dataDir), string(stage)+".md")
}

// prepare runs Prepare, failing the test when it errors.
func prepare(t *testing.T, dataDir string) {
	t.Helper()

	if err := prompts.Prepare(dataDir, discard()); err != nil {
		t.Fatalf("Prepare() = %v, want nil", err)
	}
}

// write puts content where the edit of a stage prompt belongs.
func write(t *testing.T, dataDir string, stage prompts.Stage, content string) {
	t.Helper()

	if err := os.MkdirAll(prompts.Dir(dataDir), 0o700); err != nil {
		t.Fatalf("create prompts directory: %v", err)
	}
	if err := os.WriteFile(promptPath(dataDir, stage), []byte(content), 0o600); err != nil {
		t.Fatalf("write prompt: %v", err)
	}
}

// readPrompt returns the prompt of a stage, failing the test when Read errors.
func readPrompt(t *testing.T, dataDir string, stage prompts.Stage) prompts.Prompt {
	t.Helper()

	prompt, err := prompts.Read(dataDir, stage)
	if err != nil {
		t.Fatalf("Read(%s) = %v, want nil", stage, err)
	}
	return prompt
}

// defaultText is the prompt of a stage as the binary carries it.
func defaultText(t *testing.T, stage prompts.Stage) string {
	t.Helper()

	return readPrompt(t, t.TempDir(), stage).Text
}

func TestDirIsUnderTheDataDirectory(t *testing.T) {
	t.Parallel()

	if got, want := prompts.Dir("/data"), filepath.Join("/data", "prompts"); got != want {
		t.Errorf("Dir() = %q, want %q", got, want)
	}
}

func TestReadGivesTheDefaultOfEveryPrompt(t *testing.T) {
	t.Parallel()

	tests := []struct {
		stage    prompts.Stage
		contains []string
	}{
		{prompts.StagePRD, []string{"# PRD Creator", "{{prd_path}}", "{{initial_context}}"}},
		{prompts.StageTechSpec, []string{"# Technical Specification Creator", "{{tech_spec_path}}", "{{repositories}}"}},
		{prompts.StagePlan, []string{"# Step Planner", "{{steps_dir}}", "{{repositories}}", "AskUserQuestion"}},
		{prompts.StageCommit, []string{"# Commit", "exactly what is staged", "Co-Authored-By", "{{push}}"}},
		{prompts.StagePR, []string{"# Pull Request", "{{draft_path}}", "{{base_branch}}", "gh pr create", "AskUserQuestion"}},
		{prompts.StagePRReview, []string{"# Pull Request Review", "{{review_path}}", "{{pr_url}}", "status: clean", "AskUserQuestion"}},
	}

	dataDir := t.TempDir()

	for _, test := range tests {
		prompt := readPrompt(t, dataDir, test.stage)
		for _, want := range test.contains {
			if !strings.Contains(prompt.Text, want) {
				t.Errorf("default %s prompt does not contain %q", test.stage, want)
			}
		}
		if prompt.Modified {
			t.Errorf("%s prompt Modified = true, want false", test.stage)
		}
	}
}

func TestPrepareKeepsAnEditedPrompt(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	const mine = "my own prompt"
	write(t, dataDir, prompts.StagePRD, mine)

	prepare(t, dataDir)

	prompt := readPrompt(t, dataDir, prompts.StagePRD)
	if prompt.Text != mine {
		t.Errorf("prd prompt = %q, want %q", prompt.Text, mine)
	}
	if !prompt.Modified {
		t.Error("prd prompt Modified = false, want true")
	}
}

func TestPrepareRemovesACopyOfTheDefault(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	write(t, dataDir, prompts.StagePRD, defaultText(t, prompts.StagePRD))

	prepare(t, dataDir)

	if _, err := os.Stat(promptPath(dataDir, prompts.StagePRD)); !errors.Is(err, fs.ErrNotExist) {
		t.Errorf("Stat(prd prompt) = %v, want a missing file", err)
	}
	if readPrompt(t, dataDir, prompts.StagePRD).Modified {
		t.Error("prd prompt Modified = true, want false")
	}
}

func TestPrepareIsIdempotent(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	const mine = "my own prompt"
	write(t, dataDir, prompts.StagePRD, mine)

	prepare(t, dataDir)
	prepare(t, dataDir)

	if got := readPrompt(t, dataDir, prompts.StagePRD).Text; got != mine {
		t.Errorf("prd prompt = %q, want the edit %q", got, mine)
	}
}

func TestPrepareFailsWhenTheDirectoryCannotBeCreated(t *testing.T) {
	t.Parallel()

	dataDir := filepath.Join(t.TempDir(), "data")
	if err := os.WriteFile(dataDir, nil, 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}

	if err := prompts.Prepare(dataDir, discard()); err == nil {
		t.Error("Prepare() = nil, want an error")
	}
}

func TestSaveKeepsAnEdit(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	const mine = "write the PRD of {{task_name}}"

	prompt, err := prompts.Save(dataDir, prompts.StagePRD, mine)
	if err != nil {
		t.Fatalf("Save() = %v, want nil", err)
	}
	if prompt.Text != mine {
		t.Errorf("Save() text = %q, want %q", prompt.Text, mine)
	}
	if !prompt.Modified {
		t.Error("Save() Modified = false, want true")
	}

	info, err := os.Stat(promptPath(dataDir, prompts.StagePRD))
	if err != nil {
		t.Fatalf("stat prompt: %v", err)
	}
	if got, want := info.Mode().Perm(), os.FileMode(0o600); got != want {
		t.Errorf("prd prompt mode = %v, want %v", got, want)
	}

	got, err := prompts.Render(dataDir, prompts.StagePRD, prompts.Vars{TaskName: "add-login"})
	if err != nil {
		t.Fatalf("Render() = %v, want nil", err)
	}
	if want := "write the PRD of add-login"; got != want {
		t.Errorf("Render() = %q, want %q", got, want)
	}
}

func TestSaveOfTheDefaultTextIsNoEdit(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	if _, err := prompts.Save(dataDir, prompts.StagePRD, "my own prompt"); err != nil {
		t.Fatalf("Save() = %v, want nil", err)
	}

	prompt, err := prompts.Save(dataDir, prompts.StagePRD, defaultText(t, prompts.StagePRD))
	if err != nil {
		t.Fatalf("Save() = %v, want nil", err)
	}
	if prompt.Modified {
		t.Error("Save() Modified = true, want false")
	}
	if _, err := os.Stat(promptPath(dataDir, prompts.StagePRD)); !errors.Is(err, fs.ErrNotExist) {
		t.Errorf("Stat(prd prompt) = %v, want a missing file", err)
	}
}

func TestRestoreGoesBackToTheDefault(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	write(t, dataDir, prompts.StagePRD, "my own prompt")

	prompt, err := prompts.Restore(dataDir, prompts.StagePRD)
	if err != nil {
		t.Fatalf("Restore() = %v, want nil", err)
	}
	if want := defaultText(t, prompts.StagePRD); prompt.Text != want {
		t.Error("Restore() text is not the default")
	}
	if prompt.Modified {
		t.Error("Restore() Modified = true, want false")
	}
	if _, err := os.Stat(promptPath(dataDir, prompts.StagePRD)); !errors.Is(err, fs.ErrNotExist) {
		t.Errorf("Stat(prd prompt) = %v, want a missing file", err)
	}
}

func TestRestoreWithoutAnEditChangesNothing(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()

	prompt, err := prompts.Restore(dataDir, prompts.StagePRD)
	if err != nil {
		t.Fatalf("Restore() = %v, want nil", err)
	}
	if want := defaultText(t, prompts.StagePRD); prompt.Text != want {
		t.Error("Restore() text is not the default")
	}
	if prompt.Modified {
		t.Error("Restore() Modified = true, want false")
	}
}

func TestPlaceholdersAreTheOnesTheDefaultUses(t *testing.T) {
	t.Parallel()

	tests := []struct {
		stage prompts.Stage
		want  []string
	}{
		{prompts.StagePRD, []string{"{{task_name}}", "{{artifacts_dir}}", "{{prd_path}}", "{{initial_context}}"}},
		{prompts.StageCommit, []string{"{{push}}"}},
		{prompts.StagePRReview, []string{
			"{{prd_path}}", "{{tech_spec_path}}", "{{repository}}", "{{branch}}",
			"{{base_branch}}", "{{review_path}}", "{{pr_number}}", "{{pr_url}}",
		}},
	}

	dataDir := t.TempDir()

	for _, test := range tests {
		got := readPrompt(t, dataDir, test.stage).Placeholders
		if diff := cmp.Diff(test.want, got); diff != "" {
			t.Errorf("%s placeholders mismatch (-want +got):\n%s", test.stage, diff)
		}
	}

	// The placeholders are those of the default, so an edit that dropped every
	// one of them still lists the same reference.
	write(t, dataDir, prompts.StagePRD, "no placeholder at all")
	want := []string{"{{task_name}}", "{{artifacts_dir}}", "{{prd_path}}", "{{initial_context}}"}
	if diff := cmp.Diff(want, readPrompt(t, dataDir, prompts.StagePRD).Placeholders); diff != "" {
		t.Errorf("prd placeholders after an edit mismatch (-want +got):\n%s", diff)
	}
}

func TestParseStage(t *testing.T) {
	t.Parallel()

	for _, stage := range prompts.Editable {
		got, err := prompts.ParseStage(string(stage))
		if err != nil {
			t.Errorf("ParseStage(%q) = %v, want nil", stage, err)
		}
		if got != stage {
			t.Errorf("ParseStage(%q) = %q, want %q", stage, got, stage)
		}
	}

	for _, value := range []string{"step", "implementation"} {
		if _, err := prompts.ParseStage(value); !errors.Is(err, prompts.ErrUnknownStage) {
			t.Errorf("ParseStage(%q) = %v, want ErrUnknownStage", value, err)
		}
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
// context, which only the PRD stage passes, and the push instruction, which
// only a commit that belongs to a pull request asks for.
func everyVar() prompts.Vars {
	return prompts.Vars{
		TaskName:     "add-login",
		ArtifactsDir: "/data/tasks/add-login",
		PRDPath:      "/data/tasks/add-login/PRD.md",
		TechSpecPath: "/data/tasks/add-login/tech-spec.md",
		StepsDir:     "/data/tasks/add-login/steps",
		Repositories: []string{"api", "web"},
		Repository:   "api",
		Branch:       "add-login",
		BaseBranch:   "origin/dev",
		DraftPath:    "/data/tasks/add-login/pr/api-draft.md",
		ReviewPath:   "/data/tasks/add-login/pr/api-review-1.md",
		PRNumber:     "42",
		PRURL:        "https://github.com/acme/api/pull/42",
	}
}

// prdVars are the vars the PRD stage renders with.
func prdVars() prompts.Vars {
	vars := everyVar()
	vars.InitialContext = "a login screen"
	return vars
}

func TestRenderTheDefaultPromptsKeepNoPlaceholder(t *testing.T) {
	t.Parallel()

	tests := []struct {
		stage    prompts.Stage
		vars     prompts.Vars
		contains []string
	}{
		{prompts.StagePRD, prdVars(), []string{"add-login", "/data/tasks/add-login/PRD.md", "a login screen"}},
		{prompts.StageTechSpec, everyVar(), []string{"add-login", "/data/tasks/add-login/tech-spec.md", "- `api`\n- `web`"}},
		{prompts.StagePlan, everyVar(), []string{"add-login", "/data/tasks/add-login/steps", "- `api`\n- `web`"}},
		// The commit prompt carries no planning placeholder: the agent already
		// knows what it changed, and the message must say nothing about the
		// planning. {{push}} is the only one, and it renders to nothing here.
		{prompts.StageCommit, everyVar(), []string{"# Commit", "Make **one commit**"}},
		{prompts.StagePR, everyVar(), []string{"`api`", "origin/dev", "/data/tasks/add-login/pr/api-draft.md"}},
		{prompts.StagePRReview, everyVar(), []string{"https://github.com/acme/api/pull/42", "`42`", "/data/tasks/add-login/pr/api-review-1.md"}},
	}

	dataDir := t.TempDir()

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

func TestRenderTheDefaultPromptsOtherThanPRDGetNoInitialContext(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()

	for _, stage := range []prompts.Stage{prompts.StageTechSpec, prompts.StagePlan, prompts.StageCommit, prompts.StagePR, prompts.StagePRReview} {
		got, err := prompts.Render(dataDir, stage, everyVar())
		if err != nil {
			t.Fatalf("Render(%s) = %v, want nil", stage, err)
		}

		if strings.Contains(got, "## Initial context") {
			t.Errorf("rendered %s prompt carries the initial context section", stage)
		}
	}
}

func TestTheCommitPromptSaysNothingAboutThePlanning(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()

	got, err := prompts.Render(dataDir, prompts.StageCommit, everyVar())
	if err != nil {
		t.Fatalf("Render(commit) = %v, want nil", err)
	}
	// Every var of the fixture is planning context, and none of it may reach
	// the agent through this prompt.
	for _, unwanted := range []string{"add-login", "/data/tasks/add-login", "`api`"} {
		if strings.Contains(got, unwanted) {
			t.Errorf("rendered commit prompt carries %q, want nothing of the planning", unwanted)
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

func TestRenderReadsTheEditOfAPrompt(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	write(t, dataDir, prompts.StagePRD, "edited {{task_name}}")

	got, err := prompts.Render(dataDir, prompts.StagePRD, prompts.Vars{TaskName: "add-login"})
	if err != nil {
		t.Fatalf("Render() = %v, want nil", err)
	}

	if want := "edited add-login"; got != want {
		t.Errorf("Render() = %q, want %q", got, want)
	}
}

func TestRenderFailsWhenTheEditCannotBeRead(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	if err := os.MkdirAll(promptPath(dataDir, prompts.StagePRD), 0o700); err != nil {
		t.Fatalf("create directory: %v", err)
	}

	if _, err := prompts.Render(dataDir, prompts.StagePRD, prompts.Vars{}); err == nil {
		t.Error("Render() = nil, want an error")
	}
}

func TestRenderOfAStepIsTheStepFileItself(t *testing.T) {
	t.Parallel()

	// The placeholders and the initial context prove that a step file is sent
	// exactly as it is: nothing replaced, nothing appended.
	content := "# Task 1: First step\n\nWrite {{task_name}} in {{artifacts_dir}}.\n"
	path := filepath.Join(t.TempDir(), "1-first.md")
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write step file: %v", err)
	}

	vars := prdVars()
	vars.StepPath = path
	got, err := prompts.Render(t.TempDir(), prompts.StageStep, vars)
	if err != nil {
		t.Fatalf("Render() = %v, want nil", err)
	}

	if got != content {
		t.Errorf("Render() = %q, want %q", got, content)
	}
}

func TestRenderOfAStepFailsWhenTheFileIsMissing(t *testing.T) {
	t.Parallel()

	vars := prompts.Vars{StepPath: filepath.Join(t.TempDir(), "gone.md")}
	if _, err := prompts.Render(t.TempDir(), prompts.StageStep, vars); err == nil {
		t.Error("Render() = nil, want an error")
	}
}

func TestRenderReplacesThePushPlaceholder(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		push bool
		want string
	}{
		{"pushing", true, "commit it. " + prompts.PushInstruction + " done"},
		{"not pushing", false, "commit it.  done"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			dataDir := t.TempDir()
			write(t, dataDir, prompts.StageCommit, "commit it. {{push}} done")

			got, err := prompts.Render(dataDir, prompts.StageCommit, prompts.Vars{Push: test.push})
			if err != nil {
				t.Fatalf("Render() = %v, want nil", err)
			}
			if got != test.want {
				t.Errorf("Render() = %q, want %q", got, test.want)
			}
		})
	}
}

func TestRenderAppendsThePushInstructionWhenThePlaceholderIsGone(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	write(t, dataDir, prompts.StageCommit, "commit what is staged")

	got, err := prompts.Render(dataDir, prompts.StageCommit, prompts.Vars{Push: true})
	if err != nil {
		t.Fatalf("Render() = %v, want nil", err)
	}

	want := "commit what is staged\n\n## Pushing\n\n" + prompts.PushInstruction
	if got != want {
		t.Errorf("Render() = %q, want %q", got, want)
	}
}

func TestRenderAppendsNoPushSectionWhenTheCommitDoesNotPush(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	write(t, dataDir, prompts.StageCommit, "commit what is staged")

	got, err := prompts.Render(dataDir, prompts.StageCommit, prompts.Vars{})
	if err != nil {
		t.Fatalf("Render() = %v, want nil", err)
	}

	if want := "commit what is staged"; got != want {
		t.Errorf("Render() = %q, want %q", got, want)
	}
}

func TestRenderTheDefaultCommitPromptCarriesThePushInstruction(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()

	vars := everyVar()
	vars.Push = true
	got, err := prompts.Render(dataDir, prompts.StageCommit, vars)
	if err != nil {
		t.Fatalf("Render(commit) = %v, want nil", err)
	}

	if !strings.Contains(got, prompts.PushInstruction) {
		t.Error("the rendered commit prompt does not carry the push instruction")
	}
	// The instruction is in place of the placeholder, not appended after it.
	if strings.Contains(got, "## Pushing\n\n"+prompts.PushInstruction+"\n\n## Pushing") {
		t.Error("the rendered commit prompt carries the push instruction twice")
	}
}

func TestRenderTheDefaultCommitPromptWithoutPushSaysNothingAboutPushing(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()

	got, err := prompts.Render(dataDir, prompts.StageCommit, everyVar())
	if err != nil {
		t.Fatalf("Render(commit) = %v, want nil", err)
	}

	if strings.Contains(got, prompts.PushInstruction) {
		t.Error("the rendered commit prompt carries the push instruction, want nothing about pushing")
	}
}
