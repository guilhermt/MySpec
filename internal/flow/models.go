package flow

import (
	"context"
	"errors"
	"fmt"
	"slices"

	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

// The ways the flow refuses to change a model.
var (
	ErrModelLocked = errors.New("flow: every session of the stage has started")
	ErrStepStarted = errors.New("flow: the step has started")
)

// StageModelState is the model and effort of one stage of a task, with what
// the user can still do about it.
type StageModelState struct {
	Stage  models.Stage
	Choice models.Choice
	// Editable says a session of the stage is still to start, and a change of
	// the stage reaches it.
	Editable bool
	// Live says a session of the stage runs now: its model changes in its
	// conversation.
	Live bool
}

// StageModels is the model and effort of every stage of the mode of a task, in
// order, read against the steps and the pull request the flow reports for it.
func StageModels(t task.Task, steps []StepState, pr *PullRequest) []StageModelState {
	before := func(stage task.Stage) bool { return t.Mode.Index(t.Stage) < t.Mode.Index(stage) }
	implementing := t.Stage == task.StageImplementation
	inPR := t.Stage == task.StagePR

	stages := t.Mode.ModelStages()
	states := make([]StageModelState, 0, len(stages))
	for _, stage := range stages {
		state := StageModelState{Stage: stage, Choice: t.Models.Stage(stage)}
		switch stage {
		case models.PRD:
			// The session of the PRD starts with the task, so there is never a
			// moment in which the user could change it before it starts.
			state.Live = t.Stage == task.StagePRD
		case models.OneShot:
			// The session of the One-Shot planning starts with the task, so there
			// is never a moment in which the user could change it before it starts.
			state.Live = t.Stage == task.StageOneShot
		case models.TechSpec:
			state.Editable = before(task.StageTechSpec)
			state.Live = t.Stage == task.StageTechSpec
		case models.Plan:
			state.Editable = before(task.StagePlan)
			state.Live = t.Stage == task.StagePlan
		case models.Implementation:
			state.Editable = before(task.StageImplementation) ||
				(implementing && slices.ContainsFunc(steps, func(st StepState) bool { return st.ModelEditable() }))
			state.Live = implementing &&
				slices.ContainsFunc(steps, func(st StepState) bool { return stepHasSession(st.Status) })
		case models.StepReview:
			// A reviewer starts with the choice the task has at its first pass, so a
			// change reaches every step still to be committed.
			state.Editable = before(task.StageImplementation) ||
				(implementing && slices.ContainsFunc(steps, func(st StepState) bool { return st.Status != StepDone }))
			state.Live = implementing &&
				slices.ContainsFunc(steps, func(st StepState) bool { return st.ReviewerStage != "" })
		case models.PR:
			state.Editable = before(task.StagePR) || (inPR && pr != nil && draftToStart(*pr))
			state.Live = inPR && pr != nil && pr.SessionStage == session.PRStage
		case models.PRReview:
			state.Editable = before(task.StagePR) || (inPR && pr != nil && reviewToStart(*pr))
			state.Live = inPR && pr != nil && pr.SessionStage == session.PRReviewStage
		case models.Discussion:
			// The discussion is an item of its own, so it is no stage of a mode
			// and never reaches this loop.
		}
		states = append(states, state)
	}
	return states
}

// stepHasSession reports whether a step got as far as opening its session.
func stepHasSession(status StepStatus) bool {
	switch status {
	case StepImplementing, StepAgentReview, StepAddressingReview, StepAwaitingReview, StepInReview,
		StepReadyToApprove, StepNothingToCommit, StepReviewFailed, StepCommitting:
		return true
	default:
		return false
	}
}

// draftToStart reports whether the pull request session of a task is still to
// start.
func draftToStart(pr PullRequest) bool {
	return (pr.Status == PRPreparing || pr.Status == PRBlocked) && pr.PR.Number == 0
}

// reviewToStart reports whether the review session of a task is still to start.
func reviewToStart(pr PullRequest) bool {
	return pr.Status == PRPreparing ||
		pr.Status == PRBlocked ||
		pr.SessionStage == session.PRStage
}

// SetStageModel changes the model and effort of a stage of a task, for the
// sessions of it that are still to start.
func (s *Service) SetStageModel(ctx context.Context, id string, stage models.Stage, c models.Choice) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	t, ok := s.tasks.Get(id)
	if !ok {
		return fmt.Errorf("set the model of %s: %w", stage, task.ErrNotFound)
	}
	pr, hasPR := s.PullRequest(id)
	var prPointer *PullRequest
	if hasPR {
		prPointer = &pr
	}
	states := StageModels(t, s.Steps(id), prPointer)
	index := slices.IndexFunc(states, func(st StageModelState) bool { return st.Stage == stage })
	if index < 0 {
		return fmt.Errorf("set the model of %s in task %s: %w", stage, id, models.ErrUnknownStage)
	}
	if !states[index].Editable {
		return fmt.Errorf("set the model of %s in task %s: %w", stage, id, ErrModelLocked)
	}
	if _, err := s.tasks.SetStageModel(ctx, id, stage, c); err != nil {
		return err
	}
	return nil
}

// SetStepModel changes the model and effort of a step that has not started.
func (s *Service) SetStepModel(ctx context.Context, id string, number int, c models.Choice) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	if _, ok := s.tasks.Get(id); !ok {
		return fmt.Errorf("set the model of step %d: %w", number, task.ErrNotFound)
	}
	steps := s.Steps(id)
	index := slices.IndexFunc(steps, func(st StepState) bool { return st.Step.Number == number })
	if index < 0 {
		return fmt.Errorf("set the model of step %d of task %s: %w", number, id, ErrNoStep)
	}
	if !steps[index].ModelEditable() {
		return fmt.Errorf("set the model of step %d of task %s: %w", number, id, ErrStepStarted)
	}
	if _, err := s.tasks.SetStepModel(ctx, id, number, c); err != nil {
		return err
	}
	return nil
}

// SetSessionModel changes the model and effort of a live session from its next
// message on. A session of a planning stage or of a step carries the change to
// its stage or its step, so that starting it over keeps it; a session of a
// reviewer, of the PR stage or of the review of a pull request keeps it to
// itself.
func (s *Service) SetSessionModel(ctx context.Context, id, stage string, c models.Choice) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	if err := s.sessions.SetChoice(ctx, session.Key{TaskID: id, Stage: stage}, c); err != nil {
		return err
	}
	number, isStep := session.ParseStepStage(stage)
	_, isReviewer := session.ParseStepReviewStage(stage)
	switch {
	case isStep:
		if _, err := s.tasks.SetStepModel(ctx, id, number, c); err != nil {
			return err
		}
	case isReviewer, stage == session.PRStage, stage == session.PRReviewStage, stage == session.ReviewStage:
		// The choice of one reviewer, of the PR stage or of the review of a pull
		// request is not the choice of a stage: the others keep theirs.
	default:
		if _, err := s.tasks.SetStageModel(ctx, id, models.Stage(stage), c); err != nil {
			return err
		}
	}
	s.log.Info("session model set", "task", id, "stage", stage, "model", string(c.Model), "effort", string(c.Effort))
	return nil
}
