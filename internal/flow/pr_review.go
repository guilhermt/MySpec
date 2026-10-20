package flow

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/prreport"
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/reviewmode"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/worktree"
)

// MaxPRReviewRounds is how many reports with findings the agent review of a
// pull request hands to its implementer, over the whole review, before the
// review goes to the user.
const MaxPRReviewRounds = 5

// The ways the flow refuses to act on the review mode of a pull request.
var (
	ErrPRReviewModeLocked = errors.New("flow: the review of the pull request has started")
	ErrAgentReviewsPR     = errors.New("flow: the agent reviews the pull request")
	ErrNoAgentPRReview    = errors.New("flow: the agent does not review the pull request")
)

// prReviewKey is the session that reviews the pull request of a task.
func prReviewKey(taskID string) session.Key {
	return session.Key{TaskID: taskID, Stage: session.PRReviewStage}
}

// prFixKey is the session that applies the findings of the review of the pull
// request of a task.
func prFixKey(taskID string) session.Key {
	return session.Key{TaskID: taskID, Stage: session.PRFixStage}
}

// prAgentReviewed reports whether the agent reviews the pull request of a task
// now: its review runs in agent mode and nothing took it back to the user.
func prAgentReviewed(t task.Task, run task.PRRun) bool {
	return t.ReviewModes.PRMode() == reviewmode.Agent && run.Fallback == ""
}

// prRounds is how many reports with findings the agent review handed to the
// implementer: the passes sent.
func prRounds(passes []task.PRPass) int {
	rounds := 0
	for _, p := range passes {
		if p.Sent() {
			rounds++
		}
	}
	return rounds
}

// PRReviewModeOf is who reviews the pull request of a task now: its mode, or
// Manual once the agent review fell back.
func PRReviewModeOf(t task.Task, pr *PullRequest) reviewmode.Mode {
	if pr != nil && pr.Fallback != "" {
		return reviewmode.Manual
	}
	return t.ReviewModes.PRMode()
}

// PRReviewModeEditable reports whether the user may still choose who reviews
// the pull request of a task: before its review begins. A pull request that
// exists is one whose review began, since recording it moves the task to its
// review.
func PRReviewModeEditable(t task.Task, pr *PullRequest) bool {
	switch {
	case t.Mode.Index(t.Stage) < t.Mode.Index(task.StagePR):
		return true
	case t.Stage == task.StagePR:
		return pr != nil && pr.PR.Number == 0
	default:
		return false
	}
}

// prReportMessage is what the app tells the implementer of a pull request
// review when a pass of the agent review found changes.
func prReportMessage(path, content string, round int) string {
	return fmt.Sprintf("The review of the pull request found changes: this is round %d of %d. The report is at `%s`:\n\n",
		round, MaxPRReviewRounds, path) + strings.TrimSpace(content) + "\n\n" + reportInstructions
}

// prLocalPassMessage is what the app tells the reviewer of a pull request once
// the implementer is done with its last report, before anything is committed.
func prLocalPassMessage(reply, path, status string) string {
	return "The implementer is done with your last report, and its changes are in the worktree, not committed yet. " +
		"Its response:\n\n" + reply + "\n\n" +
		"Review the pull request again with those changes, as the instructions of this session say, and write the " +
		"report of this pass to `" + path + "`.\n\n## GitHub status\n\n" +
		"What the app last read from GitHub, before the changes of the worktree:\n\n" + status
}

// fixerWorking reports whether the implementer of a pull request review is
// open and not at rest: working, paused, failed, asking or with a message
// queued.
func fixerWorking(fixer session.Summary, open bool) bool {
	return open && !fixer.Idle
}

// discardedFindings lists the findings the user discarded in the passes that
// came before pass, one line each, for the reviewer not to report them again.
// A pass counts once the user was done with it: its findings went to the
// implementer, or every one of them was discarded.
func discardedFindings(passes []task.PRPass, pass int) string {
	var lines []string
	for _, p := range passes {
		if p.Pass >= pass || !p.Recorded || (!p.Sent() && !p.AllDiscarded()) {
			continue
		}
		for _, f := range p.Findings {
			if f.Decision == prreport.DecisionDiscarded {
				lines = append(lines, fmt.Sprintf("- pass %d · %s", p.Pass, prreport.Describe(f)))
			}
		}
	}
	return strings.Join(lines, "\n")
}

// sendToFixer hands a message of the app to the implementer of the review of
// a pull request: a conversation that is open takes it, resumed when paused; a
// closed one is opened again first; and the first one starts the session with
// its prompt, which ends with the message. before runs once the conversation
// is open and ahead of the message, which is where a marker of the
// conversation belongs; it may be nil.
func (s *Service) sendToFixer(
	ctx context.Context, t task.Task, run task.PRRun, m session.AppMessage, before func(),
) error {
	key := prFixKey(t.ID)
	if fixer, open := s.sessions.Summary(key); open {
		if fixer.Status == session.StatusPaused {
			if err := s.sessions.Resume(ctx, key); err != nil {
				return err
			}
		}
		return s.sendFixerMessage(ctx, key, m, before)
	}

	exists, err := s.sessions.Exists(ctx, key)
	if err != nil {
		return err
	}
	info, err := s.fixInfoOf(ctx, t, run)
	if err != nil {
		return err
	}
	if exists {
		if err := s.sessions.Open(ctx, info); err != nil {
			return err
		}
		return s.sendFixerMessage(ctx, key, m, before)
	}
	info.Request = m
	if err := s.sessions.Start(ctx, info, false); err != nil {
		return err
	}
	if before != nil {
		before()
	}
	return nil
}

// sendFixerMessage sends a message of the app to the open conversation of the
// implementer, after the marker that belongs before it.
func (s *Service) sendFixerMessage(ctx context.Context, key session.Key, m session.AppMessage, before func()) error {
	if before != nil {
		before()
	}
	return s.sessions.SendFromApp(ctx, key, m)
}

// fixInfoOf is what the session of the implementer needs to know, read from
// the worktree and the repository of the task.
func (s *Service) fixInfoOf(ctx context.Context, t task.Task, run task.PRRun) (session.TaskInfo, error) {
	wt, ok := s.worktrees.Get(t.ID)
	if !ok {
		return session.TaskInfo{}, fmt.Errorf("implementer of task %s: %w", t.ID, ErrNoWorktree)
	}
	repo, err := s.repositoryOf(t)
	if err != nil {
		return session.TaskInfo{}, err
	}
	return prFixInfo(t, wt, s.baseOf(ctx, wt), repo, run.PR), nil
}

// reopenFixer opens again the conversation of the implementer a task had when
// the app was closed, if it had one.
func (s *Service) reopenFixer(ctx context.Context, t task.Task, run task.PRRun) {
	exists, err := s.sessions.Exists(ctx, prFixKey(t.ID))
	if err != nil {
		s.log.Error("open pr fix session failed", "task", t.ID, "error", err)
		return
	}
	if !exists {
		return
	}
	info, err := s.fixInfoOf(ctx, t, run)
	if err != nil {
		s.log.Error("open pr fix session failed", "task", t.ID, "error", err)
		return
	}
	if err := s.sessions.Open(ctx, info); err != nil {
		s.log.Error("open pr fix session failed", "task", t.ID, "error", err)
	}
}

// prFixInfo is what the session that applies the findings of the review of a
// pull request needs to know: the worktree it runs in and the pull request.
func prFixInfo(
	t task.Task, wt worktree.Worktree, base string, repo repository.Repository, pr task.PRDetails,
) session.TaskInfo {
	info := prSessionInfo(t, wt, base, repo)
	info.Stage, info.Prompt = session.PRFixStage, prompts.StagePRFix
	info.PRNumber, info.PRURL = strconv.Itoa(pr.Number), pr.URL
	info.Choice = t.Models.Stage(models.PRFix)
	return info
}
