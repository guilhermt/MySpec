package flow

import (
	"context"
	"errors"
	"fmt"
	"slices"

	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/reviewmode"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

// The ways the flow refuses to act on the review of a step.
var (
	ErrReviewModeLocked = errors.New("flow: every step of the task has started")
)

// stepReviewKey is the session that reviews one step of a task.
func stepReviewKey(taskID string, number int) session.Key {
	return session.Key{TaskID: taskID, Stage: session.StepReviewStage(number)}
}

// agentReviewed reports whether the agent reviews a step now: the step runs in
// agent mode and nothing took its review back to the user.
func agentReviewed(t task.Task, number int, run task.StepRun) bool {
	return t.ReviewModes.Step(number) == reviewmode.Agent && run.Fallback == ""
}

// reportOf is the report of one pass, if it was written.
func reportOf(reports []task.ReviewReport, pass int) (task.ReviewReport, bool) {
	index := slices.IndexFunc(reports, func(r task.ReviewReport) bool { return r.Pass == pass })
	if index < 0 {
		return task.ReviewReport{}, false
	}
	return reports[index], true
}

// agentState fills in what a started step under the agent review is shown as:
// the pass under way, the report the implementer addresses, or what the
// worktree says once the implementer rests with no pass to ask for.
func agentState(state *StepState, run task.StepRun, implementerIdle bool, snap review.Snapshot, read bool) {
	switch {
	case run.ReviewPass > run.ReportedPass:
		state.Status, state.ReviewPass = StepAgentReview, run.ReviewPass
		_, written := reportOf(state.Reports, run.ReviewPass)
		state.ReportMissing = state.ReviewerStage != "" && state.Reviewer.Idle && !state.Reviewer.TurnFailed && !written
	case implementerIdle && read && snap.Err != "":
		state.Status = StepReviewFailed
	case implementerIdle && read && snap.Total == 0:
		state.Status = StepNothingToCommit
	case run.ReportedPass > 0:
		// Also the moment between the implementer coming to rest and the pass
		// the evaluation that follows asks for.
		state.Status, state.ReviewRound = StepAddressingReview, run.ReportedPass
	default:
		state.Status = StepImplementing
	}
}

// ReviewModeEditable reports whether a change of the review mode of a task
// still reaches a step: the plan is still to come, or a step of it has not
// started.
func ReviewModeEditable(t task.Task, steps []StepState) bool {
	if t.Stage.Index() < task.StageImplementation.Index() {
		return true
	}
	return t.Stage == task.StageImplementation && slices.ContainsFunc(steps, StepState.ModeEditable)
}

// SetReviewMode changes the review mode of a task, for the steps still to
// start that have no mode of their own.
func (s *Service) SetReviewMode(ctx context.Context, id string, mode reviewmode.Mode) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	t, ok := s.tasks.Get(id)
	if !ok {
		return fmt.Errorf("set the review mode of task %s: %w", id, task.ErrNotFound)
	}
	if !ReviewModeEditable(t, s.Steps(id)) {
		return fmt.Errorf("set the review mode of task %s: %w", id, ErrReviewModeLocked)
	}
	if _, err := s.tasks.SetReviewMode(ctx, id, mode); err != nil {
		return err
	}
	return nil
}

// SetStepReviewMode changes the review mode of a step that has not started.
func (s *Service) SetStepReviewMode(ctx context.Context, id string, number int, mode reviewmode.Mode) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	if _, ok := s.tasks.Get(id); !ok {
		return fmt.Errorf("set the review mode of step %d: %w", number, task.ErrNotFound)
	}
	steps := s.Steps(id)
	index := slices.IndexFunc(steps, func(st StepState) bool { return st.Step.Number == number })
	if index < 0 {
		return fmt.Errorf("set the review mode of step %d of task %s: %w", number, id, ErrNoStep)
	}
	if !steps[index].ModeEditable() {
		return fmt.Errorf("set the review mode of step %d of task %s: %w", number, id, ErrStepStarted)
	}
	if _, err := s.tasks.SetStepReviewMode(ctx, id, number, mode); err != nil {
		return err
	}
	return nil
}
