package bindings

// StartupService tells the frontend where the startup stands and starts it
// again after a failure. It answers before the app is ready: it is the one
// service that never waits.
type StartupService struct {
	snapshot func() Startup
	tryAgain func()
}

// NewStartupService builds the service over the snapshot of the startup and the
// function that runs it again.
func NewStartupService(snapshot func() Startup, tryAgain func()) *StartupService {
	return &StartupService{snapshot: snapshot, tryAgain: tryAgain}
}

// GetStartup returns where the startup stands. It is how the frontend gets its
// first one; every later one arrives with EventStartupChanged.
func (s *StartupService) GetStartup() Startup {
	return s.snapshot()
}

// TryAgain runs the startup again from its first step; it does nothing unless
// the startup failed.
func (s *StartupService) TryAgain() {
	s.tryAgain()
}
