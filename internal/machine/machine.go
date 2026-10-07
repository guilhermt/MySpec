// Package machine checks what the app needs of the machine it runs on: Claude
// Code found, logged in and recent enough, and the GitHub CLI found, signed in
// and with the scopes the app uses. It informs and never blocks; nothing of it
// is persisted.
package machine

import (
	"context"
	"log/slog"
	"slices"
	"sync"
	"time"

	"github.com/guilhermt/myspec/internal/claude"
	"github.com/guilhermt/myspec/internal/gh"
)

// ItemID names one item of the check.
type ItemID string

// The items of the check.
const (
	ClaudeFound   ItemID = "claude_found"
	ClaudeLogin   ItemID = "claude_login"
	ClaudeVersion ItemID = "claude_version"
	GHFound       ItemID = "gh_found"
	GHLogin       ItemID = "gh_login"
	GHScopes      ItemID = "gh_scopes"
)

// Order is the order the items are checked and shown in.
var Order = []ItemID{ClaudeFound, ClaudeLogin, ClaudeVersion, GHFound, GHLogin, GHScopes}

// Result is how an item ended.
type Result string

// The ways an item ends.
const (
	OK        Result = "ok"
	Missing   Result = "missing"   // the app knows the item is wrong
	Unchecked Result = "unchecked" // the app could not tell; never a warning
)

// Reason says why an item is unchecked, or, for a missing gh_login, that
// GitHub refused the token.
type Reason string

// The reasons an item is unchecked, or a missing gh_login is invalid_token.
const (
	ReasonNone         Reason = ""
	ReasonDepends      Reason = "depends"       // an item it depends on is not ok
	ReasonTimeout      Reason = "timeout"       // the tool did not answer in time
	ReasonUnreadable   Reason = "unreadable"    // the answer was not understood
	ReasonNoScopes     Reason = "no_scopes"     // the login of gh does not report its scopes
	ReasonFailed       Reason = "failed"        // anything else; Detail says what
	ReasonInvalidToken Reason = "invalid_token" // a missing gh_login: GitHub refused the token
)

// Item is one item of a report.
type Item struct {
	ID     ItemID
	Result Result
	Reason Reason
	Detail string // what the tool said, for failed, unreadable and invalid_token; "" otherwise
}

// RequiredScopes are the scopes of gh the app needs, in the order the
// interface names them: project reads and writes the boards, repo the
// repositories, their issues and pull requests.
var RequiredScopes = []string{"project", "repo"}

// DefaultTimeout is how long each command of a check waits.
const DefaultTimeout = 10 * time.Second

// minVersion is claude.MinVersion, parsed once.
var minVersion = claude.MustParseVersion(claude.MinVersion)

// Report is what one check found.
type Report struct {
	Items         []Item   // one per Order, in order; nil before the first check ends
	ClaudePath    string   // where claude was found; "" when it was not
	ClaudeVersion string   // as "2.1.291"; "" when it was not read
	GHAccount     string   // the login of gh on github.com; "" when unknown
	GHScopes      []string // the scopes of the login; nil when unknown
	MissingScopes []string // of RequiredScopes, the ones the login lacks, in their order; nil when none or unknown
}

// Item is the item of the report with id; the zero Item when the report has none.
func (r Report) Item(id ItemID) Item {
	for _, item := range r.Items {
		if item.ID == id {
			return item
		}
	}
	return Item{}
}

// Missing are the items that are missing, in order.
func (r Report) Missing() []Item {
	var missing []Item
	for _, item := range r.Items {
		if item.Result == Missing {
			missing = append(missing, item)
		}
	}
	return missing
}

// ClaudeUsable reports whether Claude Code was found and is not known to be
// too old, which is what a reading of the catalog of models needs.
func (r Report) ClaudeUsable() bool {
	return r.Item(ClaudeFound).Result == OK && r.Item(ClaudeVersion).Result != Missing
}

// clone copies the slices of r, so nobody changes what the service keeps.
func (r Report) clone() Report {
	r.Items = slices.Clone(r.Items)
	r.GHScopes = slices.Clone(r.GHScopes)
	r.MissingScopes = slices.Clone(r.MissingScopes)
	return r
}

// Claude is what the check asks of Claude Code. internal/app provides it over internal/claude.
type Claude interface {
	Locate() (string, error)
	Preflight(ctx context.Context, binary string) error
	ReadVersion(ctx context.Context, binary string) (claude.Version, error)
}

// GitHub is what the check asks of gh. *gh.Runner is one.
type GitHub interface {
	SignedIn(ctx context.Context) error
	Account(ctx context.Context) (gh.Account, error)
}

// Deps are what the service needs.
type Deps struct {
	Claude   Claude
	GitHub   GitHub
	Log      *slog.Logger
	OnChange func()        // called when a check starts and when it ends
	Timeout  time.Duration // of each command; zero is DefaultTimeout
}

// Status is where the check of the machine stands.
type Status struct {
	Report  Report
	Checked bool // a check ended in this run
	Running bool // a check runs now
	// Notice is whether the notice at the top shows: the first check of the
	// run found something missing, and no check since found nothing missing.
	Notice bool
}

// Service checks the machine and keeps what the last check found.
type Service struct {
	claude   Claude
	github   GitHub
	log      *slog.Logger
	onChange func()
	timeout  time.Duration

	mu      sync.Mutex
	report  Report
	checked bool
	notice  bool
	running *run // the check that runs; nil when none does
}

// run is one check: done closes when it ends, and report is what it found.
type run struct {
	done   chan struct{}
	report Report
}

// New builds the service. Nothing is checked until Check.
func New(deps Deps) *Service {
	log := deps.Log
	if log == nil {
		log = slog.New(slog.DiscardHandler)
	}
	onChange := deps.OnChange
	if onChange == nil {
		onChange = func() {}
	}
	timeout := deps.Timeout
	if timeout == 0 {
		timeout = DefaultTimeout
	}
	return &Service{
		claude:   deps.Claude,
		github:   deps.GitHub,
		log:      log,
		onChange: onChange,
		timeout:  timeout,
	}
}

// Check checks the machine and returns what it found. A check that already
// runs is joined, never doubled: the caller waits for it and gets its report.
func (s *Service) Check(ctx context.Context) Report {
	s.mu.Lock()
	if r := s.running; r != nil {
		s.mu.Unlock()
		<-r.done
		return r.report.clone()
	}
	r := &run{done: make(chan struct{})}
	s.running = r
	s.mu.Unlock()
	s.onChange()

	report := s.check(ctx)

	s.mu.Lock()
	s.report = report
	if !s.checked {
		s.notice = len(report.Missing()) > 0
	} else if len(report.Missing()) == 0 {
		s.notice = false
	}
	s.checked = true
	s.running = nil
	r.report = report
	s.mu.Unlock()

	close(r.done)
	s.onChange()
	return report.clone()
}

// Status is where the check stands.
func (s *Service) Status() Status {
	s.mu.Lock()
	defer s.mu.Unlock()

	return Status{
		Report:  s.report.clone(),
		Checked: s.checked,
		Running: s.running != nil,
		Notice:  s.notice,
	}
}
