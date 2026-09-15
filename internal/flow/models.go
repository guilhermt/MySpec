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

// StageModels is the model and effort of every stage of a task, in workflow
// order, read against the steps and the repositories the flow reports for it.
func StageModels(t task.Task, steps []StepState, repos []RepoState) []StageModelState {
	before := func(stage task.Stage) bool { return t.Stage.Index() < stage.Index() }
	implementing := t.Stage == task.StageImplementation
	inPR := t.Stage == task.StagePR

	states := make([]StageModelState, 0, len(models.Stages))
	for _, stage := range models.Stages {
		state := StageModelState{Stage: stage, Choice: t.Models.Stage(stage)}
		switch stage {
		case models.PRD:
			// The session of the PRD starts with the task, so there is never a
			// moment in which the user could change it before it starts.
			state.Live = t.Stage == task.StagePRD
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
		case models.PR:
			state.Editable = before(task.StagePR) || (inPR && slices.ContainsFunc(repos, draftToStart))
			state.Live = inPR && slices.ContainsFunc(repos, func(repo RepoState) bool {
				return repo.SessionStage == session.PRStage(repo.Slug)
			})
		case models.PRReview:
			state.Editable = before(task.StagePR) || (inPR && slices.ContainsFunc(repos, reviewToStart))
			state.Live = inPR && slices.ContainsFunc(repos, func(repo RepoState) bool {
				return repo.SessionStage == session.PRReviewStage(repo.Slug)
			})
		}
		states = append(states, state)
	}
	return states
}

// stepHasSession reports whether a step got as far as opening its session.
func stepHasSession(status StepStatus) bool {
	switch status {
	case StepImplementing, StepAwaitingReview, StepInReview, StepReadyToApprove,
		StepNothingToCommit, StepReviewFailed, StepCommitting:
		return true
	default:
		return false
	}
}

// draftToStart reports whether the pull request session of a repository is
// still to start.
func draftToStart(repo RepoState) bool {
	return (repo.Status == RepoPreparing || repo.Status == RepoBlocked) && repo.PR.Number == 0
}

// reviewToStart reports whether the review session of a repository is still
// to start.
func reviewToStart(repo RepoState) bool {
	return repo.Status == RepoPreparing ||
		repo.Status == RepoBlocked ||
		repo.SessionStage == session.PRStage(repo.Slug)
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
	states := StageModels(t, s.Steps(id), s.Repos(id))
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
// repository keeps it to itself.
func (s *Service) SetSessionModel(ctx context.Context, id, stage string, c models.Choice) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	if err := s.sessions.SetChoice(ctx, session.Key{TaskID: id, Stage: stage}, c); err != nil {
		return err
	}
	number, isStep := session.ParseStepStage(stage)
	_, _, isRepo := session.ParsePRStage(stage)
	switch {
	case isStep:
		if _, err := s.tasks.SetStepModel(ctx, id, number, c); err != nil {
			return err
		}
	case isRepo:
		// The choice of one repository is not the choice of the stage: the
		// other repositories of the task keep theirs.
	default:
		if _, err := s.tasks.SetStageModel(ctx, id, models.Stage(stage), c); err != nil {
			return err
		}
	}
	s.log.Info("session model set", "task", id, "stage", stage, "model", string(c.Model), "effort", string(c.Effort))
	return nil
}
