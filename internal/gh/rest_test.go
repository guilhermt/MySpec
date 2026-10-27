package gh_test

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/gh/ghtest"
)

func TestRESTReturnsWhatGitHubAnsweredAndSendsTheBody(t *testing.T) {
	t.Parallel()
	r, fake := runner(t, map[string]ghtest.Reply{"api": {Stdout: `{"id":1}`}})

	got, err := r.REST(t.Context(), "POST", "repos/o/n/pulls", `{"title":"t"}`)
	if err != nil {
		t.Fatalf("REST() = %v, want nil", err)
	}
	if got != `{"id":1}` {
		t.Errorf("REST() = %q, want the answer of GitHub", got)
	}
	if stdin := fake.Stdin(t); stdin != `{"title":"t"}` {
		t.Errorf("stdin = %q, want the body", stdin)
	}
	calls := fake.Calls(t)
	if len(calls) != 1 || calls[0].Args != "api --method POST repos/o/n/pulls --input -" {
		t.Errorf("calls = %+v, want one api call with --input -", calls)
	}
}

func TestRESTWithoutABodySendsNoInput(t *testing.T) {
	t.Parallel()
	r, fake := runner(t, map[string]ghtest.Reply{"api": {Stdout: "[]"}})

	if _, err := r.REST(t.Context(), "GET", "repos/o/n/deployments", ""); err != nil {
		t.Fatalf("REST() = %v, want nil", err)
	}
	calls := fake.Calls(t)
	if len(calls) != 1 || calls[0].Args != "api --method GET repos/o/n/deployments" {
		t.Errorf("calls = %+v, want one api call without --input", calls)
	}
}

func TestRESTReportsA404AsNoResource(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"api": {
		Stdout: `{"message":"Not Found"}`,
		Stderr: "gh: Not Found (HTTP 404)",
		Exit:   1,
	}})

	_, err := r.REST(t.Context(), "GET", "repos/o/n/pulls/9", "")
	if !errors.Is(err, gh.ErrNoResource) {
		t.Fatalf("REST() = %v, want ErrNoResource", err)
	}
	var ghErr *gh.Error
	if !errors.As(err, &ghErr) {
		t.Errorf("REST() = %v, want the *Error underneath", err)
	}
}

func TestRESTReportsTheRateLimitWithTheCoreReset(t *testing.T) {
	t.Parallel()
	reset := time.Now().Add(20 * time.Minute).Truncate(time.Second)
	r, fake := runner(t, map[string]ghtest.Reply{
		"api": {
			Stdout: `{"message":"API rate limit exceeded for user ID 1."}`,
			Stderr: "gh: API rate limit exceeded (HTTP 403)",
			Exit:   1,
		},
		"api rate_limit": {Stdout: fmt.Sprintf(`{"resources":{"core":{"reset":%d},"graphql":{"reset":1}}}`, reset.Unix())},
	})

	_, err := r.REST(t.Context(), "GET", "repos/o/n/deployments", "")
	if !errors.Is(err, gh.ErrRateLimited) {
		t.Fatalf("REST() = %v, want ErrRateLimited", err)
	}
	var limitErr *gh.RateLimitError
	if !errors.As(err, &limitErr) {
		t.Fatalf("REST() = %v, want *RateLimitError", err)
	}
	if !limitErr.ResetAt.Equal(reset) {
		t.Errorf("ResetAt = %v, want %v", limitErr.ResetAt, reset)
	}
	if calls := fake.Calls(t); len(calls) != 2 || calls[1].Args != "api rate_limit" {
		t.Errorf("calls = %+v, want the call and then api rate_limit", calls)
	}
}

func TestRESTReportsAGhThatNeedsAuthentication(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"api": {Stderr: "To get started with GitHub CLI, please run:  gh auth login", Exit: 4}})

	_, err := r.REST(t.Context(), "GET", "repos/o/n/deployments", "")
	if !errors.Is(err, gh.ErrNotAuthenticated) {
		t.Errorf("REST() = %v, want ErrNotAuthenticated", err)
	}
}

func TestAPIMessage(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name string
		err  *gh.Error
		want string
	}{
		{
			name: "message alone",
			err:  &gh.Error{Stdout: `{"message":"Merge conflict"}`, Output: "gh: Merge conflict (HTTP 409)"},
			want: "Merge conflict",
		},
		{
			name: "message and errors",
			err: &gh.Error{
				Stdout: `{"message":"Validation Failed","errors":[{"message":"No commits between main and dev"},{"message":"Other"}]}`,
				Output: "gh: Validation Failed (HTTP 422)",
			},
			want: "Validation Failed; No commits between main and dev; Other",
		},
		{
			name: "no JSON",
			err:  &gh.Error{Stdout: "", Output: "gh: connection refused"},
			want: "gh: connection refused",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := gh.APIMessage(fmt.Errorf("wrapped: %w", tt.err)); got != tt.want {
				t.Errorf("APIMessage() = %q, want %q", got, tt.want)
			}
		})
	}
}
