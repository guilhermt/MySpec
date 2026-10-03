package app

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/store"
)

// startupPhase, stepID, stepState and failureCase are the values of
// bindings.Startup.
type startupPhase string

const (
	phaseStarting startupPhase = "starting"
	phaseFailed   startupPhase = "failed"
	phaseReady    startupPhase = "ready"
)

type stepID string

const (
	stepData   stepID = "data"
	stepClones stepID = "clones"
)

type stepState string

const (
	stepTodo    stepState = "todo"
	stepRunning stepState = "running"
	stepDone    stepState = "done"
)

type failureCase string

const (
	casePermission failureCase = "permission"
	caseDiskFull   failureCase = "disk_full"
	caseOther      failureCase = "other"
)

// slowAfter is how long the test of one clone runs before the step names it.
const slowAfter = 3 * time.Second

// startedAtLayout is RFC 3339 with milliseconds, which is all the interface
// needs to measure how long a step has run.
const startedAtLayout = "2006-01-02T15:04:05.000Z07:00"

// startupStep is one step that holds the first screen.
type startupStep struct {
	id        stepID
	state     stepState
	startedAt time.Time
	count     int
	detail    string
}

// startupFailure is why the startup failed.
type startupFailure struct {
	kind  failureCase
	error string
}

// startup runs the work before the app is ready, one attempt at a time, and
// tells the frontend where it stands.
type startup struct {
	mu      sync.Mutex
	phase   startupPhase
	steps   []startupStep
	failure *startupFailure
	running bool               // an attempt runs
	cancel  context.CancelFunc // of the attempt that runs; nil when none does
	done    chan struct{}      // closed when the attempt that runs returns
	closed  bool               // the window closed: no attempt starts again

	attempt   func(ctx context.Context, p *progress) error // the work; it cleans up what it opened when it fails
	onChange  func()                                       // publishes startup:changed
	now       func() time.Time
	slowAfter time.Duration
	log       *slog.Logger

	systemDark       bool
	dataDir, logPath string
}

// newStartup builds the executor of an app whose data is in dataDir. Nothing
// runs until start.
func newStartup(
	attempt func(ctx context.Context, p *progress) error,
	onChange func(),
	log *slog.Logger,
	systemDark bool,
	dataDir, logPath string,
) *startup {
	return &startup{
		phase:      phaseStarting,
		steps:      []startupStep{},
		attempt:    attempt,
		onChange:   onChange,
		now:        time.Now,
		slowAfter:  slowAfter,
		log:        log,
		systemDark: systemDark,
		dataDir:    dataDir,
		logPath:    logPath,
	}
}

// start runs an attempt from its first step, unless the window closed or one
// already runs.
func (s *startup) start() {
	s.mu.Lock()
	if s.closed || s.running {
		s.mu.Unlock()
		return
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	s.running, s.cancel, s.done = true, cancel, done
	s.phase, s.failure = phaseStarting, nil
	s.steps = []startupStep{{id: stepData, state: stepTodo}}
	s.mu.Unlock()

	s.onChange()
	go s.run(ctx, cancel, done)
}

// run is one attempt and what it leaves behind.
func (s *startup) run(ctx context.Context, cancel context.CancelFunc, done chan struct{}) {
	err := s.attempt(ctx, &progress{s: s})
	cancel()

	s.mu.Lock()
	s.running, s.cancel = false, nil
	closed := s.closed
	switch {
	case err == nil:
		s.phase = phaseReady
	case closed:
		// The window closed under the attempt, which cleaned up after itself:
		// that is not a failure to show.
	default:
		s.phase = phaseFailed
		s.failure = &startupFailure{kind: caseOf(err), error: err.Error()}
	}
	s.mu.Unlock()

	switch {
	case err == nil:
		s.log.Info("app ready")
	case closed:
		s.log.Info("startup stopped", "error", err)
	default:
		s.log.Error("startup failed", "error", err)
	}
	close(done)
	if closed {
		return
	}
	s.onChange()
}

// tryAgain runs the startup again from its first step; it does nothing unless
// the startup failed.
func (s *startup) tryAgain() {
	s.mu.Lock()
	failed := s.phase == phaseFailed
	s.mu.Unlock()

	if failed {
		s.start()
	}
}

// close stops the attempt that runs, waits for it to clean up, and keeps any
// other from starting.
func (s *startup) close() {
	s.mu.Lock()
	s.closed = true
	cancel, done := s.cancel, s.done
	s.mu.Unlock()

	if cancel != nil {
		cancel()
	}
	if done != nil {
		<-done
	}
}

// snapshot is where the startup stands.
func (s *startup) snapshot() bindings.Startup {
	s.mu.Lock()
	defer s.mu.Unlock()

	steps := make([]bindings.StartupStep, len(s.steps))
	for i, step := range s.steps {
		steps[i] = bindings.StartupStep{
			ID:     string(step.id),
			State:  string(step.state),
			Count:  step.count,
			Detail: step.detail,
		}
		if !step.startedAt.IsZero() {
			steps[i].StartedAt = step.startedAt.UTC().Format(startedAtLayout)
		}
	}
	out := bindings.Startup{Phase: string(s.phase), Steps: steps, SystemDark: s.systemDark}
	if s.failure != nil {
		out.Failure = &bindings.StartupFailure{
			Case:    string(s.failure.kind),
			Error:   s.failure.error,
			DataDir: s.dataDir,
			LogPath: s.logPath,
		}
	}
	return out
}

// caseOf says which text the interface shows for a startup that failed with err.
func caseOf(err error) failureCase {
	switch {
	case store.PermissionDenied(err):
		return casePermission
	case store.DiskFull(err):
		return caseDiskFull
	default:
		return caseOther
	}
}

// progress is what an attempt moves the steps with.
type progress struct {
	s *startup
}

// step runs change on the step with the given id under the lock, then
// publishes; a step the list does not have yet is added as todo first.
func (p *progress) step(id stepID, change func(step *startupStep)) {
	p.s.mu.Lock()
	index := -1
	for i := range p.s.steps {
		if p.s.steps[i].id == id {
			index = i
		}
	}
	if index < 0 {
		p.s.steps = append(p.s.steps, startupStep{id: id, state: stepTodo})
		index = len(p.s.steps) - 1
	}
	change(&p.s.steps[index])
	p.s.mu.Unlock()

	p.s.onChange()
}

// begin starts a step; the step of the clones joins the list here.
func (p *progress) begin(id stepID) {
	p.step(id, func(step *startupStep) {
		step.state, step.startedAt = stepRunning, p.s.now()
	})
}

// finish ends a step.
func (p *progress) finish(id stepID) {
	p.step(id, func(step *startupStep) { step.state = stepDone })
}

// cloneCount records how many clones the step of the clones tests.
func (p *progress) cloneCount(n int) {
	p.step(stepClones, func(step *startupStep) { step.count = n })
}

// checking is called before the test of the clone at path. The test that is
// still running after slowAfter names the path; the function it returns ends
// the watch.
func (p *progress) checking(path string) func() {
	timer := time.AfterFunc(p.s.slowAfter, func() {
		p.step(stepClones, func(step *startupStep) {
			if step.state == stepRunning && step.detail == "" {
				step.detail = path
			}
		})
	})
	return func() { timer.Stop() }
}

// emitStartup tells the frontend where the startup stands.
func (a *App) emitStartup() {
	if wails, _ := a.handles(); wails != nil {
		wails.Event.Emit(bindings.EventStartupChanged, a.startup.snapshot())
	}
}
