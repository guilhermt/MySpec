package bindings

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"path/filepath"
	"strings"
	"time"

	"github.com/guilhermt/myspec/internal/editor"
	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/reviewmode"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

// removeTimeout bounds the calls that remove worktrees: they run git, and a
// removal is far slower than the database work callTimeout was written for.
const removeTimeout = time.Minute

// errPathOutside is a file the frontend asked for that is not in the worktree
// of the step.
var errPathOutside = errors.New("bindings: the path is outside the worktree")

// Editor opens a folder, or a folder and a file, in the user's editor.
// internal/app passes editor.Open.
type Editor func(paths ...string) error

// TaskService is the task, session and flow API the frontend calls.
type TaskService struct {
	tasks       *task.Service
	sessions    *session.Service
	flow        *flow.Service
	defaults    *models.Service
	reviewModes *reviewmode.Service
	editor      Editor
	log         *slog.Logger
}

// NewTaskService builds the service over the task, session and flow domains.
func NewTaskService(
	tasks *task.Service,
	sessions *session.Service,
	flow *flow.Service,
	defaults *models.Service,
	reviewModes *reviewmode.Service,
	editor Editor,
	log *slog.Logger,
) *TaskService {
	return &TaskService{
		tasks:       tasks,
		sessions:    sessions,
		flow:        flow,
		defaults:    defaults,
		reviewModes: reviewModes,
		editor:      editor,
		log:         log,
	}
}

// CreateTask creates a task and starts its first stage with the stage prompt.
// A session that fails to start undoes the task, so a half-created one is
// never left behind.
func (s *TaskService) CreateTask(req CreateTaskRequest) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	set, err := choicesOf(s.defaults.Defaults(), req.Models)
	if err != nil {
		return "", s.fail("CreateTask", err)
	}
	mode, err := reviewModeOf(s.reviewModes.Default(), req.ReviewMode)
	if err != nil {
		return "", s.fail("CreateTask", err)
	}

	t, err := s.tasks.Create(ctx, task.CreateParams{
		Name:           req.Name,
		RepoPath:       req.RepoPath,
		InitialContext: req.InitialContext,
		Models:         set,
		ReviewMode:     mode,
	})
	if err != nil {
		return "", s.fail("CreateTask", err)
	}

	if err := s.flow.StartTask(ctx, t); err != nil {
		if deleteErr := s.tasks.Delete(ctx, t.ID); deleteErr != nil {
			s.log.Error("binding failed", "method", "CreateTask", "err", deleteErr)
		}
		return "", s.fail("CreateTask", err)
	}
	return t.ID, nil
}

// DeleteTask stops the session of a task, removes its worktrees and branches,
// and removes it with its artifacts. What git could not remove comes back for
// the user to clean up: it never keeps the task.
func (s *TaskService) DeleteTask(taskID string) (DeleteResult, error) {
	ctx, cancel := context.WithTimeout(context.Background(), removeTimeout)
	defer cancel()

	result, err := s.flow.Delete(ctx, taskID)
	if err != nil {
		return DeleteResult{}, s.fail("DeleteTask", err)
	}
	return FromDeleteResult(result), nil
}

// PreviewDelete reads what deleting a task would destroy, which is what the
// confirmation dialog spells out before the user agrees to it.
func (s *TaskService) PreviewDelete(taskID string) (DeletePreview, error) {
	ctx, cancel := context.WithTimeout(context.Background(), removeTimeout)
	defer cancel()

	preview, err := s.flow.PreviewDelete(ctx, taskID)
	if err != nil {
		return DeletePreview{}, s.fail("PreviewDelete", err)
	}
	return FromDeletePreview(preview), nil
}

// CloseRepo takes down the worktree and the branch of a repository whose pull
// request was merged and updates its base branch. It returns as soon as the
// work is scheduled; what git does arrives as state.
func (s *TaskService) CloseRepo(taskID, repoPath string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.CloseRepo(ctx, taskID, repoPath); err != nil {
		return s.fail("CloseRepo", err)
	}
	return nil
}

// GetTranscript returns the whole conversation of one session of a task, named
// by its stage. It is how the frontend gets its first one; every later change
// arrives with EventTranscriptChanged.
func (s *TaskService) GetTranscript(taskID, stage string) (Transcript, error) {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	transcript, err := s.sessions.Transcript(ctx, session.Key{TaskID: taskID, Stage: stage})
	// A task past the stages that have a conversation has none, and the
	// frontend asks for it all the same; its stage answers with an empty one.
	if errors.Is(err, session.ErrNotFound) {
		if _, ok := s.tasks.Get(taskID); ok {
			return Transcript{TaskID: taskID, Stage: stage, Entries: []Entry{}, Pending: []Entry{}}, nil
		}
	}
	if err != nil {
		return Transcript{}, s.fail("GetTranscript", err)
	}
	return FromTranscript(transcript), nil
}

// BackToStage reopens a finished stage of a task, throwing away what came
// after it. The stage is prd or tech_spec.
func (s *TaskService) BackToStage(taskID, stage string) error {
	target, err := task.ParseStage(stage)
	if err != nil {
		return s.fail("BackToStage", err)
	}

	// Going back tears down the worktrees of the steps, which is git work.
	ctx, cancel := context.WithTimeout(context.Background(), removeTimeout)
	defer cancel()

	if err := s.flow.Back(ctx, taskID, target); err != nil {
		return s.fail("BackToStage", err)
	}
	return nil
}

// DiscardStage throws away a stage and everything after it, and starts the
// stage again. The stage is prd, tech_spec or plan.
func (s *TaskService) DiscardStage(taskID, stage string) error {
	target, err := task.ParseStage(stage)
	if err != nil {
		return s.fail("DiscardStage", err)
	}

	// Discarding tears down the worktrees of the steps, which is git work.
	ctx, cancel := context.WithTimeout(context.Background(), removeTimeout)
	defer cancel()

	if err := s.flow.Discard(ctx, taskID, target); err != nil {
		return s.fail("DiscardStage", err)
	}
	return nil
}

// ContinueStage moves a task that is revisiting a stage on to the next one.
func (s *TaskService) ContinueStage(taskID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.Continue(ctx, taskID); err != nil {
		return s.fail("ContinueStage", err)
	}
	return nil
}

// RetryStep prepares a blocked step again, which is what the user asks for
// after fixing whatever git complained about.
func (s *TaskService) RetryStep(taskID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.RetryStep(ctx, taskID); err != nil {
		return s.fail("RetryStep", err)
	}
	return nil
}

// CleanAndStartStep throws away every change of the worktree of a step blocked
// by a dirty one and prepares it again.
func (s *TaskService) CleanAndStartStep(taskID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.CleanAndStartStep(ctx, taskID); err != nil {
		return s.fail("CleanAndStartStep", err)
	}
	return nil
}

// DiscardStep throws away the conversation of the current step and starts it
// over, optionally cleaning its worktree first.
func (s *TaskService) DiscardStep(taskID string, cleanWorktree bool) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.DiscardStep(ctx, taskID, cleanWorktree); err != nil {
		return s.fail("DiscardStep", err)
	}
	return nil
}

// SetStageModel changes the model and effort of a stage of a task, for the
// sessions of it that are still to start.
func (s *TaskService) SetStageModel(taskID, stage, model, effort string) error {
	target, err := models.ParseStage(stage)
	if err != nil {
		return s.fail("SetStageModel", err)
	}
	c, err := models.ParseChoice(model, effort)
	if err != nil {
		return s.fail("SetStageModel", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.SetStageModel(ctx, taskID, target, c); err != nil {
		return s.fail("SetStageModel", err)
	}
	return nil
}

// SetStepModel changes the model and effort of a step that has not started.
func (s *TaskService) SetStepModel(taskID string, step int, model, effort string) error {
	c, err := models.ParseChoice(model, effort)
	if err != nil {
		return s.fail("SetStepModel", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.SetStepModel(ctx, taskID, step, c); err != nil {
		return s.fail("SetStepModel", err)
	}
	return nil
}

// SetSessionModel changes the model and effort of a session from its next
// message on. The stage names the session: prd, tech_spec, plan, step:<n>,
// pr:<slug> or pr_review:<slug>.
func (s *TaskService) SetSessionModel(taskID, stage, model, effort string) error {
	c, err := models.ParseChoice(model, effort)
	if err != nil {
		return s.fail("SetSessionModel", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.SetSessionModel(ctx, taskID, stage, c); err != nil {
		return s.fail("SetSessionModel", err)
	}
	return nil
}

// SetReviewMode changes who reviews the steps of a task that are still to
// start and have no mode of their own.
func (s *TaskService) SetReviewMode(taskID, mode string) error {
	target, err := reviewmode.ParseMode(mode)
	if err != nil {
		return s.fail("SetReviewMode", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.SetReviewMode(ctx, taskID, target); err != nil {
		return s.fail("SetReviewMode", err)
	}
	return nil
}

// SetStepReviewMode changes who reviews a step that has not started.
func (s *TaskService) SetStepReviewMode(taskID string, step int, mode string) error {
	target, err := reviewmode.ParseMode(mode)
	if err != nil {
		return s.fail("SetStepReviewMode", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.SetStepReviewMode(ctx, taskID, step, target); err != nil {
		return s.fail("SetStepReviewMode", err)
	}
	return nil
}

// ReviewStepMyself takes the review of the current step of a task back from
// the agent.
func (s *TaskService) ReviewStepMyself(taskID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.ReviewStepMyself(ctx, taskID); err != nil {
		return s.fail("ReviewStepMyself", err)
	}
	return nil
}

// OpenInEditor opens a worktree of a task in the editor: the one of the
// repository when repoPath names one, the one of the current step otherwise.
func (s *TaskService) OpenInEditor(taskID, repoPath string) error {
	worktree, err := s.worktreeOf(taskID, repoPath)
	if err != nil {
		return s.fail("OpenInEditor", err)
	}
	if err := s.editor(worktree); err != nil {
		return s.fail("OpenInEditor", err)
	}
	return nil
}

// worktreeOf is the worktree a call acts on: the one of a repository of the PR
// stage, or the one of the step that runs.
func (s *TaskService) worktreeOf(taskID, repoPath string) (string, error) {
	if repoPath == "" {
		step, ok := s.flow.CurrentStep(taskID)
		if !ok {
			return "", fmt.Errorf("worktree of task %s: %w", taskID, flow.ErrNoStep)
		}
		if step.WorktreePath == "" {
			return "", fmt.Errorf("worktree of task %s: %w", taskID, flow.ErrNoWorktree)
		}
		return step.WorktreePath, nil
	}

	for _, repo := range s.flow.Repos(taskID) {
		if repo.RepoPath != repoPath {
			continue
		}
		if repo.WorktreePath == "" {
			return "", fmt.Errorf("worktree of %s: %w", repoPath, flow.ErrNoWorktree)
		}
		return repo.WorktreePath, nil
	}
	return "", fmt.Errorf("worktree of %s in task %s: %w", repoPath, taskID, flow.ErrNoRepo)
}

// ApproveStep approves the review of the current step of a task and asks the
// agent to commit what is staged.
func (s *TaskService) ApproveStep(taskID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.ApproveStep(ctx, taskID); err != nil {
		return s.fail("ApproveStep", err)
	}
	return nil
}

// OpenFileInEditor opens one file of a worktree of a task in the editor, in
// the window of that worktree. repoPath names the repository of the PR stage;
// empty, it is the worktree of the current step.
func (s *TaskService) OpenFileInEditor(taskID, repoPath, path string) error {
	worktree, err := s.worktreeOf(taskID, repoPath)
	if err != nil {
		return s.fail("OpenFileInEditor", err)
	}
	// The path comes from the frontend, which only ever has paths git reported
	// inside the worktree; anything else is not this worktree's to open.
	clean := filepath.Clean(path)
	if filepath.IsAbs(clean) || clean == ".." || strings.HasPrefix(clean, ".."+string(filepath.Separator)) {
		return s.fail("OpenFileInEditor", fmt.Errorf("open %q of task %s: %w", path, taskID, errPathOutside))
	}
	if err := s.editor(worktree, filepath.Join(worktree, clean)); err != nil {
		return s.fail("OpenFileInEditor", err)
	}
	return nil
}

// OpenPR writes the draft the user approved and asks the agent to open the
// pull request of a repository from it.
func (s *TaskService) OpenPR(taskID, repoPath, title, body string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.OpenPR(ctx, taskID, repoPath, title, body); err != nil {
		return s.fail("OpenPR", err)
	}
	return nil
}

// ApproveRepo approves the review of the changes a pass of a pull request
// review produced and asks the agent to commit and push them.
func (s *TaskService) ApproveRepo(taskID, repoPath string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.ApproveRepo(ctx, taskID, repoPath); err != nil {
		return s.fail("ApproveRepo", err)
	}
	return nil
}

// ReviewAgain ends the review session of a repository and starts a new pass
// over its pull request.
func (s *TaskService) ReviewAgain(taskID, repoPath string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.ReviewAgain(ctx, taskID, repoPath); err != nil {
		return s.fail("ReviewAgain", err)
	}
	return nil
}

// DiscardDraft throws away the draft of a repository and prepares it again.
func (s *TaskService) DiscardDraft(taskID, repoPath string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.DiscardDraft(ctx, taskID, repoPath); err != nil {
		return s.fail("DiscardDraft", err)
	}
	return nil
}

// RetryRepo prepares a blocked repository of the pull request stage again.
func (s *TaskService) RetryRepo(taskID, repoPath string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.RetryRepo(ctx, taskID, repoPath); err != nil {
		return s.fail("RetryRepo", err)
	}
	return nil
}

// RefreshPR reads the pull request of a repository again. It returns as soon
// as the reading is scheduled; what it finds arrives as state.
func (s *TaskService) RefreshPR(taskID, repoPath string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.RefreshPR(ctx, taskID, repoPath); err != nil {
		return s.fail("RefreshPR", err)
	}
	return nil
}

// SendMessage queues a message for the agent, delivered right away when the
// session is free.
func (s *TaskService) SendMessage(taskID, stage, text string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.sessions.Send(ctx, session.Key{TaskID: taskID, Stage: stage}, text); err != nil {
		return s.fail("SendMessage", err)
	}
	return nil
}

// RemovePending drops a queued message before it reaches the agent.
func (s *TaskService) RemovePending(taskID, stage, entryID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.sessions.RemovePending(ctx, session.Key{TaskID: taskID, Stage: stage}, entryID); err != nil {
		return s.fail("RemovePending", err)
	}
	return nil
}

// Interrupt aborts the running turn of a task, leaving the session alive.
func (s *TaskService) Interrupt(taskID, stage string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.sessions.Interrupt(ctx, session.Key{TaskID: taskID, Stage: stage}); err != nil {
		return s.fail("Interrupt", err)
	}
	return nil
}

// Pause stops the process of a task and holds every message until Resume.
func (s *TaskService) Pause(taskID, stage string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.sessions.Pause(ctx, session.Key{TaskID: taskID, Stage: stage}); err != nil {
		return s.fail("Pause", err)
	}
	return nil
}

// Resume lifts a pause and delivers what was queued meanwhile.
func (s *TaskService) Resume(taskID, stage string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.sessions.Resume(ctx, session.Key{TaskID: taskID, Stage: stage}); err != nil {
		return s.fail("Resume", err)
	}
	return nil
}

// Retry clears the last error of a task and starts its process again.
func (s *TaskService) Retry(taskID, stage string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.sessions.Retry(ctx, session.Key{TaskID: taskID, Stage: stage}); err != nil {
		return s.fail("Retry", err)
	}
	return nil
}

// AnswerPermission answers the pending permission request of a task. The
// decision is allow, allow_session or deny; message is the reason a denial
// gives the agent.
func (s *TaskService) AnswerPermission(taskID, stage, requestID, decision, message string) error {
	parsed, err := parseDecision(decision)
	if err != nil {
		return s.fail("AnswerPermission", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	key := session.Key{TaskID: taskID, Stage: stage}
	if err := s.sessions.AnswerPermission(ctx, key, requestID, parsed, message); err != nil {
		return s.fail("AnswerPermission", err)
	}
	return nil
}

// AnswerQuestion answers the pending structured question of a task, mapping
// each question text to the chosen label.
func (s *TaskService) AnswerQuestion(taskID, stage, requestID string, answers map[string]string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	key := session.Key{TaskID: taskID, Stage: stage}
	if err := s.sessions.AnswerQuestion(ctx, key, requestID, answers); err != nil {
		return s.fail("AnswerQuestion", err)
	}
	return nil
}

// ReadArtifact returns the content of an artifact of a task by file name.
func (s *TaskService) ReadArtifact(taskID, name string) (string, error) {
	content, err := s.tasks.ReadArtifact(taskID, name)
	if err != nil {
		return "", s.fail("ReadArtifact", err)
	}
	return content, nil
}

// parseDecision narrows the decision the frontend sent.
func parseDecision(decision string) (session.Decision, error) {
	switch d := session.Decision(decision); d {
	case session.DecisionAllow, session.DecisionAllowSession, session.DecisionDeny:
		return d, nil
	default:
		return "", fmt.Errorf("answer permission: unknown decision %q", decision)
	}
}

// choicesOf is the choice of every stage a new task starts with: the defaults,
// with the stages the creation dialog sent in their place.
func choicesOf(defaults models.Set, requested []StageModel) (models.Set, error) {
	set := maps.Clone(defaults)
	for _, one := range requested {
		stage, err := models.ParseStage(one.Stage)
		if err != nil {
			return nil, err
		}
		c, err := models.ParseChoice(one.Model, one.Effort)
		if err != nil {
			return nil, err
		}
		set[stage] = c
	}
	return set, nil
}

// reviewModeOf is the mode a new task starts with: the one the creation
// dialog sent, or the default of the app when it sent none.
func reviewModeOf(fallback reviewmode.Mode, requested string) (reviewmode.Mode, error) {
	if requested == "" {
		return fallback, nil
	}
	return reviewmode.ParseMode(requested)
}

// userMessages are the failures the user caused, with what the interface shows
// for them.
var userMessages = []struct {
	err     error
	message string
}{
	{task.ErrInvalidName, "Use lowercase letters, digits and single hyphens."},
	{task.ErrNameTaken, "A task with this name already exists in this workspace."},
	{task.ErrEmptyContext, "Describe what you want to build."},
	{task.ErrRepoOutside, "This repository is not part of the workspace."},
	{task.ErrUnknownStage, "Unknown stage."},
	{models.ErrUnknownModel, "Unknown model."},
	{models.ErrUnknownEffort, "Unknown effort level."},
	{models.ErrUnknownStage, "Unknown stage."},
	{prompts.ErrUnknownStage, "Unknown prompt."},
	{reviewmode.ErrUnknownMode, "Unknown review mode."},
	{session.ErrEmptyMessage, "Write a message first."},
	{session.ErrPaused, "Resume the task to send messages."},
	{session.ErrNotFound, "This conversation has ended."},
	{flow.ErrInvalidTarget, "This stage can't be reached from here."},
	{flow.ErrNotRevisiting, "The task isn't revisiting a stage."},
	{flow.ErrNotReady, "Wait for the agent to finish and the document to be written."},
	{flow.ErrNotImplementing, "The task isn't implementing."},
	{flow.ErrNoStep, "The task has no step to run."},
	{flow.ErrStepNotBlocked, "The step isn't blocked."},
	{flow.ErrStepNotDirty, "The worktree isn't what blocks the step."},
	{flow.ErrStepNotStarted, "The step hasn't started yet."},
	{flow.ErrNoWorktree, "The worktree doesn't exist yet."},
	{flow.ErrStepNotReady, "Stage every changed file before approving."},
	{flow.ErrStepBusy, "Wait for the agent to finish."},
	{flow.ErrNoRepo, "This repository isn't part of the task."},
	{flow.ErrDraftMissing, "The draft isn't ready yet."},
	{flow.ErrEmptyDraft, "Write a title and a description before opening the PR."},
	{flow.ErrPRExists, "The pull request is already open."},
	{flow.ErrNoPullRequest, "This repository has no pull request yet."},
	{flow.ErrRepoNotBlocked, "The repository isn't blocked."},
	{flow.ErrRepoNotClosable, "This repository isn't waiting to be closed."},
	{flow.ErrPRNotMerged, "The pull request hasn't been merged yet."},
	{flow.ErrModelLocked, "The sessions of this stage have already started."},
	{flow.ErrStepStarted, "This step has already started."},
	{flow.ErrReviewModeLocked, "Every step of this task has already started."},
	{flow.ErrAgentReviewing, "The agent is reviewing this step. Review it yourself to approve it."},
	{flow.ErrNoAgentReview, "The agent isn't reviewing this step."},
	{errPathOutside, "This file is not in the worktree of the step."},
	{editor.ErrNotFound, "VS Code was not found: `code` isn't on the PATH."},
	{gh.ErrNotFound, "GitHub CLI was not found: `gh` isn't on the PATH."},
	{gh.ErrNotAuthenticated, "GitHub CLI isn't authenticated: run `gh auth login`."},
	{git.ErrNotFound, "Git was not found on the PATH."},
}

// failure is what a failed binding call returns: a mistake the user can
// correct comes back as a sentence for them, anything else is logged and
// passed on.
func failure(log *slog.Logger, method string, err error) error {
	for _, known := range userMessages {
		if errors.Is(err, known.err) {
			return errors.New(known.message)
		}
	}
	log.Error("binding failed", "method", method, "err", err)
	return err
}

func (s *TaskService) fail(method string, err error) error { return failure(s.log, method, err) }
