package gh_test

import (
	"encoding/json"
	"errors"
	"testing"

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

func TestViewPRReadsThePullRequestOfTheBranch(t *testing.T) {
	t.Parallel()
	r, fake := runner(t, map[string]ghtest.Reply{
		"pr": {Stdout: `{"number":42,"url":"https://github.com/acme/api/pull/42","state":"OPEN"}`},
	})

	dir := t.TempDir()
	got, err := r.ViewPR(t.Context(), dir, "login-screen")
	if err != nil {
		t.Fatalf("ViewPR() = %v, want nil", err)
	}
	want := gh.PR{Number: 42, URL: "https://github.com/acme/api/pull/42", State: gh.StateOpen}
	if got != want {
		t.Errorf("ViewPR() = %+v, want %+v", got, want)
	}

	calls := fake.Calls(t)
	if len(calls) != 1 {
		t.Fatalf("calls = %+v, want one", calls)
	}
	if calls[0].Args != "pr view login-screen --json number,url,state" {
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
