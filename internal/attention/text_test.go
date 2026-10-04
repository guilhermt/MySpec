package attention

import (
	"testing"

	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/task"
)

func TestNotificationBodies(t *testing.T) {
	t.Parallel()

	overage := discussion.Draft{Title: "Overage on the monthly invoice", PublishError: "GitHub's rate limit was reached. It resets at 15:04."}
	tiers := discussion.Draft{Title: "Usage-based pricing tiers", PublishError: "Couldn't write to GitHub: HTTP 502"}

	tests := []struct {
		name string
		got  string
		want string
	}{
		// The conversation of a place, in the eight places.
		{"question in the PRD", sessionBody(KindQuestion, placeName(Place{Kind: PlaceStage, Stage: task.StagePRD}, false)), "The agent has a question in the PRD."},
		{"question in the tech spec", sessionBody(KindQuestion, placeName(Place{Kind: PlaceStage, Stage: task.StageTechSpec}, false)), "The agent has a question in the tech spec."},
		{"question in the plan", sessionBody(KindQuestion, placeName(Place{Kind: PlaceStage, Stage: task.StagePlan}, false)), "The agent has a question in the plan."},
		{"question in One-Shot planning", sessionBody(KindQuestion, placeName(Place{Kind: PlaceStage, Stage: task.StageOneShot}, false)), "The agent has a question in One-Shot planning."},
		{"question in a step", sessionBody(KindQuestion, placeName(Place{Kind: PlaceStep, Step: 3}, false)), "The agent has a question in step 3."},
		{"question in the pull request", sessionBody(KindQuestion, placeName(Place{Kind: PlacePR}, false)), "The agent has a question in the pull request."},
		{"question in the review of the PR stage", sessionBody(KindQuestion, placeName(Place{Kind: PlacePR}, true)), "The agent has a question in the review."},
		{"question in the review", sessionBody(KindQuestion, placeName(Place{Kind: PlaceReview}, false)), "The agent has a question in the review."},
		{"question in the discussion", sessionBody(KindQuestion, placeName(Place{Kind: PlaceDiscussion}, false)), "The agent has a question in the discussion."},
		{"permission in a step", sessionBody(KindPermission, "step 3"), "Permission requested in step 3."},
		{"permission in the review of the PR stage", sessionBody(KindPermission, placeName(Place{Kind: PlacePR}, true)), "Permission requested in the review."},
		{"reply in the PRD", sessionBody(KindReply, "the PRD"), "The agent is waiting for your reply in the PRD."},
		{"session error in a step", sessionBody(KindSessionError, placeName(Place{Kind: PlaceStep, Step: 3}, false)), "The session stopped with an error in step 3."},
		{"session error in the pull request", sessionBody(KindSessionError, "the pull request"), "The session stopped with an error in the pull request."},

		// The reviewer of a step.
		{"reviewer question", reviewerBody(KindQuestion, 3), "The reviewer of step 3 has a question."},
		{"reviewer permission", reviewerBody(KindPermission, 3), "The reviewer of step 3 asks for a permission."},
		{"reviewer without report", reviewerBody(KindReply, 3), "The reviewer of step 3 stopped without writing its report."},
		{"reviewer error", reviewerBody(KindSessionError, 3), "The review of step 3 stopped with an error."},

		// The stages.
		{"plan invalid", planInvalidBody(3), "The plan is still invalid after 3 automatic corrections."},
		{"ready to continue", readyToContinueBody(task.StageTechSpec), "The tech spec is revised and ready to continue."},
		{"ready to continue one-shot", readyToContinueBody(task.StageOneShot), "The One-Shot document is revised and ready to continue."},

		// The steps.
		{"step blocked", stepBlockedBody(5, task.BlockDirty), "Step 5 can't start: the worktree has uncommitted changes."},
		{"worktree unreadable", worktreeUnreadableBody(3), "Step 3: the worktree can't be read."},
		{"step to review", stepReviewBody(4, FormReview, false, "", 7), "Step 4 is ready for your review. 7 files changed."},
		{"step to review, one file", stepReviewBody(4, FormReview, false, "", 1), "Step 4 is ready for your review. 1 file changed."},
		{"step to review, no reading", stepReviewBody(4, FormReview, false, "", -1), "Step 4 is ready for your review."},
		{"no commit after approval", stepReviewBody(4, FormApprove, true, "", 7), "Step 4: the last approval didn't produce a commit."},
		{"no commit fallback", stepReviewBody(4, FormReview, true, task.FallbackNoCommit, 7), "Step 4: the last approval didn't produce a commit."},
		{"agent review gave up", stepReviewBody(3, FormReview, false, task.FallbackRoundsExhausted, 2), "Step 3: the agent review didn't come clean after 3 rounds. It's yours now."},
		{"step empty", stepEmptyBody(6), "Step 6 finished without changes."},

		// The pull request of a task.
		{"pr blocked", prBlockedBody(task.PRBlockGHAuth), "The pull request is blocked: the GitHub CLI isn't authenticated."},
		{"draft", draftBody(), "The pull request draft is ready for your OK."},
		{"findings", findingsBody(FormDecide, 4), "The review of the pull request found 4 changes for you to decide."},
		{"one finding", findingsBody(FormDecide, 1), "The review of the pull request found 1 change for you to decide."},
		{"findings in text", findingsBody(FormNone, -1), "The review of the pull request found changes for you to decide."},
		{"findings to apply", findingsBody(FormApply, 2), "The approved findings of the pull request review are ready to apply."},
		{"changes to review", changesReviewBody(FormReview, false), "The changes from the review of the pull request are ready for your review."},
		{"no commit after approval, pr", changesReviewBody(FormApprove, true), "The last approval of the pull request didn't produce a commit."},
		{"check failed", troubleBody(gh.Trouble{FailedChecks: []string{"e2e (chromium)"}}, "dev"), "A check failed after the review: e2e (chromium)."},
		{"checks failed", troubleBody(gh.Trouble{FailedChecks: []string{"e2e (chromium)", "lint"}}, "dev"), "Checks failed after the review: e2e (chromium), lint."},
		{"conflict", troubleBody(gh.Trouble{Conflict: true}, "dev"), "The pull request has a conflict with dev."},
		{"checks and conflict", troubleBody(gh.Trouble{FailedChecks: []string{"e2e (chromium)"}, Conflict: true}, "dev"), "A check failed after the review: e2e (chromium). The pull request has a conflict with dev."},
		{"conflict, base unknown", troubleBody(gh.Trouble{Conflict: true}, ""), "The pull request has a conflict with its base."},
		{"ready to merge", mergeBody(1284, FormMerge, false, false), "PR #1284 is ready to merge."},
		{"ready to merge, all discarded", mergeBody(1284, FormMerge, false, true), "PR #1284 is ready to merge: every finding of the review was discarded."},
		{"merged", mergeBody(1284, FormClose, true, false), "PR #1284 was merged. The task is ready to close."},
		{"ready to close, merge unconfirmed", mergeBody(1284, FormClose, false, false), "PR #1284 is ready to close: MySpec couldn't confirm the merge."},
		{"pr closed", prClosedBody(1284), "PR #1284 was closed without a merge."},

		// The review of a pull request.
		{"permission in the review", sessionBody(KindPermission, placeName(Place{Kind: PlaceReview}, false)), "Permission requested in the review."},
		{"session error in the review", sessionBody(KindSessionError, placeName(Place{Kind: PlaceReview}, false)), "The session stopped with an error in the review."},
		{"no readable report", reviewReplyBody(), "The reviewer stopped without a report the app can read."},
		{"review findings", reviewReportBody(FormDecide, 5), "The review has 5 findings for you to decide."},
		{"review one finding", reviewReportBody(FormDecide, 1), "The review has 1 finding for you to decide."},
		{"ready to publish", reviewReportBody(FormPublish, 0), "The review is ready to publish."},
		{"ready to apply", reviewReportBody(FormApply, 0), "The approved findings are ready to apply."},
		{"review changes", reviewChangesBody(FormReview, false), "The changes from the review are ready for your review."},
		{"review no commit", reviewChangesBody(FormApprove, true), "The last approval of the pull request didn't produce a commit."},
		{"review ready to merge", reviewMergeBody(), "The pull request is ready to merge."},
		{"publish failed", publishFailedBody("GitHub's rate limit was reached. It resets at 15:04."), "The review couldn't be published: GitHub's rate limit was reached."},
		{"publish failed, gone", publishFailedBody("This pull request is no longer on GitHub."), "The review couldn't be published: this pull request is no longer on GitHub."},
		{"publish failed, raw", publishFailedBody("Couldn't publish to GitHub: HTTP 502"), "The review couldn't be published: HTTP 502."},
		{"publish failed, raw with its own period", publishFailedBody("Couldn't publish to GitHub: HTTP 502. Bad gateway."), "The review couldn't be published: HTTP 502. Bad gateway."},
		{"publish failed, no reason", publishFailedBody(""), "The review couldn't be published."},
		{"pass blocked", passBlockedBody("gh is not authenticated. Run gh auth login."), "The next pass of the review couldn't start: gh is not authenticated."},
		{"pass blocked, raw", passBlockedBody("worktree: fetch failed: exit status 128"), "The next pass of the review couldn't start: fetch failed: exit status 128."},
		{"pass blocked, raw with its own mark", passBlockedBody("worktree: is it a repository?"), "The next pass of the review couldn't start: is it a repository?"},
		{"new commits", newCommitsBody(2), "2 commits arrived since your review."},
		{"one new commit", newCommitsBody(1), "1 commit arrived since your review."},
		{"new commits beyond the recent", newCommitsBody(-1), "New commits arrived since your review."},

		// The discussion.
		{"permission in the discussion", sessionBody(KindPermission, placeName(Place{Kind: PlaceDiscussion}, false)), "Permission requested in the discussion."},
		{"reply in the discussion", sessionBody(KindReply, placeName(Place{Kind: PlaceDiscussion}, false)), "The agent is waiting for your reply in the discussion."},
		{"session error in the discussion", sessionBody(KindSessionError, placeName(Place{Kind: PlaceDiscussion}, false)), "The session stopped with an error in the discussion."},
		{"unreadable drafts", unreadableDraftsBody(), "The agent wrote drafts the app can't read in the discussion."},
		{"drafts to decide", draftsBody(5), "There are 5 drafts to decide in the discussion."},
		{"one draft to decide", draftsBody(1), "There is 1 draft to decide in the discussion."},
		{"epic, one approved", epicCantPublishBody(1, 3), "The epic can't publish: approve one more of its cards, or discard it."},
		{"epic, none approved", epicCantPublishBody(0, 3), "The epic can't publish: approve two more of its cards, or discard it."},
		{"epic, one card", epicCantPublishBody(0, 1), "The epic can't publish: it has one card. Move another into it, or discard it."},
		{"epic, no cards", epicCantPublishBody(0, 0), "The epic can't publish: it has no cards. Move two into it, or discard it."},
		{"epic discarded, two", epicDiscardedBody(2), "The epic is discarded, and 2 of its approved cards won't publish."},
		{"epic discarded, one", epicDiscardedBody(1), "The epic is discarded, and its approved card won't publish."},
		{"draft publish failed", draftsPublishFailedBody([]discussion.Draft{overage}), "Couldn't publish “Overage on the monthly invoice”: GitHub's rate limit was reached."},
		{"two drafts failed", draftsPublishFailedBody([]discussion.Draft{overage, tiers}), "Couldn't publish 2 drafts: GitHub's rate limit was reached."},
		{"draft failed, raw", draftsPublishFailedBody([]discussion.Draft{tiers}), "Couldn't publish “Usage-based pricing tiers”: HTTP 502."},
		{"ready to archive", readyToArchiveBody(), "Every draft is published or discarded. The discussion is ready to archive."},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if test.got != test.want {
				t.Errorf("body = %q, want %q", test.got, test.want)
			}
		})
	}
}

func TestBlockPhrasesInTheirNotifications(t *testing.T) {
	t.Parallel()

	steps := map[task.BlockReason]string{
		task.BlockDirty:         "the worktree has uncommitted changes",
		task.BlockFetchFailed:   "couldn't fetch origin",
		task.BlockNoBase:        "no base branch",
		task.BlockPathExists:    "the worktree folder already exists",
		task.BlockBranchExists:  "the branch already exists",
		task.BlockCloneMissing:  "the clone of the repository is missing",
		task.BlockGitFailed:     "git failed",
		task.BlockReason("odd"): "git failed",
	}
	for reason, phrase := range steps {
		if got, want := stepBlockedBody(5, reason), "Step 5 can't start: "+phrase+"."; got != want {
			t.Errorf("stepBlockedBody(%q) = %q, want %q", reason, got, want)
		}
	}

	prs := map[task.PRBlockReason]string{
		task.PRBlockGHMissing:  "the GitHub CLI was not found",
		task.PRBlockGHAuth:     "the GitHub CLI isn't authenticated",
		task.PRBlockGHFailed:   "the GitHub CLI failed",
		task.PRBlockNoWorktree: "the worktree is gone",
		task.PRBlockGitFailed:  "git failed",
	}
	for reason, phrase := range prs {
		if got, want := prBlockedBody(reason), "The pull request is blocked: "+phrase+"."; got != want {
			t.Errorf("prBlockedBody(%q) = %q, want %q", reason, got, want)
		}
	}
}

func TestReasonOf(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		message string
		want    string
	}{
		{"empty", "", ""},
		{"blank", "  \n ", ""},
		{"first sentence, lowercase", "GitHub's rate limit was reached. It resets at 15:04.", "GitHub's rate limit was reached"},
		{"a sentence of the product", "This pull request is no longer on GitHub.", "this pull request is no longer on GitHub"},
		{"gh keeps its name", "gh is not authenticated. Run gh auth login.", "gh is not authenticated"},
		{"gh can't write", "gh can't write to this repository. Run gh auth refresh -s repo.", "gh can't write to this repository"},
		{"MySpec keeps its name", "MySpec couldn't read the pull request.", "MySpec couldn't read the pull request"},
		{"exclamation", "Nothing to publish!", "nothing to publish"},
		{"a prefix, the raw error", "Couldn't publish to GitHub: HTTP 502: bad gateway", "HTTP 502: bad gateway"},
		{"a prefix ending in a period", "Couldn't write to GitHub: could not resolve host.", "could not resolve host."},
		{"a prefix, the raw error whole", "Couldn't publish to GitHub: HTTP 502. Bad gateway.", "HTTP 502. Bad gateway."},
		{"a prefix ending in a question mark", "worktree: is it a repository?", "is it a repository?"},
		{"a period inside a word ends no sentence", "Couldn't reach api.github.com. Check the network.", "couldn't reach api.github.com"},
		{"a prefix, a capital stays", "Couldn't read from GitHub: Not Found", "Not Found"},
		{"worktree prefix", "worktree: fetch failed: exit status 128", "fetch failed: exit status 128"},
		{"a raw error without punctuation", "Exit status 128", "Exit status 128"},
		{"a home path in a raw error", "worktree: fatal: '/home/dev/code/app' is not a repository", "fatal: '~/code/app' is not a repository"},
		{"a path deep in another stays", "worktree: open /srv/home/dev/x: denied", "open /srv/home/dev/x: denied"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if got := reasonOf(test.message); got != test.want {
				t.Errorf("reasonOf(%q) = %q, want %q", test.message, got, test.want)
			}
		})
	}
}

func TestReadyToContinueKeepsItsOwnArticle(t *testing.T) {
	t.Parallel()

	if got, want := stageName(task.StageTechSpec), "tech spec"; got != want {
		t.Errorf("stageName() = %q, want %q", got, want)
	}
	if got, want := stagePlace(task.StageTechSpec), "the tech spec"; got != want {
		t.Errorf("stagePlace() = %q, want %q", got, want)
	}
	if got, want := readyToContinueBody(task.StagePRD), "The PRD is revised and ready to continue."; got != want {
		t.Errorf("readyToContinueBody() = %q, want %q", got, want)
	}
}
