package bindings_test

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/bindings"
)

// webPullRequests is one answer of GitHub for every query of a reading: the
// account gh is logged in as, and the open pull requests of dev/web.
const webPullRequests = `{
  "viewer": { "login": "dev" },
  "r0": {
    "pullRequests": {
      "nodes": [
        {
          "number": 7,
          "title": "Add the login screen",
          "url": "https://github.com/dev/web/pull/7",
          "isDraft": false,
          "isCrossRepository": false,
          "updatedAt": "2026-09-16T11:30:00Z",
          "headRefName": "login",
          "headRefOid": "abc123",
          "baseRefName": "main",
          "author": { "login": "alice" },
          "labels": { "nodes": [{ "name": "frontend", "color": "0e8a16" }] },
          "reviews": { "nodes": [] }
        }
      ]
    }
  }
}`

func TestRefreshPullRequestsPutsTheOpenPullRequestsOfARepositoryInTheState(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	f.github.reply(webPullRequests)

	f.reviewSvc.RefreshPullRequests()
	center := f.waitReviewCenter(t)

	if len(center.PullRequests) != 1 {
		t.Fatalf("pullRequests = %+v, want the one of dev/web", center.PullRequests)
	}
	row := center.PullRequests[0]
	if row.Number != 7 || row.Author != "alice" || row.Repository != "dev/web" {
		t.Errorf("row = %+v, want dev/web#7 by alice", row)
	}
	if !row.Pending || row.Action != "review" || center.PendingCount != 1 {
		t.Errorf("row = %+v with %d pending, want a pending row to review", row, center.PendingCount)
	}
	if diff := cmp.Diff([]string{"alice"}, center.Authors); diff != "" {
		t.Errorf("authors (-want +got):\n%s", diff)
	}
}

func TestSetReviewFiltersChoosesWhatTheReviewsViewShows(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	repoID := f.register(t, t.TempDir())

	filters := bindings.ReviewFilters{
		RepositoryID:   repoID,
		AuthorsExclude: []string{"dependabot", " dependabot ", ""},
		PendingOnly:    true,
	}
	if err := f.reviewSvc.SetReviewFilters(filters); err != nil {
		t.Fatalf("SetReviewFilters() = %v, want nil", err)
	}

	got := f.state.GetState().ReviewCenter.Filters
	want := bindings.ReviewFilters{
		RepositoryID:   repoID,
		AuthorsInclude: []string{},
		AuthorsExclude: []string{"dependabot"},
		LabelsInclude:  []string{},
		LabelsExclude:  []string{},
		PendingOnly:    true,
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("filters (-want +got):\n%s", diff)
	}
}

func TestDecidingOnTheFindingsOfAPassReachesTheState(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	repoID := f.register(t, t.TempDir())
	review := f.seedReview(t, repoID)

	if err := f.reviewSvc.DecideFinding(review.ID, 1, 1, "approved"); err != nil {
		t.Fatalf("DecideFinding() = %v, want nil", err)
	}
	if err := f.reviewSvc.DecideFinding(review.ID, 1, 2, "discarded"); err != nil {
		t.Fatalf("DecideFinding() = %v, want nil", err)
	}
	if err := f.reviewSvc.SetFindingText(review.ID, 1, 1, "Handle the error of the login call."); err != nil {
		t.Fatalf("SetFindingText() = %v, want nil", err)
	}
	if err := f.reviewSvc.SetReviewSummary(review.ID, 1, "Almost there."); err != nil {
		t.Fatalf("SetReviewSummary() = %v, want nil", err)
	}

	got := f.reviewOf(t, review.ID)
	if len(got.Passes) != 1 {
		t.Fatalf("passes = %+v, want the first one", got.Passes)
	}
	pass := got.Passes[0]
	if pass.Summary != "Almost there." {
		t.Errorf("summary = %q, want the one the user wrote", pass.Summary)
	}
	if diff := cmp.Diff(
		[]bindings.ReviewFinding{
			{Number: 1, Path: "main.go", Line: 12, Text: "Handle the error of the login call.", Decision: "approved"},
			{Number: 2, Text: "The pull request has no tests.", Decision: "discarded"},
		},
		pass.Findings,
	); diff != "" {
		t.Errorf("findings (-want +got):\n%s", diff)
	}
	if got.Status != "ready_to_publish" || !got.CanPublish {
		t.Errorf("review = status %q, canPublish %v, want a review ready to publish", got.Status, got.CanPublish)
	}
}

func TestDecidingOnAFindingIsRefusedWhileAnotherPassIsRunning(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	repoID := f.register(t, t.TempDir())
	review := f.seedReview(t, repoID)
	// A second pass was asked for and its report has not landed: what the agent
	// writes could still rewrite the findings under the user.
	if _, err := f.prReviews.AskPass(t.Context(), review.ID, 2, ""); err != nil {
		t.Fatalf("AskPass() = %v, want nil", err)
	}

	err := f.reviewSvc.DecideFinding(review.ID, 1, 1, "approved")

	if err == nil || err.Error() != "Wait for the pass under way to finish." {
		t.Errorf("DecideFinding() = %v, want the sentence about the pass under way", err)
	}
	if err = f.reviewSvc.DecideFinding(review.ID, 1, 1, "maybe"); err == nil {
		t.Error("DecideFinding(maybe) = nil, want an unknown decision")
	}
	if err = f.reviewSvc.SetFindingText(review.ID, 1, 1, "Anything."); err == nil {
		t.Error("SetFindingText() = nil, want the same refusal while a pass runs")
	}
	if err = f.reviewSvc.SetReviewSummary(review.ID, 1, "Anything."); err == nil {
		t.Error("SetReviewSummary() = nil, want the same refusal while a pass runs")
	}
}

func TestPublishingAReviewIsRefusedUntilItIsReady(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	repoID := f.register(t, t.TempDir())
	review := f.seedReview(t, repoID)
	f.seedWorktree(t, review.ID, t.TempDir())

	if err := f.reviewSvc.PublishReview(review.ID, "lgtm"); err == nil {
		t.Error("PublishReview(lgtm) = nil, want an unknown verdict")
	}
	err := f.reviewSvc.PublishReview(review.ID, "approve")
	if err == nil || err.Error() != "The review isn't ready for that." {
		t.Errorf("PublishReview() = %v, want the sentence about a review that is not ready", err)
	}
}

func TestStartingAReviewIsRefusedWithAModelTheAppDoesNotKnow(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	repoID := f.register(t, t.TempDir())

	req := bindings.StartReviewRequest{RepositoryID: repoID, Number: 7, Model: "gpt", Effort: "high", Mode: "publish"}
	if _, err := f.reviewSvc.StartReview(req); err == nil || err.Error() != "Unknown model." {
		t.Errorf("StartReview(gpt) = %v, want the sentence about an unknown model", err)
	}

	req = bindings.StartReviewRequest{RepositoryID: repoID, Number: 7, Model: "claude-opus-5", Effort: "high", Mode: "ship"}
	if _, err := f.reviewSvc.StartReview(req); err == nil || err.Error() != "Unknown review mode." {
		t.Errorf("StartReview(ship) = %v, want the sentence about an unknown mode", err)
	}
}

func TestReadingAnArtifactOfAReviewReturnsTheReportOfThePass(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	repoID := f.register(t, t.TempDir())
	review := f.seedReview(t, repoID)

	content, err := f.reviewSvc.ReadReviewArtifact(review.ID, "review-1.md")
	if err != nil {
		t.Fatalf("ReadReviewArtifact() = %v, want nil", err)
	}
	if !strings.Contains(content, "# Review 1") {
		t.Errorf("content = %q, want the report of the first pass", content)
	}
	if _, err = f.reviewSvc.ReadReviewArtifact(review.ID, "secrets.txt"); err == nil {
		t.Error("ReadReviewArtifact(secrets.txt) = nil, want an unknown artifact")
	}
}

func TestOpeningAReviewAndAFindingInTheEditor(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	repoID := f.register(t, t.TempDir())
	review := f.seedReview(t, repoID)
	path := filepath.Join(f.dataDir, "worktrees", "dev", "web", "pr_7")

	if err := f.reviewSvc.OpenReviewInEditor(review.ID); err == nil ||
		err.Error() != "The worktree of the review is gone." {
		t.Errorf("OpenReviewInEditor() = %v, want the sentence about a missing worktree", err)
	}

	f.seedWorktree(t, review.ID, path)

	if err := f.reviewSvc.OpenReviewInEditor(review.ID); err != nil {
		t.Fatalf("OpenReviewInEditor() = %v, want nil", err)
	}
	if err := f.reviewSvc.OpenFindingInEditor(review.ID, 1, 1); err != nil {
		t.Fatalf("OpenFindingInEditor() = %v, want nil", err)
	}

	want := []string{path, path + " -g " + filepath.Join(path, "main.go") + ":12"}
	if diff := cmp.Diff(want, f.editor.opened()); diff != "" {
		t.Errorf("what the editor was asked to open (-want +got):\n%s", diff)
	}
}

func TestOpeningAFindingAboutThePullRequestAsAWholeIsRefused(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	repoID := f.register(t, t.TempDir())
	review := f.seedReview(t, repoID)
	f.seedWorktree(t, review.ID, t.TempDir())

	err := f.reviewSvc.OpenFindingInEditor(review.ID, 1, 2)

	if err == nil || err.Error() != "This finding isn't about a line of the pull request." {
		t.Errorf("OpenFindingInEditor(general) = %v, want the sentence about a finding of no file", err)
	}
	if err = f.reviewSvc.OpenFindingInEditor(review.ID, 1, 9); err == nil ||
		err.Error() != "This finding no longer exists." {
		t.Errorf("OpenFindingInEditor(unknown finding) = %v, want the sentence about a finding that is gone", err)
	}
	if err = f.reviewSvc.OpenFindingInEditor("gone", 1, 1); err == nil ||
		err.Error() != "This review no longer exists." {
		t.Errorf("OpenFindingInEditor(unknown review) = %v, want the sentence about a review that is gone", err)
	}
	if opened := f.editor.opened(); len(opened) != 0 {
		t.Errorf("the editor was asked to open %v, want nothing", opened)
	}
}

func TestDeletingAReviewTakesItOutOfTheState(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	repoID := f.register(t, t.TempDir())
	review := f.seedReview(t, repoID)

	result, err := f.reviewSvc.DeleteReview(review.ID)
	if err != nil {
		t.Fatalf("DeleteReview() = %v, want nil", err)
	}

	if result.Leftover != nil {
		t.Errorf("leftover = %+v, want nil: the review had no worktree", result.Leftover)
	}
	if reviews := f.state.GetState().Reviews; len(reviews) != 0 {
		t.Errorf("reviews = %+v, want none left", reviews)
	}
	if _, err = f.reviewSvc.DeleteReview(review.ID); err == nil ||
		err.Error() != "This review no longer exists." {
		t.Errorf("DeleteReview() = %v, want the sentence about a review that is gone", err)
	}
}

func TestTheConversationOfAReviewThatHasNotOpenedYetIsEmpty(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	repoID := f.register(t, t.TempDir())
	review := f.seedReview(t, repoID)

	transcript, err := f.tasks.GetTranscript(review.ID, "review")
	if err != nil {
		t.Fatalf("GetTranscript() = %v, want nil", err)
	}

	if transcript.TaskID != review.ID || len(transcript.Entries) != 0 || transcript.Entries == nil {
		t.Errorf("transcript = %+v, want an empty conversation of the review", transcript)
	}
	if _, err = f.tasks.GetTranscript("nobody", "review"); err == nil {
		t.Error("GetTranscript(nobody) = nil, want the conversation of no item to fail")
	}
}
