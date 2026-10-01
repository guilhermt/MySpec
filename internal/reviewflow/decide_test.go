package reviewflow_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/prreport"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/reviewflow"
)

func TestTheUserDecidesOnAFindingAndLeavesTheTextTheyWant(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := asked(t, f)
	f.record(t, id, changesReport(1, "One thing to fix.",
		prreport.ParsedFinding{Number: 1, Path: "internal/board/service.go", Line: 12, Text: "The reading is never cached."},
	), headHash)

	if err := f.service.SetFindingText(t.Context(), id, 1, 1, "Cache the reading, as the boards do."); err != nil {
		t.Fatalf("set finding text: %v", err)
	}
	if err := f.service.SetSummary(t.Context(), id, 1, "One thing, and it is small."); err != nil {
		t.Fatalf("set summary: %v", err)
	}
	if err := f.service.Decide(t.Context(), id, 1, 1, prreview.DecisionApproved); err != nil {
		t.Fatalf("decide finding: %v", err)
	}

	pass := f.pass(t, id, 1)
	if pass.Summary != "One thing, and it is small." {
		t.Errorf("summary = %q, want the one the user left", pass.Summary)
	}
	if pass.Findings[0].Text != "Cache the reading, as the boards do." ||
		pass.Findings[0].Decision != prreview.DecisionApproved {
		t.Errorf("finding = %+v, want it approved with the text of the user", pass.Findings[0])
	}
	if f.state(t, id).Status != reviewflow.StatusReadyToPublish {
		t.Errorf("status = %q, want the review ready to publish", f.state(t, id).Status)
	}
}

func TestDecidingIsRefusedWhileTheAgentOwesTheReportOfAPass(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := decided(t, f)
	if _, err := f.reviews.AskPass(t.Context(), id, 2, ""); err != nil {
		t.Fatalf("ask pass: %v", err)
	}

	wantErrIs(t, f.service.Decide(t.Context(), id, 1, 1, prreview.DecisionDiscarded), reviewflow.ErrPassRunning)
	wantErrIs(t, f.service.SetFindingText(t.Context(), id, 1, 1, "Something else."), reviewflow.ErrPassRunning)
	wantErrIs(t, f.service.SetSummary(t.Context(), id, 1, "Something else."), reviewflow.ErrPassRunning)
}

func TestDecidingOnAReviewNobodyStartedIsRefused(t *testing.T) {
	t.Parallel()

	f := newFixture(t)

	wantErrIs(t, f.service.Decide(t.Context(), "review-9", 1, 1, prreview.DecisionApproved), prreview.ErrNotFound)
}

func TestApprovingTheRestLeavesTheDecidedFindingsAsTheyAre(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := asked(t, f)
	f.record(t, id, changesReport(1, "Three things to fix.",
		prreport.ParsedFinding{Number: 1, Path: "internal/board/service.go", Line: 12, Text: "The reading is never cached."},
		prreport.ParsedFinding{Number: 2, Text: "The cache has no test."},
		prreport.ParsedFinding{Number: 3, Text: "The cache never expires."},
	), headHash)
	f.decide(t, id, 1, 2, prreview.DecisionDiscarded)

	if err := f.service.ApproveRest(t.Context(), id, 1); err != nil {
		t.Fatalf("approve the rest: %v", err)
	}

	findings := f.pass(t, id, 1).Findings
	got := make([]prreview.Decision, 0, len(findings))
	for _, finding := range findings {
		got = append(got, finding.Decision)
	}
	want := []prreview.Decision{prreview.DecisionApproved, prreview.DecisionDiscarded, prreview.DecisionApproved}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("decisions mismatch (-want +got):\n%s", diff)
	}
}

func TestApprovingTheRestIsRefusedWhileAPassRunsAndOnAPublishedPass(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := decided(t, f)
	if _, err := f.reviews.AskPass(t.Context(), id, 2, ""); err != nil {
		t.Fatalf("ask pass: %v", err)
	}
	wantErrIs(t, f.service.ApproveRest(t.Context(), id, 1), reviewflow.ErrPassRunning)

	g := newFixture(t)
	wantErrIs(t, g.service.ApproveRest(t.Context(), published(t, g), 1), prreview.ErrNotDeciding)
}
