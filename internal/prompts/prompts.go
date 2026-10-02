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

	"github.com/guilhermt/myspec/internal/gh"
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
	StageOneShot    Stage = "one_shot"
	StageStepReview Stage = "step_review"
	StageCommit     Stage = "commit"
	StagePR         Stage = "pr"
	StagePRReview   Stage = "pr_review"
	StageDiscussion Stage = "discussion"
)

// StageStep is the prompt of a step session: the step file itself.
const StageStep Stage = "step"

// Editable are the prompts the user reads and edits in the settings, in
// workflow order. The prompt of a step is a file of the plan, not one of them.
var Editable = []Stage{
	StagePRD, StageTechSpec, StagePlan, StageOneShot, StageStepReview, StageCommit, StagePR, StagePRReview,
	StageDiscussion,
}

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
	oneShotPathPlaceholder    = "{{one_shot_path}}"
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
	documentPathPlaceholder   = "{{document_path}}"
	draftsPathPlaceholder     = "{{drafts_path}}"
)

// placeholderOrder is every placeholder, in the order the settings list them.
var placeholderOrder = []string{
	taskNamePlaceholder, artifactsDirPlaceholder, prdPathPlaceholder, techSpecPathPlaceholder,
	stepsDirPlaceholder, stepPathPlaceholder, oneShotPathPlaceholder,
	initialContextPlaceholder, repositoryPlaceholder, branchPlaceholder, baseBranchPlaceholder,
	draftPathPlaceholder, reviewPathPlaceholder, prNumberPlaceholder, prURLPlaceholder,
	whatToCommitPlaceholder, pushPlaceholder, documentPathPlaceholder, draftsPathPlaceholder,
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

// contextPathPlaceholder names the context document of a review of a pull
// request without a task. It is no placeholder of a prompt: it appears only in
// the notes the app appends, where it is replaced along with
// baseBranchPlaceholder, which is one and is replaced there a second time.
const contextPathPlaceholder = "{{context_path}}"

// mergeBasePlaceholder names the remote-tracking ref of the base in the notes
// of the review of a pull request. Like contextPathPlaceholder, it is no
// placeholder of a prompt.
const mergeBasePlaceholder = "{{merge_base}}"

// PushInstruction is what the app puts in the commit prompt when the commit
// belongs to a pull request that already exists.
const PushInstruction = "After committing, push this branch to `origin`, so the commit reaches the pull request. Push only this branch, and never force-push."

// DetachedPushInstruction is what the app puts in the commit prompt when the
// commit belongs to a pull request whose worktree is on a detached HEAD; %s is
// the branch of the pull request.
const DetachedPushInstruction = "After committing, push the commit to the pull request with `git push origin HEAD:refs/heads/%s`: this worktree is on a detached HEAD, so there is no local branch to push. Never force-push."

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

// The headings of the sections the app appends to the prompt of the review of
// a pull request: what it is when the pull request comes from no task, how the
// report reads, what happens to the findings, what the app read from GitHub,
// and the instructions.
const (
	externalHeading         = "\n\n## Pull request without a task\n\n"
	findingsFormatHeading   = "\n\n## Findings format\n\n"
	publishHeading          = "\n\n## Publishing\n\n"
	applyHeading            = "\n\n## Applying\n\n"
	checksHeading           = "\n\n## GitHub checks and conflicts\n\n"
	githubStatusHeading     = "\n\n## GitHub status\n\n"
	instructionsHeading     = "\n\n## Review instructions\n\n"
	passInstructionsHeading = "\n\n## Instructions for this pass\n\n"
)

// The headings of the sections the app appends to the prompt of a discussion:
// the board it runs on and the format the file of drafts has to follow.
const (
	boardHeading        = "\n\n## Board\n\n"
	draftsFormatHeading = "\n\n## Drafts format\n\n"
)

// draftsFormatNote is how the file of drafts of a discussion has to read, so
// that the app can read every draft of it.
const draftsFormatNote = "The app reads `{{drafts_path}}`, so it must follow this format exactly. The file opens with a header, then one block per draft:\n\n```markdown\n---\nstatus: drafts\n---\n\n## Draft: export-invoices\n- Kind: new\n- Repository: owner/name\n- Module: Billing\n- Epic: invoices-epic\n- Depends on: invoice-schema, owner/name#42\n\n### Title\nExport invoices as CSV\n\n### Body\n[the body of the card, as Markdown, until the next \"## Draft:\" line]\n```\n\n- `status` is `drafts` when the file has at least one draft, and `none` when the discussion ends without a card; a file with `status: none` has no draft blocks.\n- Each block opens with `## Draft: <id>`. The id is yours: lowercase letters, digits and hyphens, unique in the file, and stable across rewrites: a draft that keeps its id keeps what the user edited and decided. When you change a draft, keep its id; a new id is a new draft.\n- `Kind` is `new`, `update` or `epic`.\n  - `new` and `epic` take `Repository: owner/name`, one of the repositories the board manages.\n  - `update` takes `Card: owner/name#number`, a card of the board, and no `Repository`.\n  - `epic` takes no `Module`, no `Epic` and no `Depends on`.\n- `Module` is the name of one option of the module field of the board, only when the board has one. Optional.\n- `Epic` is the id of an `epic` draft of this file, or `owner/name#number` of an issue that exists. Optional.\n- `Depends on` lists the ids of `new` or `update` drafts of this file and `owner/name#number` of existing cards, separated by commas. Optional. A draft never depends on itself.\n- `### Title` is followed by the title on one line. `### Body` is followed by the body, which runs until the next `## Draft:` line or the end of the file. Both are required. The body must not contain a line that reads exactly `### Title`, `### Body` or starts with `## Draft:`.\n\nAny deviation makes the file unreadable, and the app tells the user so; rewrite it in place to fix it."

// oneShotHeading opens the section Render appends to the prompts that read the
// documents of a task, when the task is One-Shot.
const oneShotHeading = "\n\n## One-Shot task\n\n"

// stepReviewOneShotNote is what the prompt of a step reviewer says about the
// document of a One-Shot task.
const stepReviewOneShotNote = "This task was planned in a single document, `{{one_shot_path}}`, instead of a PRD, " +
	"a technical specification and step files, and it is implemented in this one step. Every reference in this " +
	"prompt to the step file, the product requirements or the technical specification means that document. Its " +
	"Scope and its Completion checklist are the scope, the objectives and the completion checklist of the step. " +
	"Its Problem and its Scope play the role of the product requirements, and its Technical decisions and its " +
	"Change plan play the role of the technical specification: the plan the step follows is that document."

// prOneShotNote is what the prompt of a pull request says about the document
// of a One-Shot task.
const prOneShotNote = "This task was planned in a single document, `{{one_shot_path}}`, instead of a PRD and a " +
	"technical specification. Every reference in this prompt to the PRD or the technical specification means that " +
	"document: read it to see what the task set out to do. Never mention it in the pull request, as with any other " +
	"document of the process."

// prReviewOneShotNote is what the prompt of a pull request reviewer says about
// the document of a One-Shot task.
const prReviewOneShotNote = "This task was planned in a single document, `{{one_shot_path}}`, instead of a PRD and " +
	"a technical specification. Every reference in this prompt to the PRD or the technical specification means " +
	"that document, and it is the criteria. Its Problem and its Scope play the role of the product requirements, " +
	"and its Technical decisions and its Change plan play the role of the technical specification: a deviation " +
	"from them is a finding, even when the code works."

// cardHeading opens the section Render appends to the prompt of a pull request
// when the task was created from a card.
const cardHeading = "\n\n## Card\n\n"

// prCardNote is what the prompt of a pull request says about the card of the task.
const prCardNote = "This task was created from a card of the team's board. Read the card below before writing " +
	"the description: it says what the change is for, and the description should make sense to someone who " +
	"reads the card. Start the body of the draft with the line `Closes {{card_reference}}`, alone on its line, " +
	"so that the pull request is linked to the card. Never mention the board otherwise."

// externalNote is what the prompt of the review of a pull request says when
// the pull request comes from no task of the product.
const externalNote = "This pull request does not come from a task of this product: there is no PRD and no technical specification. Every reference in this prompt to the PRD or the technical specification means the single document `{{context_path}}`, which holds the title and the description of the pull request and, when the pull request is linked to a card of the team's board, the card and its epic. That document is the criteria: what the card and the description say the change is for is what the code must do. When the document has no card, review against the description, the instructions below and the conventions the repository documents. The worktree is on a detached HEAD at the head of the pull request; the base is `{{base_branch}}`."

// findingsFormatNote is how the report of the review of a pull request has to
// read, so that the app can list its findings.
const findingsFormatNote = "The app reads the report, so its body must follow this format exactly, and it replaces what this prompt says above about the body of the report. After the header, write a summary of what you reviewed and what you found, as plain Markdown without any `## Findings` heading in it. When there are findings, follow the summary with a line `## Findings` and then one block per finding:\n\n```markdown\n### 1 · <a short title of what is wrong, one line, no Markdown>\nLocation: path/from/the/repository/root.go:123\n\n[what is wrong and what to do about it]\n```\n\nThe title follows the number on the same line, after \" · \": a few words that say what is wrong, with no Markdown. `Location` is either `path:line`, where the line is a line of the **new** version of a file and is part of the diff of the pull request, or the word `general` for a finding with no such line: a missing test, a migration that was not written, a problem in a file the pull request does not touch, a problem on a line the pull request removed. Number the findings from 1. A report with `status: clean` has no `## Findings` section."

// publishNote is what the review of a pull request in the review center does
// with its findings when the user publishes them on GitHub.
const publishNote = "The user decides on each finding in the app, may edit its text, and the app publishes the approved ones on GitHub as a review: each finding with a `path:line` location becomes a comment on that line, and the general ones go in the body after the summary. Write each finding as a comment a colleague reads on the pull request: self-contained, direct and respectful. This replaces what this prompt says above under \"What happens next\": after writing the report, say in one line what you found and stop. Never edit a file of the worktree, never commit and never push. When the user asks in the conversation for a finding to be added, changed or removed, rewrite the report of the current pass in place, keeping the numbers of the findings that did not change."

// applyNote is what the review of a pull request does with its findings when
// the agent applies them in the worktree.
const applyNote = "The user decides on each finding in the app, and the app then sends you the findings they approved. This replaces the item-by-item decision in the conversation this prompt describes above: after writing the report, say in one line what you found and stop, and implement only what the app sends you as approved. When the user asks in the conversation for a finding to be added, changed or removed before that, rewrite the report of the current pass in place, keeping the numbers of the findings that did not change."

// checksNote is what the review of a pull request does with the checks of its
// head and a conflict with its base, which the app reads before each pass.
const checksNote = "Before this pass the app read on GitHub the checks of the head of the pull request and whether the branch merges clean into the base; the `## GitHub status` section, at the end of this prompt or of the message that asks for the pass, says what it found. That is part of what you review: a check that failed and a conflict with the base are findings of the report like any other, and the report is `changes` whenever there is one of them.\n\n" +
	"- For each check that failed, investigate the cause with the `gh` of this session: `gh pr checks {{pr_number}}` lists the checks with their links; for a check of GitHub Actions, `gh run view <run id> --log-failed` prints the steps that failed, with the run id that is in the link; a check of another system may have only its link. Relate the cause to the code of the pull request.\n" +
	"- Write one finding per check that failed, or one per cause when several failed for the same one, saying which check failed, with its link, and what caused the failure: the test that broke, the lint error, the command that did not finish. The finding is anchored on a line of the new version that is part of the diff when the cause is there, such as the broken test or the line the linter pointed at, and general when it is not, such as a test the pull request does not touch that started failing or a failure of the infrastructure of the check. When the cause cannot be found, such as a log you cannot reach, the finding is general and says so: the check, its link and that the cause was not found.\n" +
	"- When the branch has conflicts with the base, write a single general finding saying that the branch has conflicts with `{{base_branch}}` and, when you can tell, the files in conflict: `git merge-tree --write-tree HEAD {{merge_base}}` lists them without touching the worktree. Never run `git merge` to find out.\n" +
	"- In the summary, where it says what you reviewed, record what the app read: that the checks passed, that the pull request has no checks, or which ones failed, and whether the branch merges clean. A clean report then makes it clear that the checks and the conflict were considered.\n" +
	"- When a finding about a check is approved, fix its cause like any finding. When the finding about the conflict is approved, resolve it by merging the base into the branch, never by rebasing: `git fetch origin`, then `git merge {{merge_base}}`; resolve the conflicts in the files and leave the merge in progress, without `git add` on the resolved files and without committing: the user reviews and stages them in the app, and the commit, which comes from another prompt, concludes the merge. Resolve the conflict before the other findings approved in the same round, so that you fix them on the merged code. The rule of this prompt never to merge is about merging the pull request; merging the base into its branch to resolve an approved conflict is the exception."

// noChecksReading is the status section of a pass the app read nothing from
// GitHub for.
const noChecksReading = "The app has no reading of GitHub for this pass. Read it yourself before reviewing: `gh pr view {{pr_number}} --json statusCheckRollup,mergeable` says the checks and whether the branch merges clean, and everything above about checks and conflicts holds."

// PRChecksSection is the body of the section that says what the app read from
// GitHub before a pass of the review of a pull request: the checks that failed
// and whether the branch merges clean into the base, mergeBase being
// origin/<base>. It names no pending check: a pass starts only without them.
// With no reading, it asks the agent to read GitHub itself.
func PRChecksSection(checks *gh.PRChecks, mergeBase string) string {
	if checks == nil {
		return noChecksReading
	}

	var b strings.Builder
	failed := checks.Failed()
	switch {
	case len(checks.Checks) == 0:
		b.WriteString("- Checks: the pull request has no checks.\n")
	case len(failed) == 0 && len(checks.Checks) == 1:
		b.WriteString("- Checks: 1 check passed.\n")
	case len(failed) == 0:
		fmt.Fprintf(&b, "- Checks: all %d checks passed.\n", len(checks.Checks))
	default:
		fmt.Fprintf(&b, "- Checks: %d of %d failed:\n", len(failed), len(checks.Checks))
		for _, check := range failed {
			fmt.Fprintf(&b, "  - `%s` — %s", check.Name, check.Conclusion)
			if check.URL != "" {
				b.WriteString(" — " + check.URL)
			}
			b.WriteString("\n")
		}
	}

	base := strings.TrimPrefix(mergeBase, "origin/")
	if checks.Conflicting() {
		fmt.Fprintf(&b, "- Base: the branch has conflicts with `%s`; an approved conflict is resolved by merging `%s` into the branch, never by rebasing.", base, mergeBase)
	} else {
		fmt.Fprintf(&b, "- Base: the branch merges clean into `%s`.", base)
	}
	return b.String()
}

// oneShotNote is what a prompt that reads the documents of a task says about
// the document of a One-Shot task; "" for a prompt that reads none.
func oneShotNote(stage Stage) string {
	switch stage {
	case StageStepReview:
		return stepReviewOneShotNote
	case StagePR:
		return prOneShotNote
	case StagePRReview:
		return prReviewOneShotNote
	default:
		return ""
	}
}

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
	InitialContext string // PRD, One-Shot planning and discussion only
	StepPath       string // StageStep: the file whose content is the prompt; StageStepReview: the step under review
	OneShotPath    string // One-Shot tasks only: the document, which the prompts point to in place of the PRD, the tech spec and the step file; "" for a Structured task

	Repository string // owner/name of the repository of the task
	Branch     string
	BaseBranch string
	DraftPath  string
	ReviewPath string
	PRNumber   string
	PRURL      string
	Push       bool // the commit of this session goes up to the pull request

	CommitAll        bool   // the commit takes every change of the worktree, not what is staged
	ImplementerReply string // StageStepReview only: what the implementer said last, appended to the prompt

	Card          string // PR only: the card of the task as Markdown (task.Card.Markdown); "" for a task without one
	CardReference string // PR only: owner/name#number of the card

	// ContextPath is the single document the review of a pull request that
	// comes from no task reads in place of the PRD and the technical
	// specification; "" for the review of the pull request of a task.
	ContextPath  string
	External     bool   // PR review only: the pull request comes from no task of the product
	Publish      bool   // PR review: the findings are published on GitHub, not applied; a task never publishes
	Instructions string // PR review only: the fixed review instructions of the repository
	// Checks is what the app read from GitHub about the head of the pull
	// request before the pass: its checks and whether it merges clean. PR
	// review only; nil when the app has no reading for the pass, which the
	// status section then says.
	Checks *gh.PRChecks
	// MergeBase is the remote-tracking ref of the base, origin/<base>, that an
	// approved conflict is resolved by merging; PR review only.
	MergeBase string
	// PassInstructions is what the user wrote for this pass of a review of a
	// pull request.
	PassInstructions string
	// The discussion sessions: the two files the agent writes and the board the
	// discussion runs on.
	DocumentPath string
	DraftsPath   string
	Board        string // the section that describes the board, appended to the prompt

	// PushRef is the branch a commit of a worktree on a detached HEAD is pushed
	// to; commit only, with Push.
	PushRef string
}

// pushInstruction is what {{push}} becomes: the instruction when the commit
// belongs to a pull request, the one for a worktree on a detached HEAD when
// the commit goes up without a local branch, nothing when the commit belongs
// to no pull request.
func pushInstruction(push bool, ref string) string {
	switch {
	case push && ref != "":
		return fmt.Sprintf(DetachedPushInstruction, ref)
	case push:
		return PushInstruction
	default:
		return ""
	}
}

// commitInstruction is what {{what_to_commit}} becomes: every change of the
// worktree after an agent review, what is staged otherwise.
func commitInstruction(all bool) string {
	if all {
		return AllChangesInstruction
	}
	return StagedInstruction
}

// Render takes the prompt of stage, the edit of the user when there is one and
// the default otherwise, and replaces its placeholders. A prompt the user
// edited may have lost a placeholder, which is not an error. Three things are
// never dropped with one: the initial context the user wrote, what to commit
// and the push instruction are appended to a prompt that has no placeholder
// for them. The prompt of a step reviewer always ends with what the
// implementer said last. In a One-Shot task, the placeholders of the PRD, the
// tech spec and the step file render the document, and the prompts that read
// them always end with what the document stands for. The prompt of a pull
// request of a task created from a card ends with the card, and the prompt of
// the review of a pull request with what the review is about, what the app
// read of its checks and conflicts on GitHub and the instructions it runs
// with. StageStep is the exception: the step file is sent
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

	prdPath, techSpecPath, stepPath := vars.PRDPath, vars.TechSpecPath, vars.StepPath
	if vars.OneShotPath != "" {
		prdPath, techSpecPath, stepPath = vars.OneShotPath, vars.OneShotPath, vars.OneShotPath
	}
	// A review of a pull request that comes from no task reads one document in
	// place of both; a task never has one, so the two never come together.
	if vars.ContextPath != "" {
		prdPath, techSpecPath = vars.ContextPath, vars.ContextPath
	}

	rendered := strings.NewReplacer(
		taskNamePlaceholder, vars.TaskName,
		artifactsDirPlaceholder, vars.ArtifactsDir,
		prdPathPlaceholder, prdPath,
		techSpecPathPlaceholder, techSpecPath,
		stepsDirPlaceholder, vars.StepsDir,
		stepPathPlaceholder, stepPath,
		oneShotPathPlaceholder, vars.OneShotPath,
		initialContextPlaceholder, vars.InitialContext,
		repositoryPlaceholder, vars.Repository,
		branchPlaceholder, vars.Branch,
		baseBranchPlaceholder, vars.BaseBranch,
		draftPathPlaceholder, vars.DraftPath,
		reviewPathPlaceholder, vars.ReviewPath,
		prNumberPlaceholder, vars.PRNumber,
		prURLPlaceholder, vars.PRURL,
		whatToCommitPlaceholder, commitInstruction(vars.CommitAll),
		pushPlaceholder, pushInstruction(vars.Push, vars.PushRef),
		documentPathPlaceholder, vars.DocumentPath,
		draftsPathPlaceholder, vars.DraftsPath,
	).Replace(text)

	if !strings.Contains(text, initialContextPlaceholder) && vars.InitialContext != "" {
		rendered += contextHeading + vars.InitialContext
	}
	if stage == StageDiscussion {
		rendered += discussionSections(vars)
	}
	if stage == StageCommit && !strings.Contains(text, whatToCommitPlaceholder) {
		rendered += whatToCommitHeading + commitInstruction(vars.CommitAll)
	}
	if !strings.Contains(text, pushPlaceholder) && vars.Push {
		rendered += pushHeading + pushInstruction(vars.Push, vars.PushRef)
	}
	if note := oneShotNote(stage); note != "" && vars.OneShotPath != "" {
		rendered += oneShotHeading + strings.ReplaceAll(note, oneShotPathPlaceholder, vars.OneShotPath)
	}
	if stage == StagePR && vars.Card != "" {
		rendered += cardHeading + strings.ReplaceAll(prCardNote, "{{card_reference}}", vars.CardReference) + "\n\n" + vars.Card
	}
	if stage == StagePRReview {
		rendered += reviewSections(vars)
	}
	// What the implementer said is never a placeholder: the prompt of a
	// reviewer always ends with it.
	if stage == StageStepReview {
		rendered += replyHeading + vars.ImplementerReply
	}
	return rendered, nil
}

// discussionSections are the sections the app appends to the prompt of a
// discussion: the board it runs on, when there is one, and the format the file
// of drafts has to follow, always. Like the others, they depend on no
// placeholder, so an edited prompt receives them too.
func discussionSections(vars Vars) string {
	var b strings.Builder
	if vars.Board != "" {
		b.WriteString(boardHeading + vars.Board)
	}
	b.WriteString(draftsFormatHeading + strings.NewReplacer(
		draftsPathPlaceholder, vars.DraftsPath,
		documentPathPlaceholder, vars.DocumentPath,
	).Replace(draftsFormatNote))
	return b.String()
}

// reviewSections are the sections the app appends to the prompt of the review
// of a pull request: what the review is about when the pull request comes from
// no task, then, always, the format of the report and what happens to its
// findings (applied, or published when the pull request comes from no task),
// what to do about the checks and conflicts and what the app read of them on
// GitHub, and the instructions the pass runs with.
// Like the others, they depend on no placeholder, so an edited prompt receives
// them too.
func reviewSections(vars Vars) string {
	var b strings.Builder
	if vars.External {
		b.WriteString(externalHeading + reviewNote(externalNote, vars))
	}
	b.WriteString(findingsFormatHeading + reviewNote(findingsFormatNote, vars))
	if vars.Publish {
		b.WriteString(publishHeading + reviewNote(publishNote, vars))
	} else {
		b.WriteString(applyHeading + reviewNote(applyNote, vars))
	}
	b.WriteString(checksHeading + reviewNote(checksNote, vars))
	b.WriteString(githubStatusHeading + reviewNote(PRChecksSection(vars.Checks, vars.MergeBase), vars))
	if vars.Instructions != "" {
		b.WriteString(instructionsHeading + vars.Instructions)
	}
	if vars.PassInstructions != "" {
		b.WriteString(passInstructionsHeading + vars.PassInstructions)
	}
	return b.String()
}

// reviewNote is a note of the review of a pull request with what it names of
// the review in it.
func reviewNote(note string, vars Vars) string {
	return strings.NewReplacer(
		contextPathPlaceholder, vars.ContextPath,
		baseBranchPlaceholder, vars.BaseBranch,
		prNumberPlaceholder, vars.PRNumber,
		mergeBasePlaceholder, vars.MergeBase,
	).Replace(note)
}
