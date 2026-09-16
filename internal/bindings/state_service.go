package bindings

import "time"

// callTimeout bounds the database work behind a single binding call.
const callTimeout = 5 * time.Second

// StateService hands the frontend the state it renders.
type StateService struct {
	snapshot func() State
}

// NewStateService builds the service over a producer of snapshots.
func NewStateService(snapshot func() State) *StateService {
	return &StateService{snapshot: snapshot}
}

// GetState returns the current snapshot. It is how the frontend gets its first
// state; every later one arrives with EventStateChanged.
func (s *StateService) GetState() State {
	return s.snapshot()
}
