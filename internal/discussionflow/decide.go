package discussionflow

import (
	"context"
	"fmt"

	"github.com/guilhermt/myspec/internal/discussion"
)

// Decide records what the user decided about one draft and asks for the
// evaluation that publishes what the decision lets go. A draft memory holds as
// started is already on GitHub: only Retry takes it on.
func (s *Service) Decide(ctx context.Context, id, draftID string, d discussion.Decision) error {
	err := s.editDraft(id, draftID, func() error {
		if err := s.discussions.Decide(ctx, id, draftID, d); err != nil {
			return err
		}
		// The decision clears the failure of a draft nothing was written for,
		// which memory may hold alone.
		s.dropUnrecorded(id, draftID)
		return nil
	})
	if err != nil {
		return err
	}
	s.Check(id)
	return nil
}

// SetDraftText records the title and the body the user left on a draft, which
// is what a publication sends.
func (s *Service) SetDraftText(ctx context.Context, id, draftID, title, body string) error {
	return s.editDraft(id, draftID, func() error { return s.discussions.SetDraftText(ctx, id, draftID, title, body) })
}

// SetDraftRepository records the repository a new card or an epic is created
// in.
func (s *Service) SetDraftRepository(ctx context.Context, id, draftID, owner, name string) error {
	return s.editDraft(id, draftID, func() error { return s.discussions.SetDraftRepository(ctx, id, draftID, owner, name) })
}

// SetDraftModule records the module of a card; "" is a card with none.
func (s *Service) SetDraftModule(ctx context.Context, id, draftID, module string) error {
	return s.editDraft(id, draftID, func() error { return s.discussions.SetDraftModule(ctx, id, draftID, module) })
}

// SetDraftEpic records the epic of a card: an epic draft of the discussion, an
// issue that exists, or "" for none.
func (s *Service) SetDraftEpic(ctx context.Context, id, draftID, value string) error {
	return s.editDraft(id, draftID, func() error { return s.discussions.SetDraftEpic(ctx, id, draftID, value) })
}

// AddDraftDependency records that a card can only start after another one.
func (s *Service) AddDraftDependency(ctx context.Context, id, draftID, value string) error {
	return s.editDraft(id, draftID, func() error { return s.discussions.AddDraftDependency(ctx, id, draftID, value) })
}

// RemoveDraftDependency drops a dependency of a card.
func (s *Service) RemoveDraftDependency(ctx context.Context, id, draftID, value string) error {
	return s.editDraft(id, draftID, func() error { return s.discussions.RemoveDraftDependency(ctx, id, draftID, value) })
}

// GroupIntoEpic creates an epic of the user over the given cards and points
// every one of them at it.
func (s *Service) GroupIntoEpic(ctx context.Context, id string, draftIDs []string) (discussion.Draft, error) {
	var epic discussion.Draft
	err := s.edit(id, func() error {
		for _, draftID := range draftIDs {
			if s.startedInMemory(id, draftID) {
				return fmt.Errorf("group draft %s of discussion %s: %w", draftID, id, discussion.ErrPublished)
			}
		}
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

// editDraft runs a change of the user on one draft as edit does, refusing a
// draft memory holds as started: the store can't see that it is on GitHub.
func (s *Service) editDraft(id, draftID string, change func() error) error {
	return s.edit(id, func() error {
		if s.startedInMemory(id, draftID) {
			return fmt.Errorf("edit draft %s of discussion %s: %w", draftID, id, discussion.ErrPublished)
		}
		return change()
	})
}

// startedInMemory reports whether memory alone holds that GitHub has the
// issue of a draft.
func (s *Service) startedInMemory(id, draftID string) bool {
	entry, ok := s.unrecordedDrafts(id)[draftID]
	return ok && entry.Published.Started()
}

// publishing reports whether a run that writes on GitHub is under way, which
// no action of the user cuts into: the run reads and records the drafts it
// publishes without holding the lock of the discussion.
func (s *Service) publishing(l *discussionLock) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	return l.publishing
}

// Retry sends what failed to GitHub again. It writes down what memory alone
// holds of every draft and clears every failure of the discussion in one
// write; the run that follows writes everything that goes, in order, each
// draft from the step it stopped at.
func (s *Service) Retry(ctx context.Context, id, draftID string) error {
	err := s.edit(id, func() error {
		drafts := s.discussions.Drafts(id)
		if _, ok := draftOf(drafts, draftID); !ok {
			return fmt.Errorf("retry draft %s of discussion %s: %w", draftID, id, discussion.ErrDraftNotFound)
		}
		ids := make([]string, len(drafts))
		for i, draft := range drafts {
			ids[i] = draft.ID
		}
		if err := s.writeUnrecorded(ctx, id, ids...); err != nil {
			return err
		}
		return s.discussions.ClearPublishErrors(ctx, id, ids)
	})
	if err != nil {
		return err
	}
	s.Check(id)
	return nil
}

// writeUnrecorded persists what a publication left only in memory, which is
// what a retry starts from: with it in the store, the run takes the draft up
// at the step after the one GitHub already took. An entry is forgotten only
// once the write held it.
func (s *Service) writeUnrecorded(ctx context.Context, id string, draftIDs ...string) error {
	entries := s.unrecordedDrafts(id)
	for _, draftID := range draftIDs {
		entry, ok := entries[draftID]
		if !ok {
			continue
		}
		err := s.discussions.RecordPublication(ctx, id, draftID, func(d *discussion.Draft) {
			d.Published = entry.Published
			d.PublishError = ""
		})
		if err != nil {
			return err
		}
		s.dropUnrecorded(id, draftID)
	}
	return nil
}
