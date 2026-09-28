package gh_test

import (
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
}

func TestViewPRReadsThePullRequestOfTheBranch(t *testing.T) {
	t.Parallel()
	r, fake := runner(t, map[string]ghtest.Reply{
		"pr": {Stdout: `{"number":42,"url":"https://github.com/acme/api/pull/42","state":"OPEN","baseRefName":"dev",` +
			`"mergeable":"MERGEABLE","statusCheckRollup":[` +
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
	if calls[0].Args != "pr view login-screen --json number,url,state,baseRefName,mergeable,statusCheckRollup" {
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
