package reviewflow_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/guilhermt/myspec/internal/divergence"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/reviewflow"
	"github.com/guilhermt/myspec/internal/session"
)

// writeFile writes an artifact of a review at a path relative to its folder.
func (f *fixture) writeFile(t *testing.T, id, name, content string) {
	t.Helper()

	stored, _ := f.reviews.Get(id)
	path := filepath.Join(stored.ArtifactsDir, name)
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
}

// diverged waits for the review to hold a divergence of kind.
func (f *fixture) diverged(t *testing.T, id string, kind divergence.Kind) divergence.Divergence {
	t.Helper()

	f.evaluated(t, id, func(s reviewflow.State) bool { return s.Divergence != nil && s.Divergence.Kind == kind },
		"the divergence "+string(kind))
	return *f.state(t, id).Divergence
}

func TestEveryWayOutRefusesAReviewWithoutDivergence(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(t)

	wantErrIs(t, f.service.CheckAgain(t.Context(), id), reviewflow.ErrNoDivergence)
	wantErrIs(t, f.service.AskAgain(t.Context(), id), reviewflow.ErrNoDivergence)
	wantErrIs(t, f.service.Adopt(t.Context(), id, ""), reviewflow.ErrNoDivergence)
}

func TestAskingAgainForAMissingReportSendsTheSamePassOnce(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := asked(t, f)
	d := f.diverged(t, id, divergence.KindReportMissing)
	if d.Facts.Pass != 1 || d.Facts.Path != "review-1.md" {
		t.Errorf("facts = %+v, want pass 1 at review-1.md", d.Facts)
	}

	if err := f.service.AskAgain(t.Context(), id); err != nil {
		t.Fatalf("ask again: %v", err)
	}

	want := "The report of pass 1 isn't at `" + f.state(t, id).Review.ReportPath(1) + "`. Write it there, in the format the instructions of this session give, and stop."
	if got := lastMessage(t, f); got != want {
		t.Errorf("message = %q, want %q", got, want)
	}
	wantLastApp(t, f, session.AppMessage{Kind: session.AppAgain, Pass: 1})
	state := f.state(t, id)
	if state.Divergence != nil || state.Review.AskedPass != 1 {
		t.Errorf("divergence, asked pass = %+v, %d, want it ended and the same pass asked", state.Divergence, state.Review.AskedPass)
	}
}

func TestAReportOutsideTheAgreedPathIsCopiedToIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := asked(t, f)
	f.writeFile(t, id, "notes/report.md", "---\nstatus: changes\npass: 1\n---\n\n"+twoFindings+"\n")

	f.evaluated(t, id, func(s reviewflow.State) bool { return s.Status == reviewflow.StatusAwaitingDecision },
		"the report found elsewhere to be recorded")
}

func TestAdoptingOneOfTheReportsThatCouldBeIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := asked(t, f)
	f.writeFile(t, id, "a/report.md", "---\nstatus: changes\npass: 1\n---\n\n"+twoFindings+"\n")
	f.writeFile(t, id, "b/report.md", "---\nstatus: clean\npass: 1\n---\n\nNothing.\n")
	d := f.diverged(t, id, divergence.KindReportsAmbiguous)
	if len(d.Facts.Candidates) != 2 {
		t.Fatalf("candidates = %v, want two", d.Facts.Candidates)
	}

	wantErrIs(t, f.service.Adopt(t.Context(), id, "c/report.md"), reviewflow.ErrNoCandidate)
	if err := f.service.Adopt(t.Context(), id, "a/report.md"); err != nil {
		t.Fatalf("adopt: %v", err)
	}

	f.evaluated(t, id, func(s reviewflow.State) bool { return s.Status == reviewflow.StatusAwaitingDecision },
		"the adopted report to be recorded")
	if f.state(t, id).Divergence != nil {
		t.Error("the divergence stayed after the report was recorded")
	}
}

func TestAReportThatCannotBeReadCannotBeAdopted(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := asked(t, f)
	f.diverged(t, id, divergence.KindReportMissing)

	wantErrIs(t, f.service.Adopt(t.Context(), id, ""), reviewflow.ErrNotAdoptable)
}

// uncommitted is a review whose commit turn left no commit.
func uncommitted(t *testing.T, f *fixture) string {
	t.Helper()

	id := committing(t, f)
	f.sessions.goIdle(id)
	f.diverged(t, id, divergence.KindCommitMissing)
	return id
}

func TestAskingAgainForTheCommitActsAsTheApprovalDoes(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := uncommitted(t, f)
	f.sessions.goBusy(id)
	f.sessions.goIdle(id)

	if err := f.service.AskAgain(t.Context(), id); err != nil {
		t.Fatalf("ask again: %v", err)
	}

	wantLastApp(t, f, session.AppMessage{Kind: session.AppCommit})
	state := f.state(t, id)
	if state.Divergence != nil || state.Review.Phase != prreview.PhaseCommitting {
		t.Errorf("divergence, phase = %+v, %q, want it ended and committing", state.Divergence, state.Review.Phase)
	}
}

func TestAskingAgainForTheCommitFailsWhileTheChangesAreNotStaged(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := uncommitted(t, f)
	f.watch.setSnapshot(review.Snapshot{Head: headHash, Staged: 1, Total: 2})

	wantErrIs(t, f.service.AskAgain(t.Context(), id), reviewflow.ErrNotReady)
	if f.state(t, id).Divergence == nil {
		t.Error("the divergence ended with a refused ask")
	}
}

// unchanged is a review whose agent rested after the fixes with no file
// changed.
func unchanged(t *testing.T, f *fixture) string {
	t.Helper()

	id := applyDecided(t, f)
	if err := f.service.Apply(t.Context(), id); err != nil {
		t.Fatalf("apply: %v", err)
	}
	f.watch.setSnapshot(review.Snapshot{Head: headHash})
	f.sessions.goIdle(id)
	f.diverged(t, id, divergence.KindNoChanges)
	return id
}

func TestApprovedFindingsThatChangeNothingAreADivergence(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := unchanged(t, f)

	state := f.state(t, id)
	if state.Status != reviewflow.StatusDiverged || state.Divergence.Facts.Pass != 1 || state.Divergence.Facts.Approved != 2 {
		t.Errorf("status, divergence = %q, %+v, want diverged by 2 approved findings of pass 1", state.Status, state.Divergence)
	}

	f.watch.setSnapshot(review.Snapshot{Head: headHash, Total: 1})
	f.evaluated(t, id, func(s reviewflow.State) bool { return s.Divergence == nil }, "the divergence to end with a change")
}

func TestAskingAgainSendsTheApprovedFindingsOnceMore(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := unchanged(t, f)

	if err := f.service.AskAgain(t.Context(), id); err != nil {
		t.Fatalf("ask again: %v", err)
	}

	wantLastApp(t, f, session.AppMessage{Kind: session.AppApply, Count: 2})
	state := f.state(t, id)
	if state.Divergence != nil || state.Review.Phase != prreview.PhaseApplying {
		t.Errorf("divergence, phase = %+v, %q, want it ended and still applying", state.Divergence, state.Review.Phase)
	}
}

func TestContinuingWithoutChangesTakesThePassAsApplied(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := unchanged(t, f)

	if err := f.service.Adopt(t.Context(), id, ""); err != nil {
		t.Fatalf("adopt: %v", err)
	}

	state := f.state(t, id)
	if state.Divergence != nil || state.Review.Phase != prreview.PhaseNone || state.Status != reviewflow.StatusReadyToMerge {
		t.Errorf("divergence, phase, status = %+v, %q, %q, want it ended, no phase, ready_to_merge",
			state.Divergence, state.Review.Phase, state.Status)
	}
	if passes := f.reviews.Passes(id); !passes[0].Applied {
		t.Errorf("passes = %+v, want the first one applied", passes)
	}
}

func TestADivergenceEndsWithTheReview(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := asked(t, f)
	f.diverged(t, id, divergence.KindReportMissing)

	if _, err := f.service.Delete(t.Context(), id); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, ok := f.divergences.Get(id); ok {
		t.Error("the divergence outlived the review")
	}
}

func TestApprovedFindingsThatChangeNothingAreADivergenceWhenThePassRecordedNoCommit(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := applyDecidedOn(t, f, "")
	if err := f.service.Apply(t.Context(), id); err != nil {
		t.Fatalf("apply: %v", err)
	}
	f.watch.setSnapshot(review.Snapshot{Head: headHash})
	f.sessions.goIdle(id)
	f.diverged(t, id, divergence.KindNoChanges)

	if passes := f.reviews.Passes(id); passes[0].Applied {
		t.Errorf("passes = %+v, want the first one not applied", passes)
	}
	if got := f.worktrees.pushed(); len(got) != 0 {
		t.Errorf("pushes = %v, want none", got)
	}
}
