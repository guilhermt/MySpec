package reviewflow

import (
	"context"
	"fmt"

	"github.com/guilhermt/myspec/internal/divergence"
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/prreport"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/worktree"
)

// Apply asks the agent to fix the findings the user approved, in the worktree
// of the review, for the user to review file by file as they do on a step.
func (s *Service) Apply(ctx context.Context, id string) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	stored, repo, wt, err := s.active(id)
	if err != nil {
		return fmt.Errorf("apply review %s: %w", id, err)
	}
	ref := stored.Reference(repo.FullName())
	state, _ := s.State(id)
	if state.Status != StatusReadyToApply {
		return fmt.Errorf("apply review %s: %w", ref, ErrNotReady)
	}
	sum, err := s.readySession(ctx, stored, repo, wt)
	if err != nil {
		return fmt.Errorf("apply review %s: %w", ref, err)
	}
	if !sum.Idle {
		return fmt.Errorf("apply review %s: %w", ref, ErrBusy)
	}

	last := lastPass(state.Passes)
	approved := last.Approved()
	if err = s.setPhase(ctx, id, prreview.PhaseApplying); err != nil {
		return err
	}
	s.watch.Track(id, wt, true)
	if err = s.sessions.SendFromApp(ctx, sessionKey(id), session.AppMessage{
		Text: prreport.ApplyMessage(last.Number, prreview.ReportFindings(last.Findings)), Kind: session.AppApply, Count: len(approved),
	}); err != nil {
		// The fix never reached the agent: the findings are the user's again.
		s.watch.Forget(id)
		if backErr := s.setPhase(ctx, id, prreview.PhaseNone); backErr != nil {
			s.log.Error("record review phase failed", "review", id, "error", backErr)
		}
		return err
	}

	if err = s.reviews.MarkSent(ctx, id, last.Number); err != nil {
		s.log.Error("record review pass sent failed", "review", id, "pass", last.Number, "error", err)
	}
	approvedCount, discarded := prreport.Counts(prreview.ReportFindings(last.Findings))
	s.sessions.MarkFindingsDecided(ctx, sessionKey(id), last.Number, approvedCount, discarded)
	s.log.Info("review findings applying", "review", id, "pass", last.Number, "findings", len(approved))
	s.notify(id)
	return nil
}

// Approve approves the changes the agent made and asks it to commit them; the
// app pushes the commit to the head of the pull request itself.
func (s *Service) Approve(ctx context.Context, id string) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	stored, repo, wt, err := s.active(id)
	if err != nil {
		return fmt.Errorf("approve review %s: %w", id, err)
	}
	ref := stored.Reference(repo.FullName())
	state, _ := s.State(id)
	if state.Status != StatusReadyToApprove || state.Watch == nil || !state.Watch.Ready() {
		return fmt.Errorf("approve review %s: %w", ref, ErrNotReady)
	}
	sum, err := s.readySession(ctx, stored, repo, wt)
	if err != nil {
		return fmt.Errorf("approve review %s: %w", ref, err)
	}
	if !sum.Idle {
		return fmt.Errorf("approve review %s: %w", ref, ErrBusy)
	}

	return s.askCommit(ctx, stored, wt, ref, state.Watch.Total)
}

// askCommit asks the agent to commit the changes of the worktree and records
// the commit turn. The caller holds the lock of the review.
func (s *Service) askCommit(
	ctx context.Context, stored prreview.Review, wt worktree.Worktree, ref string, files int,
) error {
	id := stored.ID
	message, err := s.renderPrompt(prompts.StageCommit, prompts.Vars{TaskName: ref, ArtifactsDir: stored.ArtifactsDir})
	if err != nil {
		return err
	}
	if stored.PassCommit == "" {
		// git could not say which commit the pass covered: whether a commit
		// went up is told against the head the worktree is on now.
		s.setCommitBase(id, s.headOf(ctx, wt))
	}
	if err = s.setPhase(ctx, id, prreview.PhaseCommitting); err != nil {
		return err
	}
	app := session.AppMessage{Text: message, Kind: session.AppCommit}
	if err = s.sessions.SendFromApp(ctx, sessionKey(id), app); err != nil {
		if backErr := s.setPhase(ctx, id, prreview.PhaseApplying); backErr != nil {
			s.log.Error("record review phase failed", "review", id, "error", backErr)
		}
		return err
	}

	s.sessions.MarkChangesApproved(ctx, sessionKey(id), files)
	s.log.Info("review changes approved", "review", id, "files", files)
	s.notify(id)
	return nil
}

// evaluateApply moves the cycle that applies the findings on: while the agent
// fixes them the watcher reads the worktree, and once a commit turn is over
// the commit it left says whether the cycle goes on to the next pass.
func (s *Service) evaluateApply(ctx context.Context, id string, wt worktree.Worktree, idle bool) {
	stored, ok := s.reviews.Get(id)
	if !ok {
		return
	}
	switch stored.Phase {
	case prreview.PhaseApplying:
		s.watch.Track(id, wt, idle)
		if idle {
			s.evaluateApplied(ctx, stored, wt)
		}
	case prreview.PhaseCommitting:
		if idle {
			s.evaluateCommit(ctx, stored, wt)
		}
	case prreview.PhasePushing, prreview.PhaseNone, prreview.PhaseWaitingChecks:
		// The push is started by the end of the commit, by Sync and by the ways
		// out of a divergence, never by an evaluation. Otherwise the findings
		// are the user's to decide on, the pass is running, or it waits for the
		// checks, which the poll moves on.
	}
}

// evaluateApplied looks at the worktree once the agent rests after the fixes
// were sent: with no file changed and no commit, the approved findings changed
// nothing, which is a divergence; any change ends it. A commit made with
// nothing left to change, as by hand after a missing commit, goes up as the
// commit of the pass.
func (s *Service) evaluateApplied(ctx context.Context, stored prreview.Review, wt worktree.Worktree) {
	snap, read := s.watch.Refresh(stored.ID)
	if !read || snap.Err != "" {
		return
	}
	if sum, open := s.sessions.Summary(sessionKey(stored.ID)); !open || sum.TurnFailed {
		return
	}
	if snap.Total > 0 {
		s.clearDivergence(ctx, stored.ID, divergence.KindNoChanges)
		return
	}
	if snap.Head == "" {
		return
	}
	if base := s.commitBaseOf(stored); base != "" && snap.Head != base {
		s.commitMade(ctx, stored, wt, snap.Head)
		return
	}
	last, ok := s.passOf(stored.ID, stored.ReportedPass)
	if !ok {
		return
	}
	s.diverge(ctx, stored, divergence.KindNoChanges, divergence.Facts{
		Pass: last.Number, Approved: len(last.Approved()),
	})
}

// evaluateCommit decides what became of the commit the app asked for, once
// the turn that makes it is over: no commit is a divergence, and a commit goes
// up to the pull request, which the app pushes itself.
func (s *Service) evaluateCommit(ctx context.Context, stored prreview.Review, wt worktree.Worktree) {
	// Decide on a reading newer than the turn, not on one the debounce owes.
	snap, read := s.watch.Refresh(stored.ID)
	if !read || snap.Err != "" {
		return
	}
	if snap.Head == "" || snap.Head == s.commitBaseOf(stored) {
		if err := s.setPhase(ctx, stored.ID, prreview.PhaseApplying); err != nil {
			s.log.Error("record review phase failed", "review", stored.ID, "error", err)
			return
		}
		s.watch.Track(stored.ID, wt, true)
		s.diverge(ctx, stored, divergence.KindCommitMissing, divergence.Facts{
			Branch: stored.HeadBranch, Commit: task.ShortSHA(s.commitBaseOf(stored)), Files: snap.Total,
		})
		s.log.Warn("review commit did not happen", "review", stored.ID)
		s.notify(stored.ID)
		return
	}
	s.commitMade(ctx, stored, wt, snap.Head)
}

// commitMade takes the commit of a pass up to the pull request.
func (s *Service) commitMade(ctx context.Context, stored prreview.Review, wt worktree.Worktree, head string) {
	id := stored.ID
	// The fixes of the pass are in a commit whatever becomes of the push, and
	// the next pass lists them as applied. The conversation marks the commit
	// only once, here, so that a failed write that is tried again marks it once.
	if err := s.reviews.MarkApplied(ctx, id, stored.ReportedPass); err != nil {
		s.log.Error("mark review pass applied failed", "review", id, "pass", stored.ReportedPass, "error", err)
		return
	}
	if err := s.setPhase(ctx, id, prreview.PhasePushing); err != nil {
		s.log.Error("record review phase failed", "review", id, "error", err)
		return
	}
	s.clearDivergence(ctx, id)
	s.markCommit(ctx, id, wt, head, stored.Number)
	s.watch.Forget(id)
	s.log.Info("review commit made", "review", id, "commit", head)
	s.notify(id)
	s.spawnPush(id)
}

// markCommit records in the conversation the commit of the pass, before it is
// pushed; a commit that cannot be read is recorded without its subject.
func (s *Service) markCommit(ctx context.Context, id string, wt worktree.Worktree, head string, number int) {
	commit := git.Commit{SHA: head}
	read, err := s.worktrees.Commit(ctx, wt, head)
	if err != nil {
		// The commit is a fact of the branch; its subject is a nicety.
		s.log.Warn("read commit failed", "review", id, "error", err)
	} else {
		commit = read
	}
	s.sessions.MarkCommitted(ctx, sessionKey(id), task.ShortSHA(commit.SHA), commit.Subject, false, number)
}

// setPhase records where a review is in the cycle of a pass.
func (s *Service) setPhase(ctx context.Context, id string, phase prreview.Phase) error {
	_, err := s.reviews.Update(ctx, id, func(r *prreview.Review) { r.Phase = phase })
	return err
}

// setCommitBase records the commit the worktree was on when the commit of an
// approval was asked for.
func (s *Service) setCommitBase(id, head string) {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	l.commitBase = head
}

// commitBaseOf is the commit a commit turn of apply mode started from: the one
// the pass covered, or the head read at the approval when git could not say.
func (s *Service) commitBaseOf(stored prreview.Review) string {
	if stored.PassCommit != "" {
		return stored.PassCommit
	}
	l := s.lockOf(stored.ID)

	s.mu.Lock()
	defer s.mu.Unlock()

	return l.commitBase
}
