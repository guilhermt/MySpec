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
	// The reading of the checks runs on its own goroutine and moves the status on,
	// so what was asked for is read from the calls and the commit reviewed.
	if run, _ := f.tasks.prRun("task-1"); run.ReviewedCommit != "" {
		t.Errorf("run = %+v, want no report covering the head", run)
	}
	if !slices.Contains(f.tasks.recorded(), "pr:waiting_checks:task-1") {
		t.Errorf("task calls = %q, want the wait for the checks", f.tasks.recorded())
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

// agentReview puts a task under the agent review of its pull request, with the
// passes given and the reviewer at rest.
func agentReview(t *testing.T, f *fixture, passes ...task.PRPass) {
	t.Helper()

	structured(t, f, passes...)
	f.tasks.setReviewModes("task-1", task.ReviewModes{PR: reviewmode.Agent})
}

// appMessagesOf are the messages of the app of one kind, in order.
func appMessagesOf(f *fixture, kind session.AppKind) []session.AppMessage {
	var out []session.AppMessage
	for _, app := range f.sessions.sentApps() {
		if app.Kind == kind {
			out = append(out, app)
		}
	}
	return out
}

func TestAnAgentReviewHandsAReportWithFindingsToTheImplementer(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	agentReview(t, f, recordedPass(1, reportedFinding(1), reportedFinding(2)))

	f.service.Check("task-1")

	waitFor(t, "the implementer to be started", func() bool {
		_, ok := f.sessions.info(fixKeyOf)
		return ok
	})
	info, _ := f.sessions.info(fixKeyOf)
	if info.Prompt != prompts.StagePRFix {
		t.Errorf("prompt = %q, want the one of the implementer", info.Prompt)
	}
	request := info.Request
	if request.Kind != session.AppReport || request.Pass != 1 || request.Round != 1 ||
		request.Rounds != flow.MaxPRReviewRounds || request.Count != 2 {
		t.Errorf("request = %+v, want round 1 of the report of pass 1, with its 2 findings", request)
	}
	if !strings.Contains(request.Text, "round 1 of 5") || !strings.Contains(request.Text, f.reviewPath(1)) {
		t.Errorf("request text = %q, want the round and the path of the report", request.Text)
	}
	if pass := currentPassOf(t, f); !pass.Sent() {
		t.Errorf("pass = %+v, want it marked as sent", pass)
	}
	if run, _ := f.tasks.prRun("task-1"); run.Fallback != "" {
		t.Errorf("fallback = %q, want none", run.Fallback)
	}
}

func TestTheReviewerReviewsAgainOnceTheImplementerIsDone(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	agentReview(t, f, sentPass(recordedPass(1, reportedFinding(1))))
	implementerAtRest(f)
	f.sessions.setReply(fixKeyOf, "Fixed finding 1.")
	dirtyWorktree(f)
	f.tasks.setPRRun("task-1", task.PRRun{
		Status: task.PRReviewing, PR: openPR(), ReportedPass: 1, ReviewedCommit: startCommit,
	})

	f.service.Check("task-1")

	waitFor(t, "the pass after the work of the implementer", func() bool {
		return len(appMessagesOf(f, session.AppPRPass)) > 0
	})
	pass := appMessagesOf(f, session.AppPRPass)[0]
	texts := strings.Join(f.sessions.sent(), "\n---\n")
	for _, want := range []string{"Fixed finding 1.", "## GitHub status", f.reviewPath(2)} {
		if !strings.Contains(texts, want) {
			t.Errorf("messages = %q, want one to contain %q", texts, want)
		}
	}
	if pass.Pass != 2 || len(f.tasks.PRPasses("task-1")) != 2 {
		t.Errorf("pass = %+v with passes %+v, want the second one asked", pass, f.tasks.PRPasses("task-1"))
	}
	if kinds := appMessagesOf(f, session.AppCommitAllPush); len(kinds) != 0 {
		t.Errorf("commit messages = %+v, want nothing committed", kinds)
	}
	if slices.Contains(f.sessions.recorded(), "send:task-1:pr_fix") {
		t.Errorf("session calls = %q, want nothing sent to the implementer", f.sessions.recorded())
	}
}

func TestACleanAgentReportWithChangesIsCommittedAndPushedByTheImplementer(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	agentReview(t, f, cleanPass(1))
	implementerAtRest(f)
	dirtyWorktree(f)

	f.service.Check("task-1")

	f.waitPRRun(t, "the commit to be asked", func(run task.PRRun) bool { return run.Status == task.PRCommitting })
	waitFor(t, "the commit message", func() bool { return len(appMessagesOf(f, session.AppCommitAllPush)) > 0 })
	if !slices.Contains(f.sessions.recorded(), "send:task-1:pr_fix") {
		t.Errorf("session calls = %q, want the commit sent to the implementer", f.sessions.recorded())
	}
}

func TestTheAgentReviewWaitsForTheChecksAfterItsPush(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	agentReview(t, f, cleanPass(1))
	implementerAtRest(f)
	f.worktrees.setStatus(git.Status{Head: commitSHA})
	f.gh.setPR("task-1", withChecks(passedChecks()))

	f.service.Check("task-1")

	waitFor(t, "the second pass", func() bool {
		return len(f.tasks.PRPasses("task-1")) == 2 && f.sessions.sentCount(reviewPrompt(f.reviewPath(2))) > 0
	})
	calls := f.tasks.recorded()
	if !slices.Contains(calls, "pr:waiting_checks:task-1") {
		t.Errorf("task calls = %q, want the wait for the checks of the push", calls)
	}
}

func TestACleanAgentReportWithNothingToCommitEndsTheReview(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	agentReview(t, f, cleanPass(1))
	implementerAtRest(f)

	f.service.Check("task-1")

	f.waitPRRun(t, "the review to end", func(run task.PRRun) bool { return run.Status == task.PRDone })
	calls := f.sessions.recorded()
	if !slices.Contains(calls, "close:task-1:pr_review") || !slices.Contains(calls, "close:task-1:pr_fix") {
		t.Errorf("session calls = %q, want both conversations closed", calls)
	}
}

func TestTheSixthReportWithFindingsFallsBackToTheUser(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	passes := make([]task.PRPass, 0, flow.MaxPRReviewRounds+1)
	for pass := 1; pass <= flow.MaxPRReviewRounds; pass++ {
		passes = append(passes, sentPass(recordedPass(pass, reportedFinding(1))))
	}
	passes = append(passes, recordedPass(flow.MaxPRReviewRounds+1, reportedFinding(1)))
	agentReview(t, f, passes...)
	implementerAtRest(f)

	f.service.Check("task-1")

	f.waitPRRun(t, "the fallback", func(run task.PRRun) bool { return run.Fallback == task.FallbackRoundsExhausted })
	waitFor(t, "the findings to wait for the user", func() bool {
		state := f.prState(t, "task-1")
		return state.Status == flow.PRAwaitingDecision && state.Mode == reviewmode.Manual
	})
	if pass := currentPassOf(t, f); pass.Sent() {
		t.Errorf("pass = %+v, want it recorded and not sent", pass)
	}
	if slices.Contains(f.sessions.recorded(), "send:task-1:pr_fix") {
		t.Errorf("session calls = %q, want nothing sent to the implementer", f.sessions.recorded())
	}
}

func TestACommitThatDoesNotHappenFallsBackToTheUser(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	agentReview(t, f, cleanPass(1))
	f.tasks.setPRRun("task-1", task.PRRun{
		Status: task.PRCommitting, PR: openPR(), ReportedPass: 1, ReviewedCommit: startCommit,
	})
	implementerAtRest(f)
	dirtyWorktree(f)
	unmoved := reviewed(1, 1)
	unmoved.Head = startCommit
	f.reviews.setSnapshot(unmoved)

	f.service.Check("task-1")

	f.waitPRRun(t, "the fallback", func(run task.PRRun) bool { return run.Fallback == task.FallbackNoCommit })
	calls := f.tasks.recorded()
	fallback := slices.Index(calls, "prFallback:commit_failed:task-1")
	back := slices.Index(calls, "pr:reviewing:task-1")
	if fallback < 0 || back < fallback {
		t.Errorf("task calls = %q, want the fallback recorded before the review goes on", calls)
	}
}

func TestTroubleAfterTheAgentReviewOpensAPassOnItsOwn(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	agentReview(t, f, cleanPass(1))
	f.tasks.setPRRun("task-1", task.PRRun{
		Status: task.PRDone, PR: openPR(), ReportedPass: 1, ReviewedCommit: startCommit,
		Trouble: gh.Trouble{FailedChecks: []string{"build"}},
	})
	f.gh.setPR("task-1", withChecks(passedChecks()))

	f.service.Check("task-1")

	f.waitPRRun(t, "the wait for the checks", func(run task.PRRun) bool { return run.Status != task.PRDone })
	waitFor(t, "the pass in the same conversation", func() bool {
		return len(appMessagesOf(f, session.AppPRPass)) > 0
	})
	if pass := appMessagesOf(f, session.AppPRPass)[0]; pass.Pass != 2 {
		t.Errorf("pass = %+v, want the second one", pass)
	}
	if slices.Contains(f.sessions.recorded(), "discard:task-1:pr_review") {
		t.Errorf("session calls = %q, want the conversation kept", f.sessions.recorded())
	}
}

func TestAMergedAgentReviewAsksNoPassForTrouble(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	agentReview(t, f, cleanPass(1))
	f.tasks.setPRRun("task-1", task.PRRun{
		Status: task.PRDone, PR: mergedPR(), ReportedPass: 1, ReviewedCommit: startCommit,
		Trouble: gh.Trouble{Conflict: true},
	})

	f.service.Check("task-1")
	f.waitEvaluations(t, 1)

	if run, _ := f.tasks.prRun("task-1"); run.Status != task.PRDone {
		t.Errorf("status = %q, want the review to stay over", run.Status)
	}
}

func TestTheAgentLoopWaitsWhileEitherSessionWorksAsksOrFailed(t *testing.T) {
	t.Parallel()

	tests := map[string]session.Summary{
		"the reviewer works": {Stage: session.PRReviewStage, Status: session.StatusWorking, TurnRunning: true},
		"the reviewer failed": {
			Stage: session.PRReviewStage, Status: session.StatusWaiting, Idle: true, TurnFailed: true,
		},
		"the implementer works": {Stage: session.PRFixStage, Status: session.StatusWorking, TurnRunning: true},
		"the implementer has a message queued": {
			Stage: session.PRFixStage, Status: session.StatusWaiting, PendingCount: 1,
		},
		"the implementer failed": {
			Stage: session.PRFixStage, Status: session.StatusWaiting, Idle: true, TurnFailed: true,
		},
		"the implementer is paused": {Stage: session.PRFixStage, Status: session.StatusPaused},
	}
	for name, busy := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			agentReview(t, f, recordedPass(1, reportedFinding(1)))
			f.sessions.setSummary("task-1", busy)

			f.service.Check("task-1")
			f.waitEvaluated(t, "task-1", 0)

			if pass := currentPassOf(t, f); pass.Sent() {
				t.Errorf("pass = %+v, want the report held back", pass)
			}
			for _, call := range f.sessions.recorded() {
				if strings.HasPrefix(call, "send:") || strings.HasPrefix(call, "start:") {
					t.Errorf("session calls = %q, want nothing sent", f.sessions.recorded())
				}
			}
		})
	}
}

func TestReviewPRMyselfCutsAPassUnderWayAndHandsTheLocalChangesToTheUser(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	agentReview(t, f, sentPass(recordedPass(1, reportedFinding(1))), askedPass(2))
	f.tasks.setPRRun("task-1", task.PRRun{
		Status: task.PRReviewing, PR: openPR(), ReportedPass: 1, ReviewedCommit: startCommit,
	})
	f.sessions.setSummary("task-1", session.Summary{
		Stage: session.PRReviewStage, Status: session.StatusWorking, TurnRunning: true,
	})
	writeReport(t, f, 2, "half a report")
	dirtyWorktree(f)
	f.reviews.setSnapshot(reviewed(0, 1))
	tk, _ := f.tasks.Get("task-1")

	if err := f.service.ReviewPRMyself(t.Context(), "task-1"); err != nil {
		t.Fatalf("ReviewPRMyself() = %v, want nil", err)
	}

	if run, _ := f.tasks.prRun("task-1"); run.Fallback != task.FallbackTakenOver {
		t.Errorf("fallback = %q, want taken_over", run.Fallback)
	}
	if !slices.Contains(f.sessions.recorded(), "interrupt:task-1:pr_review") {
		t.Errorf("session calls = %q, want the reviewer interrupted", f.sessions.recorded())
	}
	if passes := f.tasks.PRPasses("task-1"); len(passes) != 1 {
		t.Errorf("passes = %+v, want the pass under way dropped", passes)
	}
	if _, err := os.Stat(tk.ReviewPath(2)); !os.IsNotExist(err) {
		t.Errorf("stat report = %v, want it gone", err)
	}
	if state := f.prState(t, "task-1"); state.Status != flow.PRInReview || state.Mode != reviewmode.Manual {
		t.Errorf("state = %q in %q, want the changes of the loop in review by the user", state.Status, state.Mode)
	}
}

func TestReviewPRMyselfLeavesThePassAskedWhenTheWorktreeHasNoChanges(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	agentReview(t, f, sentPass(recordedPass(1, reportedFinding(1))), askedPass(2))
	f.tasks.setPRRun("task-1", task.PRRun{
		Status: task.PRReviewing, PR: openPR(), ReportedPass: 1, ReviewedCommit: startCommit,
	})
	f.sessions.setSummary("task-1", session.Summary{
		Stage: session.PRReviewStage, Status: session.StatusWorking, TurnRunning: true,
	})

	if err := f.service.ReviewPRMyself(t.Context(), "task-1"); err != nil {
		t.Fatalf("ReviewPRMyself() = %v, want nil", err)
	}

	if passes := f.tasks.PRPasses("task-1"); len(passes) != 2 {
		t.Errorf("passes = %+v, want the pass asked kept", passes)
	}
}

func TestReviewPRMyselfKeepsTheWaitForTheChecks(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	agentReview(t, f, cleanPass(1))
	f.tasks.setPRRun("task-1", task.PRRun{
		Status: task.PRWaitingChecks, PR: openPR(), ReportedPass: 1, ReviewedCommit: startCommit,
	})

	if err := f.service.ReviewPRMyself(t.Context(), "task-1"); err != nil {
		t.Fatalf("ReviewPRMyself() = %v, want nil", err)
	}

	run, _ := f.tasks.prRun("task-1")
	if run.Status != task.PRWaitingChecks || run.Fallback != task.FallbackTakenOver {
		t.Errorf("run = %+v, want the wait kept with the review taken over", run)
	}
}

func TestReviewPRMyselfIsRefusedWithoutTheAgentReview(t *testing.T) {
	t.Parallel()

	tests := map[string]struct {
		modes task.ReviewModes
		run   task.PRRun
	}{
		"manual mode": {task.ReviewModes{}, task.PRRun{Status: task.PRReviewing, PR: openPR()}},
		"already taken over": {
			task.ReviewModes{PR: reviewmode.Agent},
			task.PRRun{Status: task.PRReviewing, PR: openPR(), Fallback: task.FallbackTakenOver},
		},
		"no pull request yet": {task.ReviewModes{PR: reviewmode.Agent}, task.PRRun{Status: task.PRDrafting}},
		"merged": {
			task.ReviewModes{PR: reviewmode.Agent}, task.PRRun{Status: task.PRDone, PR: mergedPR()},
		},
		"closing": {
			task.ReviewModes{PR: reviewmode.Agent}, task.PRRun{Status: task.PRClosing, PR: openPR()},
		},
	}
	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			structured(t, f, cleanPass(1))
			f.tasks.setReviewModes("task-1", test.modes)
			f.tasks.setPRRun("task-1", test.run)

			wantErrIs(t, f.service.ReviewPRMyself(t.Context(), "task-1"), flow.ErrNoAgentPRReview)
		})
	}
}

func TestReviewAgainIsRefusedWhileTheAgentReviews(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	agentReview(t, f, recordedPass(1, reportedFinding(1)))

	wantErrIs(t, f.service.ReviewAgain(t.Context(), "task-1"), flow.ErrAgentReviewsPR)

	if run, _ := f.tasks.prRun("task-1"); run.Status != task.PRReviewing {
		t.Errorf("status = %q, want reviewing", run.Status)
	}
}

func TestReviewAgainIsAllowedOnceTheAgentReviewIsDone(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	agentReview(t, f, cleanPass(1))
	f.tasks.setPRRun("task-1", task.PRRun{
		Status: task.PRDone, PR: openPR(), ReportedPass: 1, ReviewedCommit: startCommit,
	})
	f.gh.setPR("task-1", withChecks(passedChecks()))

	if err := f.service.ReviewAgain(t.Context(), "task-1"); err != nil {
		t.Fatalf("ReviewAgain() = %v, want nil", err)
	}

	if !slices.Contains(f.tasks.recorded(), "pr:waiting_checks:task-1") {
		t.Errorf("task calls = %q, want the wait for the checks", f.tasks.recorded())
	}
}

func TestTheUserCannotApproveOrDecideWhileTheAgentReviews(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	agentReview(t, f, recordedPass(1, reportedFinding(1)))
	f.reviews.setSnapshot(staged(3, 3))

	wantErrIs(t, f.service.ApprovePR(t.Context(), "task-1"), flow.ErrAgentReviewsPR)
	wantErrIs(t, f.service.DecidePRFinding(t.Context(), "task-1", 1, 1, approved), flow.ErrNotDeciding)
	wantErrIs(t, f.service.ApplyPRFindings(t.Context(), "task-1"), flow.ErrNotDeciding)
}

func TestSetPRReviewModeIsRefusedOnceTheReviewBegan(t *testing.T) {
	t.Parallel()

	t.Run("before the pull request is found", func(t *testing.T) {
		t.Parallel()

		f := newFixture(t)
		inPR(f, "task-1", plan(), task.PRDrafting)
		f.tasks.setPRRun("task-1", task.PRRun{Status: task.PRDrafting})

		if err := f.service.SetPRReviewMode(t.Context(), "task-1", reviewmode.Agent); err != nil {
			t.Fatalf("SetPRReviewMode() = %v, want nil", err)
		}

		tk, _ := f.tasks.Get("task-1")
		if tk.ReviewModes.PRMode() != reviewmode.Agent {
			t.Errorf("mode = %q, want agent", tk.ReviewModes.PRMode())
		}
	})

	t.Run("once the pull request is found", func(t *testing.T) {
		t.Parallel()

		f := newFixture(t)
		structured(t, f, recordedPass(1, reportedFinding(1)))

		wantErrIs(t, f.service.SetPRReviewMode(t.Context(), "task-1", reviewmode.Agent), flow.ErrPRReviewModeLocked)

		tk, _ := f.tasks.Get("task-1")
		if tk.ReviewModes.PRMode() != reviewmode.Manual {
			t.Errorf("mode = %q, want it unchanged", tk.ReviewModes.PRMode())
		}
	})

	t.Run("a task that does not exist", func(t *testing.T) {
		t.Parallel()

		f := newFixture(t)

		wantErrIs(t, f.service.SetPRReviewMode(t.Context(), "nope", reviewmode.Agent), task.ErrNotFound)
	})
}
