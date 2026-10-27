package gh

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

// ErrNoResource is a REST call GitHub answered 404 to: the repository, the
// workflow or the pull request is not there, or the account can't see it.
var ErrNoResource = errors.New("gh: GitHub answered not found")

// REST runs `gh api` with method on endpoint, sending body as JSON on stdin when
// it is not "", and returns what GitHub answered. A rate limit is a
// *RateLimitError with the instant the core limit resets; a 404 is
// ErrNoResource over the *Error; a missing login is ErrNotAuthenticated.
func (r *Runner) REST(ctx context.Context, method, endpoint, body string) (string, error) {
	args := []string{"api", "--method", method, endpoint}
	if body != "" {
		args = append(args, "--input", "-")
	}
	out, err := r.RunInput(ctx, "", body, args...)
	if err == nil {
		return out, nil
	}

	ghErr, settled := answerOf(err)
	if ghErr == nil {
		return "", settled
	}
	if strings.Contains(strings.ToLower(ghErr.Output), "rate limit") || strings.Contains(strings.ToLower(messageOf(ghErr.Stdout)), "rate limit") {
		return "", &RateLimitError{ResetAt: r.rateLimitReset(ctx, "core")}
	}
	if strings.Contains(ghErr.Output, "(HTTP 404)") {
		return "", fmt.Errorf("%w: %w", ErrNoResource, ghErr)
	}
	return "", ghErr
}

// APIMessage is what GitHub said about a failed REST call: the message of the
// JSON gh wrote on stdout, followed by the message of each entry of its errors,
// joined by "; ". It falls back to what gh printed when stdout holds no JSON.
func APIMessage(err error) string {
	var ghErr *Error
	if !errors.As(err, &ghErr) {
		return err.Error()
	}
	var body struct {
		Message string `json:"message"`
		Errors  []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}
	if json.Unmarshal([]byte(ghErr.Stdout), &body) != nil {
		return ghErr.Output
	}
	var parts []string
	if body.Message != "" {
		parts = append(parts, body.Message)
	}
	for _, e := range body.Errors {
		if e.Message != "" {
			parts = append(parts, e.Message)
		}
	}
	if len(parts) == 0 {
		return ghErr.Output
	}
	return strings.Join(parts, "; ")
}

// messageOf is the message of the JSON gh wrote on stdout, "" when there is none.
func messageOf(stdout string) string {
	var body struct {
		Message string `json:"message"`
	}
	if json.Unmarshal([]byte(stdout), &body) != nil {
		return ""
	}
	return body.Message
}
