package store_test

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/store"
)

// newReview builds the review of a pull request of a repository, ready to
// insert.
func newReview(id, repositoryID string, number int, created time.Time) prreview.Review {
	return prreview.Review{
		ID:           id,
		RepositoryID: repositoryID,
		Number:       number,
		Title:        "Read the boards of the user",
		Author:       "colleague",
		URL:          "https://github.com/dev/web/pull/7",
		HeadBranch:   "boards",
		BaseBranch:   "main",
		Mode:         prreview.ModePublish,
		ArtifactsDir: "/data/reviews/dev/web/pr-7-abcdef12",
		HeadCommit:   "c0ffee",
		PRState:      prreview.PROpen,
		CreatedAt:    created,
		UpdatedAt:    created,
	}
}

// newPass builds a pass of a review with its findings, ready to upsert.
func newPass(reviewID string, number int, findings ...prreview.Finding) prreview.Pass {
	return prreview.Pass{
		ReviewID:        reviewID,
		Number:          number,
		Instructions:    "look at the migration",
		Recorded:        true,
		Commit:          "c0ffee",
		SummaryOriginal: "Two things to fix.",
		Summary:         "Two things to fix.",
		Revision:        1,
		Findings:        findings,
		CreatedAt:       fixedTime,
	}
}

// newFinding builds a finding anchored to a file and a line.
func newFinding(number int, path string, line int) prreview.Finding {
	text := "the line is wrong"
	return prreview.Finding{Number: number, Path: path, Line: line, Original: text, Text: text}
}

// insertReview stores a review, failing the test on error.
func insertReview(t *testing.T, s *store.Store, review prreview.Review) {
	t.Helper()

	if err := s.Reviews.Insert(t.Context(), review); err != nil {
		t.Fatalf("Insert(%s) = %v, want nil", review.ID, err)
	}
}

// listActiveReviews reads the active reviews, failing the test on error.
func listActiveReviews(t *testing.T, s *store.Store) []prreview.Review {
	t.Helper()

	list, err := s.Reviews.ListActive(t.Context())
	if err != nil {
		t.Fatalf("ListActive() = %v, want nil", err)
	}
	return list
}

// passesOf reads the passes of a review, failing the test on error.
func passesOf(t *testing.T, s *store.Store, reviewID string) []prreview.Pass {
	t.Helper()

	passes, err := s.Reviews.Passes(t.Context(), reviewID)
	if err != nil {
		t.Fatalf("Passes(%s) = %v, want nil", reviewID, err)
	}
	return passes
}

// seedPass stores a pass with its findings, failing the test on error.
func seedPass(t *testing.T, s *store.Store, pass prreview.Pass) {
	t.Helper()

	if err := s.Reviews.WritePass(t.Context(), pass, nil); err != nil {
		t.Fatalf("WritePass(%d) = %v, want nil", pass.Number, err)
	}
}

func TestReviewsInsertAndListActive(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	want := newReview("review-1", webRepo, 7, fixedTime)
	insertReview(t, s, want)

	if diff := cmp.Diff([]prreview.Review{want}, listActiveReviews(t, s)); diff != "" {
		t.Errorf("ListActive() mismatch (-want +got):\n%s", diff)
	}
}

func TestTheCardOfAReviewRoundTrips(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	want := newReview("review-1", webRepo, 7, fixedTime)
	want.Card = &prreview.Card{
		BoardID: "board-1",
		Owner:   "dev",
		Name:    "web",
		Number:  42,
		Title:   "Read the boards",
		URL:     "https://github.com/dev/web/issues/42",
		Status:  "Code review",
	}
	insertReview(t, s, want)

	if diff := cmp.Diff([]prreview.Review{want}, listActiveReviews(t, s)); diff != "" {
		t.Errorf("ListActive() mismatch (-want +got):\n%s", diff)
	}
}

func TestTheTroubleOfAReviewRoundTrips(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	want := newReview("review-1", webRepo, 7, fixedTime)
	want.TroubleBaseline = gh.Trouble{FailedChecks: []string{"lint"}}
	want.Trouble = gh.Trouble{FailedChecks: []string{"build", "test"}, Conflict: true}
	insertReview(t, s, want)

	if diff := cmp.Diff([]prreview.Review{want}, listActiveReviews(t, s)); diff != "" {
		t.Errorf("ListActive() mismatch (-want +got):\n%s", diff)
	}

	// A trouble with nothing wrong is stored as nothing and read back as the
	// zero value.
	want.TroubleBaseline = gh.Trouble{FailedChecks: []string{}}
	want.Trouble = gh.Trouble{}
	if err := s.Reviews.Update(t.Context(), want); err != nil {
		t.Fatalf("Update() = %v, want nil", err)
	}
	want.TroubleBaseline = gh.Trouble{}
	if diff := cmp.Diff([]prreview.Review{want}, listActiveReviews(t, s)); diff != "" {
		t.Errorf("ListActive() after clearing mismatch (-want +got):\n%s", diff)
	}
}

func TestReviewsListActiveIsInCreationOrder(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	later := fixedTime.Add(time.Hour)
	first := newReview("review-1", webRepo, 7, fixedTime)
	second := newReview("review-2", apiRepo, 3, later)
	for _, review := range []prreview.Review{second, first} {
		insertReview(t, s, review)
	}

	want := []prreview.Review{first, second}
	if diff := cmp.Diff(want, listActiveReviews(t, s)); diff != "" {
		t.Errorf("ListActive() mismatch (-want +got):\n%s", diff)
	}
}

func TestAnArchivedReviewLeavesTheActiveOnesAndComesBackNewestFirst(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	older := newReview("review-1", webRepo, 7, fixedTime)
	newer := newReview("review-2", apiRepo, 3, fixedTime)
	active := newReview("review-3", webRepo, 9, fixedTime)
	for _, review := range []prreview.Review{older, newer, active} {
		insertReview(t, s, review)
	}

	archived := fixedTime.Add(time.Hour)
	for i, review := range []prreview.Review{older, newer} {
		at := archived.Add(time.Duration(i) * time.Hour)
		if err := s.Reviews.UpdateArchived(t.Context(), review.ID, at, at); err != nil {
			t.Fatalf("UpdateArchived(%s) = %v, want nil", review.ID, err)
		}
	}

	if diff := cmp.Diff([]prreview.Review{active}, listActiveReviews(t, s)); diff != "" {
		t.Errorf("ListActive() mismatch (-want +got):\n%s", diff)
	}

	older.ArchivedAt, older.UpdatedAt = archived, archived
	newer.ArchivedAt, newer.UpdatedAt = archived.Add(time.Hour), archived.Add(time.Hour)
	got, err := s.Reviews.ListArchived(t.Context())
	if err != nil {
		t.Fatalf("ListArchived() = %v, want nil", err)
	}
	if diff := cmp.Diff([]prreview.Review{newer, older}, got); diff != "" {
		t.Errorf("ListArchived() mismatch (-want +got):\n%s", diff)
	}
}

func TestUpdateRewritesTheMutableColumnsOfAReviewAndLeavesItArchived(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	want := newReview("review-1", webRepo, 7, fixedTime)
	insertReview(t, s, want)

	archived := fixedTime.Add(time.Hour)
	if err := s.Reviews.UpdateArchived(t.Context(), want.ID, archived, archived); err != nil {
		t.Fatalf("UpdateArchived() = %v, want nil", err)
	}

	checked := fixedTime.Add(2 * time.Hour)
	want.Title = "Read the boards of the user, at last"
	want.Author = "someone else"
	want.URL = "https://github.com/dev/web/pull/8"
	want.HeadBranch = "boards-again"
	want.BaseBranch = "dev"
	want.Own = true
	want.Mode = prreview.ModeApply
	want.Phase = prreview.PhaseApplying
	want.Card = &prreview.Card{BoardID: "board-1", Owner: "dev", Name: "web", Number: 42}
	want.AskedPass, want.ReportedPass, want.PassCommit = 2, 2, "beef"
	want.PublishedPass, want.PublishedCommit = 1, "c0ffee"
	want.HeadCommit = "beef"
	want.PRState = prreview.PRMerged
	want.PRCheckedAt = checked
	want.PublishError = "gh: not authenticated"
	want.TroubleBaseline = gh.Trouble{Conflict: true}
	want.Trouble = gh.Trouble{FailedChecks: []string{"test"}}
	want.UpdatedAt = checked
	if err := s.Reviews.Update(t.Context(), want); err != nil {
		t.Fatalf("Update() = %v, want nil", err)
	}

	// Update writes no archived_at: the review the archive put away stays away.
	want.ArchivedAt = archived
	got, err := s.Reviews.ListArchived(t.Context())
	if err != nil {
		t.Fatalf("ListArchived() = %v, want nil", err)
	}
	if diff := cmp.Diff([]prreview.Review{want}, got); diff != "" {
		t.Errorf("ListArchived() mismatch (-want +got):\n%s", diff)
	}
}

func TestThePassesOfAReviewComeInOrderWithTheirFindings(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	review := newReview("review-1", webRepo, 7, fixedTime)
	insertReview(t, s, review)

	general := prreview.Finding{Number: 3, Original: "no test", Text: "no test"}
	first := newPass(review.ID, 1, newFinding(2, "internal/store/reviews.go", 12), newFinding(1, "main.go", 3), general)
	second := newPass(review.ID, 2)
	second.Clean = true
	second.Summary = "Everything of the first pass is resolved."
	for _, pass := range []prreview.Pass{second, first} {
		seedPass(t, s, pass)
	}

	first.Findings = []prreview.Finding{first.Findings[1], first.Findings[0], general}
	if diff := cmp.Diff([]prreview.Pass{first, second}, passesOf(t, s, review.ID)); diff != "" {
		t.Errorf("Passes() mismatch (-want +got):\n%s", diff)
	}
}

func TestUpsertPassRewritesWhatThePassHolds(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	review := newReview("review-1", webRepo, 7, fixedTime)
	insertReview(t, s, review)
	pass := newPass(review.ID, 1, newFinding(1, "main.go", 3))
	seedPass(t, s, pass)

	published := fixedTime.Add(time.Hour)
	pass.Summary = "as the user left it"
	pass.Revision = 2
	pass.Verdict = prreview.VerdictRequestChanges
	pass.PublishedAt = published
	pass.PublishedURL = "https://github.com/dev/web/pull/7#pullrequestreview-1"
	pass.Applied = true
	if err := s.Reviews.UpsertPass(t.Context(), pass); err != nil {
		t.Fatalf("UpsertPass() = %v, want nil", err)
	}

	if diff := cmp.Diff([]prreview.Pass{pass}, passesOf(t, s, review.ID)); diff != "" {
		t.Errorf("Passes() mismatch (-want +got):\n%s", diff)
	}
}

func TestWritePassRewritesTheWholeSetOfFindingsOfAPass(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	review := newReview("review-1", webRepo, 7, fixedTime)
	insertReview(t, s, review)
	pass := newPass(review.ID, 1, newFinding(1, "main.go", 3), newFinding(2, "go.mod", 8))
	seedPass(t, s, pass)

	pass.Findings = []prreview.Finding{newFinding(1, "main.go", 4)}
	pass.Revision = 2
	if err := s.Reviews.WritePass(t.Context(), pass, nil); err != nil {
		t.Fatalf("WritePass() = %v, want nil", err)
	}

	if diff := cmp.Diff([]prreview.Pass{pass}, passesOf(t, s, review.ID)); diff != "" {
		t.Errorf("Passes() mismatch (-want +got):\n%s", diff)
	}
}

func TestWritePassMovesTheReviewWithThePass(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	review := newReview("review-1", webRepo, 7, fixedTime)
	insertReview(t, s, review)

	pass := newPass(review.ID, 1, newFinding(1, "main.go", 3))
	review.ReportedPass, review.PassCommit = 1, pass.Commit
	review.UpdatedAt = fixedTime.Add(time.Minute)
	if err := s.Reviews.WritePass(t.Context(), pass, &review); err != nil {
		t.Fatalf("WritePass() = %v, want nil", err)
	}

	if diff := cmp.Diff([]prreview.Pass{pass}, passesOf(t, s, review.ID)); diff != "" {
		t.Errorf("Passes() mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]prreview.Review{review}, listActiveReviews(t, s)); diff != "" {
		t.Errorf("ListActive() mismatch (-want +got):\n%s", diff)
	}
}

func TestAFailedWritePassLeavesThePassItsFindingsAndTheReviewAsTheyWere(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	review := newReview("review-1", webRepo, 7, fixedTime)
	insertReview(t, s, review)
	pass := newPass(review.ID, 1, newFinding(1, "main.go", 3))
	seedPass(t, s, pass)

	// Two findings with the same number break the write after the pass is
	// rewritten and before the review is.
	rewritten := pass
	rewritten.Revision = 2
	rewritten.Findings = []prreview.Finding{newFinding(1, "main.go", 4), newFinding(1, "go.mod", 8)}
	moved := review
	moved.ReportedPass = 1
	if err := s.Reviews.WritePass(t.Context(), rewritten, &moved); err == nil {
		t.Fatal("WritePass() = nil, want the duplicated finding refused")
	}

	if diff := cmp.Diff([]prreview.Pass{pass}, passesOf(t, s, review.ID)); diff != "" {
		t.Errorf("Passes() mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]prreview.Review{review}, listActiveReviews(t, s)); diff != "" {
		t.Errorf("ListActive() mismatch (-want +got):\n%s", diff)
	}
}

func TestUpdateFindingWritesTheDecisionOfTheUserAndWhereItWasPublished(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	review := newReview("review-1", webRepo, 7, fixedTime)
	insertReview(t, s, review)
	pass := newPass(review.ID, 1, newFinding(1, "main.go", 3), newFinding(2, "go.mod", 8))
	seedPass(t, s, pass)

	decided := pass.Findings[0]
	decided.Text = "as the user rewrote it"
	decided.Decision = prreview.DecisionApproved
	decided.Placement = prreview.PlacementBody
	if err := s.Reviews.UpdateFinding(t.Context(), review.ID, pass.Number, decided); err != nil {
		t.Fatalf("UpdateFinding() = %v, want nil", err)
	}

	pass.Findings[0] = decided
	if diff := cmp.Diff([]prreview.Pass{pass}, passesOf(t, s, review.ID)); diff != "" {
		t.Errorf("Passes() mismatch (-want +got):\n%s", diff)
	}
}

func TestDeletingAReviewTakesItsPassesAndFindings(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	review := newReview("review-1", webRepo, 7, fixedTime)
	insertReview(t, s, review)
	seedPass(t, s, newPass(review.ID, 1, newFinding(1, "main.go", 3)))

	if err := s.Reviews.Delete(t.Context(), review.ID); err != nil {
		t.Fatalf("Delete() = %v, want nil", err)
	}
	if err := s.Reviews.Delete(t.Context(), "review-missing"); err != nil {
		t.Fatalf("Delete(missing) = %v, want nil", err)
	}

	if got := listActiveReviews(t, s); len(got) != 0 {
		t.Errorf("ListActive() = %v, want nothing left", got)
	}
	if got := passesOf(t, s, review.ID); len(got) != 0 {
		t.Errorf("Passes() = %v, want the passes gone with the review", got)
	}
}

func TestDeletingAPassTakesItsFindingsAndLeavesTheOtherPasses(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	review := newReview("review-1", webRepo, 7, fixedTime)
	insertReview(t, s, review)
	first := newPass(review.ID, 1, newFinding(1, "main.go", 3))
	second := newPass(review.ID, 2, newFinding(1, "go.mod", 8))
	seedPass(t, s, first)
	seedPass(t, s, second)

	if err := s.Reviews.DeletePass(t.Context(), review.ID, second.Number); err != nil {
		t.Fatalf("DeletePass() = %v, want nil", err)
	}

	if diff := cmp.Diff([]prreview.Pass{first}, passesOf(t, s, review.ID)); diff != "" {
		t.Errorf("Passes() mismatch (-want +got):\n%s", diff)
	}
}

func TestTheColumnsOfTheReviewScreenRoundTrip(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	review := newReview("review-1", webRepo, 7, fixedTime)
	review.MergedBy = "rsouza"
	review.MergedAt = fixedTime.Add(time.Hour)
	review.ClosedAt = fixedTime.Add(time.Hour)
	insertReview(t, s, review)

	finding := newFinding(1, "main.go", 3)
	finding.Title = "The token is never cleared"
	pass := newPass(review.ID, 1, finding)
	pass.Checks = []gh.Check{{Name: "build", Conclusion: "success", State: gh.CheckPassed, StartedAt: fixedTime, CompletedAt: fixedTime.Add(time.Minute)}}
	pass.Mergeable = gh.MergeableConflicting
	pass.ChecksReadAt = fixedTime.Add(2 * time.Hour)
	pass.RecordedAt = fixedTime.Add(3 * time.Hour)
	pass.SentAt = fixedTime.Add(4 * time.Hour)
	pass.SummaryPublished = true
	seedPass(t, s, pass)

	if diff := cmp.Diff([]prreview.Review{review}, listActiveReviews(t, s)); diff != "" {
		t.Errorf("ListActive() mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]prreview.Pass{pass}, passesOf(t, s, review.ID)); diff != "" {
		t.Errorf("Passes() mismatch (-want +got):\n%s", diff)
	}
}

func TestUpdateFindingTitlesRewritesOnlyTheTitles(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	review := newReview("review-1", webRepo, 7, fixedTime)
	insertReview(t, s, review)
	first, second := newFinding(1, "main.go", 3), newFinding(2, "main.go", 9)
	first.Title = "Old"
	first.Decision = prreview.DecisionApproved
	first.Text = "as the user left it"
	seedPass(t, s, newPass(review.ID, 1, first, second))

	titles := map[int]string{1: "New", 2: "Second"}
	if err := s.Reviews.UpdateFindingTitles(t.Context(), review.ID, 1, titles); err != nil {
		t.Fatalf("UpdateFindingTitles() = %v, want nil", err)
	}

	first.Title, second.Title = "New", "Second"
	want := []prreview.Finding{first, second}
	if diff := cmp.Diff(want, passesOf(t, s, review.ID)[0].Findings); diff != "" {
		t.Errorf("findings mismatch (-want +got):\n%s", diff)
	}
}
