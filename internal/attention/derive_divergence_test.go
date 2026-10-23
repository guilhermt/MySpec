package attention_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/attention"
	"github.com/guilhermt/myspec/internal/discussionflow"
	"github.com/guilhermt/myspec/internal/divergence"
	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/reviewflow"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

// diverged is a divergence of the task in a conversation.
func diverged(stage string, kind divergence.Kind, facts divergence.Facts) *divergence.Divergence {
	return &divergence.Divergence{ItemID: taskID, Stage: stage, Kind: kind, Facts: facts}
}

func TestDeriveADivergenceInTheCurrentStep(t *testing.T) {
	t.Parallel()

	waiting := summary(session.StatusWaiting, true)
	commitMissing := diverged(session.StepStage(2), divergence.KindCommitMissing, divergence.Facts{Files: 3})
	reportMissing := diverged(session.StepReviewStage(2), divergence.KindReportMissing, divergence.Facts{Pass: 2})

	withDivergence := func(in attention.Input, d *divergence.Divergence) attention.Input {
		in.Divergence = d
		return in
	}
	reviewed := flow.StepState{
		Status: flow.StepImplementing, ReviewerStage: session.StepReviewStage(2), Reviewer: waiting,
	}
	situation := func(place attention.PlaceKind, kind attention.Kind, body string) []attention.Found {
		return []attention.Found{{
			TaskID: taskID, Place: attention.Place{Kind: place, Step: 2}, Kind: kind, Title: taskName, Body: body,
		}}
	}

	tests := []struct {
		name string
		in   attention.Input
		want []attention.Found
	}{
		{
			"the commit that didn't happen",
			withDivergence(stepInput(flow.StepState{Status: flow.StepImplementing, Review: &review.Snapshot{Total: 3}}, waiting), commitMissing),
			situation(attention.PlaceStep, attention.KindDivergence, "Step 2: the commit MySpec asked for didn't happen."),
		},
		{
			"the report of the reviewer that isn't there",
			withDivergence(stepInput(reviewed, waiting), reportMissing),
			situation(attention.PlaceStepReview, attention.KindDivergence, "Review 2 has no report."),
		},
		{
			"the question of the session comes first",
			withDivergence(stepInput(flow.StepState{Status: flow.StepImplementing}, summary(session.StatusNeedsAnswer, false)), commitMissing),
			situation(attention.PlaceStep, attention.KindQuestion, "The agent has a question in step 2."),
		},
		{
			"a paused conversation waits for nobody",
			withDivergence(stepInput(flow.StepState{Status: flow.StepImplementing}, summary(session.StatusPaused, false)), commitMissing),
			nil,
		},
		{
			"the divergence of the reviewer is not the one of the step",
			withDivergence(stepInput(flow.StepState{Status: flow.StepImplementing}, waiting), reportMissing),
			nil,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if diff := cmp.Diff(tc.want, attention.Derive(tc.in)); diff != "" {
				t.Errorf("Derive() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestDeriveADivergenceInThePullRequest(t *testing.T) {
	t.Parallel()

	waiting := summary(session.StatusWaiting, true)
	wrongBase := divergence.Facts{Base: "dev", PRs: []divergence.PR{{Number: 1284, Base: "main"}}}

	tests := []struct {
		name string
		pr   flow.PullRequest
		d    *divergence.Divergence
		want []attention.Found
	}{
		{
			"a pull request on another base",
			flow.PullRequest{Status: flow.PRPreparing},
			diverged(session.PRStage, divergence.KindPRWrongBase, wrongBase),
			[]attention.Found{{
				TaskID: taskID, Place: attention.Place{Kind: attention.PlacePR}, Kind: attention.KindDivergence,
				Title: taskName, Body: "PR #1284 goes into main, not dev.",
			}},
		},
		{
			"a push rejected in the review",
			flow.PullRequest{Status: flow.PRReviewing, SessionStage: session.PRReviewStage, Session: waiting},
			diverged(session.PRReviewStage, divergence.KindPushRejected, divergence.Facts{Branch: "153-robustez"}),
			[]attention.Found{{
				TaskID: taskID, Place: attention.Place{Kind: attention.PlacePR}, Kind: attention.KindDivergence,
				Title: taskName, Body: "MySpec couldn't push 153-robustez: origin has commits it doesn't.",
			}},
		},
		{
			"the commit of the fixes in the conversation of the implementer",
			flow.PullRequest{Status: flow.PRReviewing, FixerStage: session.PRFixStage, Fixer: waiting},
			diverged(session.PRFixStage, divergence.KindCommitMissing, divergence.Facts{}),
			[]attention.Found{{
				TaskID: taskID, Place: attention.Place{Kind: attention.PlacePRFix}, Kind: attention.KindDivergence,
				Title: taskName, Body: "The commit of the review fixes didn't happen.",
			}},
		},
		{
			"the error of the implementer comes first",
			flow.PullRequest{Status: flow.PRReviewing, FixerStage: session.PRFixStage, Fixer: summary(session.StatusError, false)},
			diverged(session.PRFixStage, divergence.KindCommitMissing, divergence.Facts{}),
			[]attention.Found{{
				TaskID: taskID, Place: attention.Place{Kind: attention.PlacePRFix}, Kind: attention.KindSessionError,
				Title: taskName, Body: "The session stopped with an error in the review fixes.",
			}},
		},
		{
			"a paused implementer waits for nobody",
			flow.PullRequest{Status: flow.PRReviewing, FixerStage: session.PRFixStage, Fixer: summary(session.StatusPaused, false)},
			diverged(session.PRFixStage, divergence.KindCommitMissing, divergence.Facts{}),
			nil,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			in := prInput(tc.pr)
			in.Task.Stage = task.StagePR
			in.Divergence = tc.d
			if diff := cmp.Diff(tc.want, attention.Derive(in)); diff != "" {
				t.Errorf("Derive() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestDeriveADivergenceInAReview(t *testing.T) {
	t.Parallel()

	d := diverged("review", divergence.KindNoChanges, divergence.Facts{Pass: 1, Approved: 3})
	in := reviewInput(reviewflow.StatusReadyToApply, summary(session.StatusWaiting, true))
	in.Divergence = d

	want := reviewSituation(attention.KindDivergence, attention.FormNone,
		"The implementer changed no file for the 3 approved findings of review 1.")
	if diff := cmp.Diff(want, attention.DeriveReview(in)); diff != "" {
		t.Errorf("DeriveReview() mismatch (-want +got):\n%s", diff)
	}

	in.State.Session = summary(session.StatusNeedsPermission, false)
	want = reviewSituation(attention.KindPermission, attention.FormNone, "Permission requested in the review.")
	if diff := cmp.Diff(want, attention.DeriveReview(in)); diff != "" {
		t.Errorf("DeriveReview() with a permission mismatch (-want +got):\n%s", diff)
	}
}

func TestDeriveADivergenceInADiscussion(t *testing.T) {
	t.Parallel()

	in := discussionInput(discussionflow.StatusDeciding, summary(session.StatusWaiting, true))
	in.Divergence = diverged("discussion", divergence.KindDraftsUnreadable, divergence.Facts{Reason: "no front matter"})

	want := []attention.Found{{
		TaskID: discussionID, Place: attention.Place{Kind: attention.PlaceDiscussion},
		Kind: attention.KindDivergence, Title: discussionTitle,
		Body: "drafts.md still can't be read: no front matter.",
	}}
	if diff := cmp.Diff(want, attention.DeriveDiscussion(in)); diff != "" {
		t.Errorf("DeriveDiscussion() mismatch (-want +got):\n%s", diff)
	}

	in.State.Session = summary(session.StatusError, false)
	if got := attention.DeriveDiscussion(in); len(got) != 1 || got[0].Kind != attention.KindSessionError {
		t.Errorf("DeriveDiscussion() with an error = %+v, want the session error", got)
	}
}

func TestADivergenceIsAWaitingSituation(t *testing.T) {
	t.Parallel()

	if got := attention.KindDivergence.Group(); got != attention.GroupWaiting {
		t.Errorf("KindDivergence.Group() = %q, want %q", got, attention.GroupWaiting)
	}
}
