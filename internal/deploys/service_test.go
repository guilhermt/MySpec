package deploys_test

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/deploys"
	"github.com/guilhermt/myspec/internal/gh"
)

func TestWithoutAConfigurationNothingIsReadFromGitHub(t *testing.T) {
	t.Parallel()

	f := newFixture(t, withoutConfig)
	f.service.Refresh()
	f.service.RefreshRepository(apiID)
	waitIdle(t, f.service)

	if got := f.github.graphQLCalls(); got != 0 {
		t.Errorf("queries = %d, want 0", got)
	}
	if got := f.github.restCalls(); len(got) != 0 {
		t.Errorf("REST calls = %v, want none", got)
	}
	if got := f.service.Overview().Boards; len(got) != 0 {
		t.Errorf("boards = %v, want none", got)
	}
}

func TestARefreshReadsEveryManagedRepositoryInOneQuery(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.refresh(t)

	if got := f.github.graphQLCalls(); got != 1 {
		t.Errorf("queries = %d, want 1", got)
	}
	o := f.service.Overview()
	if len(o.Boards) != 2 || o.ReadAt.IsZero() {
		t.Fatalf("Overview() = %d boards read at %v, want 2 boards read", len(o.Boards), o.ReadAt)
	}
	if got := f.environment(t, apiID, 2).View.State; got != deploys.StateUpToDate {
		t.Errorf("Production = %s, want %s", got, deploys.StateUpToDate)
	}
	if !strings.Contains(f.logs.String(), "deploys read") {
		t.Errorf("log = %q, want the line deploys read", f.logs.String())
	}
}

func TestRequestsMadeWhileAReadingRunsBecomeOneReading(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	release := f.github.hold()
	f.service.Refresh()
	if !f.service.Reading() {
		t.Error("Reading() = false right after Refresh, want true")
	}
	waitFor(t, "the first query", func() bool { return f.github.graphQLCalls() == 1 })

	f.service.Refresh()
	f.service.Refresh()
	f.service.Refresh()
	release()
	waitIdle(t, f.service)

	if got := f.github.graphQLCalls(); got != 2 {
		t.Errorf("queries = %d, want 2: the one that ran and one for every request after it", got)
	}
}

func TestARepositoryReadAloneIsTheOnlyOneQueried(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	release := f.github.hold()
	f.service.RefreshRepository(webID)
	if !f.repository(t, webID).Reading {
		t.Error("the row of acme/web is not reading, want it to be")
	}
	if f.repository(t, apiID).Reading {
		t.Error("the row of acme/api is reading, want it not to be")
	}
	release()
	waitIdle(t, f.service)

	f.github.mu.Lock()
	defer f.github.mu.Unlock()
	if len(f.github.queries) != 1 || !strings.Contains(f.github.queries[0], `name: "web"`) || strings.Contains(f.github.queries[0], `name: "api"`) {
		t.Errorf("queries = %q, want one that reads acme/web alone", f.github.queries)
	}
}

func TestARepositoryThatFailsKeepsItsPreviousReadingAndTheFirstFailure(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.github.answerGraphQLRepo(pendingData)
	f.refresh(t)
	readAt := f.repository(t, apiID).ReadAt

	f.github.answerGraphQL(`{"r0": null, "r1": `+quietData+`, "rateLimit": {"cost": 1}}`,
		gh.GraphQLError{Type: "NOT_FOUND", Message: "Could not resolve", Path: []any{"r0"}})
	f.advance(time.Minute)
	f.refresh(t)
	first := f.repository(t, apiID)
	f.advance(time.Minute)
	f.refresh(t)
	second := f.repository(t, apiID)

	if first.Failure == nil || first.Failure.Reason != deploys.ReasonNotFound {
		t.Fatalf("Failure = %v, want %s", first.Failure, deploys.ReasonNotFound)
	}
	if want := base.Add(time.Minute); !first.Failure.FailedAt.Equal(want) || !second.Failure.FailedAt.Equal(want) {
		t.Errorf("FailedAt = %v then %v, want %v both times", first.Failure.FailedAt, second.Failure.FailedAt, want)
	}
	if !second.ReadAt.Equal(readAt) {
		t.Errorf("ReadAt = %v, want %v, the last good reading", second.ReadAt, readAt)
	}
	if got := second.Environments[1].View.State; got != deploys.StatePending {
		t.Errorf("Staging = %s, want %s from the reading before the failure", got, deploys.StatePending)
	}
	if f.repository(t, webID).Failure != nil {
		t.Error("acme/web has a failure, want only acme/api to")
	}
}

func TestAGeneralFailureGoesToTheViewAndKeepsTheReadings(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.github.answerGraphQLRepo(pendingData)
	f.refresh(t)

	f.github.failGraphQL(gh.ErrNotAuthenticated)
	f.refresh(t)
	o := f.service.Overview()

	if o.Failure == nil || o.Failure.Reason != deploys.ReasonUnauthenticated {
		t.Fatalf("Failure = %v, want %s", o.Failure, deploys.ReasonUnauthenticated)
	}
	if got := f.environment(t, apiID, 1).View.State; got != deploys.StatePending {
		t.Errorf("Staging = %s, want %s from the reading before the failure", got, deploys.StatePending)
	}

	f.github.answerGraphQLRepo(pendingData)
	f.refresh(t)
	if got := f.service.Overview().Failure; got != nil {
		t.Errorf("Failure = %v after a good reading, want nil", got)
	}
}

func TestAnEnvironmentReadForAnotherConfigurationIsUnreadUntilTheNextReading(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.refresh(t)

	release := f.github.hold()
	envs := threeEnvironments()
	envs[1].Branch = "stage"
	err := f.service.SaveConfig(t.Context(), deploys.BoardConfig{
		BoardID: platformID, Enabled: true,
		Repositories: []deploys.RepositoryConfig{{RepositoryID: apiID, Environments: envs}},
	})
	if err != nil {
		t.Fatalf("SaveConfig() = %v, want nil", err)
	}
	states := []deploys.State{f.environment(t, apiID, 0).View.State, f.environment(t, apiID, 1).View.State, f.environment(t, apiID, 2).View.State}
	release()
	waitIdle(t, f.service)

	want := []deploys.State{deploys.StateUpToDate, deploys.StateUnread, deploys.StateUnread}
	if diff := cmp.Diff(want, states); diff != "" {
		t.Errorf("states before the reading (-want +got):\n%s", diff)
	}
}

func TestSavingAConfigurationValidatesStoresAndAsksForAReading(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	oneEnvironment := deploys.BoardConfig{
		BoardID: platformID, Enabled: true,
		Repositories: []deploys.RepositoryConfig{{RepositoryID: apiID, Environments: threeEnvironments()[:1]}},
	}
	if err := f.service.SaveConfig(t.Context(), oneEnvironment); !errors.Is(err, deploys.ErrTooFewEnvironments) {
		t.Errorf("SaveConfig(one environment) = %v, want ErrTooFewEnvironments", err)
	}
	if err := f.service.SaveConfig(t.Context(), deploys.BoardConfig{BoardID: "board-9"}); !errors.Is(err, deploys.ErrBoardNotFound) {
		t.Errorf("SaveConfig(unknown board) = %v, want ErrBoardNotFound", err)
	}
	if err := f.service.SaveConfig(t.Context(), deploys.BoardConfig{BoardID: platformID, Repositories: []deploys.RepositoryConfig{{RepositoryID: webID, Environments: threeEnvironments()}}}); !errors.Is(err, deploys.ErrNotOnBoard) {
		t.Errorf("SaveConfig(repository of another board) = %v, want ErrNotOnBoard", err)
	}
	if got := f.github.graphQLCalls(); got != 0 {
		t.Fatalf("queries after refused configurations = %d, want 0", got)
	}

	envs := threeEnvironments()
	envs[0].Name, envs[0].Branch = "  Dev ", " dev  "
	changes := f.changes.count()
	if err := f.service.SaveConfig(t.Context(), deploys.BoardConfig{
		BoardID: platformID, Enabled: true,
		Repositories: []deploys.RepositoryConfig{{RepositoryID: apiID, Environments: envs}},
	}); err != nil {
		t.Fatalf("SaveConfig() = %v, want nil", err)
	}
	waitFor(t, "the reading the save asked for", func() bool { return f.github.graphQLCalls() == 1 })
	waitIdle(t, f.service)

	saved, _ := f.store.saved(platformID)
	if got := saved.Repositories[0].Environments[0]; got.Name != "Dev" || got.Branch != "dev" {
		t.Errorf("saved environment = %+v, want the trimmed name and branch", got)
	}
	if f.changes.count() == changes {
		t.Error("OnChange was not called by SaveConfig")
	}
	if got := f.environment(t, apiID, 0).Environment.Name; got != "Dev" {
		t.Errorf("name in the view = %q, want Dev", got)
	}
}

func TestTheConfigurationOfABoardLeavesOutTheRepositoriesThatLeftIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.mu.Lock()
	f.repos[0].BoardID = mobileID
	f.mu.Unlock()

	platform, ok := f.service.Config(platformID)
	if !ok || len(platform.Repositories) != 0 {
		t.Errorf("Config(Platform) = %+v, %t, want the board with no repository", platform, ok)
	}
	if _, ok := f.service.Config("board-9"); ok {
		t.Error("Config(board-9) found one, want none")
	}
	if got := len(f.service.Configs()); got != 2 {
		t.Errorf("Configs() has %d boards, want 2", got)
	}
	if got := f.service.Overview().Boards; len(got) != 1 || got[0].ID != mobileID {
		t.Errorf("boards = %v, want only Mobile: Platform has no managed repository left", got)
	}
}

func TestReloadReadsTheStoreAgainAndAnnouncesIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.store.mu.Lock()
	delete(f.store.configs, mobileID)
	f.store.mu.Unlock()
	changes := f.changes.count()

	if err := f.service.Reload(t.Context()); err != nil {
		t.Fatalf("Reload() = %v, want nil", err)
	}

	if got := len(f.service.Overview().Boards); got != 1 {
		t.Errorf("boards = %d, want 1", got)
	}
	if f.changes.count() != changes+1 {
		t.Errorf("OnChange calls = %d, want %d", f.changes.count(), changes+1)
	}
	f.store.err = errors.New("disk")
	if err := f.service.Reload(t.Context()); err == nil {
		t.Error("Reload() = nil with a failing store, want an error")
	}
}

func TestThePositionOfABranchIsItsPlaceInTheConfiguration(t *testing.T) {
	t.Parallel()

	f := newFixture(t)

	for branch, want := range map[string]int{"dev": 0, "staging": 1, "main": 2, "nope": -1} {
		if got := f.service.Position(apiID, branch); got != want {
			t.Errorf("Position(api, %s) = %d, want %d", branch, got, want)
		}
	}
	if got := f.service.Position("repo-9", "dev"); got != -1 {
		t.Errorf("Position(unknown, dev) = %d, want -1", got)
	}
}

func TestTheFilterShowsOneBoardAndIsStored(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	if err := f.service.SetFilter(t.Context(), mobileID); err != nil {
		t.Fatalf("SetFilter() = %v, want nil", err)
	}
	o := f.service.Overview()

	if len(o.Boards) != 2 || o.Boards[0].Title != "mobile" || o.Boards[1].Title != "Platform" {
		t.Fatalf("boards = %+v, want mobile then Platform: by title ignoring case", o.Boards)
	}
	if !o.Boards[0].Shown || o.Boards[1].Shown {
		t.Errorf("Shown = %t, %t, want true, false", o.Boards[0].Shown, o.Boards[1].Shown)
	}
	if o.FilterGone != deploys.FilterShown || o.Filter != (deploys.Filter{BoardID: mobileID, Title: "mobile"}) {
		t.Errorf("Filter = %+v gone %q, want the Mobile board, shown", o.Filter, o.FilterGone)
	}
	if got := f.settings.get("deploy_filter"); got != `{"boardId":"board-2","title":"mobile"}` {
		t.Errorf("setting = %s, want the board and its title", got)
	}

	if err := f.service.SetFilter(t.Context(), ""); err != nil {
		t.Fatalf("SetFilter(all) = %v, want nil", err)
	}
	for _, b := range f.service.Overview().Boards {
		if !b.Shown {
			t.Errorf("board %s is not shown with no filter", b.Title)
		}
	}
}

func TestAFilterOnABoardWithoutDeploysOrRemovedSaysSo(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	if err := f.service.SaveConfig(t.Context(), deploys.BoardConfig{BoardID: mobileID, Enabled: false, Repositories: []deploys.RepositoryConfig{}}); err != nil {
		t.Fatalf("SaveConfig() = %v, want nil", err)
	}
	if err := f.service.SetFilter(t.Context(), mobileID); err != nil {
		t.Fatalf("SetFilter() = %v, want nil", err)
	}
	if got := f.service.Overview().FilterGone; got != deploys.FilterNoDeploys {
		t.Errorf("FilterGone = %q, want %q", got, deploys.FilterNoDeploys)
	}

	f.mu.Lock()
	f.boards = f.boards[:1]
	f.mu.Unlock()
	o := f.service.Overview()
	if o.FilterGone != deploys.FilterRemoved || o.Filter.Title != "mobile" {
		t.Errorf("FilterGone = %q with title %q, want %q and the title kept for the chip", o.FilterGone, o.Filter.Title, deploys.FilterRemoved)
	}
	if len(o.Boards) != 1 || o.Boards[0].Shown {
		t.Errorf("boards = %+v, want Platform, which the filter on another board doesn't show", o.Boards)
	}
}

func TestTheFilterStoredIsLoadedAndAnUnreadableOneIsTheZeroFilter(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.settings.values["deploy_filter"] = `{"boardId":"board-1","title":"Platform"}`
	if err := f.service.Sync(t.Context()); err != nil {
		t.Fatalf("Sync() = %v, want nil", err)
	}
	if got := f.service.Filter(); got != (deploys.Filter{BoardID: platformID, Title: "Platform"}) {
		t.Errorf("Filter() = %+v, want the stored one", got)
	}

	f.settings.values["deploy_filter"] = `{nope`
	if err := f.service.Sync(t.Context()); err != nil {
		t.Fatalf("Sync() = %v, want nil", err)
	}
	if got := f.service.Filter(); got != (deploys.Filter{}) {
		t.Errorf("Filter() = %+v, want the zero filter", got)
	}
	if !strings.Contains(f.logs.String(), "deploy filter unreadable") {
		t.Errorf("log = %q, want the line deploy filter unreadable", f.logs.String())
	}
}

func TestWaitingAndFailedCountEveryBoardWhateverTheFilter(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.github.answerGraphQLRepo(apiData)
	f.github.answerREST("workflows/10/runs", runsJSON(t, runJSON(3, "completed", "failure", base)), nil)
	f.refresh(t)

	all := f.service.Overview()
	if err := f.service.SetFilter(t.Context(), platformID); err != nil {
		t.Fatalf("SetFilter() = %v, want nil", err)
	}
	filtered := f.service.Overview()

	if all.Waiting != 2 || !all.Failed {
		t.Errorf("Waiting = %d, Failed = %t, want 2 and true: Staging of both repositories has a pull request ready, and Development failed", all.Waiting, all.Failed)
	}
	if filtered.Waiting != all.Waiting || filtered.Failed != all.Failed {
		t.Errorf("filtered Waiting = %d, Failed = %t, want what the view without the filter says", filtered.Waiting, filtered.Failed)
	}
}

func TestOptionsOfAnUnknownRepositoryFailAsNotFound(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	_, err := f.service.Options(t.Context(), "repo-9", nil)

	var failure *deploys.Failure
	if !errors.As(err, &failure) || failure.Reason != deploys.ReasonNotFound {
		t.Errorf("Options() = %v, want a not_found failure", err)
	}
	f.github.answerREST("actions/workflows?", `{"workflows": [{"id": 10, "name": "Deploy", "path": ".github/workflows/deploy.yml", "state": "active"}]}`, nil)
	options, err := f.service.Options(t.Context(), apiID, nil)
	if err != nil || len(options.Workflows) != 1 {
		t.Errorf("Options(api) = %+v, %v, want its workflow", options, err)
	}
}
