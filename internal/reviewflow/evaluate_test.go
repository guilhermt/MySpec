package reviewflow_test

import (
	"slices"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/reviewflow"
	"github.com/guilhermt/myspec/internal/session"
)

// twoFindings is the report of a pass as the agent writes it: a summary and
// two numbered findings, one anchored and one general.
const twoFindings = `Two things to fix.

## Findings

### 1
Location: internal/board/service.go:12

The reading is never cached.

### 2
Location: general

The cache has no test.`

// oneFinding is the same report after the agent rewrote it in place, without
// the finding the user argued away.
const oneFinding = `Two things to fix, one of them mine.

## Findings

### 1
Location: internal/board/service.go:12

The reading is never cached.`

// asked is a review whose first pass was asked for and whose conversation is
// at rest: what an evaluation decides on.
func asked(t *testing.T, f *fixture) string {
	t.Helper()

	id := f.start(t)
	f.sessions.goIdle(id)
	return id
}

func TestTheReportOfAPassIsRecordedWithTheCommitTheWorktreeIsOn(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := asked(t, f)
	f.writeReport(t, id, 1, reportFile("changes", twoFindings))

	// The conversation is marked just after the report is recorded, so the
	// wait covers both.
	f.evaluated(t, id, func(s reviewflow.State) bool {
		return s.Status == reviewflow.StatusAwaitingDecision &&
			slices.Contains(f.sessions.recorded(), "mark:"+id+":pass=1:clean=false")
	}, "the report of the first pass to be recorded")

	pass := f.pass(t, id, 1)
	if !pass.Recorded || pass.Clean || pass.Commit != headHash || pass.Revision != 1 {
		t.Errorf("pass = %+v, want the report recorded on %s", pass, headHash)
	}
	if pass.Summary != "Two things to fix." {
		t.Errorf("summary = %q, want the one of the report", pass.Summary)
	}
	want := []prreview.Finding{
		{
			Number: 1, Path: "internal/board/service.go", Line: 12,
			Original: "The reading is never cached.", Text: "The reading is never cached.",
		},
		{Number: 2, Original: "The cache has no test.", Text: "The cache has no test."},
	}
	if diff := cmp.Diff(want, pass.Findings); diff != "" {
		t.Errorf("findings (-want +got):\n%s", diff)
	}
	if stored, _ := f.reviews.Get(id); stored.ReportedPass != 1 || stored.PassCommit != headHash {
		t.Errorf("review = %+v, want the first pass reported", stored)
	}
	if diff := cmp.Diff([]string{"mark:" + id + ":pass=1:clean=false"}, f.sessions.recorded()[2:]); diff != "" {
		t.Errorf("session calls (-want +got):\n%s", diff)
	}
}

func TestAReportGitCannotSayTheCommitOfIsRecordedAllTheSame(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := asked(t, f)
	f.worktrees.failStatus(errGit)
	f.writeReport(t, id, 1, reportFile("clean", "Nothing to change."))

	f.evaluated(t, id, func(s reviewflow.State) bool {
		return s.Status == reviewflow.StatusReadyToPublish
	}, "the clean report to be recorded")

	pass := f.pass(t, id, 1)
	if !pass.Clean || pass.Commit != "" {
		t.Errorf("pass = %+v, want a clean report with no commit", pass)
	}
}

func TestAReportTheAppCannotReadLeavesTheReviewWaitingWithTheReason(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := asked(t, f)
	f.writeReport(t, id, 1, reportFile("perfect", "Nothing to change."))

	f.evaluated(t, id, func(s reviewflow.State) bool {
		return s.UnreadableReport != ""
	}, "the reason the report could not be read")

	state := f.state(t, id)
	if state.Status != reviewflow.StatusAwaitingReply {
		t.Errorf("status = %q, want %q", state.Status, reviewflow.StatusAwaitingReply)
	}
	if want := "The report can't be read: status \"perfect\" is neither clean nor changes."; state.UnreadableReport != want {
		t.Errorf("unreadable report = %q, want %q", state.UnreadableReport, want)
	}
	if f.pass(t, id, 1).Recorded {
		t.Error("a report the app cannot read was recorded")
	}
	if diff := cmp.Diff([]string{id, id, id}, f.changed()); diff != "" {
		t.Errorf("announced changes (-want +got):\n%s", diff)
	}
}

func TestAReportTheAppCanReadSettlesAReportItCouldNot(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := asked(t, f)
	f.writeReport(t, id, 1, reportFile("changes", "Something is wrong, and I forgot the findings."))

	f.evaluated(t, id, func(s reviewflow.State) bool {
		return s.UnreadableReport != ""
	}, "the reason the report could not be read")

	f.writeReport(t, id, 1, reportFile("changes", twoFindings))
	f.evaluated(t, id, func(s reviewflow.State) bool {
		return s.Status == reviewflow.StatusAwaitingDecision
	}, "the report of the first pass to be recorded")

	if got := f.state(t, id).UnreadableReport; got != "" {
		t.Errorf("unreadable report = %q, want none", got)
	}
}

func TestARewrittenReportKeepsTheDecisionsOfTheFindingsThatDidNotChange(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := asked(t, f)
	f.writeReport(t, id, 1, reportFile("changes", twoFindings))
	f.evaluated(t, id, func(s reviewflow.State) bool {
		return s.Status == reviewflow.StatusAwaitingDecision
	}, "the report of the first pass to be recorded")

	f.decide(t, id, 1, 1, prreview.DecisionApproved)
	f.decide(t, id, 1, 2, prreview.DecisionDiscarded)
	f.writeReport(t, id, 1, reportFile("changes", oneFinding))

	f.evaluated(t, id, func(s reviewflow.State) bool {
		return len(s.Passes) == 1 && s.Passes[0].Revision == 2
	}, "the rewritten report to be recorded")

	pass := f.pass(t, id, 1)
	if pass.Summary != "Two things to fix, one of them mine." {
		t.Errorf("summary = %q, want the one of the rewritten report", pass.Summary)
	}
	if len(pass.Findings) != 1 {
		t.Fatalf("findings = %+v, want the one the agent kept", pass.Findings)
	}
	if pass.Findings[0].Decision != prreview.DecisionApproved {
		t.Errorf("decision = %q, want the one the user had already taken", pass.Findings[0].Decision)
	}
	if got := f.state(t, id).Status; got != reviewflow.StatusReadyToPublish {
		t.Errorf("status = %q, want %q", got, reviewflow.StatusReadyToPublish)
	}
}

func TestARewriteTheAppCannotReadLeavesTheFindingsAsTheyWere(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := asked(t, f)
	f.writeReport(t, id, 1, reportFile("changes", twoFindings))
	f.evaluated(t, id, func(s reviewflow.State) bool {
		return s.Status == reviewflow.StatusAwaitingDecision
	}, "the report of the first pass to be recorded")

	f.writeReport(t, id, 1, reportFile("changes", "I rewrote it and forgot the findings."))
	f.evaluated(t, id, func(s reviewflow.State) bool {
		return s.UnreadableReport != ""
	}, "the reason the rewrite could not be read")

	pass := f.pass(t, id, 1)
	if len(pass.Findings) != 2 || pass.Revision != 1 {
		t.Errorf("pass = %+v, want the findings that were recorded", pass)
	}
	if got := f.state(t, id).Status; got != reviewflow.StatusAwaitingDecision {
		t.Errorf("status = %q, want %q", got, reviewflow.StatusAwaitingDecision)
	}
}

func TestARewriteThatBringsTheReportBackSettlesTheWarningOfTheAppAllTheSame(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := asked(t, f)
	f.writeReport(t, id, 1, reportFile("changes", twoFindings))
	f.evaluated(t, id, func(s reviewflow.State) bool {
		return s.Status == reviewflow.StatusAwaitingDecision
	}, "the report of the first pass to be recorded")

	f.writeReport(t, id, 1, reportFile("changes", "I rewrote it and forgot the findings."))
	f.evaluated(t, id, func(s reviewflow.State) bool {
		return s.UnreadableReport != ""
	}, "the reason the rewrite could not be read")
	announced := len(f.changed())

	// The user asks in the conversation for the report back, and the agent
	// writes the one the app had already recorded.
	f.writeReport(t, id, 1, reportFile("changes", twoFindings))
	f.evaluated(t, id, func(s reviewflow.State) bool {
		return s.UnreadableReport == ""
	}, "the warning about the report to be settled")

	if len(f.changed()) <= announced {
		t.Errorf("announced changes = %v, want one more once the warning was settled", f.changed())
	}
	if pass := f.pass(t, id, 1); pass.Revision != 1 || len(pass.Findings) != 2 {
		t.Errorf("pass = %+v, want the findings that were recorded, untouched", pass)
	}
}

func TestAPublishedPassIsNeverReadAgain(t *testing.T) {
	f := newFixture(t)
	id := published(t, f)
	f.writeReport(t, id, 1, reportFile("changes", oneFinding))

	f.settled(t, id)

	pass := f.pass(t, id, 1)
	if len(pass.Findings) != 2 || pass.Revision != 1 {
		t.Errorf("pass = %+v, want the findings that were published", pass)
	}
}

func TestNothingIsRecordedWhileThereIsNoReportToRead(t *testing.T) {
	f := newFixture(t)
	id := asked(t, f)

	f.settled(t, id)

	if f.pass(t, id, 1).Recorded {
		t.Error("a pass without a report was recorded")
	}
	if got := f.state(t, id); got.Status != reviewflow.StatusAwaitingReply || got.UnreadableReport != "" {
		t.Errorf("state = %+v, want the review waiting for a report", got)
	}
}

func TestNothingIsRecordedWhileTheAgentIsStillWorking(t *testing.T) {
	f := newFixture(t)
	id := f.start(t)
	f.writeReport(t, id, 1, reportFile("changes", twoFindings))

	f.settled(t, id)

	if f.pass(t, id, 1).Recorded {
		t.Error("the report of a pass still under way was recorded")
	}
}

func TestNothingIsRecordedForAReviewWithoutAConversation(t *testing.T) {
	f := newFixture(t)
	id := asked(t, f)
	f.sessions.forget(id)
	f.writeReport(t, id, 1, reportFile("changes", twoFindings))

	f.settled(t, id)

	if f.pass(t, id, 1).Recorded {
		t.Error("the report of a review with no conversation was recorded")
	}
}

func TestAnEvaluationOfAnIdThatIsNoReviewDoesNothing(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.service.Check("task-1")

	if got := f.changed(); len(got) != 0 {
		t.Errorf("announced changes = %v, want none", got)
	}
}

func TestAClosedFlowEvaluatesNothingElse(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := asked(t, f)
	f.writeReport(t, id, 1, reportFile("changes", twoFindings))

	f.service.Close()
	f.service.Check(id)

	if f.pass(t, id, 1).Recorded {
		t.Error("a closed flow recorded a report")
	}
}

// titledFindings is twoFindings after the agent wrote the title of each
// finding on the line of its number, and nothing else.
const titledFindings = `Two things to fix.

## Findings

### 1 · The reading is never cached
Location: internal/board/service.go:12

The reading is never cached.

### 2 · No test for the cache
Location: general

The cache has no test.`

func TestTheFirstReportRecordsWhenItWasRecorded(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := asked(t, f)
	f.writeReport(t, id, 1, reportFile("changes", twoFindings))

	f.evaluated(t, id, func(s reviewflow.State) bool {
		return s.Status == reviewflow.StatusAwaitingDecision
	}, "the report of the first pass to be recorded")

	if f.pass(t, id, 1).RecordedAt.IsZero() {
		t.Error("the pass kept no hour for its report")
	}
}

func TestARereadThatOnlyBringsTitlesKeepsTheRevisionAndTheDecisions(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := asked(t, f)
	f.writeReport(t, id, 1, reportFile("changes", twoFindings))
	f.evaluated(t, id, func(s reviewflow.State) bool {
		return s.Status == reviewflow.StatusAwaitingDecision
	}, "the report of the first pass to be recorded")
	f.decide(t, id, 1, 1, prreview.DecisionApproved)
	recordedAt := f.pass(t, id, 1).RecordedAt
	f.changed() // forget what was announced so far

	f.writeReport(t, id, 1, reportFile("changes", titledFindings))
	f.evaluated(t, id, func(s reviewflow.State) bool {
		return len(s.Passes) == 1 && s.Passes[0].Findings[0].Title != ""
	}, "the titles to be recorded")

	pass := f.pass(t, id, 1)
	if pass.Revision != 1 {
		t.Errorf("revision = %d, want the revision the titles did not raise", pass.Revision)
	}
	if got := []string{pass.Findings[0].Title, pass.Findings[1].Title}; !slices.Equal(got, []string{"The reading is never cached", "No test for the cache"}) {
		t.Errorf("titles = %q, want the ones of the report", got)
	}
	if pass.Findings[0].Decision != prreview.DecisionApproved || !pass.RecordedAt.Equal(recordedAt) {
		t.Errorf("pass = %+v, want the decision and the hour of the report kept", pass)
	}
	if !slices.Contains(f.changed(), id) {
		t.Error("the app was not told the titles arrived")
	}
}

func TestTheReportOfAPassIsMarkedWithItsFindingCount(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := asked(t, f)
	f.writeReport(t, id, 1, reportFile("changes", twoFindings))
	f.evaluated(t, id, func(s reviewflow.State) bool {
		return s.Status == reviewflow.StatusAwaitingDecision &&
			len(f.sessions.markersOf(session.MarkerPRReviewWritten)) == 1
	}, "the report of the first pass to be recorded")

	findings := 2
	want := []session.MarkerEntry{{Type: session.MarkerPRReviewWritten, Pass: 1, Findings: &findings}}
	if diff := cmp.Diff(want, f.sessions.markersOf(session.MarkerPRReviewWritten)); diff != "" {
		t.Errorf("pr_review_written markers (-want +got):\n%s", diff)
	}
}

func TestARewrittenReportIsMarkedRevisedAndARereadOfTheTitlesIsNot(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := asked(t, f)
	f.writeReport(t, id, 1, reportFile("changes", twoFindings))
	f.evaluated(t, id, func(s reviewflow.State) bool {
		return s.Status == reviewflow.StatusAwaitingDecision
	}, "the report of the first pass to be recorded")

	f.writeReport(t, id, 1, reportFile("changes", titledFindings))
	f.evaluated(t, id, func(s reviewflow.State) bool {
		return len(s.Passes) == 1 && s.Passes[0].Findings[0].Title != ""
	}, "the titles to be recorded")
	if got := f.sessions.markersOf(session.MarkerPRReviewRevised); len(got) != 0 {
		t.Fatalf("pr_review_revised markers = %+v, want none for titles alone", got)
	}

	f.writeReport(t, id, 1, reportFile("changes", oneFinding))
	f.evaluated(t, id, func(s reviewflow.State) bool {
		return len(s.Passes) == 1 && s.Passes[0].Revision == 2
	}, "the rewritten report to be recorded")

	findings := 1
	want := []session.MarkerEntry{{Type: session.MarkerPRReviewRevised, Pass: 1, Findings: &findings}}
	if diff := cmp.Diff(want, f.sessions.markersOf(session.MarkerPRReviewRevised)); diff != "" {
		t.Errorf("pr_review_revised markers (-want +got):\n%s", diff)
	}
}
