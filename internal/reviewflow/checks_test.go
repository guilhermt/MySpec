package reviewflow_test

import (
	"errors"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/pulls"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/reviewflow"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/worktree"
)

// unauthenticated is a reading of GitHub that failed, as internal/pulls
// answers it.
var unauthenticated = &pulls.Failure{Reason: pulls.ReasonUnauthenticated}

// started says whether the conversation of a review was started, which is
// what sends the prompt of its first pass.
func started(f *fixture, id string) bool {
	return slices.Contains(f.sessions.recorded(), "start:"+id+":restarted=false")
}

// statusSection is the status section the pass that started was given, as the
// prompt of the first pass renders it.
func statusSection(t *testing.T, f *fixture, id string) string {
	t.Helper()

	info, ok := f.sessions.info(id)
	if !ok {
		t.Fatal("the review has no conversation")
	}
	if info.Checks == nil {
		t.Fatal("the pass started without a reading of GitHub")
	}
	return prompts.PRChecksSection(info.Checks, info.MergeBase)
}

// waiting is a review in publish mode whose first pass waits for a check that
// is still running.
func waiting(t *testing.T, f *fixture) string {
	t.Helper()

	f.pulls.seed(withChecks(openPR(), gh.MergeableClean, pendingCheck))
	return f.start(t)
}

func TestStartWaitsForPendingChecks(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := waiting(t, f)

	stored, ok := f.reviews.Get(id)
	if !ok {
		t.Fatalf("review %s is not active", id)
	}
	if stored.AskedPass != 1 || stored.Phase != prreview.PhaseWaitingChecks {
		t.Errorf("review = %+v, want the first pass asked for, waiting for the checks", stored)
	}
	if _, found := f.worktrees.Get(id); !found {
		t.Error("the review has no worktree")
	}
	if _, err := f.reviews.ReadArtifact(id, prreview.ContextFile); err != nil {
		t.Errorf("read the document of the review: %v", err)
	}
	if started(f, id) {
		t.Error("the conversation started while a check was running")
	}
	if got := f.state(t, id).Status; got != reviewflow.StatusWaitingChecks {
		t.Errorf("status = %q, want %q", got, reviewflow.StatusWaitingChecks)
	}
	info, ok := f.sessions.info(id)
	want := models.Choice{Model: models.Opus55, Effort: models.High}
	if !ok || info.Choice != want {
		t.Errorf("conversation = %+v, want it created with the model the user chose", info)
	}

	f.pulls.seed(withChecks(openPR(), gh.MergeableClean, passedCheck))
	f.polled(t, id, func(s reviewflow.State) bool {
		return s.Review.Phase == prreview.PhaseNone
	}, "the first pass to start once the check passed")

	if !started(f, id) {
		t.Fatalf("session calls = %v, want the conversation started", f.sessions.recorded())
	}
	if got := statusSection(t, f, id); !strings.Contains(got, "1 check passed") {
		t.Errorf("status section =\n%s\n\nwant the check that passed", got)
	}
	if info, _ := f.sessions.info(id); info.Choice != want || info.PassInstructions != "look at the tests" {
		t.Errorf("conversation = %+v, want the model and the instructions of the pass", info)
	}
}

func TestStartBeginsThePassWhenTheChecksAreSettled(t *testing.T) {
	t.Parallel()

	cases := map[string]struct {
		detail pulls.Detail
		want   []string
	}{
		"a pull request without checks": {
			detail: openPR(),
			want:   []string{"the pull request has no checks", "merges clean into `main`"},
		},
		"a check that failed and a conflict": {
			detail: withChecks(openPR(), gh.MergeableConflicting, passedCheck, failedCheck),
			want:   []string{"1 of 2 failed", "`lint` — failure — " + checkURL, "conflicts with `main`"},
		},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			f.pulls.seed(c.detail)
			id := f.start(t)

			if !started(f, id) {
				t.Fatalf("session calls = %v, want the conversation started at once", f.sessions.recorded())
			}
			if stored, _ := f.reviews.Get(id); stored.Phase != prreview.PhaseNone {
				t.Errorf("phase = %q, want none", stored.Phase)
			}
			got := statusSection(t, f, id)
			for _, want := range c.want {
				if !strings.Contains(got, want) {
					t.Errorf("status section =\n%s\n\nwant it to hold %q", got, want)
				}
			}
		})
	}
}

func TestReviewAgainWaitsForPendingChecks(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := decided(t, f)
	f.pulls.seed(withChecks(openPR(), gh.MergeableClean, pendingCheck))

	if err := f.service.ReviewAgain(t.Context(), id, "check the migrations"); err != nil {
		t.Fatalf("review again: %v", err)
	}

	state := f.state(t, id)
	if state.Status != reviewflow.StatusWaitingChecks || state.Review.AskedPass != 2 {
		t.Errorf("status = %q, review = %+v, want the second pass waiting for the checks",
			state.Status, state.Review)
	}
	if len(f.sessions.sent()) != 0 {
		t.Errorf("messages = %v, want nothing sent while a check runs", f.sessions.sent())
	}
	wantErrIs(t, f.service.ReviewAgain(t.Context(), id, ""), reviewflow.ErrPassRunning)

	f.pulls.seed(withChecks(openPR(), gh.MergeableClean, passedCheck))
	f.polled(t, id, func(s reviewflow.State) bool {
		return s.Review.Phase == prreview.PhaseNone
	}, "the second pass to start once the check passed")

	got := lastMessage(t, f)
	for _, want := range []string{
		"It is pass 2.",
		"## GitHub status\n- Checks: 1 check passed.",
		"## Instructions for this pass\ncheck the migrations",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("message =\n%s\n\nwant it to hold %q", got, want)
		}
	}
}

func TestReviewAgainRefusesWhenGitHubCannotBeRead(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := decided(t, f)
	f.pulls.failWith(unauthenticated)

	err := f.service.ReviewAgain(t.Context(), id, "")
	var failure *pulls.Failure
	if !errors.As(err, &failure) || failure.Reason != pulls.ReasonUnauthenticated {
		t.Fatalf("review again = %v, want the failure of the reading", err)
	}
	if stored, _ := f.reviews.Get(id); stored.AskedPass != 1 || stored.Phase != prreview.PhaseNone {
		t.Errorf("review = %+v, want no pass asked for", stored)
	}
	if len(f.sessions.sent()) != 0 {
		t.Errorf("messages = %v, want nothing sent", f.sessions.sent())
	}
}

func TestTheCommitOfApplyModeWaitsForTheChecksOfTheNewHead(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := committing(t, f)
	sentBefore, readBefore := len(f.sessions.sent()), f.pulls.readings()
	f.watch.setSnapshot(review.Snapshot{Head: commitHash})
	f.sessions.goIdle(id)

	f.evaluated(t, id, func(s reviewflow.State) bool {
		return s.Status == reviewflow.StatusWaitingChecks
	}, "the second pass to wait for the checks")
	if state := f.state(t, id); state.Review.AskedPass != 2 {
		t.Errorf("review = %+v, want the second pass asked for", state.Review)
	}

	// The commit asks for the first reading at once; right after a push, a
	// reading without checks is read again.
	waitFor(t, "the first reading of GitHub", func() bool { return f.pulls.readings() > readBefore })
	time.Sleep(settleWait)
	if got := f.state(t, id).Status; got != reviewflow.StatusWaitingChecks {
		t.Errorf("status = %q, want the pass still waiting after a reading without checks", got)
	}
	if len(f.sessions.sent()) != sentBefore {
		t.Errorf("messages = %v, want nothing sent after one reading without checks", f.sessions.sent())
	}

	f.polled(t, id, func(s reviewflow.State) bool {
		return s.Review.Phase == prreview.PhaseNone
	}, "the second pass to start on the second reading")

	got := lastMessage(t, f)
	for _, want := range []string{
		"## GitHub status\n- Checks: the pull request has no checks.",
		"## Findings already applied",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("message =\n%s\n\nwant it to hold %q", got, want)
		}
	}
}

func TestAPollThatFailsBlocksTheWaitingPass(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := waiting(t, f)
	f.pulls.failWith(unauthenticated)

	f.polled(t, id, func(s reviewflow.State) bool {
		return s.Status == reviewflow.StatusPassBlocked
	}, "the pass to be blocked")
	if got := f.state(t, id).PassBlocked; got != unauthenticated.Message() {
		t.Errorf("pass blocked = %q, want %q", got, unauthenticated.Message())
	}

	// The wait stops for the user: a reading that works again does not
	// start the pass on its own.
	f.pulls.failWith(nil)
	f.pulls.seed(withChecks(openPR(), gh.MergeableClean, passedCheck))
	f.service.Poll()
	time.Sleep(settleWait)
	if started(f, id) {
		t.Fatal("the blocked pass started without the user")
	}

	if err := f.service.ReviewAgain(t.Context(), id, ""); err != nil {
		t.Fatalf("review again: %v", err)
	}
	state := f.state(t, id)
	if !started(f, id) || state.Review.Phase != prreview.PhaseNone || state.PassBlocked != "" {
		t.Errorf("review = %+v, blocked = %q, want the first pass started", state.Review, state.PassBlocked)
	}
	if state.Review.AskedPass != 1 {
		t.Errorf("asked pass = %d, want the first pass asked for again", state.Review.AskedPass)
	}
}

func TestAWorktreeThatCannotBeUpdatedBlocksThePass(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := committing(t, f)
	f.watch.setSnapshot(review.Snapshot{Head: commitHash})
	f.sessions.goIdle(id)
	f.evaluated(t, id, func(s reviewflow.State) bool {
		return s.Status == reviewflow.StatusWaitingChecks
	}, "the second pass to wait for the checks")
	sentBefore := len(f.sessions.sent())

	f.worktrees.failUpdate(worktree.ErrDirty, true)
	f.pulls.seed(withChecks(ownPR(), gh.MergeableClean, passedCheck))
	f.polled(t, id, func(s reviewflow.State) bool {
		return s.Status == reviewflow.StatusPassBlocked
	}, "the pass to be blocked by the worktree")
	if got := f.state(t, id).PassBlocked; !strings.Contains(got, worktree.ErrDirty.Error()) {
		t.Errorf("pass blocked = %q, want the worktree that could not be updated", got)
	}
	if len(f.sessions.sent()) != sentBefore {
		t.Errorf("messages = %v, want nothing sent", f.sessions.sent())
	}

	if err := f.service.ReviewAgain(t.Context(), id, ""); err != nil {
		t.Fatalf("review again: %v", err)
	}
	if got := lastMessage(t, f); !strings.Contains(got, "It is pass 2.") {
		t.Errorf("message =\n%s\n\nwant the second pass", got)
	}
}

func TestAPullRequestMergedDuringTheWaitEndsTheReview(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := waiting(t, f)
	merged := openPR()
	merged.State = string(prreview.PRMerged)
	f.pulls.seed(merged)

	f.service.Poll()
	waitFor(t, "the review to reach the history", func() bool {
		stored, ok := f.reviews.Lookup(id)
		return ok && stored.Archived()
	})
	if started(f, id) {
		t.Error("the pass of a merged pull request started")
	}
	if !slices.Contains(f.sessions.recorded(), "discardTask:"+id) {
		t.Errorf("session calls = %v, want the conversation discarded", f.sessions.recorded())
	}
}

func TestAWaitSurvivesARestart(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := waiting(t, f)

	// The app closes during the wait and comes back.
	f.service.Close()
	f.sessions.forget(id)
	f.service = f.newService(t)
	f.service.Sync(t.Context())

	if _, open := f.sessions.Summary(session.Key{TaskID: id, Stage: session.ReviewStage}); !open {
		t.Fatal("the conversation of the review was not opened again")
	}
	if got := f.state(t, id).Status; got != reviewflow.StatusWaitingChecks {
		t.Errorf("status = %q, want the pass still waiting", got)
	}

	f.pulls.seed(withChecks(openPR(), gh.MergeableClean, passedCheck))
	f.polled(t, id, func(s reviewflow.State) bool {
		return s.Review.Phase == prreview.PhaseNone
	}, "the first pass to start after the restart")

	info, _ := f.sessions.info(id)
	want := models.Choice{Model: models.Opus55, Effort: models.High}
	if diff := cmp.Diff(want, info.Choice); diff != "" || !started(f, id) {
		t.Errorf("started = %v, choice (-want +got):\n%s", started(f, id), diff)
	}
}

func TestARestartDuringTheWaitOfApplyModeLeavesTheWorktreeUnwatched(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := committing(t, f)
	f.watch.setSnapshot(review.Snapshot{Head: commitHash})
	f.sessions.goIdle(id)
	f.evaluated(t, id, func(s reviewflow.State) bool {
		return s.Status == reviewflow.StatusWaitingChecks
	}, "the second pass to wait for the checks")

	// The app closes during the wait and comes back.
	f.service.Close()
	f.sessions.forget(id)
	f.service = f.newService(t)
	before := len(f.watch.recorded())
	f.service.Sync(t.Context())

	if slices.ContainsFunc(f.watch.recorded()[before:], func(c string) bool {
		return strings.HasPrefix(c, "track:"+id+":")
	}) {
		t.Errorf("watch calls = %v, want the worktree left unwatched during the wait", f.watch.recorded()[before:])
	}

	// The tolerance for a reading without checks dies with the app: the first
	// reading of the poll starts the pass, and the test waits for it so that
	// the pass writes nothing after the test ends.
	f.polled(t, id, func(s reviewflow.State) bool {
		return s.Review.Phase == prreview.PhaseNone
	}, "the second pass to start after the restart")
}

func TestAPassKeepsWhatTheReadingItStartsFromShowsWrong(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.pulls.seed(withChecks(openPR(), gh.MergeableConflicting, passedCheck, failedCheck))
	id := f.start(t)

	stored, _ := f.reviews.Get(id)
	want := gh.Trouble{FailedChecks: []string{"lint"}, Conflict: true}
	if !stored.TroubleBaseline.Equal(want) || stored.Trouble.Any() {
		t.Errorf("baseline = %+v, trouble = %+v, want the reading of the first pass and no trouble",
			stored.TroubleBaseline, stored.Trouble)
	}

	f.sessions.goIdle(id)
	f.record(t, id, cleanReport(1, "Nothing to change."), headHash)
	f.update(t, id, func(r *prreview.Review) { r.Trouble = gh.Trouble{FailedChecks: []string{"test"}} })
	f.pulls.seed(withChecks(openPR(), gh.MergeableClean, passedCheck))
	if err := f.service.ReviewAgain(t.Context(), id, ""); err != nil {
		t.Fatalf("review again: %v", err)
	}

	stored, _ = f.reviews.Get(id)
	if stored.TroubleBaseline.Any() || stored.Trouble.Any() {
		t.Errorf("baseline = %+v, trouble = %+v, want the clean reading of the second pass and no trouble",
			stored.TroubleBaseline, stored.Trouble)
	}
}
