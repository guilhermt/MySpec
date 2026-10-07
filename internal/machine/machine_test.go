package machine_test

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"testing"
	"testing/synctest"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/claude"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/machine"
)

// items builds the six items of a report: every one ok, then the changes.
func items(changes ...machine.Item) []machine.Item {
	out := make([]machine.Item, len(machine.Order))
	for i, id := range machine.Order {
		out[i] = machine.Item{ID: id, Result: machine.OK}
	}
	for _, change := range changes {
		for i := range out {
			if out[i].ID == change.ID {
				out[i] = change
			}
		}
	}
	return out
}

func depends(id machine.ItemID) machine.Item {
	return machine.Item{ID: id, Result: machine.Unchecked, Reason: machine.ReasonDepends}
}

func TestCheckFindsEverythingInPlace(t *testing.T) {
	t.Parallel()

	s := newService(t, goodClaude(), goodGitHub())

	got := s.Check(context.Background())

	want := machine.Report{
		Items:         items(),
		ClaudePath:    "/usr/bin/claude",
		ClaudeVersion: "2.1.291",
		GHAccount:     "octocat",
		GHScopes:      []string{"gist", "project", "read:org", "repo"},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("Check() mismatch (-want +got):\n%s", diff)
	}
}

func TestCheckClaudeChain(t *testing.T) {
	t.Parallel()

	errBoom := errors.New("boom")
	tests := []struct {
		name          string
		claude        func() *fakeClaude
		want          []machine.Item
		wantPath      string
		wantVersion   string
		wantNoCalls   bool
		wantUsable    bool
		wantPreflight int
	}{
		{
			name: "not found",
			claude: func() *fakeClaude {
				c := goodClaude()
				c.path, c.locateErr = "", claude.ErrNotFound
				return c
			},
			want: items(
				machine.Item{ID: machine.ClaudeFound, Result: machine.Missing},
				depends(machine.ClaudeLogin), depends(machine.ClaudeVersion),
			),
			wantNoCalls: true,
		},
		{
			name: "locate fails",
			claude: func() *fakeClaude {
				c := goodClaude()
				c.path, c.locateErr = "", errBoom
				return c
			},
			want: items(
				machine.Item{ID: machine.ClaudeFound, Result: machine.Unchecked, Reason: machine.ReasonFailed, Detail: "boom"},
				depends(machine.ClaudeLogin), depends(machine.ClaudeVersion),
			),
			wantNoCalls: true,
		},
		{
			name: "not logged in",
			claude: func() *fakeClaude {
				c := goodClaude()
				c.preflightErr = fmt.Errorf("auth status: %w", claude.ErrNotLoggedIn)
				return c
			},
			want:        items(machine.Item{ID: machine.ClaudeLogin, Result: machine.Missing}),
			wantPath:    "/usr/bin/claude",
			wantVersion: "2.1.291",
			wantUsable:  true,
		},
		{
			name: "preflight fails",
			claude: func() *fakeClaude {
				c := goodClaude()
				c.preflightErr = errBoom
				return c
			},
			want: items(machine.Item{
				ID: machine.ClaudeLogin, Result: machine.Unchecked, Reason: machine.ReasonFailed, Detail: "boom",
			}),
			wantPath:    "/usr/bin/claude",
			wantVersion: "2.1.291",
			wantUsable:  true,
		},
		{
			name: "preflight hangs",
			claude: func() *fakeClaude {
				c := goodClaude()
				c.preflightBlock = make(chan struct{})
				return c
			},
			want: items(machine.Item{
				ID: machine.ClaudeLogin, Result: machine.Unchecked, Reason: machine.ReasonTimeout,
			}),
			wantPath:    "/usr/bin/claude",
			wantVersion: "2.1.291",
			wantUsable:  true,
		},
		{
			name: "older version",
			claude: func() *fakeClaude {
				c := goodClaude()
				c.version = claude.MustParseVersion("2.0.14")
				return c
			},
			want:        items(machine.Item{ID: machine.ClaudeVersion, Result: machine.Missing}),
			wantPath:    "/usr/bin/claude",
			wantVersion: "2.0.14",
		},
		{
			name: "same version",
			claude: func() *fakeClaude {
				c := goodClaude()
				c.version = claude.MustParseVersion("2.1.291")
				return c
			},
			want:        items(),
			wantPath:    "/usr/bin/claude",
			wantVersion: "2.1.291",
			wantUsable:  true,
		},
		{
			name: "newer patch",
			claude: func() *fakeClaude {
				c := goodClaude()
				c.version = claude.MustParseVersion("2.1.300")
				return c
			},
			want:        items(),
			wantPath:    "/usr/bin/claude",
			wantVersion: "2.1.300",
			wantUsable:  true,
		},
		{
			name: "newer major",
			claude: func() *fakeClaude {
				c := goodClaude()
				c.version = claude.MustParseVersion("3.0.0")
				return c
			},
			want:        items(),
			wantPath:    "/usr/bin/claude",
			wantVersion: "3.0.0",
			wantUsable:  true,
		},
		{
			name: "unreadable version",
			claude: func() *fakeClaude {
				c := goodClaude()
				c.versionErr = fmt.Errorf("claude --version: %w: %q", claude.ErrVersionUnreadable, "nonsense")
				return c
			},
			want: items(machine.Item{
				ID: machine.ClaudeVersion, Result: machine.Unchecked, Reason: machine.ReasonUnreadable,
				Detail: `claude --version: claude: unreadable version: "nonsense"`,
			}),
			wantPath:   "/usr/bin/claude",
			wantUsable: true,
		},
		{
			name: "version fails",
			claude: func() *fakeClaude {
				c := goodClaude()
				c.versionErr = errBoom
				return c
			},
			want: items(machine.Item{
				ID: machine.ClaudeVersion, Result: machine.Unchecked, Reason: machine.ReasonFailed, Detail: "boom",
			}),
			wantPath:   "/usr/bin/claude",
			wantUsable: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			c := tt.claude()
			s := newService(t, c, goodGitHub())

			got := s.Check(context.Background())

			if diff := cmp.Diff(tt.want[:3], got.Items[:3]); diff != "" {
				t.Errorf("claude items mismatch (-want +got):\n%s", diff)
			}
			if got.ClaudePath != tt.wantPath || got.ClaudeVersion != tt.wantVersion {
				t.Errorf("ClaudePath, ClaudeVersion = %q, %q, want %q, %q",
					got.ClaudePath, got.ClaudeVersion, tt.wantPath, tt.wantVersion)
			}
			if got.ClaudeUsable() != tt.wantUsable {
				t.Errorf("ClaudeUsable() = %v, want %v", got.ClaudeUsable(), tt.wantUsable)
			}
			if tt.wantNoCalls {
				if _, preflights, reads := c.calls(); preflights != 0 || reads != 0 {
					t.Errorf("Preflight and ReadVersion called %d and %d times, want never", preflights, reads)
				}
			}
		})
	}
}

func TestCheckGitHubChain(t *testing.T) {
	t.Parallel()

	errBoom := errors.New("boom")
	withScopes := func(scopes ...string) *fakeGitHub {
		g := goodGitHub()
		g.account.Scopes = scopes
		return g
	}
	tests := []struct {
		name          string
		github        func() *fakeGitHub
		want          []machine.Item
		wantAccount   string
		wantScopes    []string
		wantMissing   []string
		wantNoAccount bool
	}{
		{
			name: "not installed",
			github: func() *fakeGitHub {
				g := goodGitHub()
				g.signedInErr = gh.ErrNotFound
				return g
			},
			want: items(
				machine.Item{ID: machine.GHFound, Result: machine.Missing},
				depends(machine.GHLogin), depends(machine.GHScopes),
			),
			wantNoAccount: true,
		},
		{
			name: "not signed in",
			github: func() *fakeGitHub {
				g := goodGitHub()
				g.signedInErr = gh.ErrNotAuthenticated
				return g
			},
			want:          items(machine.Item{ID: machine.GHLogin, Result: machine.Missing}, depends(machine.GHScopes)),
			wantNoAccount: true,
		},
		{
			name: "sign-in check fails",
			github: func() *fakeGitHub {
				g := goodGitHub()
				g.signedInErr = errBoom
				return g
			},
			want: items(
				machine.Item{ID: machine.GHLogin, Result: machine.Unchecked, Reason: machine.ReasonFailed, Detail: "boom"},
				depends(machine.GHScopes),
			),
			wantNoAccount: true,
		},
		{
			name: "token refused",
			github: func() *fakeGitHub {
				g := goodGitHub()
				g.account = gh.Account{}
				g.accountErr = fmt.Errorf("%w: GitHub refused the token", gh.ErrNotAuthenticated)
				return g
			},
			want: items(
				machine.Item{
					ID: machine.GHLogin, Result: machine.Missing, Reason: machine.ReasonInvalidToken,
					Detail: "gh: not authenticated: GitHub refused the token",
				},
				depends(machine.GHScopes),
			),
		},
		{
			name:        "only project missing",
			github:      func() *fakeGitHub { return withScopes("repo") },
			want:        items(machine.Item{ID: machine.GHScopes, Result: machine.Missing}),
			wantAccount: "octocat",
			wantScopes:  []string{"repo"},
			wantMissing: []string{"project"},
		},
		{
			name:        "only repo missing",
			github:      func() *fakeGitHub { return withScopes("project", "gist") },
			want:        items(machine.Item{ID: machine.GHScopes, Result: machine.Missing}),
			wantAccount: "octocat",
			wantScopes:  []string{"project", "gist"},
			wantMissing: []string{"repo"},
		},
		{
			name:        "both missing",
			github:      func() *fakeGitHub { return withScopes("gist") },
			want:        items(machine.Item{ID: machine.GHScopes, Result: machine.Missing}),
			wantAccount: "octocat",
			wantScopes:  []string{"gist"},
			wantMissing: []string{"project", "repo"},
		},
		{
			name:        "read:project is not project",
			github:      func() *fakeGitHub { return withScopes("read:project", "repo") },
			want:        items(machine.Item{ID: machine.GHScopes, Result: machine.Missing}),
			wantAccount: "octocat",
			wantScopes:  []string{"read:project", "repo"},
			wantMissing: []string{"project"},
		},
		{
			name: "login without scopes",
			github: func() *fakeGitHub {
				return withScopes()
			},
			want: items(machine.Item{
				ID: machine.GHScopes, Result: machine.Unchecked, Reason: machine.ReasonNoScopes,
			}),
			wantAccount: "octocat",
		},
		{
			name: "unverified",
			github: func() *fakeGitHub {
				g := goodGitHub()
				g.account = gh.Account{}
				g.accountErr = fmt.Errorf("%w: connection refused", gh.ErrUnverified)
				return g
			},
			want: items(machine.Item{
				ID: machine.GHScopes, Result: machine.Unchecked, Reason: machine.ReasonFailed,
				Detail: "gh: GitHub did not confirm the login: connection refused",
			}),
		},
		{
			name: "account hangs",
			github: func() *fakeGitHub {
				g := goodGitHub()
				g.accountBlock = make(chan struct{})
				return g
			},
			want: items(machine.Item{
				ID: machine.GHScopes, Result: machine.Unchecked, Reason: machine.ReasonTimeout,
			}),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			g := tt.github()
			s := newService(t, goodClaude(), g)

			got := s.Check(context.Background())

			if diff := cmp.Diff(tt.want[3:], got.Items[3:]); diff != "" {
				t.Errorf("gh items mismatch (-want +got):\n%s", diff)
			}
			if got.GHAccount != tt.wantAccount {
				t.Errorf("GHAccount = %q, want %q", got.GHAccount, tt.wantAccount)
			}
			if diff := cmp.Diff(tt.wantScopes, got.GHScopes); diff != "" {
				t.Errorf("GHScopes mismatch (-want +got):\n%s", diff)
			}
			if diff := cmp.Diff(tt.wantMissing, got.MissingScopes); diff != "" {
				t.Errorf("MissingScopes mismatch (-want +got):\n%s", diff)
			}
			if tt.wantNoAccount && g.accountCalls() != 0 {
				t.Errorf("Account called %d times, want never", g.accountCalls())
			}
		})
	}
}

func TestCheckJoinsACheckThatRuns(t *testing.T) {
	t.Parallel()

	synctest.Test(t, func(t *testing.T) {
		c := goodClaude()
		c.locateBlock = make(chan struct{})
		s := newService(t, c, goodGitHub())

		reports := make(chan machine.Report, 2)
		check := func() { reports <- s.Check(context.Background()) }
		go check()
		// The first call waits on Locate, and the second, started only then,
		// waits on the check of the first.
		synctest.Wait()
		go check()
		synctest.Wait()
		close(c.locateBlock)

		first, second := <-reports, <-reports

		if locates, _, _ := c.calls(); locates != 1 {
			t.Errorf("Locate called %d times, want 1", locates)
		}
		if diff := cmp.Diff(first, second); diff != "" {
			t.Errorf("the two reports differ (-first +second):\n%s", diff)
		}
		if got := s.changeCount(); got != 2 {
			t.Errorf("OnChange called %d times, want 2", got)
		}
	})
}

func TestStatusFollowsTheCheck(t *testing.T) {
	t.Parallel()

	c := goodClaude()
	c.locateBlock = make(chan struct{})
	c.locateEntered = make(chan struct{}, 1)
	s := newService(t, c, goodGitHub())

	if got := s.Status(); got.Checked || got.Running || got.Notice || got.Report.Items != nil {
		t.Errorf("Status() before any check = %+v, want the zero status", got)
	}

	done := make(chan struct{})
	go func() {
		defer close(done)
		s.Check(context.Background())
	}()
	<-c.locateEntered

	if got := s.Status(); !got.Running || got.Checked {
		t.Errorf("Status() during the check = Running %v, Checked %v, want true, false", got.Running, got.Checked)
	}
	if got := s.changeCount(); got != 1 {
		t.Errorf("OnChange called %d times at the start, want 1", got)
	}

	close(c.locateBlock)
	<-done

	got := s.Status()
	if got.Running || !got.Checked {
		t.Errorf("Status() after the check = Running %v, Checked %v, want false, true", got.Running, got.Checked)
	}
	if len(got.Report.Items) != len(machine.Order) {
		t.Errorf("Status().Report has %d items, want %d", len(got.Report.Items), len(machine.Order))
	}
	if got := s.changeCount(); got != 2 {
		t.Errorf("OnChange called %d times, want 2", got)
	}
}

func TestStatusReturnsACopy(t *testing.T) {
	t.Parallel()

	s := newService(t, goodClaude(), goodGitHub())
	s.Check(context.Background())

	status := s.Status()
	status.Report.Items[0].Result = machine.Missing
	status.Report.GHScopes[0] = "changed"

	again := s.Status()
	if again.Report.Items[0].Result != machine.OK || again.Report.GHScopes[0] != "gist" {
		t.Errorf("Status() changed through a previous one: %+v", again.Report)
	}
}

func TestNotice(t *testing.T) {
	t.Parallel()

	missingClaude := func(c *fakeClaude, _ *fakeGitHub) { c.locateErr, c.path = claude.ErrNotFound, "" }
	missingGH := func(_ *fakeClaude, g *fakeGitHub) { g.signedInErr = gh.ErrNotFound }
	fine := func(*fakeClaude, *fakeGitHub) {}

	tests := []struct {
		name   string
		checks []func(*fakeClaude, *fakeGitHub)
		want   bool
	}{
		{"first with something missing", []func(*fakeClaude, *fakeGitHub){missingClaude}, true},
		{"first with nothing missing", []func(*fakeClaude, *fakeGitHub){fine}, false},
		{"missing after a first with nothing missing", []func(*fakeClaude, *fakeGitHub){fine, missingClaude}, false},
		{"missing, fine, missing again", []func(*fakeClaude, *fakeGitHub){missingClaude, fine, missingClaude}, false},
		{"another thing missing keeps it", []func(*fakeClaude, *fakeGitHub){missingClaude, missingGH}, true},
		{"still missing keeps it", []func(*fakeClaude, *fakeGitHub){missingClaude, missingClaude}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			c, g := goodClaude(), goodGitHub()
			s := newService(t, c, g)
			for _, setup := range tt.checks {
				// Each check starts from a machine in place and breaks what it names.
				c.path, c.locateErr, g.signedInErr = "/usr/bin/claude", nil, nil
				setup(c, g)
				s.Check(context.Background())
			}

			if got := s.Status().Notice; got != tt.want {
				t.Errorf("Notice = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestCheckLogs(t *testing.T) {
	t.Parallel()

	c := goodClaude()
	c.version = claude.MustParseVersion("2.0.14")
	g := goodGitHub()
	g.account.Scopes = []string{"repo"}
	g.signedInErr = nil
	c.preflightErr = errors.New("boom")
	s := newService(t, c, g)

	s.Check(context.Background())

	checked := s.logs.records(t, "machine checked")
	if len(checked) != 1 {
		t.Fatalf("got %d machine checked records, want 1", len(checked))
	}
	want := map[string]any{
		"claude_path":        "/usr/bin/claude",
		"claude_version":     "2.0.14",
		"claude_min_version": claude.MinVersion,
		"gh_account":         "octocat",
		"gh_scopes":          "repo",
		"missing":            "claude_version,gh_scopes",
		"unchecked":          "claude_login:failed",
	}
	for key, value := range want {
		if checked[0][key] != value {
			t.Errorf("machine checked %s = %v, want %v", key, checked[0][key], value)
		}
	}

	unchecked := s.logs.records(t, "machine item unchecked")
	if len(unchecked) != 1 || unchecked[0]["item"] != "claude_login" ||
		unchecked[0]["reason"] != "failed" || unchecked[0]["error"] != "boom" {
		t.Errorf("machine item unchecked records = %v, want one for claude_login", unchecked)
	}
}

func TestCheckLogsAMissingItemWithDetail(t *testing.T) {
	t.Parallel()

	g := goodGitHub()
	g.accountErr = fmt.Errorf("%w: refused", gh.ErrNotAuthenticated)
	s := newService(t, goodClaude(), g)

	s.Check(context.Background())

	missing := s.logs.records(t, "machine item missing")
	if len(missing) != 1 || missing[0]["item"] != "gh_login" || missing[0]["reason"] != "invalid_token" {
		t.Errorf("machine item missing records = %v, want one for gh_login", missing)
	}
}

func TestReportHelpers(t *testing.T) {
	t.Parallel()

	r := machine.Report{Items: items(
		machine.Item{ID: machine.ClaudeLogin, Result: machine.Missing},
		machine.Item{ID: machine.GHScopes, Result: machine.Missing},
	)}

	if got := r.Item(machine.GHScopes).Result; got != machine.Missing {
		t.Errorf("Item(GHScopes).Result = %q, want missing", got)
	}
	if got := (machine.Report{}).Item(machine.GHScopes); got != (machine.Item{}) {
		t.Errorf("Item on an empty report = %+v, want the zero item", got)
	}
	missing := r.Missing()
	ids := make([]machine.ItemID, 0, len(missing))
	for _, item := range missing {
		ids = append(ids, item.ID)
	}
	if want := []machine.ItemID{machine.ClaudeLogin, machine.GHScopes}; !slices.Equal(ids, want) {
		t.Errorf("Missing() = %v, want %v", ids, want)
	}
}
