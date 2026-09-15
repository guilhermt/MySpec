// Package prompts owns the session prompts: the defaults embedded in the
// binary, the edits the user made to them in the data directory, and their
// rendering. The prompt of a step is the step file itself, which the plan
// writes, so it has no default and no edit here.
package prompts

import (
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"slices"
	"strings"
)

//go:embed defaults/*.md
var defaults embed.FS

// defaultsDir is where the embedded prompts live inside defaults.
const defaultsDir = "defaults"

// Stage names a prompt.
type Stage string

// The stages that have a prompt, in workflow order.
const (
	StagePRD        Stage = "prd"
	StageTechSpec   Stage = "tech_spec"
	StagePlan       Stage = "plan"
	StageStepReview Stage = "step_review"
	StageCommit     Stage = "commit"
	StagePR         Stage = "pr"
	StagePRReview   Stage = "pr_review"
)

// StageStep is the prompt of a step session: the step file itself.
const StageStep Stage = "step"

// Editable are the prompts the user reads and edits in the settings, in
// workflow order. The prompt of a step is a file of the plan, not one of them.
var Editable = []Stage{StagePRD, StageTechSpec, StagePlan, StageStepReview, StageCommit, StagePR, StagePRReview}

// ErrUnknownStage is a prompt the app does not have.
var ErrUnknownStage = errors.New("prompts: unknown prompt")

// ParseStage narrows a received string to an editable prompt.
func ParseStage(value string) (Stage, error) {
	if !slices.Contains(Editable, Stage(value)) {
		return "", fmt.Errorf("parse prompt %q: %w", value, ErrUnknownStage)
	}
	return Stage(value), nil
}

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
	techSpecPathPlaceholder   = "{{tech_spec_path}}"
	stepsDirPlaceholder       = "{{steps_dir}}"
	stepPathPlaceholder       = "{{step_path}}"
	repositoriesPlaceholder   = "{{repositories}}"
	initialContextPlaceholder = "{{initial_context}}"
	repositoryPlaceholder     = "{{repository}}"
	branchPlaceholder         = "{{branch}}"
	baseBranchPlaceholder     = "{{base_branch}}"
	draftPathPlaceholder      = "{{draft_path}}"
	reviewPathPlaceholder     = "{{review_path}}"
	prNumberPlaceholder       = "{{pr_number}}"
	prURLPlaceholder          = "{{pr_url}}"
	whatToCommitPlaceholder   = "{{what_to_commit}}"
	pushPlaceholder           = "{{push}}"
)

// placeholderOrder is every placeholder, in the order the settings list them.
var placeholderOrder = []string{
	taskNamePlaceholder, artifactsDirPlaceholder, prdPathPlaceholder, techSpecPathPlaceholder,
	stepsDirPlaceholder, stepPathPlaceholder, repositoriesPlaceholder, initialContextPlaceholder,
	repositoryPlaceholder, branchPlaceholder, baseBranchPlaceholder, draftPathPlaceholder,
	reviewPathPlaceholder, prNumberPlaceholder, prURLPlaceholder, whatToCommitPlaceholder, pushPlaceholder,
}

// Prompt is a prompt as the settings show it.
type Prompt struct {
	Stage Stage
	Text  string
	// Modified says the user edited the prompt: it no longer follows the
	// default of the app.
	Modified bool
	// Placeholders are the placeholders the default of the prompt uses, in the
	// order of placeholderOrder. What the user's edit kept of them is not what
	// they are: the list is about the default.
	Placeholders []string
}

// PushInstruction is what the app puts in the commit prompt when the commit
// belongs to a pull request that already exists.
const PushInstruction = "After committing, push this branch to `origin`, so the commit reaches the pull request. Push only this branch, and never force-push."

// StagedInstruction is what {{what_to_commit}} becomes when the user reviewed
// the change by staging it.
const StagedInstruction = "Commit **exactly what is staged**. Never run `git add`, `git commit -a`, `git add -p` or anything else that stages files: what the user wants in this commit is already in the index, and whatever is out of it was left out on purpose."

// AllChangesInstruction is what {{what_to_commit}} becomes when an agent
// reviewed the change, and nobody staged anything.
const AllChangesInstruction = "Commit **every change of the worktree**, new files included. Nobody staged anything by hand: stage everything with `git add -A`, then commit. The files the repository ignores stay out, as `git add -A` leaves them."

// contextHeading opens the section Render appends when a prompt has no
// placeholder for the initial context.
const contextHeading = "\n\n## Initial context\n\n"

// pushHeading opens the section Render appends when a prompt has no
// placeholder for the push instruction.
const pushHeading = "\n\n## Pushing\n\n"

// whatToCommitHeading opens the section Render appends when a commit prompt
// has no placeholder for what to commit.
const whatToCommitHeading = "\n\n## What to commit\n\n"

// replyHeading opens the section every step review prompt ends with: what the
// implementer said last.
const replyHeading = "\n\n## The implementer's last response\n\n"

// Dir is the prompts directory inside the data directory.
func Dir(dataDir string) string {
	return filepath.Join(dataDir, "prompts")
}

// pathFor is the file a stage is read from.
func pathFor(dataDir string, stage Stage) string {
	return filepath.Join(Dir(dataDir), string(stage)+".md")
}

// Prepare readies the prompts directory for the edits of the user: it creates
// it and removes every file that is a copy of its default, which is what the
// versions before this one wrote there. Without a file, a prompt follows the
// default of the version that runs.
func Prepare(dataDir string, log *slog.Logger) error {
	dir := Dir(dataDir)
	if err := os.MkdirAll(dir, dirPerm); err != nil {
		return fmt.Errorf("create prompts directory %s: %w", dir, err)
	}

	for _, stage := range Editable {
		edited, ok, err := editedText(dataDir, stage)
		if err != nil {
			return err
		}
		if !ok {
			continue
		}

		embedded, err := defaultText(stage)
		if err != nil {
			return err
		}
		if edited != embedded {
			continue
		}

		path := pathFor(dataDir, stage)
		if err = os.Remove(path); err != nil {
			return fmt.Errorf("remove prompt %s: %w", path, err)
		}
		log.Info("prompt copy of the default removed", "stage", string(stage), "path", path)
	}
	return nil
}

// Read is a prompt as the user edits it: their edit when there is one, the
// default otherwise.
func Read(dataDir string, stage Stage) (Prompt, error) {
	embedded, err := defaultText(stage)
	if err != nil {
		return Prompt{}, err
	}

	edited, ok, err := editedText(dataDir, stage)
	if err != nil {
		return Prompt{}, err
	}

	prompt := Prompt{Stage: stage, Text: embedded, Modified: ok, Placeholders: []string{}}
	if ok {
		prompt.Text = edited
	}
	for _, placeholder := range placeholderOrder {
		if strings.Contains(embedded, placeholder) {
			prompt.Placeholders = append(prompt.Placeholders, placeholder)
		}
	}
	return prompt, nil
}

// Save stores the text of a prompt. The text of the default is no edit: the
// file goes, and the prompt follows the default again.
func Save(dataDir string, stage Stage, text string) (Prompt, error) {
	embedded, err := defaultText(stage)
	if err != nil {
		return Prompt{}, err
	}

	path := pathFor(dataDir, stage)
	if text == embedded {
		if err = os.Remove(path); err != nil && !errors.Is(err, fs.ErrNotExist) {
			return Prompt{}, fmt.Errorf("save prompt %s: %w", path, err)
		}
		return Read(dataDir, stage)
	}

	if err = os.MkdirAll(Dir(dataDir), dirPerm); err != nil {
		return Prompt{}, fmt.Errorf("save prompt %s: %w", path, err)
	}
	if err = os.WriteFile(path, []byte(text), filePerm); err != nil {
		return Prompt{}, fmt.Errorf("save prompt %s: %w", path, err)
	}
	return Read(dataDir, stage)
}

// Restore throws the edit of a prompt away, so that it follows the default.
func Restore(dataDir string, stage Stage) (Prompt, error) {
	path := pathFor(dataDir, stage)
	if err := os.Remove(path); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return Prompt{}, fmt.Errorf("restore prompt %s: %w", path, err)
	}
	return Read(dataDir, stage)
}

// defaultText is the prompt of a stage embedded in the binary.
func defaultText(stage Stage) (string, error) {
	content, err := defaults.ReadFile(defaultsDir + "/" + string(stage) + ".md")
	if err != nil {
		return "", fmt.Errorf("read embedded prompt %s: %w", stage, err)
	}
	return string(content), nil
}

// editedText is the edit of a prompt in the data directory; ok is false when
// the user has none.
func editedText(dataDir string, stage Stage) (text string, ok bool, err error) {
	path := pathFor(dataDir, stage)
	content, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return "", false, nil
		}
		return "", false, fmt.Errorf("read prompt %s: %w", path, err)
	}
	return string(content), true, nil
}

// source is the text a session of a stage starts with: the edit when there is
// one, the default otherwise.
func source(dataDir string, stage Stage) (string, error) {
	text, ok, err := editedText(dataDir, stage)
	if err != nil {
		return "", err
	}
	if ok {
		return text, nil
	}
	return defaultText(stage)
}

// Vars are the placeholders a prompt may use.
type Vars struct {
	TaskName       string
	ArtifactsDir   string
	PRDPath        string
	TechSpecPath   string
	StepsDir       string
	Repositories   []string // paths relative to the session directory
	InitialContext string   // PRD only
	StepPath       string   // StageStep: the file whose content is the prompt; StageStepReview: the step under review

	Repository string // relative path of the repository of a PR session
	Branch     string
	BaseBranch string
	DraftPath  string
	ReviewPath string
	PRNumber   string
	PRURL      string
	Push       bool // the commit of this session goes up to the pull request

	CommitAll        bool   // the commit takes every change of the worktree, not what is staged
	ImplementerReply string // StageStepReview only: what the implementer said last, appended to the prompt
}

// pushInstruction is what {{push}} becomes: the instruction when the commit
// belongs to a pull request, nothing when it does not.
func pushInstruction(push bool) string {
	if push {
		return PushInstruction
	}
	return ""
}

// commitInstruction is what {{what_to_commit}} becomes: every change of the
// worktree after an agent review, what is staged otherwise.
func commitInstruction(all bool) string {
	if all {
		return AllChangesInstruction
	}
	return StagedInstruction
}

// repositoryList renders paths as the Markdown list a prompt shows the agent.
func repositoryList(paths []string) string {
	if len(paths) == 0 {
		return "- (none)"
	}

	items := make([]string, len(paths))
	for i, path := range paths {
		items[i] = "- `" + path + "`"
	}
	return strings.Join(items, "\n")
}

// Render takes the prompt of stage, the edit of the user when there is one and
// the default otherwise, and replaces its placeholders. A prompt the user
// edited may have lost a placeholder, which is not an error. Three things are
// never dropped with one: the initial context the user wrote, what to commit
// and the push instruction are appended to a prompt that has no placeholder
// for them. The prompt of a step reviewer always ends with what the
// implementer said last. StageStep is the exception: the step file is sent
// verbatim.
func Render(dataDir string, stage Stage, vars Vars) (string, error) {
	if stage == StageStep {
		raw, err := os.ReadFile(vars.StepPath)
		if err != nil {
			return "", fmt.Errorf("read step %s: %w", vars.StepPath, err)
		}
		return string(raw), nil
	}

	text, err := source(dataDir, stage)
	if err != nil {
		return "", err
	}

	rendered := strings.NewReplacer(
		taskNamePlaceholder, vars.TaskName,
		artifactsDirPlaceholder, vars.ArtifactsDir,
		prdPathPlaceholder, vars.PRDPath,
		techSpecPathPlaceholder, vars.TechSpecPath,
		stepsDirPlaceholder, vars.StepsDir,
		stepPathPlaceholder, vars.StepPath,
		repositoriesPlaceholder, repositoryList(vars.Repositories),
		initialContextPlaceholder, vars.InitialContext,
		repositoryPlaceholder, vars.Repository,
		branchPlaceholder, vars.Branch,
		baseBranchPlaceholder, vars.BaseBranch,
		draftPathPlaceholder, vars.DraftPath,
		reviewPathPlaceholder, vars.ReviewPath,
		prNumberPlaceholder, vars.PRNumber,
		prURLPlaceholder, vars.PRURL,
		whatToCommitPlaceholder, commitInstruction(vars.CommitAll),
		pushPlaceholder, pushInstruction(vars.Push),
	).Replace(text)

	if !strings.Contains(text, initialContextPlaceholder) && vars.InitialContext != "" {
		rendered += contextHeading + vars.InitialContext
	}
	if stage == StageCommit && !strings.Contains(text, whatToCommitPlaceholder) {
		rendered += whatToCommitHeading + commitInstruction(vars.CommitAll)
	}
	if !strings.Contains(text, pushPlaceholder) && vars.Push {
		rendered += pushHeading + PushInstruction
	}
	// What the implementer said is never a placeholder: the prompt of a
	// reviewer always ends with it.
	if stage == StageStepReview {
		rendered += replyHeading + vars.ImplementerReply
	}
	return rendered, nil
}
