package flow

import (
	"cmp"
	"context"
	"errors"
	"path/filepath"
	"slices"
	"strconv"
	"strings"

	"github.com/guilhermt/myspec/internal/divergence"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/worktree"
)

// lookupPR is the pull request of a task: the one it recorded, read by its
// number, or the one findPR finds.
func (s *Service) lookupPR(
	ctx context.Context, t task.Task, wt worktree.Worktree, base string, run task.PRRun,
) (gh.PR, *divergence.Divergence, error) {
	if run.PR.Number > 0 {
		pr, err := s.viewPR(ctx, wt, run)
		return pr, nil, err
	}
	return s.findPR(ctx, t, wt, base)
}

// prFoundKinds are the divergences about the pull requests the app found
// instead of the one of the task.
var prFoundKinds = []divergence.Kind{
	divergence.KindPRWrongBase, divergence.KindPROtherBranch, divergence.KindPRsAmbiguous,
}

// prDraftKinds are the divergences about the draft of the pull request.
var prDraftKinds = []divergence.Kind{divergence.KindDraftMissing, divergence.KindDraftUnreadable}

// findPR looks for the pull request of a task among the open ones of the
// repository: the candidates are the ones that come from the branch of the task
// or from its current commit. A single one that comes from the branch, into the
// base, is the pull request; no candidate is none, and every other answer is a
// divergence, which says what was found.
func (s *Service) findPR(
	ctx context.Context, t task.Task, wt worktree.Worktree, base string,
) (gh.PR, *divergence.Divergence, error) {
	ctx, cancel := context.WithTimeout(ctx, prCheckTimeout)
	defer cancel()

	open, err := s.gh.OpenPRs(ctx, wt.Path)
	if err != nil {
		return gh.PR{}, nil, err
	}
	head := s.headOf(ctx, wt)
	var candidates []gh.PRHead
	for _, pr := range open {
		if pr.Head == wt.Branch || (head != "" && pr.HeadOID == head) {
			candidates = append(candidates, pr)
		}
	}
	want := strings.TrimPrefix(base, "origin/")
	diverges := func(kind divergence.Kind) (gh.PR, *divergence.Divergence, error) {
		facts := divergence.Facts{Branch: wt.Branch, Base: want}
		for _, c := range candidates {
			facts.PRs = append(facts.PRs, divergence.PR{Number: c.Number, URL: c.URL, Base: c.Base, Head: c.Head})
		}
		return gh.PR{}, &divergence.Divergence{ItemID: t.ID, Stage: session.PRStage, Kind: kind, Facts: facts}, nil
	}

	switch {
	case len(candidates) == 0:
		return gh.PR{}, nil, nil
	case len(candidates) > 1:
		return diverges(divergence.KindPRsAmbiguous)
	case candidates[0].Head != wt.Branch:
		return diverges(divergence.KindPROtherBranch)
	case candidates[0].Base != want:
		return diverges(divergence.KindPRWrongBase)
	}
	pr, err := s.gh.ViewPR(ctx, wt.Path, strconv.Itoa(candidates[0].Number))
	if errors.Is(err, gh.ErrNoPR) {
		// The pull request was closed between the two readings.
		return gh.PR{}, nil, nil
	}
	return pr, nil, err
}

// checkDraftedPR looks for the pull request of a task that has none recorded:
// the draft waits, or the app opens it. One found is the task's, and a
// candidate that is not the one the app would open is a divergence.
func (s *Service) checkDraftedPR(ctx context.Context, t task.Task, wt worktree.Worktree, run task.PRRun) {
	if run.Status != task.PRDrafting && run.Status != task.PROpening {
		return
	}
	base, err := s.worktrees.Base(ctx, wt)
	if err != nil {
		s.log.Warn("read base branch failed", "task", t.ID, "error", err)
		return
	}
	pr, d, err := s.findPR(ctx, t, wt, base)
	switch {
	case ctx.Err() != nil:
	case err != nil:
		s.log.Warn("read pull request failed", "task", t.ID, "error", err)
	case d != nil:
		s.diverge(ctx, t, session.PRStage, d.Kind, d.Facts)
	case pr.Number > 0:
		s.recordPR(t.ID, pr, false)
	default:
		// What a divergence named is gone: the draft is waiting again.
		s.clearDivergence(ctx, t.ID, prFoundKinds...)
	}
}

// openedKinds are the divergences the approval of the draft ends: the ones
// about the draft, the one about a pull request that was not opened and the
// push the approval tries again.
var openedKinds = slices.Concat(prDraftKinds, []divergence.Kind{divergence.KindPRNotOpened, divergence.KindPushRejected})

// checkDraft reads the draft of a task whose agent rests and opens the
// divergence the draft has: it is not there, or it can't be read. A readable one
// ends them.
func (s *Service) checkDraft(ctx context.Context, t task.Task) {
	path := filepath.Join(task.PRDirName, task.DraftFile)
	_, ok, err := task.ReadDraft(t.DraftPath())
	switch {
	case errors.Is(err, task.ErrDraftUnreadable):
		s.diverge(ctx, t, session.PRStage, divergence.KindDraftUnreadable,
			divergence.Facts{Path: path, Reason: task.DraftReason(err)})
	case err != nil:
		s.log.Warn("read draft failed", "task", t.ID, "error", err)
	case !ok:
		s.diverge(ctx, t, session.PRStage, divergence.KindDraftMissing, divergence.Facts{Path: path})
	default:
		s.clearDivergence(ctx, t.ID, prDraftKinds...)
	}
}

// openWork pushes the branch of a task and opens its pull request from the
// draft the user approved. It runs on the goroutine of the stage, and a context
// that is cancelled records nothing.
func (s *Service) openWork(ctx context.Context, id string) {
	t, wt, base, ok := s.openTarget(ctx, id)
	if !ok || s.openFound(ctx, t, wt, base) {
		return
	}

	head := s.headOf(ctx, wt)
	if err := s.worktrees.Push(ctx, wt, wt.Branch); err != nil {
		switch {
		case ctx.Err() != nil:
		case errors.Is(err, git.ErrPushRejected):
			s.giveBackDraft(ctx, id)
			s.diverge(ctx, t, session.PRStage, divergence.KindPushRejected, divergence.Facts{
				Branch: wt.Branch, Commit: task.ShortSHA(head), Reason: gitSaid(err),
			})
		default:
			s.blockPR(id, task.PRBlockPushFailed, err.Error())
		}
		return
	}
	s.clearDivergence(ctx, id, divergence.KindPushRejected)

	draft, found, err := task.ReadDraft(t.DraftPath())
	if err != nil || !found {
		// The approval wrote the draft a moment ago: whoever changed it since
		// leaves the user with a draft that the agent has to write again.
		s.giveBackDraft(ctx, id)
		s.checkDraft(ctx, t)
		return
	}
	createCtx, cancel := context.WithTimeout(ctx, prCheckTimeout)
	number, _, err := s.gh.CreatePR(createCtx, wt.Path, strings.TrimPrefix(base, "origin/"), wt.Branch, draft.Title, draft.Body)
	cancel()
	if err != nil {
		s.blockPRUnlessCancelled(ctx, id, openReason(err), err)
		return
	}
	pr, err := s.viewPRNumber(ctx, wt, number)
	if err != nil {
		s.blockPRUnlessCancelled(ctx, id, ghReason(err), err)
		return
	}
	s.recordPR(id, pr, false)
}

// openResumed picks the opening up after the app was closed in the middle of
// it: the pull request is there, or the draft is given back as approved.
func (s *Service) openResumed(ctx context.Context, id string) {
	t, wt, base, ok := s.openTarget(ctx, id)
	if !ok || s.openFound(ctx, t, wt, base) {
		return
	}
	s.giveBackDraft(ctx, id)
	s.diverge(ctx, t, session.PRStage, divergence.KindPRNotOpened, divergence.Facts{
		Base: strings.TrimPrefix(base, "origin/"), Branch: wt.Branch,
	})
}

// openTarget is what the work that opens a pull request needs: the task, its
// worktree and the base; ok is false when the work has nothing to do, after it
// recorded why.
func (s *Service) openTarget(ctx context.Context, id string) (task.Task, worktree.Worktree, string, bool) {
	t, ok := s.prTask(ctx, id)
	if !ok {
		return task.Task{}, worktree.Worktree{}, "", false
	}
	wt, ok := s.worktrees.Get(id)
	if !ok {
		s.blockPR(id, task.PRBlockNoWorktree, noWorktreeDetail)
		return task.Task{}, worktree.Worktree{}, "", false
	}
	base, err := s.worktrees.Base(ctx, wt)
	if err != nil {
		s.blockPRUnlessCancelled(ctx, id, task.PRBlockGitFailed, err)
		return task.Task{}, worktree.Worktree{}, "", false
	}
	return t, wt, base, true
}

// openFound says whether the pull request of the task is already there, and
// acts on it: one found is recorded, and a divergence about it gives the draft
// back with the divergence open. It says false when GitHub has none.
func (s *Service) openFound(ctx context.Context, t task.Task, wt worktree.Worktree, base string) bool {
	pr, d, err := s.findPR(ctx, t, wt, base)
	switch {
	case ctx.Err() != nil:
	case err != nil:
		s.blockPR(t.ID, ghReason(err), err.Error())
	case d != nil:
		s.giveBackDraft(ctx, t.ID)
		s.diverge(ctx, t, d.Stage, d.Kind, d.Facts)
	case pr.Number > 0:
		s.recordPR(t.ID, pr, false)
	default:
		return false
	}
	return true
}

// giveBackDraft records the draft of a task as waiting again, which is where
// an opening that did not happen leaves it.
func (s *Service) giveBackDraft(ctx context.Context, id string) {
	if _, err := s.tasks.SetPRRun(ctx, id, task.PRDrafting, nil); err != nil {
		s.log.Error("record drafting pull request failed", "task", id, "error", err)
	}
}

// viewPRNumber reads a pull request by its number.
func (s *Service) viewPRNumber(ctx context.Context, wt worktree.Worktree, number int) (gh.PR, error) {
	return s.viewPR(ctx, wt, task.PRRun{PR: task.PRDetails{Number: number}})
}

// openReason is what a failure to open the pull request blocks the stage as:
// gh missing or signed out say so, and any other refusal is the opening.
func openReason(err error) task.PRBlockReason {
	switch reason := ghReason(err); reason {
	case task.PRBlockGHMissing, task.PRBlockGHAuth:
		return reason
	default:
		return task.PRBlockOpenFailed
	}
}

// gitSaid is what git answered to a command that failed, as it wrote it.
func gitSaid(err error) string {
	if gitErr, ok := errors.AsType[*git.Error](err); ok && gitErr.Output != "" {
		return gitErr.Output
	}
	return err.Error()
}

// pushed says whether the remote has the commit the worktree is at. A reading
// that fails counts as pushed, so that a git that can't be read is never pushed
// to.
func (s *Service) pushed(ctx context.Context, wt worktree.Worktree, ref string) bool {
	ok, err := s.worktrees.Pushed(ctx, wt, ref)
	if err != nil {
		s.log.Warn("read pushed commit failed", "task", wt.TaskID, "path", wt.Path, "error", err)
		return true
	}
	return ok
}

// pushAllowed says whether the app may push the commit of a task now. It may
// not push one the remote refused until the user asks for it to be checked
// again; letting it push spends that request.
func (s *Service) pushAllowed(ctx context.Context, id string, wt worktree.Worktree) bool {
	d, ok := s.divergences.Get(id)
	if !ok || d.Kind != divergence.KindPushRejected || d.Facts.Commit != task.ShortSHA(s.headOf(ctx, wt)) {
		return true
	}
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	allowed := l.retryPush
	l.retryPush = false
	return allowed
}

// setRetryPush lets the next evaluation push a commit the remote refused.
func (s *Service) setRetryPush(id string) {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	l.retryPush = true
}

// pushWork pushes the commit of a task to its pull request. It runs on the
// goroutine of the stage, and a context that is cancelled records nothing.
func (s *Service) pushWork(ctx context.Context, id string) {
	t, ok := s.prTask(ctx, id)
	if !ok {
		return
	}
	wt, ok := s.worktrees.Get(id)
	if !ok {
		s.blockPR(id, task.PRBlockNoWorktree, noWorktreeDetail)
		return
	}
	run, ok := s.tasks.PRRun(id)
	if !ok {
		return
	}
	head := s.headOf(ctx, wt)
	if err := s.worktrees.Push(ctx, wt, cmp.Or(run.PR.Head, wt.Branch)); err != nil {
		switch {
		case ctx.Err() != nil:
		case errors.Is(err, git.ErrPushRejected):
			s.backToReview(ctx, id)
			s.diverge(ctx, t, session.PRReviewStage, divergence.KindPushRejected, divergence.Facts{
				Branch: wt.Branch, Commit: task.ShortSHA(head), Reason: gitSaid(err),
			})
		default:
			s.blockPR(id, task.PRBlockPushFailed, err.Error())
		}
		return
	}
	s.clearDivergence(ctx, id, divergence.KindPushRejected)
	s.backToReview(ctx, id)
	s.Check(id)
}

// backToReview records the review of a pull request as running again.
func (s *Service) backToReview(ctx context.Context, id string) {
	if _, err := s.tasks.SetPRRun(ctx, id, task.PRReviewing, nil); err != nil {
		s.log.Error("record reviewing pull request failed", "task", id, "error", err)
	}
}
