package flow_test

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"testing"

	"github.com/guilhermt/myspec/internal/divergence"
	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

// idlePRSession is the conversation that drafts the pull request, at rest.
var idlePRSession = session.Summary{Stage: session.PRStage, Status: session.StatusWaiting, Idle: true}

// drafting puts task-1 on a draft the user can approve, with the session at
// rest and the branch on startCommit.
func drafting(t *testing.T, f *fixture) task.Task {
	t.Helper()

	tk := inPR(f, "task-1", plan(), task.PRDrafting)
	dir := t.TempDir()
	f.tasks.useDir("task-1", dir)
	if err := task.WriteDraft(filepath.Join(dir, "pr", "draft.md"), "dev/web", "origin/dev", "Add the login screen", "It adds the screen."); err != nil {
		t.Fatalf("write draft: %v", err)
	}
	f.tasks.setArtifacts("task-1", prArtifacts(task.PRArtifacts{
		Draft: task.Draft{Present: true, Title: "Add the login screen", Body: "It adds the screen."},
	}))
	f.worktrees.setStatus(git.Status{Head: startCommit})
	f.sessions.setSummary("task-1", idlePRSession)
	return tk
}

// openDraft approves the draft of task-1 the way the user does.
func openDraft(t *testing.T, f *fixture) {
	t.Helper()

	if err := f.service.OpenPR(t.Context(), "task-1", "Add the login screen", "It adds the screen."); err != nil {
		t.Fatalf("OpenPR() = %v, want nil", err)
	}
}

// waitDivergence polls until task-1 has a divergence of the kind.
func (f *fixture) waitDivergence(t *testing.T, kind divergence.Kind) divergence.Divergence {
	t.Helper()

	var found divergence.Divergence
	waitFor(t, "the divergence "+string(kind), func() bool {
		d, ok := f.divergences.Get("task-1")
		found = d
		return ok && d.Kind == kind
	})
	return found
}

func TestAPushTheRemoteRefusesGivesTheDraftBackWithADivergence(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	drafting(t, f)
	f.worktrees.failPush(fmt.Errorf("%w: ! [rejected] HEAD -> task-1 (fetch first)", git.ErrPushRejected))

	openDraft(t, f)

	d := f.waitDivergence(t, divergence.KindPushRejected)
	f.waitPRStatus(t, "task-1", task.PRDrafting)
	f.wantDivergence(t, session.PRStage, divergence.KindPushRejected, divergence.Facts{
		Branch: "task-1", Commit: task.ShortSHA(startCommit), Reason: d.Facts.Reason,
	})
	if d.Facts.Reason == "" {
		t.Error("the divergence says nothing of what git said")
	}
	if got := f.gh.createdPRs(); len(got) != 0 {
		t.Errorf("created = %+v, want no pull request over a push that failed", got)
	}
	f.waitPR(t, "task-1", flow.PRDiverged)
	if pr := f.prState(t, "task-1"); pr.Divergence == nil || pr.Divergence.Kind != divergence.KindPushRejected {
		t.Errorf("divergence = %+v, want push_rejected at hand", pr.Divergence)
	}

	// The user sorted the remote out: "Try the push again" opens the pull
	// request with the draft they approved, without a new approval.
	f.worktrees.failPush(nil)
	if err := f.service.CheckAgain(t.Context(), "task-1"); err != nil {
		t.Fatalf("CheckAgain() = %v, want nil", err)
	}
	f.waitPRRun(t, "the pull request to be recorded", func(run task.PRRun) bool { return run.PR.Number == 7 })
	f.wantNoDivergence(t)
}

func TestAPushThatFailsBlocksTheStageAndTryingAgainOpens(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	drafting(t, f)
	f.worktrees.failPush(errors.New("git push: could not resolve host"))

	openDraft(t, f)

	f.waitPR(t, "task-1", flow.PRBlocked)
	block := f.prState(t, "task-1").Block
	if block == nil || block.Reason != task.PRBlockPushFailed || block.Detail != "git push: could not resolve host" {
		t.Errorf("block = %+v, want push_failed with what git said", block)
	}

	f.worktrees.failPush(nil)
	if err := f.service.RetryPR(t.Context(), "task-1"); err != nil {
		t.Fatalf("RetryPR() = %v, want nil", err)
	}
	f.waitPRRun(t, "the pull request to be recorded", func(run task.PRRun) bool {
		return run.Status == task.PRReviewing && run.PR.Number == 7
	})
	if got := len(f.gh.createdPRs()); got != 1 {
		t.Errorf("created = %d pull requests, want one", got)
	}
}

func TestAnOpeningGhRefusesBlocksTheStageWithWhatGhSaid(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		err    error
		reason task.PRBlockReason
	}{
		{"gh is gone", gh.ErrNotFound, task.PRBlockGHMissing},
		{"gh is signed out", gh.ErrNotAuthenticated, task.PRBlockGHAuth},
		{"gh refuses", errors.New("gh pr create: a pull request already exists"), task.PRBlockOpenFailed},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			drafting(t, f)
			f.gh.failCreate(test.err)

			openDraft(t, f)

			f.waitPR(t, "task-1", flow.PRBlocked)
			block := f.prState(t, "task-1").Block
			if block == nil || block.Reason != test.reason || block.Detail != test.err.Error() {
				t.Errorf("block = %+v, want %s with %q", block, test.reason, test.err)
			}
		})
	}
}

func TestTryingAgainAFailedOpeningRepeatsTheOpeningNotThePreparation(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	drafting(t, f)
	f.gh.failCreate(errors.New("gh pr create: boom"))
	openDraft(t, f)
	f.waitPR(t, "task-1", flow.PRBlocked)

	f.gh.failCreate(nil)
	if err := f.service.RetryPR(t.Context(), "task-1"); err != nil {
		t.Fatalf("RetryPR() = %v, want nil", err)
	}

	f.waitPRRun(t, "the pull request to be recorded", func(run task.PRRun) bool { return run.PR.Number == 7 })
	// The draft the user approved is the one that opened: no session was started.
	for _, call := range f.sessions.recorded() {
		if call == "start:task-1:pr" {
			t.Errorf("session calls = %q, want the draft left alone", f.sessions.recorded())
		}
	}
}

func TestOpeningFindsThePullRequestThatIsAlreadyThere(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	drafting(t, f)
	f.gh.setPR("task-1", samePR)

	openDraft(t, f)

	f.waitPRRun(t, "the pull request to be recorded", func(run task.PRRun) bool {
		return run.Status == task.PRReviewing && run.PR.Number == samePR.Number
	})
	if pushed := f.worktrees.pushed(); len(pushed) != 0 {
		t.Errorf("pushes = %q, want none for a pull request that exists", pushed)
	}
	if got := f.gh.createdPRs(); len(got) != 0 {
		t.Errorf("created = %+v, want none for a pull request that exists", got)
	}
}

func TestAPullRequestOfTheBranchIntoAnotherBaseIsADivergence(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	drafting(t, f)
	f.gh.setPR("task-1", gh.PR{Number: 9, URL: "https://github.com/acme/api/pull/9", State: gh.StateOpen, Base: "main"})

	openDraft(t, f)

	d := f.waitDivergence(t, divergence.KindPRWrongBase)
	f.waitPRStatus(t, "task-1", task.PRDrafting)
	want := divergence.Facts{
		Branch: "task-1", Base: "dev",
		PRs: []divergence.PR{{Number: 9, URL: "https://github.com/acme/api/pull/9", Base: "main", Head: "task-1"}},
	}
	f.wantDivergence(t, session.PRStage, divergence.KindPRWrongBase, want)
	if d.Stage != session.PRStage {
		t.Errorf("stage = %q, want the conversation of the pull request", d.Stage)
	}
	if pushed := f.worktrees.pushed(); len(pushed) != 0 {
		t.Errorf("pushes = %q, want none while the pull request is unsettled", pushed)
	}

	// Adopting it makes it the pull request of the task, with the base it has.
	if err := f.service.Adopt(t.Context(), "task-1", ""); err != nil {
		t.Fatalf("Adopt() = %v, want nil", err)
	}
	f.waitPRRun(t, "the pull request to be adopted", func(run task.PRRun) bool {
		return run.Status == task.PRReviewing && run.PR.Number == 9 && run.PR.Base == "main"
	})
	f.wantNoDivergence(t)
}

func TestAPullRequestOfAnotherBranchOnTheSameCommitIsADivergence(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	drafting(t, f)
	f.gh.setPR("fix-login", gh.PR{
		Number: 12, URL: "https://github.com/acme/api/pull/12", State: gh.StateOpen, Base: "dev", Head: "fix-login",
	})
	f.gh.setHeadOID("fix-login", startCommit)

	f.service.Check("task-1")

	f.waitDivergence(t, divergence.KindPROtherBranch)
	f.wantDivergence(t, session.PRStage, divergence.KindPROtherBranch, divergence.Facts{
		Branch: "task-1", Base: "dev",
		PRs: []divergence.PR{{Number: 12, URL: "https://github.com/acme/api/pull/12", Base: "dev", Head: "fix-login"}},
	})

	if err := f.service.Adopt(t.Context(), "task-1", "12"); err != nil {
		t.Fatalf("Adopt() = %v, want nil", err)
	}
	f.waitPRRun(t, "the pull request to be adopted", func(run task.PRRun) bool {
		return run.PR.Number == 12 && run.PR.Head == "fix-login"
	})
}

func TestSeveralPullRequestsThatCouldBeTheOneOfTheTaskAreADivergence(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	drafting(t, f)
	f.gh.setPR("task-1", samePR)
	f.gh.setPR("task-1-again", gh.PR{
		Number: 9, URL: "https://github.com/acme/api/pull/9", State: gh.StateOpen, Base: "dev", Head: "task-1",
	})

	f.service.Check("task-1")

	d := f.waitDivergence(t, divergence.KindPRsAmbiguous)
	if got := len(d.Facts.PRs); got != 2 || d.Facts.PRs[0].Number != 7 || d.Facts.PRs[1].Number != 9 {
		t.Errorf("prs = %+v, want the two candidates by number", d.Facts.PRs)
	}

	// The choice has to be one of them.
	if err := f.service.Adopt(t.Context(), "task-1", "8"); !errors.Is(err, flow.ErrNoCandidate) {
		t.Errorf("Adopt(8) = %v, want ErrNoCandidate", err)
	}
	if err := f.service.Adopt(t.Context(), "task-1", ""); !errors.Is(err, flow.ErrNoCandidate) {
		t.Errorf("Adopt(\"\") = %v, want ErrNoCandidate with two to choose from", err)
	}
	if err := f.service.Adopt(t.Context(), "task-1", strconv.Itoa(9)); err != nil {
		t.Fatalf("Adopt(9) = %v, want nil", err)
	}
	f.waitPRRun(t, "the pull request to be adopted", func(run task.PRRun) bool { return run.PR.Number == 9 })
	f.wantNoDivergence(t)
}

func TestAPullRequestThatWentAwayEndsItsDivergence(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	drafting(t, f)
	f.gh.setPR("task-1", gh.PR{Number: 9, URL: samePR.URL, State: gh.StateOpen, Base: "main"})
	f.service.Check("task-1")
	f.waitDivergence(t, divergence.KindPRWrongBase)

	f.gh.forgetPR("task-1")
	if err := f.service.CheckAgain(t.Context(), "task-1"); err != nil {
		t.Fatalf("CheckAgain() = %v, want nil", err)
	}
	waitFor(t, "the divergence to end", func() bool {
		_, ok := f.divergences.Get("task-1")
		return !ok
	})
}

func TestAnApprovalWithNoPullRequestAfterARestartIsADivergenceTheUserOpens(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	drafting(t, f)
	f.tasks.setPRRun("task-1", task.PRRun{Status: task.PROpening})

	f.service.Sync(t.Context())

	f.waitDivergence(t, divergence.KindPRNotOpened)
	f.waitPRStatus(t, "task-1", task.PRDrafting)
	f.wantDivergence(t, session.PRStage, divergence.KindPRNotOpened, divergence.Facts{Branch: "task-1", Base: "dev"})
	if err := f.service.AskAgain(t.Context(), "task-1"); !errors.Is(err, flow.ErrNotAskable) {
		t.Errorf("AskAgain() = %v, want ErrNotAskable", err)
	}
	if err := f.service.Adopt(t.Context(), "task-1", ""); !errors.Is(err, flow.ErrNotAdoptable) {
		t.Errorf("Adopt() = %v, want ErrNotAdoptable", err)
	}

	// Approving the draft again is the way out.
	openDraft(t, f)
	f.waitPRRun(t, "the pull request to be recorded", func(run task.PRRun) bool { return run.PR.Number == 7 })
	f.wantNoDivergence(t)
}

func TestAnApprovalTheAppWasClosedInTheMiddleOfFindsThePullRequestItOpened(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	drafting(t, f)
	f.tasks.setPRRun("task-1", task.PRRun{Status: task.PROpening})
	f.gh.setPR("task-1", samePR)

	f.service.Sync(t.Context())

	f.waitPRRun(t, "the pull request to be recorded", func(run task.PRRun) bool {
		return run.Status == task.PRReviewing && run.PR.Number == samePR.Number
	})
	f.wantNoDivergence(t)
	if pushed := f.worktrees.pushed(); len(pushed) != 0 {
		t.Errorf("pushes = %q, want none", pushed)
	}
}

func TestADraftThatIsNotThereIsADivergenceWhenTheAgentRests(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	inPR(f, "task-1", plan(), task.PRDrafting)
	f.tasks.useDir("task-1", t.TempDir())
	f.sessions.setSummary("task-1", session.Summary{
		Stage: session.PRStage, Status: session.StatusWorking, TurnRunning: true,
	})

	// While the agent works there is nothing to say.
	f.service.Check("task-1")
	f.waitEvaluations(t, 1)
	f.wantNoDivergence(t)

	f.sessions.goIdle("task-1")
	f.service.Check("task-1")
	f.waitDivergence(t, divergence.KindDraftMissing)
	f.wantDivergence(t, session.PRStage, divergence.KindDraftMissing, divergence.Facts{Path: "pr/draft.md"})
	f.waitPR(t, "task-1", flow.PRDiverged)
}

func TestADraftWithoutATurnThatEndedInAnErrorIsLeftAlone(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	inPR(f, "task-1", plan(), task.PRDrafting)
	f.tasks.useDir("task-1", t.TempDir())
	f.sessions.setSummary("task-1", session.Summary{
		Stage: session.PRStage, Status: session.StatusWaiting, Idle: true, TurnFailed: true,
	})

	f.service.Check("task-1")
	f.waitEvaluations(t, 1)

	f.wantNoDivergence(t)
}

func TestADraftThatCantBeReadIsADivergenceAndAReadableOneEndsIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	inPR(f, "task-1", plan(), task.PRDrafting)
	dir := t.TempDir()
	f.tasks.useDir("task-1", dir)
	path := filepath.Join(dir, "pr", "draft.md")
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatalf("create pr directory: %v", err)
	}
	if err := os.WriteFile(path, []byte("A description with no header.\n"), 0o600); err != nil {
		t.Fatalf("write draft: %v", err)
	}
	f.sessions.setSummary("task-1", idlePRSession)

	f.service.Check("task-1")

	d := f.waitDivergence(t, divergence.KindDraftUnreadable)
	if d.Facts.Path != "pr/draft.md" || d.Facts.Reason != "The draft can't be read: it has no front matter." {
		t.Errorf("facts = %+v, want the path and the rule it breaks", d.Facts)
	}

	if err := os.WriteFile(path, []byte("---\ntitle: A draft\n---\n\nBody\n"), 0o600); err != nil {
		t.Fatalf("write draft: %v", err)
	}
	f.service.Check("task-1")
	waitFor(t, "the divergence to end", func() bool {
		_, ok := f.divergences.Get("task-1")
		return !ok
	})
}

func TestAskingForTheDraftAgainSendsTheInstructionOnceAndEndsTheDivergence(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	inPR(f, "task-1", plan(), task.PRDrafting)
	f.tasks.useDir("task-1", t.TempDir())
	f.sessions.setSummary("task-1", session.Summary{Stage: session.PRStage, Status: session.StatusPaused, Idle: false})
	tk, _ := f.tasks.Get("task-1")
	f.diverge(t, tk, session.PRStage, divergence.KindDraftMissing, divergence.Facts{Path: "pr/draft.md"})

	if err := f.service.AskAgain(t.Context(), "task-1"); err != nil {
		t.Fatalf("AskAgain() = %v, want nil", err)
	}

	f.wantNoDivergence(t)
	calls := f.sessions.recorded()
	if !contains(calls, "resume:task-1:pr") || !contains(calls, "send:task-1:pr") {
		t.Errorf("session calls = %q, want the session resumed and the message sent", calls)
	}
	want := "The draft of the pull request isn't at `" + filepath.Join(tk.ArtifactsDir, "pr", "draft.md") +
		"`. Write it there, with the header the instructions of this session give, and stop."
	if sent := f.sessions.sent(); len(sent) != 1 || sent[0] != want {
		t.Errorf("sent = %q, want %q", sent, want)
	}
	if apps := f.sessions.sentApps(); len(apps) != 1 || apps[0].Kind != session.AppAgain {
		t.Errorf("app messages = %+v, want one of the kind again", apps)
	}
}

func TestAskingForAnUnreadableDraftAgainSaysWhy(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	inPR(f, "task-1", plan(), task.PRDrafting)
	f.tasks.useDir("task-1", t.TempDir())
	f.sessions.setSummary("task-1", idlePRSession)
	tk, _ := f.tasks.Get("task-1")
	f.diverge(t, tk, session.PRStage, divergence.KindDraftUnreadable, divergence.Facts{
		Path: "pr/draft.md", Reason: "The draft can't be read: it has no title.",
	})

	if err := f.service.AskAgain(t.Context(), "task-1"); err != nil {
		t.Fatalf("AskAgain() = %v, want nil", err)
	}

	want := "The draft of the pull request at `" + filepath.Join(tk.ArtifactsDir, "pr", "draft.md") +
		"` can't be read: it has no title. Rewrite it there, with the header the instructions of this session give, and stop."
	if sent := f.sessions.sent(); len(sent) != 1 || sent[0] != want {
		t.Errorf("sent = %q, want %q", sent, want)
	}
	if err := f.service.Adopt(t.Context(), "task-1", ""); !errors.Is(err, flow.ErrNoDivergence) {
		t.Errorf("Adopt() = %v, want ErrNoDivergence once the divergence ended", err)
	}
}

func TestDiscardingTheDraftEndsTheDivergenceOfTheStage(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	drafting(t, f)
	tk, _ := f.tasks.Get("task-1")
	f.diverge(t, tk, session.PRStage, divergence.KindPushRejected, divergence.Facts{Branch: "task-1"})

	if err := f.service.DiscardDraft(t.Context(), "task-1"); err != nil {
		t.Fatalf("DiscardDraft() = %v, want nil", err)
	}

	f.wantNoDivergence(t)
}

func TestTheReviewOfAnAdoptedPullRequestComparesAgainstItsBase(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	tk := f.tasks.add("task-1", task.StagePR, prArtifacts(task.PRArtifacts{}))
	f.tasks.useDir("task-1", t.TempDir())
	f.worktrees.seed(tk)
	f.worktrees.setStatus(git.Status{Head: startCommit})
	adopted := openPR()
	adopted.Base, adopted.Head = "main", "fix-login"
	f.tasks.setPRRun("task-1", task.PRRun{Status: task.PRReviewing, PR: adopted})
	f.gh.setPR("task-1", gh.PR{Number: 7, URL: samePR.URL, State: gh.StateOpen, Base: "main", Head: "fix-login"})

	f.service.Check("task-1")

	waitFor(t, "the review session of the task", func() bool {
		_, ok := f.sessions.info(reviewKeyOf)
		return ok
	})
	info, _ := f.sessions.info(reviewKeyOf)
	if info.BaseBranch != "origin/main" {
		t.Errorf("base = %q, want the base of the pull request", info.BaseBranch)
	}
}

// contains says whether calls has call.
func contains(calls []string, call string) bool {
	for _, c := range calls {
		if c == call {
			return true
		}
	}
	return false
}

func TestTheOpeningUsesTheTitleAndDescriptionAsTheUserApprovedThem(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	drafting(t, f)
	title := "`flow`: read the PR by `number`"
	body := "# `flow`: read the PR by `number`\n\nIt reads the pull request by its number."

	if err := f.service.OpenPR(t.Context(), "task-1", title, body); err != nil {
		t.Fatalf("OpenPR() = %v, want nil", err)
	}

	f.waitPRRun(t, "the pull request to be recorded", func(run task.PRRun) bool { return run.PR.Number == 7 })
	created := f.gh.createdPRs()
	if len(created) != 1 || created[0].title != title || created[0].body != body {
		t.Errorf("created = %+v, want the title %q and the body %q untouched", created, title, body)
	}
}

func TestTryingAgainAnOpeningThatFailedBeforeCreatingRepeatsTheOpening(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	drafting(t, f)
	f.gh.failList(gh.ErrNotAuthenticated)
	openDraft(t, f)
	f.waitPR(t, "task-1", flow.PRBlocked)
	if block := f.prState(t, "task-1").Block; block == nil || block.Reason != task.PRBlockGHAuth {
		t.Fatalf("block = %+v, want gh_unauthenticated", block)
	}

	f.gh.failList(nil)
	if err := f.service.RetryPR(t.Context(), "task-1"); err != nil {
		t.Fatalf("RetryPR() = %v, want nil", err)
	}

	f.waitPRRun(t, "the pull request to be recorded", func(run task.PRRun) bool { return run.PR.Number == 7 })
	if created := f.gh.createdPRs(); len(created) != 1 || created[0].title != "Add the login screen" {
		t.Errorf("created = %+v, want the approved draft opened", created)
	}
	for _, call := range f.sessions.recorded() {
		if call == "start:task-1:pr:restarted=false" {
			t.Errorf("session calls = %q, want the draft left alone", f.sessions.recorded())
		}
	}
}

func TestAPushThatFailsAfterARefusalShowsTheBlockNotTheRefusal(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	drafting(t, f)
	f.worktrees.failPush(pushRejected())
	openDraft(t, f)
	f.waitDivergence(t, divergence.KindPushRejected)
	f.waitPRStatus(t, "task-1", task.PRDrafting)

	f.worktrees.failPush(errors.New("git push: could not resolve host"))
	if err := f.service.CheckAgain(t.Context(), "task-1"); err != nil {
		t.Fatalf("CheckAgain() = %v, want nil", err)
	}

	f.waitPR(t, "task-1", flow.PRBlocked)
	f.wantNoDivergence(t)
	if block := f.prState(t, "task-1").Block; block == nil || block.Reason != task.PRBlockPushFailed {
		t.Errorf("block = %+v, want push_failed", block)
	}
}

func TestAPullRequestOpenedByHandIsFoundBeforeTheMissingDraftIsReported(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	inPR(f, "task-1", plan(), task.PRDrafting)
	f.tasks.useDir("task-1", t.TempDir())
	f.sessions.setSummary("task-1", idlePRSession)
	f.gh.setPR("task-1", samePR)

	f.service.Check("task-1")

	f.waitPRRun(t, "the pull request to be recorded", func(run task.PRRun) bool { return run.PR.Number == samePR.Number })
	if marked := f.sessions.marked(session.MarkerDivergence); len(marked) != 0 {
		t.Errorf("divergences marked = %+v, want none about a draft a found pull request makes moot", marked)
	}
}

func TestAnAdoptionWhoseReadingFailsKeepsTheDivergence(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	tk := drafting(t, f)
	f.diverge(t, tk, session.PRStage, divergence.KindPRWrongBase, divergence.Facts{
		Branch: "task-1", Base: "dev", PRs: []divergence.PR{{Number: 9, Base: "main", Head: "task-1"}},
	})
	f.gh.failView(errors.New("gh: timeout"))

	if err := f.service.Adopt(t.Context(), "task-1", ""); err != nil {
		t.Fatalf("Adopt() = %v, want nil: the reading goes out on the stage", err)
	}

	waitFor(t, "the reading of the pull request", func() bool {
		return slices.ContainsFunc(f.gh.ghCalls(), func(c string) bool { return strings.HasPrefix(c, "view:") })
	})
	if d, ok := f.divergences.Get("task-1"); !ok || d.Kind != divergence.KindPRWrongBase {
		t.Errorf("divergence = %+v, want pr_wrong_base kept", d)
	}
	if run, _ := f.tasks.prRun("task-1"); run.PR.Number != 0 {
		t.Errorf("pull request = %d, want none recorded", run.PR.Number)
	}
}
