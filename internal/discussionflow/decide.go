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

// PublishEpic asks for an epic and the cards under it to go to GitHub
// together, which is the only way a card of an epic is published.
func (s *Service) PublishEpic(_ context.Context, id, draftID string) error {
	err := s.edit(id, func() error {
		drafts := s.discussions.Drafts(id)
		epic, ok := draftOf(drafts, draftID)
		if !ok {
			return fmt.Errorf("publish epic %s of discussion %s: %w", draftID, id, discussion.ErrDraftNotFound)
		}
		if ready, _ := epicReady(epic, drafts); !ready {
			return fmt.Errorf("publish epic %s of discussion %s: %w", draftID, id, ErrNotReady)
		}
		s.requestEpic(id, draftID)
		return nil
	})
	if err != nil {
		return err
	}
	s.Check(id)
	return nil
}

// Retry sends a draft whose publication failed to GitHub again, from the step
// it stopped at. A draft of an epic is never retried on its own: the run of the
// epic is what failed, so the epic and every card under it go again together,
// whichever of them the user clicked.
func (s *Service) Retry(ctx context.Context, id, draftID string) error {
	err := s.edit(id, func() error {
		drafts := s.discussions.Drafts(id)
		draft, ok := draftOf(drafts, draftID)
		if !ok {
			return fmt.Errorf("retry draft %s of discussion %s: %w", draftID, id, discussion.ErrDraftNotFound)
		}
		epic, inEpic := epicRunOf(draft, drafts)
		if !inEpic {
			if err := s.writeUnrecorded(ctx, id, draftID); err != nil {
				return err
			}
			return s.discussions.SetPublishError(ctx, id, draftID, "")
		}
		run := epicRun(epic, drafts)
		if err := s.writeUnrecorded(ctx, id, run...); err != nil {
			return err
		}
		if err := s.discussions.ClearPublishErrors(ctx, id, run); err != nil {
			return err
		}
		s.requestEpic(id, epic.ID)
		return nil
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

// epicRunOf is the epic a draft is published with: the draft itself when it is
// one, or the epic of a card when that epic is a draft of the discussion that
// goes to GitHub with it.
func epicRunOf(draft discussion.Draft, drafts []discussion.Draft) (discussion.Draft, bool) {
	if draft.Kind == discussion.KindEpic {
		return draft, true
	}
	if standsAlone(draft, drafts) {
		return discussion.Draft{}, false
	}
	return epicDraftOf(draft, drafts)
}

// epicRun are the drafts a run of an epic writes: the epic and the cards under
// it.
func epicRun(epic discussion.Draft, drafts []discussion.Draft) []string {
	members := membersOf(epic, drafts)
	ids := make([]string, 0, len(members)+1)
	ids = append(ids, epic.ID)
	for _, member := range members {
		ids = append(ids, member.ID)
	}
	return ids
}

// requestEpic keeps that the user asked for an epic to be published, which the
// next evaluation acts on.
func (s *Service) requestEpic(id, draftID string) {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	l.epicsRequested[draftID] = true
}

// forgetEpic drops a request to publish an epic that is over or that the
// discussion moved past.
func (s *Service) forgetEpic(id, draftID string) {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	delete(l.epicsRequested, draftID)
}

// epicRequested reports whether the user asked for an epic to be published and
// the run of it has not finished.
func (s *Service) epicRequested(id, draftID string) bool {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	return l.epicsRequested[draftID]
}
