package reviewflow_test

import (
	gocmp "cmp"
	"errors"
	"os"
	"slices"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/reviewflow"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/worktree"
)

// linkedCard is the card the pull request of the tests was opened for.
func linkedCard() board.Card {
	return board.Card{
		Issue: board.Issue{
			Owner: "dev", Name: "web", Number: 31,
			Title: "Cache the board readings", URL: "https://github.com/dev/web/issues/31",
		},
		Body:   "The boards are read again on every visit.",
		Status: "Code review",
	}
}

func TestStartingAReviewOpensTheConversationOnTheFirstPass(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(t)

	stored, ok := f.reviews.Get(id)
	if !ok {
		t.Fatalf("review %s is not active", id)
	}
	if stored.Number != prNumber || stored.Author != prAuthor || stored.HeadBranch != "cache-boards" {
		t.Errorf("review = %+v, want the pull request that was read", stored)
	}
	if stored.Own {
		t.Error("the pull request of another person is the user's own")
	}
	if stored.AskedPass != 1 || stored.ReportedPass != 0 {
		t.Errorf("asked = %d, reported = %d, want the first pass asked", stored.AskedPass, stored.ReportedPass)
	}
	if got := f.pass(t, id, 1).Instructions; got != "look at the tests" {
		t.Errorf("instructions of the pass = %q, want what the user wrote", got)
	}

	want := []string{"ensureDetached:" + id + ":" + worktree.ReviewDirName(prNumber) + ":cache-boards:main"}
	if diff := cmp.Diff(want, f.worktrees.recorded()); diff != "" {
		t.Errorf("worktree calls (-want +got):\n%s", diff)
	}
	want = []string{"open:" + id, "start:" + id + ":restarted=false"}
	if diff := cmp.Diff(want, f.sessions.recorded()); diff != "" {
		t.Errorf("session calls (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]string{id, id}, f.changed()); diff != "" {
		t.Errorf("announced changes (-want +got):\n%s", diff)
	}
}

func TestTheConversationOfAReviewReviewsTheWorktreeAgainstTheContextDocument(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(t)

	stored, _ := f.reviews.Get(id)
	wt, _ := f.worktrees.Get(id)
	got, ok := f.sessions.info(id)
	if !ok {
		t.Fatal("the review has no conversation")
	}
	want := session.TaskInfo{
		ID:               id,
		Name:             "dev/web#42",
		Dir:              wt.Path,
		ArtifactsDir:     stored.ArtifactsDir,
		Stage:            session.ReviewStage,
		Prompt:           prompts.StagePRReview,
		ContextPath:      stored.ContextPath(),
		Repository:       "dev/web",
		Branch:           "cache-boards",
		BaseBranch:       "origin/main",
		ReviewPath:       stored.ReportPath(1),
		PRNumber:         "42",
		PRURL:            "https://github.com/dev/web/pull/42",
		External:         true,
		Publish:          true,
		Instructions:     "never change a published migration",
		PassInstructions: "look at the tests",
		Choice:           models.Choice{Model: models.Opus55, Effort: models.High},
		Checks:           &gh.PRChecks{Checks: []gh.Check{}, Mergeable: gh.MergeableClean},
		MergeBase:        "origin/main",
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("session info (-want +got):\n%s", diff)
	}
}

func TestTheContextDocumentOfAReviewHoldsThePullRequestAndItsCard(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.boards.link(prNumber, linkedCard())
	id := f.start(t)

	content, err := f.reviews.ReadArtifact(id, prreview.ContextFile)
	if err != nil {
		t.Fatalf("read context: %v", err)
	}
	want := "# Cache the board readings\n\n" +
		"- Pull request: dev/web#42\n" +
		"- Link: https://github.com/dev/web/pull/42\n" +
		"- Author: contributor\n" +
		"- Branch `cache-boards`, against `main`\n\n" +
		"## Description\n\n" +
		"Keeps the last reading of a board in memory.\n\n" +
		"## Card\n\n" + board.ReviewContext(linkedCard()) + "\n"
	if diff := cmp.Diff(want, content); diff != "" {
		t.Errorf("context document (-want +got):\n%s", diff)
	}

	stored, _ := f.reviews.Get(id)
	if stored.Card == nil || stored.Card.Number != 31 || stored.Card.Status != "Code review" {
		t.Errorf("card = %+v, want the card of the board", stored.Card)
	}
	if stored.Card.BoardID != "board-1" {
		t.Errorf("board of the card = %q, want board-1", stored.Card.BoardID)
	}
}

func TestTheContextDocumentOfAPullRequestWithoutACardSaysWhatItHas(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	empty := openPR()
	empty.Body = "  \n"
	f.pulls.seed(empty)
	id := f.start(t)

	content, err := f.reviews.ReadArtifact(id, prreview.ContextFile)
	if err != nil {
		t.Fatalf("read context: %v", err)
	}
	if strings.Contains(content, "## Card") {
		t.Errorf("the document of a pull request without a card has a card:\n%s", content)
	}
	if !strings.Contains(content, "_The pull request has no description._") {
		t.Errorf("the document says nothing about the missing description:\n%s", content)
	}
	if stored, _ := f.reviews.Get(id); stored.Card != nil {
		t.Errorf("card = %+v, want none", stored.Card)
	}
}

func TestAReviewOfAPullRequestOfTheUserCanApplyTheFindings(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.pulls.seed(ownPR())
	id := f.startMode(t, prreview.ModeApply, "")

	stored, _ := f.reviews.Get(id)
	if !stored.Own || stored.Mode != prreview.ModeApply {
		t.Errorf("review = %+v, want a review of the user's own in apply mode", stored)
	}
	info, _ := f.sessions.info(id)
	if info.Publish {
		t.Error("the prompt of apply mode publishes the findings")
	}
	if info.PassInstructions != "" {
		t.Errorf("pass instructions = %q, want none", info.PassInstructions)
	}
}

func TestStartingAReviewIsRefusedWhenThePullRequestCannotBeReviewed(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name   string
		repo   string
		mode   prreview.Mode
		setup  func(*testing.T, *fixture)
		errIs  error
		reason repository.Reason // the refusal of a repository, "" for the other cases
	}{
		{
			name:  "a repository that is not registered",
			repo:  "repo-9",
			setup: func(*testing.T, *fixture) {},
			errIs: repository.ErrNotFound,
		},
		{
			name:   "a repository without a clone",
			repo:   bareID,
			setup:  func(*testing.T, *fixture) {},
			reason: repository.ReasonNotCloned,
		},
		{
			name: "a reading of GitHub that failed",
			setup: func(_ *testing.T, f *fixture) {
				f.pulls.failWith(errGitHub)
			},
			errIs: errGitHub,
		},
		{
			name: "a pull request GitHub knows nothing about",
			setup: func(_ *testing.T, f *fixture) {
				f.pulls.forget(prNumber)
			},
			errIs: reviewflow.ErrPullRequestGone,
		},
		{
			name: "a pull request that was merged",
			setup: func(_ *testing.T, f *fixture) {
				merged := openPR()
				merged.State = "merged"
				f.pulls.seed(merged)
			},
			errIs: reviewflow.ErrNotOpen,
		},
		{
			name: "a pull request from a fork",
			setup: func(_ *testing.T, f *fixture) {
				forked := openPR()
				forked.Fork = true
				f.pulls.seed(forked)
			},
			errIs: reviewflow.ErrFork,
		},
		{
			name: "a pull request of a task of the product",
			setup: func(_ *testing.T, f *fixture) {
				f.ownTaskPR(prNumber)
			},
			errIs: reviewflow.ErrTaskPullRequest,
		},
		{
			name: "a pull request that already has a review",
			setup: func(t *testing.T, f *fixture) {
				t.Helper()
				f.start(t)
			},
			errIs: prreview.ErrActiveExists,
		},
		{
			name:  "apply mode on a pull request of another person",
			mode:  prreview.ModeApply,
			setup: func(*testing.T, *fixture) {},
			errIs: reviewflow.ErrApplyNotOwn,
		},
		{
			name: "a worktree git could not create",
			setup: func(_ *testing.T, f *fixture) {
				f.worktrees.failEnsure(errGit)
			},
			errIs: errGit,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			c.setup(t, f)

			id, err := f.service.Start(t.Context(), reviewflow.StartParams{
				RepositoryID: gocmp.Or(c.repo, repoID),
				Number:       prNumber,
				Mode:         gocmp.Or(c.mode, prreview.ModePublish),
			})
			if id != "" {
				t.Errorf("review id = %q, want none", id)
			}
			if c.reason != "" {
				var refusal *repository.Refusal
				if !errors.As(err, &refusal) || refusal.Reason != c.reason {
					t.Fatalf("error = %v, want a refusal with reason %q", err, c.reason)
				}
				return
			}
			wantErrIs(t, err, c.errIs)
		})
	}
}

func TestAWorktreeThatCannotBeCreatedLeavesNoReviewBehind(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.worktrees.failEnsure(errGit)

	if _, err := f.service.Start(t.Context(), reviewflow.StartParams{
		RepositoryID: repoID, Number: prNumber, Mode: prreview.ModePublish,
	}); err == nil {
		t.Fatal("a worktree git refused started a review")
	}
	if got := f.reviews.List(); len(got) != 0 {
		t.Errorf("reviews = %+v, want none", got)
	}
	dir := prreview.ArtifactsDir(f.dataDir, "dev", "web", prNumber, "review-1")
	if _, err := os.Stat(dir); !os.IsNotExist(err) {
		t.Errorf("the artifacts folder %s is still there", dir)
	}
}

func TestAConversationThatCannotStartLeavesNoReviewBehind(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.sessions.failStart(errGitHub)

	id, err := f.service.Start(t.Context(), reviewflow.StartParams{
		RepositoryID: repoID, Number: prNumber, Mode: prreview.ModePublish,
	})
	wantErrIs(t, err, errGitHub)
	if id != "" {
		t.Errorf("review id = %q, want none", id)
	}
	// A review left half started could neither start again nor take another
	// pass: it goes with its conversation and its worktree.
	if got := f.reviews.List(); len(got) != 0 {
		t.Errorf("reviews = %+v, want none", got)
	}
	if !slices.Contains(f.sessions.recorded(), "discardTask:review-1") {
		t.Errorf("session calls = %v, want the conversation thrown away", f.sessions.recorded())
	}
	if exists, _ := f.sessions.Exists(t.Context(), session.Key{TaskID: "review-1", Stage: session.ReviewStage}); exists {
		t.Error("the conversation of the review is still recorded")
	}
	if _, ok := f.worktrees.Get("review-1"); ok {
		t.Error("the worktree of the review is still there")
	}
	dir := prreview.ArtifactsDir(f.dataDir, "dev", "web", prNumber, "review-1")
	if _, err = os.Stat(dir); !os.IsNotExist(err) {
		t.Errorf("the artifacts folder %s is still there", dir)
	}

	// Nothing is in the way of starting the review again.
	f.sessions.failStart(nil)
	if _, err = f.service.Start(t.Context(), reviewflow.StartParams{
		RepositoryID: repoID, Number: prNumber, Mode: prreview.ModePublish,
	}); err != nil {
		t.Fatalf("start review again: %v", err)
	}
}

func TestTheDetailsOfAPullRequestAreReadFromGitHubEveryTime(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	moved := openPR()
	moved.HeadCommit = otherHash
	moved.Title = "Cache the board readings, at last"
	f.pulls.seed(moved)

	id := f.start(t)

	stored, _ := f.reviews.Get(id)
	if stored.HeadCommit != otherHash || stored.Title != moved.Title {
		t.Errorf("review = %+v, want the pull request as GitHub has it now", stored)
	}
}
