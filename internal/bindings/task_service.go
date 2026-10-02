package bindings

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/discussionflow"
	"github.com/guilhermt/myspec/internal/editor"
	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/prreport"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/pulls"
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/reviewflow"
	"github.com/guilhermt/myspec/internal/reviewmode"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

// removeTimeout bounds the calls that remove a worktree: they run git, and a
// removal is far slower than the database work callTimeout was written for.
const removeTimeout = time.Minute

// errPathOutside is a file the frontend asked for that is not in the worktree
// of the task.
var errPathOutside = errors.New("bindings: the path is outside the worktree")

// Editor opens a folder, or a folder and a file, in the user's editor.
// internal/app passes editor.Open.
type Editor func(paths ...string) error

// TaskService is the task, session and flow API the frontend calls.
type TaskService struct {
	tasks           *task.Service
	sessions        *session.Service
	flow            *flow.Service
	defaults        *models.Service
	reviewModes     *reviewmode.Service
	repositories    *repository.Service
	boards          *board.Service
	editor          Editor
	documents       func(owner, name string, number int) (string, bool)
	hasConversation func(id string) bool
	log             *slog.Logger
}

// NewTaskService builds the service over the task, session and flow domains.
// hasConversation says that an id is an item of another kind whose
// conversation the frontend asks this service for, a review of a pull request
// or a discussion; without it, only tasks have one. documents is the
// understanding of the discussion that wrote a card, which the task created
// from it starts with; without it, no card has one.
func NewTaskService(
	tasks *task.Service,
	sessions *session.Service,
	flow *flow.Service,
	defaults *models.Service,
	reviewModes *reviewmode.Service,
	repositories *repository.Service,
	boards *board.Service,
	editor Editor,
	documents func(owner, name string, number int) (string, bool),
	hasConversation func(id string) bool,
	log *slog.Logger,
) *TaskService {
	if documents == nil {
		documents = func(string, string, int) (string, bool) { return "", false }
	}
	if hasConversation == nil {
		hasConversation = func(string) bool { return false }
	}
	return &TaskService{
		tasks:           tasks,
		sessions:        sessions,
		flow:            flow,
		defaults:        defaults,
		reviewModes:     reviewModes,
		repositories:    repositories,
		boards:          boards,
		editor:          editor,
		documents:       documents,
		hasConversation: hasConversation,
		log:             log,
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
	reviewMode, err := reviewModeOf(s.reviewModes.Default(), req.ReviewMode)
	if err != nil {
		return "", s.fail("CreateTask", err)
	}
	mode, err := modeOf(req.Mode)
	if err != nil {
		return "", s.fail("CreateTask", err)
	}
	repositoryID, initialContext := req.RepositoryID, req.InitialContext
	var taskCard *task.Card
	if req.Card != nil {
		card, found := s.boards.Card(req.Card.BoardID, req.Card.Key)
		if !found {
			return "", s.fail("CreateTask", board.ErrCardNotFound)
		}
		managed, found := s.managingRepository(req.Card.BoardID, card)
		if !found {
			return "", s.fail("CreateTask", &board.Refusal{Reason: board.RefusalNotManaged, Repository: card.FullName()})
		}
		repositoryID = managed.ID
		document, _ := s.documents(card.Owner, card.Name, card.Number)
		initialContext = board.Context(card, document, req.InitialContext)
		taskCard = &task.Card{
			BoardID: req.Card.BoardID,
			Owner:   card.Owner,
			Name:    card.Name,
			Number:  card.Number,
			Title:   card.Title,
			Body:    card.Body,
			URL:     card.URL,
			Status:  card.Status,
			State:   card.State,
			Epic:    epicOf(card),
			ReadAt:  card.ReadAt,
		}
	}
	repo, ok := s.repositories.Get(repositoryID)
	if !ok {
		return "", s.fail("CreateTask", task.ErrUnknownRepository)
	}
	// The first session of the task runs in the clone.
	if _, checkErr := s.repositories.Check(repositoryID); checkErr != nil {
		return "", s.fail("CreateTask", checkErr)
	}

	t, err := s.tasks.Create(ctx, task.CreateParams{
		Name:           req.Name,
		RepositoryID:   repositoryID,
		Mode:           mode,
		InitialContext: initialContext,
		Models:         set,
		ReviewMode:     reviewMode,
		Card:           taskCard,
	})
	if errors.Is(err, task.ErrNameTaken) {
		// A name the user can see is taken is their mistake, with the repository
		// named: nothing to log. It is a sentence, not an error of Go.
		return "", errors.New("A task named " + strings.TrimSpace(req.Name) + " already exists in " + repo.FullName() + ".")
	}
	if err != nil {
		return "", s.fail("CreateTask", err)
	}

	if err := s.flow.StartTask(ctx, t); err != nil {
		failed := s.fail("CreateTask", err)
		deleteErr := s.tasks.Delete(ctx, t.ID)
		if deleteErr != nil {
			s.log.Error("binding failed", "method", "CreateTask", "err", deleteErr)
		}
		return "", undoneFailure(failed, deleteErr)
	}
	return t.ID, nil
}

// undoneFailure is the error of a creation whose first session did not start:
// the failure the user reads, saying the task was undone when its deletion
// worked. A deletion that failed is logged by the caller and not mentioned.
func undoneFailure(failed, deleteErr error) error {
	if deleteErr != nil {
		return failed
	}
	message := failed.Error()
	separator := " "
	if !strings.HasSuffix(message, ".") && !strings.HasSuffix(message, "!") && !strings.HasSuffix(message, "?") {
		separator = ". "
	}
	return errors.New(message + separator + "The task was undone.")
}

// managingRepository is the registered repository of a card, when the board of
// boardID manages it.
func (s *TaskService) managingRepository(boardID string, card board.Card) (repository.Repository, bool) {
	for _, repo := range s.repositories.List() {
		if repo.Identity().Same(repository.Identity{Owner: card.Owner, Name: card.Name}) {
			return repo, repo.BoardID == boardID
		}
	}
	return repository.Repository{}, false
}

// epicOf is the epic of a card as the task keeps it, nil without one.
func epicOf(card board.Card) *task.CardEpic {
	if card.Epic == nil {
		return nil
	}
	e := card.Epic.Issue
	return &task.CardEpic{Owner: e.Owner, Name: e.Name, Number: e.Number, Title: e.Title, URL: e.URL}
}

// DeleteTask stops the session of a task, removes its worktree and its branch,
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

// CloseTask takes down the worktree and the branch of a task whose pull request
// was merged and updates the base branch of its clone. It returns as soon as
// the work is scheduled; what git does arrives as state.
func (s *TaskService) CloseTask(taskID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.CloseTask(ctx, taskID); err != nil {
		return s.fail("CloseTask", err)
	}
	return nil
}

// GetTranscript returns the whole conversation of one session of an item,
// named by its stage. It is how the frontend gets its first one; every later
// change arrives with EventTranscriptChanged.
func (s *TaskService) GetTranscript(taskID, stage string) (Transcript, error) {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	transcript, err := s.sessions.Transcript(ctx, session.Key{TaskID: taskID, Stage: stage})
	// A task past the stages that have a conversation has none, and the
	// frontend asks for it all the same; its stage answers with an empty one.
	// A review or a discussion whose conversation has not opened yet is the
	// same case.
	if errors.Is(err, session.ErrNotFound) {
		if _, ok := s.tasks.Get(taskID); ok || s.hasConversation(taskID) {
			return Transcript{TaskID: taskID, Stage: stage, Entries: []Entry{}, Pending: []Entry{}}, nil
		}
	}
	if err != nil {
		return Transcript{}, s.fail("GetTranscript", err)
	}
	return FromTranscript(transcript), nil
}

// GetActionOutput returns the whole output of an action of one session of an
// item, named by its stage, open or closed.
func (s *TaskService) GetActionOutput(taskID, stage, entryID string) (ActionOutput, error) {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	o, err := s.sessions.ActionOutput(ctx, session.Key{TaskID: taskID, Stage: stage}, entryID)
	if err != nil {
		return ActionOutput{}, s.fail("GetActionOutput", err)
	}
	return ActionOutput{Text: o.Text, Lines: o.Lines, Truncated: o.Truncated}, nil
}

// BackToStage reopens a finished stage of a task, throwing away what came
// after it. The stage is prd, tech_spec or one_shot.
func (s *TaskService) BackToStage(taskID, stage string) error {
	target, err := task.ParseStage(stage)
	if err != nil {
		return s.fail("BackToStage", err)
	}

	// Going back tears down the worktree of the task, which is git work.
	ctx, cancel := context.WithTimeout(context.Background(), removeTimeout)
	defer cancel()

	if err := s.flow.Back(ctx, taskID, target); err != nil {
		return s.fail("BackToStage", err)
	}
	return nil
}

// DiscardStage throws away a stage and everything after it, and starts the
// stage again. The stage is prd, tech_spec, plan or one_shot.
func (s *TaskService) DiscardStage(taskID, stage string) error {
	target, err := task.ParseStage(stage)
	if err != nil {
		return s.fail("DiscardStage", err)
	}

	// Discarding tears down the worktree of the task, which is git work.
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
// message on. The stage names the session: prd, tech_spec, plan, one_shot,
// step:<n>, step_review:<n>, pr or pr_review.
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

// ClearStepReviewMode makes a step that has not started follow the review mode
// of the task again.
func (s *TaskService) ClearStepReviewMode(taskID string, step int) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.ClearStepReviewMode(ctx, taskID, step); err != nil {
		return s.fail("ClearStepReviewMode", err)
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

// OpenInEditor opens the worktree of a task in the editor.
func (s *TaskService) OpenInEditor(taskID string) error {
	worktree, err := s.worktreeOf(taskID)
	if err != nil {
		return s.fail("OpenInEditor", err)
	}
	if err := s.editor(worktree); err != nil {
		return s.fail("OpenInEditor", err)
	}
	return nil
}

// worktreeOf is the worktree a call acts on: the one of the task.
func (s *TaskService) worktreeOf(taskID string) (string, error) {
	path := s.flow.WorktreePath(taskID)
	if path == "" {
		return "", fmt.Errorf("worktree of task %s: %w", taskID, flow.ErrNoWorktree)
	}
	return path, nil
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

// OpenFileInEditor opens one file of the worktree of a task in the editor, in
// the window of that worktree.
func (s *TaskService) OpenFileInEditor(taskID, path string) error {
	worktree, err := s.worktreeOf(taskID)
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
// pull request of the task from it.
func (s *TaskService) OpenPR(taskID, title, body string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.OpenPR(ctx, taskID, title, body); err != nil {
		return s.fail("OpenPR", err)
	}
	return nil
}

// ApprovePR approves the review of the changes a pass of the pull request
// review produced and asks the agent to commit and push them.
func (s *TaskService) ApprovePR(taskID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.ApprovePR(ctx, taskID); err != nil {
		return s.fail("ApprovePR", err)
	}
	return nil
}

// DecidePRFinding records what the user decided about a finding of the
// current pass of the review of the pull request: "approved", "discarded",
// or "" to take the decision back.
func (s *TaskService) DecidePRFinding(taskID string, pass, number int, decision string) error {
	d, err := prreport.ParseDecision(decision)
	if err != nil {
		return s.fail("DecidePRFinding", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.DecidePRFinding(ctx, taskID, pass, number, d); err != nil {
		return s.fail("DecidePRFinding", err)
	}
	return nil
}

// SetPRFindingText replaces the text of a finding of the current pass of the
// review of the pull request.
func (s *TaskService) SetPRFindingText(taskID string, pass, number int, text string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.SetPRFindingText(ctx, taskID, pass, number, text); err != nil {
		return s.fail("SetPRFindingText", err)
	}
	return nil
}

// ApproveRestOfPRFindings approves every finding of the pass that has no
// decision.
func (s *TaskService) ApproveRestOfPRFindings(taskID string, pass int) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.ApproveRestOfPRFindings(ctx, taskID, pass); err != nil {
		return s.fail("ApproveRestOfPRFindings", err)
	}
	return nil
}

// ApplyPRFindings sends the approved findings of the current pass to the agent.
func (s *TaskService) ApplyPRFindings(taskID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.ApplyPRFindings(ctx, taskID); err != nil {
		return s.fail("ApplyPRFindings", err)
	}
	return nil
}

// OpenPRFindingInEditor opens VS Code on the worktree of the task at the line
// of a finding of the review of its pull request.
func (s *TaskService) OpenPRFindingInEditor(taskID string, pass, number int) error {
	finding, err := s.prFindingOf(taskID, pass, number)
	if err != nil {
		return s.fail("OpenPRFindingInEditor", err)
	}
	wt, ok := s.flow.Worktree(taskID)
	if !ok {
		return s.fail("OpenPRFindingInEditor", fmt.Errorf("worktree of task %s: %w", taskID, flow.ErrNoWorktree))
	}
	target := filepath.Join(wt.Path, finding.Path) + ":" + strconv.Itoa(finding.Line)
	if err := s.editor(wt.Path, "-g", target); err != nil {
		return s.fail("OpenPRFindingInEditor", err)
	}
	return nil
}

// prFindingOf is one anchored finding of one pass of the review of the pull
// request of a task, refused when the pass or the finding is gone, or when the
// finding is anchored to nothing.
func (s *TaskService) prFindingOf(taskID string, pass, number int) (prreport.Finding, error) {
	for _, one := range s.tasks.PRPasses(taskID) {
		if one.Pass != pass {
			continue
		}
		for _, finding := range one.Findings {
			if finding.Number != number {
				continue
			}
			if !finding.Anchored() {
				return prreport.Finding{}, fmt.Errorf(
					"open finding %d of pass %d of task %s: %w", number, pass, taskID, errNotAnchored,
				)
			}
			return finding, nil
		}
	}
	return prreport.Finding{}, fmt.Errorf(
		"open finding %d of pass %d of task %s: %w", number, pass, taskID, errFindingNotFound,
	)
}

// ReviewAgain ends the review session of a task and starts a new pass over its
// pull request.
func (s *TaskService) ReviewAgain(taskID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.ReviewAgain(ctx, taskID); err != nil {
		return s.fail("ReviewAgain", err)
	}
	return nil
}

// DiscardDraft throws away the draft of a task and prepares the stage again.
func (s *TaskService) DiscardDraft(taskID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.DiscardDraft(ctx, taskID); err != nil {
		return s.fail("DiscardDraft", err)
	}
	return nil
}

// RetryPR prepares a blocked pull request stage again.
func (s *TaskService) RetryPR(taskID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.RetryPR(ctx, taskID); err != nil {
		return s.fail("RetryPR", err)
	}
	return nil
}

// RefreshPR reads the pull request of a task again. It returns as soon as the
// reading is scheduled; what it finds arrives as state.
func (s *TaskService) RefreshPR(taskID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.flow.RefreshPR(ctx, taskID); err != nil {
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

// modeOf is the mode a new task is conducted in: the one the creation dialog
// sent, or Structured when it sent none.
func modeOf(requested string) (task.Mode, error) {
	if requested == "" {
		return task.ModeStructured, nil
	}
	return task.ParseMode(requested)
}

// userMessages are the failures the user caused, with what the interface shows
// for them.
var userMessages = []struct {
	err     error
	message string
}{
	{task.ErrInvalidName, "Use lowercase letters, digits and single hyphens."},
	{task.ErrNameTaken, "A task with this name already exists in this repository."},
	{task.ErrEmptyContext, "Describe what you want to build."},
	{task.ErrUnknownRepository, "Choose a registered repository."},
	{task.ErrUnknownStage, "Unknown stage."},
	{task.ErrUnknownMode, "Unknown mode."},
	{repository.ErrNotFound, "This repository isn't registered."},
	{repository.ErrCloned, "This repository is already cloned."},
	{repository.ErrNoCloneFolder, "Choose a clone folder first."},
	{board.ErrNotFound, "This board isn't registered."},
	{board.ErrCardNotFound, "This card isn't in the last reading of the board."},
	{models.ErrEmptyModel, "Choose a model."},
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
	{flow.ErrNotInPR, "The task isn't in the pull request stage."},
	{flow.ErrDraftMissing, "The draft isn't ready yet."},
	{flow.ErrEmptyDraft, "Write a title and a description before opening the PR."},
	{flow.ErrPRExists, "The pull request is already open."},
	{flow.ErrNoPullRequest, "The task has no pull request yet."},
	{flow.ErrPRNotBlocked, "The pull request stage isn't blocked."},
	{flow.ErrNotClosable, "The task isn't waiting to be closed."},
	{flow.ErrPRNotMerged, "The pull request hasn't been merged yet."},
	{flow.ErrModelLocked, "The sessions of this stage have already started."},
	{flow.ErrStepStarted, "This step has already started."},
	{flow.ErrReviewModeLocked, "Every step of this task has already started."},
	{flow.ErrAgentReviewing, "The agent is reviewing this step. Review it yourself to approve it."},
	{flow.ErrNoAgentReview, "The agent isn't reviewing this step."},
	{flow.ErrNotDeciding, "These findings can't change now: they went to the agent, or a new pass started."},
	{flow.ErrNotDecided, "Decide every finding first."},
	{flow.ErrNothingApproved, "No finding is approved."},
	{flow.ErrFindingNotFound, "This finding no longer exists."},
	{errPathOutside, "This file is not in the worktree of the task."},
	{errNotAnchored, "This finding isn't about a line of the pull request."},
	{errFindingNotFound, "This finding no longer exists."},
	{prreview.ErrNotFound, "This review no longer exists."},
	{prreview.ErrActiveExists, "This pull request already has a review in MySpec."},
	{prreview.ErrNotDeciding, "This pass is not the one being decided."},
	{prreport.ErrEmptyText, "Write the finding, or discard it."},
	{prreview.ErrUnknownMode, "Unknown review mode."},
	{prreview.ErrUnknownVerdict, "Unknown verdict."},
	{prreport.ErrUnknownDecision, "Unknown decision."},
	{prreview.ErrUnknownArtifact, "Unknown artifact."},
	{reviewflow.ErrPullRequestGone, reviewflow.GoneMessage},
	{reviewflow.ErrNotOpen, reviewflow.NotOpenMessage},
	{reviewflow.ErrFork, "Pull requests from forks can't be reviewed yet."},
	{reviewflow.ErrTaskPullRequest, "This pull request belongs to a task of MySpec. Its review happens in the task."},
	{reviewflow.ErrApplyNotOwn, "Only your own pull request can be fixed in MySpec."},
	{reviewflow.ErrPassRunning, "Wait for the pass under way to finish."},
	{reviewflow.ErrBusy, "Wait for the agent to finish."},
	{reviewflow.ErrNotReady, "The review isn't ready for that."},
	{reviewflow.ErrOwnVerdict, "A pull request of your own can only be commented on."},
	{reviewflow.ErrEmptyReview, "Write a summary before publishing."},
	{reviewflow.ErrNoWorktree, "The worktree of the review is gone."},
	{discussion.ErrNotFound, "This discussion no longer exists."},
	{discussion.ErrEmptyTitle, "Write a title."},
	{discussion.ErrTitleTooLong, "Use at most 120 characters in the title."},
	{discussion.ErrNothingToDiscuss, "Write what to discuss or select at least one card."},
	{discussion.ErrUnknownKind, "Unknown draft kind."},
	{discussion.ErrUnknownDecision, "Unknown decision."},
	{discussion.ErrUnknownArtifact, "Unknown artifact."},
	{discussion.ErrDraftNotFound, "This draft is no longer one of the discussion."},
	{discussion.ErrPublished, "This draft was published and can't change."},
	{discussion.ErrEmptyText, "Write the title and the body of the draft."},
	{discussion.ErrNotEpic, "Choose an epic draft or an existing issue."},
	{discussion.ErrTooFewCards, "Select at least two cards."},
	{discussion.ErrInvalidRef, "Use a draft of this discussion or owner/name#number."},
	{discussion.ErrDependencyLinked, "This dependency is already on GitHub."},
	{discussion.ErrArchived, "This discussion is archived."},
	{discussion.ErrUntitled, "Name the draft to approve it."},
	{discussion.ErrEpicUntitled, "Name the epic to group the drafts."},
	{discussion.ErrEpicTitleTooLong, "Use at most 256 characters in the title of the epic."},
	{discussion.ErrNotGroupable, "One of the drafts can't go into an epic anymore."},
	{discussionflow.ErrPublishing, "A publication is running."},
	{discussionflow.ErrNoReading, "The board hasn't been read yet."},
	{discussionflow.ErrCannotArchive, "This discussion can't be archived yet."},
	{editor.ErrNotFound, "VS Code was not found: `code` isn't on the PATH."},
	{gh.ErrNotFound, "GitHub CLI was not found: `gh` isn't on the PATH."},
	{gh.ErrNotAuthenticated, "GitHub CLI isn't authenticated: run `gh auth login`."},
	{git.ErrNotFound, "Git was not found on the PATH."},
}

// failure is what a failed binding call returns: a mistake the user can
// correct comes back as a sentence for them, anything else is logged and
// passed on.
func failure(log *slog.Logger, method string, err error) error {
	// A folder or a repository the app refuses carries its own sentence, with
	// the path or the name it is about.
	var refusal *repository.Refusal
	if errors.As(err, &refusal) {
		return errors.New(refusal.Message())
	}
	var boardRefusal *board.Refusal
	if errors.As(err, &boardRefusal) {
		return errors.New(boardRefusal.Message())
	}
	// A reading of GitHub that failed says what to do about it; it is the
	// user's environment, not a fault of the app.
	var boardFailure *board.Failure
	if errors.As(err, &boardFailure) {
		return errors.New(boardFailure.Message())
	}
	var pullsFailure *pulls.Failure
	if errors.As(err, &pullsFailure) {
		return errors.New(pullsFailure.Message())
	}
	// A discussion that cannot be archived yet says why in its own words, which
	// is the hint the panel shows next to the button.
	var archive *discussionflow.ArchiveRefusal
	if errors.As(err, &archive) {
		return errors.New(archive.Hint)
	}
	var taken *task.CardTakenError
	if errors.As(err, &taken) {
		return errors.New("Card #" + strconv.Itoa(taken.Number) + " already has an active task: " + taken.TaskName + ".")
	}
	for _, known := range userMessages {
		if errors.Is(err, known.err) {
			return errors.New(known.message)
		}
	}
	log.Error("binding failed", "method", method, "err", err)
	return err
}

func (s *TaskService) fail(method string, err error) error { return failure(s.log, method, err) }
