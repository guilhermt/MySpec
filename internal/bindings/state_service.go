package bindings

import "time"

// callTimeout bounds the database work behind a single binding call.
const callTimeout = 5 * time.Second

// QuitActions is what the quit warning asks of the app: close it anyway, or
// keep it open.
type QuitActions struct {
	Quit   func()
	Cancel func()
}

// StateService hands the frontend the state it renders.
type StateService struct {
	late     late[StateService]
	snapshot func() State
	quit     QuitActions
}

// NewStateService builds the service over a producer of snapshots and the
// answers the quit warning gives.
func NewStateService(snapshot func() State, quit QuitActions) *StateService {
	return &StateService{snapshot: snapshot, quit: quit}
}

// GetState returns the current snapshot. It is how the frontend gets its first
// state; every later one arrives with EventStateChanged.
func (s *StateService) GetState() State {
	s, err := s.late.resolve(s)
	if err != nil {
		return State{}
	}
	return s.snapshot()
}

// QuitAnyway closes the app, stopping what runs in the background, after the
// user confirmed the quit warning.
func (s *StateService) QuitAnyway() error {
	s, err := s.late.resolve(s)
	if err != nil {
		return err
	}
	s.quit.Quit()
	return nil
}

// CancelQuit dismisses the quit warning and keeps the app open.
func (s *StateService) CancelQuit() error {
	s, err := s.late.resolve(s)
	if err != nil {
		return err
	}
	s.quit.Cancel()
	return nil
}
