package gh

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"
)

// The ways a GraphQL call fails that the app tells apart.
var (
	ErrMissingScope = errors.New("gh: token lacks the read:project scope")
	ErrRateLimited  = errors.New("gh: GitHub rate limit reached")
)

// exitAuth is what gh exits with when the command needs authentication.
const exitAuth = 4

// rateLimitFallback is how long the app assumes a rate limit lasts when gh
// cannot say when it resets.
const rateLimitFallback = time.Hour

// The types of GraphQL error the classification reads.
const (
	typeInsufficientScopes = "INSUFFICIENT_SCOPES"
	typeRateLimited        = "RATE_LIMITED"
	typeNotFound           = "NOT_FOUND"
)

// GraphQLError is one entry of the errors GitHub answered with.
type GraphQLError struct {
	Type    string `json:"type"` // NOT_FOUND, FORBIDDEN, INSUFFICIENT_SCOPES, RATE_LIMITED...
	Message string `json:"message"`
	Path    []any  `json:"path"` // strings and numbers, as GitHub writes them
}

// Response is what a GraphQL query answered: the data, which may be partial,
// and the errors of the parts that failed.
type Response struct {
	Data   json.RawMessage
	Errors []GraphQLError
}

// RateLimitError is ErrRateLimited with the instant the limit resets.
type RateLimitError struct{ ResetAt time.Time }

// Error reads the limit with the instant it resets.
func (e *RateLimitError) Error() string {
	return "gh: GitHub rate limit reached until " + e.ResetAt.Format(time.RFC3339)
}

// Unwrap makes a RateLimitError an ErrRateLimited.
func (e *RateLimitError) Unwrap() error { return ErrRateLimited }

// Vars are the variables of a query: a string goes with -f, an int with -F.
type Vars map[string]any

// GraphQL runs `gh api graphql` with query and vars. Data that came back with
// errors is a Response with a nil error: the caller decides what a missing
// part means. A failure with no data still carries the errors GitHub answered,
// next to the *Error.
func (r *Runner) GraphQL(ctx context.Context, query string, vars Vars) (Response, error) {
	out, err := r.Run(ctx, "", graphQLArgs(query, vars)...)
	if err == nil {
		var resp Response
		if decodeErr := json.Unmarshal([]byte(out), &resp); decodeErr != nil {
			return Response{}, fmt.Errorf("gh api graphql: %w", decodeErr)
		}
		return resp, nil
	}

	if errors.Is(err, ErrNotFound) {
		return Response{}, err
	}
	ghErr, settled := answerOf(err)
	if ghErr == nil {
		return Response{}, settled
	}

	var resp Response
	parsed := json.Unmarshal([]byte(ghErr.Stdout), &resp) == nil
	if hasType(resp.Errors, typeInsufficientScopes) || strings.Contains(ghErr.Output, "read:project") {
		return Response{}, fmt.Errorf("%w: %w", ErrMissingScope, ghErr)
	}
	if hasType(resp.Errors, typeRateLimited) || strings.Contains(strings.ToLower(ghErr.Output), "rate limit") {
		return Response{}, &RateLimitError{ResetAt: r.rateLimitReset(ctx)}
	}
	if parsed && len(resp.Data) > 0 && string(resp.Data) != "null" {
		return resp, nil
	}
	if len(resp.Errors) > 0 {
		return Response{Errors: resp.Errors}, ghErr
	}
	return Response{}, ghErr
}

// graphQLArgs is the command line of a query: the query itself, then the vars
// in sorted key order. A var of any type but string or int is a programming
// error.
func graphQLArgs(query string, vars Vars) []string {
	args := []string{"api", "graphql", "-f", "query=" + query}
	names := make([]string, 0, len(vars))
	for name := range vars {
		names = append(names, name)
	}
	slices.Sort(names)
	for _, name := range names {
		switch value := vars[name].(type) {
		case string:
			args = append(args, "-f", name+"="+value)
		case int:
			args = append(args, "-F", name+"="+strconv.Itoa(value))
		default:
			panic(fmt.Sprintf("gh: GraphQL var %s is a %T, want string or int", name, value))
		}
	}
	return args
}

// HasNotFound reports whether GitHub answered that a part does not exist.
func HasNotFound(errs []GraphQLError) bool { return hasType(errs, typeNotFound) }

// refusalOf is what GitHub refused a call with: the errors it answered that
// are not NOT_FOUND, as an *Error, so the user reads what GitHub wrote. It is
// nil when the answer carries no such error.
func refusalOf(errs []GraphQLError) *Error {
	messages := make([]string, 0, len(errs))
	for _, e := range errs {
		if e.Type == typeNotFound || e.Message == "" {
			continue
		}
		messages = append(messages, e.Message)
	}
	if len(messages) == 0 {
		return nil
	}
	return &Error{Args: []string{"api", "graphql"}, Output: strings.Join(messages, "; ")}
}

// hasType reports whether any of errs is of type kind.
func hasType(errs []GraphQLError, kind string) bool {
	return slices.ContainsFunc(errs, func(e GraphQLError) bool { return e.Type == kind })
}

// rateLimitReset asks gh when the GraphQL limit resets. When gh cannot say,
// the limit is assumed to last rateLimitFallback from now.
func (r *Runner) rateLimitReset(ctx context.Context) time.Time {
	fallback := time.Now().Add(rateLimitFallback)
	out, err := r.Run(ctx, "", "api", "rate_limit")
	if err != nil {
		return fallback
	}
	var body struct {
		Resources struct {
			GraphQL struct {
				Reset int64 `json:"reset"`
			} `json:"graphql"`
		} `json:"resources"`
	}
	if err := json.Unmarshal([]byte(out), &body); err != nil || body.Resources.GraphQL.Reset == 0 {
		return fallback
	}
	return time.Unix(body.Resources.GraphQL.Reset, 0)
}
