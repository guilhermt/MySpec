package board

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/gh"
)

func TestFailureOfClassifiesWhatGhReturned(t *testing.T) {
	t.Parallel()

	reset := time.Date(2026, 9, 16, 14, 30, 0, 0, time.Local)
	tests := []struct {
		name string
		err  error
		want Failure
	}{
		{"gh missing", fmt.Errorf("%w: exec", gh.ErrNotFound), Failure{Reason: ReasonGHMissing}},
		{"unauthenticated", fmt.Errorf("graphql: %w", gh.ErrNotAuthenticated), Failure{Reason: ReasonUnauthenticated}},
		{"missing scope", fmt.Errorf("graphql: %w", gh.ErrMissingScope), Failure{Reason: ReasonMissingScope}},
		{"rate limited", fmt.Errorf("graphql: %w", &gh.RateLimitError{ResetAt: reset}), Failure{Reason: ReasonRateLimited, ResetAt: reset}},
		{"gh said something", &gh.Error{Output: "HTTP 502", Err: errors.New("exit status 1")}, Failure{Reason: ReasonFailed, Detail: "HTTP 502"}},
		{"gh said nothing", &gh.Error{Args: []string{"api"}, Err: errors.New("exit status 1")}, Failure{Reason: ReasonFailed, Detail: "gh api: exit status 1"}},
		{"anything else", errors.New("decode: bad json"), Failure{Reason: ReasonFailed, Detail: "decode: bad json"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if diff := cmp.Diff(tt.want, *failureOf(tt.err)); diff != "" {
				t.Errorf("failureOf(%v) (-want +got):\n%s", tt.err, diff)
			}
		})
	}
}

func TestFailureMessageIsWhatTheUserReads(t *testing.T) {
	t.Parallel()

	reset := time.Date(2026, 9, 16, 14, 30, 0, 0, time.Local)
	tests := []struct {
		failure Failure
		want    string
	}{
		{Failure{Reason: ReasonGHMissing}, "GitHub CLI was not found: gh isn't on the PATH."},
		{Failure{Reason: ReasonUnauthenticated}, "gh is not authenticated. Run gh auth login."},
		{Failure{Reason: ReasonMissingScope}, "gh can't read projects. Run gh auth refresh -s read:project."},
		{Failure{Reason: ReasonNotFound}, "The board doesn't exist or this account can't read it. Check the number and that this account can see the project."},
		{Failure{Reason: ReasonRateLimited, ResetAt: reset}, "GitHub's rate limit was reached. It resets at 14:30."},
		{Failure{Reason: ReasonFailed, Detail: "HTTP 502"}, "Couldn't read from GitHub: HTTP 502"},
	}
	for _, tt := range tests {
		t.Run(string(tt.failure.Reason), func(t *testing.T) {
			t.Parallel()
			if got := tt.failure.Message(); got != tt.want {
				t.Errorf("Message() = %q, want %q", got, tt.want)
			}
			if got, want := tt.failure.Error(), "board: "+tt.want; got != want {
				t.Errorf("Error() = %q, want %q", got, want)
			}
		})
	}
}
