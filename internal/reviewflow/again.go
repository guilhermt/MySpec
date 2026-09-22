package reviewflow

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
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
// now, in the same conversation: the pull request is read again, the worktree
// is brought to its head, the document of the review is written again, and
// the message says what changed and which findings were already sent to the
// author. The pass waits for the checks of the head while they are pending;
// a pass that could not start is asked for again the same way.
func (s *Service) ReviewAgain(ctx context.Context, id, instructions string) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	stored, repo, wt, err := s.active(id)
	if err != nil {
		return fmt.Errorf("review %s again: %w", id, err)
	}
	ref := stored.Reference(repo.FullName())
	if err = againable(stored, s.passBlockedOf(id)); err != nil {
		return fmt.Errorf("review %s again: %w", ref, err)
	}

	sum, err := s.readySession(ctx, stored, repo, wt)
	if err != nil {
		return fmt.Errorf("review %s again: %w", ref, err)
	}
	if !sum.Idle {
		return fmt.Errorf("review %s again: %w", ref, ErrBusy)
	}

	stored, detail, err := s.reread(ctx, stored, repo)
	if err != nil {
		return fmt.Errorf("review %s again: %w", ref, err)
	}
	if detail.State != string(prreview.PROpen) {
		// Merged or closed since the last poll: the poll ends the review, and
		// a pass asked now would be cut off in the middle of its turn.
		return fmt.Errorf("review %s again: %w", ref, ErrNotOpen)
	}
	if err = s.updateWorktree(ctx, stored, wt); err != nil {
		return err
	}
	if stored.Phase != prreview.PhaseApplying {
		_, err = s.requestPass(ctx, stored, repo, wt, detail, instructions, false)
		return err
	}
	return s.leaveFixes(ctx, stored, repo, wt, detail, instructions)
}

// leaveFixes asks for another pass over a review whose fixes the user was
// reviewing: the agent changed nothing, or the user dropped what it changed,
// which a worktree that updated cleanly says. The cycle of the fixes ends with
// the pass, and comes back when the pass cannot be asked for.
func (s *Service) leaveFixes(
	ctx context.Context, stored prreview.Review, repo repository.Repository, wt worktree.Worktree,
	detail pulls.Detail, instructions string,
) error {
	if err := s.setPhase(ctx, stored.ID, prreview.PhaseNone); err != nil {
		return err
	}
	s.watch.Forget(stored.ID)
	stored.Phase = prreview.PhaseNone
	if _, err := s.requestPass(ctx, stored, repo, wt, detail, instructions, false); err != nil {
		if backErr := s.setPhase(ctx, stored.ID, prreview.PhaseApplying); backErr != nil {
			s.log.Error("record review phase failed", "review", stored.ID, "error", backErr)
		}
		s.watch.Track(stored.ID, wt, true)
		return err
	}
	s.setCommitFailed(stored.ID, false)
	return nil
}

// againable says whether a review can take another pass now. A pass that
// could not start is asked for again by the same action.
func againable(stored prreview.Review, passBlocked string) error {
	if stored.Phase == prreview.PhaseWaitingChecks && passBlocked != "" {
		return nil
	}
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
		if err := s.sessions.Open(ctx, info(stored, wt, repo, pass, "", models.Choice{}, nil)); err != nil {
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
// the head and the title it has now. A pass never starts without the reading:
// it is what says the state of the checks, and only GitHub has the
// description the document needs.
func (s *Service) reread(
	ctx context.Context, stored prreview.Review, repo repository.Repository,
) (prreview.Review, pulls.Detail, error) {
	detail, err := s.detailOf(ctx, repo, stored.Number)
	if err != nil {
		return stored, pulls.Detail{}, err
	}
	if detail.HeadCommit == stored.HeadCommit && detail.Title == stored.Title {
		return stored, detail, nil
	}

	updated, err := s.reviews.Update(ctx, stored.ID, func(r *prreview.Review) {
		r.HeadCommit, r.Title = detail.HeadCommit, detail.Title
	})
	if err != nil {
		s.log.Error("update review failed", "review", stored.ID, "error", err)
		return stored, detail, nil
	}
	return updated, detail, nil
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

// requestPass writes the document of the review again and asks for the next
// pass, which starts at once when the checks of the head are settled and waits
// for them otherwise; the poll goes on with the wait. afterPush says the head
// is a commit the app just pushed, whose checks GitHub may not list yet. It is
// how Start, ReviewAgain and a pass that could not start ask for a pass.
func (s *Service) requestPass(
	ctx context.Context, stored prreview.Review, repo repository.Repository, wt worktree.Worktree,
	detail pulls.Detail, instructions string, afterPush bool,
) (prreview.Review, error) {
	stored, err := s.writeContext(ctx, stored, repo, detail)
	if err != nil {
		return prreview.Review{}, err
	}
	pass := stored.ReportedPass + 1
	if stored, err = s.reviews.AskPass(ctx, stored.ID, pass, instructions); err != nil {
		return prreview.Review{}, err
	}
	if stored.PublishError != "" {
		if stored, err = s.reviews.Update(ctx, stored.ID, func(r *prreview.Review) { r.PublishError = "" }); err != nil {
			return prreview.Review{}, err
		}
	}

	// Why a pass before could not start, or its report could not be read,
	// says nothing about this one.
	l := s.lockOf(stored.ID)
	s.mu.Lock()
	l.passBlocked, l.unreadable = "", ""
	l.wait = checksWait{afterPush: afterPush}
	settled := l.wait.settled(detail.Checks)
	s.mu.Unlock()

	if !settled {
		if err = s.setPhase(ctx, stored.ID, prreview.PhaseWaitingChecks); err != nil {
			s.unaskPass(ctx, stored.ID, pass)
			return prreview.Review{}, err
		}
		stored.Phase = prreview.PhaseWaitingChecks
		s.log.Info("review pass waiting for checks", "review", stored.ID, "pass", pass)
		s.notify(stored.ID)
		return stored, nil
	}

	if err = s.sendPass(ctx, stored, repo, wt, detail.Checks); err != nil {
		return prreview.Review{}, err
	}
	if stored.Phase == prreview.PhaseWaitingChecks {
		if err = s.setPhase(ctx, stored.ID, prreview.PhaseNone); err != nil {
			return prreview.Review{}, err
		}
		stored.Phase = prreview.PhaseNone
	}
	return stored, nil
}

// sendPass sends the pass the app asked for to the conversation of the
// review, with what GitHub said about the checks: the first pass starts the
// conversation Start created, and each later one is a message in it. A pass
// that never reached the agent goes back to the pass the user was on, unless
// it waited for the checks: then it stays asked for, blocked until the user
// asks for it again.
func (s *Service) sendPass(
	ctx context.Context, stored prreview.Review, repo repository.Repository, wt worktree.Worktree,
	checks gh.PRChecks,
) error {
	pass := stored.ReportedPass + 1
	asked, _ := s.passOf(stored.ID, pass)

	var err error
	if stored.ReportedPass == 0 {
		// The conversation keeps the model it was created with.
		err = s.sessions.Start(ctx, info(stored, wt, repo, pass, asked.Instructions, models.Choice{}, &checks), false)
	} else {
		err = s.sendLaterPass(ctx, stored, repo, wt, pass, asked.Instructions, checks)
	}
	if err != nil {
		if stored.Phase == prreview.PhaseWaitingChecks {
			s.log.Error("ask review pass failed", "review", stored.ID, "pass", pass, "error", err)
			if s.setPassBlocked(stored.ID, err.Error()) {
				s.notify(stored.ID)
			}
			return err
		}
		s.unaskPass(ctx, stored.ID, pass)
		return err
	}
	// Why the report of a pass before could not be read says nothing about
	// this one.
	s.setUnreadable(stored.ID, "")

	s.log.Info("review pass asked", "review", stored.ID, "pass", pass)
	s.notify(stored.ID)
	return nil
}

// sendLaterPass says to the conversation of a review what it needs for a pass
// after the first: what changed, what the author already saw and what GitHub
// said about the checks.
func (s *Service) sendLaterPass(
	ctx context.Context, stored prreview.Review, repo repository.Repository, wt worktree.Worktree,
	pass int, instructions string, checks gh.PRChecks,
) error {
	if _, err := s.readySession(ctx, stored, repo, wt); err != nil {
		return err
	}
	message := passMessage(passRequest{
		ReportPath:       stored.ReportPath(pass),
		Pass:             pass,
		PassCommit:       stored.PassCommit,
		BaseBranch:       remoteRef(stored.BaseBranch),
		Mode:             stored.Mode,
		Findings:         s.sentFindings(stored),
		Checks:           &checks,
		Instructions:     repo.ReviewInstructions,
		PassInstructions: instructions,
	})
	return s.sessions.SendFromApp(ctx, sessionKey(stored.ID), message)
}

// unaskPass takes back a pass that never reached the agent, so that the review
// goes back to the pass the user was on.
func (s *Service) unaskPass(ctx context.Context, id string, pass int) {
	if err := s.reviews.UnaskPass(ctx, id, pass); err != nil {
		s.log.Error("unask review pass failed", "review", id, "pass", pass, "error", err)
	}
}

// sentFindings are the findings of the passes before that the author has
// already seen: the published ones in publish mode, the applied ones in apply
// mode.
func (s *Service) sentFindings(stored prreview.Review) []prreview.Finding {
	var recorded []prreview.Pass
	for _, pass := range s.reviews.Passes(stored.ID) {
		if pass.Recorded {
			recorded = append(recorded, pass)
		}
	}
	if stored.Mode == prreview.ModeApply {
		return appliedFindings(recorded)
	}

	var sent []prreview.Finding
	for _, pass := range recorded {
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

// appliedFindings are the approved findings of the passes whose fixes went up
// in a commit of the app. Fixes the user dropped, and findings approved but
// never applied, are no part of the pull request.
func appliedFindings(recorded []prreview.Pass) []prreview.Finding {
	var applied []prreview.Finding
	for _, pass := range recorded {
		if pass.Applied {
			applied = append(applied, pass.Approved()...)
		}
	}
	return applied
}

// passRequest is what the message of a new pass says.
type passRequest struct {
	ReportPath string
	Pass       int
	PassCommit string // the commit the pass before covered; "" when git could not say
	BaseBranch string // as the worktree names it: origin/<branch>
	Mode       prreview.Mode
	// Findings are the ones of the passes before the author already saw.
	Findings []prreview.Finding
	// Checks is what GitHub said about the checks of the head and the merge
	// before the pass.
	Checks           *gh.PRChecks
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
			diffLine(r.PassCommit, r.BaseBranch),
			"- Only what is new or still stands is a finding. Say in the summary which of the findings " +
				"below were resolved.",
		}, "\n"),
		sentHeading(r.Mode) + "\n" + findingList(r.Findings),
		"## GitHub status\n" + prompts.PRChecksSection(r.Checks, r.BaseBranch),
	}
	if instructions := strings.TrimSpace(r.Instructions); instructions != "" {
		sections = append(sections, "## Review instructions\n"+instructions)
	}
	if instructions := strings.TrimSpace(r.PassInstructions); instructions != "" {
		sections = append(sections, "## Instructions for this pass\n"+instructions)
	}
	return strings.Join(sections, "\n\n")
}

// diffLine says what to read of the pull request: what changed since the pass
// before, when git said which commit it covered, and the full diff against the
// base either way.
func diffLine(passCommit, baseBranch string) string {
	full := "Read the full diff against `" + baseBranch + "`"
	if passCommit == "" {
		return "- " + full + "."
	}
	return "- The previous pass covered commit `" + passCommit + "`: `git diff " + passCommit +
		"..HEAD` is what changed since then. " + full + " as well."
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
