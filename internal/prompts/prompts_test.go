package prompts_test

import (
	"errors"
	"fmt"
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
		{prompts.StageTechSpec, []string{"# Technical Specification Creator", "{{tech_spec_path}}", "{{repository}}"}},
		{prompts.StagePlan, []string{"# Step Planner", "{{steps_dir}}", "{{repository}}", "AskUserQuestion"}},
		{prompts.StageOneShot, []string{
			"# One-Shot Planner", "{{one_shot_path}}", "{{repository}}", "{{initial_context}}", "AskUserQuestion",
		}},
		{prompts.StageStepReview, []string{"# Step Review", "{{step_path}}", "{{review_path}}", "git diff HEAD", "status: clean", "AskUserQuestion"}},
		{prompts.StageCommit, []string{"# Commit", "{{what_to_commit}}", "Co-Authored-By", "{{push}}"}},
		{prompts.StagePR, []string{"# Pull Request", "{{draft_path}}", "{{base_branch}}", "gh pr create", "AskUserQuestion"}},
		{prompts.StagePRReview, []string{"# Pull Request Review", "{{review_path}}", "{{pr_url}}", "status: clean", "AskUserQuestion"}},
		{prompts.StageDiscussion, []string{"# Discussion", "{{document_path}}", "{{drafts_path}}", "AskUserQuestion"}},
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
		{prompts.StageOneShot, []string{
			"{{task_name}}", "{{artifacts_dir}}", "{{one_shot_path}}", "{{initial_context}}", "{{repository}}",
		}},
		{prompts.StageStepReview, []string{
			"{{prd_path}}", "{{tech_spec_path}}", "{{step_path}}", "{{repository}}", "{{branch}}", "{{review_path}}",
		}},
		{prompts.StageCommit, []string{"{{what_to_commit}}", "{{push}}"}},
		{prompts.StagePRReview, []string{
			"{{prd_path}}", "{{tech_spec_path}}", "{{repository}}", "{{branch}}",
			"{{base_branch}}", "{{review_path}}", "{{pr_number}}", "{{pr_url}}",
		}},
		{prompts.StageDiscussion, []string{
			"{{task_name}}", "{{artifacts_dir}}", "{{initial_context}}", "{{document_path}}", "{{drafts_path}}",
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

func TestEditableListsThePromptsInWorkflowOrder(t *testing.T) {
	t.Parallel()

	want := []prompts.Stage{
		prompts.StagePRD, prompts.StageTechSpec, prompts.StagePlan, prompts.StageOneShot,
		prompts.StageStepReview, prompts.StageCommit, prompts.StagePR, prompts.StagePRReview,
		prompts.StageDiscussion,
	}
	if diff := cmp.Diff(want, prompts.Editable); diff != "" {
		t.Errorf("Editable mismatch (-want +got):\n%s", diff)
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
// context, which only the PRD and One-Shot planning stages pass, the push
// instruction, which only a commit that belongs to a pull request asks for, the
// reply of the implementer, which only a step review passes, and the document
// of a One-Shot task, which a Structured task does not have.
func everyVar() prompts.Vars {
	return prompts.Vars{
		TaskName:     "add-login",
		ArtifactsDir: "/data/tasks/add-login",
		PRDPath:      "/data/tasks/add-login/PRD.md",
		TechSpecPath: "/data/tasks/add-login/tech-spec.md",
		StepsDir:     "/data/tasks/add-login/steps",
		StepPath:     "/data/tasks/add-login/steps/1-add-the-store.md",
		Repository:   "acme/api",
		Branch:       "add-login",
		BaseBranch:   "origin/dev",
		DraftPath:    "/data/tasks/add-login/pr/draft.md",
		ReviewPath:   "/data/tasks/add-login/pr/review-1.md",
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

// stepReviewVars are the vars the reviewer of a step renders with.
func stepReviewVars() prompts.Vars {
	vars := everyVar()
	vars.ImplementerReply = "I added the store."
	return vars
}

// oneShotPath is the document of the One-Shot task of the fixtures.
const oneShotPath = "/data/tasks/add-login/one-shot.md"

// oneShotPlanningVars are the vars the One-Shot planning renders with.
func oneShotPlanningVars() prompts.Vars {
	vars := everyVar()
	vars.OneShotPath = oneShotPath
	vars.InitialContext = "a login screen"
	return vars
}

// oneShotVars are vars of a One-Shot task, with the reply a step reviewer
// receives.
func oneShotVars() prompts.Vars {
	vars := stepReviewVars()
	vars.OneShotPath = oneShotPath
	return vars
}

// The two files the agent of a discussion writes and the board it runs on.
const (
	documentPath = "/data/discussions/invoices/discussion.md"
	draftsPath   = "/data/discussions/invoices/drafts.md"
	boardSection = "- Board: Platform\n- Repositories: `acme/api`"
)

// discussionVars are the vars a discussion renders with.
func discussionVars() prompts.Vars {
	return prompts.Vars{
		TaskName:       "invoices",
		ArtifactsDir:   "/data/discussions/invoices",
		InitialContext: "the invoices of the month",
		DocumentPath:   documentPath,
		DraftsPath:     draftsPath,
		Board:          boardSection,
	}
}

// oneShotSection is how the section about the document of a One-Shot task
// opens once rendered.
const oneShotSection = "\n\n## One-Shot task\n\nThis task was planned in a single document, `" + oneShotPath + "`, instead of"

func TestRenderTheDefaultPromptsKeepNoPlaceholder(t *testing.T) {
	t.Parallel()

	tests := []struct {
		stage    prompts.Stage
		vars     prompts.Vars
		contains []string
	}{
		{prompts.StagePRD, prdVars(), []string{"add-login", "/data/tasks/add-login/PRD.md", "a login screen"}},
		{prompts.StageTechSpec, everyVar(), []string{"add-login", "/data/tasks/add-login/tech-spec.md", "`acme/api`"}},
		{prompts.StagePlan, everyVar(), []string{"add-login", "/data/tasks/add-login/steps", "`acme/api`"}},
		{prompts.StageOneShot, oneShotPlanningVars(), []string{
			"add-login", "Write the document to `" + oneShotPath + "`", "runs in `acme/api`",
			"## Initial context\n\na login screen\n",
		}},
		{prompts.StageStepReview, stepReviewVars(), []string{
			"/data/tasks/add-login/steps/1-add-the-store.md",
			"/data/tasks/add-login/pr/review-1.md",
			"## The implementer's last response\n\nI added the store.",
		}},
		// The commit prompt carries no planning placeholder: the agent already
		// knows what it changed, and the message must say nothing about the
		// planning. {{what_to_commit}} and {{push}} are the only ones, and the
		// second renders to nothing here.
		{prompts.StageCommit, everyVar(), []string{"# Commit", prompts.StagedInstruction, "Make **one commit**"}},
		{prompts.StagePR, everyVar(), []string{"`acme/api`", "origin/dev", "/data/tasks/add-login/pr/draft.md"}},
		{prompts.StagePRReview, everyVar(), []string{
			"https://github.com/acme/api/pull/42", "`42`", "/data/tasks/add-login/pr/review-1.md",
		}},
		{prompts.StageDiscussion, discussionVars(), []string{
			"invoices", "/data/discussions/invoices", documentPath, draftsPath,
			"## Initial context\n\nthe invoices of the month",
		}},
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

	for _, stage := range []prompts.Stage{
		prompts.StageTechSpec, prompts.StagePlan, prompts.StageStepReview, prompts.StageCommit, prompts.StagePR, prompts.StagePRReview,
	} {
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

func TestThePlanPromptAsksForNoRepositoryHeader(t *testing.T) {
	t.Parallel()

	text := readPrompt(t, t.TempDir(), prompts.StagePlan).Text
	if strings.Contains(text, "repository:") {
		t.Error("the plan prompt still asks the agent for a repository header")
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

func TestRenderAPromptThatCarriesOnlySomePlaceholders(t *testing.T) {
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
		{"pushing", true, "commit " + prompts.StagedInstruction + ". " + prompts.PushInstruction + " done"},
		{"not pushing", false, "commit " + prompts.StagedInstruction + ".  done"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			dataDir := t.TempDir()
			write(t, dataDir, prompts.StageCommit, "commit {{what_to_commit}}. {{push}} done")

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
	write(t, dataDir, prompts.StageCommit, "commit {{what_to_commit}}")

	got, err := prompts.Render(dataDir, prompts.StageCommit, prompts.Vars{Push: true})
	if err != nil {
		t.Fatalf("Render() = %v, want nil", err)
	}

	want := "commit " + prompts.StagedInstruction + "\n\n## Pushing\n\n" + prompts.PushInstruction
	if got != want {
		t.Errorf("Render() = %q, want %q", got, want)
	}
}

func TestRenderAppendsNoPushSectionWhenTheCommitDoesNotPush(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	write(t, dataDir, prompts.StageCommit, "commit {{what_to_commit}}")

	got, err := prompts.Render(dataDir, prompts.StageCommit, prompts.Vars{})
	if err != nil {
		t.Fatalf("Render() = %v, want nil", err)
	}

	if want := "commit " + prompts.StagedInstruction; got != want {
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

func TestRenderReplacesTheWhatToCommitPlaceholder(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		commitAll bool
		want      string
	}{
		{"what is staged", false, "commit " + prompts.StagedInstruction + " done"},
		{"every change", true, "commit " + prompts.AllChangesInstruction + " done"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			dataDir := t.TempDir()
			write(t, dataDir, prompts.StageCommit, "commit {{what_to_commit}} done")

			got, err := prompts.Render(dataDir, prompts.StageCommit, prompts.Vars{CommitAll: test.commitAll})
			if err != nil {
				t.Fatalf("Render() = %v, want nil", err)
			}
			if got != test.want {
				t.Errorf("Render() = %q, want %q", got, test.want)
			}
		})
	}
}

func TestRenderAppendsWhatToCommitWhenThePlaceholderIsGone(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		commitAll   bool
		instruction string
	}{
		{"what is staged", false, prompts.StagedInstruction},
		{"every change", true, prompts.AllChangesInstruction},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			dataDir := t.TempDir()
			write(t, dataDir, prompts.StageCommit, "commit it")

			got, err := prompts.Render(dataDir, prompts.StageCommit, prompts.Vars{CommitAll: test.commitAll})
			if err != nil {
				t.Fatalf("Render() = %v, want nil", err)
			}
			if want := "commit it\n\n## What to commit\n\n" + test.instruction; got != want {
				t.Errorf("Render() = %q, want %q", got, want)
			}
		})
	}
}

func TestRenderAppendsNoWhatToCommitToAnotherPrompt(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	write(t, dataDir, prompts.StagePR, "open the pull request of {{branch}}")

	got, err := prompts.Render(dataDir, prompts.StagePR, prompts.Vars{Branch: "add-login"})
	if err != nil {
		t.Fatalf("Render() = %v, want nil", err)
	}

	if want := "open the pull request of add-login"; got != want {
		t.Errorf("Render() = %q, want %q", got, want)
	}
}

func TestRenderTheDefaultCommitPromptSaysWhatToCommit(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		commitAll bool
		want      string
		unwanted  string
	}{
		{"what is staged", false, prompts.StagedInstruction, prompts.AllChangesInstruction},
		{"every change", true, prompts.AllChangesInstruction, prompts.StagedInstruction},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			vars := everyVar()
			vars.CommitAll = test.commitAll
			got, err := prompts.Render(t.TempDir(), prompts.StageCommit, vars)
			if err != nil {
				t.Fatalf("Render(commit) = %v, want nil", err)
			}

			if !strings.Contains(got, test.want) {
				t.Errorf("the rendered commit prompt does not carry %q", test.want)
			}
			if strings.Contains(got, test.unwanted) {
				t.Errorf("the rendered commit prompt carries %q", test.unwanted)
			}
			// The instruction is in place of the placeholder, not appended after it.
			if count := strings.Count(got, "## What to commit"); count != 1 {
				t.Errorf("the rendered commit prompt has %d what to commit sections, want 1", count)
			}
		})
	}
}

func TestRenderAppendsTheReplyOfTheImplementerToAStepReview(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	write(t, dataDir, prompts.StageStepReview, "review {{step_path}}")

	got, err := prompts.Render(dataDir, prompts.StageStepReview, prompts.Vars{StepPath: "/s.md", ImplementerReply: "Done."})
	if err != nil {
		t.Fatalf("Render() = %v, want nil", err)
	}

	if want := "review /s.md\n\n## The implementer's last response\n\nDone."; got != want {
		t.Errorf("Render() = %q, want %q", got, want)
	}
}

func TestRenderTheDefaultPromptsThatReadTheDocumentsPointToTheOneShotDocument(t *testing.T) {
	t.Parallel()

	tests := []struct {
		stage prompts.Stage
		// ending is how the rendered prompt ends: the note of its kind, and for
		// a step reviewer the reply of the implementer after it.
		ending string
	}{
		{prompts.StageStepReview, "the plan the step follows is that document." +
			"\n\n## The implementer's last response\n\nI added the store."},
		{prompts.StagePR, "Never mention it in the pull request, as with any other document of the process."},
		{prompts.StagePRReview, "a deviation from them is a finding, even when the code works."},
	}

	dataDir := t.TempDir()

	for _, test := range tests {
		got, err := prompts.Render(dataDir, test.stage, oneShotVars())
		if err != nil {
			t.Fatalf("Render(%s) = %v, want nil", test.stage, err)
		}

		if strings.Contains(got, "{{") {
			t.Errorf("rendered %s prompt still carries a placeholder", test.stage)
		}
		for _, unwanted := range []string{
			"/data/tasks/add-login/PRD.md", "/data/tasks/add-login/tech-spec.md", "/data/tasks/add-login/steps/1-add-the-store.md",
		} {
			if strings.Contains(got, unwanted) {
				t.Errorf("rendered %s prompt carries %q, want the One-Shot document in its place", test.stage, unwanted)
			}
		}
		if count := strings.Count(got, oneShotSection); count != 1 {
			t.Errorf("rendered %s prompt has %d One-Shot sections, want 1", test.stage, count)
		}
		if !strings.HasSuffix(got, test.ending) {
			t.Errorf("rendered %s prompt does not end with %q", test.stage, test.ending)
		}
	}
}

func TestRenderPointsThePathsOfTheDocumentsToTheOneShotDocument(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	write(t, dataDir, prompts.StagePRReview, "prd {{prd_path}} spec {{tech_spec_path}} step {{step_path}} doc {{one_shot_path}}")

	got, err := prompts.Render(dataDir, prompts.StagePRReview, oneShotVars())
	if err != nil {
		t.Fatalf("Render() = %v, want nil", err)
	}

	want := "prd " + oneShotPath + " spec " + oneShotPath + " step " + oneShotPath + " doc " + oneShotPath + oneShotSection
	if !strings.HasPrefix(got, want) {
		t.Errorf("Render() = %q, want it to start with %q", got, want)
	}
}

func TestRenderOfAStructuredTaskSaysNothingAboutOneShot(t *testing.T) {
	t.Parallel()

	tests := []struct {
		stage prompts.Stage
		want  string
	}{
		{
			prompts.StageStepReview,
			"prd /data/tasks/add-login/PRD.md spec /data/tasks/add-login/tech-spec.md " +
				"step /data/tasks/add-login/steps/1-add-the-store.md" +
				"\n\n## The implementer's last response\n\nI added the store.",
		},
		{
			prompts.StagePR,
			"prd /data/tasks/add-login/PRD.md spec /data/tasks/add-login/tech-spec.md " +
				"step /data/tasks/add-login/steps/1-add-the-store.md",
		},
		{
			prompts.StagePRReview,
			"prd /data/tasks/add-login/PRD.md spec /data/tasks/add-login/tech-spec.md " +
				"step /data/tasks/add-login/steps/1-add-the-store.md",
		},
	}

	for _, test := range tests {
		t.Run(string(test.stage), func(t *testing.T) {
			t.Parallel()

			dataDir := t.TempDir()
			write(t, dataDir, test.stage, "prd {{prd_path}} spec {{tech_spec_path}} step {{step_path}}")

			got, err := prompts.Render(dataDir, test.stage, stepReviewVars())
			if err != nil {
				t.Fatalf("Render() = %v, want nil", err)
			}
			if got != test.want {
				t.Errorf("Render() = %q, want %q", got, test.want)
			}

			// The default renders no One-Shot section either.
			rendered, err := prompts.Render(t.TempDir(), test.stage, stepReviewVars())
			if err != nil {
				t.Fatalf("Render(default) = %v, want nil", err)
			}
			if strings.Contains(rendered, "One-Shot") {
				t.Errorf("rendered default %s prompt mentions One-Shot in a Structured task", test.stage)
			}
		})
	}
}

func TestRenderAppendsTheOneShotNoteToAnEditWithoutPlaceholders(t *testing.T) {
	t.Parallel()

	tests := []struct {
		stage  prompts.Stage
		ending string
	}{
		{prompts.StageStepReview, "\n\n## The implementer's last response\n\nI added the store."},
		{prompts.StagePR, "document of the process."},
		{prompts.StagePRReview, "even when the code works."},
	}

	for _, test := range tests {
		t.Run(string(test.stage), func(t *testing.T) {
			t.Parallel()

			dataDir := t.TempDir()
			write(t, dataDir, test.stage, "review it")

			got, err := prompts.Render(dataDir, test.stage, oneShotVars())
			if err != nil {
				t.Fatalf("Render() = %v, want nil", err)
			}
			if want := "review it" + oneShotSection; !strings.HasPrefix(got, want) {
				t.Errorf("Render() = %q, want it to start with %q", got, want)
			}
			if !strings.HasSuffix(got, test.ending) {
				t.Errorf("Render() = %q, want it to end with %q", got, test.ending)
			}
		})
	}
}

func TestRenderAppendsNoOneShotNoteToThePromptsThatReadNoDocument(t *testing.T) {
	t.Parallel()

	for _, stage := range []prompts.Stage{prompts.StageCommit, prompts.StageOneShot} {
		t.Run(string(stage), func(t *testing.T) {
			t.Parallel()

			got, err := prompts.Render(t.TempDir(), stage, oneShotPlanningVars())
			if err != nil {
				t.Fatalf("Render(%s) = %v, want nil", stage, err)
			}
			if strings.Contains(got, "## One-Shot task") {
				t.Errorf("rendered %s prompt carries the One-Shot section", stage)
			}

			dataDir := t.TempDir()
			write(t, dataDir, stage, "do it")
			edited, err := prompts.Render(dataDir, stage, oneShotPlanningVars())
			if err != nil {
				t.Fatalf("Render(%s edit) = %v, want nil", stage, err)
			}
			if strings.Contains(edited, "## One-Shot task") {
				t.Errorf("rendered %s edit carries the One-Shot section", stage)
			}
		})
	}
}

// cardVars are the vars the prompt of a pull request of a task created from a
// card renders with.
func cardVars() prompts.Vars {
	vars := everyVar()
	vars.Card = "### Add the login screen\n\n- Issue: acme/api#12\n- Link: https://github.com/acme/api/issues/12\n\nUsers sign in."
	vars.CardReference = "acme/api#12"
	return vars
}

func TestRenderAppendsTheCardToThePromptOfAPullRequest(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	write(t, dataDir, prompts.StagePR, "open it")

	got, err := prompts.Render(dataDir, prompts.StagePR, cardVars())
	if err != nil {
		t.Fatalf("Render() = %v, want nil", err)
	}

	want := "open it\n\n## Card\n\nThis task was created from a card of the team's board. Read the card below before writing " +
		"the description: it says what the change is for, and the description should make sense to someone who " +
		"reads the card. Start the body of the draft with the line `Closes acme/api#12`, alone on its line, " +
		"so that the pull request is linked to the card. Never mention the board otherwise.\n\n" +
		"### Add the login screen\n\n- Issue: acme/api#12\n- Link: https://github.com/acme/api/issues/12\n\nUsers sign in."
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("Render() mismatch (-want +got):\n%s", diff)
	}
}

func TestRenderAppendsNoCardWithoutOne(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	write(t, dataDir, prompts.StagePR, "open it")

	got, err := prompts.Render(dataDir, prompts.StagePR, everyVar())
	if err != nil {
		t.Fatalf("Render() = %v, want nil", err)
	}
	if got != "open it" {
		t.Errorf("Render() = %q, want %q", got, "open it")
	}
}

func TestRenderAppendsTheCardOnlyToThePromptOfAPullRequest(t *testing.T) {
	t.Parallel()

	for _, stage := range []prompts.Stage{prompts.StagePRReview, prompts.StageCommit, prompts.StageStepReview} {
		t.Run(string(stage), func(t *testing.T) {
			t.Parallel()

			got, err := prompts.Render(t.TempDir(), stage, cardVars())
			if err != nil {
				t.Fatalf("Render(%s) = %v, want nil", stage, err)
			}
			if strings.Contains(got, "## Card") {
				t.Errorf("rendered %s prompt carries the card section", stage)
			}
		})
	}
}

// externalReviewVars are the vars the review of a pull request that comes from
// no task renders with.
func externalReviewVars() prompts.Vars {
	vars := everyVar()
	vars.ContextPath = "/data/reviews/pr-42/context.md"
	vars.External, vars.Publish = true, true
	return vars
}

func TestRenderAppendsTheSectionsOfAReviewOfAPullRequestWithoutATaskInOrder(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	write(t, dataDir, prompts.StagePRReview, "review it")
	vars := externalReviewVars()
	vars.Instructions = "Never change a published migration."
	vars.PassInstructions = "Look at the cache."

	got, err := prompts.Render(dataDir, prompts.StagePRReview, vars)
	if err != nil {
		t.Fatalf("Render() = %v, want nil", err)
	}

	headings := []string{
		"\n\n## Pull request without a task\n\n",
		"\n\n## Findings format\n\n",
		"\n\n## Publishing\n\n",
		"\n\n## Review instructions\n\nNever change a published migration.",
		"\n\n## Instructions for this pass\n\nLook at the cache.",
	}
	at := 0
	for _, heading := range headings {
		i := strings.Index(got[at:], heading)
		if i < 0 {
			t.Fatalf("Render() = %q, want %q after what comes before it", got, heading)
		}
		at += i + len(heading)
	}
	if !strings.HasPrefix(got, "review it\n\n## Pull request without a task") {
		t.Errorf("Render() = %q, want it to start with the prompt and the first section", got)
	}
	if !strings.HasSuffix(got, "Look at the cache.") {
		t.Errorf("Render() = %q, want it to end with the instructions of the pass", got)
	}
	if !strings.Contains(got, "`"+vars.ContextPath+"`") {
		t.Errorf("Render() = %q, want it to name the document %s", got, vars.ContextPath)
	}
	if !strings.Contains(got, "the base is `origin/dev`") {
		t.Errorf("Render() = %q, want it to name the base branch", got)
	}
	if strings.Contains(got, "{{") {
		t.Errorf("Render() = %q, want every placeholder of the sections replaced", got)
	}
}

func TestRenderAppendsTheSectionsOfADiscussionInOrder(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	write(t, dataDir, prompts.StageDiscussion, "discuss it")

	got, err := prompts.Render(dataDir, prompts.StageDiscussion, discussionVars())
	if err != nil {
		t.Fatalf("Render() = %v, want nil", err)
	}

	want := "discuss it\n\n## Initial context\n\nthe invoices of the month\n\n## Board\n\n" + boardSection +
		"\n\n## Drafts format\n\nThe app reads `" + draftsPath + "`,"
	if !strings.HasPrefix(got, want) {
		t.Errorf("Render() = %q, want it to start with %q", got, want)
	}
	if strings.Contains(got, "{{") {
		t.Errorf("Render() = %q, want every placeholder of the sections replaced", got)
	}
}

func TestRenderAppendsTheDraftsFormatOfADiscussionWithoutABoard(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	write(t, dataDir, prompts.StageDiscussion, "discuss it")
	vars := discussionVars()
	vars.Board = ""

	got, err := prompts.Render(dataDir, prompts.StageDiscussion, vars)
	if err != nil {
		t.Fatalf("Render() = %v, want nil", err)
	}

	if strings.Contains(got, "## Board") {
		t.Errorf("Render() = %q, want no board section without a board", got)
	}
	if !strings.Contains(got, "\n\n## Drafts format\n\n") {
		t.Errorf("Render() = %q, want the drafts format section all the same", got)
	}
}

func TestRenderAppendsTheDiscussionSectionsOnlyToThePromptOfADiscussion(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	vars := everyVar()
	vars.Board, vars.DraftsPath, vars.DocumentPath = boardSection, draftsPath, documentPath

	for _, stage := range []prompts.Stage{
		prompts.StagePRD, prompts.StageTechSpec, prompts.StagePlan, prompts.StageOneShot,
		prompts.StageStepReview, prompts.StageCommit, prompts.StagePR, prompts.StagePRReview,
	} {
		got, err := prompts.Render(dataDir, stage, vars)
		if err != nil {
			t.Fatalf("Render(%s) = %v, want nil", stage, err)
		}

		for _, unwanted := range []string{"## Board", "## Drafts format"} {
			if strings.Contains(got, unwanted) {
				t.Errorf("rendered %s prompt carries the %q section", stage, unwanted)
			}
		}
	}
}

func TestRenderTheDefaultDiscussionPromptCarriesTheDraftsFormat(t *testing.T) {
	t.Parallel()

	got, err := prompts.Render(t.TempDir(), prompts.StageDiscussion, discussionVars())
	if err != nil {
		t.Fatalf("Render(discussion) = %v, want nil", err)
	}

	for _, want := range []string{
		"\n\n## Board\n\n" + boardSection,
		"## Draft: <id>",
		"`Kind` is `new`, `update` or `epic`.",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("rendered discussion prompt does not contain %q", want)
		}
	}
}

func TestRenderTellsTheReviewOfAPullRequestWhatBecomesOfItsFindings(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		publish      bool
		want, unwant string
	}{
		{"publishing", true, "## Publishing", "## Applying"},
		{"applying", false, "## Applying", "## Publishing"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			vars := externalReviewVars()
			vars.Publish = test.publish

			got, err := prompts.Render(t.TempDir(), prompts.StagePRReview, vars)
			if err != nil {
				t.Fatalf("Render() = %v, want nil", err)
			}
			if !strings.Contains(got, test.want) {
				t.Errorf("Render() = %q, want the section %q", got, test.want)
			}
			if strings.Contains(got, test.unwant) {
				t.Errorf("Render() = %q, want no section %q", got, test.unwant)
			}
		})
	}
}

func TestRenderGivesTheReviewOfThePullRequestOfATaskOnlyTheInstructions(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	write(t, dataDir, prompts.StagePRReview, "review it")
	vars := everyVar()
	vars.Instructions = "Never change a published migration."

	got, err := prompts.Render(dataDir, prompts.StagePRReview, vars)
	if err != nil {
		t.Fatalf("Render() = %v, want nil", err)
	}

	want := "review it\n\n## Review instructions\n\nNever change a published migration."
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("Render() mismatch (-want +got):\n%s", diff)
	}
}

func TestRenderAppendsNoReviewSectionWithoutOne(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	write(t, dataDir, prompts.StagePRReview, "review it")

	got, err := prompts.Render(dataDir, prompts.StagePRReview, everyVar())
	if err != nil {
		t.Fatalf("Render() = %v, want nil", err)
	}
	if got != "review it" {
		t.Errorf("Render() = %q, want %q", got, "review it")
	}
}

func TestRenderAppendsTheReviewSectionsOnlyToThePromptOfAReview(t *testing.T) {
	t.Parallel()

	for _, stage := range []prompts.Stage{prompts.StagePR, prompts.StageCommit, prompts.StageStepReview} {
		t.Run(string(stage), func(t *testing.T) {
			t.Parallel()

			vars := externalReviewVars()
			vars.Instructions = "Never change a published migration."
			vars.PassInstructions = "Look at the cache."

			got, err := prompts.Render(t.TempDir(), stage, vars)
			if err != nil {
				t.Fatalf("Render(%s) = %v, want nil", stage, err)
			}
			for _, heading := range []string{
				"## Pull request without a task", "## Findings format", "## Publishing",
				"## Review instructions", "## Instructions for this pass",
			} {
				if strings.Contains(got, heading) {
					t.Errorf("rendered %s prompt carries the section %q", stage, heading)
				}
			}
		})
	}
}

func TestRenderPointsThePathsOfTheDocumentsToTheContextOfAReview(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	write(t, dataDir, prompts.StagePRReview, "read {{prd_path}} and {{tech_spec_path}}")

	got, err := prompts.Render(dataDir, prompts.StagePRReview, externalReviewVars())
	if err != nil {
		t.Fatalf("Render() = %v, want nil", err)
	}

	path := externalReviewVars().ContextPath
	if !strings.HasPrefix(got, "read "+path+" and "+path) {
		t.Errorf("Render() = %q, want both paths to be %s", got, path)
	}
}

func TestRenderPushesFromADetachedHeadToTheBranchOfThePullRequest(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	write(t, dataDir, prompts.StageCommit, "commit {{what_to_commit}}. {{push}}")

	got, err := prompts.Render(dataDir, prompts.StageCommit, prompts.Vars{Push: true, PushRef: "fix-the-cache"})
	if err != nil {
		t.Fatalf("Render() = %v, want nil", err)
	}

	want := "commit " + prompts.StagedInstruction + ". " + fmt.Sprintf(prompts.DetachedPushInstruction, "fix-the-cache")
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("Render() mismatch (-want +got):\n%s", diff)
	}
	if strings.Contains(got, prompts.PushInstruction) {
		t.Error("the rendered commit prompt carries the instruction of a branch, want the detached one")
	}
}

func TestRenderAppendsTheDetachedPushInstructionWhenThePlaceholderIsGone(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	write(t, dataDir, prompts.StageCommit, "commit {{what_to_commit}}")

	got, err := prompts.Render(dataDir, prompts.StageCommit, prompts.Vars{Push: true, PushRef: "fix-the-cache"})
	if err != nil {
		t.Fatalf("Render() = %v, want nil", err)
	}

	want := "commit " + prompts.StagedInstruction +
		"\n\n## Pushing\n\n" + fmt.Sprintf(prompts.DetachedPushInstruction, "fix-the-cache")
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("Render() mismatch (-want +got):\n%s", diff)
	}
}
