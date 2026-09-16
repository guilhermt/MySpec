package gh_test

import (
	"errors"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/gh/ghtest"
)

// query is a query the tests send; the fake does not read it.
const query = "query { viewer { login } }"

func TestGraphQLReturnsTheData(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"api": {Stdout: `{"data":{"viewer":{"login":"someone"}}}`}})

	got, err := r.GraphQL(t.Context(), query, nil)
	if err != nil {
		t.Fatalf("GraphQL() = %v, want nil", err)
	}
	if string(got.Data) != `{"viewer":{"login":"someone"}}` {
		t.Errorf("Data = %s, want the data GitHub answered", got.Data)
	}
	if len(got.Errors) != 0 {
		t.Errorf("Errors = %+v, want none", got.Errors)
	}
}

func TestGraphQLReturnsPartialDataWithTheErrorsOfTheMissingParts(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"api": {
		Stdout: `{"data":{"a":{"number":1},"b":null},` +
			`"errors":[{"type":"NOT_FOUND","message":"Could not resolve to an Issue with the number of 2.","path":["b",0]}]}`,
		Stderr: "gh: Could not resolve to an Issue with the number of 2.",
		Exit:   1,
	}})

	got, err := r.GraphQL(t.Context(), query, nil)
	if err != nil {
		t.Fatalf("GraphQL() = %v, want nil for partial data", err)
	}
	if string(got.Data) != `{"a":{"number":1},"b":null}` {
		t.Errorf("Data = %s, want the partial data", got.Data)
	}
	want := []gh.GraphQLError{{
		Type:    "NOT_FOUND",
		Message: "Could not resolve to an Issue with the number of 2.",
		Path:    []any{"b", float64(0)},
	}}
	if diff := cmp.Diff(want, got.Errors); diff != "" {
		t.Errorf("Errors mismatch (-want +got):\n%s", diff)
	}
}

func TestGraphQLReportsAGhThatNeedsAuthentication(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"api": {Stderr: "To get started with GitHub CLI, please run:  gh auth login", Exit: 4}})

	_, err := r.GraphQL(t.Context(), query, nil)
	if !errors.Is(err, gh.ErrNotAuthenticated) {
		t.Errorf("GraphQL() = %v, want ErrNotAuthenticated", err)
	}
}

func TestGraphQLReportsATokenWithoutTheProjectScope(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"api": {
		Stdout: `{"errors":[{"type":"INSUFFICIENT_SCOPES","message":"Your token has not been granted the required scopes."}]}`,
		Stderr: "gh: Your token has not been granted the required scopes.",
		Exit:   1,
	}})

	_, err := r.GraphQL(t.Context(), query, nil)
	if !errors.Is(err, gh.ErrMissingScope) {
		t.Errorf("GraphQL() = %v, want ErrMissingScope", err)
	}
}

func TestGraphQLReportsTheRateLimitWithAResetWhenGhCannotSayOne(t *testing.T) {
	t.Parallel()
	// The fake answers api rate_limit with the same failure, so the reset
	// time falls back to an hour from now.
	r, fake := runner(t, map[string]ghtest.Reply{"api": {
		Stdout: `{"data":null,"errors":[{"type":"RATE_LIMITED","message":"API rate limit exceeded"}]}`,
		Stderr: "gh: API rate limit exceeded",
		Exit:   1,
	}})

	before := time.Now()
	_, err := r.GraphQL(t.Context(), query, nil)
	if !errors.Is(err, gh.ErrRateLimited) {
		t.Fatalf("GraphQL() = %v, want ErrRateLimited", err)
	}
	var limitErr *gh.RateLimitError
	if !errors.As(err, &limitErr) {
		t.Fatalf("GraphQL() = %v, want *RateLimitError", err)
	}
	if limitErr.ResetAt.Before(before.Add(time.Hour)) || limitErr.ResetAt.After(time.Now().Add(time.Hour)) {
		t.Errorf("ResetAt = %v, want an hour from now", limitErr.ResetAt)
	}
	if calls := fake.Calls(t); len(calls) != 2 || calls[1].Args != "api rate_limit" {
		t.Errorf("calls = %+v, want the query and then api rate_limit", calls)
	}
}

func TestGraphQLPassesTheVarsInSortedOrder(t *testing.T) {
	t.Parallel()
	r, fake := runner(t, map[string]ghtest.Reply{"api": {Stdout: `{"data":{}}`}})

	vars := gh.Vars{"owner": "acme", "number": 7, "after": "abc"}
	if _, err := r.GraphQL(t.Context(), query, vars); err != nil {
		t.Fatalf("GraphQL() = %v, want nil", err)
	}
	calls := fake.Calls(t)
	want := "api graphql -f query=" + query + " -f after=abc -F number=7 -f owner=acme"
	if len(calls) != 1 || calls[0].Args != want {
		t.Errorf("calls = %+v, want %q", calls, want)
	}
}
