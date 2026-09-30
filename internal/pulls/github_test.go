package pulls_test

import (
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/pulls"
	"github.com/guilhermt/myspec/internal/repository"
)

func TestAReadingKeepsWhatTheBatchCouldReadOfEachRepository(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.github.reply(queryList, load(t, "list_partial.json"), nil)
	f.refresh(t)

	want := []pulls.PullRequest{
		{
			Owner: "acme", Name: "alpha", Number: 42,
			Title:      "Cache the board reading",
			URL:        "https://github.com/acme/alpha/pull/42",
			Author:     "mariana",
			Labels:     []pulls.Label{{Name: "backend", Color: "0e8a16"}},
			HeadBranch: "cache-board-reading", HeadCommit: "aaa111", BaseBranch: "main",
			UpdatedAt: time.Date(2026, time.September, 16, 11, 30, 0, 0, time.UTC),
			Body:      "Reads the board once per minute.",
			Checks: gh.PRChecks{
				Checks: []gh.Check{{
					Name: "test", URL: "https://github.com/acme/alpha/actions/runs/1/job/2", Conclusion: "success", State: gh.CheckPassed,
					StartedAt:   time.Date(2026, time.September, 16, 11, 0, 0, 0, time.UTC),
					CompletedAt: time.Date(2026, time.September, 16, 11, 4, 0, 0, time.UTC),
				}},
				Mergeable: gh.MergeableClean,
			},
		},
		{
			Owner: "acme", Name: "alpha", Number: 38,
			Title:      "Bump the linter",
			URL:        "https://github.com/acme/alpha/pull/38",
			Author:     "dependabot",
			Labels:     []pulls.Label{{Name: "dependencies", Color: "ededed"}},
			Draft:      true,
			Fork:       true,
			HeadBranch: "bump-linter", HeadCommit: "bbb222", BaseBranch: "main",
			UpdatedAt:      time.Date(2026, time.September, 15, 9, 0, 0, 0, time.UTC),
			Reviewed:       true,
			ReviewedCommit: "bbb111",
			Checks:         gh.PRChecks{Checks: []gh.Check{}, Mergeable: gh.MergeableUnknown},
			YourReview:     &pulls.YourReview{State: "changes_requested", At: time.Date(2026, time.September, 15, 8, 0, 0, 0, time.UTC)},
			NewCommitCount: 2,
		},
	}
	if diff := cmp.Diff(want, f.reading(t, alphaID).PullRequests); diff != "" {
		t.Errorf("the pull requests of acme/alpha (-want +got):\n%s", diff)
	}
	if got := f.reading(t, gammaID).PullRequests; len(got) != 1 || got[0].Number != 7 {
		t.Errorf("the pull requests of acme/gamma = %v, want only #7", got)
	}
}

func TestARepositoryTheBatchCouldNotReadCarriesItsOwnFailure(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.github.reply(queryList, load(t, "list_partial.json"), nil)
	f.refresh(t)

	beta := f.reading(t, betaID)
	if beta.Failure == nil || beta.Failure.Reason != pulls.ReasonNotFound {
		t.Fatalf("the failure of acme/beta = %v, want %s", beta.Failure, pulls.ReasonNotFound)
	}
	if got := beta.Failure.Message(); !strings.Contains(got, "can't read its pull requests") {
		t.Errorf("Message() = %q, want it to say the account can't read the pull requests", got)
	}
	if f.reading(t, alphaID).Failure != nil {
		t.Errorf("acme/alpha carries a failure, want none")
	}
}

func TestAPullRequestOfADeletedAccountIsAuthoredByGhost(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.github.reply(queryList, load(t, "list_ghost.json"), nil)
	f.refresh(t)

	prs := f.reading(t, alphaID).PullRequests
	if len(prs) != 1 {
		t.Fatalf("the pull requests of acme/alpha = %v, want one", prs)
	}
	if prs[0].Author != "ghost" {
		t.Errorf("Author = %q, want %q", prs[0].Author, "ghost")
	}
	if prs[0].Reviewed || prs[0].NewCommits() {
		t.Errorf("Reviewed = %v, NewCommits() = %v, want false and false", prs[0].Reviewed, prs[0].NewCommits())
	}
}

func TestAReviewOlderThanTheTipOfTheBranchIsNewCommits(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.github.reply(queryList, load(t, "list_partial.json"), nil)
	f.refresh(t)

	pr := f.pullRequest(t, alphaID, 38)
	if !pr.NewCommits() {
		t.Errorf("NewCommits() = false, want true: reviewed at %s, tip at %s", pr.ReviewedCommit, pr.HeadCommit)
	}
	if pr.Key() != "acme/alpha#38" {
		t.Errorf("Key() = %q, want %q", pr.Key(), "acme/alpha#38")
	}
}

func TestOneQueryReadsEveryRepositoryUnderItsOwnAlias(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.github.reply(queryList, load(t, "list_partial.json"), nil)
	f.refresh(t)

	calls := f.github.made(queryList)
	if len(calls) != 1 {
		t.Fatalf("the reading made %d list queries, want one", len(calls))
	}
	want := gh.Vars{
		"viewer": "guilhermt",
		"o0":     "acme", "n0": "alpha",
		"o1": "acme", "n1": "beta",
		"o2": "acme", "n2": "gamma",
	}
	if diff := cmp.Diff(want, calls[0].Vars); diff != "" {
		t.Errorf("the variables of the query (-want +got):\n%s", diff)
	}
	for _, alias := range []string{"r0: repository", "r1: repository", "r2: repository"} {
		if !strings.Contains(calls[0].Query, alias) {
			t.Errorf("the query does not read %q", alias)
		}
	}
}

func TestSixteenRepositoriesAreReadInTwoQueriesEachWithItsOwnAliases(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	repos := make([]repository.Repository, 0, 16)
	for i := range 16 {
		repos = append(repos, repository.Repository{
			ID: fmt.Sprintf("repo-%02d", i+1), Owner: "acme", Name: fmt.Sprintf("app-%02d", i+1), CreatedAt: base,
		})
	}
	f.register(repos)
	f.github.reply(queryList, load(t, "list_partial.json"), nil)
	f.refresh(t)

	calls := f.github.made(queryList)
	if len(calls) != 2 {
		t.Fatalf("the reading made %d list queries, want two", len(calls))
	}
	first := gh.Vars{"viewer": "guilhermt"}
	for i := range 15 {
		first[fmt.Sprintf("o%d", i)], first[fmt.Sprintf("n%d", i)] = "acme", fmt.Sprintf("app-%02d", i+1)
	}
	if diff := cmp.Diff(first, calls[0].Vars); diff != "" {
		t.Errorf("the variables of the first query (-want +got):\n%s", diff)
	}
	if !strings.Contains(calls[0].Query, "r14: repository") || strings.Contains(calls[0].Query, "r15: repository") {
		t.Errorf("the first query does not read exactly r0 to r14:\n%s", calls[0].Query)
	}

	second := gh.Vars{"viewer": "guilhermt", "o0": "acme", "n0": "app-16"}
	if diff := cmp.Diff(second, calls[1].Vars); diff != "" {
		t.Errorf("the variables of the second query (-want +got):\n%s", diff)
	}
	if !strings.Contains(calls[1].Query, "r0: repository") || strings.Contains(calls[1].Query, "r1: repository") {
		t.Errorf("the second query does not read r0 alone:\n%s", calls[1].Query)
	}

	// The second query answers under r0, which is the sixteenth repository.
	prs := f.reading(t, "repo-16").PullRequests
	if len(prs) != 2 || prs[0].Key() != "acme/app-16#42" {
		t.Errorf("the pull requests of acme/app-16 = %v, want the two r0 answered", prs)
	}
}

func TestReadDetailsAnswersTheStateOfEachPullRequestItFound(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.github.reply(queryDetail, load(t, "detail.json"), nil)

	refs := []pulls.Ref{
		{Owner: "acme", Name: "alpha", Number: 42},
		{Owner: "acme", Name: "gamma", Number: 7},
		{Owner: "acme", Name: "beta", Number: 99},
	}
	found, err := f.service.ReadDetails(t.Context(), refs)
	if err != nil {
		t.Fatalf("ReadDetails() = %v, want nil", err)
	}
	if len(found) != 2 {
		t.Fatalf("ReadDetails() found %d pull requests, want two", len(found))
	}
	if got := found[refs[0]]; got.State != "merged" || got.Body != "Reads the board once per minute." {
		t.Errorf("acme/alpha#42 = %q with body %q, want merged with its body", got.State, got.Body)
	}
	if got := found[refs[1]].State; got != "closed" {
		t.Errorf("acme/gamma#7 = %q, want closed", got)
	}
	if _, ok := found[refs[2]]; ok {
		t.Errorf("acme/beta#99 is in the answer, want it left out")
	}
}

func TestReadDetailsReadsTheChecksAndTheMergeState(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.github.reply(queryDetail, load(t, "detail.json"), nil)

	refs := []pulls.Ref{
		{Owner: "acme", Name: "alpha", Number: 42},
		{Owner: "acme", Name: "gamma", Number: 7},
	}
	found, err := f.service.ReadDetails(t.Context(), refs)
	if err != nil {
		t.Fatalf("ReadDetails() = %v, want nil", err)
	}

	want := gh.PRChecks{
		Checks: []gh.Check{
			{
				Name: "test", URL: "https://github.com/acme/alpha/actions/runs/1/job/2", Conclusion: "success", State: gh.CheckPassed,
				StartedAt:   time.Date(2026, time.September, 16, 11, 0, 0, 0, time.UTC),
				CompletedAt: time.Date(2026, time.September, 16, 11, 4, 0, 0, time.UTC),
			},
			{Name: "ci/deploy", URL: "https://ci.example.com/deploy/3", Conclusion: "failure", State: gh.CheckFailed},
		},
		Mergeable: gh.MergeableClean,
	}
	if diff := cmp.Diff(want, found[refs[0]].Checks); diff != "" {
		t.Errorf("the checks of acme/alpha#42 mismatch (-want +got):\n%s", diff)
	}
	want = gh.PRChecks{Checks: []gh.Check{}, Mergeable: gh.MergeableConflicting}
	if diff := cmp.Diff(want, found[refs[1]].Checks); diff != "" {
		t.Errorf("the checks of acme/gamma#7 mismatch (-want +got):\n%s", diff)
	}

	query := f.github.made(queryDetail)[0].Query
	for _, field := range []string{"mergeable", "statusCheckRollup", "... on CheckRun", "... on StatusContext"} {
		if !strings.Contains(query, field) {
			t.Errorf("the detail query does not ask for %q", field)
		}
	}
}

func TestTheListQueryAsksForWhatOnlyTheListShows(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.github.reply(queryList, load(t, "list_partial.json"), nil)
	f.refresh(t)

	query := f.github.made(queryList)[0].Query
	for _, field := range []string{
		"head: commits(last: 1)", "since: commits(last: 30)", "body", "mergeable",
		"startedAt completedAt", "rateLimit { cost }", "nodes { state submittedAt commit { oid } }",
	} {
		if !strings.Contains(query, field) {
			t.Errorf("the list query does not ask for %q", field)
		}
	}
}

func TestTheListReadsTheChecksTheBodyAndTheReviewOfEachPullRequest(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.github.reply(queryList, load(t, "list_partial.json"), nil)
	f.refresh(t)

	pr := f.pullRequest(t, alphaID, 42)
	wantChecks := gh.PRChecks{
		Checks: []gh.Check{{
			Name: "test", URL: "https://github.com/acme/alpha/actions/runs/1/job/2", Conclusion: "success", State: gh.CheckPassed,
			StartedAt:   time.Date(2026, time.September, 16, 11, 0, 0, 0, time.UTC),
			CompletedAt: time.Date(2026, time.September, 16, 11, 4, 0, 0, time.UTC),
		}},
		Mergeable: gh.MergeableClean,
	}
	if diff := cmp.Diff(wantChecks, pr.Checks); diff != "" {
		t.Errorf("the checks of acme/alpha#42 mismatch (-want +got):\n%s", diff)
	}
	if pr.Body != "Reads the board once per minute." || pr.YourReview != nil {
		t.Errorf("acme/alpha#42 has body %q and review %v, want its body and no review", pr.Body, pr.YourReview)
	}

	bump := f.pullRequest(t, alphaID, 38)
	wantReview := &pulls.YourReview{State: "changes_requested", At: time.Date(2026, time.September, 15, 8, 0, 0, 0, time.UTC)}
	if diff := cmp.Diff(wantReview, bump.YourReview); diff != "" {
		t.Errorf("the review of acme/alpha#38 mismatch (-want +got):\n%s", diff)
	}
	if bump.Checks.Mergeable != gh.MergeableUnknown || len(bump.Checks.Checks) != 0 {
		t.Errorf("the checks of acme/alpha#38 = %+v, want none and an unknown merge", bump.Checks)
	}
}

func TestTheCommitsAfterYourReviewAreCountedInTheThreeCases(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.github.reply(queryList, load(t, "list_partial.json"), nil)
	f.refresh(t)
	cases := []struct {
		name string
		repo string
		pr   int
		want int
	}{
		{name: "without a review", repo: alphaID, pr: 42, want: 0},
		{name: "with the commit among the last thirty", repo: alphaID, pr: 38, want: 2},
		{name: "with the head as the reviewed commit", repo: gammaID, pr: 7, want: 0},
	}
	for _, c := range cases {
		if got := f.pullRequest(t, c.repo, c.pr).NewCommitCount; got != c.want {
			t.Errorf("%s: NewCommitCount = %d, want %d", c.name, got, c.want)
		}
	}

	f.github.reply(queryList, load(t, "list_stale.json"), nil)
	f.refresh(t)
	if got := f.pullRequest(t, alphaID, 21).NewCommitCount; got != -1 {
		t.Errorf("with the commit out of the last thirty: NewCommitCount = %d, want -1", got)
	}
}

func TestReadDetailsReadsTheHoursTheCommitsAndTheMerge(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.github.reply(queryDetail, load(t, "detail.json"), nil)
	refs := []pulls.Ref{
		{Owner: "acme", Name: "alpha", Number: 42},
		{Owner: "acme", Name: "gamma", Number: 7},
	}
	found, err := f.service.ReadDetails(t.Context(), refs)
	if err != nil {
		t.Fatalf("ReadDetails() = %v, want nil", err)
	}

	merged := found[refs[0]]
	if got := merged.Checks.Checks[0].CompletedAt; !got.Equal(time.Date(2026, time.September, 16, 11, 4, 0, 0, time.UTC)) {
		t.Errorf("the first check completed at %v, want 11:04", got)
	}
	wantCommits := []pulls.Commit{
		{SHA: "aaa000", Subject: "Read the board once", Author: "mariana"},
		{SHA: "aaa111", Subject: "Cache it", Author: "Ana Bot"},
	}
	if diff := cmp.Diff(wantCommits, merged.Commits); diff != "" {
		t.Errorf("the commits mismatch (-want +got):\n%s", diff)
	}
	if merged.MergedBy != "rsouza" || !merged.MergedAt.Equal(time.Date(2026, time.September, 16, 12, 0, 0, 0, time.UTC)) {
		t.Errorf("merged by %q at %v, want rsouza at 12:00", merged.MergedBy, merged.MergedAt)
	}

	closed := found[refs[1]]
	if closed.MergedBy != "" || !closed.MergedAt.IsZero() || closed.ClosedAt.IsZero() {
		t.Errorf("the closed one = %q, %v, %v, want no merge and a close", closed.MergedBy, closed.MergedAt, closed.ClosedAt)
	}
	if closed.Commits == nil || len(closed.Commits) != 0 {
		t.Errorf("Commits = %v, want an empty list", closed.Commits)
	}

	query := f.github.made(queryDetail)[0].Query
	for _, field := range []string{"head: commits(last: 1)", "recent: commits(last: 50)", "mergedBy { login } mergedAt closedAt", "startedAt completedAt"} {
		if !strings.Contains(query, field) {
			t.Errorf("the detail query does not ask for %q", field)
		}
	}
}

func TestReadDetailsOfNothingAsksGitHubNothing(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	found, err := f.service.ReadDetails(t.Context(), nil)
	if err != nil || len(found) != 0 {
		t.Fatalf("ReadDetails(nil) = %v, %v, want an empty map and nil", found, err)
	}
	if calls := f.github.made(queryDetail); len(calls) != 0 {
		t.Errorf("ReadDetails(nil) made %d queries, want none", len(calls))
	}
}

func TestReadDetailsFailsWithWhyTheReadingFailed(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.github.reply(queryDetail, gh.Response{}, gh.ErrMissingScope)

	_, err := f.service.ReadDetails(t.Context(), []pulls.Ref{{Owner: "acme", Name: "alpha", Number: 42}})
	var failure *pulls.Failure
	if !errors.As(err, &failure) || failure.Reason != pulls.ReasonMissingScope {
		t.Fatalf("ReadDetails() = %v, want a failure of %s", err, pulls.ReasonMissingScope)
	}
	if got := failure.Message(); !strings.Contains(got, "gh auth refresh -s repo") {
		t.Errorf("Message() = %q, want it to say how to grant the scope", got)
	}
}
