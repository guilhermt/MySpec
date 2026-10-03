package discussionflow

import (
	"context"
	"errors"
	"os"
	"strconv"

	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/session"
)

// evaluate keeps a discussion in step with its conversation: it notices the
// document the agent writes, records the drafts of the artifact once the agent
// rests, and sends to GitHub what is ready to go.
func (s *Service) evaluate(ctx context.Context, id string) {
	if s.isClosed() {
		return
	}
	stored, ok := s.discussions.Get(id)
	if !ok {
		return
	}
	l := s.lockOf(id)
	s.stampDocument(ctx, l, stored)

	// The conversation is opened by Start and by Sync: an evaluation never
	// opens one, and reads the artifact only while it rests. A run writes the
	// drafts it publishes without the lock of the discussion, so nothing reads
	// the artifact over it; the check at the end of the run reads it right
	// after. While memory holds a publication the store could not, the artifact
	// is not read either, or the reconciliation would replace or drop the draft
	// under it; the Retry that writes the entry down calls Check, which reads
	// the artifact then.
	sum, open := s.sessions.Summary(sessionKey(id))
	if open && sum.Idle && !s.publishing(l) && !s.hasUnrecorded(id) {
		s.readDrafts(ctx, stored)
	}
	// What the user decided goes to GitHub whatever the conversation does.
	s.publishDue(stored)
}

// stampDocument looks at the document of the discussion: the interface reads
// it again every time it changes.
func (s *Service) stampDocument(ctx context.Context, l *discussionLock, stored discussion.Discussion) {
	stamp, has := documentStamp(stored.DocumentPath())

	s.mu.Lock()
	changed := l.hasDocument != has || l.documentStamp != stamp
	if changed {
		l.hasDocument, l.documentStamp = has, stamp
		if has {
			l.documentRevision++
		}
	}
	s.mu.Unlock()

	if changed {
		s.notify(stored.ID)
	}
	if changed && has {
		// A restart finds the same stamp and calls again: the session records
		// the marker once.
		s.sessions.MarkDiscussion(ctx, sessionKey(stored.ID), &session.MarkerEntry{
			Type: session.MarkerDiscussionDocument, Stamp: stamp,
		})
	}
}

// documentStamp is how a document on disk is told apart from the last reading
// of it: its modification time and its size.
func documentStamp(path string) (string, bool) {
	info, err := os.Stat(path)
	if err != nil {
		return "", false
	}
	return strconv.FormatInt(info.ModTime().UnixNano(), 10) + "-" + strconv.FormatInt(info.Size(), 10), true
}

// readDrafts records the drafts of the artifact the agent wrote, reconciled
// with the edits and the decisions the user already made. An artifact the app
// cannot read leaves the discussion saying so, because no draft of it can be
// acted on.
func (s *Service) readDrafts(ctx context.Context, stored discussion.Discussion) {
	artifact, ok, err := discussion.ReadArtifact(stored.DraftsPath())
	if err != nil {
		s.draftsUnreadable(ctx, stored.ID, err)
		return
	}
	if !ok {
		return
	}
	if err = discussion.Validate(artifact, s.catalogOf(stored)); err != nil {
		s.draftsUnreadable(ctx, stored.ID, err)
		return
	}

	rec, err := s.discussions.RecordDrafts(ctx, stored.ID, artifact)
	if err != nil {
		s.log.Error("record discussion drafts failed", "discussion", stored.ID, "error", err)
		return
	}
	s.markReading(ctx, stored.ID, rec)
	// A rewrite that brought the artifact back to what was recorded changes no
	// draft, but it does settle the warning that the app could not read it.
	settled := s.setUnreadable(stored.ID, "")
	if rec.Changed || settled {
		s.notify(stored.ID)
	}
}

// draftsUnreadable keeps why the drafts artifact could not be read, so that
// the discussion says it instead of waiting for drafts that will never come.
func (s *Service) draftsUnreadable(ctx context.Context, id string, err error) {
	if !errors.Is(err, discussion.ErrUnreadable) {
		s.log.Error("read discussion drafts failed", "discussion", id, "error", err)
		return
	}
	s.log.Warn("discussion drafts are unreadable", "discussion", id, "error", err)
	reason := discussion.Reason(err)
	if s.setUnreadable(id, reason) {
		s.notify(id)
		s.sessions.MarkDiscussion(ctx, sessionKey(id), &session.MarkerEntry{
			Type: session.MarkerDraftsUnreadable, Reason: reason, Round: maxRound(s.discussions.Drafts(id)),
		})
	}
}

// markReading records in the conversation what a reading of the drafts did:
// the first one of a round writes it, a later one that changed the round
// revises it. A reading that changed nothing records nothing.
func (s *Service) markReading(ctx context.Context, id string, rec discussion.Recorded) {
	switch {
	case rec.First:
		s.sessions.MarkDiscussion(ctx, sessionKey(id), &session.MarkerEntry{
			Type: session.MarkerDraftsWritten, Round: rec.Round, Count: rec.Drafts,
		})
	case rec.Changed && rec.Before != nil:
		s.sessions.MarkDiscussion(ctx, sessionKey(id), &session.MarkerEntry{
			Type: session.MarkerDraftsRevised, Round: rec.Round, Changed: rec.Replaced,
			Added: rec.Added, Dropped: rec.Dropped, Before: beforeOf(rec.Before),
		})
	}
}

// beforeOf is the round as it was before a revision, as the conversation
// records it.
func beforeOf(before []discussion.BeforeDraft) []session.DraftBefore {
	drafts := make([]session.DraftBefore, 0, len(before))
	for _, b := range before {
		drafts = append(drafts, session.DraftBefore{
			Title:           b.Title,
			Kind:            string(b.Kind),
			Decision:        string(b.Decision),
			Outcome:         string(b.Outcome),
			Reference:       b.Reference,
			Changes:         b.Changes,
			Dropped:         b.Dropped,
			Added:           b.Added,
			ApprovalCleared: b.ApprovalCleared,
		})
	}
	return drafts
}

// setUnreadable records why the drafts artifact could not be read, "" once one
// is read, and says whether that changed.
func (s *Service) setUnreadable(id, reason string) bool {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	changed := l.unreadable != reason
	l.unreadable = reason
	return changed
}

// catalogOf is the board an artifact is checked against: the repositories it
// manages, the cards of its last reading and its module field.
func (s *Service) catalogOf(stored discussion.Discussion) discussion.Catalog {
	catalog := discussion.Catalog{Cards: map[string]discussion.InputCard{}}
	for _, repo := range s.boardRepositories(stored.BoardID) {
		catalog.Repositories = append(catalog.Repositories, repo.FullName())
	}

	reading := s.boards.Stored(stored.BoardID).Reading
	if reading == nil {
		return catalog
	}
	for _, card := range reading.Cards {
		catalog.Cards[card.Key()] = inputCard(card)
	}
	if reading.Module != nil {
		catalog.HasModule = true
		for _, option := range reading.Module.Options {
			catalog.ModuleOptions = append(catalog.ModuleOptions, option.Name)
		}
	}
	return catalog
}
