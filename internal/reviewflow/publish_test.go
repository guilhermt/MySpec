package reviewflow_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/reviewflow"
)

// prDiff is the diff of the pull request under review: line 12 of the service
// is part of it, line 99 is not.
const prDiff = `diff --git a/internal/board/service.go b/internal/board/service.go
index 1111111..2222222 100644
--- a/internal/board/service.go
+++ b/internal/board/service.go
@@ -10,3 +10,4 @@ func (s *Service) Read() {
 	readings := s.readings
+	s.cache = readings
 	return readings
`

// toPublish is a review whose findings the user decided on, with the diff the
// publication is anchored in.
func toPublish(t *testing.T, f *fixture) string {
	t.Helper()

	f.gh.diff = prDiff
	return decided(t, f)
}

func TestPublishingSendsEachApprovedFindingWhereItBelongs(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := toPublish(t, f)
	f.decide(t, id, 1, 2, prreview.DecisionApproved)

	if err := f.service.Publish(t.Context(), id, prreview.VerdictRequestChanges); err != nil {
		t.Fatalf("publish review: %v", err)
	}

	want := gh.ReviewInput{
		CommitID: headHash,
		Event:    gh.EventRequestChanges,
		Body:     "Two things to fix.\n\n**Other findings**\n\n1. The cache has no test.",
		Comments: []gh.ReviewComment{{
			Path: "internal/board/service.go", Line: 12, Side: "RIGHT",
			Body: "The reading is never cached.",
		}},
	}
	if diff := cmp.Diff([]gh.ReviewInput{want}, f.gh.inputs); diff != "" {
		t.Errorf("review sent to GitHub (-want +got):\n%s", diff)
	}

	pass := f.pass(t, id, 1)
	if !pass.Published() || pass.Verdict != prreview.VerdictRequestChanges {
		t.Errorf("pass = %+v, want it published asking for changes", pass)
	}
	placements := map[int]prreview.Placement{}
	for _, finding := range pass.Findings {
		placements[finding.Number] = finding.Placement
	}
	wantPlacements := map[int]prreview.Placement{1: prreview.PlacementInline, 2: prreview.PlacementBody}
	if diff := cmp.Diff(wantPlacements, placements); diff != "" {
		t.Errorf("placements (-want +got):\n%s", diff)
	}
	if f.state(t, id).Status != reviewflow.StatusPublished {
		t.Errorf("status = %q, want the review published", f.state(t, id).Status)
	}
	if f.pulls.refreshes == 0 {
		t.Error("the list of pull requests was not read again after the publication")
	}
}

func TestAFindingWhoseLineLeftTheDiffGoesInTheBody(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.gh.diff = prDiff
	id := asked(t, f)
	f.record(t, id, changesReport(1, "One thing to fix.",
		prreview.ParsedFinding{Number: 1, Path: "internal/board/service.go", Line: 99, Text: "The cache is never cleared."},
	), headHash)
	f.decide(t, id, 1, 1, prreview.DecisionApproved)

	if err := f.service.Publish(t.Context(), id, prreview.VerdictComment); err != nil {
		t.Fatalf("publish review: %v", err)
	}

	sent := f.gh.inputs[0]
	if len(sent.Comments) != 0 {
		t.Errorf("comments = %+v, want the finding kept out of the lines of the diff", sent.Comments)
	}
	want := "One thing to fix.\n\n**Other findings**\n\n1. `internal/board/service.go:99` — The cache is never cleared."
	if sent.Body != want {
		t.Errorf("body = %q, want %q", sent.Body, want)
	}
	if got := f.pass(t, id, 1).Findings[0].Placement; got != prreview.PlacementBody {
		t.Errorf("placement = %q, want the finding recorded as published in the body", got)
	}
}

func TestACleanPassPublishesItsSummaryAlone(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.gh.diff = prDiff
	id := asked(t, f)
	f.record(t, id, cleanReport(1, "Nothing to change: the cache is covered."), headHash)

	if err := f.service.Publish(t.Context(), id, prreview.VerdictApprove); err != nil {
		t.Fatalf("publish review: %v", err)
	}

	sent := f.gh.inputs[0]
	if sent.Event != gh.EventApprove || sent.Body != "Nothing to change: the cache is covered." {
		t.Errorf("review sent = %+v, want the summary approved on its own", sent)
	}
	if len(sent.Comments) != 0 {
		t.Errorf("comments = %+v, want none", sent.Comments)
	}
}

func TestAReviewWithNothingToSayIsRefused(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.gh.diff = prDiff
	id := asked(t, f)
	f.record(t, id, changesReport(1, "", prreview.ParsedFinding{Number: 1, Text: "The cache has no test."}), headHash)
	f.decide(t, id, 1, 1, prreview.DecisionDiscarded)

	wantErrIs(t, f.service.Publish(t.Context(), id, prreview.VerdictComment), reviewflow.ErrEmptyReview)

	if len(f.gh.inputs) != 0 {
		t.Errorf("reviews sent = %+v, want nothing sent to GitHub", f.gh.inputs)
	}
}

func TestAPublicationThatFailedKeepsEveryDecision(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := toPublish(t, f)
	f.gh.createErr = errGitHub

	if err := f.service.Publish(t.Context(), id, prreview.VerdictComment); err == nil {
		t.Fatal("publish review = nil, want the failure of GitHub")
	}

	stored, _ := f.reviews.Get(id)
	if stored.PublishError == "" {
		t.Error("publish error = \"\", want why the publication failed")
	}
	pass := f.pass(t, id, 1)
	if pass.Published() {
		t.Errorf("pass = %+v, want it left unpublished", pass)
	}
	if pass.Findings[0].Decision != prreview.DecisionApproved ||
		pass.Findings[1].Decision != prreview.DecisionDiscarded {
		t.Errorf("findings = %+v, want the decisions of the user kept", pass.Findings)
	}
	if f.state(t, id).Status != reviewflow.StatusPublishFailed {
		t.Errorf("status = %q, want the review waiting for another try", f.state(t, id).Status)
	}
}

func TestPublishingAPullRequestOfYourOwnOnlyComments(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.pulls.seed(ownPR())
	f.gh.diff = prDiff
	id := f.startMode(t, prreview.ModePublish, "")
	f.sessions.goIdle(id)
	f.record(t, id, cleanReport(1, "Nothing to change."), headHash)

	wantErrIs(t, f.service.Publish(t.Context(), id, prreview.VerdictApprove), reviewflow.ErrOwnVerdict)

	if err := f.service.Publish(t.Context(), id, prreview.VerdictComment); err != nil {
		t.Fatalf("publish review: %v", err)
	}
	if got := f.gh.inputs[0].Event; got != gh.EventComment {
		t.Errorf("event = %q, want a comment, the only verdict GitHub takes on a pull request of your own", got)
	}
}

func TestPublishingIsRefusedUntilEveryFindingIsDecided(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.gh.diff = prDiff
	id := asked(t, f)
	f.record(t, id, changesReport(1, "One thing to fix.",
		prreview.ParsedFinding{Number: 1, Text: "The cache has no test."},
	), headHash)

	wantErrIs(t, f.service.Publish(t.Context(), id, prreview.VerdictComment), reviewflow.ErrNotReady)
}

func TestPublishingAPullRequestThatClosedIsRefused(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := toPublish(t, f)
	closed := openPR()
	closed.State = string(prreview.PRClosed)
	f.pulls.seed(closed)

	wantErrIs(t, f.service.Publish(t.Context(), id, prreview.VerdictComment), reviewflow.ErrNotOpen)

	if stored, _ := f.reviews.Get(id); stored.PublishError == "" {
		t.Error("publish error = \"\", want the review to say why it could not be published")
	}
}
