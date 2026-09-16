package flow_test

import (
	"errors"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"testing"

	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/worktree"
)

// samePR is the pull request gh answers with about a branch that has one.
var samePR = gh.PR{Number: 7, URL: "https://github.com/acme/api/pull/7", State: gh.StateOpen}

// inPR puts a task straight in the PR stage, with its worktree and the record
// of its pull request, which is where most PR tests start.
func inPR(f *fixture, id string, plan task.Plan, status task.PRStatus) task.Task {
	t := f.tasks.add(id, task.StagePR, task.Artifacts{PRD: true, TechSpec: true, Plan: plan})
	f.worktrees.seed(t)
	f.tasks.setPRRun(id, task.PRRun{Status: status})
	return t
}

// prState is the PR stage of a task, failing the test when it has none.
func (f *fixture) prState(t *testing.T, id string) flow.PullRequest {
	t.Helper()

	pr, ok := f.service.PullRequest(id)
	if !ok {
		t.Fatalf("task %s is not in the pull request stage", id)
	}
	return pr
}

// waitPR polls until the pull request of a task reaches a status.
func (f *fixture) waitPR(t *testing.T, id string, status flow.PRStatus) {
	t.Helper()

	waitFor(t, "the pull request of "+id+" to be "+string(status), func() bool {
		pr, ok := f.service.PullRequest(id)
		return ok && pr.Status == status
	})
}

// prSession is the conversation of the pull request of a task.
func prSession(id string) session.Key {
	return session.Key{TaskID: id, Stage: session.PRStage}
}

// waitPRSession polls until the session of the pull request has been opened,
// and answers with what it was started with. Drafting is recorded before the
// session starts, so a test that waits on the status alone can still be ahead
// of the Start call.
func (f *fixture) waitPRSession(t *testing.T, id string) session.TaskInfo {
	t.Helper()

	key := prSession(id)
	waitFor(t, "the pull request session of "+id, func() bool {
		_, ok := f.sessions.info(key)
		return ok
	})
	info, _ := f.sessions.info(key)
	return info
}

// startPR brings a task to the commit of the last step of its plan, which is
// what puts it in the PR stage.
func startPR(t *testing.T, f *fixture, plan task.Plan) {
	t.Helper()

	last := plan.Steps[len(plan.Steps)-1]
	for _, step := range plan.Steps[:len(plan.Steps)-1] {
		f.tasks.setStepRun("task-1", task.StepRun{
			Number: step.Number, Status: task.StepDone, CommitSHA: startCommit, CommitSubject: "Do the work",
		})
	}
	f.worktrees.setStatus(git.Status{Head: startCommit})
	f.reviews.setSnapshot(staged(1, 1))
	implementing(f, "task-1", plan)

	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", last.Number, flow.StepImplementing)
	f.waitStepSession(t, "task-1", last.Number)
	f.sessions.goIdle("task-1")

	if err := f.service.ApproveStep(t.Context(), "task-1"); err != nil {
		t.Fatalf("ApproveStep() = %v, want nil", err)
	}
	f.reviews.setSnapshot(review.Snapshot{Head: commitSHA})
	f.sessions.goIdle("task-1")
	f.service.Check("task-1")
	f.waitStage(t, "task-1", task.StagePR)
}

func TestThePRStageOfATaskOpensOneDraftConversation(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	startPR(t, f, twoStepPlan())

	f.waitPR(t, "task-1", flow.PRDrafting)

	state := f.prState(t, "task-1")
	if state.Block != nil || state.Draft != nil {
		t.Errorf("state = %+v, want no block and no draft yet", state)
	}

	// The conversation of the stage runs in the worktree of the task.
	info := f.waitPRSession(t, "task-1")
	if want := worktree.Path(dataDir, "dev", "web", "task-1"); info.Dir != want {
		t.Errorf("session dir = %q, want %q", info.Dir, want)
	}
	if info.Repository != "dev/web" || info.Branch != "task-1" || info.BaseBranch != "origin/dev" {
		t.Errorf("session = %+v, want the repository, the branch and the base of the worktree", info)
	}
	if want := "/data/task-1/pr/draft.md"; info.DraftPath != want {
		t.Errorf("draft path = %q, want %q", info.DraftPath, want)
	}
	// The review of the steps is over: what is watched now is a pull request.
	if !slices.Contains(f.reviews.reviewCalls(), "forget:task-1") {
		t.Errorf("review calls = %q, want the task forgotten", f.reviews.reviewCalls())
	}
}

func TestTheCommitOfTheOneShotStepOpensThePRStage(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.setTaskMode("task-1", task.ModeOneShot)
	startPR(t, f, oneShotPlan())

	f.waitPR(t, "task-1", flow.PRDrafting)
	// The pull request is described from the document, which stands for the PRD
	// and the tech spec.
	tk, _ := f.tasks.Get("task-1")
	if info := f.waitPRSession(t, "task-1"); info.OneShotPath != tk.OneShotPath() {
		t.Errorf("document of the pr session = %q, want %q", info.OneShotPath, tk.OneShotPath())
	}
}

func TestWhatBlocksThePRStageOfATask(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		arrange func(f *fixture)
		reason  task.PRBlockReason
		detail  string
	}{
		{
			name:    "gh is not installed",
			arrange: func(f *fixture) { f.gh.failAuth(gh.ErrNotFound) },
			reason:  task.PRBlockGHMissing,
			detail:  gh.ErrNotFound.Error(),
		},
		{
			name:    "gh is not logged in",
			arrange: func(f *fixture) { f.gh.failAuth(gh.ErrNotAuthenticated) },
			reason:  task.PRBlockGHAuth,
			detail:  gh.ErrNotAuthenticated.Error(),
		},
		{
			name:    "gh failed some other way",
			arrange: func(f *fixture) { f.gh.failAuth(errors.New("gh auth status: connection refused")) },
			reason:  task.PRBlockGHFailed,
			detail:  "gh auth status: connection refused",
		},
		{
			name:    "the pull request could not be read",
			arrange: func(f *fixture) { f.gh.failView(errors.New("gh pr view: bad credentials")) },
			reason:  task.PRBlockGHFailed,
			detail:  "gh pr view: bad credentials",
		},
		{
			name:    "git could not say where the branch came from",
			arrange: func(f *fixture) { f.worktrees.failBase(errors.New("git rev-parse: bad revision")) },
			reason:  task.PRBlockGitFailed,
			detail:  "git rev-parse: bad revision",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			test.arrange(f)
			inPR(f, "task-1", plan(), task.PRPreparing)

			f.service.Sync(t.Context())
			f.waitPR(t, "task-1", flow.PRBlocked)

			block := f.prState(t, "task-1").Block
			if block == nil {
				t.Fatal("the pull request is blocked with no reason")
			}
			if block.Reason != test.reason {
				t.Errorf("reason = %q, want %q", block.Reason, test.reason)
			}
			// The tool speaks for itself: the app never rewrites what it said.
			if block.Detail != test.detail {
				t.Errorf("detail = %q, want %q", block.Detail, test.detail)
			}
		})
	}
}

func TestATaskWithNoWorktreeIsBlocked(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.add("task-1", task.StagePR, task.Artifacts{PRD: true, TechSpec: true, Plan: plan()})
	f.tasks.setPRRun("task-1", task.PRRun{Status: task.PRPreparing})

	f.service.Sync(t.Context())
	f.waitPR(t, "task-1", flow.PRBlocked)

	block := f.prState(t, "task-1").Block
	if block == nil || block.Reason != task.PRBlockNoWorktree {
		t.Errorf("block = %+v, want no_worktree", block)
	}
}

func TestADraftThatIsWrittenAwaitsTheOK(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	inPR(f, "task-1", plan(), task.PRDrafting)
	f.sessions.setSummary("task-1", session.Summary{Stage: session.PRStage, Status: session.StatusWorking})

	// While the agent writes, the draft is not the user's yet.
	if got := f.prState(t, "task-1").Status; got != flow.PRDrafting {
		t.Errorf("status = %q, want drafting", got)
	}

	f.tasks.setArtifacts("task-1", prArtifacts(task.PRArtifacts{
		Draft: task.Draft{Present: true, Title: "Add the login screen", Body: "It adds the screen."},
	}))
	if got := f.prState(t, "task-1").Status; got != flow.PRDrafting {
		t.Errorf("status = %q, want drafting: the agent has not stopped", got)
	}

	f.sessions.goIdle("task-1")
	state := f.prState(t, "task-1")
	if state.Status != flow.PRDraftReady {
		t.Errorf("status = %q, want draft_ready", state.Status)
	}
	if state.Draft == nil || state.Draft.Title != "Add the login screen" {
		t.Errorf("draft = %+v, want the one on disk", state.Draft)
	}
}

func TestADraftSessionThatStopsWithoutADraftWaitsForAReply(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	inPR(f, "task-1", plan(), task.PRDrafting)
	f.sessions.setSummary("task-1", session.Summary{Stage: session.PRStage, Status: session.StatusWorking})

	if got := f.prState(t, "task-1").Status; got != flow.PRDrafting {
		t.Errorf("status = %q, want drafting while the agent works", got)
	}

	// The agent stopped with no draft on disk: it asked something, and nothing
	// moves until the user answers.
	f.sessions.goIdle("task-1")
	if got := f.prState(t, "task-1").Status; got != flow.PRAwaitingReply {
		t.Errorf("status = %q, want awaiting_reply", got)
	}

	f.tasks.setArtifacts("task-1", prArtifacts(task.PRArtifacts{
		Draft: task.Draft{Present: true, Title: "Add the login screen", Body: "It adds the screen."},
	}))
	if got := f.prState(t, "task-1").Status; got != flow.PRDraftReady {
		t.Errorf("status = %q, want draft_ready once the draft is there", got)
	}
}

func TestAPullRequestThatAlreadyExistsSkipsTheDraft(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.gh.setPR("task-1", samePR)
	inPR(f, "task-1", plan(), task.PRPreparing)

	f.service.Sync(t.Context())
	waitFor(t, "the pull request to be recorded", func() bool {
		run, ok := f.tasks.prRun("task-1")
		return ok && run.Status == task.PRReviewing
	})

	run, _ := f.tasks.prRun("task-1")
	if run.PR.Number != samePR.Number || run.PR.URL != samePR.URL || run.PR.State != task.PRStateOpen {
		t.Errorf("pull request = %+v, want the one gh reported", run.PR)
	}
	if run.PR.CheckedAt.IsZero() {
		t.Error("the pull request was recorded with no reading time")
	}
	// The draft is for a task that has no pull request yet.
	if slices.Contains(f.sessions.recorded(), "start:task-1:pr") {
		t.Errorf("session calls = %q, want no draft session", f.sessions.recorded())
	}
}

func TestAPullRequestOpenedByTheAgentIsNoticed(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	inPR(f, "task-1", plan(), task.PRDrafting)
	f.sessions.setSummary("task-1", session.Summary{
		Stage: session.PRStage, Status: session.StatusWaiting, Idle: true,
	})
	f.gh.setPR("task-1", samePR)

	f.service.Check("task-1")
	waitFor(t, "the pull request to be found", func() bool {
		run, ok := f.tasks.prRun("task-1")
		return ok && run.Status == task.PRReviewing
	})
}

func TestAPullRequestThatDidNotOpenGivesTheDraftBack(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	inPR(f, "task-1", plan(), task.PROpening)
	f.tasks.setArtifacts("task-1", prArtifacts(task.PRArtifacts{
		Draft: task.Draft{Present: true, Title: "t", Body: "b"},
	}))
	f.sessions.setSummary("task-1", session.Summary{
		Stage: session.PRStage, Status: session.StatusWaiting, Idle: true,
	})

	f.service.Check("task-1")
	waitFor(t, "the draft to come back", func() bool {
		run, ok := f.tasks.prRun("task-1")
		return ok && run.Status == task.PRDrafting
	})
	// The agent ended the turn without the pull request it was asked for: the
	// draft is back, and so is the conversation, which is where it says why.
	f.waitPR(t, "task-1", flow.PRAwaitingReply)

	// Once the conversation moves on, what the agent does in that turn decides.
	f.sessions.setSummary("task-1", session.Summary{
		Stage: session.PRStage, Status: session.StatusWorking, TurnRunning: true,
	})
	f.service.Check("task-1")
	f.sessions.goIdle("task-1")
	f.service.Check("task-1")
	f.waitPR(t, "task-1", flow.PRDraftReady)
}

func TestAPullRequestIsLookedForOnceTheTurnThatOpensItIsOver(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	inPR(f, "task-1", plan(), task.PROpening)
	f.tasks.setArtifacts("task-1", prArtifacts(task.PRArtifacts{
		Draft: task.Draft{Present: true, Title: "t", Body: "b"},
	}))
	f.sessions.setSummary("task-1", session.Summary{
		Stage: session.PRStage, Status: session.StatusWorking, TurnRunning: true,
	})

	// While the agent opens the pull request, GitHub has nothing to say yet, and
	// the draft is not given back in the middle of the turn. The second
	// evaluation starts only once the first one is over.
	before := f.tasks.inspectCount()
	f.service.Check("task-1")
	f.waitEvaluations(t, before+1)
	f.service.Check("task-1")
	f.waitEvaluations(t, before+2)
	if calls := f.gh.ghCalls(); len(calls) != 0 {
		t.Errorf("gh calls = %q, want none while the turn runs", calls)
	}
	if got := f.prState(t, "task-1").Status; got != flow.PROpening {
		t.Errorf("status = %q, want opening while the turn runs", got)
	}

	// The turn ended without the pull request, and the agent waits for a reply.
	f.sessions.setSummary("task-1", session.Summary{
		Stage: session.PRStage, Status: session.StatusWaiting, Idle: true,
	})
	f.service.Check("task-1")
	f.waitPR(t, "task-1", flow.PRAwaitingReply)
}

func TestResumingThePRStageOpensTheSessionItWasLeftIn(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	tk := f.tasks.add("task-1", task.StagePR, task.Artifacts{PRD: true, TechSpec: true, Plan: plan()})
	f.worktrees.seed(tk)
	f.tasks.setPRRun("task-1", task.PRRun{
		Status: task.PRReviewing, ReportedPass: 1,
		PR: task.PRDetails{Number: 7, URL: samePR.URL, State: task.PRStateOpen},
	})

	f.service.Sync(t.Context())
	waitFor(t, "the review session", func() bool {
		return slices.Contains(f.sessions.recorded(), "open:task-1:pr_review")
	})

	// The review session is opened for the pass it is about to write.
	info, ok := f.sessions.info(session.Key{TaskID: "task-1", Stage: session.PRReviewStage})
	if !ok {
		t.Fatal("the review session was not opened")
	}
	if want := "/data/task-1/pr/review-2.md"; info.ReviewPath != want {
		t.Errorf("review path = %q, want %q", info.ReviewPath, want)
	}
	if info.PRNumber != "7" || info.PRURL != samePR.URL {
		t.Errorf("session = %+v, want the pull request it reviews", info)
	}
}

func TestDiscardingThePlanTearsDownThePullRequests(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	inPR(f, "task-1", plan(), task.PRDrafting)
	f.tasks.setStepRun("task-1", task.StepRun{Number: 1, Status: task.StepDone, CommitSHA: commitSHA})

	if err := f.service.Discard(t.Context(), "task-1", task.StagePlan); err != nil {
		t.Fatalf("Discard() = %v, want nil", err)
	}

	if _, ok := f.tasks.prRun("task-1"); ok {
		t.Error("the pr run is still there, want it forgotten")
	}
	// The two conversations of the stage go with it.
	if !slices.Contains(f.sessions.recorded(), "discard:task-1:pr,pr_review") {
		t.Errorf("session calls = %q, want the pr sessions discarded", f.sessions.recorded())
	}
	calls := f.tasks.recorded()
	if !slices.Contains(calls, "clearPR:task-1") || !slices.Contains(calls, "remove:task-1:pr") {
		t.Errorf("task calls = %q, want the pr run and the pr folder removed", calls)
	}
	// The pull request goes before the worktree it runs in.
	teardown := slices.Index(calls, "clearPR:task-1")
	removal := slices.Index(f.worktrees.recorded(), "remove:task-1")
	if teardown < 0 || removal < 0 {
		t.Fatalf("task calls = %q, worktree calls = %q, want both", calls, f.worktrees.recorded())
	}
}

func TestBackToTheOneShotPlanningTearsDownThePullRequest(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.setTaskMode("task-1", task.ModeOneShot)
	inPR(f, "task-1", oneShotPlan(), task.PRDrafting)
	f.tasks.setArtifacts("task-1", task.Artifacts{OneShot: true, Plan: oneShotPlan()})
	f.tasks.setStepRun("task-1", task.StepRun{Number: 1, Status: task.StepDone, CommitSHA: commitSHA})
	f.tasks.setStepReports("task-1", 1, stepReport(1, 1, true))

	if err := f.service.Back(t.Context(), "task-1", task.StageOneShot); err != nil {
		t.Fatalf("Back() = %v, want nil", err)
	}

	if _, ok := f.tasks.prRun("task-1"); ok {
		t.Error("the pr run is still there, want it forgotten")
	}
	if runs := f.tasks.StepRuns("task-1"); len(runs) != 0 {
		t.Errorf("step runs = %+v, want none", runs)
	}
	sessionCalls := f.sessions.recorded()
	if !slices.Contains(sessionCalls, "discard:task-1:pr,pr_review") {
		t.Errorf("session calls = %q, want the pr sessions discarded", sessionCalls)
	}
	if last := sessionCalls[len(sessionCalls)-1]; last != "open:task-1:one_shot" {
		t.Errorf("last session call = %q, want the planning reopened", last)
	}
	taskCalls := f.tasks.recorded()
	for _, want := range []string{
		"clearPR:task-1", "remove:task-1:pr", "remove:task-1:implementation", "stage:task-1:one_shot:revisiting=true",
	} {
		if !slices.Contains(taskCalls, want) {
			t.Errorf("task calls = %q, want %q", taskCalls, want)
		}
	}
	if !slices.Contains(f.worktrees.recorded(), "remove:task-1") {
		t.Errorf("worktree calls = %q, want the worktree removed", f.worktrees.recorded())
	}
	if a, _ := f.tasks.Inspect("task-1"); !a.OneShot || len(a.StepReports) != 0 {
		t.Errorf("artifacts = %+v, want the document without the reports of its step", a)
	}
}

// reports are the reports of the passes a review has written, the last one
// clean or not.
func reports(passes int, clean bool) []task.ReviewReport {
	written := make([]task.ReviewReport, 0, passes)
	for pass := 1; pass <= passes; pass++ {
		written = append(written, task.ReviewReport{
			Pass: pass, File: "review-" + strconv.Itoa(pass) + ".md", Clean: clean && pass == passes,
		})
	}
	return written
}

func TestAPullRequestUnderReviewIsShownByItsLastReport(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		reports []task.ReviewReport
		idle    bool
		snap    review.Snapshot
		read    bool
		want    flow.PRStatus
	}{
		{"the agent is reviewing", nil, false, review.Snapshot{}, false, flow.PRReviewing},
		{"no report yet", nil, true, review.Snapshot{}, false, flow.PRAwaitingReply},
		{"the agent is applying what was approved", reports(1, false), false, reviewed(1, 2), true, flow.PRReviewing},
		{"the pass closed clean", reports(2, true), true, review.Snapshot{}, false, flow.PRDone},
		{"nothing decided yet", reports(1, false), true, review.Snapshot{}, false, flow.PRAwaitingDecision},
		{"nothing changed yet", reports(1, false), true, reviewed(0, 0), true, flow.PRAwaitingDecision},
		{"the worktree could not be read", reports(1, false), true, review.Snapshot{Err: "git status: gone"}, true, flow.PRAwaitingDecision},
		{"part of it reviewed", reports(1, false), true, reviewed(1, 3), true, flow.PRInReview},
		{"all of it reviewed", reports(1, false), true, reviewed(3, 3), true, flow.PRReadyToApprove},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			inPR(f, "task-1", plan(), task.PRReviewing)
			f.tasks.setArtifacts("task-1", prArtifacts(task.PRArtifacts{Reports: test.reports}))
			status := session.StatusWorking
			if test.idle {
				status = session.StatusWaiting
			}
			f.sessions.setSummary("task-1", session.Summary{
				Stage: session.PRReviewStage, Status: status, Idle: test.idle,
			})
			if test.read {
				f.reviews.setSnapshot(test.snap)
			}

			state := f.prState(t, "task-1")
			if state.Status != test.want {
				t.Errorf("status = %q, want %q", state.Status, test.want)
			}
			if len(state.Reports) != len(test.reports) {
				t.Errorf("reports = %d, want %d", len(state.Reports), len(test.reports))
			}
			if want := session.PRReviewStage; state.SessionStage != want {
				t.Errorf("session stage = %q, want %q", state.SessionStage, want)
			}
		})
	}
}

// loginCard is the card of the board a task of the tests was created from.
func loginCard() task.Card {
	return task.Card{
		Owner: "dev", Name: "web", Number: 12, Title: "Add the login screen", Body: "Users sign in.",
		URL: "https://github.com/dev/web/issues/12", State: task.IssueOpen,
	}
}

func TestThePRSessionOfATaskCreatedFromACardCarriesTheCard(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	inPR(f, "task-1", plan(), task.PRDrafting)
	f.tasks.useCard("task-1", loginCard())

	f.service.Sync(t.Context())
	info := f.waitPRSession(t, "task-1")

	if info.Card != loginCard().Markdown() || info.CardReference != "dev/web#12" {
		t.Errorf("session card = %q, reference = %q, want the card of the task", info.Card, info.CardReference)
	}
}

func TestThePRSessionOfATaskWithoutACardCarriesNoCard(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	inPR(f, "task-1", plan(), task.PRDrafting)

	f.service.Sync(t.Context())
	info := f.waitPRSession(t, "task-1")

	if info.Card != "" || info.CardReference != "" {
		t.Errorf("session card = %q, reference = %q, want none", info.Card, info.CardReference)
	}
}

func TestOpeningThePullRequestOfATaskCreatedFromACardClosesTheCard(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		body string
		want string
	}{
		{"a body without the reference gets it", "It adds the screen.", "It adds the screen.\n\nCloses dev/web#12"},
		{"a body that closes the card is kept", "Fixes #12\n\nIt adds the screen.", "Fixes #12\n\nIt adds the screen."},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			dir := t.TempDir()
			inPR(f, "task-1", plan(), task.PRDrafting)
			f.tasks.useDir("task-1", dir)
			f.tasks.useCard("task-1", loginCard())
			f.sessions.setSummary("task-1", session.Summary{
				Stage: session.PRStage, Status: session.StatusWaiting, Idle: true,
			})

			if err := f.service.OpenPR(t.Context(), "task-1", "Add the login screen", test.body); err != nil {
				t.Fatalf("OpenPR() = %v, want nil", err)
			}

			written, err := os.ReadFile(filepath.Join(dir, "pr", "draft.md"))
			if err != nil {
				t.Fatalf("read draft: %v", err)
			}
			if !strings.HasSuffix(strings.TrimRight(string(written), "\n"), "\n"+test.want) {
				t.Errorf("draft = %q, want its body to be %q", written, test.want)
			}
		})
	}
}
