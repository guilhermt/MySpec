package flow_test

import (
	"errors"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/prreport"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

// askedPass is a structured pass the app asked for and whose report is not in.
func askedPass(pass int) task.PRPass {
	return task.PRPass{Pass: pass, AskedAt: commitTime}
}

// recordedPass is a structured pass with the report the agent wrote, nothing
// decided yet.
func recordedPass(pass int, findings ...prreport.Finding) task.PRPass {
	return task.PRPass{
		Pass: pass, AskedAt: commitTime, Recorded: true, Revision: 1, RecordedAt: commitTime, Findings: findings,
	}
}

// decidedPass is a recorded pass whose findings were decided, one decision per
// finding, in order.
func decidedPass(pass int, decisions ...prreport.Decision) task.PRPass {
	findings := make([]prreport.Finding, 0, len(decisions))
	for i, d := range decisions {
		f := reportedFinding(i + 1)
		f.Decision = d
		findings = append(findings, f)
	}
	return recordedPass(pass, findings...)
}

// reportedFinding is the finding the report of a pass lists at a number, with
// the text the agent wrote.
func reportedFinding(number int) prreport.Finding {
	n := strconv.Itoa(number)
	return prreport.Finding{
		Number: number, Title: "Finding " + n, Path: "internal/file" + n + ".go", Line: number,
		Original: "Text of finding " + n + ".", Text: "Text of finding " + n + ".",
	}
}

// sentPass is a pass whose approved findings went to the agent.
func sentPass(pass task.PRPass) task.PRPass {
	pass.SentAt = commitTime.Add(time.Hour)
	return pass
}

const (
	approved  = prreport.DecisionApproved
	discarded = prreport.DecisionDiscarded
	undecided = prreport.DecisionNone
)

// structured puts a task under the review of its pull request, with the passes
// asked for with the structured format and the conversation of the review at
// rest. The reports of the passes are read from the directory of the task.
func structured(t *testing.T, f *fixture, passes ...task.PRPass) {
	t.Helper()

	inPR(f, "task-1", plan(), task.PRReviewing)
	f.tasks.useDir("task-1", t.TempDir())
	f.tasks.setPRRun("task-1", task.PRRun{
		Status: task.PRReviewing, PR: openPR(), ReportedPass: len(passes), ReviewedCommit: startCommit,
	})
	f.tasks.setPRPasses("task-1", passes...)
	f.worktrees.setStatus(git.Status{Head: startCommit})
	f.sessions.setSummary("task-1", session.Summary{
		Stage: session.PRReviewStage, Status: session.StatusWaiting, Idle: true,
	})
}

// working makes the agent of the review work.
func working(f *fixture) {
	f.sessions.setSummary("task-1", session.Summary{
		Stage: session.PRReviewStage, Status: session.StatusWorking,
	})
}

// writeReport writes the report of a pass where the agent leaves it.
func writeReport(t *testing.T, f *fixture, pass int, content string) {
	t.Helper()

	tk, _ := f.tasks.Get("task-1")
	path := tk.ReviewPath(pass)
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		t.Fatalf("create pr folder: %v", err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write report %d: %v", pass, err)
	}
}

// reportOf is a report as the agent writes it: the verdict and one block per
// finding, each as "title | location | text".
func reportOf(status string, findings ...string) string {
	var b strings.Builder
	b.WriteString("---\nstatus: " + status + "\n---\n\nThe summary.\n")
	if len(findings) > 0 {
		b.WriteString("\n## Findings\n")
	}
	for i, spec := range findings {
		parts := strings.SplitN(spec, " | ", 3)
		b.WriteString("\n### " + strconv.Itoa(i+1) + " · " + parts[0] + "\nLocation: " + parts[1] + "\n\n" + parts[2] + "\n")
	}
	return b.String()
}

// currentPassOf is the current structured pass the fake holds.
func currentPassOf(t *testing.T, f *fixture) task.PRPass {
	t.Helper()

	passes := f.tasks.PRPasses("task-1")
	if len(passes) == 0 {
		t.Fatal("the task has no structured pass")
	}
	return passes[len(passes)-1]
}

// decisionsOf is what the user decided about the findings of a pass.
func decisionsOf(pass task.PRPass) []prreport.Decision {
	out := make([]prreport.Decision, 0, len(pass.Findings))
	for _, finding := range pass.Findings {
		out = append(out, finding.Decision)
	}
	return out
}

func TestAStructuredPassIsShownByItsReportAndWhatTheUserDecidedAboutIt(t *testing.T) {
	t.Parallel()

	merged, closed := openPR(), openPR()
	merged.State, closed.State = task.PRStateMerged, task.PRStateClosed
	trouble := gh.Trouble{FailedChecks: []string{"lint"}}
	reviewing := task.PRRun{Status: task.PRReviewing, PR: openPR()}
	with := func(run task.PRRun, mutate func(*task.PRRun)) task.PRRun {
		mutate(&run)
		return run
	}

	tests := []struct {
		name    string
		passes  []task.PRPass
		reports []task.ReviewReport
		run     task.PRRun
		paused  bool
		working bool
		snap    review.Snapshot
		read    bool
		want    flow.PRStatus
	}{
		{"asked, the agent works", []task.PRPass{askedPass(1)}, nil, reviewing, false, true, review.Snapshot{}, false, flow.PRReviewing},
		{"asked, the agent rests", []task.PRPass{askedPass(1)}, nil, reviewing, false, false, review.Snapshot{}, false, flow.PRAwaitingReply},
		{
			"recorded clean",
			[]task.PRPass{{Pass: 1, Recorded: true, Clean: true}},
			nil, reviewing,
			false, false,
			review.Snapshot{},
			false, flow.PRDone,
		},
		{
			"rewritten while the agent works",
			[]task.PRPass{decidedPass(1, approved, undecided)},
			nil, reviewing,
			false, true,
			review.Snapshot{},
			false, flow.PRReviewing,
		},
		{
			"partly decided",
			[]task.PRPass{decidedPass(1, approved, undecided)},
			nil, reviewing,
			false, false,
			review.Snapshot{},
			false, flow.PRAwaitingDecision,
		},
		{
			"partly decided with changes in the worktree",
			[]task.PRPass{decidedPass(1, discarded, undecided)},
			nil,
			reviewing, false, false, reviewed(1, 2), true, flow.PRAwaitingDecision,
		},
		{
			"decided with one approved",
			[]task.PRPass{decidedPass(1, approved, discarded)},
			nil, reviewing,
			false, false,
			review.Snapshot{},
			false, flow.PRAwaitingDecision,
		},
		{
			"decided with one approved and changes in the worktree",
			[]task.PRPass{decidedPass(1, approved, discarded)},
			nil,
			reviewing, false, false, reviewed(2, 2), true, flow.PRAwaitingDecision,
		},
		{
			"every finding discarded, nothing changed",
			[]task.PRPass{decidedPass(1, discarded, discarded)},
			nil, reviewing,
			false, false, reviewed(0, 0), true, flow.PRDone,
		},
		{
			"every finding discarded, the worktree not read",
			[]task.PRPass{decidedPass(1, discarded)},
			nil, reviewing,
			false, false,
			review.Snapshot{},
			false, flow.PRDone,
		},
		{
			"every finding discarded, the pull request merged",
			[]task.PRPass{decidedPass(1, discarded)},
			nil,
			with(reviewing, func(r *task.PRRun) { r.PR = merged }), false, false,
			review.Snapshot{},
			false, flow.PRMerged,
		},
		{
			"every finding discarded, the pull request closed",
			[]task.PRPass{decidedPass(1, discarded)},
			nil,
			with(reviewing, func(r *task.PRRun) { r.PR = closed }), false, false,
			review.Snapshot{},
			false, flow.PRClosedUnmerged,
		},
		{
			"every finding discarded, with trouble",
			[]task.PRPass{decidedPass(1, discarded)},
			nil,
			with(reviewing, func(r *task.PRRun) { r.Trouble = trouble }), false, false,
			review.Snapshot{},
			false, flow.PRTrouble,
		},
		{
			"every finding discarded, changes being reviewed",
			[]task.PRPass{decidedPass(1, discarded, discarded)},
			nil,
			reviewing, false, false, reviewed(1, 3), true, flow.PRInReview,
		},
		{
			"every finding discarded, changes reviewed",
			[]task.PRPass{decidedPass(1, discarded, discarded)},
			nil,
			reviewing, false, false, reviewed(3, 3), true, flow.PRReadyToApprove,
		},
		{
			"sent, the agent works",
			[]task.PRPass{sentPass(decidedPass(1, approved))},
			nil, reviewing,
			false, true, reviewed(0, 1), true, flow.PRReviewing,
		},
		{
			"sent, nothing changed",
			[]task.PRPass{sentPass(decidedPass(1, approved))},
			nil, reviewing,
			false, false, reviewed(0, 0), true, flow.PRInReview,
		},
		{
			"sent, the worktree not read",
			[]task.PRPass{sentPass(decidedPass(1, approved))},
			nil, reviewing,
			false, false,
			review.Snapshot{},
			false, flow.PRInReview,
		},
		{
			"sent, changes being reviewed",
			[]task.PRPass{sentPass(decidedPass(1, approved))},
			nil, reviewing,
			false, false, reviewed(1, 3), true, flow.PRInReview,
		},
		{
			"sent, changes reviewed",
			[]task.PRPass{sentPass(decidedPass(1, approved))},
			nil, reviewing,
			false, false, reviewed(3, 3), true, flow.PRReadyToApprove,
		},
		{
			"the next pass is the current one",
			[]task.PRPass{sentPass(decidedPass(1, approved)), askedPass(2)},
			nil,
			reviewing, false, false, reviewed(3, 3), true, flow.PRAwaitingReply,
		},
		{
			"the session is paused",
			[]task.PRPass{decidedPass(1, undecided)},
			nil, reviewing,
			true, false,
			review.Snapshot{},
			false, flow.PRAwaitingDecision,
		},
		{
			"the session is paused, every finding discarded",
			[]task.PRPass{decidedPass(1, discarded, discarded)},
			nil, reviewing,
			true, false, reviewed(0, 0), true, flow.PRDone,
		},
		{
			"the session is paused, sent with changes reviewed",
			[]task.PRPass{sentPass(decidedPass(1, approved))},
			nil, reviewing,
			true, false, reviewed(3, 3), true, flow.PRReadyToApprove,
		},
		{
			"the session is paused, the report not in yet",
			[]task.PRPass{askedPass(1)},
			nil, reviewing,
			true, false,
			review.Snapshot{},
			false, flow.PRReviewing,
		},
		{
			"a pass in text, the session paused", nil, reports(1, false), reviewing,
			true, false,
			review.Snapshot{},
			false, flow.PRReviewing,
		},
		{
			"a pass in text, with changes", nil, reports(1, false), reviewing,
			false, false,
			review.Snapshot{},
			false, flow.PRAwaitingDecision,
		},
		{
			"a pass in text, with changes reviewed", nil, reports(1, false), reviewing,
			false, false, reviewed(3, 3), true, flow.PRReadyToApprove,
		},
		{
			"a pass in text, clean", nil, reports(1, true), reviewing,
			false, false,
			review.Snapshot{},
			false, flow.PRDone,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			inPR(f, "task-1", plan(), task.PRReviewing)
			f.tasks.setPRRun("task-1", test.run)
			f.tasks.setPRPasses("task-1", test.passes...)
			f.tasks.setArtifacts("task-1", prArtifacts(task.PRArtifacts{Reports: test.reports}))
			summary := session.Summary{Stage: session.PRReviewStage, Status: session.StatusWaiting, Idle: true}
			switch {
			case test.working:
				summary.Status, summary.Idle = session.StatusWorking, false
			case test.paused:
				summary.Status, summary.Idle = session.StatusPaused, false
			}
			f.sessions.setSummary("task-1", summary)
			if test.read {
				f.reviews.setSnapshot(test.snap)
			}

			state := f.prState(t, "task-1")
			if state.Status != test.want {
				t.Errorf("status = %q, want %q", state.Status, test.want)
			}
			if got, want := len(state.Passes), len(test.passes); got != want {
				t.Errorf("passes = %d, want %d", got, want)
			}
			switch {
			case len(test.passes) == 0 && state.Pass != nil:
				t.Errorf("current pass = %+v, want none for a pass in text", state.Pass)
			case len(test.passes) > 0 && (state.Pass == nil || state.Pass.Pass != test.passes[len(test.passes)-1].Pass):
				t.Errorf("current pass = %+v, want the last one asked for", state.Pass)
			}
		})
	}
}

func TestWhatTheUserCannotDecideOutOfItsState(t *testing.T) {
	t.Parallel()

	merged := openPR()
	merged.State = task.PRStateMerged
	tests := []struct {
		name   string
		passes []task.PRPass
		run    task.PRRun
	}{
		{"no structured pass", nil, task.PRRun{Status: task.PRReviewing, PR: openPR()}},
		{"the report is not recorded", []task.PRPass{askedPass(1)}, task.PRRun{Status: task.PRReviewing, PR: openPR()}},
		{
			"the pass is clean",
			[]task.PRPass{{Pass: 1, Recorded: true, Clean: true}},
			task.PRRun{Status: task.PRReviewing, PR: openPR()},
		},
		{
			"the findings went to the agent",
			[]task.PRPass{sentPass(decidedPass(1, approved))},
			task.PRRun{Status: task.PRReviewing, PR: openPR()},
		},
		{
			"a newer pass was asked for",
			[]task.PRPass{decidedPass(1, approved), askedPass(2)},
			task.PRRun{Status: task.PRReviewing, PR: openPR()},
		},
		{
			"the pull request was merged",
			[]task.PRPass{decidedPass(1, discarded)},
			task.PRRun{Status: task.PRReviewing, PR: merged},
		},
		{
			"the commit is being made",
			[]task.PRPass{decidedPass(1, approved)},
			task.PRRun{Status: task.PRCommitting, PR: openPR()},
		},
		{
			"the next pass waits for the checks",
			[]task.PRPass{decidedPass(1, approved)},
			task.PRRun{Status: task.PRWaitingChecks, PR: openPR()},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			structured(t, f, test.passes...)
			f.tasks.setPRRun("task-1", test.run)
			number := 1
			before := f.tasks.PRPasses("task-1")

			ctx := t.Context()
			wantErrIs(t, f.service.DecidePRFinding(ctx, "task-1", number, 1, approved), flow.ErrNotDeciding)
			wantErrIs(t, f.service.SetPRFindingText(ctx, "task-1", number, 1, "Text."), flow.ErrNotDeciding)
			wantErrIs(t, f.service.ApproveRestOfPRFindings(ctx, "task-1", number), flow.ErrNotDeciding)
			wantErrIs(t, f.service.ApplyPRFindings(ctx, "task-1"), flow.ErrNotDeciding)
			if diff := cmp.Diff(before, f.tasks.PRPasses("task-1")); diff != "" {
				t.Errorf("passes changed (-before +after):\n%s", diff)
			}
			if sent := f.sessions.sent(); len(sent) != 0 {
				t.Errorf("sent = %q, want nothing", sent)
			}
		})
	}
}

func TestAPassThatIsNotTheCurrentOneCannotBeDecided(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, sentPass(decidedPass(1, approved)), recordedPass(2, reportedFinding(1)))

	wantErrIs(t, f.service.DecidePRFinding(t.Context(), "task-1", 1, 1, discarded), flow.ErrNotDeciding)
	if err := f.service.DecidePRFinding(t.Context(), "task-1", 2, 1, discarded); err != nil {
		t.Fatalf("DecidePRFinding() = %v, want the current pass decided", err)
	}
}

func TestTheUserDecidesEditsAndApprovesTheRestOfTheFindings(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		prepare func(*fixture)
	}{
		{"at rest", func(*fixture) {}},
		{"while the agent rewrites the report", working},
		{"with every finding discarded", func(f *fixture) {
			f.tasks.setPRPasses("task-1", decidedPass(1, discarded, discarded, discarded))
		}},
		{"with every finding discarded and trouble", func(f *fixture) {
			f.tasks.setPRPasses("task-1", decidedPass(1, discarded, discarded, discarded))
			f.tasks.setPRRun("task-1", task.PRRun{
				Status: task.PRReviewing, PR: openPR(), Trouble: gh.Trouble{FailedChecks: []string{"lint"}},
			})
		}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			structured(t, f, decidedPass(1, undecided, undecided, undecided))
			test.prepare(f)
			ctx := t.Context()

			if err := f.service.DecidePRFinding(ctx, "task-1", 1, 1, approved); err != nil {
				t.Fatalf("DecidePRFinding() = %v, want nil", err)
			}
			if err := f.service.SetPRFindingText(ctx, "task-1", 1, 2, "  Fix it this way.  "); err != nil {
				t.Fatalf("SetPRFindingText() = %v, want nil", err)
			}
			pass := currentPassOf(t, f)
			if got := pass.Findings[0].Decision; got != approved {
				t.Errorf("decision = %q, want approved", got)
			}
			if got := pass.Findings[1].Text; got != "Fix it this way." {
				t.Errorf("text = %q, want the trimmed text of the user", got)
			}

			wantErrIs(t, f.service.SetPRFindingText(ctx, "task-1", 1, 2, "  "), prreport.ErrEmptyText)
			if got := currentPassOf(t, f).Findings[1].Text; got != "Fix it this way." {
				t.Errorf("text = %q, want the last one saved", got)
			}
		})
	}
}

func TestAFindingARewriteRemovedCannotBeDecidedNorEdited(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, decidedPass(1, undecided))
	ctx := t.Context()

	wantErrIs(t, f.service.DecidePRFinding(ctx, "task-1", 1, 2, approved), flow.ErrFindingNotFound)
	wantErrIs(t, f.service.SetPRFindingText(ctx, "task-1", 1, 2, "Fix it."), flow.ErrFindingNotFound)

	// A task that is gone is not told as a finding that is gone.
	err := f.service.DecidePRFinding(ctx, "task-gone", 1, 1, approved)
	wantErrIs(t, err, task.ErrNotFound)
	if errors.Is(err, flow.ErrFindingNotFound) {
		t.Errorf("DecidePRFinding(task-gone) = %v, want no finding blamed", err)
	}
}

func TestApprovingTheRestOfTheFindingsLeavesTheDecidedOnesAsTheyAre(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, decidedPass(1, undecided, discarded, undecided))

	if err := f.service.ApproveRestOfPRFindings(t.Context(), "task-1", 1); err != nil {
		t.Fatalf("ApproveRestOfPRFindings() = %v, want nil", err)
	}

	want := []prreport.Decision{approved, discarded, approved}
	if diff := cmp.Diff(want, decisionsOf(currentPassOf(t, f))); diff != "" {
		t.Errorf("decisions mismatch (-want +got):\n%s", diff)
	}
}

func TestApplyingTheFindingsSendsTheApprovedAndTheDiscardedOnes(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, decidedPass(1, approved, discarded, approved))
	if err := f.service.SetPRFindingText(t.Context(), "task-1", 1, 3, "Do it my way."); err != nil {
		t.Fatalf("SetPRFindingText() = %v, want nil", err)
	}

	if err := f.service.ApplyPRFindings(t.Context(), "task-1"); err != nil {
		t.Fatalf("ApplyPRFindings() = %v, want nil", err)
	}

	pass := currentPassOf(t, f)
	if !pass.Sent() {
		t.Error("the pass is not marked as sent")
	}
	if want := prreport.ApplyMessage(1, pass.Findings); !slices.Equal(f.sessions.sent(), []string{want}) {
		t.Errorf("sent = %q, want the message of the findings", f.sessions.sent())
	}
	for _, want := range []string{"### 3 · Finding 3", "Do it my way.", "## Discarded findings", "- 2 · Finding 2"} {
		if sent := f.sessions.sent(); len(sent) != 1 || !strings.Contains(sent[0], want) {
			t.Errorf("sent = %q, want it to contain %q", sent, want)
		}
	}
	if diff := cmp.Diff([]session.AppMessage{{Kind: session.AppApply, Count: 2}}, f.sessions.sentApps()); diff != "" {
		t.Errorf("app messages mismatch (-want +got):\n%s", diff)
	}
	wantMarkers := []keyedMarker{{
		Key:    reviewKeyOf,
		Marker: session.MarkerEntry{Type: session.MarkerFindingsDecided, Pass: 1, Approved: 2, Discarded: 1},
	}}
	if diff := cmp.Diff(wantMarkers, f.sessions.marked(session.MarkerFindingsDecided)); diff != "" {
		t.Errorf("findings_decided markers mismatch (-want +got):\n%s", diff)
	}
	if got := f.prState(t, "task-1").Status; got != flow.PRReviewing {
		t.Errorf("status = %q, want reviewing: the agent works on what was approved", got)
	}
}

func TestApplyingTheFindingsRefusesWhatIsNotReadyAndWritesNothing(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		pass task.PRPass
		busy bool
		want error
	}{
		{"a finding is still to decide", decidedPass(1, approved, undecided), false, flow.ErrNotDecided},
		{"nothing is approved", decidedPass(1, discarded, discarded), false, flow.ErrNothingApproved},
		{"the agent is working", decidedPass(1, approved), true, flow.ErrStepBusy},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			structured(t, f, test.pass)
			if test.busy {
				working(f)
			}

			wantErrIs(t, f.service.ApplyPRFindings(t.Context(), "task-1"), test.want)

			if currentPassOf(t, f).Sent() {
				t.Error("the pass is marked as sent, want nothing written")
			}
			if sent := f.sessions.sent(); len(sent) != 0 {
				t.Errorf("sent = %q, want nothing", sent)
			}
			if marked := f.sessions.marked(session.MarkerFindingsDecided); len(marked) != 0 {
				t.Errorf("findings_decided markers = %v, want none", marked)
			}
		})
	}
}

func TestApplyingTheFindingsResumesAPausedSession(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, decidedPass(1, approved))
	f.sessions.setSummary("task-1", session.Summary{Stage: session.PRReviewStage, Status: session.StatusPaused})

	if err := f.service.ApplyPRFindings(t.Context(), "task-1"); err != nil {
		t.Fatalf("ApplyPRFindings() = %v, want nil", err)
	}

	if !slices.Contains(f.sessions.recorded(), "resume:task-1:pr_review") {
		t.Errorf("session calls = %q, want the session resumed", f.sessions.recorded())
	}
	if len(f.sessions.sent()) != 1 {
		t.Errorf("sent = %q, want the message of the findings", f.sessions.sent())
	}
}

func TestAFailedSendOfTheFindingsGivesTheDecisionBackAndARetryRecordsItOnce(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, decidedPass(1, approved, discarded))

	f.sessions.failWith(errors.New("the process is gone"))
	if err := f.service.ApplyPRFindings(t.Context(), "task-1"); err == nil {
		t.Fatal("ApplyPRFindings() = nil, want the failure of the send")
	}
	if currentPassOf(t, f).Sent() {
		t.Error("the pass is marked as sent after a send that failed")
	}
	if marked := f.sessions.marked(session.MarkerFindingsDecided); len(marked) != 1 {
		t.Errorf("findings_decided markers = %v, want the one the failed send left", marked)
	}

	f.sessions.failWith(nil)
	if err := f.service.ApplyPRFindings(t.Context(), "task-1"); err != nil {
		t.Fatalf("ApplyPRFindings() again = %v, want nil", err)
	}
	if !currentPassOf(t, f).Sent() {
		t.Error("the pass is not marked as sent after the retry")
	}
	if marked := f.sessions.marked(session.MarkerFindingsDecided); len(marked) != 1 {
		t.Errorf("findings_decided markers = %v, want the decision recorded once", marked)
	}
}

func TestApprovingTheChangesOfAStructuredPass(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		pass task.PRPass
		want error
	}{
		{"findings still to decide", decidedPass(1, discarded, undecided), flow.ErrStepNotReady},
		{"a finding approved and not sent", decidedPass(1, approved, discarded), flow.ErrStepNotReady},
		{"the report is not recorded", askedPass(1), flow.ErrStepNotReady},
		{"the pass is clean", task.PRPass{Pass: 1, Recorded: true, Clean: true}, flow.ErrStepNotReady},
		{"every finding discarded", decidedPass(1, discarded, discarded), nil},
		{"the approved findings were sent", sentPass(decidedPass(1, approved, discarded)), nil},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			structured(t, f, test.pass)
			f.reviews.setSnapshot(staged(3, 3))

			err := f.service.ApprovePR(t.Context(), "task-1")

			if test.want != nil {
				wantErrIs(t, err, test.want)
				return
			}
			if err != nil {
				t.Fatalf("ApprovePR() = %v, want nil", err)
			}
			if run, _ := f.tasks.prRun("task-1"); run.Status != task.PRCommitting {
				t.Errorf("status = %q, want committing", run.Status)
			}
		})
	}
}

func TestTheReportOfAStructuredPassIsRecordedWhenTheAgentRests(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, askedPass(1))
	f.service.Sync(t.Context())
	writeReport(t, f, 1, reportOf("changes",
		"First | internal/a.go:3 | The first.",
		"Second | internal/b.go:9 | The second.",
	))
	f.service.Check("task-1")

	waitFor(t, "the report to be recorded", func() bool { return currentPassOf(t, f).Recorded })

	pass := currentPassOf(t, f)
	if pass.Clean || len(pass.Findings) != 2 || pass.Revision != 1 || pass.SummaryOriginal != "The summary." {
		t.Errorf("pass = %+v, want the report with two findings, first revision", pass)
	}
	run, _ := f.tasks.prRun("task-1")
	if run.ReportedPass != 1 || run.ReviewedCommit != startCommit {
		t.Errorf("run = %+v, want the pass reported on the commit the branch is on", run)
	}
	findings := 2
	want := []keyedMarker{{
		Key:    reviewKeyOf,
		Marker: session.MarkerEntry{Type: session.MarkerPRReviewWritten, Pass: 1, Findings: &findings},
	}}
	if diff := cmp.Diff(want, f.sessions.marked(session.MarkerPRReviewWritten)); diff != "" {
		t.Errorf("pr_review_written markers mismatch (-want +got):\n%s", diff)
	}
	waitFor(t, "the pass to wait for the decision", func() bool {
		return f.prState(t, "task-1").Status == flow.PRAwaitingDecision
	})
}

func TestAReportThatCannotBeRecordedIsRecordedByTheNextEvaluationOnItsCommit(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, askedPass(1))
	f.tasks.setPRRun("task-1", task.PRRun{Status: task.PRReviewing, PR: openPR()})
	f.tasks.failRecord(errStart)
	writeReport(t, f, 1, reportOf("changes", "First | internal/a.go:3 | The first."))

	before := f.tasks.inspectCount()
	f.service.Check("task-1")
	f.waitEvaluated(t, "task-1", before)
	if currentPassOf(t, f).Recorded {
		t.Fatal("the report is recorded, want the record to have failed")
	}
	if run, _ := f.tasks.prRun("task-1"); run.ReportedPass != 1 || run.ReviewedCommit != startCommit {
		t.Fatalf("run = %+v, want the pass reported on the commit the report covered", run)
	}

	// The branch moved before the report could be recorded.
	f.worktrees.setStatus(git.Status{Head: commitSHA})
	f.tasks.failRecord(nil)
	f.service.Check("task-1")

	waitFor(t, "the report to be recorded", func() bool { return currentPassOf(t, f).Recorded })
	if run, _ := f.tasks.prRun("task-1"); run.ReportedPass != 1 || run.ReviewedCommit != startCommit {
		t.Errorf("run = %+v, want the commit recorded first kept", run)
	}
	findings := 1
	want := []keyedMarker{{
		Key:    reviewKeyOf,
		Marker: session.MarkerEntry{Type: session.MarkerPRReviewWritten, Pass: 1, Findings: &findings},
	}}
	if diff := cmp.Diff(want, f.sessions.marked(session.MarkerPRReviewWritten)); diff != "" {
		t.Errorf("pr_review_written markers mismatch (-want +got):\n%s", diff)
	}
}

func TestTheReportOfAStructuredPassIsNotRecordedWhileTheAgentWorks(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, askedPass(1))
	working(f)
	writeReport(t, f, 1, reportOf("changes", "First | internal/a.go:3 | The first."))

	before := f.tasks.inspectCount()
	f.service.Check("task-1")
	f.waitEvaluated(t, "task-1", before)

	if currentPassOf(t, f).Recorded {
		t.Error("the pass is recorded while the agent still works")
	}
}

func TestAReportTheParserRefusesLeavesThePassWaitingForAReplyWithTheReason(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, askedPass(1))
	writeReport(t, f, 1, "---\nstatus: maybe\n---\n\nThe summary.\n")
	f.service.Check("task-1")

	waitFor(t, "the reason the report can't be read", func() bool { return f.prState(t, "task-1").Unreadable != "" })

	state := f.prState(t, "task-1")
	if !strings.HasPrefix(state.Unreadable, "The report can't be read: ") {
		t.Errorf("unreadable = %q, want the reason in the words of the product", state.Unreadable)
	}
	if state.Status != flow.PRAwaitingReply {
		t.Errorf("status = %q, want awaiting_reply", state.Status)
	}
	if currentPassOf(t, f).Recorded {
		t.Error("the pass is recorded, want nothing written")
	}

	writeReport(t, f, 1, reportOf("changes", "First | internal/a.go:3 | The first."))
	f.service.Check("task-1")
	waitFor(t, "the report to be recorded", func() bool { return currentPassOf(t, f).Recorded })
	if got := f.prState(t, "task-1").Unreadable; got != "" {
		t.Errorf("unreadable = %q, want it cleared by a readable report", got)
	}
}

func TestACleanReportOfAStructuredPassClosesTheReview(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, askedPass(1))
	writeReport(t, f, 1, reportOf("clean"))
	f.service.Check("task-1")

	f.waitPRRun(t, "the pull request to be done", func(run task.PRRun) bool { return run.Status == task.PRDone })
	waitFor(t, "the review session to be closed", func() bool {
		return slices.Contains(f.sessions.recorded(), "close:task-1:pr_review")
	})
}

func TestARewrittenReportKeepsTheDecisionsOfTheFindingsThatDidNotChange(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, askedPass(1))
	first := reportOf("changes",
		"First | internal/a.go:3 | The first.",
		"Second | internal/b.go:9 | The second.",
	)
	writeReport(t, f, 1, first)
	f.service.Check("task-1")
	waitFor(t, "the report to be recorded", func() bool { return currentPassOf(t, f).Recorded })
	for _, number := range []int{1, 2} {
		if err := f.service.DecidePRFinding(t.Context(), "task-1", 1, number, approved); err != nil {
			t.Fatalf("DecidePRFinding(%d) = %v, want nil", number, err)
		}
	}

	// The same report again says nothing new.
	before := f.tasks.inspectCount()
	f.service.Check("task-1")
	f.waitEvaluated(t, "task-1", before)
	if got := currentPassOf(t, f).Revision; got != 1 {
		t.Errorf("revision = %d, want the same report to change nothing", got)
	}

	writeReport(t, f, 1, reportOf("changes",
		"First | internal/a.go:3 | The first.",
		"Second, reworded | internal/b.go:9 | The second, in other words.",
		"Third | internal/c.go:1 | The third.",
	))
	f.service.Check("task-1")
	waitFor(t, "the report to be read again", func() bool { return currentPassOf(t, f).Revision == 2 })

	pass := currentPassOf(t, f)
	if diff := cmp.Diff([]prreport.Decision{approved, undecided, undecided}, decisionsOf(pass)); diff != "" {
		t.Errorf("decisions mismatch (-want +got):\n%s", diff)
	}
	findings := 3
	want := []keyedMarker{{
		Key:    reviewKeyOf,
		Marker: session.MarkerEntry{Type: session.MarkerPRReviewRevised, Pass: 1, Findings: &findings},
	}}
	if diff := cmp.Diff(want, f.sessions.marked(session.MarkerPRReviewRevised)); diff != "" {
		t.Errorf("pr_review_revised markers mismatch (-want +got):\n%s", diff)
	}
}

func TestARewrittenReportTheParserRefusesLeavesWhatWasRecordedAndSaysWhy(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, askedPass(1))
	writeReport(t, f, 1, reportOf("changes", "First | internal/a.go:3 | The first."))
	f.service.Check("task-1")
	waitFor(t, "the report to be recorded", func() bool { return currentPassOf(t, f).Recorded })

	writeReport(t, f, 1, "---\nstatus: maybe\n---\n")
	f.service.Check("task-1")
	waitFor(t, "the reason the rewrite can't be read", func() bool { return f.prState(t, "task-1").Unreadable != "" })

	state := f.prState(t, "task-1")
	if pass := currentPassOf(t, f); pass.Revision != 1 || len(pass.Findings) != 1 {
		t.Errorf("pass = %+v, want what was recorded", pass)
	}
	if state.Status != flow.PRAwaitingDecision {
		t.Errorf("status = %q, want the decision still open", state.Status)
	}
}

func TestAReportRewrittenCleanClosesTheReview(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, askedPass(1))
	writeReport(t, f, 1, reportOf("changes", "First | internal/a.go:3 | The first."))
	f.service.Check("task-1")
	waitFor(t, "the report to be recorded", func() bool { return currentPassOf(t, f).Recorded })

	writeReport(t, f, 1, reportOf("clean"))
	f.service.Check("task-1")

	f.waitPRRun(t, "the pull request to be done", func(run task.PRRun) bool { return run.Status == task.PRDone })
}

func TestAPassWithEveryFindingDiscardedEndsWithThePullRequestMergedOrClosed(t *testing.T) {
	t.Parallel()

	merged, closed := openPR(), openPR()
	merged.State, closed.State = task.PRStateMerged, task.PRStateClosed
	tests := []struct {
		name string
		pr   task.PRDetails
		want flow.PRStatus
	}{
		{"merged", merged, flow.PRMerged},
		{"closed", closed, flow.PRClosedUnmerged},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			structured(t, f, decidedPass(1, discarded, discarded))
			f.tasks.setPRRun("task-1", task.PRRun{Status: task.PRReviewing, PR: test.pr, ReportedPass: 1})

			f.service.Check("task-1")

			f.waitPRRun(t, "the pull request to be done", func(run task.PRRun) bool { return run.Status == task.PRDone })
			waitFor(t, "the review session to be closed", func() bool {
				return slices.Contains(f.sessions.recorded(), "close:task-1:pr_review")
			})
			f.waitPR(t, "task-1", test.want)
		})
	}
}

func TestAPassWithEveryFindingDiscardedIsReadFromGitHubLikeAClosedReview(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, decidedPass(1, discarded, discarded))
	f.gh.setPR("task-1", samePR)

	f.service.PollPRs()
	waitFor(t, "the pull request to be read", func() bool { return f.gh.viewCount("task-1") > 0 })

	f.gh.setPR("task-1", gh.PR{Number: 7, URL: samePR.URL, State: gh.StateMerged})
	if err := f.service.RefreshPR(t.Context(), "task-1"); err != nil {
		t.Fatalf("RefreshPR() = %v, want nil", err)
	}
	f.waitPRRun(t, "the merge to be recorded", func(run task.PRRun) bool { return run.PR.State == task.PRStateMerged })
}

func TestAPassWithEveryFindingDiscardedIsReadFromGitHubWhenTheAppStarts(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, decidedPass(1, discarded, discarded))
	f.gh.setPR("task-1", gh.PR{Number: 7, URL: samePR.URL, State: gh.StateMerged})

	f.service.Sync(t.Context())

	// The merge may have happened while the app was closed.
	f.waitPRRun(t, "the merge to be recorded", func(run task.PRRun) bool { return run.PR.State == task.PRStateMerged })
}

func TestAPassWithFindingsStillOpenIsNotReadFromGitHubOnTheTimer(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, decidedPass(1, discarded, undecided))
	f.gh.setPR("task-1", samePR)

	f.service.PollPRs()
	before := f.tasks.inspectCount()
	f.service.Check("task-1")
	f.waitEvaluated(t, "task-1", before)

	if got := f.gh.viewCount("task-1"); got != 0 {
		t.Errorf("readings of the pull request = %d, want none", got)
	}
}

func TestATaskWhoseFindingsWereAllDiscardedCanBeClosedOnceMerged(t *testing.T) {
	t.Parallel()

	merged := openPR()
	merged.State = task.PRStateMerged
	tests := []struct {
		name string
		pr   task.PRDetails
		want error
	}{
		{"merged", merged, nil},
		{"still open", openPR(), flow.ErrPRNotMerged},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			structured(t, f, decidedPass(1, discarded))
			f.tasks.setPRRun("task-1", task.PRRun{Status: task.PRReviewing, PR: test.pr, ReportedPass: 1})

			err := f.service.CloseTask(t.Context(), "task-1")

			if test.want != nil {
				wantErrIs(t, err, test.want)
				return
			}
			if err != nil {
				t.Fatalf("CloseTask() = %v, want nil", err)
			}
		})
	}
}

func TestATaskWhoseFindingsAreStillOpenCannotBeClosed(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, decidedPass(1, discarded, undecided))

	wantErrIs(t, f.service.CloseTask(t.Context(), "task-1"), flow.ErrNotClosable)
}

func TestTearingDownThePullRequestForgetsItsStructuredPasses(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.setTaskMode("task-1", task.ModeOneShot)
	inPR(f, "task-1", oneShotPlan(), task.PRReviewing)
	f.tasks.setArtifacts("task-1", task.Artifacts{OneShot: true, Plan: oneShotPlan()})
	f.tasks.setStepRun("task-1", task.StepRun{Number: 1, Status: task.StepDone, CommitSHA: commitSHA})
	f.tasks.setStepReports("task-1", 1, stepReport(1, 1, true))
	f.tasks.setPRRun("task-1", task.PRRun{Status: task.PRReviewing, ReportedPass: 1})
	f.tasks.setPRPasses("task-1", decidedPass(1, discarded))
	f.tasks.useDir("task-1", t.TempDir())
	f.sessions.setSummary("task-1", session.Summary{
		Stage: session.PRReviewStage, Status: session.StatusWaiting, Idle: true,
	})
	writeReport(t, f, 1, "---\nstatus: maybe\n---\n\nThe summary.\n")
	f.service.Check("task-1")
	waitFor(t, "the reason the report can't be read", func() bool { return f.prState(t, "task-1").Unreadable != "" })

	if err := f.service.Back(t.Context(), "task-1", task.StageOneShot); err != nil {
		t.Fatalf("Back() = %v, want nil", err)
	}

	if passes := f.tasks.PRPasses("task-1"); len(passes) != 0 {
		t.Errorf("passes = %+v, want them cleared with the pull request", passes)
	}
	// A PR stage started again shows nothing of the report this one could not read.
	f.tasks.setPRRun("task-1", task.PRRun{Status: task.PRReviewing})
	f.tasks.setPRPasses("task-1", askedPass(1))
	if got := f.prState(t, "task-1").Unreadable; got != "" {
		t.Errorf("unreadable = %q, want it cleared with the pull request", got)
	}
}

// passRows is how many times the fake of the tasks was asked to record the
// start of a pass, and to forget it.
func passRows(f *fixture) (asked, unasked int) {
	for _, call := range f.tasks.recorded() {
		switch {
		case strings.HasPrefix(call, "askPRPass:"):
			asked++
		case strings.HasPrefix(call, "unaskPRPass:"):
			unasked++
		}
	}
	return asked, unasked
}

func TestTheReviewOfATaskStartsWithAStructuredPass(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	underReview(t, f)

	passes := f.tasks.PRPasses("task-1")
	if len(passes) != 1 || passes[0].Pass != 1 || passes[0].Recorded {
		t.Errorf("passes = %+v, want the first pass asked for and not recorded", passes)
	}
	info, _ := f.sessions.info(reviewKeyOf)
	if info.ReviewPath != f.reviewPath(1) {
		t.Errorf("review path = %q, want %q", info.ReviewPath, f.reviewPath(1))
	}
}

func TestAReviewThatCannotStartLeavesNoPassBehind(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	tk := f.tasks.add("task-1", task.StagePR, prArtifacts(task.PRArtifacts{}))
	f.tasks.useDir("task-1", t.TempDir())
	f.worktrees.seed(tk)
	f.worktrees.setStatus(git.Status{Head: startCommit})
	f.tasks.setPRRun("task-1", task.PRRun{Status: task.PRReviewing, PR: openPR()})
	f.gh.setPR("task-1", samePR)
	f.sessions.failWith(errStart)

	f.service.Check("task-1")
	waitFor(t, "the pass to be forgotten", func() bool {
		asked, unasked := passRows(f)
		return asked == 1 && unasked == 1
	})
	if passes := f.tasks.PRPasses("task-1"); len(passes) != 0 {
		t.Errorf("passes = %+v, want none", passes)
	}
}

func TestThePassAfterACommitIsStructuredAndForgottenWhenItCannotBeSent(t *testing.T) {
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

	// The agent committed, but the app cannot reach it to ask for the pass.
	f.sessions.failWith(errStart)
	f.worktrees.setStatus(git.Status{Head: commitSHA})
	f.reviews.setSnapshot(review.Snapshot{Head: commitSHA})
	f.sessions.goIdle("task-1")
	f.service.Check("task-1")

	waitFor(t, "the second pass to be forgotten", func() bool {
		asked, unasked := passRows(f)
		return asked == 2 && unasked >= 1
	})
	passes := f.tasks.PRPasses("task-1")
	if len(passes) != 1 || passes[0].Pass != 1 {
		t.Errorf("passes = %+v, want only the first pass", passes)
	}
	if f.sessions.sentCount(reviewPrompt(f.reviewPath(2))) != 0 {
		t.Error("the second pass was sent, want the send to have failed")
	}
}

func TestThePassAfterACommitOfAPassInTextIsStructured(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	inPR(f, "task-1", plan(), task.PRReviewing)
	f.tasks.useDir("task-1", t.TempDir())
	f.tasks.setArtifacts("task-1", prArtifacts(task.PRArtifacts{Reports: reports(1, false)}))
	f.tasks.setPRRun("task-1", task.PRRun{
		Status: task.PRReviewing, PR: openPR(), ReportedPass: 1, ReviewedCommit: startCommit,
	})
	f.worktrees.setStatus(git.Status{Head: startCommit})
	f.sessions.setSummary("task-1", session.Summary{
		Stage: session.PRReviewStage, Status: session.StatusWaiting, Idle: true,
	})
	f.gh.setPR("task-1", samePR)
	f.service.Sync(t.Context())
	f.reviews.setSnapshot(staged(3, 3))
	f.sessions.goIdle("task-1")
	if err := f.service.ApprovePR(t.Context(), "task-1"); err != nil {
		t.Fatalf("ApprovePR() = %v, want nil", err)
	}

	f.worktrees.setStatus(git.Status{Head: commitSHA})
	f.reviews.setSnapshot(review.Snapshot{Head: commitSHA})
	f.sessions.goIdle("task-1")
	f.service.Check("task-1")

	waitFor(t, "the prompt of the second pass", func() bool {
		return f.sessions.sentCount(reviewPrompt(f.reviewPath(2))) > 0
	})
	passes := f.tasks.PRPasses("task-1")
	if len(passes) != 1 || passes[0].Pass != 2 || passes[0].Recorded {
		t.Errorf("passes = %+v, want the second pass asked for in the structured format", passes)
	}
}

func TestReviewingAgainAfterAnUnreadableReportReplacesThePassNotRecorded(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, askedPass(1))
	f.tasks.setPRRun("task-1", task.PRRun{Status: task.PRReviewing, PR: openPR(), ReviewedCommit: startCommit})
	f.service.Sync(t.Context())
	writeReport(t, f, 1, "---\nstatus: maybe\n---\n\nThe summary.\n")
	f.service.Check("task-1")
	waitFor(t, "the reason the report can't be read", func() bool { return f.prState(t, "task-1").Unreadable != "" })
	f.gh.setPR("task-1", withChecks(noChecks()))

	if err := f.service.ReviewAgain(t.Context(), "task-1"); err != nil {
		t.Fatalf("ReviewAgain() = %v, want nil", err)
	}

	waitFor(t, "the pass to be asked for again", func() bool {
		asked, _ := passRows(f)
		return asked == 1 && f.prState(t, "task-1").Unreadable == ""
	})
	passes := f.tasks.PRPasses("task-1")
	if len(passes) != 1 || passes[0].Pass != 1 || passes[0].Recorded {
		t.Errorf("passes = %+v, want the first pass replaced and not recorded", passes)
	}
}

func TestReviewingAgainAfterAReportThatCouldNotBeRecordedAsksTheNextPass(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, askedPass(1))
	f.tasks.setPRRun("task-1", task.PRRun{Status: task.PRReviewing, PR: openPR()})
	f.service.Sync(t.Context())
	f.tasks.failRecord(errStart)
	writeReport(t, f, 1, reportOf("changes", "First | internal/a.go:3 | The first."))
	f.service.Check("task-1")
	f.waitPRRun(t, "the pass to be reported", func(run task.PRRun) bool { return run.ReportedPass == 1 })
	f.gh.setPR("task-1", withChecks(noChecks()))

	if err := f.service.ReviewAgain(t.Context(), "task-1"); err != nil {
		t.Fatalf("ReviewAgain() = %v, want nil", err)
	}

	waitFor(t, "the second pass to be asked for", func() bool {
		return currentPassOf(t, f).Pass == 2
	})
	if pass := currentPassOf(t, f); pass.Recorded {
		t.Errorf("pass = %+v, want the second pass asked for and not recorded", pass)
	}
}
