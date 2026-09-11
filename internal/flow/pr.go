package flow

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/worktree"
)

// RepoStatus is what the interface shows about the pull request of one
// repository of a task.
type RepoStatus string

// The states a repository of the PR stage is shown in.
const (
	RepoPreparing        RepoStatus = "preparing"
	RepoBlocked          RepoStatus = "blocked"
	RepoDrafting         RepoStatus = "drafting"       // the agent is writing the draft
	RepoDraftReady       RepoStatus = "draft_ready"    // the draft awaits the OK
	RepoAwaitingReply    RepoStatus = "awaiting_reply" // the agent stopped short of what the app waits for: a draft, the pull request it was asked to open, or the report of a review pass
	RepoOpening          RepoStatus = "opening"
	RepoReviewing        RepoStatus = "reviewing"         // the agent is reviewing
	RepoAwaitingDecision RepoStatus = "awaiting_decision" // a report with changes, nothing changed yet
	RepoInReview         RepoStatus = "in_review"         // the applied changes are being reviewed
	RepoReadyToApprove   RepoStatus = "ready_to_approve"
	RepoCommitting       RepoStatus = "committing"
	RepoDone             RepoStatus = "done"      // the review closed clean and the pull request is still open
	RepoMerged           RepoStatus = "merged"    // the pull request was merged; the repository awaits closing
	RepoPRClosed         RepoStatus = "pr_closed" // the pull request was closed without a merge
	RepoClosing          RepoStatus = "closing"
	RepoClosed           RepoStatus = "closed"
	RepoSkipped          RepoStatus = "skipped"
)

// RepoState is one repository of a task in the PR stage, with everything the
// app knows about it.
type RepoState struct {
	Repository   string // relative path, as the steps name it
	RepoPath     string
	Slug         string
	Status       RepoStatus
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
	CanClose   bool              // the user may close the repository now

	// CommitFailed says the last approval of this repository ended without a
	// commit, the way a step says it.
	CommitFailed bool

	SessionStage string // the key of the live session of this repository, "" when none
	Session      session.Summary
}

// noWorktreeDetail is what blocks a repository whose worktree the app no
// longer knows about.
const noWorktreeDetail = "the worktree of this repository is gone; discard the plan to start over"

// passAskedWithoutHead is what marks a review pass as asked for when git cannot
// say which commit it is about.
const passAskedWithoutHead = "asked"

// Repos is every repository of a task in the PR stage, in the order the steps
// first named them.
func (s *Service) Repos(id string) []RepoState {
	t, ok := s.tasks.Get(id)
	if !ok {
		return nil
	}
	a, _ := s.tasks.Artifacts(id)
	runs := s.tasks.PRRuns(id)

	states := make([]RepoState, 0, len(runs))
	for _, repo := range prRepositories(a.Plan) {
		index := indexOfPRRun(runs, repo.Path)
		if index < 0 {
			continue
		}
		states = append(states, s.repoState(t, repo, runs[index], a))
	}
	// A repository the plan no longer names is still one the app recorded, and
	// hiding it would hide a pull request that exists.
	for _, run := range runs {
		if slices.IndexFunc(states, func(st RepoState) bool { return st.RepoPath == run.RepoPath }) >= 0 {
			continue
		}
		rel := repoRel(t, run.RepoPath)
		states = append(states, s.repoState(t, task.Repository{Rel: rel, Path: run.RepoPath}, run, a))
	}
	return states
}

// repoState is everything the app knows about one repository of the PR stage:
// what it recorded, what the folder of the task holds, what the session of the
// repository is doing and how far its review got.
func (s *Service) repoState(t task.Task, repo task.Repository, run task.PRRun, a task.Artifacts) RepoState {
	slug := task.Slug(repo.Rel)
	art := a.PR[slug]
	state := RepoState{
		Repository: repo.Rel,
		RepoPath:   repo.Path,
		Slug:       slug,
		Block:      run.Block,
		Reports:    art.Reports,
		PR:         run.PR,
		CheckError: s.checkError(t.ID, repo.Path),
		Close:      run.Close,
	}
	if art.Draft.Present {
		draft := art.Draft
		state.Draft = &draft
	}
	if wt, ok := s.worktrees.Get(t.ID, repo.Path); ok {
		state.WorktreePath, state.Branch, state.BaseBranch = wt.Path, wt.Branch, wt.Base
	}

	if stage := repoSessionStage(run.Status, slug); stage != "" {
		if sum, open := s.sessions.Summary(session.Key{TaskID: t.ID, Stage: stage}); open {
			state.SessionStage, state.Session = stage, sum
		}
	}
	snap, read := s.review.Snapshot(reviewKey(t.ID, repo.Path))
	state.Review = reading(snap, read)
	state.CommitFailed = s.repoNoCommit(t.ID, repo.Path)
	facts := repoFacts{
		idle:       state.Session.Idle && state.SessionStage != "",
		openFailed: s.openFailed(t.ID, repo.Path),
		passAsked:  s.passAsked(t.ID, repo.Path) != "",
	}
	state.Status = repoStatus(run, art, facts, snap, read)
	state.CanClose = canClose(state.Status, state.CheckError)
	return state
}

// canClose says when the closing of a repository is the user's to ask for: the
// merge was confirmed, the merge could not be checked, or there was never a
// pull request to merge.
func canClose(status RepoStatus, checkError string) bool {
	switch status {
	case RepoMerged, RepoSkipped:
		return true
	case RepoDone:
		return checkError != ""
	default:
		return false
	}
}

// repoSessionStage is the session a repository has open at a status, "" for
// the statuses that have none.
func repoSessionStage(status task.PRStatus, slug string) string {
	switch status {
	case task.PRDrafting, task.PROpening:
		return session.PRStage(slug)
	case task.PRReviewing, task.PRCommitting:
		return session.PRReviewStage(slug)
	case task.PRPreparing, task.PRBlocked, task.PRDone, task.PRClosing, task.PRClosed, task.PRSkipped:
		return ""
	default:
		return ""
	}
}

// repoFacts is what the app knows about a repository beyond its record and its
// artifacts.
type repoFacts struct {
	idle       bool // the session of the repository is open and at rest
	openFailed bool // the last opening of the pull request ended without one
	passAsked  bool // a review pass was asked for and its report is not in yet
}

// repoStatus turns what the app recorded, the artifacts on disk, what else it
// knows about the repository and the last reading of the worktree into the
// state a repository is shown in.
func repoStatus(run task.PRRun, art task.RepoArtifacts, facts repoFacts, snap review.Snapshot, read bool) RepoStatus {
	switch run.Status {
	case task.PRPreparing:
		return RepoPreparing
	case task.PRBlocked:
		return RepoBlocked
	case task.PRDrafting:
		switch {
		case !facts.idle:
			return RepoDrafting
		case !art.Draft.Present || facts.openFailed:
			return RepoAwaitingReply
		default:
			return RepoDraftReady
		}
	case task.PROpening:
		return RepoOpening
	case task.PRReviewing:
		return reviewingStatus(art, facts, snap, read)
	case task.PRCommitting:
		return RepoCommitting
	case task.PRDone:
		// The pull request is out of the app's hands: what GitHub says about it
		// is what the repository is shown as.
		switch run.PR.State {
		case task.PRStateMerged:
			return RepoMerged
		case task.PRStateClosed:
			return RepoPRClosed
		default:
			return RepoDone
		}
	case task.PRClosing:
		return RepoClosing
	case task.PRClosed:
		return RepoClosed
	case task.PRSkipped:
		return RepoSkipped
	default:
		return RepoPreparing
	}
}

// reviewingStatus is what a repository under review is shown as: the pass that
// runs, the report the agent still owes, the report that closed it, or how far
// the user got with the changes it asked for.
func reviewingStatus(art task.RepoArtifacts, facts repoFacts, snap review.Snapshot, read bool) RepoStatus {
	if !facts.idle {
		return RepoReviewing
	}
	last, ok := lastReport(art)
	if !ok || facts.passAsked {
		// The agent rested without the report of the pass it was asked for.
		return RepoAwaitingReply
	}
	if last.Clean {
		// Transient: the evaluation that follows records it.
		return RepoDone
	}
	switch {
	case !read || snap.Err != "" || snap.Total == 0:
		return RepoAwaitingDecision
	case snap.Staged < snap.Total:
		return RepoInReview
	default:
		return RepoReadyToApprove
	}
}

// lastReport is the report of the pass that ran last, if any was written.
func lastReport(art task.RepoArtifacts) (task.ReviewReport, bool) {
	if len(art.Reports) == 0 {
		return task.ReviewReport{}, false
	}
	return art.Reports[len(art.Reports)-1], true
}

// prRepositories are the repositories the steps of a plan name, in the order
// they first appear: the order the PR stage shows them in.
func prRepositories(plan task.Plan) []task.Repository {
	repos := make([]task.Repository, 0, len(plan.Steps))
	for _, step := range plan.Steps {
		if step.RepoPath == "" {
			continue
		}
		if slices.IndexFunc(repos, func(r task.Repository) bool { return r.Path == step.RepoPath }) >= 0 {
			continue
		}
		repos = append(repos, task.Repository{Rel: step.Repository, Path: step.RepoPath})
	}
	return repos
}

// indexOfPRRun finds the run of a repository by path.
func indexOfPRRun(runs []task.PRRun, repoPath string) int {
	return slices.IndexFunc(runs, func(r task.PRRun) bool { return r.RepoPath == repoPath })
}

// repoRel is the repository as the steps and the prompts name it: its path
// relative to the workspace of the task.
func repoRel(t task.Task, repoPath string) string {
	rel, err := filepath.Rel(t.WorkspacePath, repoPath)
	if err != nil {
		return repoPath
	}
	return rel
}

// beginPR moves a task whose last step is committed to the PR stage and puts
// every repository it touched under preparation. The caller holds the lock of
// the task.
func (s *Service) beginPR(ctx context.Context, t task.Task, plan task.Plan) error {
	repos := prRepositories(plan)
	if len(repos) == 0 {
		s.log.Warn("no repository to open a pull request for", "task", t.ID)
		return nil
	}
	if _, err := s.tasks.SetStage(ctx, t.ID, task.StagePR, false); err != nil {
		return err
	}
	// The steps are over: what is watched from here on is the review of a pull
	// request, and it is tracked again when a pass asks for changes.
	s.review.ForgetTask(t.ID)
	s.log.Info("pr stage started", "task", t.ID, "repositories", len(repos))

	for _, repo := range repos {
		if _, err := s.tasks.SetPRRun(ctx, t.ID, repo.Path, task.PRPreparing, nil); err != nil {
			return err
		}
		s.spawnRepoWork(t.ID, repo.Path, s.prepareRepo)
	}
	return nil
}

// spawnRepoWork runs work on the repository of a task, unless the flow is
// closed or the repository already has work under way. The context is born
// here so that a cancellation between the spawn and the first call reaches it.
func (s *Service) spawnRepoWork(id, repoPath string, work func(context.Context, string, string)) {
	l := s.lockOf(id)

	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return
	}
	if l.repos == nil {
		l.repos = map[string]*repoWork{}
	}
	if w, ok := l.repos[repoPath]; ok && w.running {
		// The repository is busy: the work is asked for again by the evaluation
		// that follows the one under way, which decides on the state it leaves.
		w.pending = true
		s.mu.Unlock()
		return
	}
	ctx, cancel := context.WithCancel(context.Background())
	l.repos[repoPath] = &repoWork{running: true, cancel: cancel}
	s.mu.Unlock()

	go func() {
		defer s.finishRepoWork(id, repoPath)
		work(ctx, id, repoPath)
	}()
}

// finishRepoWork forgets the work of a repository and releases its context. A
// work refused while this one ran is not lost: the evaluation that follows
// starts it, now that the repository is free.
func (s *Service) finishRepoWork(id, repoPath string) {
	l := s.lockOf(id)

	s.mu.Lock()
	w := l.repos[repoPath]
	delete(l.repos, repoPath)
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

// abortRepoWork cancels every repository of a task that has work under way. It
// does not wait: what a cancelled goroutine finds is a state it may not write.
func (s *Service) abortRepoWork(id string) {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	for _, w := range l.repos {
		if w.cancel != nil {
			w.cancel()
		}
	}
}

// prepareRepo says whether a repository can have a pull request at all and,
// when it can, opens the session that drafts it or picks up the pull request
// that is already there. It runs on the goroutine of the repository, so it
// never holds the lock of the task while it talks to git or to GitHub.
func (s *Service) prepareRepo(ctx context.Context, id, repoPath string) {
	t, ok := s.prRepoTask(ctx, id)
	if !ok {
		return
	}
	wt, ok := s.worktrees.Get(id, repoPath)
	if !ok {
		s.blockRepo(id, repoPath, task.PRBlockNoWorktree, noWorktreeDetail)
		return
	}

	base, err := s.worktrees.Base(ctx, wt)
	if err != nil {
		s.blockRepoUnlessCancelled(ctx, id, repoPath, task.PRBlockGitFailed, err)
		return
	}
	ahead, err := s.worktrees.Ahead(ctx, wt, base)
	if err != nil {
		s.blockRepoUnlessCancelled(ctx, id, repoPath, task.PRBlockGitFailed, err)
		return
	}
	if ahead == 0 {
		// The steps of this repository left no commit past the base: there is
		// nothing to open a pull request with.
		s.setRepo(id, repoPath, task.PRSkipped)
		return
	}

	if err = s.ghAuth(ctx); err != nil {
		s.blockRepoUnlessCancelled(ctx, id, repoPath, ghReason(err), err)
		return
	}
	pr, err := s.viewPR(ctx, wt)
	switch {
	case err == nil:
		s.recordPR(id, repoPath, pr, false)
	case errors.Is(err, gh.ErrNoPR):
		s.startDraft(ctx, t, wt, base, repoPath)
	default:
		s.blockRepoUnlessCancelled(ctx, id, repoPath, ghReason(err), err)
	}
}

// checkPR reads the pull request of a repository again, which is what says
// that the agent opened it and, later, that the user merged it. It runs on the
// goroutine of the repository.
func (s *Service) checkPR(ctx context.Context, id, repoPath string) {
	if _, ok := s.prRepoTask(ctx, id); !ok {
		return
	}
	wt, ok := s.worktrees.Get(id, repoPath)
	if !ok {
		return
	}
	runs := s.tasks.PRRuns(id)
	index := indexOfPRRun(runs, repoPath)
	// A repository whose review closed clean is waiting for the merge: the
	// reading tells what became of the pull request, not what the app does next.
	awaiting := index >= 0 && runs[index].Status == task.PRDone

	pr, err := s.viewPR(ctx, wt)
	if err == nil {
		s.setCheckError(id, repoPath, "")
		s.recordPR(id, repoPath, pr, awaiting)
		return
	}
	if ctx.Err() != nil {
		return
	}
	if awaiting {
		// A reading that fails says nothing about the merge, and the user knows
		// better than the app: the closing is offered with the warning.
		s.setCheckError(id, repoPath, err.Error())
		s.log.Warn("read pull request failed", "task", id, "repository", repoPath, "error", err)
		s.notify(id)
		return
	}
	if !errors.Is(err, gh.ErrNoPR) {
		// A reading that fails says nothing about the repository: the state
		// stays where it is and the next evaluation asks again.
		s.log.Warn("read pull request failed", "task", id, "repository", repoPath, "error", err)
		return
	}
	s.reopenDraft(id, repoPath)
}

// notify says that something the app only keeps in memory about a task
// changed, which is how a failed reading of a pull request reaches the screen.
func (s *Service) notify(id string) {
	if s.onChange != nil {
		s.onChange(id)
	}
}

// prRepoTask is the task a repository work belongs to, ok only while the task
// is still in the PR stage and the work was not cancelled.
func (s *Service) prRepoTask(ctx context.Context, id string) (task.Task, bool) {
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

// recordPR stores the pull request a reading found and hands the repository to
// its review. With detailsOnly, the repository is already past the review and
// waiting for the merge: only what GitHub says about the pull request changes.
func (s *Service) recordPR(id, repoPath string, pr gh.PR, detailsOnly bool) {
	ctx, cancel := context.WithTimeout(context.Background(), evaluateTimeout)
	defer cancel()

	details := task.PRDetails{
		Number:    pr.Number,
		URL:       pr.URL,
		State:     task.PRState(pr.State),
		Base:      pr.Base,
		CheckedAt: time.Now().UTC(),
	}
	if _, err := s.tasks.SetPRDetails(ctx, id, repoPath, details); err != nil {
		s.log.Error("record pull request failed", "task", id, "repository", repoPath, "error", err)
		return
	}
	if detailsOnly {
		s.log.Info("pull request read", "task", id, "repository", repoPath, "state", string(details.State))
		s.Check(id)
		return
	}
	if _, err := s.tasks.SetPRRun(ctx, id, repoPath, task.PRReviewing, nil); err != nil {
		s.log.Error("record reviewing repository failed", "task", id, "repository", repoPath, "error", err)
		return
	}
	s.log.Info("pull request found", "task", id, "repository", repoPath, "number", pr.Number)
	s.Check(id)
}

// startDraft opens the session that writes the draft of a repository that has
// no pull request yet.
func (s *Service) startDraft(ctx context.Context, t task.Task, wt worktree.Worktree, base, repoPath string) {
	dbCtx, cancel := context.WithTimeout(context.Background(), evaluateTimeout)
	defer cancel()

	if _, err := s.tasks.SetPRRun(dbCtx, t.ID, repoPath, task.PRDrafting, nil); err != nil {
		s.log.Error("record drafting repository failed", "task", t.ID, "repository", repoPath, "error", err)
		return
	}
	if ctx.Err() != nil {
		return
	}
	info := prInfo(t, wt, base, task.Slug(repoRel(t, repoPath)), s.tasks.Repositories(t))
	if err := s.sessions.Start(dbCtx, info, false); err != nil {
		// The session records a process that fails in the conversation itself.
		s.log.Error("start pr session failed", "task", t.ID, "repository", repoPath, "error", err)
	}
	s.log.Info("draft started", "task", t.ID, "repository", repoPath, "worktree", wt.Path)
}

// reopenDraft brings a repository whose pull request did not appear back to
// its draft, with the button enabled again. The conversation says what failed.
func (s *Service) reopenDraft(id, repoPath string) {
	ctx, cancel := context.WithTimeout(context.Background(), evaluateTimeout)
	defer cancel()

	runs := s.tasks.PRRuns(id)
	index := indexOfPRRun(runs, repoPath)
	if index < 0 || runs[index].Status != task.PROpening {
		return
	}
	if _, err := s.tasks.SetPRRun(ctx, id, repoPath, task.PRDrafting, nil); err != nil {
		s.log.Error("record drafting repository failed", "task", id, "repository", repoPath, "error", err)
		return
	}
	s.setOpenFailed(id, repoPath, true)
	s.log.Warn("pull request was not opened", "task", id, "repository", repoPath)
	s.Check(id)
}

// setRepo records a status of a repository that carries nothing else.
func (s *Service) setRepo(id, repoPath string, status task.PRStatus) {
	ctx, cancel := context.WithTimeout(context.Background(), evaluateTimeout)
	defer cancel()

	if _, err := s.tasks.SetPRRun(ctx, id, repoPath, status, nil); err != nil {
		s.log.Error("record repository status failed", "task", id, "repository", repoPath, "error", err)
		return
	}
	s.log.Info("repository status recorded", "task", id, "repository", repoPath, "status", string(status))
}

// blockRepo records why the PR stage of a repository cannot go on, in the
// words of the tool that refused.
func (s *Service) blockRepo(id, repoPath string, reason task.PRBlockReason, detail string) {
	ctx, cancel := context.WithTimeout(context.Background(), evaluateTimeout)
	defer cancel()

	block := &task.PRBlock{Reason: reason, Detail: detail}
	if _, err := s.tasks.SetPRRun(ctx, id, repoPath, task.PRBlocked, block); err != nil {
		s.log.Error("record blocked repository failed", "task", id, "repository", repoPath, "error", err)
		return
	}
	s.log.Warn("repository blocked", "task", id, "repository", repoPath, "reason", string(reason))
}

// blockRepoUnlessCancelled blocks a repository over a failure, unless the work
// was cancelled: then whoever cancelled it decides what the repository becomes.
func (s *Service) blockRepoUnlessCancelled(
	ctx context.Context, id, repoPath string, reason task.PRBlockReason, err error,
) {
	if ctx.Err() != nil {
		return
	}
	s.blockRepo(id, repoPath, reason, err.Error())
}

// ghReason is what a gh failure blocks the repository as.
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

// evaluatePR keeps the repositories of a task in the PR stage in step with
// their sessions, their artifacts and GitHub. It never talks to the network
// itself: every reading goes out on the goroutine of a repository.
func (s *Service) evaluatePR(ctx context.Context, t task.Task) {
	a, err := s.tasks.Inspect(t.ID)
	if err != nil {
		s.log.Error("inspect artifacts failed", "task", t.ID, "stage", string(t.Stage), "error", err)
		return
	}
	runs := s.tasks.PRRuns(t.ID)
	for _, run := range runs {
		slug := task.Slug(repoRel(t, run.RepoPath))
		switch run.Status {
		case task.PRDrafting:
			sum, open := s.sessions.Summary(session.Key{TaskID: t.ID, Stage: session.PRStage(slug)})
			if open && sum.TurnRunning {
				// The conversation moved on after an opening that failed: what the
				// agent does in this turn decides what the repository waits for.
				s.setOpenFailed(t.ID, run.RepoPath, false)
			}
			// An agent that opened the pull request on its own, or an app that
			// was closed in the middle of it, is found by asking GitHub.
			if open && sum.Idle {
				s.spawnRepoWork(t.ID, run.RepoPath, s.checkPR)
			}
		case task.PROpening:
			// GitHub is asked once the turn that opens the pull request is over: a
			// reading in the middle of it finds nothing yet, and would give the
			// draft back while the agent is still opening it.
			sum, open := s.sessions.Summary(session.Key{TaskID: t.ID, Stage: session.PRStage(slug)})
			if !open || !sum.TurnRunning {
				s.spawnRepoWork(t.ID, run.RepoPath, s.checkPR)
			}
		case task.PRCommitting:
			if back, done := s.evaluateRepoCommit(ctx, t, run, slug); done {
				// The commit landed the repository back in its review, and the
				// pass it asks for starts in this very evaluation.
				s.evaluateReview(ctx, t, back, slug, a.PR[slug])
			}
		case task.PRReviewing:
			s.evaluateReview(ctx, t, run, slug, a.PR[slug])
		case task.PRClosing:
			// The closing the user asked for, and the one a reading in flight
			// kept from starting when they asked.
			s.spawnRepoWork(t.ID, run.RepoPath, s.closeRepoWork)
		case task.PRPreparing, task.PRBlocked, task.PRDone, task.PRClosed, task.PRSkipped:
			// Nothing of these is the user's to review.
			s.review.Forget(reviewKey(t.ID, run.RepoPath))
		}
	}
	if allClosed(runs) {
		s.archive(ctx, t)
	}
}

// evaluateReview drives one pass of the review of a pull request: it starts
// the conversation, records the report a pass leaves behind, hands the changes
// to the user and asks for a new pass once they are committed.
func (s *Service) evaluateReview(ctx context.Context, t task.Task, run task.PRRun, slug string, art task.RepoArtifacts) {
	wt, ok := s.worktrees.Get(t.ID, run.RepoPath)
	if !ok {
		return
	}
	key := session.Key{TaskID: t.ID, Stage: session.PRReviewStage(slug)}
	sum, open := s.sessions.Summary(key)
	if !open {
		// The first pass of a repository, and the one a discarded review left
		// without a conversation.
		s.startReview(ctx, t, wt, run, slug)
		return
	}

	if report, isNew := newReport(art, run.ReportedPass); isNew {
		updated, recorded := s.recordReport(ctx, t, wt, run, key, report)
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
		if s.passAsked(t.ID, run.RepoPath) != "" {
			// A pass was asked for after this report: the repository waits for
			// the report of that one.
			return
		}
		s.finishReview(ctx, t, run, key)
		return
	}

	// A pass that asks for changes is reviewed like a step: the user reads
	// what the agent did, file by file, in the worktree of the repository.
	idle := sum.Idle
	s.review.Track(reviewKey(t.ID, run.RepoPath), wt, idle)
	if !idle {
		return
	}
	head := s.headOf(ctx, wt)
	if head == "" || head == run.ReviewedCommit || s.passAsked(t.ID, run.RepoPath) == head {
		return
	}
	s.askPass(ctx, t, wt, run, slug, key, head)
}

// evaluateRepoCommit decides what became of the commit the app asked for. It
// answers with the run the repository goes back to reviewing with, and false
// while the commit turn is not over.
func (s *Service) evaluateRepoCommit(
	ctx context.Context, t task.Task, run task.PRRun, slug string,
) (task.PRRun, bool) {
	key := session.Key{TaskID: t.ID, Stage: session.PRReviewStage(slug)}
	sum, open := s.sessions.Summary(key)
	if !open || !sum.Idle {
		return task.PRRun{}, false
	}
	// The commit turn is over: decide on a reading newer than it, not on one
	// the debounce still owes.
	snap, read := s.review.Refresh(reviewKey(t.ID, run.RepoPath))
	if !read || snap.Err != "" {
		return task.PRRun{}, false
	}

	back, err := s.tasks.SetPRRun(ctx, t.ID, run.RepoPath, task.PRReviewing, nil)
	if err != nil {
		s.log.Error("record reviewing repository failed", "task", t.ID, "repository", run.RepoPath, "error", err)
		return task.PRRun{}, false
	}
	if snap.Head == "" || snap.Head == run.ReviewedCommit {
		// The agent finished its turn and the branch is where it was: whatever
		// it did, it did not commit, and the repository goes back to the user.
		s.setRepoNoCommit(t.ID, run.RepoPath, true)
		s.log.Warn("commit did not happen", "task", t.ID, "repository", run.RepoPath)
	}
	return back, true
}

// startReview opens the conversation that reviews the pull request of a
// repository and hands it the prompt of the pass it is about to write.
func (s *Service) startReview(ctx context.Context, t task.Task, wt worktree.Worktree, run task.PRRun, slug string) {
	base := s.baseOf(ctx, wt)
	pass := run.ReportedPass + 1
	info := prReviewInfo(t, wt, base, slug, run.PR, pass, s.tasks.Repositories(t))
	if err := s.sessions.Start(ctx, info, false); err != nil {
		// The session records a process that fails in the conversation itself.
		s.log.Error("start pr review session failed", "task", t.ID, "repository", run.RepoPath, "error", err)
		return
	}
	s.log.Info("pr review started", "task", t.ID, "repository", run.RepoPath, "pass", pass)
}

// recordReport stores the pass a report closed with the commit it covered and
// marks it in the conversation of the repository.
func (s *Service) recordReport(
	ctx context.Context, t task.Task, wt worktree.Worktree, run task.PRRun, key session.Key, report task.ReviewReport,
) (task.PRRun, bool) {
	updated, err := s.tasks.SetPRReviewed(ctx, t.ID, run.RepoPath, s.headOf(ctx, wt), report.Pass)
	if err != nil {
		s.log.Error("record reviewed repository failed", "task", t.ID, "repository", run.RepoPath, "error", err)
		return task.PRRun{}, false
	}
	s.setPassAsked(t.ID, run.RepoPath, "")
	s.sessions.MarkPRReview(ctx, key, report.Pass)
	s.log.Info("pr review written", "task", t.ID, "repository", run.RepoPath, "pass", report.Pass)
	return updated, true
}

// finishReview ends the review of the pull request of a repository whose last
// pass found nothing to change. The repository then waits for the merge, and
// for the closing the user asks for after it.
func (s *Service) finishReview(ctx context.Context, t task.Task, run task.PRRun, key session.Key) {
	if _, err := s.tasks.SetPRRun(ctx, t.ID, run.RepoPath, task.PRDone, nil); err != nil {
		s.log.Error("record done repository failed", "task", t.ID, "repository", run.RepoPath, "error", err)
		return
	}
	s.review.Forget(reviewKey(t.ID, run.RepoPath))
	if err := s.sessions.Close(ctx, key); err != nil {
		s.log.Error("close pr review session failed", "task", t.ID, "repository", run.RepoPath, "error", err)
	}
	s.log.Info("pull request reviewed clean", "task", t.ID, "repository", run.RepoPath, "pass", run.ReportedPass)
}

// askPass asks the review session for a new pass over the commit the approval
// produced.
func (s *Service) askPass(
	ctx context.Context, t task.Task, wt worktree.Worktree, run task.PRRun, slug string, key session.Key, head string,
) {
	pass := run.ReportedPass + 1
	base := s.baseOf(ctx, wt)
	info := prReviewInfo(t, wt, base, slug, run.PR, pass, s.tasks.Repositories(t))
	message, err := s.renderPrompt(prompts.StagePRReview, prReviewVars(info))
	if err != nil {
		s.log.Error("render pr review prompt failed", "task", t.ID, "repository", run.RepoPath, "error", err)
		return
	}
	// One commit asks for one pass, however many evaluations it takes for the
	// report of that pass to land.
	s.setPassAsked(t.ID, run.RepoPath, head)
	if err := s.sessions.SendFromApp(ctx, key, message); err != nil {
		s.setPassAsked(t.ID, run.RepoPath, "")
		s.log.Error("send pr review prompt failed", "task", t.ID, "repository", run.RepoPath, "error", err)
		return
	}
	s.log.Info("pr review pass asked", "task", t.ID, "repository", run.RepoPath, "pass", pass)
}

// newReport is the report of a pass the app has not recorded yet.
func newReport(art task.RepoArtifacts, reported int) (task.ReviewReport, bool) {
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
		s.log.Warn("read worktree failed", "task", wt.TaskID, "repository", wt.RepoPath, "error", err)
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
		Repositories: info.Repositories,
		Repository:   info.Repository,
		Branch:       info.Branch,
		BaseBranch:   info.BaseBranch,
		ReviewPath:   info.ReviewPath,
		PRNumber:     info.PRNumber,
		PRURL:        info.PRURL,
	}
}

// passAsked is the commit the app last asked a review pass of a repository
// about.
func (s *Service) passAsked(id, repoPath string) string {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	return l.passAsked[repoPath]
}

// setPassAsked records the commit a review pass was asked about, "" once the
// report of that pass is in.
func (s *Service) setPassAsked(id, repoPath, commit string) {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	if l.passAsked == nil {
		l.passAsked = map[string]string{}
	}
	if commit == "" {
		delete(l.passAsked, repoPath)
		return
	}
	l.passAsked[repoPath] = commit
}

// checkError is what the last automatic reading of the pull request of a
// repository said when it failed, "" when the last one worked.
func (s *Service) checkError(id, repoPath string) string {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	return l.checkErrors[repoPath]
}

// setCheckError records why a reading of the pull request of a repository
// failed, "" once one succeeds.
func (s *Service) setCheckError(id, repoPath, message string) {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	if l.checkErrors == nil {
		l.checkErrors = map[string]string{}
	}
	if message == "" {
		delete(l.checkErrors, repoPath)
		return
	}
	l.checkErrors[repoPath] = message
}

// setRepoNoCommit records whether the last approval of a repository ended
// without a commit.
func (s *Service) setRepoNoCommit(id, repoPath string, v bool) {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	if l.repoNoCommit == nil {
		l.repoNoCommit = map[string]bool{}
	}
	if !v {
		delete(l.repoNoCommit, repoPath)
		return
	}
	l.repoNoCommit[repoPath] = true
}

// repoNoCommit reports whether the last approval of a repository ended without
// a commit.
func (s *Service) repoNoCommit(id, repoPath string) bool {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	return l.repoNoCommit[repoPath]
}

// setOpenFailed records whether the last opening of the pull request of a
// repository ended without one.
func (s *Service) setOpenFailed(id, repoPath string, v bool) {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	if l.openFailed == nil {
		l.openFailed = map[string]bool{}
	}
	if !v {
		delete(l.openFailed, repoPath)
		return
	}
	l.openFailed[repoPath] = true
}

// openFailed reports whether the last opening of the pull request of a
// repository ended without one.
func (s *Service) openFailed(id, repoPath string) bool {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	return l.openFailed[repoPath]
}

// resumePR picks up the repositories of a task in the PR stage where the app
// left them. A preparation under way holds the lock, and then there is nothing
// to resume.
func (s *Service) resumePR(ctx context.Context, t task.Task) {
	l := s.lockOf(t.ID)
	if !l.mu.TryLock() {
		return
	}
	defer l.mu.Unlock()

	repos := s.tasks.Repositories(t)
	for _, run := range s.tasks.PRRuns(t.ID) {
		switch run.Status {
		case task.PRPreparing:
			s.spawnRepoWork(t.ID, run.RepoPath, s.prepareRepo)
		case task.PRDrafting, task.PROpening:
			s.reopenRepoSession(ctx, t, run, repos, false)
		case task.PRReviewing, task.PRCommitting:
			s.reopenRepoSession(ctx, t, run, repos, true)
		case task.PRDone:
			// The merge may have happened while the app was closed.
			if run.PR.Number > 0 && run.PR.State != task.PRStateMerged && run.PR.State != task.PRStateClosed {
				s.spawnRepoWork(t.ID, run.RepoPath, s.checkPR)
			}
		case task.PRClosing:
			// The app was closed with git halfway through the closing.
			s.spawnRepoWork(t.ID, run.RepoPath, s.closeRepoWork)
		case task.PRClosed:
			// Nothing runs for a closed repository.
		case task.PRBlocked, task.PRSkipped:
			// Nothing runs for these; the user decides what happens next.
		}
	}
}

// reopenRepoSession opens the conversation a repository was left in, the one
// of its pull request or the one of its review.
func (s *Service) reopenRepoSession(
	ctx context.Context, t task.Task, run task.PRRun, repos []task.Repository, isReview bool,
) {
	wt, ok := s.worktrees.Get(t.ID, run.RepoPath)
	if !ok {
		s.blockRepo(t.ID, run.RepoPath, task.PRBlockNoWorktree, noWorktreeDetail)
		return
	}
	slug := task.Slug(repoRel(t, run.RepoPath))
	base := s.baseOf(ctx, wt)

	info := prInfo(t, wt, base, slug, repos)
	if isReview {
		info = prReviewInfo(t, wt, base, slug, run.PR, run.ReportedPass+1, repos)
	}
	if err := s.sessions.Open(ctx, info); err != nil {
		s.log.Error("open pr session failed", "task", t.ID, "repository", run.RepoPath, "error", err)
	}
}

// baseOf is the ref the branch of a worktree was created from, "" when git
// cannot say: an empty base is a prompt with one placeholder less, not a
// session that fails to open.
func (s *Service) baseOf(ctx context.Context, wt worktree.Worktree) string {
	base, err := s.worktrees.Base(ctx, wt)
	if err != nil {
		s.log.Warn("read base branch failed", "task", wt.TaskID, "repository", wt.RepoPath, "error", err)
		return ""
	}
	return base
}

// tearDownPR ends the pull request stage of a task: the conversations of its
// repositories, what the app recorded about them and the artifacts they wrote.
func (s *Service) tearDownPR(ctx context.Context, t task.Task) error {
	runs := s.tasks.PRRuns(t.ID)
	if len(runs) == 0 {
		return nil
	}
	s.abortRepoWork(t.ID)
	s.review.ForgetTask(t.ID)

	stages := make([]string, 0, 2*len(runs))
	for _, run := range runs {
		slug := task.Slug(repoRel(t, run.RepoPath))
		stages = append(stages, session.PRStage(slug), session.PRReviewStage(slug))
		// A PR stage started again later begins from nothing this one left.
		s.setOpenFailed(t.ID, run.RepoPath, false)
		s.setPassAsked(t.ID, run.RepoPath, "")
	}
	if err := s.sessions.Discard(ctx, t.ID, stages...); err != nil {
		return err
	}
	if err := s.tasks.ClearPRRuns(ctx, t.ID); err != nil {
		return err
	}
	if err := s.tasks.RemoveArtifacts(ctx, t.ID, task.StagePR); err != nil {
		return err
	}
	s.log.Info("pull requests torn down", "task", t.ID, "repositories", len(runs))
	return nil
}

// prInfo is what the session of the PR stage of a repository needs to know:
// the worktree it runs in, the branch it describes and where the draft goes.
func prInfo(t task.Task, wt worktree.Worktree, base, slug string, repos []task.Repository) session.TaskInfo {
	info := repoInfo(t, wt, base, repos)
	info.Stage, info.Prompt = session.PRStage(slug), prompts.StagePR
	info.DraftPath = t.DraftPath(slug)
	info.Choice = t.Models.Stage(models.PR)
	return info
}

// prReviewInfo is what the session that reviews the pull request of a
// repository needs to know, with the report of the pass it is about to write.
func prReviewInfo(
	t task.Task, wt worktree.Worktree, base, slug string, pr task.PRDetails, pass int, repos []task.Repository,
) session.TaskInfo {
	info := repoInfo(t, wt, base, repos)
	info.Stage, info.Prompt = session.PRReviewStage(slug), prompts.StagePRReview
	info.ReviewPath = t.ReviewPath(slug, pass)
	info.PRNumber, info.PRURL = strconv.Itoa(pr.Number), pr.URL
	info.Choice = t.Models.Stage(models.PRReview)
	return info
}

// repoInfo is what both sessions of a repository share.
func repoInfo(t task.Task, wt worktree.Worktree, base string, repos []task.Repository) session.TaskInfo {
	rels := make([]string, len(repos))
	for i, repo := range repos {
		rels[i] = repo.Rel
	}
	return session.TaskInfo{
		ID:           t.ID,
		Name:         t.Name,
		Dir:          wt.Path,
		ArtifactsDir: t.ArtifactsDir,
		PRDPath:      t.PRDPath(),
		TechSpecPath: t.TechSpecPath(),
		StepsDir:     t.StepsDir(),
		Repositories: rels,
		Repository:   repoRel(t, wt.RepoPath),
		Branch:       wt.Branch,
		BaseBranch:   base,
	}
}

// The ways the flow refuses to act on the pull request of a repository.
var (
	ErrNoRepo          = errors.New("flow: repository is not part of the pull request stage")
	ErrDraftMissing    = errors.New("flow: the draft is not ready")
	ErrEmptyDraft      = errors.New("flow: the draft needs a title and a description")
	ErrPRExists        = errors.New("flow: the pull request is already open")
	ErrNoPullRequest   = errors.New("flow: the repository has no pull request")
	ErrRepoNotBlocked  = errors.New("flow: repository is not blocked")
	ErrRepoNotClosable = errors.New("flow: repository is not waiting to be closed")
	ErrPRNotMerged     = errors.New("flow: the pull request has not been merged")
)

// repoOf is the task a user operation acts on with the run of the repository
// it names. The caller holds the lock of the task.
func (s *Service) repoOf(id, repoPath string) (task.Task, task.PRRun, error) {
	t, ok := s.tasks.Get(id)
	if !ok {
		return task.Task{}, task.PRRun{}, fmt.Errorf("repository %s of task %s: %w", repoPath, id, task.ErrNotFound)
	}
	if t.Stage != task.StagePR {
		return task.Task{}, task.PRRun{}, fmt.Errorf("repository %s of a task in %s: %w", repoPath, t.Stage, ErrNoRepo)
	}
	runs := s.tasks.PRRuns(id)
	index := indexOfPRRun(runs, repoPath)
	if index < 0 {
		return task.Task{}, task.PRRun{}, fmt.Errorf("repository %s of task %s: %w", repoPath, id, ErrNoRepo)
	}
	return t, runs[index], nil
}

// OpenPR writes the draft the user approved and asks the agent to open the
// pull request from it. A paused session is resumed first: the user should not
// have to think about processes to open what they wrote.
func (s *Service) OpenPR(ctx context.Context, id, repoPath, title, body string) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	t, run, err := s.repoOf(id, repoPath)
	if err != nil {
		return err
	}
	if run.Status != task.PRDrafting {
		return fmt.Errorf("open the pull request of %s: %w", repoPath, ErrDraftMissing)
	}
	title, body = strings.TrimSpace(title), strings.TrimSpace(body)
	if title == "" || body == "" {
		return fmt.Errorf("open the pull request of %s: %w", repoPath, ErrEmptyDraft)
	}
	wt, ok := s.worktrees.Get(id, repoPath)
	if !ok {
		return fmt.Errorf("open the pull request of %s: %w", repoPath, ErrNoWorktree)
	}

	slug := task.Slug(repoRel(t, repoPath))
	key := session.Key{TaskID: id, Stage: session.PRStage(slug)}
	sum, err := s.readySession(ctx, key)
	if err != nil {
		return fmt.Errorf("open the pull request of %s: %w", repoPath, err)
	}
	if !sum.Idle {
		return fmt.Errorf("open the pull request of %s: %w", repoPath, ErrStepBusy)
	}

	base := s.baseOf(ctx, wt)
	path := t.DraftPath(slug)
	if err := task.WriteDraft(path, repoRel(t, repoPath), base, title, body); err != nil {
		return err
	}
	if _, err := s.tasks.SetPRRun(ctx, id, repoPath, task.PROpening, nil); err != nil {
		return err
	}
	s.setOpenFailed(id, repoPath, false)
	if err := s.sessions.SendFromApp(ctx, key, openMessage(path, base)); err != nil {
		// The button stays where the user left it: the draft is theirs again.
		if _, setErr := s.tasks.SetPRRun(ctx, id, repoPath, task.PRDrafting, nil); setErr != nil {
			s.log.Error("record drafting repository failed", "task", id, "repository", repoPath, "error", setErr)
		}
		return err
	}
	s.log.Info("pull request opening", "task", id, "repository", repoPath)
	return nil
}

// openMessage is what the app says to the session that wrote a draft once the
// user approves it.
func openMessage(draftPath, base string) string {
	return "The user approved the draft at `" + draftPath + "`. Open the pull request now, with the title and " +
		"the body of that file exactly as they are, against `" + base + "`. Do not change the text."
}

// ApproveRepo approves the review of the changes a pass of the pull request
// review produced and asks the agent to commit and push them.
func (s *Service) ApproveRepo(ctx context.Context, id, repoPath string) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	t, run, err := s.repoOf(id, repoPath)
	if err != nil {
		return err
	}
	a, err := s.tasks.Inspect(id)
	if err != nil {
		return err
	}
	slug := task.Slug(repoRel(t, repoPath))
	last, hasReport := lastReport(a.PR[slug])
	if run.Status != task.PRReviewing || !hasReport || last.Clean {
		return fmt.Errorf("approve the review of %s: %w", repoPath, ErrStepNotReady)
	}
	snap, read := s.review.Snapshot(reviewKey(id, repoPath))
	if !read || snap.Err != "" || !snap.Ready() {
		return fmt.Errorf("approve the review of %s: %w", repoPath, ErrStepNotReady)
	}

	key := session.Key{TaskID: id, Stage: session.PRReviewStage(slug)}
	sum, err := s.readySession(ctx, key)
	if err != nil {
		return fmt.Errorf("approve the review of %s: %w", repoPath, err)
	}
	if !sum.Idle {
		return fmt.Errorf("approve the review of %s: %w", repoPath, ErrStepBusy)
	}

	vars := commitVars(t, s.tasks.Repositories(t))
	// The commit belongs to a pull request that is already open, so it goes up
	// with it.
	vars.Push = true
	message, err := s.renderPrompt(prompts.StageCommit, vars)
	if err != nil {
		return err
	}
	if _, err := s.tasks.SetPRRun(ctx, id, repoPath, task.PRCommitting, nil); err != nil {
		return err
	}
	s.setRepoNoCommit(id, repoPath, false)
	if err := s.sessions.SendFromApp(ctx, key, message); err != nil {
		if _, setErr := s.tasks.SetPRRun(ctx, id, repoPath, task.PRReviewing, nil); setErr != nil {
			s.log.Error("record reviewing repository failed", "task", id, "repository", repoPath, "error", setErr)
		}
		return err
	}
	s.log.Info("pr review approved", "task", id, "repository", repoPath, "files", snap.Total)
	return nil
}

// readySession is the session of a repository, resumed when it was paused, so
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

// ReviewAgain ends the review session of a repository and starts a new pass
// over the pull request as it is now. The reports already written stay.
func (s *Service) ReviewAgain(ctx context.Context, id, repoPath string) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	t, run, err := s.repoOf(id, repoPath)
	if err != nil {
		return err
	}
	// A pull request that was closed without a merge, or a repository already
	// closing, has no review to ask for.
	reviewable := (run.Status == task.PRReviewing || run.Status == task.PRDone) &&
		run.PR.State != task.PRStateClosed
	if !reviewable || run.PR.Number == 0 {
		return fmt.Errorf("review %s again: %w", repoPath, ErrNoPullRequest)
	}

	slug := task.Slug(repoRel(t, repoPath))
	if err := s.sessions.Discard(ctx, id, session.PRReviewStage(slug)); err != nil {
		return err
	}
	if _, err := s.tasks.SetPRRun(ctx, id, repoPath, task.PRReviewing, nil); err != nil {
		return err
	}
	// The pass asked for here is the one the review waits for: the report the
	// repository already has, clean or not, decides nothing until that one is in.
	head := ""
	if wt, ok := s.worktrees.Get(id, repoPath); ok {
		head = s.headOf(ctx, wt)
	}
	s.setPassAsked(id, repoPath, cmp.Or(head, passAskedWithoutHead))
	s.setRepoNoCommit(id, repoPath, false)
	s.log.Info("pr review restarted", "task", id, "repository", repoPath, "pass", run.ReportedPass+1)
	s.Check(id)
	return nil
}

// DiscardDraft throws away the draft of a repository and prepares it again. It
// is refused once the pull request exists.
func (s *Service) DiscardDraft(ctx context.Context, id, repoPath string) error {
	s.abortRepoWork(id)

	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	t, run, err := s.repoOf(id, repoPath)
	if err != nil {
		return err
	}
	if run.PR.Number != 0 {
		return fmt.Errorf("discard the draft of %s: %w", repoPath, ErrPRExists)
	}
	if run.Status != task.PRDrafting && run.Status != task.PRBlocked {
		return fmt.Errorf("discard the draft of %s: %w", repoPath, ErrDraftMissing)
	}

	slug := task.Slug(repoRel(t, repoPath))
	if err := s.sessions.Discard(ctx, id, session.PRStage(slug)); err != nil {
		return err
	}
	if err := os.Remove(t.DraftPath(slug)); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return fmt.Errorf("remove draft %s: %w", t.DraftPath(slug), err)
	}
	if _, err := s.tasks.SetPRRun(ctx, id, repoPath, task.PRPreparing, nil); err != nil {
		return err
	}
	s.setOpenFailed(id, repoPath, false)
	s.log.Info("draft discarded", "task", id, "repository", repoPath)
	s.spawnRepoWork(id, repoPath, s.prepareRepo)
	return nil
}

// RetryRepo prepares a blocked repository again, which is what the user asks
// for after fixing whatever git or gh complained about.
func (s *Service) RetryRepo(ctx context.Context, id, repoPath string) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	_, run, err := s.repoOf(id, repoPath)
	if err != nil {
		return err
	}
	if run.Status != task.PRBlocked {
		return fmt.Errorf("retry %s: %w", repoPath, ErrRepoNotBlocked)
	}
	if _, err := s.tasks.SetPRRun(ctx, id, repoPath, task.PRPreparing, nil); err != nil {
		return err
	}
	s.log.Info("repository retried", "task", id, "repository", repoPath)
	s.spawnRepoWork(id, repoPath, s.prepareRepo)
	return nil
}

// RefreshPR reads the pull request of a repository again. It returns as soon
// as the reading is scheduled; what it finds reaches the user as state.
func (s *Service) RefreshPR(_ context.Context, id, repoPath string) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	if _, _, err := s.repoOf(id, repoPath); err != nil {
		return err
	}
	s.spawnRepoWork(id, repoPath, s.checkPR)
	return nil
}

// allClosed reports whether every repository of the PR stage was closed by the
// user, which is when the task is done with the workspace.
func allClosed(runs []task.PRRun) bool {
	if len(runs) == 0 {
		return false
	}
	for _, run := range runs {
		if run.Status != task.PRClosed {
			return false
		}
	}
	return true
}

// PollPRs asks GitHub again about every pull request whose merge the app is
// waiting for. internal/app calls it on a timer; each reading goes out on the
// goroutine of its repository and never blocks the caller.
func (s *Service) PollPRs() {
	if s.isClosed() {
		return
	}
	for _, t := range s.tasks.List() {
		if t.Stage != task.StagePR {
			continue
		}
		for _, run := range s.tasks.PRRuns(t.ID) {
			if run.Status != task.PRDone || run.PR.Number == 0 {
				continue
			}
			if run.PR.State == task.PRStateMerged || run.PR.State == task.PRStateClosed {
				// A merged pull request has nothing more to say; a closed one is
				// asked again only when the user says so.
				continue
			}
			s.spawnRepoWork(t.ID, run.RepoPath, s.checkPR)
		}
	}
}
