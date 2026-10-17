package update

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

// installTimeout bounds one installation, the download of the package included:
// past it, the script and everything it started are killed.
const installTimeout = 15 * time.Minute

// scriptTimeout bounds the download of the install script.
const scriptTimeout = 30 * time.Second

// maxScriptSize bounds the install script the app accepts.
const maxScriptSize = 1 << 20

// outputTail is how much of what the script printed goes to the log: the end,
// where the reason of a failure is.
const outputTail = 4096

// ErrLocalBuild is what Install returns for a build that is not a release.
var ErrLocalBuild = errors.New("update: a local build doesn't update itself")

// InstallPhase is where the installation of a newer version stands.
type InstallPhase string

// The phases of an installation.
const (
	InstallIdle   InstallPhase = "idle"       // nothing was asked, or the last one found the running version is the latest
	Installing    InstallPhase = "installing" // the install script runs
	Installed     InstallPhase = "installed"  // a newer version is on disk; the running one keeps going until a restart
	InstallFailed InstallPhase = "failed"     // the last installation failed; nothing changed on disk
)

// InstallFailure is why an installation failed.
type InstallFailure struct {
	Kind     FailureKind
	Reason   string   // a sentence of what happened, as the script or the app says it
	Commands []string // what to run to fix it, for Libraries; nil otherwise
}

// Install is where the installation of a newer version stands.
type Install struct {
	Phase   InstallPhase
	Target  string          // the newest version known when the user asked, 0.5.0; "" in InstallIdle
	Version string          // the version installed, 0.5.1 when a newer one came out meanwhile; Installed only
	Path    string          // the executable installed, which the restart starts; Installed only
	Failure *InstallFailure // InstallFailed only
	// RestartError is why the last restart couldn't start the installed
	// version; "" otherwise. Installed only.
	RestartError string
}

// Scripts reads the install script of this system from the main branch. *GitHub is one.
type Scripts interface {
	Script(ctx context.Context, name string) ([]byte, error)
}

// Runner runs an install script and waits for it. The script writes its result
// to the file at result; output is what it printed, for the log.
type Runner interface {
	Run(ctx context.Context, script, result string) (output []byte, err error)
}

// Install installs the newest version by the install script of this system, in
// the background, and returns at once; the state follows it with OnChange. An
// installation that runs or one that already installed is kept, never doubled.
// ctx lives as long as the app and only carries the check that follows an
// installation that found nothing newer: the script itself outlives the app.
// A local build returns ErrLocalBuild.
func (s *Service) Install(ctx context.Context) error {
	if !s.enabled {
		return ErrLocalBuild
	}

	s.mu.Lock()
	if phase := s.install.Phase; phase == Installing || phase == Installed {
		s.mu.Unlock()
		return nil
	}
	target := ""
	if len(s.newer) > 0 {
		target = s.newer[0].Version.String()
	}
	s.install = Install{Phase: Installing, Target: target}
	s.mu.Unlock()

	s.onChange()
	//nolint:gosec // G118: the installation outlives the app on purpose, so ctx never reaches the script
	go s.runInstall(ctx, target)
	return nil
}

// SetRestartError records why the restart couldn't start the installed version,
// for the page to show; Restart now tries again. A phase other than Installed
// ignores it.
func (s *Service) SetRestartError(reason string) {
	s.mu.Lock()
	if s.install.Phase != Installed {
		s.mu.Unlock()
		return
	}
	s.install.RestartError = sentence(reason)
	s.mu.Unlock()
	s.onChange()
}

// installEnd is how an installation ended.
type installEnd struct {
	install Install
	latest  string // the version the script reported, when it did
	output  []byte // what the script printed
	err     error  // what the log shows besides the failure the user sees; nil when there is none
}

// runInstall runs the installation and records how it ended. It does not end
// with the app: only its own deadline cuts it.
func (s *Service) runInstall(appCtx context.Context, target string) {
	start := s.now()
	ctx, cancel := context.WithTimeout(context.Background(), s.installTimeout)
	defer cancel()

	end := s.execute(ctx, target)

	s.mu.Lock()
	s.install = end.install
	s.mu.Unlock()
	s.onChange()

	took := s.now().Sub(start).Milliseconds()
	switch end.install.Phase {
	case Installed:
		s.onInstalled(cloneInstall(end.install))
		s.log.Info("update installed", "installed", s.installed, "version", end.install.Version, "path", end.install.Path, "duration_ms", took)
	case InstallFailed:
		failure := end.install.Failure
		attrs := []any{
			"installed", s.installed, "target", target, "kind", string(failure.Kind), "reason", failure.Reason,
			"duration_ms", took, "output", string(tail(end.output, outputTail)),
		}
		if end.err != nil {
			attrs = append(attrs, "error", end.err)
		}
		s.log.Warn("update install failed", attrs...)
	default:
		s.log.Info("update already installed", "installed", s.installed, "latest", end.latest)
		go s.Check(appCtx, false)
	}
}

// execute reads the install script, runs it and reads its result, and says
// where the installation ended.
func (s *Service) execute(ctx context.Context, target string) installEnd {
	scriptCtx, cancelScript := context.WithTimeout(ctx, scriptTimeout)
	script, err := s.scripts.Script(scriptCtx, scriptName)
	cancelScript()
	if err != nil {
		return failedInstall(target, fromCheck(classify(err)), nil, err)
	}

	dir, err := os.MkdirTemp(s.tempDir, "myspec-update-")
	if err != nil {
		return failedInstall(target, unwritable(err), nil, err)
	}
	defer os.RemoveAll(dir)
	scriptPath := filepath.Join(dir, scriptName)
	resultPath := filepath.Join(dir, "result")
	if err := os.WriteFile(scriptPath, script, 0o600); err != nil {
		return failedInstall(target, unwritable(err), nil, err)
	}

	output, runErr := s.runner.Run(ctx, scriptPath, resultPath)
	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		reason := fmt.Sprintf("The update didn't finish in %d minutes.", int(s.installTimeout/time.Minute))
		return failedInstall(target, &InstallFailure{Kind: Timeout, Reason: reason}, output, runErr)
	}

	data, readErr := os.ReadFile(resultPath)
	res, ok := parseResult(data)
	if !ok {
		failure := &InstallFailure{Kind: Failed, Reason: "The install script ended without a result."}
		return failedInstall(target, failure, output, errors.Join(runErr, readErr))
	}
	if res.result == "failed" {
		return failedInstall(target, scriptFailure(res), output, runErr)
	}
	return s.installedEnd(target, res, output, runErr)
}

// installedEnd is the end of a script that reported it installed a version.
func (s *Service) installedEnd(target string, res scriptResult, output []byte, runErr error) installEnd {
	v, ok := ParseVersion(res.version)
	if !ok || !filepath.IsAbs(res.path) {
		failure := &InstallFailure{Kind: Failed, Reason: "The install script reported a result the app can't read."}
		return failedInstall(target, failure, output, runErr)
	}
	if !s.version.Less(v) {
		return installEnd{install: Install{Phase: InstallIdle}, latest: v.String(), output: output, err: runErr}
	}
	install := Install{Phase: Installed, Target: target, Version: v.String(), Path: res.path}
	return installEnd{install: install, latest: v.String(), output: output, err: runErr}
}

// failedInstall is the end of an installation that failed with the failure.
func failedInstall(target string, failure *InstallFailure, output []byte, err error) installEnd {
	return installEnd{install: Install{Phase: InstallFailed, Target: target, Failure: failure}, output: output, err: err}
}

// unwritable is the failure of an install script the app couldn't put on disk.
func unwritable(err error) *InstallFailure {
	return &InstallFailure{Kind: Failed, Reason: fmt.Sprintf("The install script couldn't be written: %v.", err)}
}

// scriptFailure is the failure a script reported.
func scriptFailure(res scriptResult) *InstallFailure {
	failure := &InstallFailure{Kind: kindOf(res.kind), Reason: sentence(res.reason)}
	if failure.Reason == "" {
		failure.Reason = "The install script failed."
	}
	if failure.Kind == Libraries {
		failure.Commands = res.commands
	}
	return failure
}

// fromCheck turns the failure of a read of GitHub into one of an installation.
func fromCheck(f Failure) *InstallFailure {
	return &InstallFailure{Kind: f.Kind, Reason: sentence(f.Detail)}
}

// scriptKinds are the kinds of failure the install script reports besides Failed.
var scriptKinds = []FailureKind{Offline, Timeout, Libraries, System, Replace}

// kindOf is the kind of failure a script names; one the app doesn't know is Failed.
func kindOf(kind string) FailureKind {
	if k := FailureKind(kind); slices.Contains(scriptKinds, k) {
		return k
	}
	return Failed
}

// cloneInstall copies install, so that what it points to is not shared.
func cloneInstall(install Install) Install {
	if install.Failure != nil {
		f := *install.Failure
		f.Commands = slices.Clone(f.Commands)
		install.Failure = &f
	}
	return install
}

// scriptResult is what the install script wrote to MYSPEC_INSTALL_RESULT.
type scriptResult struct {
	result, version, path, kind, reason string
	commands                            []string
}

// parseResult reads the result of the install script, lines of "key: value". A
// line without ": " and a key the app doesn't know are ignored, so the script
// can grow. ok is false when the script didn't say whether it installed or failed.
func parseResult(data []byte) (res scriptResult, ok bool) {
	text := strings.TrimPrefix(string(data), "\ufeff")
	for line := range strings.SplitSeq(text, "\n") {
		key, value, found := strings.Cut(strings.TrimSuffix(line, "\r"), ": ")
		if !found {
			continue
		}
		value = strings.TrimSpace(value)
		switch key {
		case "result":
			res.result = value
		case "version":
			res.version = value
		case "path":
			res.path = value
		case "kind":
			res.kind = value
		case "reason":
			res.reason = value
		case "command":
			res.commands = append(res.commands, value)
		}
	}
	return res, res.result == "installed" || res.result == "failed"
}

// sentence makes text a sentence: it starts with a capital and ends with a stop.
func sentence(text string) string {
	text = strings.TrimSpace(text)
	if text == "" {
		return ""
	}
	first, size := utf8.DecodeRuneInString(text)
	text = string(unicode.ToUpper(first)) + text[size:]
	if !strings.ContainsAny(text[len(text)-1:], ".!?") {
		text += "."
	}
	return text
}

// tail is the last n bytes of b.
func tail(b []byte, n int) []byte {
	if len(b) <= n {
		return b
	}
	return b[len(b)-n:]
}
