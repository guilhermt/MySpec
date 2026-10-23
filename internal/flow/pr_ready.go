package flow

import (
	"cmp"
	"context"
	"fmt"

	"github.com/guilhermt/myspec/internal/divergence"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/prreport"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/worktree"
)

// prResolved says whether the user is done with the current pass of a pull
// request reviewed by hand: every finding was discarded, or the approved ones
// went to the implementer and its work either changed the worktree or was
// adopted as applied.
func prResolved(pass task.PRPass) bool {
	return pass.Recorded && !pass.Clean && (pass.AllDiscarded() || (pass.Sent() && pass.Changed))
}

// checksGreen says whether a reading of the pull request shows nothing to
// review again: no check runs or failed, and no conflict.
func checksGreen(c gh.PRChecks) bool {
	return !c.Pending() && len(c.Failed()) == 0 && !c.Conflicting()
}

// settled says whether the worktree of a task has nothing left to commit or
// merge and its commit is on the remote: what a review ended by the real state
// has to find.
func (s *Service) settled(ctx context.Context, t task.Task, wt worktree.Worktree, run task.PRRun) (head string, ok bool) {
	status, err := s.worktrees.Status(ctx, wt)
	if err != nil {
		s.log.Warn("read worktree failed", "task", t.ID, "path", wt.Path, "error", err)
		return "", false
	}
	if !status.Clean() {
		return status.Head, false
	}
	merging, err := s.worktrees.Merging(ctx, wt)
	if err != nil {
		s.log.Warn("read merge state failed", "task", t.ID, "path", wt.Path, "error", err)
		return status.Head, false
	}
	return status.Head, !merging && s.pushed(ctx, wt, cmp.Or(run.PR.Head, wt.Branch))
}

// resolvedWithoutCommit ends the review of a pull request reviewed by hand
// whose current pass the user resolved without a commit: the worktree is clean
// and on the commit the pass covered, so there is nothing to review again. Only
// a check that fails after this, or a new conflict, takes the task out of ready.
// It reports whether it ended the review. Both sessions rest.
func (s *Service) resolvedWithoutCommit(
	ctx context.Context, t task.Task, wt worktree.Worktree, run task.PRRun, pass task.PRPass,
) bool {
	if prAgentReviewed(t, run) || !prResolved(pass) || !pass.Sent() {
		return false
	}
	head, ok := s.settled(ctx, t, wt, run)
	if !ok || head == "" || head != run.ReviewedCommit {
		return false
	}
	reading := lastReading(run)
	if reading == nil {
		reading = &gh.PRChecks{}
	}
	s.recordBaseline(ctx, t.ID, reading)
	s.finishReview(ctx, t, run, prReviewKey(t.ID))
	return true
}

// resolvedByCommit ends the review of a pull request reviewed by hand whose
// current pass the user resolved and committed: when the checks of that commit
// are green, no pass has anything left to find, and the commit is covered
// without asking for one. It reports whether it ended the review.
func (s *Service) resolvedByCommit(
	ctx context.Context, t task.Task, wt worktree.Worktree, run task.PRRun, head string, checks *gh.PRChecks,
) bool {
	pass, ok := currentPass(s.tasks.PRPasses(t.ID))
	if !ok || prAgentReviewed(t, run) || !prResolved(pass) || !checksGreen(*checks) {
		return false
	}
	if _, settled := s.settled(ctx, t, wt, run); !settled {
		return false
	}
	covered, err := s.tasks.SetPRReviewed(ctx, t.ID, head, run.ReportedPass)
	if err != nil {
		s.log.Error("record reviewed pull request failed", "task", t.ID, "error", err)
		return false
	}
	s.recordBaseline(ctx, t.ID, checks)
	s.markChecks(ctx, prReviewKey(t.ID), covered.ReportedPass, checks)
	s.finishReview(ctx, t, covered, prReviewKey(t.ID))
	return true
}

// evaluatePassWork keeps up with the work of the implementer on a pass sent to
// it: the first reading of the worktree with changes records that the pass
// changed something, and a reading without any, on the commit the pass covered,
// is a divergence, because the approved findings led to nothing. It only reads
// the worktree once the implementer rests.
func (s *Service) evaluatePassWork(
	ctx context.Context, t task.Task, run task.PRRun, pass task.PRPass,
) {
	if prAgentReviewed(t, run) || !pass.Recorded || pass.Clean || !pass.Sent() || pass.Changed {
		return
	}
	fixer, open := s.sessions.Summary(prFixKey(t.ID))
	if !open || !fixer.Idle || fixer.TurnFailed {
		return
	}
	snap, read := s.review.Refresh(t.ID)
	if !read || snap.Err != "" {
		return
	}
	switch {
	case snap.Total > 0:
		if err := s.tasks.SetPRPassChanged(ctx, t.ID, pass.Pass); err != nil {
			s.log.Error("record changed pr review pass failed", "task", t.ID, "pass", pass.Pass, "error", err)
			return
		}
		s.clearDivergence(ctx, t.ID, divergence.KindNoChanges)
	case snap.Head != "" && snap.Head == run.ReviewedCommit:
		s.diverge(ctx, t, session.PRFixStage, divergence.KindNoChanges, divergence.Facts{
			Pass: pass.Pass, Approved: len(pass.Approved()),
		})
	}
}

// askPassWorkAgain sends the implementer the approved findings of a pass it
// changed nothing for, once more. The caller holds the lock of the task.
func (s *Service) askPassWorkAgain(ctx context.Context, d divergence.Divergence) error {
	t, run, err := s.prOf(d.ItemID)
	if err != nil {
		return err
	}
	pass, ok := currentPass(s.tasks.PRPasses(d.ItemID))
	if !ok || pass.Pass != d.Facts.Pass || !pass.Sent() || run.Status != task.PRReviewing {
		return fmt.Errorf("ask again about the pass of task %s: %w", d.ItemID, ErrNotDeciding)
	}
	if err = s.fixerAtRest(ctx, d.ItemID); err != nil {
		return fmt.Errorf("ask again about the pass of task %s: %w", d.ItemID, err)
	}
	if err = s.tasks.MarkPRPassSent(ctx, d.ItemID, pass.Pass); err != nil {
		return err
	}
	if err = s.divergences.Clear(ctx, d.ItemID, divergence.KindNoChanges); err != nil {
		return err
	}
	approved, _ := prreport.Counts(pass.Findings)
	app := session.AppMessage{
		Text: prreport.FixMessage(pass.Pass, pass.Findings), Kind: session.AppApply, Count: approved,
	}
	if err = s.sendToFixer(ctx, t, run, app, nil); err != nil {
		s.reopen(ctx, d)
		return err
	}
	s.log.Info("pr review findings applying again", "task", d.ItemID, "pass", pass.Pass, "approved", approved)
	return nil
}

// adoptPassWork takes the pass as applied although no file changed: the user
// decided the findings needed nothing. The caller holds the lock of the task.
func (s *Service) adoptPassWork(ctx context.Context, d divergence.Divergence) error {
	if err := s.tasks.SetPRPassChanged(ctx, d.ItemID, d.Facts.Pass); err != nil {
		return err
	}
	if err := s.divergences.Clear(ctx, d.ItemID, divergence.KindNoChanges); err != nil {
		return err
	}
	s.log.Info("pr review pass adopted as applied", "task", d.ItemID, "pass", d.Facts.Pass)
	s.Check(d.ItemID)
	return nil
}

// askPRReportAgain asks the reviewer of a pull request for the report of the
// pass under way once more. The pass counts as asked for before the message, so
// that no commit asks for another meanwhile, and a send that fails brings the
// divergence back. The caller holds the lock of the task.
func (s *Service) askPRReportAgain(ctx context.Context, d divergence.Divergence) error {
	t, run, err := s.prOf(d.ItemID)
	if err != nil {
		return err
	}
	pass, ok := currentPass(s.tasks.PRPasses(d.ItemID))
	if !ok || pass.Recorded || pass.Pass != d.Facts.Pass || run.Status != task.PRReviewing {
		return fmt.Errorf("ask again about the pass of task %s: %w", d.ItemID, ErrNotDeciding)
	}
	key := prReviewKey(d.ItemID)
	if _, err = s.readySession(ctx, key); err != nil {
		return fmt.Errorf("ask again about the pass of task %s: %w", d.ItemID, err)
	}
	previous := s.passAsked(d.ItemID)
	if wt, found := s.worktrees.Get(d.ItemID); found {
		s.setPassAsked(d.ItemID, cmp.Or(s.headOf(ctx, wt), passAskedWithoutHead))
	}
	if err = s.divergences.Clear(ctx, d.ItemID, reportKinds...); err != nil {
		s.setPassAsked(d.ItemID, previous)
		return err
	}
	message := session.AppMessage{
		Kind: session.AppAgain, Pass: pass.Pass,
		Text: reportAgainMessage(pass.Pass, t.ReviewPath(pass.Pass), d.Facts.Reason),
	}
	if err = s.sessions.SendFromApp(ctx, key, message); err != nil {
		s.setPassAsked(d.ItemID, previous)
		s.reopen(ctx, d)
		return err
	}
	s.log.Info("pr review report asked again", "task", d.ItemID, "pass", pass.Pass)
	return nil
}
