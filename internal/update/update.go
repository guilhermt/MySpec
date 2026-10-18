// Package update finds out whether a newer release of MySpec is published and
// installs it: it reads the public releases of the repository on GitHub,
// without gh and without a token, compares them with the installed version and
// installs the newest by the install script of the main branch, the one the
// install command of the README runs. It keeps in memory what the last
// successful check found and where the installation stands; nothing of it is
// persisted.
package update

import (
	"context"
	"errors"
	"log/slog"
	"slices"
	"sync"
	"time"
)

// Release is a published release newer than the installed version.
type Release struct {
	Version     Version
	PublishedAt time.Time
	Notes       string // the body of the release as GitHub has it, markdown; "" when it has none
}

// FailureKind is why a check or an installation failed.
type FailureKind string

// The ways a check fails.
const (
	Offline     FailureKind = "offline"      // GitHub could not be reached: no network, DNS, connection refused or reset
	RateLimited FailureKind = "rate_limited" // GitHub refused the request for the rate limit
	Timeout     FailureKind = "timeout"      // GitHub did not answer within checkTimeout
	Failed      FailureKind = "failed"       // anything else; Detail says what
	Libraries   FailureKind = "libraries"    // an install only: system libraries the new version needs are missing (Linux)
	System      FailureKind = "system"       // an install only: the install script refused the system, as it does in a terminal
	Replace     FailureKind = "replace"      // an install only: a file of MySpec couldn't be replaced
)

// Failure is why a check failed: the kind, and a sentence of what happened.
type Failure struct {
	Kind   FailureKind
	Detail string
}

// Status is where the check for a newer version stands.
type Status struct {
	Installed string    // the version the binary carries, as it carries it: 0.4.0, dev
	Enabled   bool      // Installed is MAJOR.MINOR.PATCH; a build that is not never checks
	Running   bool      // a check runs now
	CheckedAt time.Time // when the last successful check ended; zero before one
	// Newer are the releases newer than Installed, newest first, as the last
	// successful check found them; nil when there are none.
	Newer []Release
	// Failure is why the last check failed, when it was one the user asked
	// for; nil otherwise. Any later check that ends clears it.
	Failure *Failure
	// Install is where the installation of a newer version stands.
	Install Install
}

// Latest is the newest release newer than the installed version; ok is false when there is none.
func (s Status) Latest() (Release, bool) {
	if len(s.Newer) == 0 {
		return Release{}, false
	}
	return s.Newer[0], true
}

// Interval is how long the app waits, after a check ends, before it checks
// again on its own.
const Interval = time.Hour

// tick is how often Run looks at the wall clock to see whether Interval has
// passed: a ticker alone would not count the time the machine slept.
const tick = time.Minute

// checkTimeout bounds one check, every page of it.
const checkTimeout = 20 * time.Second

// Releases reads the releases published on GitHub. *GitHub is one.
type Releases interface {
	// Read returns the published releases that are not drafts or
	// pre-releases and whose tag is vMAJOR.MINOR.PATCH, newer than installed,
	// in any order.
	Read(ctx context.Context, installed Version) ([]Release, error)
}

// Deps are what the service needs.
type Deps struct {
	Installed      string   // the version of the binary: main.version
	Releases       Releases // nil reads GitHub at DefaultBaseURL
	Scripts        Scripts  // nil reads the script from GitHub, as Releases does
	Runner         Runner   // nil runs the script on this system
	Log            *slog.Logger
	OnChange       func()           // called when a check or an installation starts and when it ends
	OnInstalled    func(Install)    // called once a newer version is installed, after OnChange; may be nil
	Now            func() time.Time // nil is time.Now
	Tick           time.Duration    // of Run; zero is tick
	InstallTimeout time.Duration    // bounds one installation; zero is installTimeout
	TempDir        string           // where the script and its result are written; "" is os.TempDir()
}

// Service checks for a newer version and keeps what the last check found.
type Service struct {
	installed      string
	version        Version
	enabled        bool
	releases       Releases
	scripts        Scripts
	runner         Runner
	log            *slog.Logger
	onChange       func()
	onInstalled    func(Install)
	now            func() time.Time
	tick           time.Duration
	installTimeout time.Duration
	tempDir        string

	mu        sync.Mutex
	newer     []Release
	checkedAt time.Time
	failure   *Failure
	lastEnded time.Time // wall clock (Round(0)) of when the last check ended, of any kind and outcome
	running   *run      // the check that runs; nil when none does
	install   Install
}

// run is one check: done closes when it ends; requested is whether the user asked for it.
type run struct {
	done      chan struct{}
	requested bool
}

// New builds the service. Nothing is read until Run or Check.
func New(deps Deps) *Service {
	log := deps.Log
	if log == nil {
		log = slog.New(slog.DiscardHandler)
	}
	onChange := deps.OnChange
	if onChange == nil {
		onChange = func() {}
	}
	now := deps.Now
	if now == nil {
		now = time.Now
	}
	interval := deps.Tick
	if interval == 0 {
		interval = tick
	}
	releases, scripts := deps.Releases, deps.Scripts
	switch {
	case releases == nil && scripts == nil:
		github := NewGitHub(GitHubDeps{UserAgent: "MySpec/" + deps.Installed})
		releases, scripts = github, github
	case releases == nil:
		releases = NewGitHub(GitHubDeps{UserAgent: "MySpec/" + deps.Installed})
	case scripts == nil:
		scripts = NewGitHub(GitHubDeps{UserAgent: "MySpec/" + deps.Installed})
	}
	runner := deps.Runner
	if runner == nil {
		runner = scriptRunner{}
	}
	onInstalled := deps.OnInstalled
	if onInstalled == nil {
		onInstalled = func(Install) {}
	}
	timeout := deps.InstallTimeout
	if timeout == 0 {
		timeout = installTimeout
	}
	version, enabled := ParseVersion(deps.Installed)
	return &Service{
		installed:      deps.Installed,
		version:        version,
		enabled:        enabled,
		releases:       releases,
		scripts:        scripts,
		runner:         runner,
		log:            log,
		onChange:       onChange,
		onInstalled:    onInstalled,
		now:            now,
		tick:           interval,
		installTimeout: timeout,
		tempDir:        deps.TempDir,
	}
}

// Check checks for a newer version and returns where the check stands after
// it. A check that already runs is joined, never doubled: the caller waits for
// it, and when the user asked (requested), a failure of that check shows. A
// build that does not check returns at once.
func (s *Service) Check(ctx context.Context, requested bool) Status {
	if !s.enabled {
		return s.Status()
	}

	s.mu.Lock()
	if r := s.running; r != nil {
		r.requested = r.requested || requested
		s.mu.Unlock()
		select {
		case <-r.done:
		case <-ctx.Done():
		}
		return s.Status()
	}
	r := &run{done: make(chan struct{}), requested: requested}
	s.running = r
	s.mu.Unlock()
	s.onChange()

	checkCtx, cancel := context.WithTimeout(ctx, checkTimeout)
	start := s.now()
	found, err := s.releases.Read(checkCtx, s.version)
	cancel()

	// The app closing cuts the check; the deadline of the check is a failure.
	if errors.Is(ctx.Err(), context.Canceled) {
		s.mu.Lock()
		s.running = nil
		s.mu.Unlock()
		close(r.done)
		return s.Status()
	}

	var failure Failure
	s.mu.Lock()
	newer := newest(found, s.version)
	if err == nil {
		s.newer = newer
		s.checkedAt = s.now()
		s.failure = nil
	} else {
		failure = classify(err)
		s.failure = nil
		if r.requested {
			s.failure = &failure
		}
	}
	s.lastEnded = s.now().Round(0)
	s.running = nil
	requested = r.requested
	s.mu.Unlock()

	close(r.done)
	s.logCheck(newer, failure, err, requested, s.now().Sub(start))
	s.onChange()
	return s.Status()
}

// logCheck records how a check ended.
func (s *Service) logCheck(newer []Release, failure Failure, err error, requested bool, took time.Duration) {
	ms := took.Milliseconds()
	if err != nil {
		s.log.Warn("update check failed", "installed", s.installed, "kind", string(failure.Kind), "requested", requested, "duration_ms", ms, "error", err)
		return
	}
	latest := ""
	if len(newer) > 0 {
		latest = newer[0].Version.String()
	}
	s.log.Info("update checked", "installed", s.installed, "latest", latest, "newer", len(newer), "requested", requested, "duration_ms", ms)
}

// newest keeps the releases newer than installed, newest first, without
// repeated versions; nil when none is left. It does not trust the reader: a
// release that was deleted or came out of order never becomes a newer version.
func newest(found []Release, installed Version) []Release {
	var kept []Release
	for _, r := range found {
		if installed.Less(r.Version) {
			kept = append(kept, r)
		}
	}
	if len(kept) == 0 {
		return nil
	}
	slices.SortFunc(kept, func(a, b Release) int { return b.Version.compare(a.Version) })
	return slices.CompactFunc(kept, func(a, b Release) bool { return a.Version == b.Version })
}

// Run checks now, then again whenever Interval has passed since the last
// check ended, until ctx ends. It reads the wall clock at every tick, so a
// machine that wakes from sleep after the hour checks at once. An automatic
// check never joins one that runs. A build that does not check returns at once.
func (s *Service) Run(ctx context.Context) {
	if !s.enabled {
		return
	}
	s.Check(ctx, false)

	ticker := time.NewTicker(s.tick)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
		s.mu.Lock()
		// Round(0) drops the monotonic reading, which does not count the time the machine slept.
		due := s.running == nil && s.now().Round(0).Sub(s.lastEnded) >= Interval
		s.mu.Unlock()
		if due {
			s.Check(ctx, false)
		}
	}
}

// Status is where the check stands.
func (s *Service) Status() Status {
	s.mu.Lock()
	defer s.mu.Unlock()

	status := Status{
		Installed: s.installed,
		Enabled:   s.enabled,
		Running:   s.running != nil,
		CheckedAt: s.checkedAt,
		Newer:     slices.Clone(s.newer),
		Install:   cloneInstall(s.install),
	}
	if s.failure != nil {
		f := *s.failure
		status.Failure = &f
	}
	return status
}
