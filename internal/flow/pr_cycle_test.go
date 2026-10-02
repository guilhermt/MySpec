package flow_test

import (
	"errors"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/prreport"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

// openPR is the pull request a task under review has.
func openPR() task.PRDetails {
	return task.PRDetails{Number: 7, URL: samePR.URL, State: task.PRStateOpen}
}

// prArtifacts is what the pr folder of the task holds.
func prArtifacts(art task.PRArtifacts) task.Artifacts {
	return task.Artifacts{
		PRD: true, TechSpec: true, Plan: plan(),
		PR: art,
	}
}

// reviewKeyOf is the session that reviews the pull request of the task.
var reviewKeyOf = session.Key{TaskID: "task-1", Stage: session.PRReviewStage}

// underReview brings a task to the review session of its pull request, with
// the pull request the app recorded and the branch on startCommit.
func underReview(t *testing.T, f *fixture) task.Task {
	t.Helper()

	tk := f.tasks.add("task-1", task.StagePR, prArtifacts(task.PRArtifacts{}))
	f.tasks.useDir("task-1", t.TempDir())
	f.worktrees.seed(tk)
	f.worktrees.setStatus(git.Status{Head: startCommit})
	f.tasks.setPRRun("task-1", task.PRRun{Status: task.PRReviewing, PR: openPR()})
	f.gh.setPR("task-1", samePR)

	f.service.Check("task-1")
	waitFor(t, "the review session of the task", func() bool {
		_, ok := f.sessions.Summary(reviewKeyOf)
		return ok
	})
	return tk
}

// waitPRRun polls until the record of the pull request satisfies cond.
func (f *fixture) waitPRRun(t *testing.T, subject string, cond func(task.PRRun) bool) {
	t.Helper()

	waitFor(t, subject, func() bool {
		run, ok := f.tasks.prRun("task-1")
		return ok && cond(run)
	})
}

// reportsWritten puts the reports of a review on disk and lets the agent rest,
// which is what an evaluation reads them on. A pass the app asked for is
// structured, so its report is written in the format of the findings, with one
// finding when it has changes; the reports of the earlier passes are also the
// ones in text the artifacts list.
func reportsWritten(t *testing.T, f *fixture, written []task.ReviewReport) {
	t.Helper()

	f.tasks.setArtifacts("task-1", prArtifacts(task.PRArtifacts{Reports: written}))
	for _, report := range written {
		if report.Clean {
			writeReport(t, f, report.Pass, reportOf("clean"))
		} else {
			writeReport(t, f, report.Pass, reportOf("changes", "A finding | internal/a.go:3 | What is wrong."))
		}
	}
	f.sessions.goIdle("task-1")
	f.service.Check("task-1")
}

func TestTheFirstPassOfAReviewIsStartedWithItsReport(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	underReview(t, f)

	info, ok := f.sessions.info(reviewKeyOf)
	if !ok {
		t.Fatal("the review session was not started")
	}
	if want := f.reviewPath(1); info.ReviewPath != want {
		t.Errorf("review path = %q, want %q", info.ReviewPath, want)
	}
	if info.PRNumber != "7" || info.PRURL != samePR.URL {
		t.Errorf("session = %+v, want the pull request it reviews", info)
	}
	if !slices.Contains(f.sessions.recorded(), "start:task-1:pr_review:restarted=false") {
		t.Errorf("session calls = %q, want the review session started", f.sessions.recorded())
	}
}

func TestTheReviewOfAOneShotPullRequestReadsTheDocument(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.setTaskMode("task-1", task.ModeOneShot)
	underReview(t, f)
	tk, _ := f.tasks.Get("task-1")
	document := tk.OneShotPath()

	if info, _ := f.sessions.info(reviewKeyOf); info.OneShotPath != document {
		t.Errorf("document of the review session = %q, want %q", info.OneShotPath, document)
	}

	// The passes after the first one are asked for by the app, and point to the
	// same document.
	reportsWritten(t, f, reports(1, false))
	f.waitPRRun(t, "the report of the first pass", func(run task.PRRun) bool { return run.ReportedPass == 1 })
	applied(t, f, 1)
	f.reviews.setSnapshot(staged(3, 3))
	f.sessions.goIdle("task-1")
	if err := f.service.ApprovePR(t.Context(), "task-1"); err != nil {
		t.Fatalf("ApprovePR() = %v, want nil", err)
	}
	f.worktrees.setStatus(git.Status{Head: commitSHA})
	f.reviews.setSnapshot(review.Snapshot{Head: commitSHA})
	f.sessions.goIdle("task-1")
	f.service.Check("task-1")

	want := oneShotReviewPrompt(f.reviewPath(2), document)
	waitFor(t, "the prompt of the second pass", func() bool { return f.sessions.sentCount(want) > 0 })
}

func TestAReportWithFindingsWaitsForTheDecision(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	underReview(t, f)
	reportsWritten(t, f, reports(1, false))

	f.waitPRRun(t, "the report of the first pass to be recorded", func(run task.PRRun) bool {
		return run.ReportedPass == 1
	})

	run, _ := f.tasks.prRun("task-1")
	if run.ReviewedCommit != startCommit {
		t.Errorf("reviewed commit = %q, want the one the branch was on", run.ReviewedCommit)
	}
	if run.Status != task.PRReviewing {
		t.Errorf("status = %q, want reviewing: the pass found something to change", run.Status)
	}
	// The pass is a milestone of the conversation, like an artifact is.
	if !slices.Contains(f.sessions.recorded(), "mark:task-1:pr_review:pass=1:clean=false") {
		t.Errorf("session calls = %q, want the pass marked", f.sessions.recorded())
	}
	// The worktree is the user's to review while they decide.
	waitFor(t, "the worktree of api to be watched", func() bool {
		active, watched := f.reviews.activeOf("task-1")
		return watched && active
	})
	if got := f.prState(t, "task-1").Status; got != flow.PRAwaitingDecision {
		t.Errorf("status = %q, want awaiting_decision", got)
	}
}

func TestApprovingAReviewAsksForACommitThatIsPushed(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	underReview(t, f)
	reportsWritten(t, f, reports(1, false))
	f.waitPRRun(t, "the report of the first pass", func(run task.PRRun) bool { return run.ReportedPass == 1 })
	applied(t, f, 1)
	f.reviews.setSnapshot(staged(3, 3))
	f.sessions.goIdle("task-1")

	if got := f.prState(t, "task-1").Status; got != flow.PRReadyToApprove {
		t.Fatalf("status = %q, want ready_to_approve", got)
	}
	if err := f.service.ApprovePR(t.Context(), "task-1"); err != nil {
		t.Fatalf("ApprovePR() = %v, want nil", err)
	}

	run, _ := f.tasks.prRun("task-1")
	if run.Status != task.PRCommitting {
		t.Errorf("status = %q, want committing", run.Status)
	}
	sent := f.sessions.sent()
	if len(sent) != 1 || !strings.Contains(sent[0], prompts.PushInstruction) {
		t.Errorf("sent = %q, want the commit prompt with the push instruction", sent)
	}
	if diff := cmp.Diff([]session.AppMessage{{Kind: session.AppCommitPush}}, f.sessions.sentApps()); diff != "" {
		t.Errorf("app messages mismatch (-want +got):\n%s", diff)
	}
	approved := []keyedMarker{{Key: reviewKeyOf, Marker: session.MarkerEntry{Type: session.MarkerChangesApproved, Files: 3}}}
	if diff := cmp.Diff(approved, f.sessions.marked(session.MarkerChangesApproved)); diff != "" {
		t.Errorf("changes_approved markers mismatch (-want +got):\n%s", diff)
	}
	if !slices.Contains(f.sessions.recorded(), "send:task-1:pr_review") {
		t.Errorf("session calls = %q, want the prompt sent to the review session", f.sessions.recorded())
	}
}

func TestACommitOfAReviewStartsTheNextPass(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	underReview(t, f)
	reportsWritten(t, f, reports(1, false))
	f.waitPRRun(t, "the report of the first pass", func(run task.PRRun) bool { return run.ReportedPass == 1 })
	applied(t, f, 1)
	f.reviews.setSnapshot(staged(3, 3))
	f.sessions.goIdle("task-1")
	if err := f.service.ApprovePR(t.Context(), "task-1"); err != nil {
		t.Fatalf("ApprovePR() = %v, want nil", err)
	}

	// The agent committed: the branch moved, and the pass that follows is
	// about the commit it produced.
	f.worktrees.setStatus(git.Status{Head: commitSHA})
	f.reviews.setSnapshot(review.Snapshot{Head: commitSHA})
	f.sessions.goIdle("task-1")
	f.service.Check("task-1")

	waitFor(t, "the prompt of the second pass", func() bool {
		return f.sessions.sentCount(reviewPrompt(f.reviewPath(2))) > 0
	})
	run, _ := f.tasks.prRun("task-1")
	if run.Status != task.PRReviewing {
		t.Errorf("status = %q, want reviewing", run.Status)
	}
	apps := f.sessions.sentApps()
	if diff := cmp.Diff(session.AppMessage{Kind: session.AppPRPass, Pass: 2}, apps[len(apps)-1]); diff != "" {
		t.Errorf("app message mismatch (-want +got):\n%s", diff)
	}
	if state := f.prState(t, "task-1"); state.CommitFailed {
		t.Error("the approval is reported as having produced no commit")
	}
	committed := []keyedMarker{{Key: reviewKeyOf, Marker: session.MarkerEntry{
		Type: session.MarkerCommitted, SHA: commitSHA[:7], Subject: "Do the work of the step", Pushed: true, Number: 7,
	}}}
	if diff := cmp.Diff(committed, f.sessions.marked(session.MarkerCommitted)); diff != "" {
		t.Errorf("committed markers mismatch (-want +got):\n%s", diff)
	}

	// The same commit never asks for a second pass.
	f.service.Check("task-1")
	f.waitEvaluations(t, 1)
	if asked := f.sessions.sentCount(reviewPrompt(f.reviewPath(2))); asked != 1 {
		t.Errorf("the second pass was asked for %d times, want once", asked)
	}

	// The agent rested with no report of the pass it was asked for: nothing
	// moves until the user answers it.
	f.sessions.goIdle("task-1")
	if got := f.prState(t, "task-1").Status; got != flow.PRAwaitingReply {
		t.Errorf("status = %q, want awaiting_reply", got)
	}
}

func TestACommitTurnOfAReviewThatCommitsNothingGivesTheTaskBack(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	underReview(t, f)
	reportsWritten(t, f, reports(1, false))
	f.waitPRRun(t, "the report of the first pass", func(run task.PRRun) bool { return run.ReportedPass == 1 })
	applied(t, f, 1)
	f.reviews.setSnapshot(staged(3, 3))
	f.sessions.goIdle("task-1")
	if err := f.service.ApprovePR(t.Context(), "task-1"); err != nil {
		t.Fatalf("ApprovePR() = %v, want nil", err)
	}

	// The turn ended with the branch where it was.
	f.sessions.goIdle("task-1")
	f.service.Check("task-1")

	waitFor(t, "the task to come back to its review", func() bool {
		run, ok := f.tasks.prRun("task-1")
		return ok && run.Status == task.PRReviewing
	})
	waitFor(t, "the warning of the missing commit", func() bool {
		return f.prState(t, "task-1").CommitFailed
	})
}

func TestACleanReportClosesThePullRequest(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	underReview(t, f)
	reportsWritten(t, f, reports(1, true))

	f.waitPRRun(t, "the pull request to be closed", func(run task.PRRun) bool { return run.Status == task.PRDone })
	f.waitPR(t, "task-1", flow.PRDone)

	run, _ := f.tasks.prRun("task-1")
	if run.ReportedPass != 1 {
		t.Errorf("reported pass = %d, want the first pass recorded", run.ReportedPass)
	}
	// The conversation of a review that is over takes no more messages.
	waitFor(t, "the review session to be closed", func() bool {
		return slices.Contains(f.sessions.recorded(), "close:task-1:pr_review")
	})
	if _, watched := f.reviews.activeOf("task-1"); watched {
		t.Error("the worktree is still watched, want it forgotten")
	}
}

func TestAPassThatFindsNothingAfterAPassWithFindingsClosesThePullRequest(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	underReview(t, f)
	reportsWritten(t, f, reports(1, false))
	f.waitPRRun(t, "the report of the first pass", func(run task.PRRun) bool { return run.ReportedPass == 1 })

	// The pass after the changes of the first one is asked for and closes clean.
	applied(t, f, 1)
	if _, err := f.tasks.AskPRPass(t.Context(), "task-1", 2); err != nil {
		t.Fatalf("AskPRPass() = %v, want nil", err)
	}
	reportsWritten(t, f, reports(2, true))

	f.waitPRRun(t, "the pull request to be closed", func(run task.PRRun) bool {
		return run.Status == task.PRDone && run.ReportedPass == 2
	})
	f.waitPR(t, "task-1", flow.PRDone)
}

func TestOpeningThePullRequestWritesTheDraftTheUserApproved(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	dir := t.TempDir()
	inPR(f, "task-1", plan(), task.PRDrafting)
	f.tasks.useDir("task-1", dir)
	f.tasks.setArtifacts("task-1", prArtifacts(task.PRArtifacts{
		Draft: task.Draft{Present: true, Title: "Add the login screen", Body: "It adds the screen."},
	}))
	f.sessions.setSummary("task-1", session.Summary{
		Stage: session.PRStage, Status: session.StatusWaiting, Idle: true,
	})

	err := f.service.OpenPR(t.Context(), "task-1", "  Add the login screen  ", "It adds the screen.")
	if err != nil {
		t.Fatalf("OpenPR() = %v, want nil", err)
	}

	run, _ := f.tasks.prRun("task-1")
	if run.Status != task.PROpening {
		t.Errorf("status = %q, want opening", run.Status)
	}
	path := filepath.Join(dir, "pr", "draft.md")
	written, readErr := os.ReadFile(path)
	if readErr != nil {
		t.Fatalf("read draft: %v", readErr)
	}
	for _, want := range []string{"repository: dev/web", "base: origin/dev", "title: Add the login screen", "It adds the screen."} {
		if !strings.Contains(string(written), want) {
			t.Errorf("draft = %q, want it to contain %q", written, want)
		}
	}
	sent := f.sessions.sent()
	if len(sent) != 1 || !strings.Contains(sent[0], path) || !strings.Contains(sent[0], "origin/dev") {
		t.Errorf("sent = %q, want the message that opens the pull request", sent)
	}
	if diff := cmp.Diff([]session.AppMessage{{Kind: session.AppOpen}}, f.sessions.sentApps()); diff != "" {
		t.Errorf("app messages mismatch (-want +got):\n%s", diff)
	}
	approved := []keyedMarker{{
		Key:    session.Key{TaskID: "task-1", Stage: session.PRStage},
		Marker: session.MarkerEntry{Type: session.MarkerDraftApproved, Title: "Add the login screen"},
	}}
	if diff := cmp.Diff(approved, f.sessions.marked(session.MarkerDraftApproved)); diff != "" {
		t.Errorf("draft_approved markers mismatch (-want +got):\n%s", diff)
	}
}

func TestOpeningThePullRequestResumesAPausedSession(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	dir := t.TempDir()
	inPR(f, "task-1", plan(), task.PRDrafting)
	f.tasks.useDir("task-1", dir)
	f.sessions.setSummary("task-1", session.Summary{Stage: session.PRStage, Status: session.StatusPaused})

	err := f.service.OpenPR(t.Context(), "task-1", "Add the login screen", "It adds the screen.")
	if err != nil {
		t.Fatalf("OpenPR() = %v, want nil", err)
	}

	// The user should not have to think about processes to open what they
	// wrote: the session comes back and takes the message.
	calls := f.sessions.recorded()
	resume, send := slices.Index(calls, "resume:task-1:pr"), slices.Index(calls, "send:task-1:pr")
	if resume < 0 || send < resume {
		t.Errorf("session calls = %q, want the session resumed before the message", calls)
	}
}

func TestDiscardingADraftPreparesTheStageAgain(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	dir := t.TempDir()
	inPR(f, "task-1", plan(), task.PRDrafting)
	f.tasks.useDir("task-1", dir)
	path := filepath.Join(dir, "pr", "draft.md")
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatalf("create pr directory: %v", err)
	}
	if err := os.WriteFile(path, []byte("---\ntitle: A draft\n---\n\nBody\n"), 0o600); err != nil {
		t.Fatalf("write draft: %v", err)
	}

	if err := f.service.DiscardDraft(t.Context(), "task-1"); err != nil {
		t.Fatalf("DiscardDraft() = %v, want nil", err)
	}

	if _, err := os.Stat(path); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("stat draft = %v, want it gone", err)
	}
	if !slices.Contains(f.sessions.recorded(), "discard:task-1:pr") {
		t.Errorf("session calls = %q, want the pr session discarded", f.sessions.recorded())
	}
	// The PR stage is prepared again, from the login check on.
	f.waitPR(t, "task-1", flow.PRDrafting)
}

func TestReviewingAgainStartsAPassOverTheSamePullRequest(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	underReview(t, f)
	reportsWritten(t, f, reports(1, true))
	f.waitPRRun(t, "the pull request to be closed", func(run task.PRRun) bool {
		return run.Status == task.PRDone && run.ReportedPass == 1
	})

	if err := f.service.ReviewAgain(t.Context(), "task-1"); err != nil {
		t.Fatalf("ReviewAgain() = %v, want nil", err)
	}

	waitFor(t, "the session of the second pass", func() bool {
		info, ok := f.sessions.info(reviewKeyOf)
		return ok && info.ReviewPath == f.reviewPath(2)
	})
	// The reports already written stay where they are.
	if state := f.prState(t, "task-1"); len(state.Reports) != 1 {
		t.Errorf("reports = %d, want the one already written", len(state.Reports))
	}
	if !slices.Contains(f.sessions.recorded(), "discard:task-1:pr_review") {
		t.Errorf("session calls = %q, want the review session discarded", f.sessions.recorded())
	}

	// The clean report of the first pass does not close the review asked for
	// again: the agent rested without the report of the new pass.
	f.sessions.goIdle("task-1")
	before := f.tasks.inspectCount()
	f.service.Check("task-1")
	f.waitEvaluations(t, before+1)
	if run, _ := f.tasks.prRun("task-1"); run.Status != task.PRReviewing {
		t.Errorf("status = %q, want reviewing until the report of the new pass is in", run.Status)
	}
	if got := f.prState(t, "task-1").Status; got != flow.PRAwaitingReply {
		t.Errorf("status = %q, want awaiting_reply", got)
	}

	// The clean report of that pass is what closes it.
	reportsWritten(t, f, reports(2, true))
	f.waitPRRun(t, "the pull request to be closed again", func(run task.PRRun) bool {
		return run.Status == task.PRDone && run.ReportedPass == 2
	})
}

func TestRetryingABlockedPullRequestPreparesItAgain(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.gh.failAuth(gh.ErrNotAuthenticated)
	inPR(f, "task-1", plan(), task.PRPreparing)
	f.service.Sync(t.Context())
	f.waitPR(t, "task-1", flow.PRBlocked)

	f.gh.failAuth(nil)
	if err := f.service.RetryPR(t.Context(), "task-1"); err != nil {
		t.Fatalf("RetryPR() = %v, want nil", err)
	}

	f.waitPR(t, "task-1", flow.PRDrafting)
	if state := f.prState(t, "task-1"); state.Block != nil {
		t.Errorf("block = %+v, want none", state.Block)
	}
}

func TestRefreshingReadsThePullRequestAgain(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	inPR(f, "task-1", plan(), task.PRDrafting)
	f.gh.setPR("task-1", samePR)

	if err := f.service.RefreshPR(t.Context(), "task-1"); err != nil {
		t.Fatalf("RefreshPR() = %v, want nil", err)
	}

	waitFor(t, "the pull request to be found", func() bool {
		run, ok := f.tasks.prRun("task-1")
		return ok && run.Status == task.PRReviewing
	})
}

func TestWhatTheActionsOfThePullRequestRefuse(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		status task.PRStatus
		pr     task.PRDetails
		act    func(f *fixture) error
		want   error
	}{
		{
			name:   "opening a pull request that is not drafted",
			status: task.PRReviewing,
			act: func(f *fixture) error {
				return f.service.OpenPR(t.Context(), "task-1", "A title", "A body")
			},
			want: flow.ErrDraftMissing,
		},
		{
			name:   "opening a pull request with no description",
			status: task.PRDrafting,
			act: func(f *fixture) error {
				return f.service.OpenPR(t.Context(), "task-1", "A title", "   ")
			},
			want: flow.ErrEmptyDraft,
		},
		{
			name:   "approving a pull request with no report",
			status: task.PRReviewing,
			act:    func(f *fixture) error { return f.service.ApprovePR(t.Context(), "task-1") },
			want:   flow.ErrStepNotReady,
		},
		{
			name:   "reviewing again a task with no pull request",
			status: task.PRDrafting,
			act:    func(f *fixture) error { return f.service.ReviewAgain(t.Context(), "task-1") },
			want:   flow.ErrNoPullRequest,
		},
		{
			name:   "discarding the draft of a pull request that exists",
			status: task.PRDrafting,
			pr:     openPR(),
			act:    func(f *fixture) error { return f.service.DiscardDraft(t.Context(), "task-1") },
			want:   flow.ErrPRExists,
		},
		{
			name:   "retrying a stage that is not blocked",
			status: task.PRDrafting,
			act:    func(f *fixture) error { return f.service.RetryPR(t.Context(), "task-1") },
			want:   flow.ErrPRNotBlocked,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			tk := f.tasks.add("task-1", task.StagePR, prArtifacts(task.PRArtifacts{}))
			f.worktrees.seed(tk)
			f.tasks.setPRRun("task-1", task.PRRun{Status: test.status, PR: test.pr})
			f.sessions.setSummary("task-1", session.Summary{
				Stage: session.PRStage, Status: session.StatusWaiting, Idle: true,
			})

			wantErrIs(t, test.act(f), test.want)
		})
	}
}

func TestTheActionsOfATaskThatIsNotInThePRStage(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", plan())

	wantErrIs(t, f.service.ApprovePR(t.Context(), "task-1"), flow.ErrNotInPR)
}

// reviewPath is where the agent writes the report of a pass of the task.
func (f *fixture) reviewPath(pass int) string {
	tk, _ := f.tasks.Get("task-1")
	return tk.ReviewPath(pass)
}

// applied approves the first finding of a pass and sends it to the agent,
// which is what the changes of the pass the user approves come from.
func applied(t *testing.T, f *fixture, pass int) {
	t.Helper()

	ctx := t.Context()
	if err := f.tasks.DecidePRFinding(ctx, "task-1", pass, 1, prreport.DecisionApproved); err != nil {
		t.Fatalf("DecidePRFinding() = %v, want nil", err)
	}
	if err := f.tasks.MarkPRPassSent(ctx, "task-1", pass); err != nil {
		t.Fatalf("MarkPRPassSent() = %v, want nil", err)
	}
}
