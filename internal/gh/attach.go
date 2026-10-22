package gh

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// MaxAttachments is the most files one issue create or issue edit attaches.
const MaxAttachments = 50

// AttachFailure is why gh didn't upload an attachment.
type AttachFailure string

// The reasons an attachment is not uploaded.
const (
	AttachNoWrite     AttachFailure = "no_write"     // the account can't write to the repository
	AttachRefused     AttachFailure = "refused"      // GitHub refused the file
	AttachRateLimited AttachFailure = "rate_limited" // GitHub's rate limit
	AttachNetwork     AttachFailure = "network"      // the request didn't reach GitHub
	AttachOther       AttachFailure = "other"        // anything else gh said
)

// AttachError is an issue create or issue edit with --attach that failed.
// Written says gh wrote the issue anyway, with the attachments that uploaded
// before the failure: URL is the issue, which gh printed.
type AttachError struct {
	Path    string // the --attach that failed, as passed; "" when gh names none
	Failure AttachFailure
	Detail  string // what gh said after the path
	Written bool
	URL     string
	Err     *Error
}

// Error reads "gh: attach <path>: <detail>", without the path when gh names none.
func (e *AttachError) Error() string {
	if e.Path == "" {
		return "gh: attach: " + e.Detail
	}
	return "gh: attach " + e.Path + ": " + e.Detail
}

// Unwrap gives up the gh error underneath.
func (e *AttachError) Unwrap() error { return e.Err }

const noWriteStatement = "attaching files requires write access"

var (
	issueURLPattern = regexp.MustCompile(`https://github\.com/[^/\s]+/[^/\s]+/issues/\d+`)
	uploadPattern   = regexp.MustCompile(`(?m)^(could not|failed to) upload (\S+): (.+)$`)
	issueURLNumber  = regexp.MustCompile(`/issues/(\d+)(?:[/?#].*)?$`)
)

// CreateIssueAttached creates an issue in repo (owner/name) with title and body,
// attaching files, paths relative to dir, which is where gh runs. It answers the
// url of the issue.
func (r *Runner) CreateIssueAttached(ctx context.Context, dir, repo, title, body string, files []string) (string, error) {
	args := []string{"issue", "create", "--repo", repo, "--title", title, "--body-file", "-"}
	out, err := r.RunInput(ctx, dir, body, withAttachments(args, files)...)
	if err != nil {
		return "", attachErrorOf(err)
	}
	url := issueURLPattern.FindString(out)
	if url == "" {
		return "", fmt.Errorf("gh: issue create printed no issue url: %q", out)
	}
	return url, nil
}

// EditIssueAttached rewrites the body of an issue, and its title when title
// isn't "", attaching files as CreateIssueAttached does.
func (r *Runner) EditIssueAttached(ctx context.Context, dir, repo string, number int, title, body string, files []string) error {
	args := []string{"issue", "edit", strconv.Itoa(number), "--repo", repo}
	if title != "" {
		args = append(args, "--title", title)
	}
	args = append(args, "--body-file", "-")
	if _, err := r.RunInput(ctx, dir, body, withAttachments(args, files)...); err != nil {
		return attachErrorOf(err)
	}
	return nil
}

func withAttachments(args, files []string) []string {
	for _, f := range files {
		args = append(args, "--attach", f)
	}
	return args
}

// IssueBody is the Markdown body of an issue, by node id.
func (r *Runner) IssueBody(ctx context.Context, issueID string) (string, error) {
	const query = `query($id: ID!) { node(id: $id) { ... on Issue { body } } }`
	resp, err := r.GraphQL(ctx, query, Vars{"id": issueID})
	if HasNotFound(resp.Errors) {
		return "", fmt.Errorf("%w: issue %s", ErrNoSuchNode, issueID)
	}
	if err != nil {
		return "", err
	}
	var data struct {
		Node *struct {
			Body string `json:"body"`
		} `json:"node"`
	}
	if len(resp.Data) > 0 {
		if err := json.Unmarshal(resp.Data, &data); err != nil {
			return "", fmt.Errorf("gh: decode issue body: %w", err)
		}
	}
	if data.Node == nil {
		return "", fmt.Errorf("%w: issue %s", ErrNoSuchNode, issueID)
	}
	return data.Node.Body, nil
}

// IssueNumber is the number of an issue from its url; 0 when the url names none.
func IssueNumber(url string) int {
	m := issueURLNumber.FindStringSubmatch(url)
	if m == nil {
		return 0
	}
	n, err := strconv.Atoi(m[1])
	if err != nil {
		return 0
	}
	return n
}

// attachErrorOf classifies the failure of an issue create or issue edit with
// --attach: an *AttachError when gh named the upload or wrote the issue anyway.
func attachErrorOf(err error) error {
	var ghErr *Error
	if !errors.As(err, &ghErr) {
		return err
	}
	if errors.Is(ghErr.Err, context.Canceled) || errors.Is(ghErr.Err, context.DeadlineExceeded) {
		return err
	}
	url := issueURLPattern.FindString(ghErr.Stdout)
	attach := &AttachError{Written: url != "", URL: url, Err: ghErr}

	if m := uploadPattern.FindStringSubmatch(ghErr.Output); m != nil {
		attach.Path, attach.Detail = m[2], m[3]
		switch {
		case strings.Contains(attach.Detail, "requires write access"):
			attach.Failure = AttachNoWrite
		case strings.Contains(attach.Detail, "rate limited"):
			attach.Failure = AttachRateLimited
		case m[1] == "failed to":
			attach.Failure = AttachNetwork
		default:
			attach.Failure = AttachRefused
		}
		return attach
	}
	if strings.Contains(ghErr.Output, noWriteStatement) {
		attach.Failure, attach.Detail = AttachNoWrite, noWriteStatement
		return attach
	}
	if attach.Written {
		attach.Failure, attach.Detail = AttachOther, ghErr.Output
		return attach
	}
	if ghErr.ExitCode == exitAuth {
		return fmt.Errorf("%w: %w", ErrNotAuthenticated, ghErr)
	}
	return err
}
