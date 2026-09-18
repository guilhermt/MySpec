package reviewflow

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/prreview"
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
	if err = s.sessions.SendFromApp(ctx, sessionKey(id), applyMessage(last.Number, approved)); err != nil {
		// The fix never reached the agent: the findings are the user's again.
		s.watch.Forget(id)
		if backErr := s.setPhase(ctx, id, prreview.PhaseNone); backErr != nil {
			s.log.Error("record review phase failed", "review", id, "error", backErr)
		}
		return err
	}

	s.log.Info("review findings applying", "review", id, "pass", last.Number, "findings", len(approved))
	s.notify(id)
	return nil
}

// applyMessage is what the app says to the conversation of a review when the
// user asks for the findings they approved to be fixed.
func applyMessage(pass int, approved []prreview.Finding) string {
	lines := make([]string, 0, len(approved))
	for _, finding := range approved {
		location := "(general)"
		if finding.Anchored() {
			location = fmt.Sprintf("`%s:%d`", finding.Path, finding.Line)
		}
		lines = append(lines, fmt.Sprintf("%d. %s — %s", finding.Number, location, strings.TrimSpace(finding.Text)))
	}
	return "The user decided on the findings of pass " + strconv.Itoa(pass) + ". Implement only the ones " +
		"below, and only that: no drive-by changes, no refactoring nobody asked for. Do not commit, do not " +
		"run `git add` and do not push: the user reviews the changes in the app. When you are done, say in a " +
		"few lines what you changed.\n\n## Approved findings\n" + strings.Join(lines, "\n")
}

// Approve approves the changes the agent made and asks it to commit them and
// push them to the head of the pull request.
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

	// The worktree is on a detached HEAD: the commit goes up to the branch of
	// the pull request by name.
	message, err := s.renderPrompt(prompts.StageCommit, prompts.Vars{
		TaskName:     ref,
		ArtifactsDir: stored.ArtifactsDir,
		Push:         true,
		PushRef:      stored.HeadBranch,
	})
	if err != nil {
		return err
	}
	if err = s.setPhase(ctx, id, prreview.PhaseCommitting); err != nil {
		return err
	}
	s.setCommitFailed(id, false)
	if err = s.sessions.SendFromApp(ctx, sessionKey(id), message); err != nil {
		if backErr := s.setPhase(ctx, id, prreview.PhaseApplying); backErr != nil {
			s.log.Error("record review phase failed", "review", id, "error", backErr)
		}
		return err
	}

	s.log.Info("review changes approved", "review", id, "files", state.Watch.Total)
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
	case prreview.PhaseCommitting:
		if idle {
			s.evaluateCommit(ctx, stored, wt)
		}
	case prreview.PhaseNone:
		// The findings are the user's to decide on, or the pass is running.
	}
}

// evaluateCommit decides what became of the commit the app asked for, once
// the turn that makes it is over: no commit gives the changes back to the
// user, and a commit asks for the next pass over the pull request it reached.
func (s *Service) evaluateCommit(ctx context.Context, stored prreview.Review, wt worktree.Worktree) {
	// Decide on a reading newer than the turn, not on one the debounce owes.
	snap, read := s.watch.Refresh(stored.ID)
	if !read || snap.Err != "" {
		return
	}
	if snap.Head == "" || snap.Head == stored.PassCommit {
		if err := s.setPhase(ctx, stored.ID, prreview.PhaseApplying); err != nil {
			s.log.Error("record review phase failed", "review", stored.ID, "error", err)
			return
		}
		s.setCommitFailed(stored.ID, true)
		s.watch.Track(stored.ID, wt, true)
		s.log.Warn("review commit did not happen", "review", stored.ID)
		s.notify(stored.ID)
		return
	}

	id := stored.ID
	stored, repo, _, err := s.active(id)
	if err != nil {
		s.log.Error("ask review pass failed", "review", id, "error", err)
		return
	}
	// The worktree is already on the commit that went up, and an evaluation
	// reads nothing from GitHub: the document of the review stays as the last
	// reading of the pull request wrote it. The review stays committing until
	// the pass is asked for, so that the next evaluation tries again instead of
	// offering to apply findings that already went up.
	if err = s.askPass(ctx, stored, repo, nil, ""); err != nil {
		s.log.Error("ask review pass failed", "review", id, "error", err)
		return
	}
	s.log.Info("review commit pushed", "review", id, "commit", snap.Head)
	if err = s.setPhase(ctx, id, prreview.PhaseNone); err != nil {
		s.log.Error("record review phase failed", "review", id, "error", err)
	}
	s.watch.Forget(id)
	s.notify(id)
}

// setPhase records where a review in apply mode is in its cycle.
func (s *Service) setPhase(ctx context.Context, id string, phase prreview.Phase) error {
	_, err := s.reviews.Update(ctx, id, func(r *prreview.Review) { r.Phase = phase })
	return err
}

// setCommitFailed records whether the last approval ended without a commit.
func (s *Service) setCommitFailed(id string, failed bool) {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	l.commitFailed = failed
}
