package bindings

import "github.com/guilhermt/myspec/internal/attention"

// AttentionService is what the frontend tells the app about the situations.
type AttentionService struct {
	attention *attention.Service
}

// NewAttentionService builds the service over the situations of the tasks.
func NewAttentionService(situations *attention.Service) *AttentionService {
	return &AttentionService{attention: situations}
}

// ViewSituation says the place of a situation is on screen with the window in
// front: a notification about it is out of date and goes away.
func (s *AttentionService) ViewSituation(id string) {
	s.attention.View(id)
}
