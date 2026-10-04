package flow

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/worktree"
)

// CloseTask takes a task whose pull request was merged out of the list: its
// worktree goes, its branch goes, and the base branch of the clone catches up
// with the remote. The work runs on the goroutine of the PR stage; the state
// says when it is over.
func (s *Service) CloseTask(ctx context.Context, id string) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	t, run, err := s.prOf(id)
	if err != nil {
		return err
	}
	if !awaitingMerge(run, currentPassPtr(s.tasks.PRPasses(id))) {
		return fmt.Errorf("close task %s: %w", id, ErrNotClosable)
	}
	if run.PR.State == task.PRStateClosed {
		return fmt.Errorf("close task %s: %w", id, ErrNotClosable)
	}
	if run.PR.State != task.PRStateMerged && s.checkError(id) == "" {
		return fmt.Errorf("close task %s: %w", id, ErrPRNotMerged)
	}

	// Closing removes the worktree and the branch and updates the base branch,
	// all of which happen in the clone.
	if _, err := s.repositories.Check(t.RepositoryID); err != nil {
		return err
	}

	// The conversations of the stage ran inside the worktree; they stop before
	// it goes. Their records stay until the task is archived.
	for _, stage := range []string{session.PRStage, session.PRReviewStage} {
		if err := s.sessions.Close(ctx, session.Key{TaskID: id, Stage: stage}); err != nil {
			return err
		}
	}
	if _, err := s.tasks.SetPRRun(ctx, id, task.PRClosing, nil); err != nil {
		return err
	}
	s.log.Info("task closing", "task", id)
	s.spawnPRWork(id, s.closeWork)
	return nil
}

// closeWork carries out the closing of a task and records what it did. It runs
// on the goroutine of the PR stage. Once git was told to act, the result is
// recorded whatever happened to the context: what was removed was removed.
func (s *Service) closeWork(ctx context.Context, id string) {
	if _, ok := s.prTask(ctx, id); !ok {
		return
	}
	run, ok := s.tasks.PRRun(id)
	if !ok || run.Status != task.PRClosing {
		return
	}

	var result task.CloseResult
	wt, hasWorktree := s.worktrees.Get(id)
	if !hasWorktree {
		result = closeResultWithoutWorktree(time.Now().UTC())
	} else {
		result = s.worktrees.Close(ctx, wt, closeBase(run, wt), closePolicy(run))
	}

	dbCtx, cancel := context.WithTimeout(context.Background(), evaluateTimeout)
	defer cancel()

	if _, err := s.tasks.SetPRClosed(dbCtx, id, result); err != nil {
		s.log.Error("record closed task failed", "task", id, "error", err)
		return
	}
	s.review.Forget(id)
	s.log.Info("task closed", "task", id,
		"worktree", string(result.Worktree.Outcome),
		"branch", string(result.Branch.Outcome),
		"base", string(result.Base.Outcome))
	s.Check(id)
}

// closeBase is the local branch the closing brings up to date: the base of the
// pull request as GitHub named it, or the base the worktree was created from
// when there was no pull request.
func closeBase(run task.PRRun, wt worktree.Worktree) string {
	if run.PR.Base != "" {
		return run.PR.Base
	}
	return strings.TrimPrefix(wt.Base, "origin/")
}

// closePolicy says whether the branch goes without asking git. GitHub
// confirming the merge is enough, and a branch with no commit of its own has
// nothing to lose; only an unconfirmed merge leaves the decision to git. The
// status of the run is already closing here, so what says there was never a
// pull request is the pull request itself.
func closePolicy(run task.PRRun) worktree.BranchPolicy {
	if run.PR.Number == 0 || run.PR.State == task.PRStateMerged {
		return worktree.DeleteBranch
	}
	return worktree.DeleteBranchIfMerged
}

// closeResultWithoutWorktree is the closing of a task whose worktree the app no
// longer knows: there is nothing to remove and no base to update.
func closeResultWithoutWorktree(at time.Time) task.CloseResult {
	skipped := task.CloseStep{Outcome: task.OutcomeSkipped, Reason: task.SkipMissing}
	return task.CloseResult{Worktree: skipped, Branch: skipped, Base: skipped, ClosedAt: at}
}

// archive takes a closed task out of the active list. The conversations go with
// it; the artifacts and the record of the pull request stay for the history.
// The caller holds the lock of the task.
func (s *Service) archive(ctx context.Context, t task.Task) {
	s.abortPRWork(t.ID)
	s.review.Forget(t.ID)
	if err := s.sessions.DiscardTask(ctx, t.ID); err != nil {
		s.log.Error("discard sessions failed", "task", t.ID, "error", err)
		return
	}
	if _, err := s.tasks.Archive(ctx, t.ID); err != nil {
		s.log.Error("archive task failed", "task", t.ID, "error", err)
		return
	}
	s.log.Info("task archived", "task", t.ID, "name", t.Name)
}

// DeletePreview is what deleting a task would destroy, read from git and from
// the sessions at the moment the user asks.
type DeletePreview struct {
	Worktree *WorktreePreview // nil when the task has none
	Branch   *BranchPreview   // nil when the task has no worktree
	PR       *PRPreview       // nil when no pull request stays on GitHub
}

// WorktreePreview is the worktree of the task and whether it holds work.
type WorktreePreview struct {
	Path  string
	Dirty bool
	Files int    // changed files; dirty only
	Error string // what git said when the worktree could not be read
}

// BranchPreview is the branch of the task and whether its commits are safe
// elsewhere.
type BranchPreview struct {
	Name   string
	Merged bool // GitHub merged the pull request, or git sees the branch in its base
	Ahead  int  // commits of the branch not in its base; 0 when merged, -1 when unknown
	Error  string
}

// PRPreview is a pull request the app leaves on GitHub.
type PRPreview struct {
	Number int
	URL    string
	State  task.PRState
}

// DeleteResult is what deleting a task left behind.
type DeleteResult struct {
	Leftover *worktree.Leftover // nil when git removed everything
}

// PreviewDelete reads what deleting a task would destroy. It holds the lock of
// the task while it reads git, so that no step starts halfway through.
func (s *Service) PreviewDelete(ctx context.Context, id string) (DeletePreview, error) {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	t, ok := s.tasks.Lookup(id)
	if !ok {
		return DeletePreview{}, fmt.Errorf("preview the deletion of task %s: %w", id, task.ErrNotFound)
	}
	var preview DeletePreview
	if t.Archived() {
		// An archived task has no worktree, no branch and no conversation left:
		// the closing took them all.
		return preview, nil
	}

	run, hasRun := s.tasks.PRRun(id)
	if wt, found := s.worktrees.Get(id); found {
		status, err := s.worktrees.Status(ctx, wt)
		preview.Worktree = &WorktreePreview{
			Path:  wt.Path,
			Dirty: err == nil && !status.Clean(),
			Files: len(status.Changes),
			Error: errText(err),
		}
		branch := s.branchPreview(ctx, wt, run, hasRun)
		preview.Branch = &branch
	}
	if hasRun && run.PR.Number != 0 && run.Status != task.PRClosed {
		preview.PR = &PRPreview{Number: run.PR.Number, URL: run.PR.URL, State: run.PR.State}
	}
	return preview, nil
}

// branchPreview says whether the commits of the branch of a worktree are safe
// somewhere else. GitHub merging the pull request settles it: a squash or a
// rebase leaves git no way of seeing the branch in its base.
func (s *Service) branchPreview(
	ctx context.Context, wt worktree.Worktree, run task.PRRun, hasRun bool,
) BranchPreview {
	preview := BranchPreview{Name: wt.Branch}
	if hasRun && run.PR.State == task.PRStateMerged {
		preview.Merged = true
		return preview
	}
	preview.Ahead = -1
	if wt.Base == "" {
		// Nothing to compare the branch with; the user is told nothing rather
		// than told it is merged.
		return preview
	}
	merged, err := s.worktrees.Merged(ctx, wt, wt.Base)
	preview.Merged, preview.Error = merged, errText(err)
	if err != nil {
		return preview
	}
	if merged {
		preview.Ahead = 0
		return preview
	}
	if ahead, err := s.worktrees.Ahead(ctx, wt, wt.Base); err == nil {
		preview.Ahead = ahead
	}
	return preview
}

// errText is what an error says, "" when there is none.
func errText(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}
