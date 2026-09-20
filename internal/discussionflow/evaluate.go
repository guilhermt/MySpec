package discussionflow

import (
	"context"
	"errors"
	"os"
	"strconv"

	"github.com/guilhermt/myspec/internal/discussion"
)

// evaluate keeps a discussion in step with its conversation: it notices the
// document the agent writes and records the drafts of the artifact once the
// agent rests.
func (s *Service) evaluate(ctx context.Context, id string) {
	if s.isClosed() {
		return
	}
	stored, ok := s.discussions.Get(id)
	if !ok {
		return
	}
	s.stampDocument(s.lockOf(id), stored)

	// The conversation is opened by Start and by Sync: an evaluation never
	// opens one.
	sum, open := s.sessions.Summary(sessionKey(id))
	if !open {
		return
	}
	if sum.Idle {
		s.readDrafts(ctx, stored)
	}
}

// stampDocument looks at the document of the discussion: the interface reads
// it again every time it changes.
func (s *Service) stampDocument(l *discussionLock, stored discussion.Discussion) {
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
		s.draftsUnreadable(stored.ID, err)
		return
	}
	if !ok {
		return
	}
	if err = discussion.Validate(artifact, s.catalogOf(stored)); err != nil {
		s.draftsUnreadable(stored.ID, err)
		return
	}

	changed, err := s.discussions.RecordDrafts(ctx, stored.ID, artifact)
	if err != nil {
		s.log.Error("record discussion drafts failed", "discussion", stored.ID, "error", err)
		return
	}
	// A rewrite that brought the artifact back to what was recorded changes no
	// draft, but it does settle the warning that the app could not read it.
	settled := s.setUnreadable(stored.ID, "")
	if changed || settled {
		s.notify(stored.ID)
	}
}

// draftsUnreadable keeps why the drafts artifact could not be read, so that
// the discussion says it instead of waiting for drafts that will never come.
func (s *Service) draftsUnreadable(id string, err error) {
	if !errors.Is(err, discussion.ErrUnreadable) {
		s.log.Error("read discussion drafts failed", "discussion", id, "error", err)
		return
	}
	s.log.Warn("discussion drafts are unreadable", "discussion", id, "error", err)
	if s.setUnreadable(id, err.Error()) {
		s.notify(id)
	}
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
