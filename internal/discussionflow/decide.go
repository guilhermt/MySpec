package discussionflow

import (
	"context"
	"fmt"
	"strings"

	"github.com/guilhermt/myspec/internal/discussion"
)

// Decide records what the user decided about one draft. An approved card the
// nothing else waits for is published by the evaluation that follows.
func (s *Service) Decide(ctx context.Context, id, draftID string, d discussion.Decision) error {
	if err := s.edit(id, func() error { return s.discussions.Decide(ctx, id, draftID, d) }); err != nil {
		return err
	}
	s.Check(id)
	return nil
}

// SetDraftText records the title and the body the user left on a draft, which
// is what a publication sends.
func (s *Service) SetDraftText(ctx context.Context, id, draftID, title, body string) error {
	return s.edit(id, func() error { return s.discussions.SetDraftText(ctx, id, draftID, title, body) })
}

// SetDraftRepository records the repository a new card or an epic is created
// in.
func (s *Service) SetDraftRepository(ctx context.Context, id, draftID, owner, name string) error {
	return s.edit(id, func() error { return s.discussions.SetDraftRepository(ctx, id, draftID, owner, name) })
}

// SetDraftModule records the module of a card; "" is a card with none.
func (s *Service) SetDraftModule(ctx context.Context, id, draftID, module string) error {
	return s.edit(id, func() error { return s.discussions.SetDraftModule(ctx, id, draftID, module) })
}

// SetDraftEpic records the epic of a card: an epic draft of the discussion, an
// issue that exists, or "" for none. A card that leaves an epic the user asked
// to publish takes the request with it: the epic is no longer the one they
// asked for.
func (s *Service) SetDraftEpic(ctx context.Context, id, draftID, value string) error {
	return s.edit(id, func() error {
		before, found := s.draftOf(id, draftID)
		if err := s.discussions.SetDraftEpic(ctx, id, draftID, value); err != nil {
			return err
		}
		if found {
			s.forgetEpicOf(id, before, value)
		}
		return nil
	})
}

// AddDraftDependency records that a card can only start after another one.
func (s *Service) AddDraftDependency(ctx context.Context, id, draftID, value string) error {
	return s.edit(id, func() error { return s.discussions.AddDraftDependency(ctx, id, draftID, value) })
}

// RemoveDraftDependency drops a dependency of a card.
func (s *Service) RemoveDraftDependency(ctx context.Context, id, draftID, value string) error {
	return s.edit(id, func() error { return s.discussions.RemoveDraftDependency(ctx, id, draftID, value) })
}

// GroupIntoEpic creates an epic of the user over the given cards and points
// every one of them at it.
func (s *Service) GroupIntoEpic(ctx context.Context, id string, draftIDs []string) (discussion.Draft, error) {
	var epic discussion.Draft
	err := s.edit(id, func() error {
		created, groupErr := s.discussions.GroupIntoEpic(ctx, id, draftIDs)
		epic = created
		return groupErr
	})
	if err != nil {
		return discussion.Draft{}, err
	}
	return epic, nil
}

// edit runs a change of the user on a discussion, refusing an archived one and
// one whose drafts a publication under way could be writing right now.
func (s *Service) edit(id string, change func() error) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	stored, ok := s.discussions.Lookup(id)
	if !ok {
		return fmt.Errorf("edit discussion %s: %w", id, discussion.ErrNotFound)
	}
	if stored.Archived() {
		return fmt.Errorf("edit discussion %s: %w", id, discussion.ErrArchived)
	}

	if s.publishing(l) {
		return fmt.Errorf("edit discussion %s: %w", id, ErrPublishing)
	}
	return change()
}

// publishing reports whether a run that writes on GitHub is under way, which
// no action of the user cuts into: the run reads and records the drafts it
// publishes without holding the lock of the discussion.
func (s *Service) publishing(l *discussionLock) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	return l.publishing
}

// forgetEpicOf drops the request to publish the epic a card just left, which
// the user asked for with that card in it.
func (s *Service) forgetEpicOf(id string, before discussion.Draft, value string) {
	if ref, ok := discussion.ParseRef(strings.TrimSpace(value)); ok && ref.IsDraft() {
		return
	}
	left, ok := before.EpicRef()
	if !ok || !left.IsDraft() {
		return
	}
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	delete(l.epicsRequested, left.Draft)
}

// draftOf is a stored draft of a discussion by id.
func (s *Service) draftOf(id, draftID string) (discussion.Draft, bool) {
	return draftOf(s.discussions.Drafts(id), draftID)
}
