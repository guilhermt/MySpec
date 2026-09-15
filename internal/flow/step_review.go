package flow

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/reviewmode"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/worktree"
)

// MaxReviewRounds is how many reports with changes the agent review hands to
// the implementer of a step before the step goes to the user. The pass that
// checks the last round is the last one.
const MaxReviewRounds = 3

// The ways the flow refuses to act on the review of a step.
var (
	ErrAgentReviewing   = errors.New("flow: the agent reviews the step")
	ErrNoAgentReview    = errors.New("flow: the agent does not review the step")
	ErrReviewModeLocked = errors.New("flow: every step of the task has started")
)

// noReply stands for an implementer that ended its turn without a word.
const noReply = "(The implementer ended its turn without a message.)"

// reportInstructions close the message that hands a report to the
// implementer: what to do about it.
const reportInstructions = "Address every finding of the report. Fix what you agree with; when you disagree " +
	"with a finding, leave the code as it is and say why. End your response with one line per finding, by its " +
	"number: fixed, or contested and why. Do not commit, stage or push: the commit comes once the review is clean."

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

// implementerReply is what the implementer said last, as the reviewer reads it.
func implementerReply(text string) string {
	if strings.TrimSpace(text) == "" {
		return noReply
	}
	return text
}

// reportMessage is what the app tells the implementer of a step when a pass of
// the agent review found changes: the report, and what to do about it.
func reportMessage(path, content string) string {
	return "The agent review of this step found changes. The report is at `" + path + "`:\n\n" +
		strings.TrimSpace(content) + "\n\n" + reportInstructions
}

// passMessage is what the app tells the reviewer of a step once the implementer
// is done with its last report: what the implementer said, and where the
// report of the new pass goes.
func passMessage(reply, path string) string {
	return "The implementer is done with your last report. Its response:\n\n" + reply + "\n\n" +
		"Review the step again, as the instructions of this session say, and write the report of this pass to `" +
		path + "`."
}

// stepReviewInfo is what the session that reviews a step needs to know: the
// worktree and the file of the step, the report of the pass it is about to
// write and what the implementer said last.
func stepReviewInfo(
	t task.Task, step task.Step, wt worktree.Worktree, pass int, reply string, repos []task.Repository,
) session.TaskInfo {
	info := stepInfo(t, step, wt, repos)
	info.Stage, info.Prompt = session.StepReviewStage(step.Number), prompts.StageStepReview
	info.Repository, info.Branch = repoRel(t, wt.RepoPath), wt.Branch
	info.ReviewPath = t.StepReportPath(step.Number, pass)
	info.ImplementerReply = reply
	info.Choice = t.Models.Stage(models.StepReview)
	return info
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

// openStepReviewer opens the reviewer of a step that had a pass, on the report
// of the last pass asked for, next to the implementer the app opens again.
func (s *Service) openStepReviewer(ctx context.Context, t task.Task, step task.Step, wt worktree.Worktree, run task.StepRun) {
	if run.ReviewPass == 0 {
		return
	}
	info := stepReviewInfo(t, step, wt, run.ReviewPass, "", s.tasks.Repositories(t))
	if err := s.sessions.Open(ctx, info); err != nil {
		s.log.Error("open step review session failed", "task", t.ID, "step", step.Number, "error", err)
	}
}

// evaluateAgentReview drives the agent review of the current step of a task
// once its implementer rests: it asks for a pass, or acts on the report a pass
// left behind. A reviewer that works, asks, is paused or failed is where the
// step waits, and so is a turn of the implementer that failed.
func (s *Service) evaluateAgentReview(
	ctx context.Context, t task.Task, a task.Artifacts, step task.Step, wt worktree.Worktree,
	run task.StepRun, implementer session.Summary, snap review.Snapshot,
) {
	if implementer.TurnFailed {
		return
	}
	if reviewer, open := s.sessions.Summary(stepReviewKey(t.ID, step.Number)); open &&
		(!reviewer.Idle || reviewer.TurnFailed) {
		return
	}
	if run.ReviewPass > run.ReportedPass {
		report, written := reportOf(a.StepReports[step.Number], run.ReviewPass)
		if !written {
			// The reviewer stopped without its report: the user sorts it out in
			// its conversation.
			return
		}
		s.actOnStepReport(ctx, t, step, report)
		return
	}
	if snap.Total == 0 {
		// Nothing to review: the step waits for the user, as it would without
		// the agent review.
		return
	}
	s.askStepPass(ctx, t, step, wt, run)
}

// askStepPass asks the reviewer of a step for the pass after the last report:
// the first one opens its conversation with the prompt, and every later one is
// a message of the app in it.
func (s *Service) askStepPass(ctx context.Context, t task.Task, step task.Step, wt worktree.Worktree, run task.StepRun) {
	pass := run.ReportedPass + 1
	reply := implementerReply(s.sessions.LastReply(stepKey(t.ID, step.Number)))
	// The pass is recorded before it is asked for, so that no evaluation asks
	// for it again while the reviewer starts.
	if _, err := s.tasks.SetStepPass(ctx, t.ID, step.Number, pass); err != nil {
		s.log.Error("record step review pass failed", "task", t.ID, "step", step.Number, "error", err)
		return
	}
	var err error
	if run.ReviewPass == 0 {
		err = s.sessions.Start(ctx, stepReviewInfo(t, step, wt, pass, reply, s.tasks.Repositories(t)), false)
	} else {
		message := passMessage(reply, t.StepReportPath(step.Number, pass))
		err = s.sessions.SendFromApp(ctx, stepReviewKey(t.ID, step.Number), message)
	}
	if err != nil {
		if _, setErr := s.tasks.SetStepPass(ctx, t.ID, step.Number, run.ReviewPass); setErr != nil {
			s.log.Error("record step review pass failed", "task", t.ID, "step", step.Number, "error", setErr)
		}
		s.log.Error("ask step review pass failed", "task", t.ID, "step", step.Number, "pass", pass, "error", err)
		return
	}
	s.log.Info("step review pass asked", "task", t.ID, "step", step.Number, "pass", pass)
}

// actOnStepReport does what the report of the pass under way says: a clean
// one gets the step committed, one with changes goes to the implementer, and
// one with changes after the last round hands the step to the user.
func (s *Service) actOnStepReport(ctx context.Context, t task.Task, step task.Step, report task.ReviewReport) {
	switch {
	case report.Clean:
		s.commitReviewedStep(ctx, t, step, report)
	case report.Pass > MaxReviewRounds:
		if err := s.fallBack(ctx, t.ID, step.Number, task.FallbackRoundsExhausted); err != nil {
			s.log.Error("record step review fallback failed", "task", t.ID, "step", step.Number, "error", err)
			return
		}
		s.recordStepReport(ctx, t.ID, step.Number, report)
	default:
		s.deliverStepReport(ctx, t, step, report)
	}
}

// commitReviewedStep asks the implementer of a step whose report came clean to
// commit every change of the worktree: nobody staged anything.
func (s *Service) commitReviewedStep(ctx context.Context, t task.Task, step task.Step, report task.ReviewReport) {
	vars := commitVars(t, s.tasks.Repositories(t))
	vars.CommitAll = true
	message, err := s.renderPrompt(prompts.StageCommit, vars)
	if err != nil {
		s.log.Error("render commit prompt failed", "task", t.ID, "step", step.Number, "error", err)
		return
	}
	if _, err := s.tasks.SetStepRun(ctx, t.ID, step.Number, task.StepCommitting, nil); err != nil {
		s.log.Error("record committing step failed", "task", t.ID, "step", step.Number, "error", err)
		return
	}
	s.setNoCommit(t.ID, false)
	if err := s.sessions.SendFromApp(ctx, stepKey(t.ID, step.Number), message); err != nil {
		if _, setErr := s.tasks.SetStepRun(ctx, t.ID, step.Number, task.StepStarted, nil); setErr != nil {
			s.log.Error("record started step failed", "task", t.ID, "step", step.Number, "error", setErr)
		}
		s.log.Error("send commit prompt failed", "task", t.ID, "step", step.Number, "error", err)
		return
	}
	s.recordStepReport(ctx, t.ID, step.Number, report)
}

// deliverStepReport hands a report with changes to the implementer of a step,
// which starts the round of that report.
func (s *Service) deliverStepReport(ctx context.Context, t task.Task, step task.Step, report task.ReviewReport) {
	content, err := s.tasks.ReadArtifact(t.ID, task.StepReviewsDirName+"/"+report.File)
	if err != nil {
		s.log.Error("read step review report failed", "task", t.ID, "step", step.Number, "error", err)
		return
	}
	message := reportMessage(t.StepReportPath(step.Number, report.Pass), content)
	if err := s.sessions.SendFromApp(ctx, stepKey(t.ID, step.Number), message); err != nil {
		s.log.Error("send step review report failed", "task", t.ID, "step", step.Number, "error", err)
		return
	}
	s.recordStepReport(ctx, t.ID, step.Number, report)
}

// recordStepReport records that the app acted on the report of a pass and
// marks it in the conversation of the reviewer.
func (s *Service) recordStepReport(ctx context.Context, id string, number int, report task.ReviewReport) {
	if _, err := s.tasks.SetStepReported(ctx, id, number, report.Pass); err != nil {
		s.log.Error("record step review report failed", "task", id, "step", number, "error", err)
		return
	}
	s.sessions.MarkStepReview(ctx, stepReviewKey(id, number), report.Pass, report.Clean)
	s.log.Info("step review written", "task", id, "step", number, "pass", report.Pass, "clean", report.Clean)
}

// fallBack hands the review of a step to the user for good: from here on the
// step is reviewed as in the manual mode, and the reviewer is left alone.
func (s *Service) fallBack(ctx context.Context, id string, number int, reason task.ReviewFallback) error {
	if _, err := s.tasks.SetStepFallback(ctx, id, number, reason); err != nil {
		return err
	}
	s.log.Info("step review fell back", "task", id, "step", number, "reason", string(reason))
	return nil
}

// ReviewStepMyself takes the review of the current step of a task back from
// the agent: the user reviews it from here on, and a pass under way is cut
// short without a report.
func (s *Service) ReviewStepMyself(ctx context.Context, id string) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	t, step, run, err := s.currentStepOf(id)
	if err != nil {
		return err
	}
	if run == nil || run.Status != task.StepStarted || !agentReviewed(t, step.Number, *run) {
		return fmt.Errorf("review step %d of task %s yourself: %w", step.Number, id, ErrNoAgentReview)
	}
	if err := s.fallBack(ctx, id, step.Number, task.FallbackTakenOver); err != nil {
		return err
	}
	key := stepReviewKey(id, step.Number)
	if sum, open := s.sessions.Summary(key); open && run.ReviewPass > run.ReportedPass && sum.TurnRunning {
		if err := s.sessions.Interrupt(ctx, key); err != nil {
			// The mode already changed: whatever the pass writes, nobody reads.
			s.log.Warn("interrupt step review failed", "task", id, "step", step.Number, "error", err)
		}
	}
	return nil
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
