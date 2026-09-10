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

// CloseRepo takes a repository whose pull request was merged out of the
// workspace: its worktree goes, its branch goes, and the base branch of the
// repository catches up with the remote. The work runs on the goroutine of the
// repository; the state says when it is over.
func (s *Service) CloseRepo(ctx context.Context, id, repoPath string) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	t, run, err := s.repoOf(id, repoPath)
	if err != nil {
		return err
	}
	switch run.Status {
	case task.PRSkipped:
		// There was never a pull request to merge: the branch had no commit of
		// its own.
	case task.PRDone:
		if run.PR.State == task.PRStateClosed {
			return fmt.Errorf("close %s: %w", repoPath, ErrRepoNotClosable)
		}
		if run.PR.State != task.PRStateMerged && s.checkError(id, repoPath) == "" {
			return fmt.Errorf("close %s: %w", repoPath, ErrPRNotMerged)
		}
	default:
		return fmt.Errorf("close %s: %w", repoPath, ErrRepoNotClosable)
	}

	// The conversations of the repository ran inside the worktree; they stop
	// before it goes. Their records stay until the task is archived.
	slug := task.Slug(repoRel(t, repoPath))
	for _, stage := range []string{session.PRStage(slug), session.PRReviewStage(slug)} {
		if err := s.sessions.Close(ctx, session.Key{TaskID: id, Stage: stage}); err != nil {
			return err
		}
	}
	if _, err := s.tasks.SetPRRun(ctx, id, repoPath, task.PRClosing, nil); err != nil {
		return err
	}
	s.log.Info("repository closing", "task", id, "repository", repoPath)
	s.spawnRepoWork(id, repoPath, s.closeRepoWork)
	return nil
}

// closeRepoWork carries out the closing of a repository and records what it
// did. It runs on the goroutine of the repository. Once git was told to act,
// the result is recorded whatever happened to the context: what was removed
// was removed.
func (s *Service) closeRepoWork(ctx context.Context, id, repoPath string) {
	if _, ok := s.prRepoTask(ctx, id); !ok {
		return
	}
	runs := s.tasks.PRRuns(id)
	index := indexOfPRRun(runs, repoPath)
	if index < 0 || runs[index].Status != task.PRClosing {
		return
	}
	run := runs[index]

	var result task.CloseResult
	wt, ok := s.worktrees.Get(id, repoPath)
	if !ok {
		result = closeResultWithoutWorktree(time.Now().UTC())
	} else {
		result = s.worktrees.Close(ctx, wt, closeBase(run, wt), closePolicy(run))
	}

	dbCtx, cancel := context.WithTimeout(context.Background(), evaluateTimeout)
	defer cancel()

	if _, err := s.tasks.SetPRClosed(dbCtx, id, repoPath, result); err != nil {
		s.log.Error("record closed repository failed", "task", id, "repository", repoPath, "error", err)
		return
	}
	s.review.Forget(reviewKey(id, repoPath))
	s.log.Info("repository closed", "task", id, "repository", repoPath,
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

// closeResultWithoutWorktree is the closing of a repository whose worktree the
// app no longer knows: there is nothing to remove and no base to update.
func closeResultWithoutWorktree(at time.Time) task.CloseResult {
	skipped := task.CloseStep{Outcome: task.OutcomeSkipped, Reason: task.SkipMissing}
	return task.CloseResult{Worktree: skipped, Branch: skipped, Base: skipped, ClosedAt: at}
}

// archive takes a task whose every repository was closed out of the workspace.
// The conversations go with it; the artifacts and the records of the pull
// requests stay for the history. The caller holds the lock of the task.
func (s *Service) archive(ctx context.Context, t task.Task) {
	s.abortRepoWork(t.ID)
	s.review.ForgetTask(t.ID)
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
	SessionRunning bool // a process of the task is alive and will be stopped
	Worktrees      []WorktreePreview
	Branches       []BranchPreview
	PRs            []PRPreview
}

// WorktreePreview is one worktree of the task and whether it holds work.
type WorktreePreview struct {
	Repository string // relative path, as the steps name it
	RepoPath   string
	Path       string
	Dirty      bool
	Files      int    // changed files; dirty only
	Error      string // what git said when the worktree could not be read
}

// BranchPreview is one branch of the task and whether its commits are safe
// elsewhere.
type BranchPreview struct {
	Repository string
	RepoPath   string
	Name       string
	Merged     bool // GitHub merged the pull request, or git sees the branch in its base
	Error      string
}

// PRPreview is a pull request the app leaves on GitHub.
type PRPreview struct {
	Repository string
	RepoPath   string
	Number     int
	URL        string
	State      task.PRState
}

// DeleteResult is what deleting a task left behind.
type DeleteResult struct {
	Leftovers []LeftoverInfo
}

// LeftoverInfo is a worktree.Leftover with the name of its repository.
type LeftoverInfo struct {
	Repository string
	RepoPath   string
	Path       string
	Branch     string
	Error      string
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
	// The frontend maps over the three lists without checking for null.
	preview := DeletePreview{
		Worktrees: []WorktreePreview{},
		Branches:  []BranchPreview{},
		PRs:       []PRPreview{},
	}
	if t.Archived() {
		// An archived task has no worktree, no branch and no conversation left:
		// the closing of its last repository took them all.
		return preview, nil
	}

	for key, sum := range s.sessions.Summaries() {
		if key.TaskID == id && sum.ProcessRunning {
			preview.SessionRunning = true
			break
		}
	}

	runs := s.tasks.PRRuns(id)
	for _, wt := range s.worktrees.List(id) {
		rel := repoRel(t, wt.RepoPath)
		status, err := s.worktrees.Status(ctx, wt)
		preview.Worktrees = append(preview.Worktrees, WorktreePreview{
			Repository: rel,
			RepoPath:   wt.RepoPath,
			Path:       wt.Path,
			Dirty:      err == nil && !status.Clean(),
			Files:      len(status.Changes),
			Error:      errText(err),
		})
		preview.Branches = append(preview.Branches, s.branchPreview(ctx, wt, rel, runs))
	}
	for _, run := range runs {
		if run.PR.Number == 0 || run.Status == task.PRClosed {
			continue
		}
		preview.PRs = append(preview.PRs, PRPreview{
			Repository: repoRel(t, run.RepoPath),
			RepoPath:   run.RepoPath,
			Number:     run.PR.Number,
			URL:        run.PR.URL,
			State:      run.PR.State,
		})
	}
	return preview, nil
}

// branchPreview says whether the commits of the branch of a worktree are safe
// somewhere else. GitHub merging the pull request settles it: a squash or a
// rebase leaves git no way of seeing the branch in its base.
func (s *Service) branchPreview(
	ctx context.Context, wt worktree.Worktree, rel string, runs []task.PRRun,
) BranchPreview {
	preview := BranchPreview{Repository: rel, RepoPath: wt.RepoPath, Name: wt.Branch}
	if index := indexOfPRRun(runs, wt.RepoPath); index >= 0 && runs[index].PR.State == task.PRStateMerged {
		preview.Merged = true
		return preview
	}
	if wt.Base == "" {
		// Nothing to compare the branch with; the user is told nothing rather
		// than told it is merged.
		return preview
	}
	merged, err := s.worktrees.Merged(ctx, wt, wt.Base)
	preview.Merged, preview.Error = merged, errText(err)
	return preview
}

// errText is what an error says, "" when there is none.
func errText(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}
