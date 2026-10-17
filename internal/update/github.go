package update

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"time"
)

// DefaultBaseURL is the GitHub API.
const DefaultBaseURL = "https://api.github.com"

// repository is where MySpec is released.
const repository = "guilhermt/MySpec"

// perPage is how many releases a page asks for, the most GitHub gives.
const perPage = 100

// maxPages bounds how many pages one check reads.
const maxPages = 10

// errUnreadable is a 2xx answer of GitHub that is not the list of releases.
var errUnreadable = errors.New("update: GitHub's answer couldn't be read")

// statusError is an answer of GitHub that is not a 2xx.
type statusError struct {
	status      string
	rateLimited bool
}

func (e *statusError) Error() string {
	return fmt.Sprintf("GitHub answered %s.", e.status)
}

// apiRelease is a release as the REST API of GitHub has it.
type apiRelease struct {
	TagName     string    `json:"tag_name"`
	Draft       bool      `json:"draft"`
	Prerelease  bool      `json:"prerelease"`
	PublishedAt time.Time `json:"published_at"`
	Body        *string   `json:"body"` // null for a release without notes
}

// GitHubDeps are what the reader needs.
type GitHubDeps struct {
	BaseURL   string       // "" is DefaultBaseURL
	Client    *http.Client // nil is a client of its own, over http.DefaultTransport
	UserAgent string       // GitHub refuses a request without one
}

// GitHub reads the releases of MySpec from the public REST API, without a token.
type GitHub struct {
	baseURL   string
	client    *http.Client
	userAgent string
}

// NewGitHub builds the reader.
func NewGitHub(deps GitHubDeps) *GitHub {
	baseURL := deps.BaseURL
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}
	client := deps.Client
	if client == nil {
		// No Timeout of its own: the deadline is the context of the check.
		client = &http.Client{Transport: http.DefaultTransport}
	}
	return &GitHub{baseURL: baseURL, client: client, userAgent: deps.UserAgent}
}

// Read implements Releases.
func (g *GitHub) Read(ctx context.Context, installed Version) ([]Release, error) {
	var newer []Release
	for page := 1; page <= maxPages; page++ {
		releases, reachedInstalled, count, err := g.readPage(ctx, page, installed)
		if err != nil {
			return nil, err
		}
		newer = append(newer, releases...)
		// GitHub lists the releases from the newest to the oldest, so what follows is older.
		if count < perPage || reachedInstalled {
			break
		}
	}
	return newer, nil
}

// readPage reads one page: the releases newer than installed, whether the page
// has a valid release that is not, and how many releases the page had.
func (g *GitHub) readPage(ctx context.Context, page int, installed Version) (newer []Release, reachedInstalled bool, count int, err error) {
	url := fmt.Sprintf("%s/repos/%s/releases?per_page=%d&page=%d", g.baseURL, repository, perPage, page)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, http.NoBody)
	if err != nil {
		return nil, false, 0, fmt.Errorf("build request %s: %w", url, err)
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("User-Agent", g.userAgent)

	resp, err := g.client.Do(req)
	if err != nil {
		return nil, false, 0, fmt.Errorf("read releases: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return nil, false, 0, &statusError{status: resp.Status, rateLimited: isRateLimited(resp)}
	}
	var decoded []apiRelease
	if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
		return nil, false, 0, fmt.Errorf("%w: %w", errUnreadable, err)
	}
	for _, r := range decoded {
		if r.Draft || r.Prerelease {
			continue
		}
		version, ok := parseTag(r.TagName)
		if !ok {
			continue
		}
		if !installed.Less(version) {
			reachedInstalled = true
			continue
		}
		notes := ""
		if r.Body != nil {
			notes = *r.Body
		}
		newer = append(newer, Release{Version: version, PublishedAt: r.PublishedAt, Notes: notes})
	}
	return newer, reachedInstalled, len(decoded), nil
}

// isRateLimited reports whether GitHub refused the request for the rate limit.
func isRateLimited(resp *http.Response) bool {
	switch resp.StatusCode {
	case http.StatusTooManyRequests:
		return true
	case http.StatusForbidden:
		return resp.Header.Get("X-RateLimit-Remaining") == "0" || resp.Header.Get("Retry-After") != ""
	}
	return false
}

// classify says why a check failed.
func classify(err error) Failure {
	var netErr net.Error
	var status *statusError
	var dnsErr *net.DNSError
	var opErr *net.OpError
	switch {
	case errors.Is(err, context.DeadlineExceeded) || (errors.As(err, &netErr) && netErr.Timeout()):
		return Failure{Kind: Timeout, Detail: err.Error()}
	case errors.As(err, &status) && status.rateLimited:
		return Failure{Kind: RateLimited, Detail: err.Error()}
	case errors.As(err, &dnsErr) || errors.As(err, &opErr):
		return Failure{Kind: Offline, Detail: err.Error()}
	case errors.As(err, &status):
		return Failure{Kind: Failed, Detail: err.Error()}
	case errors.Is(err, errUnreadable):
		return Failure{Kind: Failed, Detail: "GitHub's answer couldn't be read."}
	default:
		return Failure{Kind: Failed, Detail: err.Error()}
	}
}
