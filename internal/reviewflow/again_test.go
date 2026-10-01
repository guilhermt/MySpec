package reviewflow_test

import (
	"fmt"
	"slices"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/prreport"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/reviewflow"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/worktree"
)

// decided is a review whose first pass was recorded and whose findings the
// user decided on: what a new pass starts from.
func decided(t *testing.T, f *fixture) string {
	t.Helper()

	id := asked(t, f)
	f.sessions.goIdle(id)
	f.record(t, id, changesReport(1, "Two things to fix.",
		prreport.ParsedFinding{Number: 1, Path: "internal/board/service.go", Line: 12, Text: "The reading is never cached."},
		prreport.ParsedFinding{Number: 2, Text: "The cache has no test."},
	), headHash)
	f.decide(t, id, 1, 1, prreview.DecisionApproved)
	f.decide(t, id, 1, 2, prreview.DecisionDiscarded)
	return id
}

// lastMessage is what the conversation of a review was told last.
func lastMessage(t *testing.T, f *fixture) string {
	t.Helper()

	sent := f.sessions.sent()
	if len(sent) == 0 {
		t.Fatal("the conversation of the review was told nothing")
	}
	return sent[len(sent)-1]
}

// wantLastApp fails a test whose last message of the app is not of the kind
// and with the numbers it expects.
func wantLastApp(t *testing.T, f *fixture, want session.AppMessage) {
	t.Helper()

	apps := f.sessions.sentApps()
	if len(apps) == 0 {
		t.Fatal("the conversation of the review was told nothing")
	}
	if diff := cmp.Diff(want, apps[len(apps)-1]); diff != "" {
		t.Errorf("app message mismatch (-want +got):\n%s", diff)
	}
}

func TestANewPassUpdatesTheWorktreeAndAsksForTheNextReport(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := decided(t, f)

	if err := f.service.ReviewAgain(t.Context(), id, "check the migrations"); err != nil {
		t.Fatalf("review again: %v", err)
	}

	stored, _ := f.reviews.Get(id)
	if stored.AskedPass != 2 || stored.ReportedPass != 1 {
		t.Errorf("review = %+v, want the second pass asked for", stored)
	}
	if got := f.pass(t, id, 2).Instructions; got != "check the migrations" {
		t.Errorf("instructions = %q, want the ones of the pass", got)
	}
	if !slices.Contains(f.worktrees.recorded(), "updateDetached:"+id+":cache-boards") {
		t.Errorf("worktree calls = %v, want the worktree updated to the head", f.worktrees.recorded())
	}

	want := fmt.Sprintf(`Review the pull request again, as it is now. The worktree was updated to the head of the pull request.

- Write the report of this pass to `+"`%s`"+`, in the same format as before. It is pass 2.
- The previous pass covered commit `+"`%s`"+`: `+"`git diff %s..HEAD`"+` is what changed since then. Read the full diff against `+"`origin/main`"+` as well.
- Only what is new or still stands is a finding. Say in the summary which of the findings below were resolved.

## Findings already published
None.

## GitHub status
- Checks: the pull request has no checks.
- Base: the branch merges clean into `+"`main`"+`.

## Review instructions
never change a published migration

## Instructions for this pass
check the migrations`, stored.ReportPath(2), headHash, headHash)
	if got := lastMessage(t, f); got != want {
		t.Errorf("message =\n%s\n\nwant:\n%s", got, want)
	}
	wantLastApp(t, f, session.AppMessage{Kind: session.AppPRPass, Pass: 2})
}

func TestANewPassListsTheFindingsTheAuthorAlreadySaw(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := decided(t, f)
	if err := f.reviews.MarkPublished(t.Context(), id, 1, prreview.VerdictRequestChanges, false,
		"https://github.com/dev/web/pull/42#pullrequestreview-1", headHash,
		map[int]prreview.Placement{1: prreview.PlacementInline},
	); err != nil {
		t.Fatalf("mark published: %v", err)
	}

	if err := f.service.ReviewAgain(t.Context(), id, ""); err != nil {
		t.Fatalf("review again: %v", err)
	}

	message := lastMessage(t, f)
	want := "## Findings already published\n1. `internal/board/service.go:12` — The reading is never cached."
	if !strings.Contains(message, want) {
		t.Errorf("message =\n%s\n\nwant it to list the published finding", message)
	}
	if strings.Contains(message, "The cache has no test.") {
		t.Error("the message lists a finding the user discarded, which the author never saw")
	}
	if strings.Contains(message, "## Instructions for this pass") {
		t.Error("the message has a section for instructions the user did not write")
	}
}

func TestANewPassClearsAPublicationThatFailed(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := decided(t, f)
	f.update(t, id, func(r *prreview.Review) { r.PublishError = "GitHub's rate limit was reached." })

	if err := f.service.ReviewAgain(t.Context(), id, ""); err != nil {
		t.Fatalf("review again: %v", err)
	}

	if stored, _ := f.reviews.Get(id); stored.PublishError != "" {
		t.Errorf("publish error = %q, want the failure of the pass before forgotten", stored.PublishError)
	}
}

func TestANewPassThrowsOutWhatIsInTheWayOfTheWorktreeInPublishMode(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := decided(t, f)
	f.worktrees.failUpdate(worktree.ErrDirty, true)

	if err := f.service.ReviewAgain(t.Context(), id, ""); err != nil {
		t.Fatalf("review again: %v", err)
	}

	calls := f.worktrees.recorded()
	if !slices.Contains(calls, "clean:"+id) {
		t.Errorf("worktree calls = %v, want the worktree cleaned before the pass", calls)
	}
	if stored, _ := f.reviews.Get(id); stored.AskedPass != 2 {
		t.Errorf("review = %+v, want the second pass asked for", stored)
	}
}

func TestANewPassReadsTheHeadThePullRequestHasNow(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := decided(t, f)
	moved := openPR()
	moved.HeadCommit, moved.Title = otherHash, "Cache the board readings, with a test"
	f.pulls.seed(moved)

	if err := f.service.ReviewAgain(t.Context(), id, ""); err != nil {
		t.Fatalf("review again: %v", err)
	}

	stored, _ := f.reviews.Get(id)
	if stored.HeadCommit != otherHash || stored.Title != moved.Title {
		t.Errorf("review = %+v, want the head and the title GitHub has now", stored)
	}
}

func TestANewPassThatNeverReachedTheAgentLeavesThePassBefore(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := decided(t, f)
	f.sessions.failWith(errGitHub)

	if err := f.service.ReviewAgain(t.Context(), id, ""); err == nil {
		t.Fatal("review again = nil, want the failure of the conversation")
	}

	stored, _ := f.reviews.Get(id)
	if stored.AskedPass != 1 || stored.ReportedPass != 1 {
		t.Errorf("review = %+v, want the review back on the pass the user was deciding", stored)
	}
	if passes := f.reviews.Passes(id); len(passes) != 1 {
		t.Errorf("passes = %+v, want the pass that never started dropped", passes)
	}
}

func TestANewPassIsRefused(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		setup func(t *testing.T, f *fixture, id string)
		want  error
	}{
		{
			"while the report of a pass is still owed",
			func(t *testing.T, f *fixture, id string) {
				t.Helper()

				if _, err := f.reviews.AskPass(t.Context(), id, 2, ""); err != nil {
					t.Fatalf("ask pass: %v", err)
				}
			},
			reviewflow.ErrPassRunning,
		},
		{
			"while the agent is working",
			func(_ *testing.T, f *fixture, id string) { f.sessions.goBusy(id) },
			reviewflow.ErrBusy,
		},
		{
			"once the pull request is closed",
			func(t *testing.T, f *fixture, id string) {
				t.Helper()

				f.update(t, id, func(r *prreview.Review) { r.PRState = prreview.PRClosed })
			},
			reviewflow.ErrNotOpen,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			id := decided(t, f)
			test.setup(t, f, id)

			wantErrIs(t, f.service.ReviewAgain(t.Context(), id, ""), test.want)
		})
	}
}

func TestANewPassIsRefusedOnceGitHubSaysThePullRequestMerged(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := decided(t, f)
	// Merged after the last poll, so the stored review still says open.
	merged := openPR()
	merged.State = string(prreview.PRMerged)
	f.pulls.seed(merged)
	before := len(f.sessions.sent())

	wantErrIs(t, f.service.ReviewAgain(t.Context(), id, ""), reviewflow.ErrNotOpen)

	for _, call := range f.worktrees.recorded() {
		if strings.HasPrefix(call, "updateDetached:") || strings.HasPrefix(call, "clean:") {
			t.Errorf("worktree calls = %v, want the worktree left alone", f.worktrees.recorded())
			break
		}
	}
	if stored, _ := f.reviews.Get(id); stored.AskedPass != 1 {
		t.Errorf("review = %+v, want no pass asked for", stored)
	}
	if sent := f.sessions.sent(); len(sent) != before {
		t.Errorf("messages sent = %q, want nothing asked of the agent", sent[before:])
	}
}

func TestANewPassOfAReviewNobodyStartedIsRefused(t *testing.T) {
	t.Parallel()

	f := newFixture(t)

	wantErrIs(t, f.service.ReviewAgain(t.Context(), "review-9", ""), prreview.ErrNotFound)
}

func TestANewPassOpensAConversationTheAppNoLongerHas(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := decided(t, f)
	f.sessions.forget(id)

	if err := f.service.ReviewAgain(t.Context(), id, ""); err != nil {
		t.Fatalf("review again: %v", err)
	}

	if _, open := f.sessions.Summary(session.Key{TaskID: id, Stage: session.ReviewStage}); !open {
		t.Error("the conversation of the review was not opened again")
	}
	if stored, _ := f.reviews.Get(id); stored.AskedPass != 2 {
		t.Errorf("review = %+v, want the second pass asked for", stored)
	}
}

func TestANewPassForgetsWhyTheReportOfThePassBeforeWasUnreadable(t *testing.T) {
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

	if err := f.service.ReviewAgain(t.Context(), id, ""); err != nil {
		t.Fatalf("review again: %v", err)
	}

	if got := f.state(t, id).UnreadableReport; got != "" {
		t.Errorf("unreadable report = %q, want nothing said about the second pass", got)
	}
}

func TestANewPassSaysWhatChangedOnlyWhenItKnowsTheCommitThePassBeforeCovered(t *testing.T) {
	t.Parallel()

	cases := map[string]struct {
		commit string
		want   string
	}{
		"commit known": {
			commit: headHash,
			want: "- The previous pass covered commit `" + headHash + "`: `git diff " + headHash +
				"..HEAD` is what changed since then. Read the full diff against `origin/main` as well.\n",
		},
		"commit unknown": {
			commit: "",
			want:   "\n- Read the full diff against `origin/main`.\n",
		},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			id := asked(t, f)
			f.record(t, id, cleanReport(1, "Nothing to change."), c.commit)

			if err := f.service.ReviewAgain(t.Context(), id, ""); err != nil {
				t.Fatalf("review again: %v", err)
			}
			message := lastMessage(t, f)
			if !strings.Contains(message, c.want) {
				t.Errorf("message =\n%s\n\nwant it to hold:\n%s", message, c.want)
			}
			if c.commit == "" && strings.Contains(message, "git diff") {
				t.Error("the message points at the diff since a commit nobody knows")
			}
		})
	}
}

func TestAPassMarksTheChecksItStartedFrom(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := decided(t, f)
	f.pulls.seed(withChecks(openPR(), gh.MergeableConflicting, passedCheck, failedCheck))

	if err := f.service.ReviewAgain(t.Context(), id, ""); err != nil {
		t.Fatalf("review again: %v", err)
	}

	want := []session.MarkerEntry{{
		Type: session.MarkerChecksRead, Pass: 2, Passed: 1, Total: 2, Failed: []string{failedCheck.Name}, Conflict: true,
	}}
	marked := f.sessions.markersOf(session.MarkerChecksRead)
	if diff := cmp.Diff(want, marked[len(marked)-1:]); diff != "" {
		t.Errorf("checks_read markers (-want +got):\n%s", diff)
	}
}
