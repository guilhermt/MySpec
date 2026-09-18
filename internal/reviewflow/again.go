package reviewflow

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/pulls"
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/worktree"
)

// noFindings is what the list of the findings of the passes before says when
// there are none.
const noFindings = "None."

// ReviewAgain asks the agent for another pass over the pull request as it is
// now, in the same conversation: the worktree is brought to the head of the
// pull request, the document of the review is written again, and the message
// says what changed and which findings were already sent to the author.
func (s *Service) ReviewAgain(ctx context.Context, id, instructions string) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	stored, repo, wt, err := s.active(id)
	if err != nil {
		return fmt.Errorf("review %s again: %w", id, err)
	}
	if err = againable(stored); err != nil {
		return fmt.Errorf("review %s again: %w", stored.Reference(repo.FullName()), err)
	}

	sum, err := s.readySession(ctx, stored, repo, wt)
	if err != nil {
		return fmt.Errorf("review %s again: %w", stored.Reference(repo.FullName()), err)
	}
	if !sum.Idle {
		return fmt.Errorf("review %s again: %w", stored.Reference(repo.FullName()), ErrBusy)
	}

	stored, detail := s.reread(ctx, stored, repo)
	if err = s.updateWorktree(ctx, stored, wt); err != nil {
		return err
	}
	if stored.Phase != prreview.PhaseApplying {
		return s.askPass(ctx, stored, repo, detail, instructions)
	}
	return s.leaveFixes(ctx, stored, repo, wt, detail, instructions)
}

// leaveFixes asks for another pass over a review whose fixes the user was
// reviewing: the agent changed nothing, or the user dropped what it changed,
// which a worktree that updated cleanly says. The cycle of the fixes ends with
// the pass, and comes back when the pass cannot be asked for.
func (s *Service) leaveFixes(
	ctx context.Context, stored prreview.Review, repo repository.Repository, wt worktree.Worktree,
	detail *pulls.Detail, instructions string,
) error {
	if err := s.setPhase(ctx, stored.ID, prreview.PhaseNone); err != nil {
		return err
	}
	s.watch.Forget(stored.ID)
	stored.Phase = prreview.PhaseNone
	err := s.askPass(ctx, stored, repo, detail, instructions)
	if err != nil {
		if backErr := s.setPhase(ctx, stored.ID, prreview.PhaseApplying); backErr != nil {
			s.log.Error("record review phase failed", "review", stored.ID, "error", backErr)
		}
		s.watch.Track(stored.ID, wt, true)
		return err
	}
	s.setCommitFailed(stored.ID, false)
	return nil
}

// againable says whether a review can take another pass now.
func againable(stored prreview.Review) error {
	switch {
	case stored.AskedPass > stored.ReportedPass:
		return ErrPassRunning
	case stored.Mode == prreview.ModeApply && stored.Phase == prreview.PhaseCommitting:
		// The changes the user approved are going up; the pass follows them.
		return ErrPassRunning
	case stored.PRState != prreview.PROpen:
		return ErrNotOpen
	}
	return nil
}

// active is an active review with the registered repository and the worktree
// it runs in.
func (s *Service) active(id string) (prreview.Review, repository.Repository, worktree.Worktree, error) {
	stored, ok := s.reviews.Get(id)
	if !ok {
		return prreview.Review{}, repository.Repository{}, worktree.Worktree{}, prreview.ErrNotFound
	}
	repo, ok := s.repositories.Get(stored.RepositoryID)
	if !ok {
		return prreview.Review{}, repository.Repository{}, worktree.Worktree{}, repository.ErrNotFound
	}
	wt, ok := s.worktrees.Get(id)
	if !ok {
		return prreview.Review{}, repository.Repository{}, worktree.Worktree{}, ErrNoWorktree
	}
	return stored, repo, wt, nil
}

// readySession is the conversation of a review, ready to take a message: one
// the user paused is resumed, and one a restart of the app left behind is
// opened again.
func (s *Service) readySession(
	ctx context.Context, stored prreview.Review, repo repository.Repository, wt worktree.Worktree,
) (session.Summary, error) {
	key := sessionKey(stored.ID)
	sum, open := s.sessions.Summary(key)
	if !open {
		// The conversation keeps the model it was started with, so the choice
		// of a review that is reopened is the stored one.
		pass := stored.ReportedPass + 1
		if err := s.sessions.Open(ctx, info(stored, wt, repo, pass, "", models.Choice{})); err != nil {
			return session.Summary{}, err
		}
		if sum, open = s.sessions.Summary(key); !open {
			return session.Summary{}, session.ErrNotFound
		}
	}
	if sum.Status != session.StatusPaused {
		return sum, nil
	}
	if err := s.sessions.Resume(ctx, key); err != nil {
		return session.Summary{}, err
	}
	sum, open = s.sessions.Summary(key)
	if !open {
		return session.Summary{}, session.ErrNotFound
	}
	return sum, nil
}

// reread asks GitHub about the pull request again, so that a pass starts on
// the head and the title it has now. A reading that fails never holds a pass
// back: the review goes on with what it already knew, and answers with no
// pull request, because only GitHub has the description the document needs.
func (s *Service) reread(
	ctx context.Context, stored prreview.Review, repo repository.Repository,
) (prreview.Review, *pulls.Detail) {
	detail, err := s.detailOf(ctx, repo, stored.Number)
	if err != nil {
		s.log.Warn("read pull request failed", "review", stored.ID,
			"repository", repo.FullName(), "error", err)
		return stored, nil
	}
	if detail.HeadCommit == stored.HeadCommit && detail.Title == stored.Title {
		return stored, &detail
	}

	updated, err := s.reviews.Update(ctx, stored.ID, func(r *prreview.Review) {
		r.HeadCommit, r.Title = detail.HeadCommit, detail.Title
	})
	if err != nil {
		s.log.Error("update review failed", "review", stored.ID, "error", err)
		return stored, &detail
	}
	return updated, &detail
}

// updateWorktree brings the worktree of a review to the head of the pull
// request. In publish mode the app never leaves changes of its own there, so
// anything in the way is thrown out; in apply mode the changes are the user's
// and the failure goes back to them.
func (s *Service) updateWorktree(ctx context.Context, stored prreview.Review, wt worktree.Worktree) error {
	err := s.worktrees.UpdateDetached(ctx, wt, stored.HeadBranch)
	if !errors.Is(err, worktree.ErrDirty) || stored.Mode != prreview.ModePublish {
		return err
	}
	if cleanErr := s.worktrees.Clean(ctx, wt); cleanErr != nil {
		return cleanErr
	}
	return s.worktrees.UpdateDetached(ctx, wt, stored.HeadBranch)
}

// askPass writes the document of the review again and asks the conversation
// for the next pass. It is what ReviewAgain ends with, and what apply mode
// asks for once a commit went up. Without a reading of the pull request the
// document is left alone: the one on disk is the last one written from GitHub,
// and rewriting it would drop the description of the pull request.
func (s *Service) askPass(
	ctx context.Context, stored prreview.Review, repo repository.Repository,
	detail *pulls.Detail, instructions string,
) error {
	var err error
	if detail != nil {
		if stored, err = s.writeContext(ctx, stored, repo, *detail); err != nil {
			return err
		}
	}

	pass := stored.ReportedPass + 1
	message := passMessage(passRequest{
		ReportPath:       stored.ReportPath(pass),
		Pass:             pass,
		PassCommit:       stored.PassCommit,
		BaseBranch:       remoteRef(stored.BaseBranch),
		Mode:             stored.Mode,
		Findings:         s.sentFindings(stored),
		Instructions:     repo.ReviewInstructions,
		PassInstructions: instructions,
	})
	if stored, err = s.reviews.AskPass(ctx, stored.ID, pass, instructions); err != nil {
		return err
	}
	if stored.PublishError != "" {
		if _, err = s.reviews.Update(ctx, stored.ID, func(r *prreview.Review) { r.PublishError = "" }); err != nil {
			return err
		}
	}

	if err = s.sessions.SendFromApp(ctx, sessionKey(stored.ID), message); err != nil {
		// The pass never reached the agent, so the review goes back to the
		// pass the user was on.
		if backErr := s.reviews.UnaskPass(ctx, stored.ID, pass); backErr != nil {
			s.log.Error("unask review pass failed", "review", stored.ID, "pass", pass, "error", backErr)
		}
		return err
	}

	s.log.Info("review pass asked", "review", stored.ID, "pass", pass)
	s.notify(stored.ID)
	return nil
}

// sentFindings are the findings of the passes before that the author has
// already seen: the published ones in publish mode, the applied ones in apply
// mode.
func (s *Service) sentFindings(stored prreview.Review) []prreview.Finding {
	var sent []prreview.Finding
	for _, pass := range s.reviews.Passes(stored.ID) {
		if !pass.Recorded {
			continue
		}
		if stored.Mode == prreview.ModeApply {
			sent = append(sent, pass.Approved()...)
			continue
		}
		if !pass.Published() {
			continue
		}
		for _, finding := range pass.Findings {
			if finding.Placement != prreview.PlacementNone {
				sent = append(sent, finding)
			}
		}
	}
	return sent
}

// passRequest is what the message of a new pass says.
type passRequest struct {
	ReportPath string
	Pass       int
	PassCommit string // the commit the pass before covered
	BaseBranch string // as the worktree names it: origin/<branch>
	Mode       prreview.Mode
	// Findings are the ones of the passes before the author already saw.
	Findings         []prreview.Finding
	Instructions     string // the standing instructions of the repository
	PassInstructions string // what the user wrote for this pass
}

// passMessage is what the app says to the conversation of a review when it
// asks for another pass.
func passMessage(r passRequest) string {
	sections := []string{
		"Review the pull request again, as it is now. The worktree was updated to the head of the " +
			"pull request.",
		strings.Join([]string{
			"- Write the report of this pass to `" + r.ReportPath + "`, in the same format as before. " +
				"It is pass " + strconv.Itoa(r.Pass) + ".",
			"- The previous pass covered commit `" + r.PassCommit + "`: `git diff " + r.PassCommit +
				"..HEAD` is what changed since then. Read the full diff against `" + r.BaseBranch + "` as well.",
			"- Only what is new or still stands is a finding. Say in the summary which of the findings " +
				"below were resolved.",
		}, "\n"),
		sentHeading(r.Mode) + "\n" + findingList(r.Findings),
	}
	if instructions := strings.TrimSpace(r.Instructions); instructions != "" {
		sections = append(sections, "## Review instructions\n"+instructions)
	}
	if instructions := strings.TrimSpace(r.PassInstructions); instructions != "" {
		sections = append(sections, "## Instructions for this pass\n"+instructions)
	}
	return strings.Join(sections, "\n\n")
}

// sentHeading opens the findings the author already saw, which is what the
// mode of the review decides they are.
func sentHeading(mode prreview.Mode) string {
	if mode == prreview.ModeApply {
		return "## Findings already applied"
	}
	return "## Findings already published"
}

// findingList lists the findings of the passes before, each where it pointed.
func findingList(findings []prreview.Finding) string {
	if len(findings) == 0 {
		return noFindings
	}
	lines := make([]string, 0, len(findings))
	for i, finding := range findings {
		location := "(general)"
		if finding.Anchored() {
			location = fmt.Sprintf("`%s:%d`", finding.Path, finding.Line)
		}
		lines = append(lines, fmt.Sprintf("%d. %s — %s", i+1, location, strings.TrimSpace(finding.Text)))
	}
	return strings.Join(lines, "\n")
}
