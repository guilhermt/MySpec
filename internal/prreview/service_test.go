package prreview_test

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/prreview"
)

func TestACreatedReviewIsListedWithItsArtifactFolderOnDisk(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	review := f.create(t, 42)

	if review.ArtifactsDir != prreview.ArtifactsDir(f.dataDir, "dev", "web", 42, review.ID) {
		t.Errorf("artifacts dir = %q", review.ArtifactsDir)
	}
	if info, err := os.Stat(review.ArtifactsDir); err != nil || !info.IsDir() {
		t.Fatalf("artifacts dir %s: %v", review.ArtifactsDir, err)
	}
	if got := f.service.List(); len(got) != 1 || got[0].ID != review.ID {
		t.Errorf("list = %v, want the review", got)
	}
	if review.PRState != prreview.PROpen {
		t.Errorf("pr state = %q, want open", review.PRState)
	}
	if f.changed() == 0 {
		t.Error("the service announced no change")
	}
}

func TestAPullRequestWithAnActiveReviewIsNotReviewedTwice(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.create(t, 42)

	_, err := f.service.Create(t.Context(), prreview.CreateParams{
		RepositoryID: f.repo.ID, Number: 42, Mode: prreview.ModePublish,
	})
	if !errors.Is(err, prreview.ErrActiveExists) {
		t.Errorf("error = %v, want ErrActiveExists", err)
	}
}

func TestAReviewOfARepositoryNobodyRegisteredIsRefused(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	_, err := f.service.Create(t.Context(), prreview.CreateParams{
		RepositoryID: "other", Number: 1, Mode: prreview.ModePublish,
	})
	if !errors.Is(err, prreview.ErrNotFound) {
		t.Errorf("error = %v, want ErrNotFound", err)
	}
}

func TestAReviewOfAModeTheProductDoesNotHaveIsRefused(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	_, err := f.service.Create(t.Context(), prreview.CreateParams{
		RepositoryID: f.repo.ID, Number: 1, Mode: prreview.Mode("merge"),
	})
	if !errors.Is(err, prreview.ErrUnknownMode) {
		t.Errorf("error = %v, want ErrUnknownMode", err)
	}
}

func TestAReviewThatCouldNotBeStoredLeavesNoFolderBehind(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.store.insertErr = errors.New("database is locked")

	if _, err := f.service.Create(t.Context(), prreview.CreateParams{
		RepositoryID: f.repo.ID, Number: 42, Mode: prreview.ModePublish,
	}); err == nil {
		t.Fatal("create review: want an error")
	}

	dir := prreview.ArtifactsDir(f.dataDir, "dev", "web", 42, "review-1")
	if _, err := os.Stat(dir); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("stat %s = %v, want the folder to be gone", dir, err)
	}
	if got := f.service.List(); len(got) != 0 {
		t.Errorf("list = %v, want nothing", got)
	}
}

func TestAnAskedPassIsRecordedWithTheInstructionsOfTheUser(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	review := f.asked(t, 42)

	if got := f.review(t, review.ID).AskedPass; got != 1 {
		t.Errorf("asked pass = %d, want 1", got)
	}
	pass := f.pass(t, review.ID, 1)
	if pass.Instructions != "look at the tests" || pass.Recorded {
		t.Errorf("pass = %+v, want the instructions and nothing recorded", pass)
	}
}

func TestAPassWhoseMessageNeverLeftIsUnasked(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	review := f.asked(t, 42)

	if err := f.service.UnaskPass(t.Context(), review.ID, 1); err != nil {
		t.Fatalf("unask pass: %v", err)
	}
	if got := f.review(t, review.ID).AskedPass; got != 0 {
		t.Errorf("asked pass = %d, want 0", got)
	}
	if got := f.service.Passes(review.ID); len(got) != 0 {
		t.Errorf("passes = %v, want none", got)
	}
}

func TestAPassThatWasRecordedIsNotUnasked(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	review := f.recorded(t, 42, cleanReport(1, "All good."), "commit-1")

	if err := f.service.UnaskPass(t.Context(), review.ID, 1); err != nil {
		t.Fatalf("unask pass: %v", err)
	}
	if got := f.review(t, review.ID).AskedPass; got != 1 {
		t.Errorf("asked pass = %d, want the recorded pass to stand", got)
	}
}

func TestTheFirstReportOfAPassIsRecordedAsTheUserFindsIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	report := changesReport(1, "Two things.",
		prreview.ParsedFinding{Number: 1, Path: "main.go", Line: 12, Text: "No test."},
		prreview.ParsedFinding{Number: 2, Text: "The commits mix two changes."})
	review := f.recorded(t, 42, report, "commit-1")

	pass := f.pass(t, review.ID, 1)
	want := []prreview.Finding{
		{Number: 1, Path: "main.go", Line: 12, Original: "No test.", Text: "No test."},
		{Number: 2, Original: "The commits mix two changes.", Text: "The commits mix two changes."},
	}
	if diff := cmp.Diff(want, pass.Findings); diff != "" {
		t.Errorf("findings (-want +got):\n%s", diff)
	}
	if !pass.Recorded || pass.Revision != 1 || pass.Commit != "commit-1" {
		t.Errorf("pass = %+v, want it recorded at revision 1 on commit-1", pass)
	}
	if pass.Summary != "Two things." || pass.SummaryOriginal != "Two things." {
		t.Errorf("summary = %q / %q, want both from the report", pass.Summary, pass.SummaryOriginal)
	}

	stored := f.review(t, review.ID)
	if stored.ReportedPass != 1 || stored.PassCommit != "commit-1" {
		t.Errorf("review = %+v, want pass 1 on commit-1", stored)
	}
}

func TestAReportThatSaysTheSameThingChangesNothing(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	report := changesReport(1, "One thing.",
		prreview.ParsedFinding{Number: 1, Path: "main.go", Line: 12, Text: "No test."})
	review := f.recorded(t, 42, report, "commit-1")
	before := f.changed()

	_, changed, err := f.service.RecordReport(t.Context(), review.ID, report, "commit-2")
	if err != nil {
		t.Fatalf("record report: %v", err)
	}
	if changed {
		t.Error("changed = true, want false for the same report")
	}
	if f.changed() != before {
		t.Error("the service announced a change nobody made")
	}
	if got := f.pass(t, review.ID, 1).Revision; got != 1 {
		t.Errorf("revision = %d, want 1", got)
	}
}

func TestARewrittenReportKeepsTheDecisionsOfTheFindingsThatStand(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	first := changesReport(1, "Two things.",
		prreview.ParsedFinding{Number: 1, Path: "main.go", Line: 12, Text: "No test."},
		prreview.ParsedFinding{Number: 2, Text: "The commits mix two changes."})
	review := f.recorded(t, 42, first, "commit-1")

	if err := f.service.Decide(t.Context(), review.ID, 1, 1, prreview.DecisionApproved); err != nil {
		t.Fatalf("decide: %v", err)
	}
	if err := f.service.SetFindingText(t.Context(), review.ID, 1, 1, "Cover it with a test."); err != nil {
		t.Fatalf("set finding text: %v", err)
	}

	second := changesReport(1, "Two things.",
		prreview.ParsedFinding{Number: 1, Path: "main.go", Line: 12, Text: "No test."},
		prreview.ParsedFinding{Number: 2, Path: "main.go", Line: 40, Text: "This name says nothing."})
	pass, changed, err := f.service.RecordReport(t.Context(), review.ID, second, "commit-2")
	if err != nil {
		t.Fatalf("record report: %v", err)
	}
	if !changed {
		t.Error("changed = false, want true for a rewritten report")
	}

	want := []prreview.Finding{
		{
			Number: 1, Path: "main.go", Line: 12, Original: "No test.",
			Text: "Cover it with a test.", Decision: prreview.DecisionApproved,
		},
		{Number: 2, Path: "main.go", Line: 40, Original: "This name says nothing.", Text: "This name says nothing."},
	}
	if diff := cmp.Diff(want, pass.Findings); diff != "" {
		t.Errorf("findings (-want +got):\n%s", diff)
	}
	if pass.Revision != 2 || pass.Commit != "commit-1" {
		t.Errorf("pass = %+v, want revision 2 on the commit it was recorded at", pass)
	}
	if pass.Summary != "Two things." {
		t.Errorf("summary = %q, want the one that did not change", pass.Summary)
	}
}

func TestASummaryTheUserEditedSurvivesARewriteThatKeepsTheSummaryOfTheReport(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	review := f.recorded(t, 42, changesReport(1, "One thing.",
		prreview.ParsedFinding{Number: 1, Text: "A thing."}), "commit-1")

	if err := f.service.SetSummary(t.Context(), review.ID, 1, "One small thing."); err != nil {
		t.Fatalf("set summary: %v", err)
	}
	rewritten := changesReport(1, "One thing.", prreview.ParsedFinding{Number: 1, Text: "Another thing."})
	if _, _, err := f.service.RecordReport(t.Context(), review.ID, rewritten, "commit-1"); err != nil {
		t.Fatalf("record report: %v", err)
	}

	pass := f.pass(t, review.ID, 1)
	if pass.Revision != 2 {
		t.Errorf("revision = %d, want the rewrite recorded", pass.Revision)
	}
	if pass.Summary != "One small thing." || pass.SummaryOriginal != "One thing." {
		t.Errorf("summary = %q / %q, want the edited one over the report's", pass.Summary, pass.SummaryOriginal)
	}
}

func TestASummaryTheAgentRewroteTakesOverTheOneTheUserLeft(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	review := f.recorded(t, 42, cleanReport(1, "All good."), "commit-1")

	if err := f.service.SetSummary(t.Context(), review.ID, 1, "Looks good to me."); err != nil {
		t.Fatalf("set summary: %v", err)
	}
	if _, _, err := f.service.RecordReport(t.Context(), review.ID, cleanReport(1, "Nothing to change."), "commit-1"); err != nil {
		t.Fatalf("record report: %v", err)
	}

	pass := f.pass(t, review.ID, 1)
	if pass.Summary != "Nothing to change." || pass.SummaryOriginal != "Nothing to change." {
		t.Errorf("summary = %q / %q, want the rewritten one", pass.Summary, pass.SummaryOriginal)
	}
}

func TestAReportThatCouldNotBeStoredLeavesThePassToBeRecordedAgain(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	review := f.asked(t, 42)
	report := changesReport(1, "One thing.", prreview.ParsedFinding{Number: 1, Text: "A thing."})

	f.store.writeErr = errors.New("database is locked")
	if _, _, err := f.service.RecordReport(t.Context(), review.ID, report, "commit-1"); err == nil {
		t.Fatal("record report: want an error")
	}
	if f.pass(t, review.ID, 1).Recorded || f.store.storedPass(t, review.ID, 1).Recorded {
		t.Error("pass recorded, want it left as asked in the cache and in the store")
	}
	if f.review(t, review.ID).ReportedPass != 0 || f.store.storedReview(t, review.ID).ReportedPass != 0 {
		t.Error("reported pass moved, want it left in the cache and in the store")
	}

	f.store.writeErr = nil
	_, changed, err := f.service.RecordReport(t.Context(), review.ID, report, "commit-1")
	if err != nil {
		t.Fatalf("record report again: %v", err)
	}
	if !changed {
		t.Error("changed = false, want the report recorded on the second try")
	}
	if got := f.store.storedReview(t, review.ID); got.ReportedPass != 1 || got.PassCommit != "commit-1" {
		t.Errorf("stored review = %+v, want pass 1 on commit-1", got)
	}
}

func TestAPublicationThatCouldNotBeStoredIsPublishedAgain(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	review := f.recorded(t, 42, cleanReport(1, "All good."), "commit-1")

	f.store.writeErr = errors.New("database is locked")
	err := f.service.MarkPublished(t.Context(), review.ID, 1, prreview.VerdictComment,
		"https://github.com/dev/web/pull/42#r1", "commit-1", nil)
	if err == nil {
		t.Fatal("mark published: want an error")
	}
	if f.pass(t, review.ID, 1).Published() || f.store.storedPass(t, review.ID, 1).Published() {
		t.Error("pass published, want it left to decide in the cache and in the store")
	}
	if f.review(t, review.ID).PublishedPass != 0 || f.store.storedReview(t, review.ID).PublishedPass != 0 {
		t.Error("published pass moved, want it left in the cache and in the store")
	}

	f.store.writeErr = nil
	publish(t, f, review.ID, 1, nil)
	if got := f.store.storedReview(t, review.ID); got.PublishedPass != 1 || got.PublishedCommit != "commit-1" {
		t.Errorf("stored review = %+v, want pass 1 published on commit-1", got)
	}
}

func TestAPublishedPassIsNeverTouchedAgain(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	review := f.recorded(t, 42, cleanReport(1, "All good."), "commit-1")
	publish(t, f, review.ID, 1, nil)

	_, changed, err := f.service.RecordReport(t.Context(), review.ID, cleanReport(1, "Other words."), "commit-2")
	if err != nil {
		t.Fatalf("record report: %v", err)
	}
	if changed {
		t.Error("changed = true, want a published pass left alone")
	}
	if got := f.pass(t, review.ID, 1).Summary; got != "All good." {
		t.Errorf("summary = %q, want the published one", got)
	}
}

func TestAPublishedPassIsNoLongerDecidedOn(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	review := f.recorded(t, 42, changesReport(1, "One thing.",
		prreview.ParsedFinding{Number: 1, Text: "A thing."}), "commit-1")

	if err := f.service.Decide(t.Context(), review.ID, 1, 1, prreview.DecisionApproved); err != nil {
		t.Fatalf("decide: %v", err)
	}
	publish(t, f, review.ID, 1, map[int]prreview.Placement{1: prreview.PlacementBody})

	cases := map[string]error{
		"decide":           f.service.Decide(t.Context(), review.ID, 1, 1, prreview.DecisionDiscarded),
		"set finding text": f.service.SetFindingText(t.Context(), review.ID, 1, 1, "Other words."),
		"set summary":      f.service.SetSummary(t.Context(), review.ID, 1, "Other words."),
	}
	for name, err := range cases {
		if !errors.Is(err, prreview.ErrNotDeciding) {
			t.Errorf("%s: error = %v, want ErrNotDeciding", name, err)
		}
	}
}

func TestAFindingWithoutWordsIsRefused(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	review := f.recorded(t, 42, changesReport(1, "One thing.",
		prreview.ParsedFinding{Number: 1, Text: "A thing."}), "commit-1")

	err := f.service.SetFindingText(t.Context(), review.ID, 1, 1, "  \n ")
	if !errors.Is(err, prreview.ErrEmptyText) {
		t.Errorf("error = %v, want ErrEmptyText", err)
	}
}

func TestADecisionTheProductDoesNotHaveIsRefused(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	review := f.recorded(t, 42, changesReport(1, "One thing.",
		prreview.ParsedFinding{Number: 1, Text: "A thing."}), "commit-1")

	err := f.service.Decide(t.Context(), review.ID, 1, 1, prreview.Decision("maybe"))
	if !errors.Is(err, prreview.ErrUnknownDecision) {
		t.Errorf("error = %v, want ErrUnknownDecision", err)
	}
}

func TestAPublishedPassCarriesWhereEachFindingWentAndTheHeadItWasSentAgainst(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	review := f.recorded(t, 42, changesReport(1, "Two things.",
		prreview.ParsedFinding{Number: 1, Path: "main.go", Line: 12, Text: "No test."},
		prreview.ParsedFinding{Number: 2, Text: "The commits mix two changes."}), "commit-1")
	for _, number := range []int{1, 2} {
		if err := f.service.Decide(t.Context(), review.ID, 1, number, prreview.DecisionApproved); err != nil {
			t.Fatalf("decide: %v", err)
		}
	}

	placements := map[int]prreview.Placement{1: prreview.PlacementInline, 2: prreview.PlacementBody}
	if err := f.service.MarkPublished(t.Context(), review.ID, 1,
		prreview.VerdictRequestChanges, "https://github.com/dev/web/pull/42#r1", "commit-2", placements); err != nil {
		t.Fatalf("mark published: %v", err)
	}

	pass := f.pass(t, review.ID, 1)
	if !pass.Published() || pass.Verdict != prreview.VerdictRequestChanges {
		t.Errorf("pass = %+v, want it published asking for changes", pass)
	}
	for _, finding := range pass.Findings {
		if finding.Placement != placements[finding.Number] {
			t.Errorf("finding %d went to %q, want %q", finding.Number, finding.Placement, placements[finding.Number])
		}
	}

	stored := f.review(t, review.ID)
	if stored.PublishedPass != 1 || stored.PublishedCommit != "commit-2" || stored.HeadCommit != "commit-2" {
		t.Errorf("review = %+v, want pass 1 published against commit-2", stored)
	}
	if stored.PublishError != "" {
		t.Errorf("publish error = %q, want it cleared", stored.PublishError)
	}
}

func TestAVerdictTheProductDoesNotHaveIsRefused(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	review := f.recorded(t, 42, cleanReport(1, "All good."), "commit-1")

	err := f.service.MarkPublished(t.Context(), review.ID, 1, prreview.Verdict("merge"), "", "commit-1", nil)
	if !errors.Is(err, prreview.ErrUnknownVerdict) {
		t.Errorf("error = %v, want ErrUnknownVerdict", err)
	}
}

func TestAnArchivedReviewLeavesTheListForTheHistoryWithWhatBecameOfThePullRequest(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	review := f.recorded(t, 42, cleanReport(1, "All good."), "commit-1")

	archived, err := f.service.Archive(t.Context(), review.ID, prreview.PRMerged)
	if err != nil {
		t.Fatalf("archive review: %v", err)
	}
	if !archived.Archived() || archived.PRState != prreview.PRMerged {
		t.Errorf("review = %+v, want it archived as merged", archived)
	}
	if got := f.service.List(); len(got) != 0 {
		t.Errorf("list = %v, want nothing active", got)
	}
	if got := f.service.ListArchived(); len(got) != 1 || got[0].ID != review.ID {
		t.Errorf("history = %v, want the review", got)
	}
	if _, ok := f.service.Get(review.ID); ok {
		t.Error("an archived review is still active")
	}
	if _, ok := f.service.Lookup(review.ID); !ok {
		t.Error("an archived review is not found by lookup")
	}
	if got := f.service.Passes(review.ID); len(got) != 1 {
		t.Errorf("passes = %v, want the pass of the history", got)
	}
}

func TestADeletedReviewTakesItsArtifactFolderWithIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	review := f.recorded(t, 42, cleanReport(1, "All good."), "commit-1")

	if err := f.service.Delete(t.Context(), review.ID); err != nil {
		t.Fatalf("delete review: %v", err)
	}
	if _, err := os.Stat(review.ArtifactsDir); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("stat %s = %v, want the folder to be gone", review.ArtifactsDir, err)
	}
	if _, ok := f.service.Lookup(review.ID); ok {
		t.Error("a deleted review is still loaded")
	}
	if got := f.service.Passes(review.ID); len(got) != 0 {
		t.Errorf("passes = %v, want none", got)
	}
}

func TestAnActionOnAReviewNobodyHasIsRefused(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	ctx := t.Context()

	cases := map[string]error{
		"ask pass": func() error { _, err := f.service.AskPass(ctx, "nope", 1, ""); return err }(),
		"update":   func() error { _, err := f.service.Update(ctx, "nope", func(*prreview.Review) {}); return err }(),
		"archive":  func() error { _, err := f.service.Archive(ctx, "nope", prreview.PRClosed); return err }(),
		"delete":   f.service.Delete(ctx, "nope"),
		"unask":    f.service.UnaskPass(ctx, "nope", 1),
		"context":  f.service.WriteContext("nope", "# Title"),
	}
	for name, err := range cases {
		if !errors.Is(err, prreview.ErrNotFound) {
			t.Errorf("%s: error = %v, want ErrNotFound", name, err)
		}
	}
}

func TestTheContextOfAReviewIsWrittenAndReadBack(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	review := f.create(t, 42)

	if err := f.service.WriteContext(review.ID, "# Add the review center\n"); err != nil {
		t.Fatalf("write context: %v", err)
	}
	got, err := f.service.ReadArtifact(review.ID, prreview.ContextFile)
	if err != nil {
		t.Fatalf("read artifact: %v", err)
	}
	if want := "# Add the review center\n"; got != want {
		t.Errorf("context = %q, want %q", got, want)
	}
	if review.ContextPath() != filepath.Join(review.ArtifactsDir, prreview.ContextFile) {
		t.Errorf("context path = %q", review.ContextPath())
	}
}

func TestOnlyTheArtifactsOfAReviewAreReadFromItsFolder(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	review := f.create(t, 42)
	writeFile(t, review.ArtifactsDir, prreview.ReportFile(1), "---\nstatus: clean\n---\n")

	if _, err := f.service.ReadArtifact(review.ID, prreview.ReportFile(1)); err != nil {
		t.Errorf("read report: %v", err)
	}
	if _, err := f.service.ReadArtifact(review.ID, "../../secrets.txt"); !errors.Is(err, prreview.ErrUnknownArtifact) {
		t.Errorf("error = %v, want ErrUnknownArtifact", err)
	}
}

func TestTheReviewsOfARepositoryAreCountedActiveAndArchived(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.create(t, 42)
	second := f.create(t, 43)
	if _, err := f.service.Archive(t.Context(), second.ID, prreview.PRClosed); err != nil {
		t.Fatalf("archive review: %v", err)
	}

	active, archived := f.service.Counts(f.repo.ID)
	if active != 1 || archived != 1 {
		t.Errorf("counts = %d active, %d archived, want 1 and 1", active, archived)
	}
	if _, ok := f.service.ActiveOf(f.repo.ID, 42); !ok {
		t.Error("the active review of the pull request is not found")
	}
	if _, ok := f.service.ActiveOf(f.repo.ID, 43); ok {
		t.Error("an archived review is still the active one of its pull request")
	}
}

func TestSyncLoadsTheReviewsWithThePassesOfEachOne(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	review := f.recorded(t, 42, changesReport(1, "One thing.",
		prreview.ParsedFinding{Number: 1, Text: "A thing."}), "commit-1")
	archived := f.create(t, 43)
	if _, err := f.service.Archive(t.Context(), archived.ID, prreview.PRMerged); err != nil {
		t.Fatalf("archive review: %v", err)
	}

	other := prreview.New(prreview.Deps{Store: f.store, DataDir: f.dataDir})
	if err := other.Sync(t.Context()); err != nil {
		t.Fatalf("sync: %v", err)
	}

	if got := other.List(); len(got) != 1 || got[0].ID != review.ID {
		t.Errorf("list = %v, want the active review", got)
	}
	if got := other.ListArchived(); len(got) != 1 || got[0].ID != archived.ID {
		t.Errorf("history = %v, want the archived review", got)
	}
	passes := other.Passes(review.ID)
	if len(passes) != 1 || len(passes[0].Findings) != 1 {
		t.Fatalf("passes = %v, want one pass with one finding", passes)
	}
	if diff := cmp.Diff(f.store.storedPass(t, review.ID, 1), passes[0]); diff != "" {
		t.Errorf("pass (-want +got):\n%s", diff)
	}
}

func TestAPassACallerHoldsNeverChangesUnderIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	review := f.recorded(t, 42, changesReport(1, "One thing.",
		prreview.ParsedFinding{Number: 1, Text: "A thing."}), "commit-1")

	held := f.service.Passes(review.ID)
	held[0].Findings[0].Decision = prreview.DecisionDiscarded

	if got := f.pass(t, review.ID, 1).Findings[0].Decision; got != prreview.DecisionNone {
		t.Errorf("decision = %q, want the service to keep its own copy", got)
	}
}

// publish marks a pass published, which is what the flow does after GitHub
// took the review.
func publish(t *testing.T, f *fixture, id string, pass int, placements map[int]prreview.Placement) {
	t.Helper()

	err := f.service.MarkPublished(t.Context(), id, pass, prreview.VerdictComment,
		"https://github.com/dev/web/pull/42#r1", "commit-1", placements)
	if err != nil {
		t.Fatalf("mark published: %v", err)
	}
}

func TestAPassBeforeTheLastRecordedOneIsNoLongerDecidedOn(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	review := f.recorded(t, 42, changesReport(1, "One thing.",
		prreview.ParsedFinding{Number: 1, Text: "A thing."}), "commit-1")

	if _, err := f.service.AskPass(t.Context(), review.ID, 2, ""); err != nil {
		t.Fatalf("ask pass: %v", err)
	}
	if _, _, err := f.service.RecordReport(t.Context(), review.ID, cleanReport(2, "All good."), "commit-2"); err != nil {
		t.Fatalf("record report: %v", err)
	}

	err := f.service.Decide(t.Context(), review.ID, 1, 1, prreview.DecisionDiscarded)
	if !errors.Is(err, prreview.ErrNotDeciding) {
		t.Errorf("error = %v, want ErrNotDeciding", err)
	}
}
