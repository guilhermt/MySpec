package deploys_test

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/deploys"
	"github.com/guilhermt/myspec/internal/gh"
)

const (
	pullsEndpoint = "repos/acme/api/pulls"
	mergeEndpoint = "repos/acme/api/pulls/9/merge"
	stagingRuns   = "workflows/20/runs"
)

// pendingFixture is a fixture read once, with Staging of acme/api pending.
func pendingFixture(t *testing.T) *fixture {
	t.Helper()

	f := newFixture(t)
	f.github.answerGraphQLRepo(pendingData)
	f.refresh(t)
	return f
}

// readyFixture is a fixture read once, with Staging of acme/api holding the
// open pull request 9 of deploy.
func readyFixture(t *testing.T) *fixture {
	t.Helper()

	f := newFixture(t)
	f.github.answerGraphQLRepo(apiData)
	f.refresh(t)
	return f
}

// merged merges the pull request of Staging in a fixture from readyFixture, with
// the merge commit sha, and waits for the action to wait for its run.
func merged(t *testing.T, f *fixture, sha string) {
	t.Helper()

	f.github.answerREST(mergeEndpoint, `{"sha": "`+sha+`", "merged": true}`, nil)
	if err := f.service.Merge(apiID, 1); err != nil {
		t.Fatalf("Merge() = %v, want nil", err)
	}
	f.waitAction(t, apiID, 1, func(a *deploys.Action) bool { return a != nil && a.Phase == deploys.PhaseWaitingRun })
	waitIdle(t, f.service)
}

func TestDeployCreatesThePullRequestWithItsTitleAndTheListOfPullRequests(t *testing.T) {
	t.Parallel()

	f := pendingFixture(t)
	f.github.answerREST(pullsEndpoint, `{"number": 10}`, nil)

	if got := f.environment(t, apiID, 1).View.Available; got != deploys.AvailableDeploy {
		t.Fatalf("Available = %q, want %q", got, deploys.AvailableDeploy)
	}
	if err := f.service.Deploy(apiID, 1); err != nil {
		t.Fatalf("Deploy() = %v, want nil", err)
	}
	if action := f.environment(t, apiID, 1).Action; action == nil || action.Kind != deploys.KindDeploy || action.Phase != deploys.PhaseCreating {
		t.Errorf("Action = %+v right after Deploy, want a deploy being created", action)
	}
	f.waitAction(t, apiID, 1, func(a *deploys.Action) bool { return a == nil })

	body, ok := f.github.bodyOf("POST " + pullsEndpoint)
	if !ok {
		t.Fatalf("calls = %v, want the POST that creates the pull request", f.github.restCalls())
	}
	var got map[string]string
	if err := json.Unmarshal([]byte(body), &got); err != nil {
		t.Fatalf("decode body %q: %v", body, err)
	}
	want := map[string]string{
		"title": "Deploy to Staging",
		"head":  "dev",
		"base":  "staging",
		"body":  "Pull requests in this deploy:\n\n- #7 Add login",
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("pull request (-want +got):\n%s", diff)
	}
	if !strings.Contains(f.logs.String(), "deploy pull request created") {
		t.Errorf("log = %q, want the line deploy pull request created", f.logs.String())
	}
}

func TestTheBodyOfADeployWithNoPullRequestOrAPartialReadingSaysSoAndStopsAtTheLimit(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.github.answerGraphQLRepo(strings.Replace(pendingData, `"aheadBy": 1`, `"aheadBy": 130`, 1))
	f.refresh(t)
	f.github.answerREST(pullsEndpoint, `{"number": 10}`, nil)

	if err := f.service.Deploy(apiID, 1); err != nil {
		t.Fatalf("Deploy() = %v, want nil", err)
	}
	f.waitAction(t, apiID, 1, func(a *deploys.Action) bool { return a == nil })

	body, _ := f.github.bodyOf("POST " + pullsEndpoint)
	var got map[string]string
	if err := json.Unmarshal([]byte(body), &got); err != nil {
		t.Fatalf("decode body %q: %v", body, err)
	}
	if want := "Pull requests in this deploy:\n\n- #7 Add login\n\nRead from the first 100 commits of 130."; got["body"] != want {
		t.Errorf("body = %q, want %q", got["body"], want)
	}

	f2 := newFixture(t)
	f2.github.answerGraphQLRepo(strings.Replace(pendingData, `"associatedPullRequests": {"nodes": [{`, `"associatedPullRequests": {"nodes": [], "ignored": [{`, 1))
	f2.refresh(t)
	f2.github.answerREST(pullsEndpoint, `{"number": 10}`, nil)
	if err := f2.service.Deploy(apiID, 1); err != nil {
		t.Fatalf("Deploy() = %v, want nil", err)
	}
	f2.waitAction(t, apiID, 1, func(a *deploys.Action) bool { return a == nil })
	body, _ = f2.github.bodyOf("POST " + pullsEndpoint)
	if err := json.Unmarshal([]byte(body), &got); err != nil {
		t.Fatalf("decode body %q: %v", body, err)
	}
	if want := "No pull requests in this deploy."; got["body"] != want {
		t.Errorf("body = %q, want %q", got["body"], want)
	}
}

func TestADeployIsRefusedWhenThereIsNothingToDeployOrItIsTheFirstEnvironment(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	if err := f.service.Deploy(apiID, 1); !errors.Is(err, deploys.ErrNotRead) {
		t.Errorf("Deploy() before a reading = %v, want ErrNotRead", err)
	}
	f.refresh(t)

	tests := []struct {
		name         string
		repositoryID string
		position     int
		want         error
	}{
		{"the first environment", apiID, 0, deploys.ErrFirstEnvironment},
		{"a position past the list", apiID, 3, deploys.ErrNoEnvironment},
		{"a negative position", apiID, -1, deploys.ErrNoEnvironment},
		{"a repository that is not managed", "repo-9", 1, deploys.ErrNoEnvironment},
		{"nothing pending", apiID, 1, deploys.ErrNothingToDeploy},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if err := f.service.Deploy(tc.repositoryID, tc.position); !errors.Is(err, tc.want) {
				t.Errorf("Deploy(%s, %d) = %v, want %v", tc.repositoryID, tc.position, err, tc.want)
			}
		})
	}
	t.Cleanup(func() {
		for _, call := range f.github.restCalls() {
			if strings.HasPrefix(call, "POST") {
				t.Errorf("calls include %q, want no pull request created", call)
			}
		}
	})
}

func TestADeployIsRefusedWhileAnActionRunsOnThePair(t *testing.T) {
	t.Parallel()

	f := pendingFixture(t)
	f.github.answerREST(pullsEndpoint, `{"number": 10}`, nil)
	release := f.github.hold()

	if err := f.service.Deploy(apiID, 1); err != nil {
		t.Fatalf("Deploy() = %v, want nil", err)
	}
	if err := f.service.Deploy(apiID, 1); !errors.Is(err, deploys.ErrBusy) {
		t.Errorf("second Deploy() = %v, want ErrBusy", err)
	}
	if got := f.environment(t, apiID, 1).View; !got.Busy || got.Available != deploys.AvailableNone {
		t.Errorf("View = %+v, want it busy with no action available", got)
	}
	release()
	f.waitAction(t, apiID, 1, func(a *deploys.Action) bool { return a == nil })
}

func TestADeployThatTheReadingShowsAlreadyHasAPullRequestCreatesNone(t *testing.T) {
	t.Parallel()

	f := pendingFixture(t)
	f.github.answerGraphQLRepo(apiData)

	if err := f.service.Deploy(apiID, 1); err != nil {
		t.Fatalf("Deploy() = %v, want nil", err)
	}
	f.waitAction(t, apiID, 1, func(a *deploys.Action) bool { return a == nil })

	for _, call := range f.github.restCalls() {
		if strings.HasPrefix(call, "POST") {
			t.Errorf("calls include %q, want no pull request created", call)
		}
	}
	if got := f.environment(t, apiID, 1).View.State; got != deploys.StatePRReady {
		t.Errorf("Staging = %s, want %s: the reading says what there is", got, deploys.StatePRReady)
	}
}

func TestAFailedDeployShowsWhatGitHubSaidAndLeavesWhenItNoLongerHolds(t *testing.T) {
	t.Parallel()

	f := pendingFixture(t)
	f.github.answerREST(pullsEndpoint, "", &gh.Error{
		Output: "gh: Validation Failed (HTTP 422)",
		Stdout: `{"message": "Validation Failed", "errors": [{"message": "No commits between staging and dev"}]}`,
	})

	if err := f.service.Deploy(apiID, 1); err != nil {
		t.Fatalf("Deploy() = %v, want nil", err)
	}
	action := f.waitAction(t, apiID, 1, func(a *deploys.Action) bool { return a != nil && a.Phase == deploys.PhaseFailed })

	if want := "Validation Failed; No commits between staging and dev"; action.Failure != want {
		t.Errorf("Failure = %q, want %q", action.Failure, want)
	}
	if got := f.environment(t, apiID, 1).View; got.Busy || got.Available != deploys.AvailableDeploy {
		t.Errorf("View = %+v, want it free to try again", got)
	}
	if !strings.Contains(f.logs.String(), "deploy action failed") {
		t.Errorf("log = %q, want the line deploy action failed", f.logs.String())
	}

	f.github.answerGraphQLRepo(quietData)
	f.refresh(t)
	if got := f.environment(t, apiID, 1).Action; got != nil {
		t.Errorf("Action = %+v after the change went away, want none", got)
	}
}

func TestAFailedDeployThatStillHoldsStaysUntilTheUserTriesAgain(t *testing.T) {
	t.Parallel()

	f := pendingFixture(t)
	f.github.answerREST(pullsEndpoint, "", errors.New("boom"))
	if err := f.service.Deploy(apiID, 1); err != nil {
		t.Fatalf("Deploy() = %v, want nil", err)
	}
	f.waitAction(t, apiID, 1, func(a *deploys.Action) bool { return a != nil && a.Phase == deploys.PhaseFailed })
	f.refresh(t)
	if got := f.environment(t, apiID, 1).Action; got == nil || got.Phase != deploys.PhaseFailed {
		t.Fatalf("Action = %+v after a reading that changed nothing, want it kept", got)
	}

	f.github.answerREST(pullsEndpoint, `{"number": 10}`, nil)
	if err := f.service.Deploy(apiID, 1); err != nil {
		t.Fatalf("second Deploy() = %v, want nil", err)
	}
	f.waitAction(t, apiID, 1, func(a *deploys.Action) bool { return a == nil })
}

func TestAReadingThatFailsFailsTheDeploy(t *testing.T) {
	t.Parallel()

	f := pendingFixture(t)
	f.github.failGraphQL(gh.ErrNotAuthenticated)

	if err := f.service.Deploy(apiID, 1); err != nil {
		t.Fatalf("Deploy() = %v, want nil", err)
	}
	action := f.waitAction(t, apiID, 1, func(a *deploys.Action) bool { return a != nil && a.Phase == deploys.PhaseFailed })

	if want := (&deploys.Failure{Reason: deploys.ReasonUnauthenticated}).Message(); action.Failure != want {
		t.Errorf("Failure = %q, want %q", action.Failure, want)
	}
}

func TestMergeAsksForAMergeCommitAndWaitsForTheRun(t *testing.T) {
	t.Parallel()

	f := readyFixture(t)
	merged(t, f, "sha55")

	body, ok := f.github.bodyOf("PUT " + mergeEndpoint)
	if !ok || body != `{"merge_method":"merge"}` {
		t.Errorf("merge body = %q, %t, want {\"merge_method\":\"merge\"}", body, ok)
	}
	action := f.environment(t, apiID, 1).Action
	if action == nil || action.Kind != deploys.KindMerge || action.PR != 9 || action.MergeSHA != "sha55" || !action.MergedAt.Equal(base) {
		t.Errorf("Action = %+v, want the merge of pull request 9 as sha55 made at %v", action, base)
	}
	if view := f.environment(t, apiID, 1).View; !view.Running || !view.Busy || view.State != deploys.StateRunning {
		t.Errorf("View = %+v, want it running while the run is awaited", view)
	}
	if !strings.Contains(f.logs.String(), "deploy merged") {
		t.Errorf("log = %q, want the line deploy merged", f.logs.String())
	}
}

func TestAMergeIsRefusedWithoutAPullRequestOfDeploy(t *testing.T) {
	t.Parallel()

	f := pendingFixture(t)

	if err := f.service.Merge(apiID, 1); !errors.Is(err, deploys.ErrNoDeployPR) {
		t.Errorf("Merge() = %v, want ErrNoDeployPR", err)
	}
	if err := f.service.Merge(apiID, 0); !errors.Is(err, deploys.ErrFirstEnvironment) {
		t.Errorf("Merge(first) = %v, want ErrFirstEnvironment", err)
	}
}

func TestAMergeThatGitHubRefusesShowsItsMessage(t *testing.T) {
	t.Parallel()

	f := readyFixture(t)
	f.github.answerREST(mergeEndpoint, "", &gh.Error{
		Output: "gh: Pull Request is still a draft (HTTP 405)",
		Stdout: `{"message": "Pull Request is still a draft"}`,
	})

	if err := f.service.Merge(apiID, 1); err != nil {
		t.Fatalf("Merge() = %v, want nil", err)
	}
	action := f.waitAction(t, apiID, 1, func(a *deploys.Action) bool { return a != nil && a.Phase == deploys.PhaseFailed })

	if want := "Pull Request is still a draft"; action.Failure != want {
		t.Errorf("Failure = %q, want %q", action.Failure, want)
	}
	if got := f.environment(t, apiID, 1).View.Available; got != deploys.AvailableMerge {
		t.Errorf("Available = %q, want %q to try again", got, deploys.AvailableMerge)
	}
}

func TestTheRunOfAMergeIsFollowedToItsEndAndNoticedOnce(t *testing.T) {
	t.Parallel()

	f := readyFixture(t)
	merged(t, f, "sha55")

	started := runJSON(55, "in_progress", "", base)
	f.github.answerREST(stagingRuns, runsJSON(t, started), nil)
	f.service.Tick(t.Context())
	action := f.environment(t, apiID, 1).Action
	if action == nil || action.Phase != deploys.PhaseRunning || action.RunID != 55 {
		t.Fatalf("Action = %+v after the run showed up, want running run 55", action)
	}
	if got := f.finished.all(); len(got) != 0 {
		t.Fatalf("finished = %+v while the run runs, want none", got)
	}

	f.github.answerREST(stagingRuns, runsJSON(t, runJSON(55, "completed", "success", base)), nil)
	f.service.Tick(t.Context())
	f.service.Tick(t.Context())
	waitIdle(t, f.service)

	want := []deploys.Finished{{
		RepositoryID: apiID,
		FullName:     "acme/api",
		Environment:  "Staging",
		Branch:       "staging",
		Position:     1,
		Succeeded:    true,
		Duration:     time.Minute,
		RunID:        55,
		RunURL:       "https://github.com/acme/api/actions/runs/55",
	}}
	if diff := cmp.Diff(want, f.finished.all()); diff != "" {
		t.Errorf("finished (-want +got):\n%s", diff)
	}
	if got := f.environment(t, apiID, 1).Action; got != nil {
		t.Errorf("Action = %+v after the run ended, want none", got)
	}
	if !strings.Contains(f.logs.String(), "deploy finished") {
		t.Errorf("log = %q, want the line deploy finished", f.logs.String())
	}
}

func TestAFailedRunOfAMergeIsNoticedAsAFailure(t *testing.T) {
	t.Parallel()

	f := readyFixture(t)
	merged(t, f, "sha55")

	f.github.answerREST(stagingRuns, runsJSON(t, runJSON(55, "completed", "failure", base)), nil)
	f.service.Tick(t.Context())
	waitIdle(t, f.service)

	got := f.finished.all()
	if len(got) != 1 || got[0].Succeeded {
		t.Fatalf("finished = %+v, want one failed run", got)
	}
	if view := f.environment(t, apiID, 1).View; !view.Failed {
		t.Errorf("View = %+v, want the failure marked", view)
	}
}

func TestARunThatNeverShowsUpLeavesAfterTheWaitLimitWithoutANotice(t *testing.T) {
	t.Parallel()

	f := readyFixture(t)
	merged(t, f, "sha55")

	// The run of the merge came out skipped: it doesn't count, and doesn't end the wait.
	f.github.answerREST(stagingRuns, runsJSON(t, runJSON(55, "completed", "skipped", base)), nil)
	f.advance(deploys.RunWaitLimit - time.Second)
	f.service.Tick(t.Context())
	if action := f.environment(t, apiID, 1).Action; action == nil || action.Phase != deploys.PhaseWaitingRun {
		t.Fatalf("Action = %+v before the limit, want it waiting", action)
	}

	f.advance(2 * time.Second)
	f.service.Tick(t.Context())

	if action := f.environment(t, apiID, 1).Action; action != nil {
		t.Errorf("Action = %+v after the limit, want none", action)
	}
	if got := f.finished.all(); len(got) != 0 {
		t.Errorf("finished = %+v, want no notice", got)
	}
	if !strings.Contains(f.logs.String(), "deploy run not found") {
		t.Errorf("log = %q, want the line deploy run not found", f.logs.String())
	}
}

func TestARunningRunThatLeavesThePageIsReadByIDAndEndsTheActionWhenSkipped(t *testing.T) {
	t.Parallel()

	f := readyFixture(t)
	merged(t, f, "sha55")
	f.github.answerREST(stagingRuns, runsJSON(t, runJSON(55, "in_progress", "", base)), nil)
	f.service.Tick(t.Context())

	f.github.answerREST(stagingRuns, runsJSON(t), nil)
	run, _ := json.Marshal(runJSON(55, "completed", "skipped", base))
	f.github.answerREST("actions/runs/55", string(run), nil)
	f.service.Tick(t.Context())

	if action := f.environment(t, apiID, 1).Action; action != nil {
		t.Errorf("Action = %+v after the run ended skipped, want none", action)
	}
	if got := f.finished.all(); len(got) != 0 {
		t.Errorf("finished = %+v, want no notice", got)
	}
}

func TestARunningRunThatIsDeletedEndsTheActionWithoutANotice(t *testing.T) {
	t.Parallel()

	f := readyFixture(t)
	merged(t, f, "sha55")
	f.github.answerREST(stagingRuns, runsJSON(t, runJSON(55, "in_progress", "", base)), nil)
	f.service.Tick(t.Context())

	f.github.answerREST(stagingRuns, runsJSON(t), nil)
	f.github.answerREST("actions/runs/55", "", fmt.Errorf("rest: %w", gh.ErrNoResource))
	f.service.Tick(t.Context())
	if action := f.environment(t, apiID, 1).Action; action != nil {
		t.Errorf("Action = %+v after the run was deleted, want none", action)
	}
}

func TestTheFastLoopDoesNothingWithNoRunToWatch(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.refresh(t)
	calls := len(f.github.restCalls())
	changes := f.changes.count()

	f.service.Tick(t.Context())

	if got := len(f.github.restCalls()); got != calls {
		t.Errorf("REST calls = %d, want %d: nothing runs", got, calls)
	}
	if f.changes.count() != changes {
		t.Error("OnChange was called by a turn with nothing to watch")
	}
}

func TestTheFastLoopReadsAgainTheRunsInProgress(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.github.answerREST("workflows/10/runs", runsJSON(t, runJSON(3, "in_progress", "", base)), nil)
	f.refresh(t)
	if got := f.environment(t, apiID, 0).View.State; got != deploys.StateRunning {
		t.Fatalf("Development = %s, want %s", got, deploys.StateRunning)
	}
	changes := f.changes.count()

	f.github.answerREST("workflows/10/runs", runsJSON(t, runJSON(3, "completed", "failure", base)), nil)
	f.service.Tick(t.Context())

	if got := f.environment(t, apiID, 0).View; got.State != deploys.StateFailed || !got.Failed {
		t.Errorf("View = %+v, want it failed", got)
	}
	if f.changes.count() == changes {
		t.Error("OnChange was not called after the run changed")
	}
	if got := f.finished.all(); len(got) != 0 {
		t.Errorf("finished = %+v, want none: the app didn't start that run", got)
	}
}

func TestStartRunsTheFastLoopUntilClose(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.service.Start()
	f.service.Start()
	f.service.Close()
	f.service.Refresh()

	if got := f.github.graphQLCalls(); got != 0 {
		t.Errorf("queries = %d after Close, want 0", got)
	}
}
