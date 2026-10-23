package flow_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/divergence"
	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

// changedPass is a pass sent to the implementer whose work changed the worktree.
func changedPass(pass task.PRPass) task.PRPass {
	pass = sentPass(pass)
	pass.Changed = true
	return pass
}

// unmoved is a reading of the worktree on the commit the pass covered.
func unmoved(total int) review.Snapshot {
	return staged(total, total)
}

// passingChecks is a reading of GitHub with one check that passed.
func passingChecks() gh.PRChecks {
	return gh.PRChecks{
		Checks:    []gh.Check{{Name: "test", Conclusion: "success", State: gh.CheckPassed}},
		Mergeable: gh.MergeableClean,
	}
}

// failingChecks is a reading of GitHub with one check that failed.
func failingChecks() gh.PRChecks {
	return gh.PRChecks{
		Checks:    []gh.Check{{Name: "test", Conclusion: "failure", State: gh.CheckFailed}},
		Mergeable: gh.MergeableClean,
	}
}

func TestPRResolved(t *testing.T) {
	t.Parallel()

	clean := recordedPass(1)
	clean.Clean = true
	tests := []struct {
		name string
		pass task.PRPass
		want bool
	}{
		{"not recorded", askedPass(1), false},
		{"clean", clean, false},
		{"every finding discarded", decidedPass(1, discarded, discarded), true},
		{"a finding still to decide", decidedPass(1, discarded, undecided), false},
		{"approved, not sent", decidedPass(1, approved), false},
		{"approved, sent, nothing changed", sentPass(decidedPass(1, approved)), false},
		{"approved, sent, changed", changedPass(decidedPass(1, approved, discarded)), true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if got := flow.PRResolved(test.pass); got != test.want {
				t.Errorf("prResolved() = %v, want %v", got, test.want)
			}
		})
	}
}

func TestChecksGreen(t *testing.T) {
	t.Parallel()

	conflicting := noChecks()
	conflicting.Mergeable = gh.MergeableConflicting
	tests := []struct {
		name   string
		checks gh.PRChecks
		want   bool
	}{
		{"no checks", noChecks(), true},
		{"a check running", pendingChecks(), false},
		{"a check failed", failingChecks(), false},
		{"a conflict", conflicting, false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if got := flow.ChecksGreen(test.checks); got != test.want {
				t.Errorf("checksGreen() = %v, want %v", got, test.want)
			}
		})
	}
}

func TestAnApprovedPassThatChangedAFileIsRecordedAsChanged(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, sentPass(decidedPass(1, approved)))
	implementerAtRest(f)
	f.reviews.setSnapshot(unmoved(2))

	f.service.Check("task-1")

	waitFor(t, "the pass to be recorded as changed", func() bool { return currentPassOf(t, f).Changed })
	f.wantNoDivergence(t)
}

func TestAnApprovedPassThatChangedNothingIsADivergence(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, sentPass(decidedPass(1, approved, approved, discarded)))
	implementerAtRest(f)
	f.reviews.setSnapshot(unmoved(0))

	f.service.Check("task-1")

	f.waitDivergence(t, divergence.KindNoChanges)
	f.wantDivergence(t, session.PRFixStage, divergence.KindNoChanges, divergence.Facts{Pass: 1, Approved: 2})
	if got := f.prState(t, "task-1").Status; got != flow.PRDiverged {
		t.Errorf("status = %q, want diverged", got)
	}
	if currentPassOf(t, f).Changed {
		t.Error("the pass is changed, want it not")
	}
}

func TestAPassIsNotJudgedWhileTheImplementerWorks(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, sentPass(decidedPass(1, approved)))
	f.sessions.setSummary("task-1", session.Summary{Stage: session.PRFixStage, Status: session.StatusWorking})
	f.reviews.setSnapshot(unmoved(0))
	before := f.tasks.inspectCount()

	f.service.Check("task-1")
	f.waitEvaluated(t, "task-1", before)

	f.wantNoDivergence(t)
}

func TestAskingAgainAfterNoFileChangedSendsTheApprovedFindingsOnce(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, sentPass(decidedPass(1, approved, discarded)))
	implementerAtRest(f)
	f.reviews.setSnapshot(unmoved(0))
	f.service.Check("task-1")
	f.waitDivergence(t, divergence.KindNoChanges)

	if err := f.service.AskAgain(t.Context(), "task-1"); err != nil {
		t.Fatalf("AskAgain() = %v, want nil", err)
	}

	f.wantNoDivergence(t)
	apps := f.sessions.sentApps()
	if len(apps) != 1 || apps[0].Kind != session.AppApply || apps[0].Count != 1 {
		t.Errorf("app messages = %+v, want the approved findings sent once", apps)
	}
	if !currentPassOf(t, f).Sent() {
		t.Error("the pass is not sent, want it still sent")
	}
}

func TestContinuingWithoutChangesEndsTheReviewReady(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, sentPass(decidedPass(1, approved)))
	implementerAtRest(f)
	f.reviews.setSnapshot(unmoved(0))
	f.service.Check("task-1")
	f.waitDivergence(t, divergence.KindNoChanges)

	if err := f.service.Adopt(t.Context(), "task-1", ""); err != nil {
		t.Fatalf("Adopt() = %v, want nil", err)
	}

	f.wantNoDivergence(t)
	if !currentPassOf(t, f).Changed {
		t.Error("the pass is not changed, want it adopted as applied")
	}
	f.waitPRStatus(t, "task-1", task.PRDone)
}

func TestAnApprovedFindingUndoneEndsTheReviewReady(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, sentPass(decidedPass(1, approved)))
	implementerAtRest(f)
	f.reviews.setSnapshot(unmoved(2))
	f.service.Check("task-1")
	waitFor(t, "the pass to be recorded as changed", func() bool { return currentPassOf(t, f).Changed })

	// The user undoes the changes of the implementer.
	f.reviews.setSnapshot(unmoved(0))
	f.service.Check("task-1")

	f.waitPRStatus(t, "task-1", task.PRDone)
	if got := f.prState(t, "task-1").Status; got != flow.PRDone {
		t.Errorf("status = %q, want done", got)
	}
}

func TestAResolvedPassDoesNotEndTheReviewWhileSomethingIsLeft(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		setup func(f *fixture)
	}{
		{"changes in the worktree", func(f *fixture) { dirtyWorktree(f) }},
		{"a merge under way", func(f *fixture) { f.worktrees.setMerging(true) }},
		{"a commit the remote refuses", func(f *fixture) {
			f.worktrees.setNotPushed(true)
			f.worktrees.failPush(pushRejected())
		}},
		{"a commit no pass covered", func(f *fixture) {
			f.worktrees.setStatus(git.Status{Head: commitSHA})
		}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			structured(t, f, changedPass(decidedPass(1, approved)))
			implementerAtRest(f)
			f.reviews.setSnapshot(unmoved(0))
			test.setup(f)
			before := f.tasks.inspectCount()

			f.service.Check("task-1")
			f.waitEvaluated(t, "task-1", before)

			if run, _ := f.tasks.prRun("task-1"); run.Status == task.PRDone {
				t.Errorf("status = %q, want the review to go on", run.Status)
			}
		})
	}
}

func TestACommitOfAResolvedPassWithGreenChecksEndsTheReviewWithoutAPass(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, changedPass(decidedPass(1, approved)))
	implementerAtRest(f)
	f.reviews.setSnapshot(review.Snapshot{Head: commitSHA})
	f.worktrees.setStatus(git.Status{Head: commitSHA})
	f.gh.setPR("task-1", withChecks(passingChecks()))

	f.service.Check("task-1")

	f.waitPRRun(t, "the review to end", func(run task.PRRun) bool { return run.Status == task.PRDone })
	run, _ := f.tasks.prRun("task-1")
	if run.ReviewedCommit != commitSHA {
		t.Errorf("reviewed commit = %q, want the commit covered", run.ReviewedCommit)
	}
	if run.ReportedPass != 1 {
		t.Errorf("reported pass = %d, want no pass asked", run.ReportedPass)
	}
	if got := f.sessions.sentCount(reviewPrompt(f.reviewPath(2))); got != 0 {
		t.Errorf("review prompts of the second pass = %d, want none", got)
	}
}

func TestACommitOfAResolvedPassWithAFailedCheckAsksAPass(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, changedPass(decidedPass(1, approved)))
	implementerAtRest(f)
	f.reviews.setSnapshot(review.Snapshot{Head: commitSHA})
	f.worktrees.setStatus(git.Status{Head: commitSHA})
	f.gh.setPR("task-1", withChecks(failingChecks()))

	f.service.Check("task-1")

	waitFor(t, "the prompt of the second pass", func() bool {
		return f.sessions.sentCount(reviewPrompt(f.reviewPath(2))) > 0
	})
	if run, _ := f.tasks.prRun("task-1"); run.Status == task.PRDone {
		t.Errorf("status = %q, want the review to go on", run.Status)
	}
}

func TestAReportOutsideItsPathIsAdoptedWhenItIsTheOnlyOne(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, askedPass(1))
	tk, _ := f.tasks.Get("task-1")
	other := filepath.Join(tk.ArtifactsDir, "notes", "findings.md")
	if err := os.MkdirAll(filepath.Dir(other), 0o700); err != nil {
		t.Fatal(err)
	}
	content := "---\nstatus: changes\npass: 1\n---\n\nThe summary.\n\n## Findings\n\n### 1. First\n\nLocation: internal/a.go:3\n\nThe first.\n"
	if err := os.WriteFile(other, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}

	f.service.Check("task-1")

	waitFor(t, "the report to be recorded", func() bool { return currentPassOf(t, f).Recorded })
	f.wantNoDivergence(t)
}

func TestTwoReportsOfThePassAreADivergenceTheUserSettles(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, askedPass(1))
	tk, _ := f.tasks.Get("task-1")
	content := "---\nstatus: clean\npass: 1\n---\n\nThe summary.\n"
	for _, name := range []string{"a.md", "b.md"} {
		if err := os.WriteFile(filepath.Join(tk.ArtifactsDir, name), []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	f.service.Check("task-1")

	d := f.waitDivergence(t, divergence.KindReportsAmbiguous)
	if diff := cmp.Diff([]string{"a.md", "b.md"}, d.Facts.Candidates); diff != "" {
		t.Errorf("candidates mismatch (-want +got):\n%s", diff)
	}
	if d.Stage != session.PRReviewStage || d.Facts.Path != "pr/review-1.md" {
		t.Errorf("divergence = %+v, want the report of pass 1 in the review conversation", d)
	}
	if err := f.service.Adopt(t.Context(), "task-1", "b.md"); err != nil {
		t.Fatalf("Adopt() = %v, want nil", err)
	}
	waitFor(t, "the report to be recorded", func() bool { return currentPassOf(t, f).Recorded })
	f.wantNoDivergence(t)
}

func TestAskingForAMissingReportAgainSendsTheMessageOnce(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, askedPass(1))
	f.service.Check("task-1")
	f.waitDivergence(t, divergence.KindReportMissing)

	if err := f.service.AskAgain(t.Context(), "task-1"); err != nil {
		t.Fatalf("AskAgain() = %v, want nil", err)
	}

	f.wantNoDivergence(t)
	tk, _ := f.tasks.Get("task-1")
	if diff := cmp.Diff([]session.AppMessage{{Kind: session.AppAgain, Pass: 1}}, f.sessions.sentApps()); diff != "" {
		t.Errorf("app messages mismatch (-want +got):\n%s", diff)
	}
	want := "The report of pass 1 isn't at `" + tk.ReviewPath(1) + "`. Write it there, in the format the instructions of this session give, and stop."
	if diff := cmp.Diff([]string{want}, f.sessions.sent()); diff != "" {
		t.Errorf("messages mismatch (-want +got):\n%s", diff)
	}
}

func TestACommitOverAPassThatChangedNothingIsReviewed(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	structured(t, f, sentPass(decidedPass(1, approved)))
	implementerAtRest(f)
	f.reviews.setSnapshot(unmoved(0))
	f.service.Check("task-1")
	f.waitDivergence(t, divergence.KindNoChanges)

	// The implementer, or the user, commits the fixes: the worktree is clean
	// and the branch moved.
	f.reviews.setSnapshot(review.Snapshot{Head: commitSHA})
	f.worktrees.setStatus(git.Status{Head: commitSHA})
	f.gh.setPR("task-1", withChecks(failingChecks()))
	f.service.Check("task-1")

	waitFor(t, "the prompt of the second pass", func() bool {
		return f.sessions.sentCount(reviewPrompt(f.reviewPath(2))) > 0
	})
	f.wantNoDivergence(t)
}
