package flow

import (
	"context"
	"errors"
	"path/filepath"
	"slices"
	"strconv"
	"time"

	"github.com/guilhermt/myspec/internal/gh"
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
	RepoDrafting         RepoStatus = "drafting"    // the agent is writing the draft
	RepoDraftReady       RepoStatus = "draft_ready" // the draft awaits the OK
	RepoOpening          RepoStatus = "opening"
	RepoReviewing        RepoStatus = "reviewing"         // the agent is reviewing
	RepoAwaitingDecision RepoStatus = "awaiting_decision" // a report with changes, nothing changed yet
	RepoInReview         RepoStatus = "in_review"         // the applied changes are being reviewed
	RepoReadyToApprove   RepoStatus = "ready_to_approve"
	RepoCommitting       RepoStatus = "committing"
	RepoDone             RepoStatus = "done"
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

	SessionStage string // the key of the live session of this repository, "" when none
	Session      session.Summary
}

// noWorktreeDetail is what blocks a repository whose worktree the app no
// longer knows about.
const noWorktreeDetail = "the worktree of this repository is gone; discard the plan to start over"

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
	state.Status = repoStatus(run, art, state.Session.Idle && state.SessionStage != "", snap, read)
	return state
}

// repoSessionStage is the session a repository has open at a status, "" for
// the statuses that have none.
func repoSessionStage(status task.PRStatus, slug string) string {
	switch status {
	case task.PRDrafting, task.PROpening:
		return session.PRStage(slug)
	case task.PRReviewing, task.PRCommitting:
		return session.PRReviewStage(slug)
	case task.PRPreparing, task.PRBlocked, task.PRDone, task.PRSkipped:
		return ""
	default:
		return ""
	}
}

// repoStatus turns what the app recorded, the artifacts on disk, the session
// and the last reading of the worktree into the state a repository is shown
// in.
func repoStatus(run task.PRRun, art task.RepoArtifacts, idle bool, snap review.Snapshot, read bool) RepoStatus {
	switch run.Status {
	case task.PRPreparing:
		return RepoPreparing
	case task.PRBlocked:
		return RepoBlocked
	case task.PRDrafting:
		if !art.Draft.Present || !idle {
			return RepoDrafting
		}
		return RepoDraftReady
	case task.PROpening:
		return RepoOpening
	case task.PRReviewing:
		return reviewingStatus(art, idle, snap, read)
	case task.PRCommitting:
		return RepoCommitting
	case task.PRDone:
		return RepoDone
	case task.PRSkipped:
		return RepoSkipped
	default:
		return RepoPreparing
	}
}

// reviewingStatus is what a repository under review is shown as: the pass that
// runs, the report that closed it, or how far the user got with the changes it
// asked for.
func reviewingStatus(art task.RepoArtifacts, idle bool, snap review.Snapshot, read bool) RepoStatus {
	last, ok := lastReport(art)
	if !ok || !idle {
		return RepoReviewing
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

// finishRepoWork forgets the work of a repository and releases its context.
func (s *Service) finishRepoWork(id, repoPath string) {
	l := s.lockOf(id)

	s.mu.Lock()
	w := l.repos[repoPath]
	delete(l.repos, repoPath)
	s.mu.Unlock()

	if w != nil && w.cancel != nil {
		w.cancel()
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
		s.recordPR(id, repoPath, pr)
	case errors.Is(err, gh.ErrNoPR):
		s.startDraft(ctx, t, wt, base, repoPath)
	default:
		s.blockRepoUnlessCancelled(ctx, id, repoPath, ghReason(err), err)
	}
}

// checkPR reads the pull request of a repository again, which is what says
// that the agent opened it. It runs on the goroutine of the repository.
func (s *Service) checkPR(ctx context.Context, id, repoPath string) {
	if _, ok := s.prRepoTask(ctx, id); !ok {
		return
	}
	wt, ok := s.worktrees.Get(id, repoPath)
	if !ok {
		return
	}

	pr, err := s.viewPR(ctx, wt)
	if err == nil {
		s.recordPR(id, repoPath, pr)
		return
	}
	if ctx.Err() != nil {
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
// its review.
func (s *Service) recordPR(id, repoPath string, pr gh.PR) {
	ctx, cancel := context.WithTimeout(context.Background(), evaluateTimeout)
	defer cancel()

	details := task.PRDetails{
		Number:    pr.Number,
		URL:       pr.URL,
		State:     task.PRState(pr.State),
		CheckedAt: time.Now().UTC(),
	}
	if _, err := s.tasks.SetPRDetails(ctx, id, repoPath, details); err != nil {
		s.log.Error("record pull request failed", "task", id, "repository", repoPath, "error", err)
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
// their sessions and with GitHub. It never talks to the network itself: every
// reading goes out on the goroutine of a repository.
func (s *Service) evaluatePR(t task.Task) {
	for _, run := range s.tasks.PRRuns(t.ID) {
		slug := task.Slug(repoRel(t, run.RepoPath))
		switch run.Status {
		case task.PRDrafting:
			// An agent that opened the pull request on its own, or an app that
			// was closed in the middle of it, is found by asking GitHub.
			if s.repoSessionIdle(t.ID, session.PRStage(slug)) {
				s.spawnRepoWork(t.ID, run.RepoPath, s.checkPR)
			}
		case task.PROpening:
			s.spawnRepoWork(t.ID, run.RepoPath, s.checkPR)
		case task.PRPreparing, task.PRBlocked, task.PRDone, task.PRSkipped:
			// Nothing of these is the user's to review.
			s.review.Forget(reviewKey(t.ID, run.RepoPath))
		case task.PRReviewing, task.PRCommitting:
		}
	}
}

// repoSessionIdle reports whether the session of a repository is open and at
// rest.
func (s *Service) repoSessionIdle(id, stage string) bool {
	sum, open := s.sessions.Summary(session.Key{TaskID: id, Stage: stage})
	return open && sum.Idle
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
		case task.PRBlocked, task.PRDone, task.PRSkipped:
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
