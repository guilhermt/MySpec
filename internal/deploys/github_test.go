package deploys_test

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/deploys"
	"github.com/guilhermt/myspec/internal/gh"
)

// apiTarget is acme/api with Development, Staging and Production.
func apiTarget() deploys.Target {
	return deploys.Target{ID: "repo-1", Owner: "acme", Name: "api", Environments: threeEnvironments()}
}

// webTarget is acme/web with the same environments.
func webTarget() deploys.Target {
	return deploys.Target{ID: "repo-2", Owner: "acme", Name: "web", Environments: threeEnvironments()}
}

// apiData is what GitHub answers for acme/api under alias: three branches,
// three changes waiting in dev, one of them a merge commit, and an open pull
// request of deploy to staging, behind one from a fork.
const apiData = `{
  "b0": {"target": {"oid": "dev9"}},
  "b1": {"target": {"oid": "stg1"}, "compare": {"aheadBy": 3, "commits": {"nodes": [
    {"oid": "c1", "committedDate": "2026-09-10T10:00:00Z", "parents": {"totalCount": 1, "nodes": [{"oid": "stg1"}]},
     "associatedPullRequests": {"nodes": [{"number": 7, "title": "Add login", "url": "https://github.com/acme/api/pull/7", "mergedAt": "2026-09-10T10:00:00Z", "headRefName": "feat", "baseRefName": "dev", "author": {"login": "ana"}}]}},
    {"oid": "c2", "committedDate": "2026-09-11T10:00:00Z", "parents": {"totalCount": 1, "nodes": [{"oid": "c1"}]},
     "associatedPullRequests": {"nodes": [{"number": 8, "title": "Fix logout", "url": "https://github.com/acme/api/pull/8", "mergedAt": "2026-09-11T10:00:00Z", "headRefName": "fix", "baseRefName": "dev", "author": null}]}},
    {"oid": "dev9", "committedDate": "2026-09-12T10:00:00Z", "parents": {"totalCount": 2, "nodes": [{"oid": "c2"}]},
     "associatedPullRequests": {"nodes": []}}
  ]}}},
  "p1": {"totalCount": 2, "nodes": [
    {"number": 12, "title": "Fork", "url": "u12", "isDraft": false, "createdAt": "2026-09-13T10:00:00Z", "isCrossRepository": true},
    {"number": 9, "title": "Deploy to Staging", "url": "https://github.com/acme/api/pull/9", "isDraft": true, "createdAt": "2026-09-12T11:00:00Z", "isCrossRepository": false}
  ]},
  "b2": {"target": {"oid": "main1"}, "compare": {"aheadBy": 0, "commits": {"nodes": []}}},
  "p2": {"totalCount": 0, "nodes": []}
}`

// idleRuns answers the runs of every workflow of every repository with one
// succeeded run.
func idleRuns(t *testing.T, g *fakeGitHub) {
	t.Helper()

	g.answerREST("/runs?branch=", runsJSON(t, runJSON(1, "completed", "success", base)), nil)
}

func TestTheQueryEscapesWhatTheUserTyped(t *testing.T) {
	t.Parallel()

	target := deploys.Target{
		Owner: `ac"me`, Name: `a\pi`,
		Environments: []deploys.Environment{{Branch: `fe"at`}, {Branch: "main"}},
	}
	query := deploys.ReadQuery([]deploys.Target{target})

	for _, want := range []string{
		`repository(owner: "ac\"me", name: "a\\pi")`,
		`ref(qualifiedName: "refs/heads/fe\"at")`,
		`compare(headRef: "fe\"at")`,
		`baseRefName: "main", headRefName: "fe\"at"`,
	} {
		if !strings.Contains(query, want) {
			t.Errorf("query lacks %s:\n%s", want, query)
		}
	}
}

func TestAReadingFindsTheEnvironmentsOfARepository(t *testing.T) {
	t.Parallel()

	g := newFakeGitHub()
	g.answerGraphQL(`{"r0": ` + apiData + `, "rateLimit": {"cost": 2}}`)
	g.answerREST("workflows/10/runs", runsJSON(t,
		runJSON(4, "in_progress", "", base),
		runJSON(3, "completed", "skipped", base),
		runJSON(2, "completed", "cancelled", base.Add(-time.Hour)),
		runJSON(1, "completed", "success", base.Add(-2*time.Hour)),
	), nil)
	g.answerREST("workflows/20/runs", runsJSON(t), nil)
	g.answerREST("workflows/30/runs", runsJSON(t, runJSON(5, "completed", "success", base)), nil)

	got, spent, err := deploys.ReadRepositories(t.Context(), g, []deploys.Target{apiTarget()})
	if err != nil {
		t.Fatalf("ReadRepositories() error = %v, want nil", err)
	}
	if want := (deploys.Cost{GraphQL: 2, REST: 3}); spent != want {
		t.Errorf("cost = %+v, want %+v", spent, want)
	}

	envs := got["repo-1"].Environments
	if len(envs) != 3 || got["repo-1"].Failure != nil {
		t.Fatalf("reading = %+v, want three environments and no failure", got["repo-1"])
	}

	dev := envs[0]
	if dev.Branch != "dev" || dev.PreviousBranch != "" || dev.WorkflowID != 10 || dev.Head != "dev9" || dev.Promotion != nil {
		t.Errorf("development = %+v", dev)
	}
	if dev.LastRun == nil || dev.LastRun.ID != 4 || dev.LastRun.Status != deploys.RunRunning {
		t.Errorf("development LastRun = %+v, want the running run 4", dev.LastRun)
	}
	if dev.LastCompleted == nil || dev.LastCompleted.ID != 2 || dev.LastCompleted.Status != deploys.RunFailed || dev.LastCompleted.Conclusion != "cancelled" {
		t.Errorf("development LastCompleted = %+v, want the cancelled run 2 (the skipped one doesn't count)", dev.LastCompleted)
	}

	staging := envs[1]
	if staging.PreviousBranch != "dev" || staging.LastRun != nil || staging.LastCompleted != nil {
		t.Errorf("staging = %+v, want previous dev and no runs", staging)
	}
	want := deploys.Promotion{
		Commits:      2,
		Ahead:        3,
		PendingSince: time.Date(2026, 9, 10, 10, 0, 0, 0, time.UTC),
		PullRequests: []deploys.PullRequest{
			{Number: 8, Title: "Fix logout", URL: "https://github.com/acme/api/pull/8", Author: "ghost"},
			{Number: 7, Title: "Add login", URL: "https://github.com/acme/api/pull/7", Author: "ana"},
		},
		DeployPR:      &deploys.DeployPR{Number: 9, Title: "Deploy to Staging", URL: "https://github.com/acme/api/pull/9", Draft: true, CreatedAt: time.Date(2026, 9, 12, 11, 0, 0, 0, time.UTC)},
		OpenDeployPRs: 1,
	}
	if diff := cmp.Diff(&want, staging.Promotion); diff != "" {
		t.Errorf("staging Promotion (-want +got):\n%s", diff)
	}

	if prod := envs[2]; prod.Promotion == nil || prod.Promotion.Commits != 0 || prod.Promotion.DeployPR != nil || !prod.Promotion.PendingSince.IsZero() {
		t.Errorf("production Promotion = %+v, want nothing waiting", prod.Promotion)
	}
}

func TestARunTakesItsStartFromTheRunStartedAtWhenGitHubGivesIt(t *testing.T) {
	t.Parallel()

	g := newFakeGitHub()
	started := runJSON(2, "in_progress", "", base)
	started["run_started_at"] = base.Add(30 * time.Second).Format(time.RFC3339)
	g.answerREST("workflows/10/runs", runsJSON(t, started, runJSON(1, "queued", "", base.Add(-time.Hour))), nil)

	runs, err := deploys.ReadRuns(t.Context(), g, "acme", "api", 10, "release/1.0")
	if err != nil {
		t.Fatalf("ReadRuns() error = %v, want nil", err)
	}
	if len(runs) != 2 {
		t.Fatalf("ReadRuns() = %d runs, want 2", len(runs))
	}
	if runs[0].StartedAt != base.Add(30*time.Second) || runs[0].CreatedAt != base {
		t.Errorf("run 2 started %v created %v, want start 30s after creation", runs[0].StartedAt, runs[0].CreatedAt)
	}
	if runs[1].StartedAt != runs[1].CreatedAt || runs[1].Status != deploys.RunQueued {
		t.Errorf("run 1 = %+v, want queued and started when created", runs[1])
	}
	wantCall := "GET repos/acme/api/actions/workflows/10/runs?branch=release%2F1.0&per_page=20&exclude_pull_requests=true"
	if calls := g.restCalls(); len(calls) != 1 || calls[0] != wantCall {
		t.Errorf("REST calls = %v, want [%s]", calls, wantCall)
	}
}

func TestEveryStatusOfARunIsMappedAndTheOnesThatDontCountAreDropped(t *testing.T) {
	t.Parallel()

	tests := []struct {
		status, conclusion string
		want               deploys.RunStatus
		counts             bool
	}{
		{"queued", "", deploys.RunQueued, true},
		{"waiting", "", deploys.RunQueued, true},
		{"in_progress", "", deploys.RunRunning, true},
		{"completed", "success", deploys.RunSucceeded, true},
		{"completed", "failure", deploys.RunFailed, true},
		{"completed", "cancelled", deploys.RunFailed, true},
		{"completed", "timed_out", deploys.RunFailed, true},
		{"completed", "startup_failure", deploys.RunFailed, true},
		{"completed", "action_required", deploys.RunFailed, true},
		{"completed", "skipped", "", false},
		{"completed", "neutral", "", false},
		{"completed", "stale", "", false},
	}
	for _, tt := range tests {
		t.Run(tt.status+" "+tt.conclusion, func(t *testing.T) {
			t.Parallel()
			g := newFakeGitHub()
			g.answerREST("/runs", runsJSON(t, runJSON(1, tt.status, tt.conclusion, base)), nil)

			runs, err := deploys.ReadRuns(t.Context(), g, "acme", "api", 10, "dev")
			if err != nil {
				t.Fatalf("ReadRuns() error = %v, want nil", err)
			}
			if !tt.counts {
				if len(runs) != 0 {
					t.Errorf("ReadRuns() = %+v, want none", runs)
				}
				return
			}
			if len(runs) != 1 || runs[0].Status != tt.want {
				t.Errorf("ReadRuns() = %+v, want one %s run", runs, tt.want)
			}
		})
	}
}

func TestAWorkflowGitHubDoesNotFindIsMissingNotAFailure(t *testing.T) {
	t.Parallel()

	g := newFakeGitHub()
	g.answerGraphQL(`{"r0": ` + apiData + `}`)
	g.answerREST("workflows/10/runs", "", fmt.Errorf("read runs: %w", gh.ErrNoResource))
	g.answerREST("workflows/20/runs", runsJSON(t), nil)
	g.answerREST("workflows/30/runs", runsJSON(t), nil)

	got, _, err := deploys.ReadRepositories(t.Context(), g, []deploys.Target{apiTarget()})
	if err != nil {
		t.Fatalf("ReadRepositories() error = %v, want nil", err)
	}
	reading := got["repo-1"]
	if reading.Failure != nil || len(reading.Environments) != 3 {
		t.Fatalf("reading = %+v, want three environments and no failure", reading)
	}
	for i, wantMissing := range []bool{true, false, false} {
		if reading.Environments[i].WorkflowMissing != wantMissing {
			t.Errorf("environment %d WorkflowMissing = %v, want %v", i, reading.Environments[i].WorkflowMissing, wantMissing)
		}
	}
}

func TestABranchThatIsGoneIsMissingAndCostsNoRunsCall(t *testing.T) {
	t.Parallel()

	g := newFakeGitHub()
	g.answerGraphQL(`{"r0": {
	  "b0": {"target": {"oid": "dev9"}},
	  "b1": null,
	  "b2": {"target": {"oid": "main1"}, "compare": {"aheadBy": 0, "commits": {"nodes": []}}},
	  "p2": {"totalCount": 0, "nodes": []}
	}}`)
	idleRuns(t, g)

	got, spent, err := deploys.ReadRepositories(t.Context(), g, []deploys.Target{apiTarget()})
	if err != nil {
		t.Fatalf("ReadRepositories() error = %v, want nil", err)
	}
	if spent.REST != 2 {
		t.Errorf("REST calls = %d, want 2 (staging is gone)", spent.REST)
	}
	envs := got["repo-1"].Environments
	if !envs[1].BranchMissing || envs[1].Head != "" || envs[1].Promotion != nil || envs[1].LastRun != nil {
		t.Errorf("staging = %+v, want a missing branch with nothing read", envs[1])
	}
	if envs[2].Promotion != nil {
		t.Errorf("production Promotion = %+v, want nil: the branch before it is gone", envs[2].Promotion)
	}
}

func TestPullRequestsOfDeployFromAForkAreNotDeploys(t *testing.T) {
	t.Parallel()

	g := newFakeGitHub()
	g.answerGraphQL(`{"r0": {
	  "b0": {"target": {"oid": "d"}},
	  "b1": {"target": {"oid": "s"}, "compare": {"aheadBy": 1, "commits": {"nodes": []}}},
	  "p1": {"totalCount": 1, "nodes": [{"number": 12, "title": "Fork", "url": "u", "isDraft": false, "createdAt": "2026-09-13T10:00:00Z", "isCrossRepository": true}]}
	}}`)
	idleRuns(t, g)

	target := apiTarget()
	target.Environments = target.Environments[:2]
	got, _, err := deploys.ReadRepositories(t.Context(), g, []deploys.Target{target})
	if err != nil {
		t.Fatalf("ReadRepositories() error = %v, want nil", err)
	}
	if p := got["repo-1"].Environments[1].Promotion; p == nil || p.DeployPR != nil || p.OpenDeployPRs != 0 {
		t.Errorf("Promotion = %+v, want no pull request of deploy", p)
	}
}

func TestAnErrorOfOneAliasIsTheFailureOfThatRepositoryAlone(t *testing.T) {
	t.Parallel()

	g := newFakeGitHub()
	g.answerGraphQL(`{"r0": `+apiData+`, "r1": null}`,
		gh.GraphQLError{Type: "NOT_FOUND", Message: "Could not resolve to a Repository", Path: []any{"r1"}})
	idleRuns(t, g)

	got, _, err := deploys.ReadRepositories(t.Context(), g, []deploys.Target{apiTarget(), webTarget()})
	if err != nil {
		t.Fatalf("ReadRepositories() error = %v, want nil", err)
	}
	if got["repo-1"].Failure != nil || len(got["repo-1"].Environments) != 3 {
		t.Errorf("api = %+v, want read", got["repo-1"])
	}
	web := got["repo-2"]
	if web.Failure == nil || web.Failure.Reason != deploys.ReasonNotFound || web.Environments == nil || len(web.Environments) != 0 {
		t.Errorf("web = %+v, want not found and no environments", web)
	}
}

func TestAnErrorDeeperInTheAliasIsTheFailureOfThatRepositoryToo(t *testing.T) {
	t.Parallel()

	g := newFakeGitHub()
	g.answerGraphQL(`{"r0": null}`,
		gh.GraphQLError{Type: "UNPROCESSABLE", Message: "No common ancestor between dev and staging", Path: []any{"r0", "b1", "compare"}})

	got, _, err := deploys.ReadRepositories(t.Context(), g, []deploys.Target{apiTarget()})
	if err != nil {
		t.Fatalf("ReadRepositories() error = %v, want nil", err)
	}
	want := &deploys.Failure{Reason: deploys.ReasonFailed, Detail: "No common ancestor between dev and staging"}
	if diff := cmp.Diff(want, got["repo-1"].Failure); diff != "" {
		t.Errorf("Failure (-want +got):\n%s", diff)
	}
}

func TestAFailureOfTheWholeCallIsTheFailureOfEveryRepositoryOfTheBatch(t *testing.T) {
	t.Parallel()

	g := newFakeGitHub()
	g.failGraphQL(&gh.Error{Output: "HTTP 502", Err: errors.New("exit status 1")})

	got, _, err := deploys.ReadRepositories(t.Context(), g, []deploys.Target{apiTarget(), webTarget()})
	if err != nil {
		t.Fatalf("ReadRepositories() error = %v, want nil", err)
	}
	for _, id := range []string{"repo-1", "repo-2"} {
		if f := got[id].Failure; f == nil || f.Reason != deploys.ReasonFailed || f.Detail != "HTTP 502" {
			t.Errorf("%s Failure = %+v, want failed with HTTP 502", id, f)
		}
	}
}

func TestAGeneralFailureIsTheFailureOfTheWholeReading(t *testing.T) {
	t.Parallel()

	reset := time.Date(2026, 9, 16, 14, 30, 0, 0, time.UTC)
	tests := []struct {
		name  string
		setup func(*testing.T, *fakeGitHub)
		want  deploys.Reason
	}{
		{"unauthenticated on the query", func(_ *testing.T, g *fakeGitHub) { g.failGraphQL(gh.ErrNotAuthenticated) }, deploys.ReasonUnauthenticated},
		{"gh missing on the query", func(_ *testing.T, g *fakeGitHub) { g.failGraphQL(gh.ErrNotFound) }, deploys.ReasonGHMissing},
		{"rate limited on the query", func(_ *testing.T, g *fakeGitHub) { g.failGraphQL(&gh.RateLimitError{ResetAt: reset}) }, deploys.ReasonRateLimited},
		{"rate limited on a run call", func(_ *testing.T, g *fakeGitHub) {
			g.answerGraphQL(`{"r0": ` + apiData + `}`)
			g.answerREST("/runs", "", &gh.RateLimitError{ResetAt: reset})
		}, deploys.ReasonRateLimited},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			g := newFakeGitHub()
			tt.setup(t, g)

			got, _, err := deploys.ReadRepositories(t.Context(), g, []deploys.Target{apiTarget()})
			var failure *deploys.Failure
			if !errors.As(err, &failure) || failure.Reason != tt.want || !failure.General() {
				t.Fatalf("error = %v, want a general %s failure", err, tt.want)
			}
			if got != nil {
				t.Errorf("readings = %v, want none", got)
			}
		})
	}
}

func TestAFailureOfARunCallIsTheFailureOfThatRepositoryAlone(t *testing.T) {
	t.Parallel()

	g := newFakeGitHub()
	g.answerGraphQL(`{"r0": ` + apiData + `}`)
	g.answerREST("/runs", "", &gh.Error{Output: "HTTP 500", Err: errors.New("exit status 1")})

	got, _, err := deploys.ReadRepositories(t.Context(), g, []deploys.Target{apiTarget()})
	if err != nil {
		t.Fatalf("ReadRepositories() error = %v, want nil", err)
	}
	if f := got["repo-1"].Failure; f == nil || f.Reason != deploys.ReasonFailed || len(got["repo-1"].Environments) != 0 {
		t.Errorf("reading = %+v, want failed with no environments", got["repo-1"])
	}
}

func TestRepositoriesAreReadInBatchesOfFifteen(t *testing.T) {
	t.Parallel()

	targets := make([]deploys.Target, 0, deploys.BatchSize+1)
	for i := range deploys.BatchSize + 1 {
		targets = append(targets, deploys.Target{ID: fmt.Sprintf("repo-%d", i), Owner: "acme", Name: fmt.Sprintf("r%d", i), Environments: threeEnvironments()[:2]})
	}
	g := newFakeGitHub()
	g.failGraphQL(&gh.Error{Output: "HTTP 502", Err: errors.New("exit status 1")})

	got, _, err := deploys.ReadRepositories(t.Context(), g, targets)
	if err != nil {
		t.Fatalf("ReadRepositories() error = %v, want nil", err)
	}
	if calls := g.graphQLCalls(); calls != 2 {
		t.Errorf("GraphQL calls = %d, want 2", calls)
	}
	if len(got) != len(targets) {
		t.Errorf("readings = %d, want %d", len(got), len(targets))
	}
}

func TestACancelledReadingReturnsTheCancellation(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	g := newFakeGitHub()
	g.failGraphQL(context.Canceled)

	if _, _, err := deploys.ReadRepositories(ctx, g, []deploys.Target{apiTarget()}); !errors.Is(err, context.Canceled) {
		t.Errorf("error = %v, want context.Canceled", err)
	}
}

func TestPromotionCountsCommitsLeavingOutTheMergeCommits(t *testing.T) {
	t.Parallel()

	const nodes = `[
	  {"oid": "c1", "committedDate": "2026-09-10T10:00:00Z", "parents": {"totalCount": 1, "nodes": [{"oid": "out"}]}},
	  {"oid": "c2", "committedDate": "2026-09-11T10:00:00Z", "parents": {"totalCount": 1, "nodes": [{"oid": "c1"}]}},
	  {"oid": "m",  "committedDate": "2026-09-12T10:00:00Z", "parents": {"totalCount": 2, "nodes": [{"oid": "c2"}]}}
	]`
	got := deploys.PromotionOf(t, "m", 3, nodes, []string{"dev", "main"})

	if got.Commits != 2 || got.Ahead != 3 || got.Partial {
		t.Errorf("Commits, Ahead, Partial = %d, %d, %v; want 2, 3, false", got.Commits, got.Ahead, got.Partial)
	}
	if want := time.Date(2026, 9, 10, 10, 0, 0, 0, time.UTC); !got.PendingSince.Equal(want) {
		t.Errorf("PendingSince = %v, want %v", got.PendingSince, want)
	}
}

func TestPromotionWithOnlyMergeCommitsWaitsForNothing(t *testing.T) {
	t.Parallel()

	const nodes = `[{"oid": "m", "committedDate": "2026-09-12T10:00:00Z", "parents": {"totalCount": 2, "nodes": [{"oid": "x"}]}}]`
	got := deploys.PromotionOf(t, "m", 1, nodes, []string{"dev", "main"})

	if got.Commits != 0 || !got.PendingSince.IsZero() || got.PullRequests == nil {
		t.Errorf("Promotion = %+v, want no commit, no age and a list that isn't nil", got)
	}
}

func TestPromotionDatesTheChangeOnTheFirstParentLine(t *testing.T) {
	t.Parallel()

	// The merge commit m brought a side branch (s, committed long before) into
	// the previous branch; the change reached it on the first-parent line, where
	// the oldest commit is c1.
	const nodes = `[
	  {"oid": "s",  "committedDate": "2026-09-08T08:00:00Z", "parents": {"totalCount": 1, "nodes": [{"oid": "out"}]}},
	  {"oid": "c1", "committedDate": "2026-09-10T10:00:00Z", "parents": {"totalCount": 1, "nodes": [{"oid": "out"}]}},
	  {"oid": "c2", "committedDate": "2026-09-11T10:00:00Z", "parents": {"totalCount": 1, "nodes": [{"oid": "c1"}]}},
	  {"oid": "m",  "committedDate": "2026-09-12T10:00:00Z", "parents": {"totalCount": 2, "nodes": [{"oid": "c2"}]}}
	]`
	got := deploys.PromotionOf(t, "m", 4, nodes, []string{"dev", "main"})

	if want := time.Date(2026, 9, 10, 10, 0, 0, 0, time.UTC); !got.PendingSince.Equal(want) {
		t.Errorf("PendingSince = %v, want %v", got.PendingSince, want)
	}
}

func TestPromotionPartialCountsTheCommitsNotReadAndDatesByTheOldestRead(t *testing.T) {
	t.Parallel()

	const nodes = `[
	  {"oid": "c1", "committedDate": "2026-09-10T10:00:00Z", "parents": {"totalCount": 1, "nodes": [{"oid": "out"}]}},
	  {"oid": "c2", "committedDate": "2026-09-09T10:00:00Z", "parents": {"totalCount": 1, "nodes": [{"oid": "c1"}]}}
	]`
	got := deploys.PromotionOf(t, "tip-not-read", 130, nodes, []string{"dev", "main"})

	if got.Commits != 130 || got.Ahead != 130 || !got.Partial {
		t.Errorf("Commits, Ahead, Partial = %d, %d, %v; want 130, 130, true", got.Commits, got.Ahead, got.Partial)
	}
	if want := time.Date(2026, 9, 9, 10, 0, 0, 0, time.UTC); !got.PendingSince.Equal(want) {
		t.Errorf("PendingSince = %v, want the oldest read, %v", got.PendingSince, want)
	}
}

func TestPromotionListsTheMergedPullRequestsOfTheTasksOnce(t *testing.T) {
	t.Parallel()

	const nodes = `[
	  {"oid": "c1", "committedDate": "2026-09-10T10:00:00Z", "parents": {"totalCount": 1, "nodes": []},
	   "associatedPullRequests": {"nodes": [
	     {"number": 5, "title": "Five", "url": "u5", "mergedAt": "2026-09-10T10:00:00Z", "headRefName": "feat", "baseRefName": "dev", "author": {"login": "ana"}},
	     {"number": 6, "title": "Closed unmerged", "url": "u6", "mergedAt": null, "headRefName": "x", "baseRefName": "dev", "author": {"login": "bob"}}
	   ]}},
	  {"oid": "c2", "committedDate": "2026-09-11T10:00:00Z", "parents": {"totalCount": 1, "nodes": [{"oid": "c1"}]},
	   "associatedPullRequests": {"nodes": [
	     {"number": 5, "title": "Five", "url": "u5", "mergedAt": "2026-09-10T10:00:00Z", "headRefName": "feat", "baseRefName": "dev", "author": {"login": "ana"}},
	     {"number": 9, "title": "Deploy to Staging", "url": "u9", "mergedAt": "2026-09-11T10:00:00Z", "headRefName": "dev", "baseRefName": "staging", "author": {"login": "bob"}},
	     {"number": 11, "title": "Eleven", "url": "u11", "mergedAt": "2026-09-11T10:00:00Z", "headRefName": "fix", "baseRefName": "dev", "author": null}
	   ]}}
	]`
	got := deploys.PromotionOf(t, "c2", 2, nodes, []string{"dev", "staging", "main"})

	want := []deploys.PullRequest{
		{Number: 11, Title: "Eleven", URL: "u11", Author: "ghost"},
		{Number: 5, Title: "Five", URL: "u5", Author: "ana"},
	}
	if diff := cmp.Diff(want, got.PullRequests); diff != "" {
		t.Errorf("PullRequests (-want +got):\n%s", diff)
	}
}

// pushRuns is the runs of a push by the workflows ids.
func pushRuns(t *testing.T, ids ...int) string {
	t.Helper()

	runs := make([]map[string]any, len(ids))
	for i, id := range ids {
		runs[i] = runJSON(i+1, "completed", "success", base)
		runs[i]["workflow_id"] = id
	}
	return runsJSON(t, runs...)
}

func TestTheOptionsOfARepositorySuggestTheOnlyWorkflowThatRunsOnPush(t *testing.T) {
	t.Parallel()

	g := newFakeGitHub()
	g.answerREST("actions/workflows?per_page=100", `{"workflows": [
	  {"id": 3, "name": "release", "path": ".github/workflows/release.yml", "state": "active"},
	  {"id": 1, "name": "Deploy", "path": ".github/workflows/deploy.yml", "state": "active"},
	  {"id": 4, "name": "old", "path": ".github/workflows/old.yml", "state": "disabled_manually"},
	  {"id": 2, "name": "Test", "path": ".github/workflows/test.yml", "state": "active"}
	]}`, nil)
	g.answerGraphQL(`{"repository": {
	  "b0": {"target": {"oid": "a"}}, "b1": {"target": {"oid": "b"}}, "b2": {"target": {"oid": "c"}},
	  "b3": {"target": {"oid": "d"}}, "b4": null
	}}`)
	g.answerREST("branch=main&event=push", pushRuns(t, 1, 1, 1), nil) // one
	g.answerREST("branch=dev&event=push", pushRuns(t, 1, 2, 1), nil)  // two
	g.answerREST("branch=qa&event=push", pushRuns(t, 4, 4), nil)      // only an inactive one
	g.answerREST("branch=empty&event=push", pushRuns(t), nil)         // none

	got, err := deploys.ReadOptions(t.Context(), g, "acme", "api", []string{"main", "dev", "qa", "empty", "gone"})
	if err != nil {
		t.Fatalf("ReadOptions() error = %v, want nil", err)
	}
	want := deploys.Options{
		Workflows: []deploys.Workflow{
			{ID: 1, Name: "Deploy", Path: ".github/workflows/deploy.yml"},
			{ID: 3, Name: "release", Path: ".github/workflows/release.yml"},
			{ID: 2, Name: "Test", Path: ".github/workflows/test.yml"},
		},
		Branches: []deploys.BranchOption{
			{Branch: "main", Exists: true, Suggested: 1},
			{Branch: "dev", Exists: true},
			{Branch: "qa", Exists: true},
			{Branch: "empty", Exists: true},
			{Branch: "gone"},
		},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("ReadOptions() (-want +got):\n%s", diff)
	}
	for _, call := range g.restCalls() {
		if strings.Contains(call, "branch=gone") {
			t.Errorf("REST call %q for a branch that doesn't exist", call)
		}
	}
}

func TestTheOptionsWithNoBranchesAskNothingOfTheBranches(t *testing.T) {
	t.Parallel()

	g := newFakeGitHub()
	g.answerREST("actions/workflows?per_page=100", `{"workflows": []}`, nil)

	got, err := deploys.ReadOptions(t.Context(), g, "acme", "api", nil)
	if err != nil {
		t.Fatalf("ReadOptions() error = %v, want nil", err)
	}
	if got.Workflows == nil || got.Branches == nil || len(got.Workflows) != 0 || len(got.Branches) != 0 {
		t.Errorf("ReadOptions() = %+v, want empty lists that aren't nil", got)
	}
	if g.graphQLCalls() != 0 {
		t.Errorf("GraphQL calls = %d, want none", g.graphQLCalls())
	}
}

func TestTheOptionsOfARepositoryThatIsNotThereFailAsNotFound(t *testing.T) {
	t.Parallel()

	g := newFakeGitHub()
	g.answerREST("actions/workflows", "", fmt.Errorf("rest: %w", gh.ErrNoResource))

	_, err := deploys.ReadOptions(t.Context(), g, "acme", "api", []string{"main"})
	var failure *deploys.Failure
	if !errors.As(err, &failure) || failure.Reason != deploys.ReasonNotFound {
		t.Errorf("error = %v, want a not found failure", err)
	}
}
