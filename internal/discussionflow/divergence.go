package discussionflow

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/divergence"
	"github.com/guilhermt/myspec/internal/session"
)

// The ways the flow refuses to act on a divergence.
var (
	ErrNoDivergence = errors.New("discussionflow: the item has no divergence")
	ErrNotAskable   = errors.New("discussionflow: the agent can't be asked again about this divergence")
)

// diverge opens the divergence of a discussion in its conversation and, when it
// is new, marks it there. A discussion has one divergence at most.
func (s *Service) diverge(ctx context.Context, id string, kind divergence.Kind, facts divergence.Facts) {
	d := divergence.Divergence{ItemID: id, Stage: session.DiscussionStage, Kind: kind, Facts: facts}
	opened, err := s.divergences.Open(ctx, d)
	if err != nil {
		s.log.Error("open divergence failed", "discussion", id, "kind", string(kind), "error", err)
		return
	}
	if !opened {
		return
	}
	s.sessions.MarkDivergence(ctx, sessionKey(id), d)
	s.log.Info("discussion diverged", "discussion", id, "kind", string(kind))
	s.notify(id)
}

// clearDivergence ends the divergence of a discussion, only when it is one of
// kinds if any are given.
func (s *Service) clearDivergence(ctx context.Context, id string, kinds ...divergence.Kind) {
	if err := s.divergences.Clear(ctx, id, kinds...); err != nil {
		s.log.Error("clear divergence failed", "discussion", id, "error", err)
	}
}

// CheckAgain reads the drafts of a discussion again, which is what the user
// asks for after fixing them by hand. It returns at once.
func (s *Service) CheckAgain(_ context.Context, id string) error {
	if _, ok := s.divergences.Get(id); !ok {
		return fmt.Errorf("check discussion %s again: %w", id, ErrNoDivergence)
	}
	s.Check(id)
	return nil
}

// AskAgain sends the agent the correction of the drafts once more, without
// counting it as the one the app makes by itself. The divergence ends before the
// send, and a send that fails brings it back.
func (s *Service) AskAgain(ctx context.Context, id string) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	d, ok := s.divergences.Get(id)
	if !ok {
		return fmt.Errorf("ask discussion %s again: %w", id, ErrNoDivergence)
	}
	if d.Kind != divergence.KindDraftsUnreadable {
		return fmt.Errorf("ask discussion %s again about %s: %w", id, d.Kind, ErrNotAskable)
	}
	stored, ok := s.discussions.Get(id)
	if !ok {
		return fmt.Errorf("ask discussion %s again: %w", id, discussion.ErrNotFound)
	}
	if err := s.divergences.Clear(ctx, id, divergence.KindDraftsUnreadable); err != nil {
		return err
	}
	message := session.AppMessage{
		Kind: session.AppDraftsCorrection, Text: draftsCorrectionMessage(stored.DraftsPath(), d.Facts.Reason),
	}
	if err := s.sessions.SendFromApp(ctx, sessionKey(id), message); err != nil {
		if _, reopenErr := s.divergences.Open(ctx, d); reopenErr != nil {
			s.log.Error("reopen divergence failed", "discussion", id, "error", reopenErr)
		}
		return err
	}
	s.log.Info("discussion drafts asked again", "discussion", id)
	s.notify(id)
	return nil
}

// draftsCorrectionMessage is what the app tells the agent when it can't read
// the drafts artifact.
func draftsCorrectionMessage(path, reason string) string {
	reason = strings.TrimSuffix(reason, ".")
	return fmt.Sprintf("The app can't read `%s`: %s. Rewrite it in the format the instructions of this session give, keeping the ids of the drafts, and stop.", path, reason)
}
