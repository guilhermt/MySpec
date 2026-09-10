package flow_test

import (
	"errors"
	"slices"
	"testing"

	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/worktree"
)

// mergedPR is the pull request of a repository the user merged on GitHub, with
// the branch GitHub says it merged into.
func mergedPR() task.PRDetails {
	pr := openPR()
	pr.State, pr.Base = task.PRStateMerged, "dev"
	return pr
}

// closedPR is a pull request closed on GitHub without a merge.
func closedPR() task.PRDetails {
	pr := openPR()
	pr.State = task.PRStateClosed
	return pr
}

// awaitingClosing puts a task in the PR stage with the worktree of every
// repository of its plan and the record the test wants for each of them.
func awaitingClosing(f *fixture, id string, plan task.Plan, runs ...task.PRRun) task.Task {
	t := f.tasks.add(id, task.StagePR, task.Artifacts{PRD: true, TechSpec: true, Plan: plan})
	for _, repo := range planRepos(plan) {
		f.worktrees.seed(t, repo)
	}
	for _, run := range runs {
		f.tasks.setPRRun(id, run)
	}
	return t
}

// waitPRStatus polls until the app has recorded a status for a repository.
func (f *fixture) waitPRStatus(t *testing.T, id, repoPath string, status task.PRStatus) {
	t.Helper()

	waitFor(t, "repository "+repoPath+" of "+id+" to be recorded as "+string(status), func() bool {
		run, ok := f.tasks.prRun(id, repoPath)
		return ok && run.Status == status
	})
}

func TestClosingARepositoryIsRefusedUntilTheMergeIsConfirmed(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		status task.PRStatus
		pr     task.PRDetails
		want   error
	}{
		{"the review is still running", task.PRReviewing, openPR(), flow.ErrRepoNotClosable},
		{"the pull request is still open", task.PRDone, openPR(), flow.ErrPRNotMerged},
		{"the pull request was closed without a merge", task.PRDone, closedPR(), flow.ErrRepoNotClosable},
		{"the repository is already closed", task.PRClosed, mergedPR(), flow.ErrRepoNotClosable},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			awaitingClosing(f, "task-1", plan(), task.PRRun{RepoPath: repos[0].Path, Status: test.status, PR: test.pr})

			wantErrIs(t, f.service.CloseRepo(t.Context(), "task-1", repos[0].Path), test.want)

			run, _ := f.tasks.prRun("task-1", repos[0].Path)
			if run.Status != test.status {
				t.Errorf("status = %q, want %q: a refused closing changes nothing", run.Status, test.status)
			}
			if calls := f.worktrees.closings(); len(calls) != 0 {
				t.Errorf("closings = %+v, want none", calls)
			}
		})
	}
}

func TestClosingAMergedRepositoryTakesDownItsWorktreeAndRecordsWhatHappened(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	awaitingClosing(f, "task-1", twoStepPlan(),
		task.PRRun{RepoPath: repos[0].Path, Status: task.PRDone, PR: mergedPR()},
		task.PRRun{RepoPath: repos[1].Path, Status: task.PRDone, PR: openPR()},
	)

	if err := f.service.CloseRepo(t.Context(), "task-1", repos[0].Path); err != nil {
		t.Fatalf("CloseRepo() = %v, want nil", err)
	}
	f.waitRepo(t, "task-1", repos[0].Path, flow.RepoClosed)

	// The conversations of the repository stop before the worktree they run in.
	calls := f.sessions.recorded()
	if !slices.Contains(calls, "close:task-1:pr:api") || !slices.Contains(calls, "close:task-1:pr_review:api") {
		t.Errorf("session calls = %q, want both conversations of api closed", calls)
	}
	// The repository passes through closing, so the user sees git at work.
	taskCalls := f.tasks.recorded()
	closing, closed := slices.Index(taskCalls, "pr:closing:task-1:api"), slices.Index(taskCalls, "prClosed:task-1:api")
	if closing < 0 || closed < 0 || closing > closed {
		t.Errorf("task calls = %q, want closing before closed", taskCalls)
	}

	closings := f.worktrees.closings()
	if len(closings) != 1 {
		t.Fatalf("closings = %+v, want one", closings)
	}
	// GitHub says what the pull request merged into, and that GitHub merged it
	// is reason enough for the branch to go.
	if closings[0].base != "dev" || closings[0].policy != worktree.DeleteBranch {
		t.Errorf("closing = %+v, want the base of the pull request and DeleteBranch", closings[0])
	}

	state := f.repoState(t, "task-1", repos[0].Path)
	if state.Close == nil || state.Close.Base.Outcome != task.OutcomeDone || state.Close.BaseCommits != 3 {
		t.Errorf("close result = %+v, want the one the worktrees answered with", state.Close)
	}
	if state.CanClose {
		t.Error("a closed repository is still offered the closing")
	}
	// The other repository is where it was, and the task is still in the
	// workspace.
	if got := f.repoState(t, "task-1", repos[1].Path).Status; got != flow.RepoDone {
		t.Errorf("status of web = %q, want done", got)
	}
	if _, ok := f.tasks.Get("task-1"); !ok {
		t.Error("the task was archived with a repository still open")
	}
}

func TestWhatGitCouldNotCleanUpDoesNotKeepTheRepositoryOpen(t *testing.T) {
	t.Parallel()

	left := task.CloseResult{
		Worktree: task.CloseStep{Outcome: task.OutcomeFailed, Detail: "git worktree remove: permission denied"},
		Branch:   task.CloseStep{Outcome: task.OutcomeSkipped, Reason: task.SkipNotMerged, Detail: "task-1"},
		Base:     task.CloseStep{Outcome: task.OutcomeSkipped, Reason: task.SkipDirty, Detail: " M main.go"},
	}
	f := newFixture(t)
	f.worktrees.setCloseResult(left)
	awaitingClosing(f, "task-1", twoStepPlan(),
		task.PRRun{RepoPath: repos[0].Path, Status: task.PRDone, PR: mergedPR()},
		task.PRRun{RepoPath: repos[1].Path, Status: task.PRDone, PR: openPR()},
	)

	if err := f.service.CloseRepo(t.Context(), "task-1", repos[0].Path); err != nil {
		t.Fatalf("CloseRepo() = %v, want nil", err)
	}
	f.waitRepo(t, "task-1", repos[0].Path, flow.RepoClosed)

	// What stayed on disk is shown to the user, never turned into a repository
	// that cannot be closed.
	result := f.repoState(t, "task-1", repos[0].Path).Close
	if result == nil {
		t.Fatal("the repository was closed with no result")
	}
	if result.Worktree != left.Worktree || result.Branch != left.Branch || result.Base != left.Base {
		t.Errorf("close result = %+v, want what the worktrees reported", result)
	}
}

func TestAMergeThatCouldNotBeConfirmedStillAllowsTheClosing(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.gh.failView(errors.New("gh pr view: connection refused"))
	awaitingClosing(f, "task-1", twoStepPlan(),
		task.PRRun{RepoPath: repos[0].Path, Status: task.PRDone, PR: openPR()},
		task.PRRun{RepoPath: repos[1].Path, Status: task.PRClosed},
	)

	f.service.PollPRs()
	waitFor(t, "the failed reading of api", func() bool {
		return f.repoState(t, "task-1", repos[0].Path).CheckError != ""
	})

	state := f.repoState(t, "task-1", repos[0].Path)
	if state.Status != flow.RepoDone || !state.CanClose {
		t.Errorf("state = %+v, want a repository awaiting the merge the user may close", state)
	}
	if state.CheckError != "gh pr view: connection refused" {
		t.Errorf("check error = %q, want what gh said", state.CheckError)
	}

	if err := f.service.CloseRepo(t.Context(), "task-1", repos[0].Path); err != nil {
		t.Fatalf("CloseRepo() = %v, want nil", err)
	}
	f.waitPRStatus(t, "task-1", repos[0].Path, task.PRClosed)

	closings := f.worktrees.closings()
	if len(closings) != 1 {
		t.Fatalf("closings = %+v, want one", closings)
	}
	// Nobody confirmed the merge, so git decides what becomes of the branch.
	if closings[0].policy != worktree.DeleteBranchIfMerged {
		t.Errorf("policy = %v, want DeleteBranchIfMerged", closings[0].policy)
	}
}

func TestAReadingThatWorksAgainClearsTheWarning(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.gh.failView(errors.New("gh pr view: connection refused"))
	awaitingClosing(f, "task-1", plan(), task.PRRun{RepoPath: repos[0].Path, Status: task.PRDone, PR: openPR()})

	f.service.PollPRs()
	waitFor(t, "the failed reading of api", func() bool {
		return f.repoState(t, "task-1", repos[0].Path).CheckError != ""
	})

	f.gh.setPR("task-1", gh.PR{Number: 7, URL: samePR.URL, State: gh.StateMerged, Base: "main"})
	f.service.PollPRs()
	f.waitRepo(t, "task-1", repos[0].Path, flow.RepoMerged)

	state := f.repoState(t, "task-1", repos[0].Path)
	if state.CheckError != "" {
		t.Errorf("check error = %q, want it cleared by a reading that worked", state.CheckError)
	}
	if !state.CanClose {
		t.Error("a merged repository is not offered the closing")
	}
	// The reading of a repository awaiting the merge says what GitHub thinks of
	// the pull request; it never sends the repository back to its review.
	run, _ := f.tasks.prRun("task-1", repos[0].Path)
	if run.Status != task.PRDone {
		t.Errorf("status = %q, want done", run.Status)
	}
	if run.PR.State != task.PRStateMerged || run.PR.Base != "main" {
		t.Errorf("pull request = %+v, want what gh reported", run.PR)
	}
}

func TestPollingOnlyAsksAboutThePullRequestsWaitingForAMerge(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.gh.setPR("task-1", gh.PR{Number: 7, URL: samePR.URL, State: gh.StateMerged, Base: "dev"})
	awaitingClosing(f, "task-1", twoStepPlan(),
		task.PRRun{RepoPath: repos[0].Path, Status: task.PRDone, PR: openPR()},
		task.PRRun{RepoPath: repos[1].Path, Status: task.PRDone, PR: mergedPR()},
	)
	// A repository still under review is nobody's to poll.
	awaitingClosing(f, "task-2", plan(), task.PRRun{RepoPath: repos[0].Path, Status: task.PRReviewing, PR: openPR()})

	f.service.PollPRs()
	f.waitRepo(t, "task-1", repos[0].Path, flow.RepoMerged)

	if got := f.gh.ghCalls(); !slices.Equal(got, []string{"view:api:task-1"}) {
		t.Errorf("gh calls = %q, want only the pull request waiting for a merge", got)
	}

	// A merged pull request has nothing more to say.
	f.service.PollPRs()
	f.waitEvaluations(t, 1)
	if got := f.gh.ghCalls(); !slices.Equal(got, []string{"view:api:task-1"}) {
		t.Errorf("gh calls = %q, want no reading of a pull request already merged", got)
	}
}

func TestWhatARepositoryIsShownAsOnceItsReviewIsOver(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		run      task.PRRun
		want     flow.RepoStatus
		canClose bool
	}{
		{"waiting for the merge", task.PRRun{Status: task.PRDone, PR: openPR()}, flow.RepoDone, false},
		{"merged", task.PRRun{Status: task.PRDone, PR: mergedPR()}, flow.RepoMerged, true},
		{"closed without a merge", task.PRRun{Status: task.PRDone, PR: closedPR()}, flow.RepoPRClosed, false},
		{"nothing to publish", task.PRRun{Status: task.PRSkipped}, flow.RepoSkipped, true},
		{"git at work", task.PRRun{Status: task.PRClosing, PR: mergedPR()}, flow.RepoClosing, false},
		{"closed", task.PRRun{Status: task.PRClosed, PR: mergedPR()}, flow.RepoClosed, false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			run := test.run
			run.RepoPath = repos[0].Path
			awaitingClosing(f, "task-1", plan(), run)

			state := f.repoState(t, "task-1", repos[0].Path)
			if state.Status != test.want {
				t.Errorf("status = %q, want %q", state.Status, test.want)
			}
			if state.CanClose != test.canClose {
				t.Errorf("can close = %v, want %v", state.CanClose, test.canClose)
			}
		})
	}
}

func TestClosingARepositoryWithNoPullRequestDeletesItsBranch(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	awaitingClosing(f, "task-1", twoStepPlan(),
		task.PRRun{RepoPath: repos[0].Path, Status: task.PRSkipped},
		task.PRRun{RepoPath: repos[1].Path, Status: task.PRDone, PR: openPR()},
	)

	if err := f.service.CloseRepo(t.Context(), "task-1", repos[0].Path); err != nil {
		t.Fatalf("CloseRepo() = %v, want nil", err)
	}
	f.waitRepo(t, "task-1", repos[0].Path, flow.RepoClosed)

	closings := f.worktrees.closings()
	if len(closings) != 1 {
		t.Fatalf("closings = %+v, want one", closings)
	}
	// Without a pull request, the base is the branch the worktree came from,
	// and a branch with no commit of its own has nothing to lose.
	if closings[0].base != "dev" || closings[0].policy != worktree.DeleteBranch {
		t.Errorf("closing = %+v, want the local base branch and DeleteBranch", closings[0])
	}
}

func TestClosingARepositoryWhoseWorktreeIsGoneRecordsNothingLeftToDo(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.add("task-1", task.StagePR, task.Artifacts{PRD: true, TechSpec: true, Plan: plan()})
	// The record of the worktree went with a previous closing that only got
	// halfway; the app was closed with the repository still closing.
	f.tasks.setPRRun("task-1", task.PRRun{RepoPath: repos[0].Path, Status: task.PRClosing, PR: mergedPR()})

	f.service.Sync(t.Context())
	f.waitPRStatus(t, "task-1", repos[0].Path, task.PRClosed)

	if calls := f.worktrees.closings(); len(calls) != 0 {
		t.Errorf("closings = %+v, want none: there is no worktree to close", calls)
	}
	run, _ := f.tasks.prRun("task-1", repos[0].Path)
	if run.Close == nil {
		t.Fatal("the repository was closed with no result")
	}
	for _, step := range []task.CloseStep{run.Close.Worktree, run.Close.Branch, run.Close.Base} {
		if step.Outcome != task.OutcomeSkipped || step.Reason != task.SkipMissing {
			t.Errorf("step = %+v, want skipped as missing", step)
		}
	}
}

func TestTheLastRepositoryClosedArchivesTheTask(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	awaitingClosing(f, "task-1", twoStepPlan(),
		task.PRRun{RepoPath: repos[0].Path, Status: task.PRDone, PR: mergedPR()},
		task.PRRun{RepoPath: repos[1].Path, Status: task.PRDone, PR: mergedPR()},
	)

	if err := f.service.CloseRepo(t.Context(), "task-1", repos[0].Path); err != nil {
		t.Fatalf("CloseRepo() = %v, want nil", err)
	}
	f.waitRepo(t, "task-1", repos[0].Path, flow.RepoClosed)

	if slices.Contains(f.tasks.recorded(), "archive:task-1") {
		t.Errorf("task calls = %q, want no archiving with a repository still open", f.tasks.recorded())
	}

	if err := f.service.CloseRepo(t.Context(), "task-1", repos[1].Path); err != nil {
		t.Fatalf("CloseRepo() = %v, want nil", err)
	}
	waitFor(t, "the task to leave the workspace", func() bool {
		_, ok := f.tasks.Get("task-1")
		return !ok
	})

	// The history keeps the artifacts and the pull requests, not the talks.
	if !slices.Contains(f.sessions.recorded(), "discardTask:task-1") {
		t.Errorf("session calls = %q, want the conversations discarded", f.sessions.recorded())
	}
	if archived := f.tasks.ListArchived(); len(archived) != 1 || archived[0].ID != "task-1" {
		t.Errorf("archived = %+v, want the task", archived)
	}
	if runs := f.tasks.PRRuns("task-1"); len(runs) != 2 {
		t.Errorf("pr runs = %+v, want both kept for the history", runs)
	}
}

func TestResumingPicksUpAClosingAndAsksAboutAPullRequestWaitingForAMerge(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.gh.setPR("task-1", gh.PR{Number: 7, URL: samePR.URL, State: gh.StateOpen, Base: "dev"})
	awaitingClosing(f, "task-1", twoStepPlan(),
		task.PRRun{RepoPath: repos[0].Path, Status: task.PRClosing, PR: mergedPR()},
		task.PRRun{RepoPath: repos[1].Path, Status: task.PRDone, PR: openPR()},
	)

	f.service.Sync(t.Context())

	// The closing git was in the middle of goes on where it stopped.
	f.waitPRStatus(t, "task-1", repos[0].Path, task.PRClosed)
	// The merge may have happened while the app was closed, so the pull request
	// still waiting for one is read again.
	waitFor(t, "the reading of the pull request of web", func() bool {
		return slices.Contains(f.gh.ghCalls(), "view:web:task-1")
	})
	if got := f.gh.ghCalls(); slices.Contains(got, "view:api:task-1") {
		t.Errorf("gh calls = %q, want nothing asked about the repository being closed", got)
	}
}
