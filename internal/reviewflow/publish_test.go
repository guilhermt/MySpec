package reviewflow_test

import (
	"errors"
	"fmt"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/prreport"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/pulls"
	"github.com/guilhermt/myspec/internal/reviewflow"
	"github.com/guilhermt/myspec/internal/session"
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

	if err := f.service.Publish(t.Context(), id, prreview.VerdictRequestChanges, true); err != nil {
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
		prreport.ParsedFinding{Number: 1, Path: "internal/board/service.go", Line: 99, Text: "The cache is never cleared."},
	), headHash)
	f.decide(t, id, 1, 1, prreview.DecisionApproved)

	if err := f.service.Publish(t.Context(), id, prreview.VerdictComment, true); err != nil {
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

	if err := f.service.Publish(t.Context(), id, prreview.VerdictApprove, true); err != nil {
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
	f.record(t, id, changesReport(1, "", prreport.ParsedFinding{Number: 1, Text: "The cache has no test."}), headHash)
	f.decide(t, id, 1, 1, prreview.DecisionDiscarded)

	wantErrIs(t, f.service.Publish(t.Context(), id, prreview.VerdictComment, true), reviewflow.ErrEmptyReview)

	if len(f.gh.inputs) != 0 {
		t.Errorf("reviews sent = %+v, want nothing sent to GitHub", f.gh.inputs)
	}
	// A refusal is no failed publication: the review stays ready to publish.
	if stored, _ := f.reviews.Get(id); stored.PublishError != "" {
		t.Errorf("publish error = %q, want none", stored.PublishError)
	}
	if got := f.state(t, id).Status; got != reviewflow.StatusReadyToPublish {
		t.Errorf("status = %q, want the review still ready to publish", got)
	}
}

func TestAPublicationThatFailedKeepsEveryDecision(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := toPublish(t, f)
	f.gh.createErr = errGitHub

	if err := f.service.Publish(t.Context(), id, prreview.VerdictComment, true); err == nil {
		t.Fatal("publish review = nil, want the failure of GitHub")
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

func TestAPublicationThatFailedIsTriedAgain(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := toPublish(t, f)
	f.gh.createErr = errGitHub
	if err := f.service.Publish(t.Context(), id, prreview.VerdictComment, true); err == nil {
		t.Fatal("publish review = nil, want the failure of GitHub")
	}
	f.gh.createErr = nil

	if err := f.service.Publish(t.Context(), id, prreview.VerdictComment, true); err != nil {
		t.Fatalf("publish review again: %v", err)
	}
	if got := f.state(t, id).Status; got != reviewflow.StatusPublished {
		t.Errorf("status = %q, want the review published", got)
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

	wantErrIs(t, f.service.Publish(t.Context(), id, prreview.VerdictApprove, true), reviewflow.ErrOwnVerdict)

	if err := f.service.Publish(t.Context(), id, prreview.VerdictComment, true); err != nil {
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
		prreport.ParsedFinding{Number: 1, Text: "The cache has no test."},
	), headHash)

	wantErrIs(t, f.service.Publish(t.Context(), id, prreview.VerdictComment, true), reviewflow.ErrNotReady)
}

func TestPublishingIsRefusedWhileTheAgentIsWorking(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := toPublish(t, f)
	// The user asked in the conversation for the report to be rewritten.
	f.sessions.goBusy(id)

	wantErrIs(t, f.service.Publish(t.Context(), id, prreview.VerdictComment, true), reviewflow.ErrNotReady)

	if len(f.gh.inputs) != 0 {
		t.Errorf("reviews sent = %+v, want nothing sent to GitHub", f.gh.inputs)
	}
	f.sessions.goIdle(id)
	if err := f.service.Publish(t.Context(), id, prreview.VerdictComment, true); err != nil {
		t.Fatalf("publish review once the agent rested: %v", err)
	}
}

func TestPublishingAPullRequestThatClosedIsRefused(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := toPublish(t, f)
	closed := openPR()
	closed.State = string(prreview.PRClosed)
	f.pulls.seed(closed)

	wantErrIs(t, f.service.Publish(t.Context(), id, prreview.VerdictComment, true), reviewflow.ErrNotOpen)

	want := "The pull request isn't open anymore."
	if stored, _ := f.reviews.Get(id); stored.PublishError != want {
		t.Errorf("publish error = %q, want %q", stored.PublishError, want)
	}
}

func TestAPublicationThatFailedSaysWhatTheUserCanDoAboutIt(t *testing.T) {
	t.Parallel()

	rejected := &gh.Error{
		Args:   []string{"api", "--method", "POST", "repos/dev/web/pulls/42/reviews", "--input", "-"},
		Output: `{"message":"Unprocessable Entity"}`,
		Err:    errors.New("exit status 1"),
	}
	tests := []struct {
		name string
		fail func(f *fixture)
		want string
	}{
		{
			"gh said why",
			func(f *fixture) { f.gh.createErr = rejected },
			`Couldn't publish to GitHub: {"message":"Unprocessable Entity"}`,
		},
		{
			"gh is not authenticated",
			func(f *fixture) { f.gh.createErr = fmt.Errorf("create review: %w", gh.ErrNotAuthenticated) },
			"gh is not authenticated. Run gh auth login.",
		},
		{
			"the diff could not be read",
			func(f *fixture) { f.gh.diffErr = fmt.Errorf("pr diff: %w", gh.ErrMissingScope) },
			"gh can't read this repository. Run gh auth refresh -s repo.",
		},
		{
			"the pull request could not be read",
			func(f *fixture) { f.pulls.failWith(&pulls.Failure{Reason: pulls.ReasonUnauthenticated}) },
			"gh is not authenticated. Run gh auth login.",
		},
		{
			"the pull request is gone",
			func(f *fixture) { f.pulls.forget(prNumber) },
			"This pull request is no longer on GitHub.",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			id := toPublish(t, f)
			tt.fail(f)

			if err := f.service.Publish(t.Context(), id, prreview.VerdictComment, true); err == nil {
				t.Fatal("publish review = nil, want the failure")
			}
			if stored, _ := f.reviews.Get(id); stored.PublishError != tt.want {
				t.Errorf("publish error = %q, want %q", stored.PublishError, tt.want)
			}
		})
	}
}

func TestPublishingWithoutTheSummaryLeavesItOutOfTheBody(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := toPublish(t, f)
	f.decide(t, id, 1, 2, prreview.DecisionApproved)

	if err := f.service.Publish(t.Context(), id, prreview.VerdictRequestChanges, false); err != nil {
		t.Fatalf("publish review: %v", err)
	}

	if want := "**Other findings**\n\n1. The cache has no test."; f.gh.inputs[0].Body != want {
		t.Errorf("body = %q, want %q", f.gh.inputs[0].Body, want)
	}
	if f.pass(t, id, 1).SummaryPublished {
		t.Error("summaryPublished = true, want false for a summary left out")
	}
}

func TestPublishingTheSummaryRecordsThatItWent(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := toPublish(t, f)

	if err := f.service.Publish(t.Context(), id, prreview.VerdictComment, true); err != nil {
		t.Fatalf("publish review: %v", err)
	}

	if !f.pass(t, id, 1).SummaryPublished {
		t.Error("summaryPublished = false, want true for a summary that went")
	}
}

func TestAnEmptySummaryCountsAsNoSummaryEvenWhenItIsAsked(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := toPublish(t, f)
	if err := f.service.SetSummary(t.Context(), id, 1, "  "); err != nil {
		t.Fatalf("set summary: %v", err)
	}

	if err := f.service.Publish(t.Context(), id, prreview.VerdictComment, true); err != nil {
		t.Fatalf("publish review: %v", err)
	}

	if f.pass(t, id, 1).SummaryPublished {
		t.Error("summaryPublished = true, want false for a summary with nothing in it")
	}
}

func TestAReviewWithOnlyInlineCommentsGoesWithTheMinimalBody(t *testing.T) {
	t.Parallel()

	inline := func(number, line int) prreport.ParsedFinding {
		return prreport.ParsedFinding{
			Number: number, Path: "internal/board/service.go", Line: line, Text: "Look at this line.",
		}
	}
	cases := []struct {
		name     string
		findings []prreport.ParsedFinding
		verdict  prreview.Verdict
		want     string
	}{
		{"one comment", []prreport.ParsedFinding{inline(1, 12)}, prreview.VerdictRequestChanges, "Review with 1 inline comment."},
		{
			"two comments",
			[]prreport.ParsedFinding{inline(1, 12), inline(2, 11)},
			prreview.VerdictComment,
			"Review with 2 inline comments.",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			f.gh.diff = prDiff
			id := asked(t, f)
			f.record(t, id, changesReport(1, "Some things.", c.findings...), headHash)
			for _, finding := range c.findings {
				f.decide(t, id, 1, finding.Number, prreview.DecisionApproved)
			}

			if err := f.service.Publish(t.Context(), id, c.verdict, false); err != nil {
				t.Fatalf("publish review: %v", err)
			}

			if got := f.gh.inputs[0].Body; got != c.want {
				t.Errorf("body = %q, want %q", got, c.want)
			}
			if f.pass(t, id, 1).SummaryPublished {
				t.Error("summaryPublished = true, want false: the minimal body is no summary")
			}
		})
	}
}

func TestAnApprovalWithNothingToSayGoesWithAnEmptyBody(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.gh.diff = prDiff
	id := asked(t, f)
	f.record(t, id, cleanReport(1, "Nothing to change."), headHash)

	if err := f.service.Publish(t.Context(), id, prreview.VerdictApprove, false); err != nil {
		t.Fatalf("publish review: %v", err)
	}

	if sent := f.gh.inputs[0]; sent.Event != gh.EventApprove || sent.Body != "" {
		t.Errorf("review sent = %+v, want an approval with an empty body", sent)
	}
}

func TestPublishingMarksWhatWasDecidedAndWhatWentToGitHub(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := toPublish(t, f)
	f.decide(t, id, 1, 2, prreview.DecisionApproved)

	if err := f.service.Publish(t.Context(), id, prreview.VerdictRequestChanges, true); err != nil {
		t.Fatalf("publish review: %v", err)
	}

	wantDecided := []session.MarkerEntry{{Type: session.MarkerFindingsDecided, Pass: 1, Approved: 2}}
	if diff := cmp.Diff(wantDecided, f.sessions.markersOf(session.MarkerFindingsDecided)); diff != "" {
		t.Errorf("findings_decided markers (-want +got):\n%s", diff)
	}
	wantPublished := []session.MarkerEntry{{
		Type: session.MarkerReviewPublished, Pass: 1, Verdict: "request_changes", Inline: 1, Body: 1, Summary: true,
		URL: "https://github.com/dev/web/pull/42#pullrequestreview-1",
	}}
	if diff := cmp.Diff(wantPublished, f.sessions.markersOf(session.MarkerReviewPublished)); diff != "" {
		t.Errorf("review_published markers (-want +got):\n%s", diff)
	}
}

func TestAReviewPublishedWithTheMinimalBodyIsMarkedAsSuch(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.gh.diff = prDiff
	id := asked(t, f)
	finding := prreport.ParsedFinding{Number: 1, Path: "internal/board/service.go", Line: 12, Text: "Look at this line."}
	f.record(t, id, changesReport(1, "Some things.", finding), headHash)
	f.decide(t, id, 1, 1, prreview.DecisionApproved)

	if err := f.service.Publish(t.Context(), id, prreview.VerdictComment, false); err != nil {
		t.Fatalf("publish review: %v", err)
	}

	got := f.sessions.markersOf(session.MarkerReviewPublished)
	if len(got) != 1 || got[0].Inline != 1 || got[0].Body != 0 || got[0].Summary || !got[0].Minimal {
		t.Errorf("review_published markers = %+v, want one inline comment, no summary and the minimal body", got)
	}
}

func TestAReviewThatFailedToPublishMarksNothing(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := toPublish(t, f)
	f.gh.createErr = errors.New("boom")

	if err := f.service.Publish(t.Context(), id, prreview.VerdictComment, true); err == nil {
		t.Fatal("publish review = nil, want the failure")
	}

	if got := f.sessions.markersOf(session.MarkerReviewPublished); len(got) != 0 {
		t.Errorf("review_published markers = %+v, want none", got)
	}
}
