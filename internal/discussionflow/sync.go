package discussionflow

import (
	"context"

	"github.com/guilhermt/myspec/internal/models"
)

// Sync brings the discussions the app loaded back to life: each one with a
// conversation gets it open again, with the board as it is now, and an
// evaluation says what the agent wrote while the app was closed. A discussion
// without one is left alone: opening it here would create a conversation with
// no model nobody writes to.
func (s *Service) Sync(ctx context.Context) {
	active := s.discussions.List()
	for _, d := range active {
		exists, err := s.sessions.Exists(ctx, sessionKey(d.ID))
		if err != nil {
			s.log.Error("open discussion session failed", "discussion", d.ID, "error", err)
			continue
		}
		if !exists {
			continue
		}
		if err = s.sessions.Open(ctx, s.info(d, models.Choice{})); err != nil {
			s.log.Error("open discussion session failed", "discussion", d.ID, "error", err)
			continue
		}
		s.stampDocument(s.lockOf(d.ID), d)
	}
	for _, d := range active {
		s.Check(d.ID)
	}
}
