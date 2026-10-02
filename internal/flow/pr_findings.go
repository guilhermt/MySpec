package flow

import (
	"context"
	"errors"
	"fmt"

	"github.com/guilhermt/myspec/internal/prreport"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/worktree"
)

// The ways the flow refuses to act on the findings of the pull request of a task.
var (
	ErrNotDeciding     = errors.New("flow: the findings are not being decided")
	ErrNotDecided      = errors.New("flow: a finding is still to decide")
	ErrNothingApproved = errors.New("flow: no finding is approved")
	ErrFindingNotFound = errors.New("flow: the finding no longer exists")
)

// currentPass is the structured pass the review is on: the one of the highest
// number. A task without a row is in a pass in text, or in none.
func currentPass(passes []task.PRPass) (task.PRPass, bool) {
	if len(passes) == 0 {
		return task.PRPass{}, false
	}
	return passes[len(passes)-1], true
}

// currentPassPtr is currentPass for what takes the pass as a pointer, nil when
// there is none.
func currentPassPtr(passes []task.PRPass) *task.PRPass {
	pass, ok := currentPass(passes)
	if !ok {
		return nil
	}
	return &pass
}

// prOver says the reading of GitHub found the pull request merged or closed.
func prOver(run task.PRRun) bool {
	return run.PR.State == task.PRStateMerged || run.PR.State == task.PRStateClosed
}

// awaitingMerge says whether the review of the pull request of a task is
// over and the task waits for the merge: the review closed clean, or the
// current pass had every finding discarded. What GitHub says about the pull
// request is then what the stage is shown as.
func awaitingMerge(run task.PRRun, pass *task.PRPass) bool {
	return run.Status == task.PRDone ||
		(run.Status == task.PRReviewing && pass != nil && pass.AllDiscarded())
}

// structuredStatus is a pull request under review in a structured pass, at
// rest: the report the agent owes, the findings the user decides, the changes
// the agent made, or, with every finding discarded and nothing changed, the
// wait for the merge, as after a clean pass.
func structuredStatus(run task.PRRun, pass task.PRPass, snap review.Snapshot, read bool) PRStatus {
	changed := read && snap.Err == "" && snap.Total > 0
	switch {
	case !pass.Recorded:
		return PRAwaitingReply
	case pass.Clean:
		return PRDone // transient: the evaluation that follows finishes the review
	case pass.Sent():
		if !changed {
			return PRInReview // the agent changed nothing: No file changed
		}
		return changesStatus(snap)
	case !pass.Decided() || len(pass.Approved()) > 0:
		return PRAwaitingDecision
	case changed:
		return changesStatus(snap)
	default:
		return awaitingStatus(run)
	}
}

// evaluateReport keeps the current structured pass in step with its report:
// it records the first readable one, and reads the report of a pass being
// decided again, which is how a rewrite the user asked for in the
// conversation reaches the findings. ok is false while the report is not
// recorded.
func (s *Service) evaluateReport(
	ctx context.Context, t task.Task, wt worktree.Worktree, run task.PRRun, key session.Key, idle bool,
	pass task.PRPass,
) (task.PRRun, task.PRPass, bool) {
	switch {
	case !pass.Recorded:
		if !idle {
			return run, pass, false
		}
		report, found, err := prreport.ReadReport(t.ReviewPath(pass.Pass), pass.Pass)
		if err != nil {
			s.reportUnreadable(t.ID, pass.Pass, err)
			return run, pass, false
		}
		if !found {
			return run, pass, false
		}
		return s.recordReportOf(ctx, t, wt, run, key, report)

	case idle && !pass.Clean && !pass.Sent():
		report, found, err := prreport.ReadReport(t.ReviewPath(pass.Pass), pass.Pass)
		if err != nil {
			// What was recorded stays: the user decides on it.
			s.reportUnreadable(t.ID, pass.Pass, err)
			return run, pass, true
		}
		if !found {
			return run, pass, true
		}
		settled := s.setUnreadable(t.ID, "")
		updated, changed, err := s.tasks.RecordPRReport(ctx, t.ID, report)
		if err != nil {
			s.log.Error("record pr review report failed", "task", t.ID, "pass", pass.Pass, "error", err)
			return run, pass, true
		}
		if changed {
			s.sessions.MarkPRReviewRevised(ctx, key, pass.Pass, report.Clean, len(report.Findings))
			s.log.Info("pr review report rewritten",
				"task", t.ID, "pass", pass.Pass, "revision", updated.Revision, "findings", len(updated.Findings))
		}
		if settled && !changed {
			s.notify(t.ID)
		}
		return run, updated, true

	default:
		return run, pass, true
	}
}

// recordReportOf records the first readable report of the current structured
// pass. The pass is first recorded as reported, with the commit the branch is
// on as the one the report covered, and only then is the report recorded: the
// next pass is numbered from the pass reported, so a report recorded on a pass
// not reported would have the review ask for that same pass again, which the
// tasks refuse. A report that can't be recorded leaves the pass reported and
// waiting for its report, which the evaluation that follows records, keeping
// the commit recorded first; a pass asked before that becomes the current
// one and leaves it behind.
func (s *Service) recordReportOf(
	ctx context.Context, t task.Task, wt worktree.Worktree, run task.PRRun, key session.Key, report prreport.Report,
) (task.PRRun, task.PRPass, bool) {
	if run.ReportedPass < report.Pass {
		updated, err := s.tasks.SetPRReviewed(ctx, t.ID, s.headOf(ctx, wt), report.Pass)
		if err != nil {
			s.log.Error("record reviewed pull request failed", "task", t.ID, "error", err)
			return run, task.PRPass{}, false
		}
		run = updated
	}
	recorded, _, err := s.tasks.RecordPRReport(ctx, t.ID, report)
	if err != nil {
		s.log.Error("record pr review report failed", "task", t.ID, "pass", report.Pass, "error", err)
		return run, task.PRPass{}, false
	}
	s.setPassAsked(t.ID, "")
	s.setUnreadable(t.ID, "")
	s.sessions.MarkPRReview(ctx, key, report.Pass, report.Clean, len(report.Findings))
	s.log.Info("pr review report recorded",
		"task", t.ID, "pass", report.Pass, "clean", report.Clean, "findings", len(report.Findings))
	return run, recorded, true
}

// reportUnreadable keeps why the report of the current structured pass could
// not be read, so that the review says it instead of waiting for a report that
// will never come.
func (s *Service) reportUnreadable(id string, pass int, err error) {
	if !errors.Is(err, prreport.ErrUnreadable) {
		s.log.Error("read pr review report failed", "task", id, "pass", pass, "error", err)
		return
	}
	s.log.Warn("pr review report is unreadable", "task", id, "pass", pass, "error", err)
	if s.setUnreadable(id, prreport.Reason(err)) {
		s.notify(id)
	}
}

// unreadable is why the report of the current structured pass, or its rewrite,
// can't be read, "" when it can.
func (s *Service) unreadable(id string) string {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	return l.unreadable
}

// setUnreadable records why the report of the current structured pass can't be
// read, "" once one is, and says whether that changed.
func (s *Service) setUnreadable(id, reason string) bool {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	changed := l.unreadable != reason
	l.unreadable = reason
	return changed
}

// deciding says whether the user may act on pass number, refusing when it is
// not the current one or the current one can't be decided. The caller holds
// the lock of the task.
func (s *Service) deciding(id string, number int) error {
	pass, _ := currentPass(s.tasks.PRPasses(id))
	if err := s.decidable(id, pass); err != nil {
		return err
	}
	if pass.Pass != number {
		return fmt.Errorf("findings of pass %d of task %s: %w", number, id, ErrNotDeciding)
	}
	return nil
}

// decidable says whether the user may act on the current pass, refusing when
// there is none, it was not recorded, is clean or already went to the agent,
// or when the pull request is not under review or is over. The caller holds
// the lock of the task.
func (s *Service) decidable(id string, pass task.PRPass) error {
	_, run, err := s.prOf(id)
	if err != nil {
		return err
	}
	if !pass.Recorded || pass.Clean || pass.Sent() || run.Status != task.PRReviewing || prOver(run) {
		return fmt.Errorf("findings of pass %d of task %s: %w", pass.Pass, id, ErrNotDeciding)
	}
	return nil
}

// DecidePRFinding records what the user decided about one finding of the
// current pass of the review of the pull request of a task.
func (s *Service) DecidePRFinding(ctx context.Context, id string, pass, number int, d prreport.Decision) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	if err := s.deciding(id, pass); err != nil {
		return err
	}
	return findingGone(s.tasks.DecidePRFinding(ctx, id, pass, number, d))
}

// SetPRFindingText records the text of one finding as the user left it, which
// is what Apply approved sends.
func (s *Service) SetPRFindingText(ctx context.Context, id string, pass, number int, text string) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	if err := s.deciding(id, pass); err != nil {
		return err
	}
	return findingGone(s.tasks.SetPRFindingText(ctx, id, pass, number, text))
}

// findingGone tells a finding a rewrite of the report removed: the task and its
// pass were found under the lock, so what the tasks no longer find is the
// finding.
func findingGone(err error) error {
	if errors.Is(err, task.ErrNotFound) {
		return fmt.Errorf("%w: %w", ErrFindingNotFound, err)
	}
	return err
}

// ApproveRestOfPRFindings approves every finding of the current pass that has
// no decision yet.
func (s *Service) ApproveRestOfPRFindings(ctx context.Context, id string, pass int) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	if err := s.deciding(id, pass); err != nil {
		return err
	}
	return s.tasks.ApproveRestOfPRFindings(ctx, id, pass)
}

// ApplyPRFindings sends the agent the findings of the current pass the user
// approved, with the ones they discarded, and the review goes on as after any
// pass: the changes, the commit and the next pass.
func (s *Service) ApplyPRFindings(ctx context.Context, id string) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	current, _ := currentPass(s.tasks.PRPasses(id))
	if err := s.decidable(id, current); err != nil {
		return fmt.Errorf("apply the findings of task %s: %w", id, err)
	}
	if !current.Decided() {
		return fmt.Errorf("apply the findings of task %s: %w", id, ErrNotDecided)
	}
	if len(current.Approved()) == 0 {
		return fmt.Errorf("apply the findings of task %s: %w", id, ErrNothingApproved)
	}

	key := session.Key{TaskID: id, Stage: session.PRReviewStage}
	sum, err := s.readySession(ctx, key)
	if err != nil {
		return fmt.Errorf("apply the findings of task %s: %w", id, err)
	}
	if !sum.Idle {
		return fmt.Errorf("apply the findings of task %s: %w", id, ErrStepBusy)
	}
	// Nothing was written until here: a refusal leaves the findings as they were.

	if err := s.tasks.MarkPRPassSent(ctx, id, current.Pass); err != nil {
		return fmt.Errorf("apply the findings of task %s: %w", id, err)
	}
	approved, discarded := prreport.Counts(current.Findings)
	s.sessions.MarkFindingsDecided(ctx, key, current.Pass, approved, discarded)
	app := session.AppMessage{
		Text: prreport.ApplyMessage(current.Pass, current.Findings), Kind: session.AppApply, Count: approved,
	}
	if err := s.sessions.SendFromApp(ctx, key, app); err != nil {
		if unmarkErr := s.tasks.UnmarkPRPassSent(ctx, id, current.Pass); unmarkErr != nil {
			s.log.Error("unmark sent pr review pass failed", "task", id, "pass", current.Pass, "error", unmarkErr)
		}
		return fmt.Errorf("apply the findings of task %s: %w", id, err)
	}
	s.log.Info("pr review findings applying",
		"task", id, "pass", current.Pass, "approved", approved, "discarded", discarded)
	return nil
}
