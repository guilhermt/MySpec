package flow_test

import (
	"os"
	"slices"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/prreport"
	"github.com/guilhermt/myspec/internal/reviewmode"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

// dirtyWorktree is a worktree with a change nobody committed.
func dirtyWorktree(f *fixture) {
	f.worktrees.setStatus(git.Status{
		Head: startCommit, Changes: []git.Change{{X: '.', Y: 'M', Path: "main.go"}},
	})
}

// cleanPass is a recorded pass with nothing to change.
func cleanPass(pass int) task.PRPass {
	return task.PRPass{Pass: pass, AskedAt: commitTime, Recorded: true, Clean: true, Revision: 1, RecordedAt: commitTime}
}

func TestApplyApprovedStartsTheImplementerWithTheFindings(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, decidedPass(1, approved, discarded, approved))

	if err := f.service.ApplyPRFindings(t.Context(), "task-1"); err != nil {
		t.Fatalf("ApplyPRFindings() = %v, want nil", err)
	}

	calls := f.sessions.recorded()
	if !slices.Contains(calls, "start:task-1:pr_fix:restarted=false") {
		t.Errorf("session calls = %q, want the implementer started", calls)
	}
	if slices.Contains(calls, "send:task-1:pr_review") {
		t.Errorf("session calls = %q, want nothing sent to the reviewer", calls)
	}
	info, _ := f.sessions.info(fixKeyOf)
	if info.Prompt != prompts.StagePRFix || info.PRNumber != "7" || info.Choice != models.Factory()[models.PRFix] {
		t.Errorf("session = %+v, want the implementer of pull request 7 with its choice", info)
	}
	want := session.AppMessage{
		Text: prreport.FixMessage(1, currentPassOf(t, f).Findings), Kind: session.AppApply, Count: 2,
	}
	if diff := cmp.Diff(want, info.Request); diff != "" {
		t.Errorf("first request mismatch (-want +got):\n%s", diff)
	}
	marked := []keyedMarker{{
		Key:    reviewKeyOf,
		Marker: session.MarkerEntry{Type: session.MarkerFindingsDecided, Pass: 1, Approved: 2, Discarded: 1},
	}}
	if diff := cmp.Diff(marked, f.sessions.marked(session.MarkerFindingsDecided)); diff != "" {
		t.Errorf("findings_decided markers mismatch (-want +got):\n%s", diff)
	}
}

func TestApplyApprovedOpensTheImplementerThatWasClosed(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, decidedPass(1, approved))
	if err := f.sessions.Start(t.Context(), session.TaskInfo{ID: "task-1", Stage: session.PRFixStage}, false); err != nil {
		t.Fatalf("Start() = %v, want nil", err)
	}
	if err := f.sessions.Close(t.Context(), fixKeyOf); err != nil {
		t.Fatalf("Close() = %v, want nil", err)
	}

	if err := f.service.ApplyPRFindings(t.Context(), "task-1"); err != nil {
		t.Fatalf("ApplyPRFindings() = %v, want nil", err)
	}

	calls := f.sessions.recorded()
	open, send := slices.Index(calls, "open:task-1:pr_fix"), slices.Index(calls, "send:task-1:pr_fix")
	if open < 0 || send < open {
		t.Errorf("session calls = %q, want the implementer opened and then sent the message", calls)
	}
}

func TestApprovePRStartsTheImplementerWhenItHasNoConversation(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, sentPass(decidedPass(1, approved)))
	f.reviews.setSnapshot(staged(3, 3))

	if err := f.service.ApprovePR(t.Context(), "task-1"); err != nil {
		t.Fatalf("ApprovePR() = %v, want nil", err)
	}

	info, ok := f.sessions.info(fixKeyOf)
	if !ok || info.Request.Kind != session.AppCommitPush || !strings.Contains(info.Request.Text, prompts.PushInstruction) {
		t.Errorf("first request = %+v, want the commit with the push", info.Request)
	}
	approvals := []keyedMarker{{Key: fixKeyOf, Marker: session.MarkerEntry{Type: session.MarkerChangesApproved, Files: 3}}}
	if diff := cmp.Diff(approvals, f.sessions.marked(session.MarkerChangesApproved)); diff != "" {
		t.Errorf("changes_approved markers mismatch (-want +got):\n%s", diff)
	}
}

func TestApprovePRMarksTheApprovalBeforeTheCommitInTheConversationOfTheImplementer(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, sentPass(decidedPass(1, approved)))
	implementerAtRest(f)
	f.reviews.setSnapshot(staged(3, 3))

	if err := f.service.ApprovePR(t.Context(), "task-1"); err != nil {
		t.Fatalf("ApprovePR() = %v, want nil", err)
	}

	if diff := cmp.Diff([]int{1}, f.sessions.markersBeforeSends()); diff != "" {
		t.Errorf("markers before the sends mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]session.AppMessage{{Kind: session.AppCommitPush}}, f.sessions.sentApps()); diff != "" {
		t.Errorf("app messages mismatch (-want +got):\n%s", diff)
	}
}

func TestApprovePRGivesTheApprovalBackWhenTheImplementerCannotBeReached(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, sentPass(decidedPass(1, approved)))
	f.reviews.setSnapshot(staged(3, 3))
	f.sessions.failWith(errStart)

	wantErrIs(t, f.service.ApprovePR(t.Context(), "task-1"), errStart)

	if run, _ := f.tasks.prRun("task-1"); run.Status != task.PRReviewing {
		t.Errorf("status = %q, want reviewing again", run.Status)
	}
}

func TestApprovePRIsRefusedWhileEitherSessionWorks(t *testing.T) {
	t.Parallel()

	tests := map[string]func(*fixture){
		"the implementer": func(f *fixture) {
			f.sessions.setSummary("task-1", session.Summary{
				Stage: session.PRFixStage, Status: session.StatusWorking, TurnRunning: true,
			})
		},
		"the reviewer": working,
	}
	for name, busy := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			structured(t, f, sentPass(decidedPass(1, approved)))
			f.reviews.setSnapshot(staged(3, 3))
			busy(f)

			wantErrIs(t, f.service.ApprovePR(t.Context(), "task-1"), flow.ErrStepBusy)
			if run, _ := f.tasks.prRun("task-1"); run.Status != task.PRReviewing {
				t.Errorf("status = %q, want reviewing", run.Status)
			}
		})
	}
}

func TestApprovePRAcceptsACleanPassWithChanges(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, cleanPass(1))
	dirtyWorktree(f)
	f.reviews.setSnapshot(staged(1, 1))
	implementerAtRest(f)

	if err := f.service.ApprovePR(t.Context(), "task-1"); err != nil {
		t.Fatalf("ApprovePR() = %v, want nil", err)
	}

	if run, _ := f.tasks.prRun("task-1"); run.Status != task.PRCommitting {
		t.Errorf("status = %q, want committing", run.Status)
	}
	if diff := cmp.Diff([]session.AppMessage{{Kind: session.AppCommitPush}}, f.sessions.sentApps()); diff != "" {
		t.Errorf("app messages mismatch (-want +got):\n%s", diff)
	}
}

func TestACleanManualReportWithLocalChangesGoesToTheReviewOfTheChanges(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, cleanPass(1))
	dirtyWorktree(f)
	f.reviews.setSnapshot(reviewed(0, 1))

	f.service.Check("task-1")

	waitFor(t, "the worktree to be watched", func() bool {
		active, watched := f.reviews.activeOf("task-1")
		return watched && active
	})
	state := f.prState(t, "task-1")
	if state.Status != flow.PRInReview {
		t.Errorf("status = %q, want in_review", state.Status)
	}
	if run, _ := f.tasks.prRun("task-1"); run.Status != task.PRReviewing {
		t.Errorf("run status = %q, want the review to go on", run.Status)
	}
}

func TestACleanManualReportWithNothingToCommitEndsTheReviewAndClosesTheImplementer(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, cleanPass(1))
	implementerAtRest(f)

	f.service.Check("task-1")

	f.waitPRRun(t, "the review to end", func(run task.PRRun) bool { return run.Status == task.PRDone })
	calls := f.sessions.recorded()
	if !slices.Contains(calls, "close:task-1:pr_review") || !slices.Contains(calls, "close:task-1:pr_fix") {
		t.Errorf("session calls = %q, want both conversations closed", calls)
	}
}

func TestTheCommitAfterACleanManualReportAsksForItsPass(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, cleanPass(1))
	f.worktrees.setStatus(git.Status{Head: commitSHA})
	f.gh.setPR("task-1", withChecks(passedChecks()))

	f.service.Check("task-1")

	waitFor(t, "the second pass", func() bool {
		passes := f.tasks.PRPasses("task-1")
		return len(passes) == 2 && f.sessions.sentCount(reviewPrompt(f.reviewPath(2))) > 0
	})
}

func TestTheCommitOfTheImplementerIsWaitedOn(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, sentPass(decidedPass(1, approved)))
	f.tasks.setPRRun("task-1", task.PRRun{
		Status: task.PRCommitting, PR: openPR(), ReportedPass: 1, ReviewedCommit: startCommit,
	})
	f.sessions.setSummary("task-1", session.Summary{
		Stage: session.PRFixStage, Status: session.StatusWorking, TurnRunning: true,
	})
	f.reviews.setSnapshot(reviewed(0, 0))

	f.service.Check("task-1")
	f.waitEvaluations(t, 1)
	if run, _ := f.tasks.prRun("task-1"); run.Status != task.PRCommitting {
		t.Errorf("status = %q, want committing while the implementer works", run.Status)
	}

	// The implementer rests and the branch did not move: nothing was committed.
	f.sessions.goIdleSession(fixKeyOf)
	unmoved := reviewed(3, 3)
	unmoved.Head = startCommit
	f.reviews.setSnapshot(unmoved)
	f.service.Check("task-1")
	waitFor(t, "the approval to go back to the user", func() bool { return f.prState(t, "task-1").CommitFailed })
}

func TestTheDiscardedFindingsOfEarlierPassesAreListedForTheReviewer(t *testing.T) {
	t.Parallel()

	passes := []task.PRPass{
		sentPass(decidedPass(1, approved, discarded)),
		decidedPass(2, discarded, discarded),
		recordedPass(3, reportedFinding(1)),
		sentPass(decidedPass(4, discarded)),
	}
	passes[1].Findings[1].Path, passes[1].Findings[1].Line = "", 0

	got := flow.DiscardedFindings(passes, 4)

	want := strings.Join([]string{
		"- pass 1 · 2 · Finding 2 · internal/file2.go:2",
		"- pass 2 · 1 · Finding 1 · internal/file1.go:1",
		"- pass 2 · 2 · Finding 2 · general",
	}, "\n")
	if got != want {
		t.Errorf("discarded findings = %q, want %q", got, want)
	}
	if none := flow.DiscardedFindings(passes[:1][:0], 1); none != "" {
		t.Errorf("discarded findings of no pass = %q, want none", none)
	}
}

func TestTheNextManualPassTellsTheReviewerWhatTheUserDiscarded(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, sentPass(decidedPass(1, approved, discarded)))
	if err := f.sessions.Start(t.Context(), session.TaskInfo{ID: "task-1", Stage: session.PRReviewStage}, false); err != nil {
		t.Fatalf("Start() = %v, want nil", err)
	}
	if err := f.sessions.Close(t.Context(), reviewKeyOf); err != nil {
		t.Fatalf("Close() = %v, want nil", err)
	}

	f.service.Check("task-1")

	waitFor(t, "the reviewer to be opened again", func() bool {
		info, ok := f.sessions.info(reviewKeyOf)
		return ok && info.ReviewOnly
	})
	info, _ := f.sessions.info(reviewKeyOf)
	if !strings.Contains(info.DiscardedFindings, "- pass 1 · 2 · Finding 2") {
		t.Errorf("discarded findings = %q, want the one of pass 1", info.DiscardedFindings)
	}
}

func TestTheReviewerOfATaskOnlyReviews(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	underReview(t, f)

	info, _ := f.sessions.info(reviewKeyOf)
	if !info.ReviewOnly {
		t.Errorf("session = %+v, want a reviewer that only reviews", info)
	}
}

func TestReviewAgainKeepsTheConversationOfTheReviewer(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	underReview(t, f)
	reportsWritten(t, f, reports(1, true))
	f.waitPRRun(t, "the review to end", func(run task.PRRun) bool { return run.Status == task.PRDone })
	f.gh.setPR("task-1", withChecks(passedChecks()))

	if err := f.service.ReviewAgain(t.Context(), "task-1"); err != nil {
		t.Fatalf("ReviewAgain() = %v, want nil", err)
	}

	waitFor(t, "the second pass in the same conversation", func() bool {
		for _, app := range f.sessions.sentApps() {
			if app.Kind == session.AppPRPass && app.Pass == 2 {
				return true
			}
		}
		return false
	})
	calls := f.sessions.recorded()
	if slices.Contains(calls, "discard:task-1:pr_review") || countCalls(calls, "start:task-1:pr_review:restarted=false") != 1 {
		t.Errorf("session calls = %q, want the conversation of the reviewer kept", calls)
	}
}

func TestReviewAgainCutsAPassUnderWay(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, askedPass(1))
	f.sessions.setSummary("task-1", session.Summary{
		Stage: session.PRReviewStage, Status: session.StatusWorking, TurnRunning: true,
	})
	writeReport(t, f, 1, "half a report")
	tk, _ := f.tasks.Get("task-1")

	if err := f.service.ReviewAgain(t.Context(), "task-1"); err != nil {
		t.Fatalf("ReviewAgain() = %v, want nil", err)
	}

	if !slices.Contains(f.sessions.recorded(), "interrupt:task-1:pr_review") {
		t.Errorf("session calls = %q, want the reviewer interrupted", f.sessions.recorded())
	}
	if passes := f.tasks.PRPasses("task-1"); len(passes) != 0 {
		t.Errorf("passes = %+v, want the pass under way dropped", passes)
	}
	if _, err := os.Stat(tk.ReviewPath(1)); !os.IsNotExist(err) {
		t.Errorf("stat report = %v, want it gone", err)
	}
	if run, _ := f.tasks.prRun("task-1"); run.Status != task.PRWaitingChecks || run.ReviewedCommit != "" {
		t.Errorf("run = %+v, want the wait for the checks with no report covering the head", run)
	}
}

func TestReviewAgainIsRefusedWhileTheImplementerWorks(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, sentPass(decidedPass(1, approved)))
	f.sessions.setSummary("task-1", session.Summary{
		Stage: session.PRFixStage, Status: session.StatusWorking, TurnRunning: true,
	})

	wantErrIs(t, f.service.ReviewAgain(t.Context(), "task-1"), flow.ErrStepBusy)

	if run, _ := f.tasks.prRun("task-1"); run.Status != task.PRReviewing {
		t.Errorf("status = %q, want reviewing", run.Status)
	}
}

func TestReviewAgainAfterARestartAsksThePassItOwes(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, recordedPass(1, reportedFinding(1)))
	f.tasks.setPRRun("task-1", task.PRRun{Status: task.PRReviewing, PR: openPR(), ReportedPass: 1})
	f.tasks.setPRPasses("task-1", sentPass(decidedPass(1, discarded)))
	f.gh.setPR("task-1", withChecks(noChecks()))

	f.service.Sync(t.Context())

	waitFor(t, "the pass that is owed", func() bool { return len(f.tasks.PRPasses("task-1")) == 2 })
	if app := f.sessions.sentApps(); len(app) == 0 || app[len(app)-1].Kind != session.AppPRPass {
		t.Errorf("app messages = %+v, want the pass asked of the reviewer", app)
	}
}

func TestThePRReviewModeIsEditableUntilThePullRequestIsFound(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		stage task.Stage
		pr    *flow.PullRequest
		want  bool
	}{
		{"before the PR stage", task.StageImplementation, nil, true},
		{"the PR stage with no pull request", task.StagePR, &flow.PullRequest{}, true},
		{"the PR stage before it is read", task.StagePR, nil, false},
		{"the PR stage with its pull request", task.StagePR, &flow.PullRequest{PR: task.PRDetails{Number: 7}}, false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			tk := task.Task{ID: "task-1", Stage: test.stage}
			if got := flow.PRReviewModeEditable(tk, test.pr); got != test.want {
				t.Errorf("PRReviewModeEditable() = %v, want %v", got, test.want)
			}
		})
	}
}

func TestThePRReviewModeInEffectIsManualOnceTheAgentFellBack(t *testing.T) {
	t.Parallel()

	tk := task.Task{ReviewModes: task.ReviewModes{PR: reviewmode.Agent}}
	if got := flow.PRReviewModeOf(tk, nil); got != reviewmode.Agent {
		t.Errorf("mode = %q, want agent", got)
	}
	fellBack := &flow.PullRequest{Fallback: task.FallbackTakenOver}
	if got := flow.PRReviewModeOf(tk, fellBack); got != reviewmode.Manual {
		t.Errorf("mode after the fallback = %q, want manual", got)
	}
	if got := flow.PRReviewModeOf(task.Task{}, nil); got != reviewmode.Manual {
		t.Errorf("mode of a task with no mode = %q, want manual", got)
	}
}

func TestTheStatusOfThePullRequestUnderTheAgentReview(t *testing.T) {
	t.Parallel()

	type facts struct {
		reviewer  session.Summary
		fixer     *session.Summary
		head      string
		unchanged bool
	}
	rest := session.Summary{Stage: session.PRReviewStage, Status: session.StatusWaiting, Idle: true}
	working := session.Summary{Stage: session.PRReviewStage, Status: session.StatusWorking, TurnRunning: true}
	fixerRest := &session.Summary{Stage: session.PRFixStage, Status: session.StatusWaiting, Idle: true}
	fixerWorks := &session.Summary{Stage: session.PRFixStage, Status: session.StatusWorking, TurnRunning: true}

	tests := []struct {
		name  string
		mode  reviewmode.Mode
		pass  task.PRPass
		facts facts
		want  flow.PRStatus
	}{
		{"asked, the reviewer works", reviewmode.Agent, askedPass(1), facts{reviewer: working}, flow.PRReviewing},
		{"asked, the reviewer rests", reviewmode.Agent, askedPass(1), facts{reviewer: rest}, flow.PRAwaitingReply},
		{
			"recorded, the reviewer works on its rewrite", reviewmode.Agent, recordedPass(1, reportedFinding(1)),
			facts{reviewer: working},
			flow.PRReviewing,
		},
		{
			"findings to hand over", reviewmode.Agent, recordedPass(1, reportedFinding(1)),
			facts{reviewer: rest, fixer: fixerRest},
			flow.PRReviewing,
		},
		{
			"findings handed over, the implementer works", reviewmode.Agent, sentPass(recordedPass(1, reportedFinding(1))),
			facts{reviewer: rest, fixer: fixerWorks},
			flow.PRAddressingReview,
		},
		{
			"findings handed over, the implementer is done", reviewmode.Agent, sentPass(recordedPass(1, reportedFinding(1))),
			facts{reviewer: rest, fixer: fixerRest},
			flow.PRAddressingReview,
		},
		{
			"clean with changes to commit", reviewmode.Agent, cleanPass(1),
			facts{reviewer: rest, fixer: fixerRest, head: startCommit},
			flow.PRCommitting,
		},
		{
			"clean with changes, the commit moved the head", reviewmode.Agent, cleanPass(1),
			facts{reviewer: rest, fixer: fixerRest, head: commitSHA},
			flow.PRReviewing,
		},
		{
			"manual, findings to decide", reviewmode.Manual, recordedPass(1, reportedFinding(1)),
			facts{reviewer: rest},
			flow.PRAwaitingDecision,
		},
		{
			"manual, sent, the implementer works", reviewmode.Manual, sentPass(decidedPass(1, approved)),
			facts{reviewer: rest, fixer: fixerWorks},
			flow.PRAddressingReview,
		},
		{
			"manual, sent, the implementer is done", reviewmode.Manual, sentPass(decidedPass(1, approved)),
			facts{reviewer: rest, fixer: fixerRest},
			flow.PRReadyToApprove,
		},
		{
			"manual, sent, nothing changed", reviewmode.Manual, sentPass(decidedPass(1, approved)),
			facts{reviewer: rest, fixer: fixerRest, unchanged: true},
			flow.PRInReview,
		},
		{
			"manual, clean, the implementer works on the changes", reviewmode.Manual, cleanPass(1),
			facts{reviewer: rest, fixer: fixerWorks, head: startCommit},
			flow.PRAddressingReview,
		},
		{"manual, clean, with changes", reviewmode.Manual, cleanPass(1), facts{reviewer: rest}, flow.PRReadyToApprove},
		{
			"manual, clean, nothing changed", reviewmode.Manual, cleanPass(1),
			facts{reviewer: rest, unchanged: true},
			flow.PRDone,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			inPR(f, "task-1", plan(), task.PRReviewing)
			f.tasks.setReviewModes("task-1", task.ReviewModes{PR: test.mode})
			f.tasks.setPRRun("task-1", task.PRRun{
				Status: task.PRReviewing, PR: openPR(), ReportedPass: 1, ReviewedCommit: startCommit,
			})
			f.tasks.setPRPasses("task-1", test.pass)
			f.sessions.setSummary("task-1", test.facts.reviewer)
			if test.facts.fixer != nil {
				f.sessions.setSummary("task-1", *test.facts.fixer)
			}
			snap := reviewed(3, 3)
			if test.facts.unchanged {
				snap = reviewed(0, 0)
			}
			snap.Head = cmpOr(test.facts.head, startCommit)
			f.reviews.setSnapshot(snap)

			state := f.prState(t, "task-1")
			if state.Status != test.want {
				t.Errorf("status = %q, want %q", state.Status, test.want)
			}
			if test.mode == reviewmode.Agent && state.Round != prRoundsOf(test.pass) {
				t.Errorf("round = %d, want %d", state.Round, prRoundsOf(test.pass))
			}
		})
	}
}

// prRoundsOf is how many rounds of the agent review a single pass counts.
func prRoundsOf(pass task.PRPass) int {
	if pass.Sent() {
		return 1
	}
	return 0
}

// cmpOr is the first of two strings that is not empty.
func cmpOr(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

func TestThePullRequestSaysWhatItKnowsAboutTheImplementer(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, recordedPass(1, reportedFinding(1)))

	if state := f.prState(t, "task-1"); state.FixerStarted || state.FixerStage != "" || state.Mode != reviewmode.Manual {
		t.Errorf("state = %+v, want an implementer that never started", state)
	}

	implementerAtRest(f)
	state := f.prState(t, "task-1")
	if !state.FixerStarted || state.FixerStage != session.PRFixStage || !state.Fixer.Idle {
		t.Errorf("state = %+v, want the implementer open and at rest", state)
	}

	if err := f.sessions.Close(t.Context(), fixKeyOf); err != nil {
		t.Fatalf("Close() = %v, want nil", err)
	}
	if err := f.sessions.Start(t.Context(), session.TaskInfo{ID: "task-1", Stage: session.PRFixStage}, false); err != nil {
		t.Fatalf("Start() = %v, want nil", err)
	}
	if err := f.sessions.Close(t.Context(), fixKeyOf); err != nil {
		t.Fatalf("Close() = %v, want nil", err)
	}
	state = f.prState(t, "task-1")
	if !state.FixerStarted || state.FixerStage != "" {
		t.Errorf("state = %+v, want a conversation that exists and is closed", state)
	}
}

func TestTheImplementerReopensWithTheApp(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, sentPass(decidedPass(1, approved)))
	if err := f.sessions.Start(t.Context(), session.TaskInfo{ID: "task-1", Stage: session.PRFixStage}, false); err != nil {
		t.Fatalf("Start() = %v, want nil", err)
	}
	if err := f.sessions.Close(t.Context(), fixKeyOf); err != nil {
		t.Fatalf("Close() = %v, want nil", err)
	}

	f.service.Sync(t.Context())

	waitFor(t, "the implementer to be opened", func() bool {
		return slices.Contains(f.sessions.recorded(), "open:task-1:pr_fix")
	})
	info, _ := f.sessions.info(fixKeyOf)
	if info.Prompt != prompts.StagePRFix || info.Dir == "" {
		t.Errorf("session = %+v, want the implementer of the worktree", info)
	}
}

func TestClosingTheTaskClosesTheImplementer(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	awaitingClosing(f, "task-1", plan(), task.PRRun{Status: task.PRDone, PR: mergedPR()})

	if err := f.service.CloseTask(t.Context(), "task-1"); err != nil {
		t.Fatalf("CloseTask() = %v, want nil", err)
	}

	if !slices.Contains(f.sessions.recorded(), "close:task-1:pr_fix") {
		t.Errorf("session calls = %q, want the implementer closed", f.sessions.recorded())
	}
}

func TestAMergedPullRequestEndsTheWaitAndClosesTheImplementer(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	foundPR(f, passedChecks())
	implementerAtRest(f)
	f.tasks.setPRRun("task-1", task.PRRun{Status: task.PRWaitingChecks, PR: openPR()})
	f.gh.setPR("task-1", gh.PR{Number: 7, URL: samePR.URL, State: gh.StateMerged})

	f.service.Sync(t.Context())

	waitFor(t, "the implementer to be closed", func() bool {
		return slices.Contains(f.sessions.recorded(), "close:task-1:pr_fix")
	})
}

func TestTheMessagesOfTheAgentReviewCarryTheRoundAndTheStatus(t *testing.T) {
	t.Parallel()

	report := flow.PRReportMessage("/data/pr/review-2.md", "\nThe report.\n", 2)
	for _, want := range []string{"round 2 of 5", "`/data/pr/review-2.md`", "The report.", "Address every finding"} {
		if !strings.Contains(report, want) {
			t.Errorf("report message = %q, want it to contain %q", report, want)
		}
	}

	local := flow.PRLocalPassMessage("Done.", "/data/pr/review-3.md", "- Checks: 1 check passed.")
	for _, want := range []string{"not committed yet", "Done.", "`/data/pr/review-3.md`", "## GitHub status", "- Checks: 1 check passed."} {
		if !strings.Contains(local, want) {
			t.Errorf("local pass message = %q, want it to contain %q", local, want)
		}
	}
}
