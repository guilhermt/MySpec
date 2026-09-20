package discussionflow

import (
	"context"
	"fmt"

	"github.com/guilhermt/myspec/internal/discussion"
)

// Archive takes a discussion out of the list and into the history, with its
// conversation kept for the user to read. What was approved goes to GitHub
// first: a discussion with a publication left to make is refused.
func (s *Service) Archive(ctx context.Context, id string) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	if s.publishing(l) {
		return fmt.Errorf("archive discussion %s: %w", id, ErrPublishing)
	}
	state, ok := s.State(id)
	if !ok {
		return fmt.Errorf("archive discussion %s: %w", id, discussion.ErrNotFound)
	}
	if !state.CanArchive {
		return fmt.Errorf("archive discussion %s: %w: %s", id, ErrCannotArchive, state.ArchiveHint)
	}

	if err := s.sessions.Close(ctx, sessionKey(id)); err != nil {
		return fmt.Errorf("archive discussion %s: %w", id, err)
	}
	if _, err := s.discussions.Archive(ctx, id); err != nil {
		return err
	}
	s.forget(id)

	s.log.Info("discussion archived", "discussion", id, "board", state.Discussion.BoardID)
	s.notify(id)
	return nil
}

// Delete removes a discussion for good, active or in the history: its
// conversation, its artifacts and its drafts go. What was already published on
// GitHub stays there.
func (s *Service) Delete(ctx context.Context, id string) error {
	stored, ok := s.discussions.Lookup(id)
	if !ok {
		return fmt.Errorf("delete discussion %s: %w", id, discussion.ErrNotFound)
	}

	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	if s.publishing(l) {
		return fmt.Errorf("delete discussion %s: %w", id, ErrPublishing)
	}

	// The conversation runs inside the artifact folder, so it stops first.
	if err := s.sessions.DiscardTask(ctx, id); err != nil {
		return fmt.Errorf("delete discussion %s: %w", id, err)
	}
	if err := s.discussions.Delete(ctx, id); err != nil {
		return err
	}
	s.forget(id)

	s.log.Info("discussion deleted", "discussion", id, "board", stored.BoardID)
	s.notify(id)
	return nil
}
