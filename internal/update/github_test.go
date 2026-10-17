package update_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/update"
)

// apiRelease is a release as the test server writes it.
type apiRelease struct {
	TagName     string    `json:"tag_name"`
	Draft       bool      `json:"draft"`
	Prerelease  bool      `json:"prerelease"`
	PublishedAt time.Time `json:"published_at"`
	Body        *string   `json:"body"`
}

func tagged(tag string) apiRelease {
	body := "notes " + tag
	return apiRelease{TagName: tag, PublishedAt: time.Date(2026, 10, 16, 12, 0, 0, 0, time.UTC), Body: &body}
}

// serve answers every request with the releases as JSON.
func serve(t *testing.T, releases []apiRelease) *httptest.Server {
	t.Helper()

	return serveFunc(t, func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(releases)
	})
}

func serveFunc(t *testing.T, h http.HandlerFunc) *httptest.Server {
	t.Helper()

	ts := httptest.NewServer(h)
	t.Cleanup(ts.Close)
	return ts
}

func reader(ts *httptest.Server) *update.GitHub {
	return update.NewGitHub(update.GitHubDeps{BaseURL: ts.URL, UserAgent: "MySpec/test"})
}

func versions(releases []update.Release) []string {
	got := make([]string, 0, len(releases))
	for _, r := range releases {
		got = append(got, r.Version.String())
	}
	return got
}

func TestReadAsksThePublicAPIWithoutAToken(t *testing.T) {
	t.Parallel()

	var got *http.Request
	ts := serveFunc(t, func(w http.ResponseWriter, r *http.Request) {
		got = r.Clone(r.Context())
		_, _ = w.Write([]byte("[]"))
	})

	if _, err := reader(ts).Read(t.Context(), ver(t, "0.2.0")); err != nil {
		t.Fatalf("Read: %v", err)
	}

	if got.Method != http.MethodGet || got.URL.Path != "/repos/guilhermt/MySpec/releases" {
		t.Errorf("request = %s %s", got.Method, got.URL.Path)
	}
	if q := got.URL.RawQuery; q != "per_page=100&page=1" && q != "page=1&per_page=100" {
		t.Errorf("query = %q, want per_page=100&page=1", q)
	}
	for header, want := range map[string]string{
		"Accept":               "application/vnd.github+json",
		"X-GitHub-Api-Version": "2022-11-28",
		"User-Agent":           "MySpec/test",
	} {
		if v := got.Header.Get(header); v != want {
			t.Errorf("%s = %q, want %q", header, v, want)
		}
	}
	if v := got.Header.Get("Authorization"); v != "" {
		t.Errorf("Authorization = %q, want none", v)
	}
}

func TestReadLeavesOutDraftsPreReleasesAndTagsThatAreNotVersions(t *testing.T) {
	t.Parallel()

	draft, pre := tagged("v0.9.0"), tagged("v0.8.0")
	draft.Draft, pre.Prerelease = true, true
	ts := serve(t, []apiRelease{
		tagged("v0.5.0-rc.1"), tagged("nightly"), tagged("0.7.0"), draft, pre, tagged("v0.4.0"), tagged("v0.3.0"),
	})

	got, err := reader(ts).Read(t.Context(), ver(t, "0.2.0"))
	if err != nil {
		t.Fatalf("Read: %v", err)
	}

	if diff := cmp.Diff([]string{"0.4.0", "0.3.0"}, versions(got)); diff != "" {
		t.Errorf("versions (-want +got):\n%s", diff)
	}
}

func TestReadKeepsTheNotesAsGitHubHasThem(t *testing.T) {
	t.Parallel()

	html := "## What's Changed\n<script>alert(1)</script>\n* a <b>change</b> by @me in #1\n"
	withHTML, without := tagged("v0.4.0"), tagged("v0.3.0")
	withHTML.Body, without.Body = &html, nil
	ts := serve(t, []apiRelease{withHTML, without})

	got, err := reader(ts).Read(t.Context(), ver(t, "0.2.0"))
	if err != nil {
		t.Fatalf("Read: %v", err)
	}

	if len(got) != 2 {
		t.Fatalf("got %d releases, want 2", len(got))
	}
	if got[0].Notes != html {
		t.Errorf("Notes = %q, want %q", got[0].Notes, html)
	}
	if got[1].Notes != "" {
		t.Errorf("Notes of a null body = %q, want empty", got[1].Notes)
	}
	if want := withHTML.PublishedAt; !got[0].PublishedAt.Equal(want) {
		t.Errorf("PublishedAt = %v, want %v", got[0].PublishedAt, want)
	}
}

// pages serves a list of releases in pages of 100 and counts the requests.
func pages(t *testing.T, all []apiRelease) (*httptest.Server, *atomic.Int32) {
	t.Helper()

	var requests atomic.Int32
	ts := serveFunc(t, func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		page, _ := strconv.Atoi(r.URL.Query().Get("page"))
		from := min((page-1)*100, len(all))
		to := min(page*100, len(all))
		_ = json.NewEncoder(w).Encode(all[from:to])
	})
	return ts, &requests
}

// manyReleases is n releases 1.n.0 down to 1.1.0, newest first.
func manyReleases(n int) []apiRelease {
	var all []apiRelease
	for i := n; i >= 1; i-- {
		all = append(all, tagged("v1."+strconv.Itoa(i)+".0"))
	}
	return all
}

func TestReadFollowsThePagesUntilItReachesTheInstalledVersion(t *testing.T) {
	t.Parallel()

	all := manyReleases(150) // the installed 1.20.0 is on page 2
	ts, requests := pages(t, all)

	got, err := reader(ts).Read(t.Context(), ver(t, "1.20.0"))
	if err != nil {
		t.Fatalf("Read: %v", err)
	}

	if len(got) != 130 {
		t.Errorf("got %d releases, want 130", len(got))
	}
	if n := requests.Load(); n != 2 {
		t.Errorf("%d requests, want 2", n)
	}
}

func TestReadStopsAtTheLastPage(t *testing.T) {
	t.Parallel()

	ts, requests := pages(t, manyReleases(150))

	got, err := reader(ts).Read(t.Context(), ver(t, "0.1.0"))
	if err != nil {
		t.Fatalf("Read: %v", err)
	}

	if len(got) != 150 {
		t.Errorf("got %d releases, want 150", len(got))
	}
	if n := requests.Load(); n != 2 {
		t.Errorf("%d requests, want 2", n)
	}
}

func TestReadStopsAtMaxPages(t *testing.T) {
	t.Parallel()

	ts, requests := pages(t, manyReleases(1500))

	got, err := reader(ts).Read(t.Context(), ver(t, "0.1.0"))
	if err != nil {
		t.Fatalf("Read: %v", err)
	}

	if len(got) != 1000 {
		t.Errorf("got %d releases, want 1000", len(got))
	}
	if n := requests.Load(); n != 10 {
		t.Errorf("%d requests, want 10", n)
	}
}

func TestAFailedReadIsClassifiedForTheUser(t *testing.T) {
	t.Parallel()

	status := func(code int, headers map[string]string) http.HandlerFunc {
		return func(w http.ResponseWriter, _ *http.Request) {
			for k, v := range headers {
				w.Header().Set(k, v)
			}
			w.WriteHeader(code)
		}
	}
	tests := []struct {
		name       string
		handler    http.HandlerFunc
		closed     bool
		deadline   time.Duration
		wantKind   update.FailureKind
		wantDetail string
	}{
		{
			name: "403 with no requests left", handler: status(403, map[string]string{"X-RateLimit-Remaining": "0"}),
			wantKind: update.RateLimited, wantDetail: "GitHub answered 403 Forbidden.",
		},
		{
			name: "429", handler: status(429, nil),
			wantKind: update.RateLimited, wantDetail: "GitHub answered 429 Too Many Requests.",
		},
		{
			name: "403 with Retry-After", handler: status(403, map[string]string{"Retry-After": "60"}),
			wantKind: update.RateLimited, wantDetail: "GitHub answered 403 Forbidden.",
		},
		{
			name: "403 for another reason", handler: status(403, nil),
			wantKind: update.Failed, wantDetail: "GitHub answered 403 Forbidden.",
		},
		{name: "a server that is gone", handler: status(200, nil), closed: true, wantKind: update.Offline},
		{
			name: "a server that answers too late", deadline: 30 * time.Millisecond, wantKind: update.Timeout,
			handler: func(_ http.ResponseWriter, r *http.Request) { <-r.Context().Done() },
		},
		{
			name: "500", handler: status(500, nil),
			wantKind: update.Failed, wantDetail: "GitHub answered 500 Internal Server Error.",
		},
		{
			name: "broken JSON", handler: func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte("{not json")) },
			wantKind: update.Failed, wantDetail: "GitHub's answer couldn't be read.",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ts := httptest.NewServer(tt.handler)
			t.Cleanup(ts.Close)
			if tt.closed {
				ts.Close()
			}
			ctx := t.Context()
			if tt.deadline != 0 {
				var cancel func()
				ctx, cancel = context.WithTimeout(ctx, tt.deadline)
				defer cancel()
			}
			svc := update.New(update.Deps{Installed: "0.2.0", Releases: reader(ts)})

			status := svc.Check(ctx, true)

			if status.Failure == nil {
				t.Fatal("the check did not fail")
			}
			if status.Failure.Kind != tt.wantKind {
				t.Errorf("Kind = %q, want %q (%s)", status.Failure.Kind, tt.wantKind, status.Failure.Detail)
			}
			if tt.wantDetail != "" && status.Failure.Detail != tt.wantDetail {
				t.Errorf("Detail = %q, want %q", status.Failure.Detail, tt.wantDetail)
			}
		})
	}
}
