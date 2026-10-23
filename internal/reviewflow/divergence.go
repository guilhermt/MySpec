package reviewflow

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/guilhermt/myspec/internal/divergence"
	"github.com/guilhermt/myspec/internal/prreport"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/session"
)

// The ways the flow refuses to act on a divergence.
var (
	ErrNoDivergence = errors.New("reviewflow: the item has no divergence")
	ErrNotAskable   = errors.New("reviewflow: the agent can't be asked again about this divergence")
	ErrNotAdoptable = errors.New("reviewflow: this divergence has nothing to adopt")
	ErrNoCandidate  = errors.New("reviewflow: the choice is not one of the candidates")
)

// reportKinds are the divergences of the report of a pass.
var reportKinds = []divergence.Kind{
	divergence.KindReportMissing, divergence.KindReportUnreadable, divergence.KindReportsAmbiguous,
}

// reportUnreadablePrefix opens the reason a report can't be read, which the
// message to the agent says in its own words.
const reportUnreadablePrefix = "The report can't be read: "

// diverge opens the divergence of a review and, when it is new, marks it in the
// conversation. A review has one divergence at most: this one replaces the one
// it had.
func (s *Service) diverge(ctx context.Context, stored prreview.Review, kind divergence.Kind, facts divergence.Facts) {
	d := divergence.Divergence{ItemID: stored.ID, Stage: session.ReviewStage, Kind: kind, Facts: facts}
	opened, err := s.divergences.Open(ctx, d)
	if err != nil {
		s.log.Error("open divergence failed", "review", stored.ID, "kind", string(kind), "error", err)
		return
	}
	if !opened {
		return
	}
	s.sessions.MarkDivergence(ctx, sessionKey(stored.ID), d)
	s.log.Info("review diverged", "review", stored.ID, "kind", string(kind))
}

// clearDivergence ends the divergence of a review, only when it is one of
// kinds if any are given.
func (s *Service) clearDivergence(ctx context.Context, id string, kinds ...divergence.Kind) {
	if err := s.divergences.Clear(ctx, id, kinds...); err != nil {
		s.log.Error("clear divergence failed", "review", id, "error", err)
	}
}

// reopen puts back a divergence an operation cleared and then failed, without
// marking it again: the conversation already says it.
func (s *Service) reopen(ctx context.Context, d divergence.Divergence) {
	if _, err := s.divergences.Open(ctx, d); err != nil {
		s.log.Error("reopen divergence failed", "review", d.ItemID, "kind", string(d.Kind), "error", err)
	}
}

// CheckAgain reads the real state of a review again and evaluates it, which is
// what the user asks for after sorting a divergence out by hand. A push the
// remote rejected is tried again. It returns at once.
func (s *Service) CheckAgain(ctx context.Context, id string) error {
	d, ok := s.divergences.Get(id)
	if !ok {
		return fmt.Errorf("check review %s again: %w", id, ErrNoDivergence)
	}
	if err := s.RefreshPR(ctx, id); err != nil {
		return fmt.Errorf("check review %s again: %w", id, err)
	}
	if d.Kind == divergence.KindPushRejected {
		s.spawnPush(id)
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
		return fmt.Errorf("ask review %s again: %w", id, ErrNoDivergence)
	}
	switch d.Kind {
	case divergence.KindReportMissing, divergence.KindReportUnreadable, divergence.KindReportsAmbiguous:
		return s.askReportAgain(ctx, d)
	case divergence.KindCommitMissing:
		return s.askCommitAgain(ctx, d)
	case divergence.KindNoChanges:
		return s.askApplyAgain(ctx, d)
	default:
		return fmt.Errorf("ask review %s again about %s: %w", id, d.Kind, ErrNotAskable)
	}
}

// Adopt accepts what the app found in place of what it expected. choice is the
// path of a candidate report, relative to the artifacts folder; "" is for the
// divergences with one way out.
func (s *Service) Adopt(ctx context.Context, id, choice string) error {
	l := s.lockOf(id)
	l.mu.Lock()
	defer l.mu.Unlock()

	d, ok := s.divergences.Get(id)
	if !ok {
		return fmt.Errorf("adopt in review %s: %w", id, ErrNoDivergence)
	}
	switch d.Kind {
	case divergence.KindReportsAmbiguous:
		return s.adoptReport(d, choice)
	case divergence.KindNoChanges:
		return s.adoptNoChanges(ctx, d)
	default:
		return fmt.Errorf("adopt in review %s for %s: %w", id, d.Kind, ErrNotAdoptable)
	}
}

// askReportAgain asks the reviewer for the report of the pass it did not
// leave, or left unreadable. The caller holds the lock of the review.
func (s *Service) askReportAgain(ctx context.Context, d divergence.Divergence) error {
	stored, repo, wt, err := s.active(d.ItemID)
	if err != nil {
		return fmt.Errorf("ask review %s again: %w", d.ItemID, err)
	}
	sum, err := s.readySession(ctx, stored, repo, wt)
	if err != nil {
		return fmt.Errorf("ask review %s again: %w", d.ItemID, err)
	}
	if !sum.Idle {
		return fmt.Errorf("ask review %s again: %w", d.ItemID, ErrBusy)
	}
	if err = s.divergences.Clear(ctx, d.ItemID, reportKinds...); err != nil {
		return err
	}
	// The same pass, with the same instructions: the reviewer is asked for the
	// report again, not for another pass.
	asked, _ := s.passOf(d.ItemID, d.Facts.Pass)
	if _, err = s.reviews.AskPass(ctx, d.ItemID, d.Facts.Pass, asked.Instructions); err != nil {
		s.reopen(ctx, d)
		return err
	}
	message := session.AppMessage{
		Kind: session.AppAgain, Pass: d.Facts.Pass, Text: reportAgainMessage(d.Facts.Pass, d.Facts.Path, d.Facts.Reason),
	}
	if err = s.sessions.SendFromApp(ctx, sessionKey(d.ItemID), message); err != nil {
		s.reopen(ctx, d)
		return err
	}
	s.setUnreadable(d.ItemID, "")
	s.log.Info("review report asked again", "review", d.ItemID, "pass", d.Facts.Pass)
	s.notify(d.ItemID)
	return nil
}

// adoptReport copies the candidate the user chose to the path of the report of
// the pass and evaluates the review again. The caller holds the lock of the
// review.
func (s *Service) adoptReport(d divergence.Divergence, choice string) error {
	if !slices.Contains(d.Facts.Candidates, choice) {
		return fmt.Errorf("adopt %q in review %s: %w", choice, d.ItemID, ErrNoCandidate)
	}
	stored, ok := s.reviews.Get(d.ItemID)
	if !ok {
		return fmt.Errorf("adopt %q in review %s: %w", choice, d.ItemID, prreview.ErrNotFound)
	}
	if err := prreport.AdoptReport(stored.ArtifactsDir, choice, d.Facts.Path); err != nil {
		return fmt.Errorf("adopt %q in review %s: %w", choice, d.ItemID, err)
	}
	s.log.Info("review report adopted", "review", d.ItemID, "file", choice)
	s.Check(d.ItemID)
	return nil
}

// askCommitAgain asks for the commit the last commit turn did not make, as the
// approval of the changes does. The caller holds the lock of the review.
func (s *Service) askCommitAgain(ctx context.Context, d divergence.Divergence) error {
	stored, repo, wt, err := s.active(d.ItemID)
	if err != nil {
		return fmt.Errorf("ask review %s again: %w", d.ItemID, err)
	}
	ref := stored.Reference(repo.FullName())
	snap, read := s.watch.Snapshot(d.ItemID)
	if stored.Phase != prreview.PhaseApplying || !read || !snap.Ready() {
		return fmt.Errorf("ask review %s again about the commit: %w", ref, ErrNotReady)
	}
	sum, err := s.readySession(ctx, stored, repo, wt)
	if err != nil {
		return fmt.Errorf("ask review %s again: %w", ref, err)
	}
	if !sum.Idle {
		return fmt.Errorf("ask review %s again: %w", ref, ErrBusy)
	}
	if err = s.divergences.Clear(ctx, d.ItemID, divergence.KindCommitMissing); err != nil {
		return err
	}
	if err = s.askCommit(ctx, stored, wt, ref, snap.Total); err != nil {
		s.reopen(ctx, d)
		return err
	}
	return nil
}

// askApplyAgain sends the implementer the approved findings of the pass once
// more, as Apply does, without changing the phase. The caller holds the lock of
// the review.
func (s *Service) askApplyAgain(ctx context.Context, d divergence.Divergence) error {
	stored, repo, wt, err := s.active(d.ItemID)
	if err != nil {
		return fmt.Errorf("ask review %s again: %w", d.ItemID, err)
	}
	last, ok := s.passOf(d.ItemID, d.Facts.Pass)
	if !ok {
		return fmt.Errorf("ask review %s again: %w", d.ItemID, prreview.ErrNotFound)
	}
	sum, err := s.readySession(ctx, stored, repo, wt)
	if err != nil {
		return fmt.Errorf("ask review %s again: %w", d.ItemID, err)
	}
	if !sum.Idle {
		return fmt.Errorf("ask review %s again: %w", d.ItemID, ErrBusy)
	}
	if err = s.divergences.Clear(ctx, d.ItemID, divergence.KindNoChanges); err != nil {
		return err
	}
	err = s.sessions.SendFromApp(ctx, sessionKey(d.ItemID), session.AppMessage{
		Text: prreport.ApplyMessage(last.Number, prreview.ReportFindings(last.Findings)),
		Kind: session.AppApply, Count: len(last.Approved()),
	})
	if err != nil {
		s.reopen(ctx, d)
		return err
	}
	s.watch.Track(d.ItemID, wt, false)
	s.log.Info("review fixes asked again", "review", d.ItemID, "pass", last.Number)
	s.notify(d.ItemID)
	return nil
}

// adoptNoChanges takes the pass as applied although no file changed: the
// findings are not the user's to decide on again, and the review goes on from
// the pass. The caller holds the lock of the review.
func (s *Service) adoptNoChanges(ctx context.Context, d divergence.Divergence) error {
	stored, ok := s.reviews.Get(d.ItemID)
	if !ok {
		return fmt.Errorf("adopt in review %s: %w", d.ItemID, prreview.ErrNotFound)
	}
	if err := s.reviews.MarkApplied(ctx, d.ItemID, stored.ReportedPass); err != nil {
		return err
	}
	if err := s.setPhase(ctx, d.ItemID, prreview.PhaseNone); err != nil {
		return err
	}
	if err := s.divergences.Clear(ctx, d.ItemID, divergence.KindNoChanges); err != nil {
		return err
	}
	s.watch.Forget(d.ItemID)
	s.log.Info("review pass adopted as applied", "review", d.ItemID, "pass", stored.ReportedPass)
	s.notify(d.ItemID)
	return nil
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
