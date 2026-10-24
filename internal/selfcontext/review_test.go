package selfcontext_test

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/divergence"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/prreport"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/reviewflow"
	"github.com/guilhermt/myspec/internal/selfcontext"
	"github.com/guilhermt/myspec/internal/session"
)

func findingsOf(decisions ...prreport.Decision) []prreview.Finding {
	findings := make([]prreview.Finding, len(decisions))
	for i, d := range decisions {
		findings[i] = prreview.Finding{Finding: prreport.Finding{Number: i + 1, Decision: d}}
	}
	return findings
}

func TestTheStateOfAReviewInApplyModeTellsThePassesAndThePushThatWasRejected(t *testing.T) {
	t.Parallel()

	got := selfcontext.Review(selfcontext.ReviewInput{
		State: reviewflow.State{
			Review: prreview.Review{
				ID: "r1", Number: 7, Title: "Fix the cache", Author: "bia", URL: "https://github.com/acme/app/pull/7",
				HeadBranch: "fix/cache", BaseBranch: "main", HeadCommit: "1234567890", PRState: prreview.PROpen,
				Mode: prreview.ModeApply, AskedPass: 2,
			},
			Status:       reviewflow.StatusDiverged,
			WorktreePath: "/wt/r1",
			CheckedAt:    readAt,
			Checks: gh.PRChecks{
				Checks:    []gh.Check{{Name: "build", State: gh.CheckPassed}, {Name: "test", State: gh.CheckRunning}},
				Mergeable: gh.MergeableClean,
			},
			Passes: []prreview.Pass{
				{Number: 1, Recorded: true, Applied: true, SentAt: readAt, Findings: findingsOf(prreport.DecisionApproved)},
				{
					Number: 2, Recorded: true,
					Findings: findingsOf(prreport.DecisionApproved, prreport.DecisionDiscarded, prreport.DecisionNone),
				},
			},
			Divergence: &divergence.Divergence{
				ItemID: "r1", Stage: "review", Kind: divergence.KindPushRejected, StartedAt: openedAt,
				Facts: divergence.Facts{Branch: "fix/cache", Commit: "9f8e7d6"},
			},
		},
		Repository: "acme/app",
		Stage:      "review",
		Sessions:   sessionsOf(sessionOf("r1", "review", session.StatusWaiting)),
		Now:        readAt,
	})

	want := stateOf(
		headerOf("review"),
		"Review: acme/app#7 · Fix the cache",
		"Pull request: https://github.com/acme/app/pull/7 · by bia · fix/cache into main · head 1234567 · open",
		"Mode: Apply · the approved findings are fixed in the worktree, and the app pushes the commit",
		"This conversation: Reviewer (review)",
		"Status: Not as expected · pass 2",
		"Checks: 1 of 2 passed, 1 running · merges clean into main",
		"Worktree: /wt/r1 · detached HEAD",
		"Passes:",
		"- Pass 1 · 1 findings: 1 approved, 0 discarded, 0 to decide · applied",
		"- Pass 2 · 3 findings: 1 approved, 1 discarded, 1 to decide",
		"Conversations: Reviewer · idle · this conversation",
		"Divergence: push_rejected, shown as Not as expected, open since "+local(openedAt)+", in the conversation Reviewer (review)",
		"- Expected: fix/cache on origin with 9f8e7d6",
		"- Found: origin has commits fix/cache doesn't",
		"- Actions in the interface:",
		"  - Try the push again: lets the app push 9f8e7d6 to fix/cache once more, once origin and the branch agree",
	)
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("state mismatch (-want +got):\n%s", diff)
	}
}

func TestTheStateOfAReviewInPublishModeTellsWhereThePassWentAndWhatBlocksIt(t *testing.T) {
	t.Parallel()

	published := time.Date(2026, time.October, 23, 14, 0, 0, 0, time.UTC)
	got := selfcontext.Review(selfcontext.ReviewInput{
		State: reviewflow.State{
			Review: prreview.Review{
				ID: "r2", Number: 9, Author: "caio", URL: "https://github.com/acme/app/pull/9",
				HeadBranch: "feat/y", BaseBranch: "main", PRState: prreview.PROpen,
				Mode: prreview.ModePublish, AskedPass: 1, PublishError: "GitHub said no",
			},
			Status:      reviewflow.StatusPublishFailed,
			CheckError:  "gh is offline",
			PassBlocked: "the worktree could not be updated",
			Passes: []prreview.Pass{
				{Number: 1, Clean: true, Recorded: true, PublishedAt: published, PublishedURL: "https://github.com/acme/app/pull/9#review-1", Verdict: prreview.VerdictApprove},
			},
		},
		Repository: "acme/app",
		Stage:      "review",
		Now:        readAt,
	})

	want := stateOf(
		headerOf("review"),
		"Review: acme/app#9",
		"Pull request: https://github.com/acme/app/pull/9 · by caio · feat/y into main · open",
		"Mode: Publish · the app publishes the approved findings on GitHub",
		"This conversation: Reviewer (review)",
		"Status: Publish failed · pass 1",
		"Checks: the last reading failed: gh is offline",
		"Pass blocked: the worktree could not be updated",
		"Publish failed: GitHub said no",
		"Passes:",
		"- Pass 1 · clean · published at "+local(published)+" as Approve https://github.com/acme/app/pull/9#review-1",
		"Conversations: none open",
		"Divergence: none",
	)
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("state mismatch (-want +got):\n%s", diff)
	}
}
