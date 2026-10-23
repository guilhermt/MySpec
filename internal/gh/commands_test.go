package gh_test

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/gh/ghtest"
)

func TestAuthPassesForAGhThatIsLoggedIn(t *testing.T) {
	t.Parallel()
	r, fake := runner(t, map[string]ghtest.Reply{
		"auth": {Stderr: "github.com\n  ✓ Logged in to github.com account someone"},
	})

	if err := r.Auth(t.Context()); err != nil {
		t.Fatalf("Auth() = %v, want nil", err)
	}
	if calls := fake.Calls(t); len(calls) != 1 || calls[0].Args != "auth status" {
		t.Errorf("calls = %+v, want gh auth status", calls)
	}
}

func TestAuthReportsAGhWithNoLoginWithWhatItSaid(t *testing.T) {
	t.Parallel()
	said := "You are not logged into any GitHub hosts. To log in, run: gh auth login"
	r, _ := runner(t, map[string]ghtest.Reply{"auth": {Stderr: said, Exit: 1}})

	err := r.Auth(t.Context())
	if !errors.Is(err, gh.ErrNotAuthenticated) {
		t.Fatalf("Auth() = %v, want ErrNotAuthenticated", err)
	}
	var ghErr *gh.Error
	if !errors.As(err, &ghErr) {
		t.Fatalf("Auth() = %v, want the gh error underneath", err)
	}
	if ghErr.Output != said {
		t.Errorf("Output = %q, want %q", ghErr.Output, said)
	}
}

func TestAuthFailsWithoutGhOnThePath(t *testing.T) {
	t.Setenv("PATH", t.TempDir())

	err := gh.New(gh.Deps{}).Auth(t.Context())
	if !errors.Is(err, gh.ErrNotFound) {
		t.Errorf("Auth() = %v, want ErrNotFound", err)
	}
	if errors.Is(err, gh.ErrNotAuthenticated) {
		t.Errorf("Auth() = %v, want a missing gh told apart from a missing login", err)
	}
}

func TestViewPRReadsWhatARealGhAnswersWithTheTimesOfTheChecks(t *testing.T) {
	t.Parallel()
	recorded, err := os.ReadFile(filepath.Join("testdata", "status_check_rollup.json"))
	if err != nil {
		t.Fatalf("read the recorded answer: %v", err)
	}
	r, _ := runner(t, map[string]ghtest.Reply{"pr": {Stdout: string(recorded)}})

	got, err := r.ViewPR(t.Context(), t.TempDir(), "login-screen")
	if err != nil {
		t.Fatalf("ViewPR() = %v, want nil", err)
	}
	at := func(value string) time.Time {
		parsed, parseErr := time.Parse(time.RFC3339, value)
		if parseErr != nil {
			t.Fatalf("parse %q: %v", value, parseErr)
		}
		return parsed
	}
	run := "https://github.com/guilhermt/MySpec/actions/runs/36360336611/job/"
	want := gh.PRChecks{
		Checks: []gh.Check{
			{
				Name: "Frontend", URL: run + "108736125096", Conclusion: "success", State: gh.CheckPassed,
				StartedAt: at("2026-09-27T23:56:08Z"), CompletedAt: at("2026-09-28T00:03:30Z"),
			},
			{
				Name: "Go", URL: run + "108736124998", Conclusion: "success", State: gh.CheckPassed,
				StartedAt: at("2026-09-27T23:56:08Z"), CompletedAt: at("2026-09-28T00:01:11Z"),
			},
			{
				Name: "Build", URL: run + "108737339194", Conclusion: "success", State: gh.CheckPassed,
				StartedAt: at("2026-09-28T00:03:32Z"), CompletedAt: at("2026-09-28T00:07:52Z"),
			},
		},
		Mergeable: gh.MergeableUnknown,
	}
	if diff := cmp.Diff(want, got.Checks); diff != "" {
		t.Errorf("ViewPR().Checks mismatch (-want +got):\n%s", diff)
	}
	if got.MergedBy != "guilhermt" || !got.MergedAt.Equal(at("2026-09-28T00:09:14Z")) {
		t.Errorf("ViewPR() merged by %q at %v, want guilhermt at 2026-09-28T00:09:14Z", got.MergedBy, got.MergedAt)
	}
}

func TestViewPRReadsThePullRequestOfTheBranch(t *testing.T) {
	t.Parallel()
	r, fake := runner(t, map[string]ghtest.Reply{
		"pr": {Stdout: `{"number":42,"url":"https://github.com/acme/api/pull/42","state":"OPEN","baseRefName":"dev","headRefName":"login-screen",` +
			`"mergeable":"MERGEABLE","mergedBy":null,"mergedAt":null,"statusCheckRollup":[` +
			`{"__typename":"CheckRun","name":"test","status":"COMPLETED","conclusion":"SUCCESS","detailsUrl":"https://github.com/acme/api/actions/runs/1"},` +
			`{"__typename":"StatusContext","context":"ci/deploy","state":"PENDING","targetUrl":"https://ci.example.com/2"}]}`},
	})

	dir := t.TempDir()
	got, err := r.ViewPR(t.Context(), dir, "login-screen")
	if err != nil {
		t.Fatalf("ViewPR() = %v, want nil", err)
	}
	want := gh.PR{
		Number: 42,
		URL:    "https://github.com/acme/api/pull/42",
		State:  gh.StateOpen,
		Base:   "dev",
		Head:   "login-screen",
		Checks: gh.PRChecks{
			Checks: []gh.Check{
				{Name: "test", URL: "https://github.com/acme/api/actions/runs/1", Conclusion: "success", State: gh.CheckPassed},
				{Name: "ci/deploy", URL: "https://ci.example.com/2", Pending: true, State: gh.CheckRunning},
			},
			Mergeable: gh.MergeableClean,
		},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("ViewPR() mismatch (-want +got):\n%s", diff)
	}

	calls := fake.Calls(t)
	if len(calls) != 1 {
		t.Fatalf("calls = %+v, want one", calls)
	}
	if calls[0].Args != "pr view login-screen --json number,url,state,baseRefName,headRefName,mergeable,statusCheckRollup,mergedBy,mergedAt" {
		t.Errorf("args = %q, want the branch and the fields the app reads", calls[0].Args)
	}
	if calls[0].Dir != dir {
		t.Errorf("dir = %q, want the worktree %q", calls[0].Dir, dir)
	}
}

func TestViewPRNormalizesTheStateGhWrites(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		state string
		want  gh.State
	}{
		{"open", "OPEN", gh.StateOpen},
		{"merged", "MERGED", gh.StateMerged},
		{"closed", "CLOSED", gh.StateClosed},
		{"one the app does not know", "DRAFTED", gh.State("")},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			r, _ := runner(t, map[string]ghtest.Reply{
				"pr": {Stdout: `{"number":1,"url":"u","state":"` + test.state + `"}`},
			})

			got, err := r.ViewPR(t.Context(), t.TempDir(), "login-screen")
			if err != nil {
				t.Fatalf("ViewPR() = %v, want nil", err)
			}
			if got.State != test.want {
				t.Errorf("State = %q, want %q", got.State, test.want)
			}
		})
	}
}

func TestViewPRReportsABranchWithNoPullRequest(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{
		"pr": {Stderr: "no pull requests found for branch \"login-screen\"", Exit: 1},
	})

	_, err := r.ViewPR(t.Context(), t.TempDir(), "login-screen")
	if !errors.Is(err, gh.ErrNoPR) {
		t.Errorf("ViewPR() = %v, want ErrNoPR", err)
	}
}

func TestViewPRReportsAnyOtherFailureAsGhWroteIt(t *testing.T) {
	t.Parallel()
	said := "could not resolve to a Repository with the name 'acme/api'"
	r, _ := runner(t, map[string]ghtest.Reply{"pr": {Stderr: said, Exit: 1}})

	_, err := r.ViewPR(t.Context(), t.TempDir(), "login-screen")
	if errors.Is(err, gh.ErrNoPR) {
		t.Fatalf("ViewPR() = %v, want a failure, not an absent pull request", err)
	}
	var ghErr *gh.Error
	if !errors.As(err, &ghErr) || ghErr.Output != said {
		t.Errorf("ViewPR() = %v, want the gh error carrying %q", err, said)
	}
}

func TestViewPRFailsOnOutputThatIsNotTheJSONItAskedFor(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"pr": {Stdout: "not json at all"}})

	_, err := r.ViewPR(t.Context(), t.TempDir(), "login-screen")
	if err == nil {
		t.Fatal("ViewPR() = nil, want the decoding failure")
	}
	var syntaxErr *json.SyntaxError
	if !errors.As(err, &syntaxErr) {
		t.Errorf("ViewPR() = %v, want the decoding error underneath", err)
	}
}

func TestCreateReviewPublishesTheReviewOnItsStandardInput(t *testing.T) {
	t.Parallel()
	r, fake := runner(t, map[string]ghtest.Reply{
		"api": {Stdout: `{"id":1,"html_url":"https://github.com/acme/api/pull/42#pullrequestreview-1"}`},
	})

	in := gh.ReviewInput{
		CommitID: "abc123",
		Event:    gh.EventRequestChanges,
		Body:     "Two things to change.",
		Comments: []gh.ReviewComment{{Path: "internal/api/user.go", Line: 12, Side: "RIGHT", Body: "Handle the error."}},
	}
	got, err := r.CreateReview(t.Context(), "acme", "api", 42, in)
	if err != nil {
		t.Fatalf("CreateReview() = %v, want nil", err)
	}
	if want := "https://github.com/acme/api/pull/42#pullrequestreview-1"; got != want {
		t.Errorf("CreateReview() = %q, want %q", got, want)
	}

	calls := fake.Calls(t)
	if len(calls) != 1 {
		t.Fatalf("calls = %+v, want one", calls)
	}
	want := "api --method POST repos/acme/api/pulls/42/reviews --input -"
	if calls[0].Args != want {
		t.Errorf("args = %q, want %q", calls[0].Args, want)
	}

	var sent gh.ReviewInput
	if err := json.Unmarshal([]byte(fake.Stdin(t)), &sent); err != nil {
		t.Fatalf("stdin = %q, want the JSON of the review: %v", fake.Stdin(t), err)
	}
	if diff := cmp.Diff(in, sent); diff != "" {
		t.Errorf("stdin (-want +got):\n%s", diff)
	}
}

func TestCreateReviewSendsAnEmptyListOfComments(t *testing.T) {
	t.Parallel()
	r, fake := runner(t, map[string]ghtest.Reply{"api": {Stdout: `{"html_url":"u"}`}})

	in := gh.ReviewInput{CommitID: "abc123", Event: gh.EventApprove, Body: "Looks good."}
	if _, err := r.CreateReview(t.Context(), "acme", "api", 42, in); err != nil {
		t.Fatalf("CreateReview() = %v, want nil", err)
	}
	if stdin := fake.Stdin(t); !strings.Contains(stdin, `"comments":[]`) {
		t.Errorf("stdin = %q, want an empty list of comments", stdin)
	}
}

func TestCreateReviewReportsAGhWithNoLogin(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		reply ghtest.Reply
	}{
		{"by its exit code", ghtest.Reply{Stderr: "HTTP 401", Exit: 4}},
		{"by what it said", ghtest.Reply{Stderr: "To get started with GitHub CLI, run: gh auth login", Exit: 1}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			r, _ := runner(t, map[string]ghtest.Reply{"api": test.reply})

			_, err := r.CreateReview(t.Context(), "acme", "api", 42, gh.ReviewInput{})
			if !errors.Is(err, gh.ErrNotAuthenticated) {
				t.Errorf("CreateReview() = %v, want ErrNotAuthenticated", err)
			}
		})
	}
}

func TestCreateReviewReportsAnyOtherFailureAsGhWroteIt(t *testing.T) {
	t.Parallel()
	said := "HTTP 422: Line must be part of the diff"
	r, _ := runner(t, map[string]ghtest.Reply{"api": {Stderr: said, Exit: 1}})

	_, err := r.CreateReview(t.Context(), "acme", "api", 42, gh.ReviewInput{})
	if errors.Is(err, gh.ErrNotAuthenticated) {
		t.Fatalf("CreateReview() = %v, want a failure, not a missing login", err)
	}
	var ghErr *gh.Error
	if !errors.As(err, &ghErr) || ghErr.Output != said {
		t.Errorf("CreateReview() = %v, want the gh error carrying %q", err, said)
	}
}

func TestCreateReviewFailsOnOutputThatIsNotTheJSONItAskedFor(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"api": {Stdout: "not json at all"}})

	_, err := r.CreateReview(t.Context(), "acme", "api", 42, gh.ReviewInput{})
	var syntaxErr *json.SyntaxError
	if !errors.As(err, &syntaxErr) {
		t.Errorf("CreateReview() = %v, want the decoding error underneath", err)
	}
}

func TestPRDiffReadsTheDiffOfThePullRequest(t *testing.T) {
	t.Parallel()
	diff := "diff --git a/internal/api/user.go b/internal/api/user.go\n@@ -1,3 +1,4 @@\n+package api"
	r, fake := runner(t, map[string]ghtest.Reply{"pr": {Stdout: diff}})

	got, err := r.PRDiff(t.Context(), "acme", "api", 42)
	if err != nil {
		t.Fatalf("PRDiff() = %v, want nil", err)
	}
	if got != diff {
		t.Errorf("PRDiff() = %q, want %q", got, diff)
	}

	calls := fake.Calls(t)
	if len(calls) != 1 || calls[0].Args != "pr diff 42 --repo acme/api" {
		t.Errorf("calls = %+v, want gh pr diff 42 --repo acme/api", calls)
	}
}

func TestPRDiffReportsAFailureAsGhWroteIt(t *testing.T) {
	t.Parallel()
	said := "no pull requests found"
	r, _ := runner(t, map[string]ghtest.Reply{"pr": {Stderr: said, Exit: 1}})

	_, err := r.PRDiff(t.Context(), "acme", "api", 42)
	var ghErr *gh.Error
	if !errors.As(err, &ghErr) || ghErr.Output != said {
		t.Errorf("PRDiff() = %v, want the gh error carrying %q", err, said)
	}
}

func TestSignedInAsksTheLocalGhForTheTokenAndNeverForTheStatus(t *testing.T) {
	t.Parallel()
	r, fake := runner(t, map[string]ghtest.Reply{
		"auth token": {Stdout: "gho_secret\n"},
	})

	if err := r.SignedIn(t.Context()); err != nil {
		t.Fatalf("SignedIn() = %v, want nil", err)
	}
	if calls := fake.Calls(t); len(calls) != 1 || calls[0].Args != "auth token" {
		t.Errorf("calls = %+v, want gh auth token alone", calls)
	}
}

func TestSignedInReportsAGhWithNoLogin(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{
		"auth token": {Stderr: "no oauth token found for github.com", Exit: 1},
	})

	err := r.SignedIn(t.Context())
	if !errors.Is(err, gh.ErrNotAuthenticated) {
		t.Fatalf("SignedIn() = %v, want ErrNotAuthenticated", err)
	}
}

func TestALoginCheckThatDidNotEndIsNotAMissingLogin(t *testing.T) {
	t.Parallel()

	// A gh stopped before it answered, by a cancellation or a deadline, has no
	// exit code of its own: it said nothing about the login.
	for name, check := range map[string]func(r *gh.Runner, ctx context.Context) error{
		"auth":      (*gh.Runner).Auth,
		"signed in": (*gh.Runner).SignedIn,
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			r, _ := runner(t, map[string]ghtest.Reply{"auth": {Stderr: "not logged in", Exit: 1}})
			ctx, cancel := context.WithCancel(t.Context())
			cancel()

			err := check(r, ctx)
			if errors.Is(err, gh.ErrNotAuthenticated) {
				t.Errorf("%s() = %v, want a check that did not end told apart from a missing login", name, err)
			}
			if !errors.Is(err, context.Canceled) {
				t.Errorf("%s() = %v, want context.Canceled underneath", name, err)
			}
		})
	}
}

func TestSignedInFailsWithoutGhOnThePath(t *testing.T) {
	t.Setenv("PATH", t.TempDir())

	err := gh.New(gh.Deps{}).SignedIn(t.Context())
	if !errors.Is(err, gh.ErrNotFound) {
		t.Errorf("SignedIn() = %v, want ErrNotFound", err)
	}
	if errors.Is(err, gh.ErrNotAuthenticated) {
		t.Errorf("SignedIn() = %v, want a missing gh told apart from a missing login", err)
	}
}

// accountJSON is the answer of gh auth status --json for one login.
func accountJSON(entries string) string {
	return `{"hosts":{"github.com":[` + entries + `]}}`
}

func TestAccountReadsTheLoginAndItsScopes(t *testing.T) {
	t.Parallel()
	r, fake := runner(t, map[string]ghtest.Reply{"auth status": {Stdout: accountJSON(
		`{"state":"success","active":true,"login":"octocat","scopes":"gist, project, read:org, repo, workflow"}`)}})

	got, err := r.Account(t.Context())
	if err != nil {
		t.Fatalf("Account() = %v, want nil", err)
	}
	want := gh.Account{Login: "octocat", Scopes: []string{"gist", "project", "read:org", "repo", "workflow"}}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("Account() mismatch (-want +got):\n%s", diff)
	}
	calls := fake.Calls(t)
	if len(calls) != 1 || calls[0].Args != "auth status --json hosts --active --hostname github.com" {
		t.Errorf("calls = %+v, want gh auth status --json hosts --active --hostname github.com", calls)
	}
}

func TestAccountWithoutScopesHasNone(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"auth status": {Stdout: accountJSON(
		`{"state":"success","active":true,"login":"octocat"}`)}})

	got, err := r.Account(t.Context())
	if err != nil {
		t.Fatalf("Account() = %v, want nil", err)
	}
	if got.Scopes != nil {
		t.Errorf("Scopes = %#v, want nil", got.Scopes)
	}
}

func TestAccountTellsTheStatesOfTheLoginApart(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name      string
		stdout    string
		want      error // nil: an error that is neither of the two
		wantOther bool
	}{
		{"no login", `{"hosts":{}}`, gh.ErrNotAuthenticated, false},
		{"a token GitHub refused", accountJSON(
			`{"state":"error","active":true,"error":"non-200 OK status code: 401 Unauthorized body: \"Bad credentials\""}`), gh.ErrNotAuthenticated, false},
		{"no network", accountJSON(
			`{"state":"error","active":true,"error":"Post \"https://api.github.com/graphql\": dial tcp: connection refused"}`), gh.ErrUnverified, false},
		{"a timeout", accountJSON(`{"state":"timeout","active":true}`), gh.ErrUnverified, false},
		{"only an inactive login", accountJSON(`{"state":"success","active":false,"login":"other"}`), gh.ErrNotAuthenticated, false},
		{"not JSON", "not json", nil, true},
		{"an unknown state", accountJSON(`{"state":"weird","active":true}`), nil, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			r, _ := runner(t, map[string]ghtest.Reply{"auth status": {Stdout: tc.stdout}})

			_, err := r.Account(t.Context())
			if err == nil {
				t.Fatal("Account() = nil, want an error")
			}
			if tc.wantOther {
				if errors.Is(err, gh.ErrNotAuthenticated) || errors.Is(err, gh.ErrUnverified) {
					t.Errorf("Account() = %v, want neither ErrNotAuthenticated nor ErrUnverified", err)
				}
				return
			}
			if !errors.Is(err, tc.want) {
				t.Errorf("Account() = %v, want %v", err, tc.want)
			}
		})
	}
}

func TestAccountIgnoresAnInactiveEntry(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"auth status": {Stdout: accountJSON(
		`{"state":"success","active":false,"login":"other","scopes":"repo"},` +
			`{"state":"success","active":true,"login":"octocat","scopes":"project"}`)}})

	got, err := r.Account(t.Context())
	if err != nil {
		t.Fatalf("Account() = %v, want nil", err)
	}
	if got.Login != "octocat" {
		t.Errorf("Login = %q, want octocat", got.Login)
	}
}

func TestAccountReturnsTheErrorOfAGhThatFails(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"auth status": {Stderr: "unknown flag: --json", Exit: 1}})

	_, err := r.Account(t.Context())
	var ghErr *gh.Error
	if !errors.As(err, &ghErr) {
		t.Errorf("Account() = %v, want the gh error", err)
	}
}

func TestViewPRAcceptsTheNumberOfThePullRequestAsTheRef(t *testing.T) {
	t.Parallel()
	r, fake := runner(t, map[string]ghtest.Reply{"pr": {Stdout: `{"number":42,"state":"OPEN","headRefName":"login-screen"}`}})

	got, err := r.ViewPR(t.Context(), t.TempDir(), "42")
	if err != nil {
		t.Fatalf("ViewPR(42) = %v, want nil", err)
	}
	if got.Number != 42 || got.Head != "login-screen" {
		t.Errorf("ViewPR(42) = %+v, want number 42 on login-screen", got)
	}
	if calls := fake.Calls(t); len(calls) != 1 || !strings.HasPrefix(calls[0].Args, "pr view 42 --json ") {
		t.Errorf("calls = %+v, want gh pr view 42", calls)
	}
}

func TestOpenPRsListsTheOpenPullRequestsOfTheRepository(t *testing.T) {
	t.Parallel()
	r, fake := runner(t, map[string]ghtest.Reply{
		"pr": {Stdout: `[{"number":42,"url":"https://github.com/acme/api/pull/42","baseRefName":"dev","headRefName":"login","headRefOid":"abc"},` +
			`{"number":7,"url":"https://github.com/acme/api/pull/7","baseRefName":"main","headRefName":"fix","headRefOid":"def"}]`},
	})

	dir := t.TempDir()
	got, err := r.OpenPRs(t.Context(), dir)
	if err != nil {
		t.Fatalf("OpenPRs() = %v, want nil", err)
	}
	want := []gh.PRHead{
		{Number: 42, URL: "https://github.com/acme/api/pull/42", Base: "dev", Head: "login", HeadOID: "abc"},
		{Number: 7, URL: "https://github.com/acme/api/pull/7", Base: "main", Head: "fix", HeadOID: "def"},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("OpenPRs() mismatch (-want +got):\n%s", diff)
	}

	calls := fake.Calls(t)
	if len(calls) != 1 {
		t.Fatalf("calls = %+v, want one", calls)
	}
	wantArgs := "pr list --state open --limit 100 --json number,url,baseRefName,headRefName,headRefOid"
	if calls[0].Args != wantArgs || calls[0].Dir != dir {
		t.Errorf("call = %+v, want %q in %q", calls[0], wantArgs, dir)
	}
}

func TestOpenPRsIsEmptyWithNoOpenPullRequest(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"pr": {Stdout: "[]"}})

	got, err := r.OpenPRs(t.Context(), t.TempDir())
	if err != nil || len(got) != 0 {
		t.Errorf("OpenPRs() = %v, %v, want none and nil", got, err)
	}
}

func TestOpenPRsReportsAGhWithNoLogin(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"pr": {Stderr: "To get started with GitHub CLI, run: gh auth login", Exit: 1}})

	if _, err := r.OpenPRs(t.Context(), t.TempDir()); !errors.Is(err, gh.ErrNotAuthenticated) {
		t.Errorf("OpenPRs() = %v, want ErrNotAuthenticated", err)
	}
}

func TestOpenPRsFailsOnAnAnswerThatIsNotJSON(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"pr": {Stdout: "nope"}})

	if _, err := r.OpenPRs(t.Context(), t.TempDir()); err == nil {
		t.Error("OpenPRs() = nil, want an error")
	}
}

func TestCreatePROpensThePullRequestWithTheBodyOnTheStandardInput(t *testing.T) {
	t.Parallel()
	r, fake := runner(t, map[string]ghtest.Reply{
		"pr": {Stdout: "Warning: 1 uncommitted change\n\nhttps://github.com/acme/api/pull/42\n"},
	})

	dir := t.TempDir()
	number, url, err := r.CreatePR(t.Context(), dir, "dev", "login", "Add the login", "Adds the login screen.\n")
	if err != nil {
		t.Fatalf("CreatePR() = %v, want nil", err)
	}
	if number != 42 || url != "https://github.com/acme/api/pull/42" {
		t.Errorf("CreatePR() = %d, %q, want 42 and the URL", number, url)
	}

	calls := fake.Calls(t)
	if len(calls) != 1 {
		t.Fatalf("calls = %+v, want one", calls)
	}
	want := "pr create --base dev --head login --title Add the login --body-file -"
	if calls[0].Args != want || calls[0].Dir != dir {
		t.Errorf("call = %+v, want %q in %q", calls[0], want, dir)
	}
	if got := fake.Stdin(t); got != "Adds the login screen.\n" {
		t.Errorf("stdin = %q, want the body", got)
	}
}

func TestCreatePRFailsOnAnAnswerWithNoPullRequestNumber(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"pr": {Stdout: "https://github.com/acme/api"}})

	if _, _, err := r.CreatePR(t.Context(), t.TempDir(), "dev", "login", "t", "b"); err == nil {
		t.Error("CreatePR() = nil, want an error for a URL with no number")
	}
}

func TestCreatePRReportsGhFailures(t *testing.T) {
	t.Parallel()

	t.Run("no login", func(t *testing.T) {
		t.Parallel()
		r, _ := runner(t, map[string]ghtest.Reply{"pr": {Stderr: "run: gh auth login", Exit: 1}})

		_, _, err := r.CreatePR(t.Context(), t.TempDir(), "dev", "login", "t", "b")
		if !errors.Is(err, gh.ErrNotAuthenticated) {
			t.Errorf("CreatePR() = %v, want ErrNotAuthenticated", err)
		}
	})
	t.Run("a refusal", func(t *testing.T) {
		t.Parallel()
		r, _ := runner(t, map[string]ghtest.Reply{"pr": {Stderr: "a pull request already exists", Exit: 1}})

		_, _, err := r.CreatePR(t.Context(), t.TempDir(), "dev", "login", "t", "b")
		var ghErr *gh.Error
		if !errors.As(err, &ghErr) || errors.Is(err, gh.ErrNotAuthenticated) {
			t.Errorf("CreatePR() = %v, want the gh error", err)
		}
	})
}
