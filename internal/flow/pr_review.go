package flow

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/git"
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

// lastReading is what the app last read from GitHub about the pull request, nil
// when it never did.
func lastReading(run task.PRRun) *gh.PRChecks {
	if run.PR.CheckedAt.IsZero() {
		return nil
	}
	return &gh.PRChecks{Checks: run.PR.Checks, Mergeable: run.PR.Mergeable}
}

// evaluateAgentPR drives the agent review of a pull request once both of its
// sessions rest: it hands a report with findings to the implementer, asks the
// reviewer for the pass that follows the implementer's work, has the changes
// of a clean report committed and pushed, asks for the pass after a push, or
// ends the review. A session that works, asks, is paused or failed is where
// the review waits.
func (s *Service) evaluateAgentPR(
	ctx context.Context, t task.Task, wt worktree.Worktree, run task.PRRun, pass task.PRPass, reviewer session.Summary,
) {
	if !pass.Recorded {
		// The reviewer works, or stopped without a report, which the user sorts out
		// in its conversation.
		return
	}
	if !reviewer.Idle || reviewer.TurnFailed {
		return
	}
	if fixer, open := s.sessions.Summary(prFixKey(t.ID)); open && (!fixer.Idle || fixer.TurnFailed) {
		return
	}
	// The loop reads the worktree too: the state and the commit that ends a round
	// rely on its reading.
	s.review.Track(t.ID, wt, true)
	status, err := s.worktrees.Status(ctx, wt)
	if err != nil {
		s.log.Warn("read worktree failed", "task", t.ID, "path", wt.Path, "error", err)
		return
	}

	passes := s.tasks.PRPasses(t.ID)
	switch {
	case status.Head != run.ReviewedCommit:
		// The commit of the app went up, or a pass was asked again.
		s.passDue(ctx, t, wt, run)
	case pass.Clean && !status.Clean():
		s.commitAgentPR(ctx, t, run)
	case pass.Clean:
		s.finishReview(ctx, t, run, prReviewKey(t.ID))
	case !pass.Sent() && prRounds(passes) >= MaxPRReviewRounds:
		if _, err := s.tasks.SetPRFallback(ctx, t.ID, task.FallbackRoundsExhausted); err != nil {
			s.log.Error("record pr review fallback failed", "task", t.ID, "error", err)
			return
		}
		s.log.Info("pr review fell back", "task", t.ID, "reason", string(task.FallbackRoundsExhausted))
	case !pass.Sent():
		s.deliverPRReport(ctx, t, run, pass, passes)
	default:
		s.askLocalPass(ctx, t, wt, run, status)
	}
}

// deliverPRReport hands the report of a pass with findings to the implementer,
// which starts the round of that report.
func (s *Service) deliverPRReport(
	ctx context.Context, t task.Task, run task.PRRun, pass task.PRPass, passes []task.PRPass,
) {
	path := t.ReviewPath(pass.Pass)
	content, err := s.tasks.ReadArtifact(t.ID, task.PRDirName+"/"+filepath.Base(path))
	if err != nil {
		s.log.Error("read pr review report failed", "task", t.ID, "pass", pass.Pass, "error", err)
		return
	}
	round := prRounds(passes) + 1
	if err := s.tasks.MarkPRPassSent(ctx, t.ID, pass.Pass); err != nil {
		s.log.Error("record sent pr review pass failed", "task", t.ID, "pass", pass.Pass, "error", err)
		return
	}
	app := session.AppMessage{
		Text: prReportMessage(path, content, round), Kind: session.AppReport,
		Pass: pass.Pass, Round: round, Rounds: MaxPRReviewRounds, Count: len(pass.Findings),
	}
	if err := s.sendToFixer(ctx, t, run, app, nil); err != nil {
		if unmarkErr := s.tasks.UnmarkPRPassSent(ctx, t.ID, pass.Pass); unmarkErr != nil {
			s.log.Error("unmark sent pr review pass failed", "task", t.ID, "pass", pass.Pass, "error", unmarkErr)
		}
		s.log.Error("send pr review report failed", "task", t.ID, "pass", pass.Pass, "error", err)
		return
	}
	s.log.Info("pr review report delivered", "task", t.ID, "pass", pass.Pass, "round", round)
}

// askLocalPass asks the reviewer for the pass that follows the work of the
// implementer on a report: the changes are in the worktree and nothing is
// committed, so nothing was read from GitHub since the last pass.
func (s *Service) askLocalPass(
	ctx context.Context, t task.Task, wt worktree.Worktree, run task.PRRun, status git.Status,
) {
	next := run.ReportedPass + 1
	reply := implementerReply(s.sessions.LastReply(prFixKey(t.ID)))
	// One state of the worktree asks for one pass, however many evaluations it
	// takes for the report of that pass to land.
	s.setPassAsked(t.ID, cmp.Or(status.Head, passAskedWithoutHead))
	if _, err := s.tasks.AskPRPass(ctx, t.ID, next); err != nil {
		s.setPassAsked(t.ID, "")
		s.log.Error("record pr review pass failed", "task", t.ID, "pass", next, "error", err)
		return
	}
	s.setUnreadable(t.ID, "")
	section := prompts.PRChecksSection(lastReading(run), "origin/"+s.baseOf(ctx, wt))
	app := session.AppMessage{
		Text: prLocalPassMessage(reply, t.ReviewPath(next), section), Kind: session.AppPRPass, Pass: next,
	}
	if err := s.sessions.SendFromApp(ctx, prReviewKey(t.ID), app); err != nil {
		s.setPassAsked(t.ID, "")
		s.unaskPass(ctx, t.ID, next)
		s.log.Error("send pr review pass failed", "task", t.ID, "pass", next, "error", err)
		return
	}
	s.log.Info("pr review local pass asked", "task", t.ID, "pass", next)
}

// commitAgentPR asks the implementer of a pull request whose report came clean
// to commit every change of the worktree and push it: nobody staged anything.
func (s *Service) commitAgentPR(ctx context.Context, t task.Task, run task.PRRun) {
	vars := commitVars(t)
	vars.CommitAll = true
	vars.Push = true
	message, err := s.renderPrompt(prompts.StageCommit, vars)
	if err != nil {
		s.log.Error("render commit prompt failed", "task", t.ID, "error", err)
		return
	}
	if _, err := s.tasks.SetPRRun(ctx, t.ID, task.PRCommitting, nil); err != nil {
		s.log.Error("record committing pull request failed", "task", t.ID, "error", err)
		return
	}
	s.setPRNoCommit(t.ID, false)
	app := session.AppMessage{Text: message, Kind: session.AppCommitAllPush}
	if err := s.sendToFixer(ctx, t, run, app, nil); err != nil {
		if _, setErr := s.tasks.SetPRRun(ctx, t.ID, task.PRReviewing, nil); setErr != nil {
			s.log.Error("record reviewing pull request failed", "task", t.ID, "error", setErr)
		}
		s.log.Error("send commit prompt failed", "task", t.ID, "error", err)
		return
	}
	s.log.Info("pr review committing", "task", t.ID)
}

// ReviewPRMyself takes the review of the pull request of a task back from the
// agent: the user reviews it from here on. A pass under way is cut short, and
// the changes the loop left in the worktree go to the review by stage.
func (s *Service) ReviewPRMyself(ctx context.Context, id string) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	t, run, err := s.prOf(id)
	if err != nil {
		return err
	}
	if !prAgentReviewed(t, run) || run.PR.Number == 0 || prOver(run) ||
		run.Status == task.PRClosing || run.Status == task.PRClosed {
		return fmt.Errorf("review the pull request of task %s yourself: %w", id, ErrNoAgentPRReview)
	}
	if _, err := s.tasks.SetPRFallback(ctx, id, task.FallbackTakenOver); err != nil {
		return err
	}
	if pass, structured := currentPass(s.tasks.PRPasses(id)); structured && !pass.Recorded {
		if reviewer, open := s.sessions.Summary(prReviewKey(id)); open && reviewer.TurnRunning {
			if err := s.sessions.Interrupt(ctx, prReviewKey(id)); err != nil {
				// The mode already changed: whatever the pass writes, nobody reads.
				s.log.Warn("interrupt pr review failed", "task", id, "error", err)
			}
			if s.worktreeHasChanges(ctx, id) {
				s.undoPass(ctx, t, pass.Pass)
			}
		}
	}
	s.log.Info("pr review fell back", "task", id, "reason", string(task.FallbackTakenOver))
	return nil
}

// worktreeHasChanges says whether the worktree of a task holds changes nobody
// committed; a worktree git cannot read counts as having none.
func (s *Service) worktreeHasChanges(ctx context.Context, id string) bool {
	wt, ok := s.worktrees.Get(id)
	if !ok {
		return false
	}
	status, err := s.worktrees.Status(ctx, wt)
	return err == nil && !status.Clean()
}

// SetPRReviewMode changes who reviews the pull request of a task, until its
// review begins.
func (s *Service) SetPRReviewMode(ctx context.Context, id string, mode reviewmode.Mode) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	t, ok := s.tasks.Get(id)
	if !ok {
		return fmt.Errorf("set the review mode of the pull request of task %s: %w", id, task.ErrNotFound)
	}
	var current *PullRequest
	if pr, found := s.PullRequest(id); found {
		current = &pr
	}
	if !PRReviewModeEditable(t, current) {
		return fmt.Errorf("set the review mode of the pull request of task %s: %w", id, ErrPRReviewModeLocked)
	}
	if _, err := s.tasks.SetPRReviewMode(ctx, id, mode); err != nil {
		return err
	}
	return nil
}
