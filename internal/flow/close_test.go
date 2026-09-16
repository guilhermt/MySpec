package flow_test

import (
	"errors"
	"slices"
	"testing"

	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/worktree"
)

// mergedPR is the pull request the user merged on GitHub, with the branch
// GitHub says it merged into.
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

// awaitingClosing puts a task in the PR stage with its worktree and the record
// the test wants for its pull request.
func awaitingClosing(f *fixture, id string, plan task.Plan, run task.PRRun) task.Task {
	t := f.tasks.add(id, task.StagePR, task.Artifacts{PRD: true, TechSpec: true, Plan: plan})
	f.worktrees.seed(t)
	f.tasks.setPRRun(id, run)
	return t
}

// waitPRStatus polls until the app has recorded a status for the pull request
// of a task.
func (f *fixture) waitPRStatus(t *testing.T, id string, status task.PRStatus) {
	t.Helper()

	waitFor(t, "the pull request of "+id+" to be recorded as "+string(status), func() bool {
		run, ok := f.tasks.prRun(id)
		return ok && run.Status == status
	})
}

func TestClosingATaskIsRefusedUntilTheMergeIsConfirmed(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		status task.PRStatus
		pr     task.PRDetails
		want   error
	}{
		{"the review is still running", task.PRReviewing, openPR(), flow.ErrNotClosable},
		{"the pull request is still open", task.PRDone, openPR(), flow.ErrPRNotMerged},
		{"the pull request was closed without a merge", task.PRDone, closedPR(), flow.ErrNotClosable},
		{"the task is already closed", task.PRClosed, mergedPR(), flow.ErrNotClosable},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			awaitingClosing(f, "task-1", plan(), task.PRRun{Status: test.status, PR: test.pr})

			wantErrIs(t, f.service.CloseTask(t.Context(), "task-1"), test.want)

			run, _ := f.tasks.prRun("task-1")
			if run.Status != test.status {
				t.Errorf("status = %q, want %q: a refused closing changes nothing", run.Status, test.status)
			}
			if calls := f.worktrees.closings(); len(calls) != 0 {
				t.Errorf("closings = %+v, want none", calls)
			}
		})
	}
}

func TestClosingAMergedTaskTakesDownItsWorktreeAndRecordsWhatHappened(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	awaitingClosing(f, "task-1", plan(), task.PRRun{Status: task.PRDone, PR: mergedPR()})

	if err := f.service.CloseTask(t.Context(), "task-1"); err != nil {
		t.Fatalf("CloseTask() = %v, want nil", err)
	}
	f.waitPRStatus(t, "task-1", task.PRClosed)

	// The conversations of the stage stop before the worktree they run in.
	calls := f.sessions.recorded()
	if !slices.Contains(calls, "close:task-1:pr") || !slices.Contains(calls, "close:task-1:pr_review") {
		t.Errorf("session calls = %q, want both conversations closed", calls)
	}
	// The task passes through closing, so the user sees git at work.
	taskCalls := f.tasks.recorded()
	closing, closed := slices.Index(taskCalls, "pr:closing:task-1"), slices.Index(taskCalls, "prClosed:task-1")
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

	run, _ := f.tasks.prRun("task-1")
	if run.Close == nil || run.Close.Base.Outcome != task.OutcomeDone || run.Close.BaseCommits != 3 {
		t.Errorf("close result = %+v, want the one the worktrees answered with", run.Close)
	}
	// The closing archives the task.
	waitFor(t, "the task to be archived", func() bool {
		_, ok := f.tasks.Get("task-1")
		return !ok
	})
}

func TestClosingATaskIsRefusedWhileTheCloneIsMissing(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	awaitingClosing(f, "task-1", plan(), task.PRRun{Status: task.PRDone, PR: mergedPR()})
	f.repositories.setMissing(true)

	var refusal *repository.Refusal
	err := f.service.CloseTask(t.Context(), "task-1")
	if !errors.As(err, &refusal) || refusal.Reason != repository.ReasonCloneMissing {
		t.Fatalf("CloseTask() = %v, want the clone refused as missing", err)
	}
	if calls := f.worktrees.closings(); len(calls) != 0 {
		t.Errorf("closings = %+v, want none", calls)
	}
	// The closing is not offered while the clone is gone either.
	if f.prState(t, "task-1").CanClose {
		t.Error("CanClose = true, want the closing to wait for the clone")
	}

	f.repositories.setMissing(false)
	if err := f.service.CloseTask(t.Context(), "task-1"); err != nil {
		t.Fatalf("CloseTask() = %v, want nil once the clone is back", err)
	}
	f.waitPRStatus(t, "task-1", task.PRClosed)
}

func TestClosingATaskArchivesIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	awaitingClosing(f, "task-1", plan(), task.PRRun{Status: task.PRDone, PR: mergedPR()})

	if err := f.service.CloseTask(t.Context(), "task-1"); err != nil {
		t.Fatalf("CloseTask() = %v, want nil", err)
	}
	waitFor(t, "the task to be archived", func() bool {
		_, ok := f.tasks.Get("task-1")
		return !ok
	})

	// The history keeps the artifacts and the pull request, not the talks.
	if !slices.Contains(f.sessions.recorded(), "discardTask:task-1") {
		t.Errorf("session calls = %q, want the conversations discarded", f.sessions.recorded())
	}
	if archived := f.tasks.ListArchived(); len(archived) != 1 || archived[0].ID != "task-1" {
		t.Errorf("archived = %+v, want the task", archived)
	}
	if _, ok := f.tasks.prRun("task-1"); !ok {
		t.Error("the pr run is gone, want it kept for the history")
	}
}

func TestWhatGitCouldNotCleanUpDoesNotKeepTheTaskOpen(t *testing.T) {
	t.Parallel()

	left := task.CloseResult{
		Worktree: task.CloseStep{Outcome: task.OutcomeFailed, Detail: "git worktree remove: permission denied"},
		Branch:   task.CloseStep{Outcome: task.OutcomeSkipped, Reason: task.SkipNotMerged, Detail: "task-1"},
		Base:     task.CloseStep{Outcome: task.OutcomeSkipped, Reason: task.SkipDirty, Detail: " M main.go"},
	}
	f := newFixture(t)
	f.worktrees.setCloseResult(left)
	awaitingClosing(f, "task-1", plan(), task.PRRun{Status: task.PRDone, PR: mergedPR()})

	if err := f.service.CloseTask(t.Context(), "task-1"); err != nil {
		t.Fatalf("CloseTask() = %v, want nil", err)
	}
	f.waitPRStatus(t, "task-1", task.PRClosed)

	// What stayed on disk is shown to the user, never turned into a task that
	// cannot be closed.
	run, _ := f.tasks.prRun("task-1")
	result := run.Close
	if result == nil {
		t.Fatal("the task was closed with no result")
	}
	if result.Worktree != left.Worktree || result.Branch != left.Branch || result.Base != left.Base {
		t.Errorf("close result = %+v, want what the worktrees reported", result)
	}
}

func TestAMergeThatCouldNotBeConfirmedStillAllowsTheClosing(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.gh.failView(errors.New("gh pr view: connection refused"))
	awaitingClosing(f, "task-1", plan(), task.PRRun{Status: task.PRDone, PR: openPR()})

	f.service.PollPRs()
	waitFor(t, "the failed reading of the pull request", func() bool {
		return f.prState(t, "task-1").CheckError != ""
	})

	state := f.prState(t, "task-1")
	if state.Status != flow.PRDone || !state.CanClose {
		t.Errorf("state = %+v, want a task awaiting the merge the user may close", state)
	}
	if state.CheckError != "gh pr view: connection refused" {
		t.Errorf("check error = %q, want what gh said", state.CheckError)
	}

	if err := f.service.CloseTask(t.Context(), "task-1"); err != nil {
		t.Fatalf("CloseTask() = %v, want nil", err)
	}
	f.waitPRStatus(t, "task-1", task.PRClosed)

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
	awaitingClosing(f, "task-1", plan(), task.PRRun{Status: task.PRDone, PR: openPR()})

	f.service.PollPRs()
	waitFor(t, "the failed reading of the pull request", func() bool {
		return f.prState(t, "task-1").CheckError != ""
	})

	f.gh.setPR("task-1", gh.PR{Number: 7, URL: samePR.URL, State: gh.StateMerged, Base: "main"})
	f.service.PollPRs()
	f.waitPR(t, "task-1", flow.PRMerged)

	state := f.prState(t, "task-1")
	if state.CheckError != "" {
		t.Errorf("check error = %q, want it cleared by a reading that worked", state.CheckError)
	}
	if !state.CanClose {
		t.Error("a merged task is not offered the closing")
	}
	// The reading of a task awaiting the merge says what GitHub thinks of the
	// pull request; it never sends the task back to its review.
	run, _ := f.tasks.prRun("task-1")
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
	awaitingClosing(f, "task-1", plan(), task.PRRun{Status: task.PRDone, PR: openPR()})
	// A task still under review is nobody's to poll.
	awaitingClosing(f, "task-2", plan(), task.PRRun{Status: task.PRReviewing, PR: openPR()})

	f.service.PollPRs()
	f.waitPR(t, "task-1", flow.PRMerged)

	if got := f.gh.ghCalls(); !slices.Equal(got, []string{"view:web:task-1"}) {
		t.Errorf("gh calls = %q, want only the pull request waiting for a merge", got)
	}

	// A merged pull request has nothing more to say.
	f.service.PollPRs()
	f.waitEvaluations(t, 1)
	if got := f.gh.ghCalls(); !slices.Equal(got, []string{"view:web:task-1"}) {
		t.Errorf("gh calls = %q, want no reading of a pull request already merged", got)
	}
}

func TestWhatATaskIsShownAsOnceItsReviewIsOver(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		run      task.PRRun
		want     flow.PRStatus
		canClose bool
	}{
		{"waiting for the merge", task.PRRun{Status: task.PRDone, PR: openPR()}, flow.PRDone, false},
		{"merged", task.PRRun{Status: task.PRDone, PR: mergedPR()}, flow.PRMerged, true},
		{"closed without a merge", task.PRRun{Status: task.PRDone, PR: closedPR()}, flow.PRClosedUnmerged, false},
		{"git at work", task.PRRun{Status: task.PRClosing, PR: mergedPR()}, flow.PRClosing, false},
		{"closed", task.PRRun{Status: task.PRClosed, PR: mergedPR()}, flow.PRClosed, false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			awaitingClosing(f, "task-1", plan(), test.run)

			state := f.prState(t, "task-1")
			if state.Status != test.want {
				t.Errorf("status = %q, want %q", state.Status, test.want)
			}
			if state.CanClose != test.canClose {
				t.Errorf("can close = %v, want %v", state.CanClose, test.canClose)
			}
		})
	}
}

func TestClosingATaskWhoseWorktreeIsGoneRecordsNothingLeftToDo(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.add("task-1", task.StagePR, task.Artifacts{PRD: true, TechSpec: true, Plan: plan()})
	// The record of the worktree went with a previous closing that only got
	// halfway; the app was closed with the repository still closing.
	f.tasks.setPRRun("task-1", task.PRRun{Status: task.PRClosing, PR: mergedPR()})

	f.service.Sync(t.Context())
	f.waitPRStatus(t, "task-1", task.PRClosed)

	if calls := f.worktrees.closings(); len(calls) != 0 {
		t.Errorf("closings = %+v, want none: there is no worktree to close", calls)
	}
	run, _ := f.tasks.prRun("task-1")
	if run.Close == nil {
		t.Fatal("the task was closed with no result")
	}
	for _, step := range []task.CloseStep{run.Close.Worktree, run.Close.Branch, run.Close.Base} {
		if step.Outcome != task.OutcomeSkipped || step.Reason != task.SkipMissing {
			t.Errorf("step = %+v, want skipped as missing", step)
		}
	}
}

func TestPreviewingADeletionSaysWhatWouldBeDestroyed(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.worktrees.setStatus(git.Status{Changes: []git.Change{
		{X: '.', Y: 'M', Path: "main.go"},
		{X: '?', Y: '?', Path: "scratch.md"},
	}})
	awaitingClosing(f, "task-1", plan(), task.PRRun{Status: task.PRDone, PR: mergedPR()})
	f.sessions.setSummary("task-1", session.Summary{
		Stage: session.PRReviewStage, Status: session.StatusWorking, ProcessRunning: true,
	})

	preview, err := f.service.PreviewDelete(t.Context(), "task-1")
	if err != nil {
		t.Fatalf("PreviewDelete() = %v, want nil", err)
	}

	if !preview.SessionRunning {
		t.Error("sessionRunning = false, want the conversation counted")
	}
	if preview.Worktree == nil || !preview.Worktree.Dirty || preview.Worktree.Files != 2 {
		t.Errorf("worktree = %+v, want it dirty with two files", preview.Worktree)
	}

	// GitHub merged the pull request, and that is the answer: git is not asked.
	if preview.Branch == nil || !preview.Branch.Merged {
		t.Errorf("branch = %+v, want it marked as merged", preview.Branch)
	}
	if calls := f.worktrees.recorded(); slices.Contains(calls, "merged:task-1:origin/dev") {
		t.Errorf("worktree calls = %q, want git not asked about a branch GitHub merged", calls)
	}

	if preview.PR == nil || preview.PR.Number != 7 {
		t.Errorf("pull request = %+v, want the one the app leaves on GitHub", preview.PR)
	}
}

func TestAPreviewAsksGitAboutABranchWithNoConfirmedMerge(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	awaitingClosing(f, "task-1", plan(), task.PRRun{Status: task.PRDone, PR: openPR()})

	if _, err := f.service.PreviewDelete(t.Context(), "task-1"); err != nil {
		t.Fatalf("PreviewDelete() = %v, want nil", err)
	}
	if calls := f.worktrees.recorded(); !slices.Contains(calls, "merged:task-1:origin/dev") {
		t.Errorf("worktree calls = %q, want the branch with no confirmed merge asked about", calls)
	}
}

func TestAPreviewLeavesOutWhatIsAlreadyGone(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	awaitingClosing(f, "task-1", plan(), task.PRRun{Status: task.PRClosed, PR: mergedPR()})

	preview, err := f.service.PreviewDelete(t.Context(), "task-1")
	if err != nil {
		t.Fatalf("PreviewDelete() = %v, want nil", err)
	}
	if preview.PR != nil {
		t.Errorf("pull request = %+v, want nothing for a task already closed", preview.PR)
	}
}

func TestPreviewingTheDeletionOfAnArchivedTaskFindsNothingOnDisk(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	awaitingClosing(f, "task-1", plan(), task.PRRun{Status: task.PRClosed, PR: mergedPR()})
	if _, err := f.tasks.Archive(t.Context(), "task-1"); err != nil {
		t.Fatalf("Archive() = %v, want nil", err)
	}

	preview, err := f.service.PreviewDelete(t.Context(), "task-1")
	if err != nil {
		t.Fatalf("PreviewDelete() = %v, want nil", err)
	}
	if preview.Worktree != nil || preview.Branch != nil || preview.PR != nil {
		t.Errorf("preview = %+v, want nothing left to destroy", preview)
	}
	if calls := f.worktrees.recorded(); len(calls) != 0 {
		t.Errorf("worktree calls = %q, want git not read for a task in the history", calls)
	}
}

func TestDeleteReportsWhatGitCouldNotRemove(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.worktrees.setLeftover(worktree.Leftover{
		Path:   worktree.Path(dataDir, "dev", "web", "task-1"),
		Branch: "task-1",
		Error:  "git worktree remove: permission denied; git branch -D: permission denied",
	})
	awaitingClosing(f, "task-1", plan(), task.PRRun{Status: task.PRDone, PR: openPR()})

	result, err := f.service.Delete(t.Context(), "task-1")
	if err != nil {
		t.Fatalf("Delete() = %v, want nil", err)
	}

	want := flow.LeftoverInfo{
		Path:   worktree.Path(dataDir, "dev", "web", "task-1"),
		Branch: "task-1",
		Error:  "git worktree remove: permission denied; git branch -D: permission denied",
	}
	if result.Leftover == nil || *result.Leftover != want {
		t.Errorf("leftover = %+v, want %+v", result.Leftover, want)
	}
	// A directory git could not take back never keeps the task in the app.
	if _, ok := f.tasks.Get("task-1"); ok {
		t.Error("the task is still there")
	}
}

func TestResumingPicksUpAClosingAndAsksAboutAPullRequestWaitingForAMerge(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.gh.setPR("task-1", gh.PR{Number: 7, URL: samePR.URL, State: gh.StateOpen, Base: "dev"})
	awaitingClosing(f, "task-1", plan(), task.PRRun{Status: task.PRClosing, PR: mergedPR()})
	// A second task is waiting for its merge, and the app asks GitHub about it.
	awaitingClosing(f, "task-2", plan(), task.PRRun{Status: task.PRDone, PR: openPR()})

	f.service.Sync(t.Context())

	// The closing git was in the middle of goes on where it stopped.
	f.waitPRStatus(t, "task-1", task.PRClosed)
	// The merge may have happened while the app was closed, so the pull request
	// still waiting for one is read again.
	waitFor(t, "the reading of the pull request of task-2", func() bool {
		return slices.Contains(f.gh.ghCalls(), "view:web:task-2")
	})
	if got := f.gh.ghCalls(); slices.Contains(got, "view:web:task-1") {
		t.Errorf("gh calls = %q, want nothing asked about the task being closed", got)
	}
}
