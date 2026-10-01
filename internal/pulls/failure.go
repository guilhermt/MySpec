package pulls

import (
	"errors"
	"time"

	"github.com/guilhermt/myspec/internal/gh"
)

// Reason is why a reading of GitHub failed.
type Reason string

// The reasons a reading of GitHub fails.
const (
	ReasonGHMissing       Reason = "gh_missing"
	ReasonUnauthenticated Reason = "gh_unauthenticated"
	ReasonMissingScope    Reason = "missing_scope"
	ReasonNotFound        Reason = "not_found"
	ReasonRateLimited     Reason = "rate_limited"
	ReasonFailed          Reason = "failed"
)

// Failure is a reading of GitHub that failed, with what the user reads about it.
type Failure struct {
	Reason  Reason    `json:"reason"`
	Detail  string    `json:"detail"`  // failed: what gh said
	ResetAt time.Time `json:"resetAt"` // rate_limited
	// FailedAt is the first failing reading of the run of failures.
	FailedAt time.Time `json:"failedAt"`
}

func (f *Failure) Error() string { return "pulls: " + f.Message() }

// Message is the failure as the interface shows it.
func (f *Failure) Message() string {
	switch f.Reason {
	case ReasonGHMissing:
		return "GitHub CLI was not found: gh isn't on the PATH."
	case ReasonUnauthenticated:
		return "gh is not authenticated. Run gh auth login."
	case ReasonMissingScope:
		return "gh can't read this repository. Run gh auth refresh -s repo."
	case ReasonNotFound:
		return "The repository doesn't exist or this account can't read its pull requests."
	case ReasonRateLimited:
		return "GitHub's rate limit was reached. It resets at " + f.ResetAt.Local().Format("15:04") + "."
	default:
		return "Couldn't read from GitHub: " + f.Detail
	}
}

// FailureOf classifies what a gh call returned.
func FailureOf(err error) *Failure {
	var rateErr *gh.RateLimitError
	var ghErr *gh.Error
	switch {
	case errors.Is(err, gh.ErrNotFound):
		return &Failure{Reason: ReasonGHMissing}
	case errors.Is(err, gh.ErrNotAuthenticated):
		return &Failure{Reason: ReasonUnauthenticated}
	case errors.Is(err, gh.ErrMissingScope):
		return &Failure{Reason: ReasonMissingScope}
	case errors.As(err, &rateErr):
		return &Failure{Reason: ReasonRateLimited, ResetAt: rateErr.ResetAt}
	case errors.As(err, &ghErr) && ghErr.Output != "":
		return &Failure{Reason: ReasonFailed, Detail: ghErr.Output}
	default:
		return &Failure{Reason: ReasonFailed, Detail: err.Error()}
	}
}
