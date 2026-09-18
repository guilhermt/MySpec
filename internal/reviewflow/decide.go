package reviewflow

import (
	"context"
	"fmt"

	"github.com/guilhermt/myspec/internal/prreview"
)

// Decide records what the user decided about one finding of the pass they are
// deciding on.
func (s *Service) Decide(ctx context.Context, id string, pass, number int, d prreview.Decision) error {
	return s.deciding(id, func() error { return s.reviews.Decide(ctx, id, pass, number, d) })
}

// SetFindingText records the text of one finding as the user left it, which is
// what a publication sends.
func (s *Service) SetFindingText(ctx context.Context, id string, pass, number int, text string) error {
	return s.deciding(id, func() error { return s.reviews.SetFindingText(ctx, id, pass, number, text) })
}

// SetSummary records the summary of the pass as the user left it, which is
// what the body of a published review opens with.
func (s *Service) SetSummary(ctx context.Context, id string, pass int, text string) error {
	return s.deciding(id, func() error { return s.reviews.SetSummary(ctx, id, pass, text) })
}

// deciding runs a decision of the user on the review, refusing while a pass
// the agent is writing could still rewrite the findings under them.
func (s *Service) deciding(id string, decide func() error) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	stored, ok := s.reviews.Get(id)
	if !ok {
		return fmt.Errorf("decide on review %s: %w", id, prreview.ErrNotFound)
	}
	if stored.AskedPass > stored.ReportedPass {
		return fmt.Errorf("decide on review %s: %w", id, ErrPassRunning)
	}
	return decide()
}
