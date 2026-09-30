package reviewflow

import (
	"context"
	"errors"
	"slices"

	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/worktree"
)

// evaluate keeps a review in step with its conversation: it records the
// report of the pass it asked for, and reads the report of the pass being
// decided again, which is how a rewrite the user asked for in the
// conversation reaches the list of findings. In apply mode it also moves the
// cycle that fixes the approved findings on.
func (s *Service) evaluate(ctx context.Context, id string) {
	if s.isClosed() {
		return
	}
	stored, ok := s.reviews.Get(id)
	if !ok {
		return
	}
	wt, ok := s.worktrees.Get(id)
	if !ok {
		return
	}
	// The conversation is opened by Start, by Sync and by a new pass: an
	// evaluation never opens one.
	key := sessionKey(id)
	sum, open := s.sessions.Summary(key)
	if !open {
		return
	}

	if sum.Idle {
		switch {
		case stored.AskedPass > stored.ReportedPass:
			s.recordAsked(ctx, stored, wt, key)
		case stored.ReportedPass > 0:
			s.rereadPass(ctx, stored)
		}
	}
	if stored.Mode == prreview.ModeApply {
		s.evaluateApply(ctx, id, wt, sum.Idle)
	}
}

// recordAsked records the report of the pass the app asked for, once the
// agent has written one. A pass that rested without a report leaves the
// review waiting for the user.
func (s *Service) recordAsked(
	ctx context.Context, stored prreview.Review, wt worktree.Worktree, key session.Key,
) {
	pass := stored.AskedPass
	report, ok, err := prreview.ReadReport(stored.ReportPath(pass), pass)
	if err != nil {
		s.reportUnreadable(stored.ID, pass, err)
		return
	}
	if !ok {
		return
	}

	if _, _, err = s.reviews.RecordReport(ctx, stored.ID, report, s.headOf(ctx, wt)); err != nil {
		s.log.Error("record review report failed", "review", stored.ID, "pass", pass, "error", err)
		return
	}
	s.sessions.MarkPRReview(ctx, key, pass, report.Clean, len(report.Findings))
	s.setUnreadable(stored.ID, "")
	s.log.Info("review report recorded", "review", stored.ID, "pass", pass)
	s.notify(stored.ID)
}

// rereadPass reads the report of the pass being decided again: the agent
// rewrites it in place when the user asks in the conversation for a finding to
// be added, changed or removed, and what the user already decided on the
// findings that did not change is kept.
func (s *Service) rereadPass(ctx context.Context, stored prreview.Review) {
	pass := stored.ReportedPass
	last, ok := s.passOf(stored.ID, pass)
	if !ok || last.Published() {
		return
	}
	report, ok, err := prreview.ReadReport(stored.ReportPath(pass), pass)
	if err != nil {
		// What was recorded stays: a rewrite the app cannot read changes
		// nothing about the findings the user is deciding on.
		s.reportUnreadable(stored.ID, pass, err)
		return
	}
	if !ok {
		return
	}

	_, change, err := s.reviews.RecordReport(ctx, stored.ID, report, last.Commit)
	if err != nil {
		s.log.Error("record review report failed", "review", stored.ID, "pass", pass, "error", err)
		return
	}
	// A rewrite that brought the report back to what was recorded changes no
	// finding, but it does settle the warning that the app could not read it.
	settled := s.setUnreadable(stored.ID, "")
	switch change {
	case prreview.ChangeNone:
		if settled {
			s.notify(stored.ID)
		}
		return
	case prreview.ChangeTitles:
		// Only the titles of the findings came in: nothing the user decided on
		// changed, so there is no rewrite to tell.
		s.notify(stored.ID)
		return
	case prreview.ChangeRevised:
		s.sessions.MarkPRReviewRevised(ctx, sessionKey(stored.ID), pass, report.Clean, len(report.Findings))
	}
	s.log.Info("review report rewritten", "review", stored.ID, "pass", pass)
	s.notify(stored.ID)
}

// reportUnreadable keeps why the report of a pass could not be read, so that
// the review says it instead of waiting for a report that will never come.
func (s *Service) reportUnreadable(id string, pass int, err error) {
	if !errors.Is(err, prreview.ErrUnreadable) {
		s.log.Error("read review report failed", "review", id, "pass", pass, "error", err)
		return
	}
	s.log.Warn("review report is unreadable", "review", id, "pass", pass, "error", err)
	if s.setUnreadable(id, prreview.Reason(err)) {
		s.notify(id)
	}
}

// setUnreadable records why the report of the pass the app asked for could not
// be read, "" once one is read, and says whether that changed.
func (s *Service) setUnreadable(id, reason string) bool {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	changed := l.unreadable != reason
	l.unreadable = reason
	return changed
}

// passOf is a pass of a review as the app holds it now.
func (s *Service) passOf(id string, number int) (prreview.Pass, bool) {
	passes := s.reviews.Passes(id)
	index := slices.IndexFunc(passes, func(p prreview.Pass) bool { return p.Number == number })
	if index < 0 {
		return prreview.Pass{}, false
	}
	return passes[index], true
}
