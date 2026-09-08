package flow_test

import (
	"errors"
	"slices"
	"strconv"
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

// inPR puts a task straight in the PR stage, with the worktree and the record
// of every repository its plan names, which is where most PR tests start.
func inPR(f *fixture, id string, plan task.Plan, status task.PRStatus) task.Task {
	t := f.tasks.add(id, task.StagePR, task.Artifacts{PRD: true, TechSpec: true, Plan: plan})
	for _, repo := range planRepos(plan) {
		f.worktrees.seed(t, repo)
		f.tasks.setPRRun(id, task.PRRun{RepoPath: repo.Path, Status: status})
	}
	return t
}

// planRepos are the repositories of the fake workspace the steps of a plan
// name, in the order they first appear.
func planRepos(plan task.Plan) []task.Repository {
	found := make([]task.Repository, 0, len(plan.Steps))
	for _, step := range plan.Steps {
		index := slices.IndexFunc(repos, func(r task.Repository) bool { return r.Path == step.RepoPath })
		if index < 0 {
			continue
		}
		if slices.Contains(found, repos[index]) {
			continue
		}
		found = append(found, repos[index])
	}
	return found
}

// repoState is the state of a repository of a task, failing the test when the
// task has none for it.
func (f *fixture) repoState(t *testing.T, id, repoPath string) flow.RepoState {
	t.Helper()

	for _, state := range f.service.Repos(id) {
		if state.RepoPath == repoPath {
			return state
		}
	}
	t.Fatalf("task %s has no repository %s", id, repoPath)
	return flow.RepoState{}
}

// waitRepo polls until a repository of a task reaches a status.
func (f *fixture) waitRepo(t *testing.T, id, repoPath string, status flow.RepoStatus) {
	t.Helper()

	waitFor(t, "repository "+repoPath+" of "+id+" to be "+string(status), func() bool {
		for _, state := range f.service.Repos(id) {
			if state.RepoPath == repoPath {
				return state.Status == status
			}
		}
		return false
	})
}

// prSession is the conversation of the pull request of a repository.
func prSession(id, slug string) session.Key {
	return session.Key{TaskID: id, Stage: session.PRStage(slug)}
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
	tk := implementing(f, "task-1", plan)
	// The worktrees of the steps that were committed before are already there.
	for _, repo := range planRepos(plan)[:len(planRepos(plan))-1] {
		f.worktrees.seed(tk, repo)
	}

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

func TestTheLastCommitOfAPlanOpensThePRStageOfEveryRepository(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	startPR(t, f, twoStepPlan())

	f.waitRepo(t, "task-1", repos[0].Path, flow.RepoDrafting)
	f.waitRepo(t, "task-1", repos[1].Path, flow.RepoDrafting)

	states := f.service.Repos("task-1")
	if len(states) != 2 {
		t.Fatalf("repositories = %d, want the two the steps named", len(states))
	}
	// The order is the one the steps named them in, not the one of the paths.
	if states[0].Repository != "api" || states[1].Repository != "web" {
		t.Errorf("repositories = %q, %q, want api, web", states[0].Repository, states[1].Repository)
	}
	for _, state := range states {
		if state.Slug != state.Repository {
			t.Errorf("slug of %s = %q, want %q", state.Repository, state.Slug, state.Repository)
		}
		if state.Block != nil || state.Draft != nil {
			t.Errorf("state of %s = %+v, want no block and no draft yet", state.Repository, state)
		}
	}

	// Each repository has a conversation of its own, in its own worktree.
	info, ok := f.sessions.info(prSession("task-1", "api"))
	if !ok {
		t.Fatal("the pr session of api was not started")
	}
	if want := worktree.Path(workspace, "api", "task-1"); info.Dir != want {
		t.Errorf("session dir = %q, want %q", info.Dir, want)
	}
	if info.Repository != "api" || info.Branch != "task-1" || info.BaseBranch != "origin/dev" {
		t.Errorf("session = %+v, want the repository, the branch and the base of the worktree", info)
	}
	if want := "/data/task-1/pr/api-draft.md"; info.DraftPath != want {
		t.Errorf("draft path = %q, want %q", info.DraftPath, want)
	}
	if !slices.Contains(f.sessions.recorded(), "start:task-1:pr:web:restarted=false") {
		t.Errorf("session calls = %q, want the pr session of web started", f.sessions.recorded())
	}
	// The review of the steps is over: what is watched now is a pull request.
	if !slices.Contains(f.reviews.reviewCalls(), "forget-task:task-1") {
		t.Errorf("review calls = %q, want the task forgotten", f.reviews.reviewCalls())
	}
}

func TestABranchWithNoCommitOfItsOwnIsSkipped(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.worktrees.setAhead(0)
	inPR(f, "task-1", twoStepPlan(), task.PRPreparing)

	f.service.Sync(t.Context())
	f.waitRepo(t, "task-1", repos[0].Path, flow.RepoSkipped)
	f.waitRepo(t, "task-1", repos[1].Path, flow.RepoSkipped)

	// A repository with nothing to open a pull request for is never asked
	// about one.
	if calls := f.gh.ghCalls(); len(calls) != 0 {
		t.Errorf("gh calls = %q, want none", calls)
	}
	for _, call := range f.sessions.recorded() {
		if call == "start:task-1:pr:api" || call == "start:task-1:pr:web" {
			t.Errorf("session calls = %q, want no pr session", f.sessions.recorded())
		}
	}
}

func TestWhatBlocksThePRStageOfARepository(t *testing.T) {
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
			name:    "git could not count the commits",
			arrange: func(f *fixture) { f.worktrees.failAhead(errors.New("git rev-list: bad revision")) },
			reason:  task.PRBlockGitFailed,
			detail:  "git rev-list: bad revision",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			test.arrange(f)
			inPR(f, "task-1", plan(), task.PRPreparing)

			f.service.Sync(t.Context())
			f.waitRepo(t, "task-1", repos[0].Path, flow.RepoBlocked)

			block := f.repoState(t, "task-1", repos[0].Path).Block
			if block == nil {
				t.Fatal("the repository is blocked with no reason")
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

func TestARepositoryWithNoWorktreeIsBlocked(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.add("task-1", task.StagePR, task.Artifacts{PRD: true, TechSpec: true, Plan: plan()})
	f.tasks.setPRRun("task-1", task.PRRun{RepoPath: repos[0].Path, Status: task.PRPreparing})

	f.service.Sync(t.Context())
	f.waitRepo(t, "task-1", repos[0].Path, flow.RepoBlocked)

	block := f.repoState(t, "task-1", repos[0].Path).Block
	if block == nil || block.Reason != task.PRBlockNoWorktree {
		t.Errorf("block = %+v, want no_worktree", block)
	}
}

func TestADraftThatIsWrittenAwaitsTheOK(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	inPR(f, "task-1", plan(), task.PRDrafting)
	f.sessions.setSummary("task-1", session.Summary{Stage: session.PRStage("api"), Status: session.StatusWorking})

	// While the agent writes, the draft is not the user's yet.
	if got := f.repoState(t, "task-1", repos[0].Path).Status; got != flow.RepoDrafting {
		t.Errorf("status = %q, want drafting", got)
	}

	f.tasks.setArtifacts("task-1", task.Artifacts{
		PRD: true, TechSpec: true, Plan: plan(),
		PR: map[string]task.RepoArtifacts{
			"api": {Draft: task.Draft{Present: true, Title: "Add the login screen", Body: "It adds the screen."}},
		},
	})
	if got := f.repoState(t, "task-1", repos[0].Path).Status; got != flow.RepoDrafting {
		t.Errorf("status = %q, want drafting: the agent has not stopped", got)
	}

	f.sessions.goIdle("task-1")
	state := f.repoState(t, "task-1", repos[0].Path)
	if state.Status != flow.RepoDraftReady {
		t.Errorf("status = %q, want draft_ready", state.Status)
	}
	if state.Draft == nil || state.Draft.Title != "Add the login screen" {
		t.Errorf("draft = %+v, want the one on disk", state.Draft)
	}
}

func TestAPullRequestThatAlreadyExistsSkipsTheDraft(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.gh.setPR("task-1", samePR)
	inPR(f, "task-1", plan(), task.PRPreparing)

	f.service.Sync(t.Context())
	waitFor(t, "the pull request of api to be recorded", func() bool {
		run, ok := f.tasks.prRun("task-1", repos[0].Path)
		return ok && run.Status == task.PRReviewing
	})

	run, _ := f.tasks.prRun("task-1", repos[0].Path)
	if run.PR.Number != samePR.Number || run.PR.URL != samePR.URL || run.PR.State != task.PRStateOpen {
		t.Errorf("pull request = %+v, want the one gh reported", run.PR)
	}
	if run.PR.CheckedAt.IsZero() {
		t.Error("the pull request was recorded with no reading time")
	}
	// The draft is for a repository that has no pull request yet.
	if slices.Contains(f.sessions.recorded(), "start:task-1:pr:api") {
		t.Errorf("session calls = %q, want no draft session", f.sessions.recorded())
	}
}

func TestAPullRequestOpenedByTheAgentIsNoticed(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	inPR(f, "task-1", plan(), task.PRDrafting)
	f.sessions.setSummary("task-1", session.Summary{
		Stage: session.PRStage("api"), Status: session.StatusWaiting, Idle: true,
	})
	f.gh.setPR("task-1", samePR)

	f.service.Check("task-1")
	waitFor(t, "the pull request of api to be found", func() bool {
		run, ok := f.tasks.prRun("task-1", repos[0].Path)
		return ok && run.Status == task.PRReviewing
	})
}

func TestAPullRequestThatDidNotOpenGivesTheDraftBack(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	inPR(f, "task-1", plan(), task.PROpening)
	f.sessions.setSummary("task-1", session.Summary{
		Stage: session.PRStage("api"), Status: session.StatusWaiting, Idle: true,
	})

	f.service.Check("task-1")
	waitFor(t, "the draft of api to come back", func() bool {
		run, ok := f.tasks.prRun("task-1", repos[0].Path)
		return ok && run.Status == task.PRDrafting
	})
}

func TestResumingThePRStageOpensTheSessionOfEveryRepository(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	t3 := f.tasks.add("task-1", task.StagePR, task.Artifacts{PRD: true, TechSpec: true, Plan: twoStepPlan()})
	f.worktrees.seed(t3, repos[0])
	f.worktrees.seed(t3, repos[1])
	f.tasks.setPRRun("task-1", task.PRRun{RepoPath: repos[0].Path, Status: task.PRDrafting})
	f.tasks.setPRRun("task-1", task.PRRun{
		RepoPath: repos[1].Path, Status: task.PRReviewing, ReportedPass: 1,
		PR: task.PRDetails{Number: 7, URL: samePR.URL, State: task.PRStateOpen},
	})

	f.service.Sync(t.Context())
	waitFor(t, "the sessions of both repositories", func() bool {
		calls := f.sessions.recorded()
		return slices.Contains(calls, "open:task-1:pr:api") && slices.Contains(calls, "open:task-1:pr_review:web")
	})

	// The review session is opened for the pass it is about to write.
	info, ok := f.sessions.info(session.Key{TaskID: "task-1", Stage: session.PRReviewStage("web")})
	if !ok {
		t.Fatal("the review session of web was not opened")
	}
	if want := "/data/task-1/pr/web-review-2.md"; info.ReviewPath != want {
		t.Errorf("review path = %q, want %q", info.ReviewPath, want)
	}
	if info.PRNumber != "7" || info.PRURL != samePR.URL {
		t.Errorf("session = %+v, want the pull request it reviews", info)
	}
}

func TestABlockedRepositoryIsLeftAlone(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	tk := f.tasks.add("task-1", task.StagePR, task.Artifacts{PRD: true, TechSpec: true, Plan: twoStepPlan()})
	for _, repo := range repos {
		f.worktrees.seed(tk, repo)
	}
	f.tasks.setPRRun("task-1", task.PRRun{
		RepoPath: repos[0].Path, Status: task.PRBlocked,
		Block: &task.PRBlock{Reason: task.PRBlockGHAuth, Detail: "gh: not authenticated"},
	})
	f.tasks.setPRRun("task-1", task.PRRun{RepoPath: repos[1].Path, Status: task.PRPreparing})

	f.service.Sync(t.Context())
	// The repository that can go on does, and the blocked one is passed over
	// in the very same evaluation.
	f.waitRepo(t, "task-1", repos[1].Path, flow.RepoDrafting)

	if calls := f.gh.ghCalls(); slices.Contains(calls, "view:api:task-1") {
		t.Errorf("gh calls = %q, want nothing asked about the blocked repository", calls)
	}
	if calls := f.sessions.recorded(); slices.Contains(calls, "start:task-1:pr:api:restarted=false") {
		t.Errorf("session calls = %q, want no session for the blocked repository", calls)
	}
	if got := f.repoState(t, "task-1", repos[0].Path).Status; got != flow.RepoBlocked {
		t.Errorf("status of api = %q, want blocked", got)
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

	if runs := f.tasks.PRRuns("task-1"); len(runs) != 0 {
		t.Errorf("pr runs = %+v, want none", runs)
	}
	// The conversations of the repository go with them, both of them.
	if !slices.Contains(f.sessions.recorded(), "discard:task-1:pr:api,pr_review:api") {
		t.Errorf("session calls = %q, want the pr sessions discarded", f.sessions.recorded())
	}
	calls := f.tasks.recorded()
	if !slices.Contains(calls, "clearPRs:task-1") || !slices.Contains(calls, "remove:task-1:pr") {
		t.Errorf("task calls = %q, want the pr runs and the pr folder removed", calls)
	}
	// The pull requests go before the worktrees they run in.
	teardown := slices.Index(calls, "clearPRs:task-1")
	removal := slices.Index(f.worktrees.recorded(), "removeAll:task-1")
	if teardown < 0 || removal < 0 {
		t.Fatalf("task calls = %q, worktree calls = %q, want both", calls, f.worktrees.recorded())
	}
}

// reports are the reports of the passes a review has written, the last one
// clean or not.
func reports(passes int, clean bool) []task.ReviewReport {
	written := make([]task.ReviewReport, 0, passes)
	for pass := 1; pass <= passes; pass++ {
		written = append(written, task.ReviewReport{
			Pass: pass, File: "api-review-" + strconv.Itoa(pass) + ".md", Clean: clean && pass == passes,
		})
	}
	return written
}

func TestARepositoryUnderReviewIsShownByItsLastReport(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		reports []task.ReviewReport
		idle    bool
		snap    review.Snapshot
		read    bool
		want    flow.RepoStatus
	}{
		{"the agent is reviewing", nil, false, review.Snapshot{}, false, flow.RepoReviewing},
		{"no report yet", nil, true, review.Snapshot{}, false, flow.RepoReviewing},
		{"the agent is applying what was approved", reports(1, false), false, reviewed(1, 2), true, flow.RepoReviewing},
		{"the pass closed clean", reports(2, true), true, review.Snapshot{}, false, flow.RepoDone},
		{"nothing decided yet", reports(1, false), true, review.Snapshot{}, false, flow.RepoAwaitingDecision},
		{"nothing changed yet", reports(1, false), true, reviewed(0, 0), true, flow.RepoAwaitingDecision},
		{"the worktree could not be read", reports(1, false), true, review.Snapshot{Err: "git status: gone"}, true, flow.RepoAwaitingDecision},
		{"part of it reviewed", reports(1, false), true, reviewed(1, 3), true, flow.RepoInReview},
		{"all of it reviewed", reports(1, false), true, reviewed(3, 3), true, flow.RepoReadyToApprove},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			inPR(f, "task-1", plan(), task.PRReviewing)
			f.tasks.setArtifacts("task-1", task.Artifacts{
				PRD: true, TechSpec: true, Plan: plan(),
				PR: map[string]task.RepoArtifacts{"api": {Reports: test.reports}},
			})
			status := session.StatusWorking
			if test.idle {
				status = session.StatusWaiting
			}
			f.sessions.setSummary("task-1", session.Summary{
				Stage: session.PRReviewStage("api"), Status: status, Idle: test.idle,
			})
			if test.read {
				f.reviews.setSnapshot(test.snap)
			}

			state := f.repoState(t, "task-1", repos[0].Path)
			if state.Status != test.want {
				t.Errorf("status = %q, want %q", state.Status, test.want)
			}
			if len(state.Reports) != len(test.reports) {
				t.Errorf("reports = %d, want %d", len(state.Reports), len(test.reports))
			}
			if want := session.PRReviewStage("api"); state.SessionStage != want {
				t.Errorf("session stage = %q, want %q", state.SessionStage, want)
			}
		})
	}
}
