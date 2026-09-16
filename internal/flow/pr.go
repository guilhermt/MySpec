package flow

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/worktree"
)

// PRStatus is what the interface shows about the pull request of a task.
type PRStatus string

// The states the PR stage of a task is shown in.
const (
	PRPreparing        PRStatus = "preparing"
	PRBlocked          PRStatus = "blocked"
	PRDrafting         PRStatus = "drafting"       // the agent is writing the draft
	PRDraftReady       PRStatus = "draft_ready"    // the draft awaits the OK
	PRAwaitingReply    PRStatus = "awaiting_reply" // the agent stopped short of what the app waits for: a draft, the pull request it was asked to open, or the report of a review pass
	PROpening          PRStatus = "opening"
	PRReviewing        PRStatus = "reviewing"         // the agent is reviewing
	PRAwaitingDecision PRStatus = "awaiting_decision" // a report with changes, nothing changed yet
	PRInReview         PRStatus = "in_review"         // the applied changes are being reviewed
	PRReadyToApprove   PRStatus = "ready_to_approve"
	PRCommitting       PRStatus = "committing"
	PRDone             PRStatus = "done"      // the review closed clean and the pull request is still open
	PRMerged           PRStatus = "merged"    // the pull request was merged; the task awaits closing
	PRClosedUnmerged   PRStatus = "pr_closed" // the pull request was closed without a merge
	PRClosing          PRStatus = "closing"
	PRClosed           PRStatus = "closed"
)

// PullRequest is the PR stage of a task, with everything the app knows about it.
type PullRequest struct {
	Status       PRStatus
	Block        *task.PRBlock
	WorktreePath string
	Branch       string
	BaseBranch   string

	Draft   *task.Draft
	Reports []task.ReviewReport
	PR      task.PRDetails
	Review  *review.Snapshot

	// CheckError is what the last automatic reading of the pull request said
	// when it failed.
	CheckError string
	Close      *task.CloseResult // closed only
	CanClose   bool              // the user may close the task now
	// CloneMissing says the clone of the repository is missing, and the closing
	// waits for it.
	CloneMissing bool

	// CommitFailed says the last approval of the review ended without a commit,
	// the way a step says it.
	CommitFailed bool

	SessionStage string // session.PRStage or session.PRReviewStage; "" when none is open
	Session      session.Summary
}

// noWorktreeDetail is what blocks a task whose worktree the app no longer
// knows about.
const noWorktreeDetail = "the worktree of this task is gone; discard the plan to start over"

// passAskedWithoutHead is what marks a review pass as asked for when git cannot
// say which commit it is about.
const passAskedWithoutHead = "asked"

// PullRequest is the PR stage of a task, false before it.
func (s *Service) PullRequest(id string) (PullRequest, bool) {
	t, ok := s.tasks.Get(id)
	if !ok {
		return PullRequest{}, false
	}
	run, ok := s.tasks.PRRun(id)
	if !ok {
		return PullRequest{}, false
	}
	a, _ := s.tasks.Artifacts(id)
	return s.prState(t, run, a.PR), true
}

// prState is everything the app knows about the PR stage of a task: what it
// recorded, what the folder of the task holds, what the session of the stage is
// doing and how far its review got.
func (s *Service) prState(t task.Task, run task.PRRun, art task.PRArtifacts) PullRequest {
	pr := PullRequest{
		Block:        run.Block,
		Reports:      art.Reports,
		PR:           run.PR,
		CheckError:   s.checkError(t.ID),
		Close:        run.Close,
		CloneMissing: s.repositories.Missing(t.RepositoryID),
	}
	if art.Draft.Present {
		draft := art.Draft
		pr.Draft = &draft
	}
	if wt, ok := s.worktrees.Get(t.ID); ok {
		pr.WorktreePath, pr.Branch, pr.BaseBranch = wt.Path, wt.Branch, wt.Base
	}

	if stage := prSessionStage(run.Status); stage != "" {
		if sum, open := s.sessions.Summary(session.Key{TaskID: t.ID, Stage: stage}); open {
			pr.SessionStage, pr.Session = stage, sum
		}
	}
	snap, read := s.review.Snapshot(t.ID)
	pr.Review = reading(snap, read)
	pr.CommitFailed = s.prNoCommit(t.ID)
	facts := prFacts{
		idle:       pr.Session.Idle && pr.SessionStage != "",
		openFailed: s.openFailed(t.ID),
		passAsked:  s.passAsked(t.ID) != "",
	}
	pr.Status = prStatus(run, art, facts, snap, read)
	pr.CanClose = canClose(pr.Status, pr.CheckError) && !pr.CloneMissing
	return pr
}

// canClose says when the closing of a task is the user's to ask for: the merge
// was confirmed, or the merge could not be checked.
func canClose(status PRStatus, checkError string) bool {
	switch status {
	case PRMerged:
		return true
	case PRDone:
		return checkError != ""
	default:
		return false
	}
}

// prSessionStage is the session the PR stage has open at a status, "" for the
// statuses that have none.
func prSessionStage(status task.PRStatus) string {
	switch status {
	case task.PRDrafting, task.PROpening:
		return session.PRStage
	case task.PRReviewing, task.PRCommitting:
		return session.PRReviewStage
	case task.PRPreparing, task.PRBlocked, task.PRDone, task.PRClosing, task.PRClosed:
		return ""
	default:
		return ""
	}
}

// prFacts is what the app knows about the PR stage of a task beyond its record
// and its artifacts.
type prFacts struct {
	idle       bool // the session of the stage is open and at rest
	openFailed bool // the last opening of the pull request ended without one
	passAsked  bool // a review pass was asked for and its report is not in yet
}

// prStatus turns what the app recorded, the artifacts on disk, what else it
// knows about the stage and the last reading of the worktree into the state the
// pull request is shown in.
func prStatus(run task.PRRun, art task.PRArtifacts, facts prFacts, snap review.Snapshot, read bool) PRStatus {
	switch run.Status {
	case task.PRPreparing:
		return PRPreparing
	case task.PRBlocked:
		return PRBlocked
	case task.PRDrafting:
		switch {
		case !facts.idle:
			return PRDrafting
		case !art.Draft.Present || facts.openFailed:
			return PRAwaitingReply
		default:
			return PRDraftReady
		}
	case task.PROpening:
		return PROpening
	case task.PRReviewing:
		return reviewingStatus(art, facts, snap, read)
	case task.PRCommitting:
		return PRCommitting
	case task.PRDone:
		// The pull request is out of the app's hands: what GitHub says about it
		// is what the stage is shown as.
		switch run.PR.State {
		case task.PRStateMerged:
			return PRMerged
		case task.PRStateClosed:
			return PRClosedUnmerged
		default:
			return PRDone
		}
	case task.PRClosing:
		return PRClosing
	case task.PRClosed:
		return PRClosed
	default:
		return PRPreparing
	}
}

// reviewingStatus is what a pull request under review is shown as: the pass
// that runs, the report the agent still owes, the report that closed it, or how
// far the user got with the changes it asked for.
func reviewingStatus(art task.PRArtifacts, facts prFacts, snap review.Snapshot, read bool) PRStatus {
	if !facts.idle {
		return PRReviewing
	}
	last, ok := lastReport(art)
	if !ok || facts.passAsked {
		// The agent rested without the report of the pass it was asked for.
		return PRAwaitingReply
	}
	if last.Clean {
		// Transient: the evaluation that follows records it.
		return PRDone
	}
	switch {
	case !read || snap.Err != "" || snap.Total == 0:
		return PRAwaitingDecision
	case snap.Staged < snap.Total:
		return PRInReview
	default:
		return PRReadyToApprove
	}
}

// lastReport is the report of the pass that ran last, if any was written.
func lastReport(art task.PRArtifacts) (task.ReviewReport, bool) {
	if len(art.Reports) == 0 {
		return task.ReviewReport{}, false
	}
	return art.Reports[len(art.Reports)-1], true
}

// beginPR moves a task whose last step is committed to the PR stage and puts it
// under preparation. The caller holds the lock of the task.
func (s *Service) beginPR(ctx context.Context, t task.Task) error {
	if _, err := s.tasks.SetStage(ctx, t.ID, task.StagePR, false); err != nil {
		return err
	}
	// The steps are over: what is watched from here on is the review of the pull
	// request, and it is tracked again when a pass asks for changes.
	s.review.Forget(t.ID)
	if _, err := s.tasks.SetPRRun(ctx, t.ID, task.PRPreparing, nil); err != nil {
		return err
	}
	s.log.Info("pr stage started", "task", t.ID)
	s.spawnPRWork(t.ID, s.preparePR)
	return nil
}

// spawnPRWork runs work on the PR stage of a task, unless the flow is closed or
// the task already has work under way. The context is born here so that a
// cancellation between the spawn and the first call reaches it.
func (s *Service) spawnPRWork(id string, work func(context.Context, string)) {
	l := s.lockOf(id)

	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return
	}
	if l.pr != nil && l.pr.running {
		// The stage is busy: the work is asked for again by the evaluation that
		// follows the one under way, which decides on the state it leaves.
		l.pr.pending = true
		s.mu.Unlock()
		return
	}
	ctx, cancel := context.WithCancel(context.Background())
	l.pr = &prWork{running: true, cancel: cancel}
	s.mu.Unlock()

	go func() {
		defer s.finishPRWork(id)
		work(ctx, id)
	}()
}

// finishPRWork forgets the work of the PR stage and releases its context. A
// work refused while this one ran is not lost: the evaluation that follows
// starts it, now that the stage is free.
func (s *Service) finishPRWork(id string) {
	l := s.lockOf(id)

	s.mu.Lock()
	w := l.pr
	l.pr = nil
	s.mu.Unlock()

	if w == nil {
		return
	}
	if w.cancel != nil {
		w.cancel()
	}
	if w.pending {
		s.Check(id)
	}
}

// abortPRWork cancels the work of the PR stage of a task, if there is any. It
// does not wait: what a cancelled goroutine finds is a state it may not write.
func (s *Service) abortPRWork(id string) {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	if l.pr != nil && l.pr.cancel != nil {
		l.pr.cancel()
	}
}

// preparePR says whether the task can have a pull request at all and, when it
// can, opens the session that drafts it or picks up the pull request that is
// already there. It runs on the goroutine of the stage, so it never holds the
// lock of the task while it talks to git or to GitHub.
func (s *Service) preparePR(ctx context.Context, id string) {
	t, ok := s.prTask(ctx, id)
	if !ok {
		return
	}
	wt, ok := s.worktrees.Get(id)
	if !ok {
		s.blockPR(id, task.PRBlockNoWorktree, noWorktreeDetail)
		return
	}

	base, err := s.worktrees.Base(ctx, wt)
	if err != nil {
		s.blockPRUnlessCancelled(ctx, id, task.PRBlockGitFailed, err)
		return
	}

	if err = s.ghAuth(ctx); err != nil {
		s.blockPRUnlessCancelled(ctx, id, ghReason(err), err)
		return
	}
	pr, err := s.viewPR(ctx, wt)
	switch {
	case err == nil:
		s.recordPR(id, pr, false)
	case errors.Is(err, gh.ErrNoPR):
		s.startDraft(ctx, t, wt, base)
	default:
		s.blockPRUnlessCancelled(ctx, id, ghReason(err), err)
	}
}

// checkPR reads the pull request of a task again, which is what says that the
// agent opened it and, later, that the user merged it. It runs on the goroutine
// of the stage.
func (s *Service) checkPR(ctx context.Context, id string) {
	if _, ok := s.prTask(ctx, id); !ok {
		return
	}
	wt, ok := s.worktrees.Get(id)
	if !ok {
		return
	}
	run, hasRun := s.tasks.PRRun(id)
	// A task whose review closed clean is waiting for the merge: the reading
	// tells what became of the pull request, not what the app does next.
	awaiting := hasRun && run.Status == task.PRDone

	pr, err := s.viewPR(ctx, wt)
	if err == nil {
		s.setCheckError(id, "")
		s.recordPR(id, pr, awaiting)
		return
	}
	if ctx.Err() != nil {
		return
	}
	if awaiting {
		// A reading that fails says nothing about the merge, and the user knows
		// better than the app: the closing is offered with the warning.
		s.setCheckError(id, err.Error())
		s.log.Warn("read pull request failed", "task", id, "error", err)
		s.notify(id)
		return
	}
	if !errors.Is(err, gh.ErrNoPR) {
		// A reading that fails says nothing about the pull request: the state
		// stays where it is and the next evaluation asks again.
		s.log.Warn("read pull request failed", "task", id, "error", err)
		return
	}
	s.reopenDraft(id)
}

// notify says that something the app only keeps in memory about a task
// changed, which is how a failed reading of a pull request reaches the screen.
func (s *Service) notify(id string) {
	if s.onChange != nil {
		s.onChange(id)
	}
}

// prTask is the task a PR work belongs to, ok only while the task is still in
// the PR stage and the work was not cancelled.
func (s *Service) prTask(ctx context.Context, id string) (task.Task, bool) {
	if ctx.Err() != nil || s.isClosed() {
		return task.Task{}, false
	}
	t, ok := s.tasks.Get(id)
	if !ok || t.Stage != task.StagePR {
		return task.Task{}, false
	}
	return t, true
}

// ghAuth asks gh whether it is there and logged in.
func (s *Service) ghAuth(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, prCheckTimeout)
	defer cancel()

	return s.gh.Auth(ctx)
}

// viewPR asks gh for the pull request of the branch of a worktree.
func (s *Service) viewPR(ctx context.Context, wt worktree.Worktree) (gh.PR, error) {
	ctx, cancel := context.WithTimeout(ctx, prCheckTimeout)
	defer cancel()

	return s.gh.ViewPR(ctx, wt.Path, wt.Branch)
}

// recordPR stores the pull request a reading found and hands the task to its
// review. With detailsOnly, the task is already past the review and waiting for
// the merge: only what GitHub says about the pull request changes.
func (s *Service) recordPR(id string, pr gh.PR, detailsOnly bool) {
	ctx, cancel := context.WithTimeout(context.Background(), evaluateTimeout)
	defer cancel()

	details := task.PRDetails{
		Number:    pr.Number,
		URL:       pr.URL,
		State:     task.PRState(pr.State),
		Base:      pr.Base,
		CheckedAt: time.Now().UTC(),
	}
	if _, err := s.tasks.SetPRDetails(ctx, id, details); err != nil {
		s.log.Error("record pull request failed", "task", id, "error", err)
		return
	}
	if detailsOnly {
		s.log.Info("pull request read", "task", id, "state", string(details.State))
		s.Check(id)
		return
	}
	if _, err := s.tasks.SetPRRun(ctx, id, task.PRReviewing, nil); err != nil {
		s.log.Error("record reviewing pull request failed", "task", id, "error", err)
		return
	}
	s.log.Info("pull request found", "task", id, "number", pr.Number)
	s.Check(id)
}

// startDraft opens the session that writes the draft of a task that has no pull
// request yet.
func (s *Service) startDraft(ctx context.Context, t task.Task, wt worktree.Worktree, base string) {
	dbCtx, cancel := context.WithTimeout(context.Background(), evaluateTimeout)
	defer cancel()

	repo, err := s.repositoryOf(t)
	if err != nil {
		s.blockPR(t.ID, task.PRBlockGitFailed, err.Error())
		return
	}
	if _, err := s.tasks.SetPRRun(dbCtx, t.ID, task.PRDrafting, nil); err != nil {
		s.log.Error("record drafting pull request failed", "task", t.ID, "error", err)
		return
	}
	if ctx.Err() != nil {
		return
	}
	if err := s.sessions.Start(dbCtx, prInfo(t, wt, base, repo), false); err != nil {
		// The session records a process that fails in the conversation itself.
		s.log.Error("start pr session failed", "task", t.ID, "error", err)
	}
	s.log.Info("draft started", "task", t.ID, "worktree", wt.Path)
}

// reopenDraft brings a task whose pull request did not appear back to its
// draft, with the button enabled again. The conversation says what failed.
func (s *Service) reopenDraft(id string) {
	ctx, cancel := context.WithTimeout(context.Background(), evaluateTimeout)
	defer cancel()

	run, ok := s.tasks.PRRun(id)
	if !ok || run.Status != task.PROpening {
		return
	}
	if _, err := s.tasks.SetPRRun(ctx, id, task.PRDrafting, nil); err != nil {
		s.log.Error("record drafting pull request failed", "task", id, "error", err)
		return
	}
	s.setOpenFailed(id, true)
	s.log.Warn("pull request was not opened", "task", id)
	s.Check(id)
}

// blockPR records why the PR stage of a task cannot go on, in the words of the
// tool that refused.
func (s *Service) blockPR(id string, reason task.PRBlockReason, detail string) {
	ctx, cancel := context.WithTimeout(context.Background(), evaluateTimeout)
	defer cancel()

	block := &task.PRBlock{Reason: reason, Detail: detail}
	if _, err := s.tasks.SetPRRun(ctx, id, task.PRBlocked, block); err != nil {
		s.log.Error("record blocked pull request failed", "task", id, "error", err)
		return
	}
	s.log.Warn("pull request blocked", "task", id, "reason", string(reason))
}

// blockPRUnlessCancelled blocks the PR stage over a failure, unless the work
// was cancelled: then whoever cancelled it decides what the stage becomes.
func (s *Service) blockPRUnlessCancelled(
	ctx context.Context, id string, reason task.PRBlockReason, err error,
) {
	if ctx.Err() != nil {
		return
	}
	s.blockPR(id, reason, err.Error())
}

// ghReason is what a gh failure blocks the PR stage as.
func ghReason(err error) task.PRBlockReason {
	switch {
	case errors.Is(err, gh.ErrNotFound):
		return task.PRBlockGHMissing
	case errors.Is(err, gh.ErrNotAuthenticated):
		return task.PRBlockGHAuth
	default:
		return task.PRBlockGHFailed
	}
}

// evaluatePR keeps a task in the PR stage in step with its session, its
// artifacts and GitHub. It never talks to the network itself: every reading
// goes out on the goroutine of the stage.
func (s *Service) evaluatePR(ctx context.Context, t task.Task) {
	a, err := s.tasks.Inspect(t.ID)
	if err != nil {
		s.log.Error("inspect artifacts failed", "task", t.ID, "stage", string(t.Stage), "error", err)
		return
	}
	run, ok := s.tasks.PRRun(t.ID)
	if !ok {
		return
	}
	switch run.Status {
	case task.PRDrafting:
		sum, open := s.sessions.Summary(session.Key{TaskID: t.ID, Stage: session.PRStage})
		if open && sum.TurnRunning {
			// The conversation moved on after an opening that failed: what the
			// agent does in this turn decides what the stage waits for.
			s.setOpenFailed(t.ID, false)
		}
		// An agent that opened the pull request on its own, or an app that was
		// closed in the middle of it, is found by asking GitHub.
		if open && sum.Idle {
			s.spawnPRWork(t.ID, s.checkPR)
		}
	case task.PROpening:
		// GitHub is asked once the turn that opens the pull request is over: a
		// reading in the middle of it finds nothing yet, and would give the
		// draft back while the agent is still opening it.
		sum, open := s.sessions.Summary(session.Key{TaskID: t.ID, Stage: session.PRStage})
		if !open || !sum.TurnRunning {
			s.spawnPRWork(t.ID, s.checkPR)
		}
	case task.PRCommitting:
		if back, done := s.evaluatePRCommit(ctx, t, run); done {
			// The commit landed the task back in its review, and the pass it asks
			// for starts in this very evaluation.
			s.evaluateReview(ctx, t, back, a.PR)
		}
	case task.PRReviewing:
		s.evaluateReview(ctx, t, run, a.PR)
	case task.PRClosing:
		// The closing the user asked for, and the one a reading in flight kept
		// from starting when they asked.
		s.spawnPRWork(t.ID, s.closeWork)
	case task.PRPreparing, task.PRBlocked, task.PRDone, task.PRClosed:
		// Nothing of these is the user's to review.
		s.review.Forget(t.ID)
	}
	if run.Status == task.PRClosed {
		s.archive(ctx, t)
	}
}

// evaluateReview drives one pass of the review of a pull request: it starts
// the conversation, records the report a pass leaves behind, hands the changes
// to the user and asks for a new pass once they are committed.
func (s *Service) evaluateReview(ctx context.Context, t task.Task, run task.PRRun, art task.PRArtifacts) {
	wt, ok := s.worktrees.Get(t.ID)
	if !ok {
		return
	}
	key := session.Key{TaskID: t.ID, Stage: session.PRReviewStage}
	sum, open := s.sessions.Summary(key)
	if !open {
		// The first pass of the task, and the one a discarded review left
		// without a conversation.
		s.startReview(ctx, t, wt, run)
		return
	}

	if report, isNew := newReport(art, run.ReportedPass); isNew {
		updated, recorded := s.recordReport(ctx, t, wt, key, report)
		if !recorded {
			return
		}
		run = updated
	}
	last, hasReport := lastReport(art)
	if !hasReport {
		return
	}
	if last.Clean {
		if s.passAsked(t.ID) != "" {
			// A pass was asked for after this report: the task waits for the
			// report of that one.
			return
		}
		s.finishReview(ctx, t, run, key)
		return
	}

	// A pass that asks for changes is reviewed like a step: the user reads what
	// the agent did, file by file, in the worktree of the task.
	idle := sum.Idle
	s.review.Track(t.ID, wt, idle)
	if !idle {
		return
	}
	head := s.headOf(ctx, wt)
	if head == "" || head == run.ReviewedCommit || s.passAsked(t.ID) == head {
		return
	}
	s.askPass(ctx, t, wt, run, key, head)
}

// evaluatePRCommit decides what became of the commit the app asked for. It
// answers with the run the task goes back to reviewing with, and false while
// the commit turn is not over.
func (s *Service) evaluatePRCommit(ctx context.Context, t task.Task, run task.PRRun) (task.PRRun, bool) {
	key := session.Key{TaskID: t.ID, Stage: session.PRReviewStage}
	sum, open := s.sessions.Summary(key)
	if !open || !sum.Idle {
		return task.PRRun{}, false
	}
	// The commit turn is over: decide on a reading newer than it, not on one
	// the debounce still owes.
	snap, read := s.review.Refresh(t.ID)
	if !read || snap.Err != "" {
		return task.PRRun{}, false
	}

	back, err := s.tasks.SetPRRun(ctx, t.ID, task.PRReviewing, nil)
	if err != nil {
		s.log.Error("record reviewing pull request failed", "task", t.ID, "error", err)
		return task.PRRun{}, false
	}
	if snap.Head == "" || snap.Head == run.ReviewedCommit {
		// The agent finished its turn and the branch is where it was: whatever
		// it did, it did not commit, and the task goes back to the user.
		s.setPRNoCommit(t.ID, true)
		s.log.Warn("commit did not happen", "task", t.ID)
	}
	return back, true
}

// startReview opens the conversation that reviews the pull request of a task
// and hands it the prompt of the pass it is about to write.
func (s *Service) startReview(ctx context.Context, t task.Task, wt worktree.Worktree, run task.PRRun) {
	repo, err := s.repositoryOf(t)
	if err != nil {
		s.log.Error("start pr review session failed", "task", t.ID, "error", err)
		return
	}
	base := s.baseOf(ctx, wt)
	pass := run.ReportedPass + 1
	if err := s.sessions.Start(ctx, prReviewInfo(t, wt, base, repo, run.PR, pass), false); err != nil {
		// The session records a process that fails in the conversation itself.
		s.log.Error("start pr review session failed", "task", t.ID, "error", err)
		return
	}
	s.log.Info("pr review started", "task", t.ID, "pass", pass)
}

// recordReport stores the pass a report closed with the commit it covered and
// marks it in the conversation of the review.
func (s *Service) recordReport(
	ctx context.Context, t task.Task, wt worktree.Worktree, key session.Key, report task.ReviewReport,
) (task.PRRun, bool) {
	updated, err := s.tasks.SetPRReviewed(ctx, t.ID, s.headOf(ctx, wt), report.Pass)
	if err != nil {
		s.log.Error("record reviewed pull request failed", "task", t.ID, "error", err)
		return task.PRRun{}, false
	}
	s.setPassAsked(t.ID, "")
	s.sessions.MarkPRReview(ctx, key, report.Pass)
	s.log.Info("pr review written", "task", t.ID, "pass", report.Pass)
	return updated, true
}

// finishReview ends the review of the pull request of a task whose last pass
// found nothing to change. The task then waits for the merge, and for the
// closing the user asks for after it.
func (s *Service) finishReview(ctx context.Context, t task.Task, run task.PRRun, key session.Key) {
	if _, err := s.tasks.SetPRRun(ctx, t.ID, task.PRDone, nil); err != nil {
		s.log.Error("record done pull request failed", "task", t.ID, "error", err)
		return
	}
	s.review.Forget(t.ID)
	if err := s.sessions.Close(ctx, key); err != nil {
		s.log.Error("close pr review session failed", "task", t.ID, "error", err)
	}
	s.log.Info("pull request reviewed clean", "task", t.ID, "pass", run.ReportedPass)
}

// askPass asks the review session for a new pass over the commit the approval
// produced.
func (s *Service) askPass(
	ctx context.Context, t task.Task, wt worktree.Worktree, run task.PRRun, key session.Key, head string,
) {
	repo, err := s.repositoryOf(t)
	if err != nil {
		s.log.Error("render pr review prompt failed", "task", t.ID, "error", err)
		return
	}
	pass := run.ReportedPass + 1
	base := s.baseOf(ctx, wt)
	info := prReviewInfo(t, wt, base, repo, run.PR, pass)
	message, err := s.renderPrompt(prompts.StagePRReview, prReviewVars(info))
	if err != nil {
		s.log.Error("render pr review prompt failed", "task", t.ID, "error", err)
		return
	}
	// One commit asks for one pass, however many evaluations it takes for the
	// report of that pass to land.
	s.setPassAsked(t.ID, head)
	if err := s.sessions.SendFromApp(ctx, key, message); err != nil {
		s.setPassAsked(t.ID, "")
		s.log.Error("send pr review prompt failed", "task", t.ID, "error", err)
		return
	}
	s.log.Info("pr review pass asked", "task", t.ID, "pass", pass)
}

// newReport is the report of a pass the app has not recorded yet.
func newReport(art task.PRArtifacts, reported int) (task.ReviewReport, bool) {
	last, ok := lastReport(art)
	if !ok || last.Pass <= reported {
		return task.ReviewReport{}, false
	}
	return last, true
}

// headOf is the commit the branch of a worktree is on, "" when git cannot say.
func (s *Service) headOf(ctx context.Context, wt worktree.Worktree) string {
	status, err := s.worktrees.Status(ctx, wt)
	if err != nil {
		s.log.Warn("read worktree failed", "task", wt.TaskID, "path", wt.Path, "error", err)
		return ""
	}
	return status.Head
}

// prReviewVars are the placeholders the prompt of a review pass uses, taken
// from the session it is sent to.
func prReviewVars(info session.TaskInfo) prompts.Vars {
	return prompts.Vars{
		TaskName:     info.Name,
		ArtifactsDir: info.ArtifactsDir,
		PRDPath:      info.PRDPath,
		TechSpecPath: info.TechSpecPath,
		StepsDir:     info.StepsDir,
		OneShotPath:  info.OneShotPath,
		Repository:   info.Repository,
		Branch:       info.Branch,
		BaseBranch:   info.BaseBranch,
		ReviewPath:   info.ReviewPath,
		PRNumber:     info.PRNumber,
		PRURL:        info.PRURL,
	}
}

// passAsked is the commit the app last asked a review pass about.
func (s *Service) passAsked(id string) string {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	return l.passAsked
}

// setPassAsked records the commit a review pass was asked about, "" once the
// report of that pass is in.
func (s *Service) setPassAsked(id, commit string) {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	l.passAsked = commit
}

// checkError is what the last automatic reading of the pull request said when
// it failed, "" when the last one worked.
func (s *Service) checkError(id string) string {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	return l.checkError
}

// setCheckError records why a reading of the pull request failed, "" once one
// succeeds.
func (s *Service) setCheckError(id, message string) {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	l.checkError = message
}

// setPRNoCommit records whether the last approval of the review of the pull
// request ended without a commit.
func (s *Service) setPRNoCommit(id string, v bool) {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	l.prNoCommit = v
}

// prNoCommit reports whether the last approval of the review of the pull
// request ended without a commit.
func (s *Service) prNoCommit(id string) bool {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	return l.prNoCommit
}

// setOpenFailed records whether the last opening of the pull request ended
// without one.
func (s *Service) setOpenFailed(id string, v bool) {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	l.openFailed = v
}

// openFailed reports whether the last opening of the pull request ended without
// one.
func (s *Service) openFailed(id string) bool {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	return l.openFailed
}

// resumePR picks up a task in the PR stage where the app left it. A preparation
// under way holds the lock, and then there is nothing to resume.
func (s *Service) resumePR(ctx context.Context, t task.Task) {
	l := s.lockOf(t.ID)
	if !l.mu.TryLock() {
		return
	}
	defer l.mu.Unlock()

	run, ok := s.tasks.PRRun(t.ID)
	if !ok {
		return
	}
	switch run.Status {
	case task.PRPreparing:
		s.spawnPRWork(t.ID, s.preparePR)
	case task.PRDrafting, task.PROpening:
		s.reopenPRSession(ctx, t, run, false)
	case task.PRReviewing, task.PRCommitting:
		s.reopenPRSession(ctx, t, run, true)
	case task.PRDone:
		// The merge may have happened while the app was closed.
		if run.PR.Number > 0 && run.PR.State != task.PRStateMerged && run.PR.State != task.PRStateClosed {
			s.spawnPRWork(t.ID, s.checkPR)
		}
	case task.PRClosing:
		// The app was closed with git halfway through the closing.
		s.spawnPRWork(t.ID, s.closeWork)
	case task.PRClosed:
		// Nothing runs for a closed task.
	case task.PRBlocked:
		// Nothing runs for a blocked one; the user decides what happens next.
	}
}

// reopenPRSession opens the conversation the task was left in, the one of its
// pull request or the one of its review.
func (s *Service) reopenPRSession(ctx context.Context, t task.Task, run task.PRRun, isReview bool) {
	wt, ok := s.worktrees.Get(t.ID)
	if !ok {
		s.blockPR(t.ID, task.PRBlockNoWorktree, noWorktreeDetail)
		return
	}
	repo, err := s.repositoryOf(t)
	if err != nil {
		s.log.Error("open pr session failed", "task", t.ID, "error", err)
		return
	}
	base := s.baseOf(ctx, wt)

	info := prInfo(t, wt, base, repo)
	if isReview {
		info = prReviewInfo(t, wt, base, repo, run.PR, run.ReportedPass+1)
	}
	if err := s.sessions.Open(ctx, info); err != nil {
		s.log.Error("open pr session failed", "task", t.ID, "error", err)
	}
}

// baseOf is the ref the branch of a worktree was created from, "" when git
// cannot say: an empty base is a prompt with one placeholder less, not a
// session that fails to open.
func (s *Service) baseOf(ctx context.Context, wt worktree.Worktree) string {
	base, err := s.worktrees.Base(ctx, wt)
	if err != nil {
		s.log.Warn("read base branch failed", "task", wt.TaskID, "path", wt.Path, "error", err)
		return ""
	}
	return base
}

// tearDownPR ends the pull request stage of a task: its conversations, what the
// app recorded about it and the artifacts it wrote.
func (s *Service) tearDownPR(ctx context.Context, t task.Task) error {
	if _, ok := s.tasks.PRRun(t.ID); !ok {
		return nil
	}
	s.abortPRWork(t.ID)
	s.review.Forget(t.ID)

	// A PR stage started again later begins from nothing this one left.
	s.setOpenFailed(t.ID, false)
	s.setPassAsked(t.ID, "")

	if err := s.sessions.Discard(ctx, t.ID, session.PRStage, session.PRReviewStage); err != nil {
		return err
	}
	if err := s.tasks.ClearPRRun(ctx, t.ID); err != nil {
		return err
	}
	if err := s.tasks.RemoveArtifacts(ctx, t.ID, task.StagePR); err != nil {
		return err
	}
	s.log.Info("pull request torn down", "task", t.ID)
	return nil
}

// prInfo is what the session of the PR stage needs to know: the worktree it
// runs in, the branch it describes and where the draft goes.
func prInfo(t task.Task, wt worktree.Worktree, base string, repo repository.Repository) session.TaskInfo {
	info := prSessionInfo(t, wt, base, repo)
	info.Stage, info.Prompt = session.PRStage, prompts.StagePR
	info.DraftPath = t.DraftPath()
	info.Choice = t.Models.Stage(models.PR)
	if t.Card != nil {
		info.Card, info.CardReference = t.Card.Markdown(), t.Card.Reference()
	}
	return info
}

// prReviewInfo is what the session that reviews the pull request needs to know,
// with the report of the pass it is about to write.
func prReviewInfo(
	t task.Task, wt worktree.Worktree, base string, repo repository.Repository, pr task.PRDetails, pass int,
) session.TaskInfo {
	info := prSessionInfo(t, wt, base, repo)
	info.Stage, info.Prompt = session.PRReviewStage, prompts.StagePRReview
	info.ReviewPath = t.ReviewPath(pass)
	info.PRNumber, info.PRURL = strconv.Itoa(pr.Number), pr.URL
	info.Choice = t.Models.Stage(models.PRReview)
	return info
}

// prSessionInfo is what both sessions of the PR stage share.
func prSessionInfo(
	t task.Task, wt worktree.Worktree, base string, repo repository.Repository,
) session.TaskInfo {
	return session.TaskInfo{
		ID:           t.ID,
		Name:         t.Name,
		Dir:          wt.Path,
		ArtifactsDir: t.ArtifactsDir,
		PRDPath:      t.PRDPath(),
		TechSpecPath: t.TechSpecPath(),
		StepsDir:     t.StepsDir(),
		OneShotPath:  oneShotPath(t),
		Repository:   repo.FullName(),
		Branch:       wt.Branch,
		BaseBranch:   base,
	}
}

// The ways the flow refuses to act on the pull request of a task.
var (
	ErrNotInPR       = errors.New("flow: task is not in the pull request stage")
	ErrDraftMissing  = errors.New("flow: the draft is not ready")
	ErrEmptyDraft    = errors.New("flow: the draft needs a title and a description")
	ErrPRExists      = errors.New("flow: the pull request is already open")
	ErrNoPullRequest = errors.New("flow: the task has no pull request")
	ErrPRNotBlocked  = errors.New("flow: the pull request stage is not blocked")
	ErrNotClosable   = errors.New("flow: task is not waiting to be closed")
	ErrPRNotMerged   = errors.New("flow: the pull request has not been merged")
)

// prOf is the task a user operation acts on with the run of its PR stage. The
// caller holds the lock of the task.
func (s *Service) prOf(id string) (task.Task, task.PRRun, error) {
	t, ok := s.tasks.Get(id)
	if !ok {
		return task.Task{}, task.PRRun{}, fmt.Errorf("pull request of task %s: %w", id, task.ErrNotFound)
	}
	if t.Stage != task.StagePR {
		return task.Task{}, task.PRRun{}, fmt.Errorf("pull request of a task in %s: %w", t.Stage, ErrNotInPR)
	}
	run, ok := s.tasks.PRRun(id)
	if !ok {
		return task.Task{}, task.PRRun{}, fmt.Errorf("pull request of task %s: %w", id, ErrNotInPR)
	}
	return t, run, nil
}

// OpenPR writes the draft the user approved and asks the agent to open the
// pull request from it. A paused session is resumed first: the user should not
// have to think about processes to open what they wrote.
func (s *Service) OpenPR(ctx context.Context, id, title, body string) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	t, run, err := s.prOf(id)
	if err != nil {
		return err
	}
	if run.Status != task.PRDrafting {
		return fmt.Errorf("open the pull request of task %s: %w", id, ErrDraftMissing)
	}
	title, body = strings.TrimSpace(title), strings.TrimSpace(body)
	if title == "" || body == "" {
		return fmt.Errorf("open the pull request of task %s: %w", id, ErrEmptyDraft)
	}
	if t.Card != nil {
		body = task.EnsureClosingReference(body, *t.Card)
	}
	wt, ok := s.worktrees.Get(id)
	if !ok {
		return fmt.Errorf("open the pull request of task %s: %w", id, ErrNoWorktree)
	}
	repo, err := s.repositoryOf(t)
	if err != nil {
		return err
	}

	key := session.Key{TaskID: id, Stage: session.PRStage}
	sum, err := s.readySession(ctx, key)
	if err != nil {
		return fmt.Errorf("open the pull request of task %s: %w", id, err)
	}
	if !sum.Idle {
		return fmt.Errorf("open the pull request of task %s: %w", id, ErrStepBusy)
	}

	base := s.baseOf(ctx, wt)
	path := t.DraftPath()
	if err := task.WriteDraft(path, repo.FullName(), base, title, body); err != nil {
		return err
	}
	if _, err := s.tasks.SetPRRun(ctx, id, task.PROpening, nil); err != nil {
		return err
	}
	s.setOpenFailed(id, false)
	if err := s.sessions.SendFromApp(ctx, key, openMessage(path, base)); err != nil {
		// The button stays where the user left it: the draft is theirs again.
		if _, setErr := s.tasks.SetPRRun(ctx, id, task.PRDrafting, nil); setErr != nil {
			s.log.Error("record drafting pull request failed", "task", id, "error", setErr)
		}
		return err
	}
	s.log.Info("pull request opening", "task", id)
	return nil
}

// openMessage is what the app says to the session that wrote a draft once the
// user approves it.
func openMessage(draftPath, base string) string {
	return "The user approved the draft at `" + draftPath + "`. Open the pull request now, with the title and " +
		"the body of that file exactly as they are, against `" + base + "`. Do not change the text."
}

// ApprovePR approves the review of the changes a pass of the pull request
// review produced and asks the agent to commit and push them.
func (s *Service) ApprovePR(ctx context.Context, id string) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	t, run, err := s.prOf(id)
	if err != nil {
		return err
	}
	a, err := s.tasks.Inspect(id)
	if err != nil {
		return err
	}
	last, hasReport := lastReport(a.PR)
	if run.Status != task.PRReviewing || !hasReport || last.Clean {
		return fmt.Errorf("approve the review of task %s: %w", id, ErrStepNotReady)
	}
	snap, read := s.review.Snapshot(id)
	if !read || snap.Err != "" || !snap.Ready() {
		return fmt.Errorf("approve the review of task %s: %w", id, ErrStepNotReady)
	}

	key := session.Key{TaskID: id, Stage: session.PRReviewStage}
	sum, err := s.readySession(ctx, key)
	if err != nil {
		return fmt.Errorf("approve the review of task %s: %w", id, err)
	}
	if !sum.Idle {
		return fmt.Errorf("approve the review of task %s: %w", id, ErrStepBusy)
	}

	vars := commitVars(t)
	// The commit belongs to a pull request that is already open, so it goes up
	// with it.
	vars.Push = true
	message, err := s.renderPrompt(prompts.StageCommit, vars)
	if err != nil {
		return err
	}
	if _, err := s.tasks.SetPRRun(ctx, id, task.PRCommitting, nil); err != nil {
		return err
	}
	s.setPRNoCommit(id, false)
	if err := s.sessions.SendFromApp(ctx, key, message); err != nil {
		if _, setErr := s.tasks.SetPRRun(ctx, id, task.PRReviewing, nil); setErr != nil {
			s.log.Error("record reviewing pull request failed", "task", id, "error", setErr)
		}
		return err
	}
	s.log.Info("pr review approved", "task", id, "files", snap.Total)
	return nil
}

// readySession is the session of the PR stage, resumed when it was paused, so
// that what the user approves reaches an agent that can answer.
func (s *Service) readySession(ctx context.Context, key session.Key) (session.Summary, error) {
	sum, open := s.sessions.Summary(key)
	if !open {
		return session.Summary{}, session.ErrNotFound
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

// ReviewAgain ends the review session of a task and starts a new pass over the
// pull request as it is now. The reports already written stay.
func (s *Service) ReviewAgain(ctx context.Context, id string) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	_, run, err := s.prOf(id)
	if err != nil {
		return err
	}
	// A pull request that was closed without a merge, or a task already closing,
	// has no review to ask for.
	reviewable := (run.Status == task.PRReviewing || run.Status == task.PRDone) &&
		run.PR.State != task.PRStateClosed
	if !reviewable || run.PR.Number == 0 {
		return fmt.Errorf("review task %s again: %w", id, ErrNoPullRequest)
	}

	if err := s.sessions.Discard(ctx, id, session.PRReviewStage); err != nil {
		return err
	}
	if _, err := s.tasks.SetPRRun(ctx, id, task.PRReviewing, nil); err != nil {
		return err
	}
	// The pass asked for here is the one the review waits for: the report the
	// task already has, clean or not, decides nothing until that one is in.
	head := ""
	if wt, ok := s.worktrees.Get(id); ok {
		head = s.headOf(ctx, wt)
	}
	s.setPassAsked(id, cmp.Or(head, passAskedWithoutHead))
	s.setPRNoCommit(id, false)
	s.log.Info("pr review restarted", "task", id, "pass", run.ReportedPass+1)
	s.Check(id)
	return nil
}

// DiscardDraft throws away the draft of a task and prepares the stage again. It
// is refused once the pull request exists.
func (s *Service) DiscardDraft(ctx context.Context, id string) error {
	s.abortPRWork(id)

	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	t, run, err := s.prOf(id)
	if err != nil {
		return err
	}
	if run.PR.Number != 0 {
		return fmt.Errorf("discard the draft of task %s: %w", id, ErrPRExists)
	}
	if run.Status != task.PRDrafting && run.Status != task.PRBlocked {
		return fmt.Errorf("discard the draft of task %s: %w", id, ErrDraftMissing)
	}

	if err := s.sessions.Discard(ctx, id, session.PRStage); err != nil {
		return err
	}
	if err := os.Remove(t.DraftPath()); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return fmt.Errorf("remove draft %s: %w", t.DraftPath(), err)
	}
	if _, err := s.tasks.SetPRRun(ctx, id, task.PRPreparing, nil); err != nil {
		return err
	}
	s.setOpenFailed(id, false)
	s.log.Info("draft discarded", "task", id)
	s.spawnPRWork(id, s.preparePR)
	return nil
}

// RetryPR prepares a blocked PR stage again, which is what the user asks for
// after fixing whatever git or gh complained about.
func (s *Service) RetryPR(ctx context.Context, id string) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	_, run, err := s.prOf(id)
	if err != nil {
		return err
	}
	if run.Status != task.PRBlocked {
		return fmt.Errorf("retry the pull request of task %s: %w", id, ErrPRNotBlocked)
	}
	if _, err := s.tasks.SetPRRun(ctx, id, task.PRPreparing, nil); err != nil {
		return err
	}
	s.log.Info("pull request retried", "task", id)
	s.spawnPRWork(id, s.preparePR)
	return nil
}

// RefreshPR reads the pull request of a task again. It returns as soon as the
// reading is scheduled; what it finds reaches the user as state.
func (s *Service) RefreshPR(_ context.Context, id string) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	if _, _, err := s.prOf(id); err != nil {
		return err
	}
	s.spawnPRWork(id, s.checkPR)
	return nil
}

// PollPRs asks GitHub again about every pull request whose merge the app is
// waiting for. internal/app calls it on a timer; each reading goes out on the
// goroutine of its task and never blocks the caller.
func (s *Service) PollPRs() {
	if s.isClosed() {
		return
	}
	for _, t := range s.tasks.List() {
		if t.Stage != task.StagePR {
			continue
		}
		run, ok := s.tasks.PRRun(t.ID)
		if !ok || run.Status != task.PRDone || run.PR.Number == 0 {
			continue
		}
		if run.PR.State == task.PRStateMerged || run.PR.State == task.PRStateClosed {
			// A merged pull request has nothing more to say; a closed one is
			// asked again only when the user says so.
			continue
		}
		s.spawnPRWork(t.ID, s.checkPR)
	}
}
