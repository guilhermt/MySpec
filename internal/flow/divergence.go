package flow

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/guilhermt/myspec/internal/divergence"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

// Divergences is what the flow needs from internal/divergence.
type Divergences interface {
	Get(itemID string) (divergence.Divergence, bool)
	Open(ctx context.Context, d divergence.Divergence) (bool, error)
	Clear(ctx context.Context, itemID string, kinds ...divergence.Kind) error
	Forget(itemID string)
}

// The ways the flow refuses to act on a divergence.
var (
	ErrNoDivergence = errors.New("flow: the item has no divergence")
	ErrNotAskable   = errors.New("flow: the agent can't be asked again about this divergence")
	ErrNotAdoptable = errors.New("flow: this divergence has nothing to adopt")
	ErrNoCandidate  = errors.New("flow: the choice is not one of the candidates")
)

// reportKinds are the divergences of the report of a pass.
var reportKinds = []divergence.Kind{
	divergence.KindReportMissing, divergence.KindReportUnreadable, divergence.KindReportsAmbiguous,
}

// reportUnreadablePrefix opens the reason a report can't be read, which the
// message to the agent says in its own words.
const reportUnreadablePrefix = "The report can't be read: "

// diverge opens the divergence of a task in the conversation stage and, when it
// is new, marks it there. A task has one divergence at most: this one replaces
// the one it had.
func (s *Service) diverge(
	ctx context.Context, t task.Task, stage string, kind divergence.Kind, facts divergence.Facts,
) {
	d := divergence.Divergence{ItemID: t.ID, Stage: stage, Kind: kind, Facts: facts}
	opened, err := s.divergences.Open(ctx, d)
	if err != nil {
		s.log.Error("open divergence failed", "task", t.ID, "stage", stage, "kind", string(kind), "error", err)
		return
	}
	if !opened {
		return
	}
	s.sessions.MarkDivergence(ctx, session.Key{TaskID: t.ID, Stage: stage}, d)
	s.log.Info("task diverged", "task", t.ID, "stage", stage, "kind", string(kind))
}

// reopen puts back a divergence an operation cleared and then failed, without
// marking it again: the conversation already says it.
func (s *Service) reopen(ctx context.Context, d divergence.Divergence) {
	if _, err := s.divergences.Open(ctx, d); err != nil {
		s.log.Error("reopen divergence failed", "task", d.ItemID, "kind", string(d.Kind), "error", err)
	}
}

// CheckAgain reads the real state of a task again and evaluates it, which is
// what the user asks for after sorting a divergence out by hand. It returns at
// once.
func (s *Service) CheckAgain(_ context.Context, id string) error {
	if _, ok := s.divergences.Get(id); !ok {
		return fmt.Errorf("check task %s again: %w", id, ErrNoDivergence)
	}
	if _, ok := s.worktrees.Get(id); ok {
		s.review.Refresh(id)
	}
	s.Check(id)
	return nil
}

// AskAgain sends the agent the instruction of the divergence once more. The
// state the instruction expects is recorded and the divergence ends before the
// send, and a send that fails brings the divergence back.
func (s *Service) AskAgain(ctx context.Context, id string) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	d, ok := s.divergences.Get(id)
	if !ok {
		return fmt.Errorf("ask again in task %s: %w", id, ErrNoDivergence)
	}
	switch d.Kind {
	case divergence.KindCommitMissing:
		return s.askStepCommitAgain(ctx, d)
	case divergence.KindReportMissing, divergence.KindReportUnreadable, divergence.KindReportsAmbiguous:
		return s.askStepReportAgain(ctx, d)
	default:
		return fmt.Errorf("ask again in task %s about %s: %w", id, d.Kind, ErrNotAskable)
	}
}

// Adopt accepts what the app found in place of what it expected. choice is the
// path of a candidate, relative to the artifacts folder, or the number of a pull
// request in text; "" is for the divergences with one way out.
func (s *Service) Adopt(_ context.Context, id, choice string) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	d, ok := s.divergences.Get(id)
	if !ok {
		return fmt.Errorf("adopt in task %s: %w", id, ErrNoDivergence)
	}
	switch d.Kind {
	case divergence.KindReportsAmbiguous:
		return s.adoptStepReport(d, choice)
	default:
		return fmt.Errorf("adopt in task %s for %s: %w", id, d.Kind, ErrNotAdoptable)
	}
}

// hasCandidate says whether choice is one of the files a divergence found.
func hasCandidate(d divergence.Divergence, choice string) bool {
	return slices.Contains(d.Facts.Candidates, choice)
}

// reportAgainMessage is what the app tells the agent when the report of a pass
// is not where it asked for it, or can't be read.
func reportAgainMessage(pass int, path, reason string) string {
	if reason == "" {
		return fmt.Sprintf("The report of pass %d isn't at `%s`. Write it there, in the format the instructions of this session give, and stop.", pass, path)
	}
	reason = strings.TrimSuffix(strings.TrimPrefix(reason, reportUnreadablePrefix), ".")
	return fmt.Sprintf("The report of pass %d at `%s` can't be read: %s. Rewrite it there, in the format the instructions of this session give, and stop.", pass, path, reason)
}
