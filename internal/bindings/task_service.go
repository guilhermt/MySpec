package bindings

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

// TaskService is the task, session and flow API the frontend calls.
type TaskService struct {
	tasks    *task.Service
	sessions *session.Service
	flow     *flow.Service
	log      *slog.Logger
}

// NewTaskService builds the service over the task, session and flow domains.
func NewTaskService(tasks *task.Service, sessions *session.Service, flow *flow.Service, log *slog.Logger) *TaskService {
	return &TaskService{tasks: tasks, sessions: sessions, flow: flow, log: log}
}

// CreateTask creates a task and starts its first stage with the stage prompt.
// A session that fails to start undoes the task, so a half-created one is
// never left behind.
func (s *TaskService) CreateTask(req CreateTaskRequest) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	t, err := s.tasks.Create(ctx, task.CreateParams{
		Name:           req.Name,
		RepoPath:       req.RepoPath,
		InitialContext: req.InitialContext,
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

// DeleteTask stops the session of a task and removes it with its artifacts.
func (s *TaskService) DeleteTask(taskID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.sessions.Close(ctx, taskID); err != nil {
		return s.fail("DeleteTask", err)
	}
	if err := s.tasks.Delete(ctx, taskID); err != nil {
		return s.fail("DeleteTask", err)
	}
	return nil
}

// GetTranscript returns the whole conversation of a task. It is how the
// frontend gets its first one; every later change arrives with
// EventTranscriptChanged.
func (s *TaskService) GetTranscript(taskID string) (Transcript, error) {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	transcript, err := s.sessions.Transcript(ctx, taskID)
	// A task past the stages that have a conversation has none, and the
	// frontend asks for it all the same; its stage answers with an empty one.
	if errors.Is(err, session.ErrNotFound) {
		if t, ok := s.tasks.Get(taskID); ok {
			return Transcript{TaskID: taskID, Stage: string(t.Stage), Entries: []Entry{}, Pending: []Entry{}}, nil
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

	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
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

	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
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

// SendMessage queues a message for the agent, delivered right away when the
// session is free.
func (s *TaskService) SendMessage(taskID, text string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.sessions.Send(ctx, taskID, text); err != nil {
		return s.fail("SendMessage", err)
	}
	return nil
}

// RemovePending drops a queued message before it reaches the agent.
func (s *TaskService) RemovePending(taskID, entryID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.sessions.RemovePending(ctx, taskID, entryID); err != nil {
		return s.fail("RemovePending", err)
	}
	return nil
}

// Interrupt aborts the running turn of a task, leaving the session alive.
func (s *TaskService) Interrupt(taskID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.sessions.Interrupt(ctx, taskID); err != nil {
		return s.fail("Interrupt", err)
	}
	return nil
}

// Pause stops the process of a task and holds every message until Resume.
func (s *TaskService) Pause(taskID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.sessions.Pause(ctx, taskID); err != nil {
		return s.fail("Pause", err)
	}
	return nil
}

// Resume lifts a pause and delivers what was queued meanwhile.
func (s *TaskService) Resume(taskID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.sessions.Resume(ctx, taskID); err != nil {
		return s.fail("Resume", err)
	}
	return nil
}

// Retry clears the last error of a task and starts its process again.
func (s *TaskService) Retry(taskID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.sessions.Retry(ctx, taskID); err != nil {
		return s.fail("Retry", err)
	}
	return nil
}

// AnswerPermission answers the pending permission request of a task. The
// decision is allow, allow_session or deny; message is the reason a denial
// gives the agent.
func (s *TaskService) AnswerPermission(taskID, requestID, decision, message string) error {
	parsed, err := parseDecision(decision)
	if err != nil {
		return s.fail("AnswerPermission", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.sessions.AnswerPermission(ctx, taskID, requestID, parsed, message); err != nil {
		return s.fail("AnswerPermission", err)
	}
	return nil
}

// AnswerQuestion answers the pending structured question of a task, mapping
// each question text to the chosen label.
func (s *TaskService) AnswerQuestion(taskID, requestID string, answers map[string]string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.sessions.AnswerQuestion(ctx, taskID, requestID, answers); err != nil {
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
	{session.ErrEmptyMessage, "Write a message first."},
	{session.ErrPaused, "Resume the task to send messages."},
	{session.ErrNotFound, "This conversation has ended."},
	{flow.ErrInvalidTarget, "This stage can't be reached from here."},
	{flow.ErrNotRevisiting, "The task isn't revisiting a stage."},
	{flow.ErrNotReady, "Wait for the agent to finish and the document to be written."},
}

// fail is what a failed binding call returns: a mistake the user can correct
// comes back as a sentence for them, anything else is logged and passed on.
func (s *TaskService) fail(method string, err error) error {
	for _, known := range userMessages {
		if errors.Is(err, known.err) {
			return errors.New(known.message)
		}
	}
	s.log.Error("binding failed", "method", method, "err", err)
	return err
}
