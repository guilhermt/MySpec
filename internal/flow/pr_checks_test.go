package flow_test

import (
	"errors"
	"slices"
	"strings"
	"testing"

	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/task"
)

// pendingChecks is a reading of GitHub a pass waits on: a check still running.
func pendingChecks() gh.PRChecks {
	return gh.PRChecks{
		Checks:    []gh.Check{{Name: "test", URL: "https://github.com/acme/api/runs/1", Pending: true}},
		Mergeable: gh.MergeableClean,
	}
}

// noChecks is a reading of a pull request without any check.
func noChecks() gh.PRChecks {
	return gh.PRChecks{Checks: []gh.Check{}, Mergeable: gh.MergeableClean}
}

// withChecks is the open pull request of the task as gh reads it with checks.
func withChecks(checks gh.PRChecks) gh.PR {
	pr := samePR
	pr.Checks = checks
	return pr
}

// foundPR brings a task to the moment its pull request was found, before the
// first pass, with gh reading it with checks.
func foundPR(f *fixture, checks gh.PRChecks) {
	tk := f.tasks.add("task-1", task.StagePR, prArtifacts(task.PRArtifacts{}))
	f.worktrees.seed(tk)
	f.worktrees.setStatus(git.Status{Head: startCommit})
	f.tasks.setPRRun("task-1", task.PRRun{Status: task.PRReviewing, PR: openPR()})
	f.gh.setPR("task-1", withChecks(checks))
}

// reviewOpen says whether the review session of the task is open.
func (f *fixture) reviewOpen() bool {
	_, ok := f.sessions.Summary(reviewKeyOf)
	return ok
}

// waitRead waits for the pull request of the task to be read more than before
// times.
func (f *fixture) waitRead(t *testing.T, before int) {
	t.Helper()

	waitFor(t, "a reading of the pull request", func() bool { return f.gh.viewCount("task-1") > before })
}

// pollUntil polls GitHub the way the timer of the app does until cond holds. A
// tick that finds a reading still under way is dropped, as it is in the app.
func (f *fixture) pollUntil(t *testing.T, subject string, cond func() bool) {
	t.Helper()

	waitFor(t, subject, func() bool {
		f.service.PollPRs()
		return cond()
	})
}

// startedStatus is the GitHub status section of the prompt the review session
// was started with.
func (f *fixture) startedStatus(t *testing.T) string {
	t.Helper()

	info, ok := f.sessions.info(reviewKeyOf)
	if !ok {
		t.Fatal("the review session was not started")
	}
	return githubStatus(info.Checks, info.MergeBase)
}

func TestTheFirstPassWaitsForPendingChecks(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	foundPR(f, pendingChecks())

	f.service.Check("task-1")
	f.waitPRRun(t, "the wait for the checks", func(run task.PRRun) bool { return run.Status == task.PRWaitingChecks })
	f.waitRead(t, 0)
	if got := f.prState(t, "task-1").Status; got != flow.PRWaitingChecks {
		t.Errorf("status = %q, want waiting_checks", got)
	}
	if f.reviewOpen() {
		t.Error("the review session opened while a check was pending")
	}

	f.gh.setPR("task-1", withChecks(passedChecks()))
	f.pollUntil(t, "the review session of the task", f.reviewOpen)

	status := f.startedStatus(t)
	for _, want := range []string{"## GitHub status", "1 check passed"} {
		if !strings.Contains(status, want) {
			t.Errorf("status section = %q, want it to contain %q", status, want)
		}
	}
	if run, _ := f.tasks.prRun("task-1"); run.Status != task.PRReviewing {
		t.Errorf("status = %q, want reviewing", run.Status)
	}
}

func TestAFailedCheckAndAConflictReachTheFirstPass(t *testing.T) {
	t.Parallel()

	const link = "https://github.com/acme/api/runs/9"
	f := newFixture(t)
	foundPR(f, gh.PRChecks{
		Checks:    []gh.Check{{Name: "lint", URL: link, Conclusion: "failure"}},
		Mergeable: gh.MergeableConflicting,
	})

	f.service.Check("task-1")
	waitFor(t, "the review session of the task", f.reviewOpen)

	status := f.startedStatus(t)
	for _, want := range []string{"## GitHub status", "`lint`", link, "conflicts with"} {
		if !strings.Contains(status, want) {
			t.Errorf("status section = %q, want it to contain %q", status, want)
		}
	}
}

func TestAReadingWithoutChecksRightAfterAPushIsReadAgain(t *testing.T) {
	t.Parallel()

	t.Run("the first pass", func(t *testing.T) {
		t.Parallel()

		f := newFixture(t)
		foundPR(f, noChecks())

		f.service.Check("task-1")
		f.waitRead(t, 0)
		f.waitPRRun(t, "the wait for the checks", func(run task.PRRun) bool { return run.Status == task.PRWaitingChecks })
		if f.reviewOpen() {
			t.Error("the first reading without checks started the pass")
		}

		f.pollUntil(t, "the review session of the task", f.reviewOpen)
		if got := f.gh.viewCount("task-1"); got != 2 {
			t.Errorf("readings = %d, want 2", got)
		}
		if status := f.startedStatus(t); !strings.Contains(status, "the pull request has no checks") {
			t.Errorf("status section = %q, want it to say there are no checks", status)
		}
	})

	t.Run("a review asked again", func(t *testing.T) {
		t.Parallel()

		f := newFixture(t)
		underReview(t, f)
		reportsWritten(f, reports(1, true))
		f.waitPRRun(t, "the pull request to be closed", func(run task.PRRun) bool { return run.Status == task.PRDone })
		f.gh.setPR("task-1", withChecks(noChecks()))
		before := f.gh.viewCount("task-1")

		if err := f.service.ReviewAgain(t.Context(), "task-1"); err != nil {
			t.Fatalf("ReviewAgain() = %v, want nil", err)
		}
		waitFor(t, "the session of the second pass", func() bool {
			info, ok := f.sessions.info(reviewKeyOf)
			return ok && info.ReviewPath == "/data/task-1/pr/review-2.md"
		})
		if got := f.gh.viewCount("task-1") - before; got != 1 {
			t.Errorf("readings = %d, want 1", got)
		}
	})
}

func TestThePassAfterACommitWaitsForTheChecksOfTheNewHead(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	underReview(t, f)
	reportsWritten(f, reports(1, false))
	f.waitPRRun(t, "the report of the first pass", func(run task.PRRun) bool { return run.ReportedPass == 1 })
	f.reviews.setSnapshot(staged(3, 3))
	f.sessions.goIdle("task-1")
	if err := f.service.ApprovePR(t.Context(), "task-1"); err != nil {
		t.Fatalf("ApprovePR() = %v, want nil", err)
	}

	// The agent committed and pushed: GitHub runs the checks of the new head.
	f.gh.setPR("task-1", withChecks(pendingChecks()))
	before := f.gh.viewCount("task-1")
	f.worktrees.setStatus(git.Status{Head: commitSHA})
	f.reviews.setSnapshot(review.Snapshot{Head: commitSHA})
	f.sessions.goIdle("task-1")
	f.service.Check("task-1")

	f.waitPRRun(t, "the wait for the checks", func(run task.PRRun) bool { return run.Status == task.PRWaitingChecks })
	f.waitRead(t, before)
	second := reviewPrompt("/data/task-1/pr/review-2.md")
	if f.sessions.sentCount(second) != 0 {
		t.Error("the second pass was asked for while a check was pending")
	}
	if !f.reviewOpen() {
		t.Error("the conversation of the review closed during the wait")
	}

	f.gh.setPR("task-1", withChecks(passedChecks()))
	f.pollUntil(t, "the prompt of the second pass", func() bool { return f.sessions.sentCount(second) > 0 })
	if got := f.sessions.sentCount("## GitHub status\n\n- Checks: 1 check passed."); got != 1 {
		t.Errorf("prompts with the status of the checks = %d, want 1", got)
	}
}

func TestReviewAgainWaitsForTheChecks(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name  string
		clean bool
		from  task.PRStatus
	}{
		{name: "done", clean: true, from: task.PRDone},
		{name: "reviewing", clean: false, from: task.PRReviewing},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			underReview(t, f)
			reportsWritten(f, reports(1, c.clean))
			f.waitPRRun(t, "the report of the first pass", func(run task.PRRun) bool {
				return run.ReportedPass == 1 && run.Status == c.from
			})
			f.gh.setPR("task-1", withChecks(pendingChecks()))
			before := f.gh.viewCount("task-1")

			if err := f.service.ReviewAgain(t.Context(), "task-1"); err != nil {
				t.Fatalf("ReviewAgain() = %v, want nil", err)
			}
			if run, _ := f.tasks.prRun("task-1"); run.Status != task.PRWaitingChecks {
				t.Errorf("status = %q, want waiting_checks", run.Status)
			}
			f.waitRead(t, before)
			if f.reviewOpen() {
				t.Error("the review session opened while a check was pending")
			}

			f.gh.setPR("task-1", withChecks(passedChecks()))
			f.pollUntil(t, "the session of the second pass", func() bool {
				info, ok := f.sessions.info(reviewKeyOf)
				return ok && f.reviewOpen() && info.ReviewPath == "/data/task-1/pr/review-2.md"
			})
		})
	}
}

func TestReviewAgainSaysWhenTheWaitIsNotRecorded(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	underReview(t, f)
	reportsWritten(f, reports(1, true))
	f.waitPRRun(t, "the pull request to be closed", func(run task.PRRun) bool { return run.Status == task.PRDone })

	errDisk := errors.New("disk full")
	f.tasks.failWith(errDisk)
	err := f.service.ReviewAgain(t.Context(), "task-1")
	wantErrIs(t, err, errDisk)
	if f.prState(t, "task-1").Status != flow.PRDone {
		t.Errorf("status = %q, want done", f.prState(t, "task-1").Status)
	}
}

func TestAReadingThatFailsBlocksTheStage(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	foundPR(f, passedChecks())
	f.gh.forgetPR("task-1")
	f.gh.failView(&gh.Error{Args: []string{"pr", "view"}, Output: "HTTP 502: Bad Gateway", ExitCode: 1})

	f.service.Check("task-1")
	f.waitPRRun(t, "the stage to be blocked", func(run task.PRRun) bool { return run.Status == task.PRBlocked })
	run, _ := f.tasks.prRun("task-1")
	if run.Block == nil || run.Block.Reason != task.PRBlockGHFailed || !strings.Contains(run.Block.Detail, "HTTP 502") {
		t.Errorf("block = %+v, want gh_failed with what gh said", run.Block)
	}

	f.gh.setPR("task-1", samePR)
	if err := f.service.RetryPR(t.Context(), "task-1"); err != nil {
		t.Fatalf("RetryPR() = %v, want nil", err)
	}
	waitFor(t, "the review session of the task", f.reviewOpen)
}

func TestAPullRequestMergedDuringTheWaitEndsTheReview(t *testing.T) {
	t.Parallel()

	cases := []struct {
		state gh.State
		want  flow.PRStatus
	}{
		{state: gh.StateMerged, want: flow.PRMerged},
		{state: gh.StateClosed, want: flow.PRClosedUnmerged},
	}
	for _, c := range cases {
		t.Run(string(c.state), func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			underReview(t, f)
			f.tasks.setPRRun("task-1", task.PRRun{Status: task.PRWaitingChecks, PR: openPR()})
			pr := withChecks(pendingChecks())
			pr.State = c.state
			f.gh.setPR("task-1", pr)

			f.service.PollPRs()
			f.waitPR(t, "task-1", c.want)
			if f.reviewOpen() {
				t.Error("the conversation of the review is still open")
			}
			if !slices.Contains(f.sessions.recorded(), "close:task-1:pr_review") {
				t.Errorf("session calls = %q, want the review session closed", f.sessions.recorded())
			}
		})
	}
}

func TestAWaitSurvivesARestart(t *testing.T) {
	t.Parallel()

	// The app opens on a task it left waiting for the checks of its first pass,
	// with no conversation yet.
	f := newFixture(t)
	foundPR(f, noChecks())
	f.tasks.setPRRun("task-1", task.PRRun{Status: task.PRWaitingChecks, PR: openPR()})

	f.service.Sync(t.Context())
	// The tolerance to a reading without checks died with the app that saw the
	// push: the first reading starts the pass.
	waitFor(t, "the review session of the task", f.reviewOpen)
	calls := f.sessions.recorded()
	if slices.Contains(calls, "open:task-1:pr_review") {
		t.Errorf("session calls = %q, want no empty conversation reopened", calls)
	}
	if !slices.Contains(calls, "start:task-1:pr_review:restarted=false") {
		t.Errorf("session calls = %q, want the review session started", calls)
	}
}

func TestRefreshRereadsTheChecksDuringTheWait(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	foundPR(f, pendingChecks())
	f.service.Check("task-1")
	f.waitPRRun(t, "the wait for the checks", func(run task.PRRun) bool { return run.Status == task.PRWaitingChecks })
	f.waitRead(t, 0)

	f.gh.setPR("task-1", withChecks(passedChecks()))
	waitFor(t, "the review session of the task", func() bool {
		if err := f.service.RefreshPR(t.Context(), "task-1"); err != nil {
			t.Fatalf("RefreshPR() = %v, want nil", err)
		}
		return f.reviewOpen()
	})
}

// failing is a reading of a pull request whose checks named failed and whose
// merge state is mergeable.
func failing(mergeable gh.Mergeable, names ...string) gh.PRChecks {
	checks := make([]gh.Check, 0, len(names))
	for _, name := range names {
		checks = append(checks, gh.Check{Name: name, Conclusion: "failure"})
	}
	return gh.PRChecks{Checks: checks, Mergeable: mergeable}
}

func TestAPassRecordsTheTroubleOfTheReadingItStartsFrom(t *testing.T) {
	t.Parallel()

	t.Run("the first pass", func(t *testing.T) {
		t.Parallel()

		f := newFixture(t)
		foundPR(f, failing(gh.MergeableConflicting, "lint"))
		f.tasks.setPRRun("task-1", task.PRRun{
			Status: task.PRReviewing, PR: openPR(), Trouble: gh.Trouble{FailedChecks: []string{"old"}},
		})

		f.service.Check("task-1")
		want := gh.Trouble{FailedChecks: []string{"lint"}, Conflict: true}
		f.waitPRRun(t, "the baseline of the first pass", func(run task.PRRun) bool {
			return run.TroubleBaseline.Equal(want)
		})
		if run, _ := f.tasks.prRun("task-1"); run.Trouble.Any() {
			t.Errorf("trouble = %+v, want none", run.Trouble)
		}
	})

	t.Run("the pass after a commit", func(t *testing.T) {
		t.Parallel()

		f := newFixture(t)
		underReview(t, f)
		reportsWritten(f, reports(1, false))
		f.waitPRRun(t, "the report of the first pass", func(run task.PRRun) bool { return run.ReportedPass == 1 })
		f.reviews.setSnapshot(staged(3, 3))
		f.sessions.goIdle("task-1")
		if err := f.service.ApprovePR(t.Context(), "task-1"); err != nil {
			t.Fatalf("ApprovePR() = %v, want nil", err)
		}

		f.gh.setPR("task-1", withChecks(failing(gh.MergeableClean, "test")))
		f.worktrees.setStatus(git.Status{Head: commitSHA})
		f.reviews.setSnapshot(review.Snapshot{Head: commitSHA})
		f.sessions.goIdle("task-1")
		f.service.Check("task-1")

		want := gh.Trouble{FailedChecks: []string{"test"}}
		f.waitPRRun(t, "the baseline of the second pass", func(run task.PRRun) bool {
			return run.TroubleBaseline.Equal(want)
		})
		if f.sessions.sentCount(reviewPrompt("/data/task-1/pr/review-2.md")) != 1 {
			t.Error("the second pass was not asked for")
		}
	})
}

// awaitingMerge puts the task after a clean review, with the baseline and the
// trouble recorded and gh reading its pull request with checks.
func awaitingMerge(f *fixture, state gh.State, baseline, trouble gh.Trouble, checks gh.PRChecks) {
	awaitingClosing(f, "task-1", plan(), task.PRRun{
		Status: task.PRDone, PR: openPR(), TroubleBaseline: baseline, Trouble: trouble,
	})
	pr := withChecks(checks)
	pr.State = state
	f.gh.setPR("task-1", pr)
}

func TestAReadingOfAPullRequestWaitingForTheMergeRecordsWhatWentWrongSinceTheReview(t *testing.T) {
	t.Parallel()

	lint := gh.Trouble{FailedChecks: []string{"lint"}}
	pendingLint := gh.PRChecks{Checks: []gh.Check{{Name: "lint", Pending: true}}, Mergeable: gh.MergeableClean}
	tests := []struct {
		name     string
		state    gh.State
		baseline gh.Trouble
		trouble  gh.Trouble
		checks   gh.PRChecks
		want     gh.Trouble
		status   flow.PRStatus
	}{
		{"a check that fails", gh.StateOpen, gh.Trouble{}, gh.Trouble{}, failing(gh.MergeableClean, "lint"), lint, flow.PRTrouble},
		{"a check that already failed", gh.StateOpen, lint, gh.Trouble{}, failing(gh.MergeableClean, "lint"), gh.Trouble{}, flow.PRDone},
		{"a check pending again", gh.StateOpen, gh.Trouble{}, lint, pendingLint, lint, flow.PRTrouble},
		{"the trouble gone", gh.StateOpen, gh.Trouble{}, lint, passedChecks(), gh.Trouble{}, flow.PRDone},
		{"a merged pull request", gh.StateMerged, gh.Trouble{}, gh.Trouble{}, failing(gh.MergeableClean, "lint"), gh.Trouble{}, flow.PRMerged},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			awaitingMerge(f, test.state, test.baseline, test.trouble, test.checks)

			f.service.PollPRs()
			f.waitEvaluations(t, 1)
			run, _ := f.tasks.prRun("task-1")
			if !run.Trouble.Equal(test.want) {
				t.Errorf("trouble = %+v, want %+v", run.Trouble, test.want)
			}
			if got := f.prState(t, "task-1").Status; got != test.status {
				t.Errorf("status = %q, want %q", got, test.status)
			}
		})
	}
}

func TestANewTroubleIsRecordedOnlyWhenItChanges(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	awaitingMerge(f, gh.StateOpen, gh.Trouble{}, gh.Trouble{FailedChecks: []string{"lint"}},
		failing(gh.MergeableClean, "lint"))

	f.service.PollPRs()
	f.waitEvaluations(t, 1)
	if calls := f.tasks.recorded(); slices.Contains(calls, "prTrouble:task-1") {
		t.Errorf("task calls = %q, want the same trouble not recorded again", calls)
	}
}

func TestAReadingThatFailsKeepsTheTrouble(t *testing.T) {
	t.Parallel()

	trouble := gh.Trouble{FailedChecks: []string{"lint"}, Conflict: true}
	f := newFixture(t)
	awaitingClosing(f, "task-1", plan(), task.PRRun{Status: task.PRDone, PR: openPR(), Trouble: trouble})
	f.gh.failView(errors.New("gh pr view: connection refused"))

	f.service.PollPRs()
	waitFor(t, "the failed reading of the pull request", func() bool {
		return f.prState(t, "task-1").CheckError != ""
	})
	if run, _ := f.tasks.prRun("task-1"); !run.Trouble.Equal(trouble) {
		t.Errorf("trouble = %+v, want %+v", run.Trouble, trouble)
	}
}
