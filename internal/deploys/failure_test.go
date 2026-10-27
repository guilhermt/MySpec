package deploys_test

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/deploys"
	"github.com/guilhermt/myspec/internal/gh"
)

func TestFailureOfClassifiesWhatGhReturned(t *testing.T) {
	t.Parallel()

	reset := time.Date(2026, 9, 16, 14, 30, 0, 0, time.Local)
	tests := []struct {
		name string
		err  error
		want deploys.Failure
	}{
		{"gh missing", fmt.Errorf("%w: exec", gh.ErrNotFound), deploys.Failure{Reason: deploys.ReasonGHMissing}},
		{"unauthenticated", fmt.Errorf("rest: %w", gh.ErrNotAuthenticated), deploys.Failure{Reason: deploys.ReasonUnauthenticated}},
		{"missing scope", fmt.Errorf("graphql: %w", gh.ErrMissingScope), deploys.Failure{Reason: deploys.ReasonMissingScope}},
		{"no resource", fmt.Errorf("read runs: %w: %w", gh.ErrNoResource, &gh.Error{Output: "HTTP 404"}), deploys.Failure{Reason: deploys.ReasonNotFound}},
		{"rate limited", fmt.Errorf("rest: %w", &gh.RateLimitError{ResetAt: reset}), deploys.Failure{Reason: deploys.ReasonRateLimited, ResetAt: reset}},
		{"gh said something", &gh.Error{Output: "HTTP 502", Err: errors.New("exit status 1")}, deploys.Failure{Reason: deploys.ReasonFailed, Detail: "HTTP 502"}},
		{"gh said nothing", &gh.Error{Args: []string{"api"}, Err: errors.New("exit status 1")}, deploys.Failure{Reason: deploys.ReasonFailed, Detail: "gh api: exit status 1"}},
		{"anything else", errors.New("decode: bad json"), deploys.Failure{Reason: deploys.ReasonFailed, Detail: "decode: bad json"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if diff := cmp.Diff(tt.want, *deploys.FailureOf(tt.err)); diff != "" {
				t.Errorf("FailureOf(%v) (-want +got):\n%s", tt.err, diff)
			}
		})
	}
}

func TestFailureMessageIsWhatTheUserReads(t *testing.T) {
	t.Parallel()

	reset := time.Date(2026, 9, 16, 14, 30, 0, 0, time.Local)
	tests := []struct {
		failure deploys.Failure
		want    string
	}{
		{deploys.Failure{Reason: deploys.ReasonGHMissing}, "GitHub CLI was not found: gh isn't on the PATH."},
		{deploys.Failure{Reason: deploys.ReasonUnauthenticated}, "gh is not authenticated. Run gh auth login."},
		{deploys.Failure{Reason: deploys.ReasonMissingScope}, "gh can't read this repository. Run gh auth refresh -s repo."},
		{deploys.Failure{Reason: deploys.ReasonNotFound}, "The repository doesn't exist or this account can't read it."},
		{deploys.Failure{Reason: deploys.ReasonRateLimited, ResetAt: reset}, "GitHub's rate limit was reached. It resets at 14:30."},
		{deploys.Failure{Reason: deploys.ReasonFailed, Detail: "HTTP 502"}, "Couldn't read from GitHub: HTTP 502"},
	}
	for _, tt := range tests {
		t.Run(string(tt.failure.Reason), func(t *testing.T) {
			t.Parallel()
			if got := tt.failure.Message(); got != tt.want {
				t.Errorf("Message() = %q, want %q", got, tt.want)
			}
			if got, want := tt.failure.Error(), "deploys: "+tt.want; got != want {
				t.Errorf("Error() = %q, want %q", got, want)
			}
		})
	}
}

func TestOnlyTheFailuresOfTheWholeReadingAreGeneral(t *testing.T) {
	t.Parallel()

	general := map[deploys.Reason]bool{
		deploys.ReasonGHMissing:       true,
		deploys.ReasonUnauthenticated: true,
		deploys.ReasonRateLimited:     true,
		deploys.ReasonMissingScope:    false,
		deploys.ReasonNotFound:        false,
		deploys.ReasonFailed:          false,
	}
	for reason, want := range general {
		if got := (&deploys.Failure{Reason: reason}).General(); got != want {
			t.Errorf("General() of %s = %v, want %v", reason, got, want)
		}
	}
}
