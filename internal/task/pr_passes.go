package task

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/guilhermt/myspec/internal/prreport"
)

// PRPass is one pass of the review of the pull request of a task that the app
// asked for with the structured format, with the report it recorded and what
// the user decided about its findings. A pass without one was asked before
// the format, and its report is read only for its verdict.
type PRPass struct {
	TaskID          string
	Pass            int
	AskedAt         time.Time
	Recorded        bool // a readable report was recorded
	Clean           bool
	SummaryOriginal string // as the report has it
	Revision        int    // bumped every time the report is read again and differs
	RecordedAt      time.Time
	SentAt          time.Time // when the approved findings went to the agent; zero before
	Findings        []prreport.Finding
}

// ErrPRPassRecorded refuses to ask again for a pass whose report is recorded.
var ErrPRPassRecorded = errors.New("task: the pass of the review already has a report")

// Sent reports whether the approved findings of the pass went to the agent.
func (p PRPass) Sent() bool { return !p.SentAt.IsZero() }

// Decided reports whether every finding of the pass has a decision.
func (p PRPass) Decided() bool {
	return !slices.ContainsFunc(p.Findings, func(f prreport.Finding) bool {
		return f.Decision == prreport.DecisionNone
	})
}

// Approved are the findings the user approved, in the order of the report.
func (p PRPass) Approved() []prreport.Finding {
	var approved []prreport.Finding
	for _, f := range p.Findings {
		if f.Decision == prreport.DecisionApproved {
			approved = append(approved, f)
		}
	}
	return approved
}

// AllDiscarded reports whether the pass is recorded with changes, not sent,
// and every finding of it was discarded: nothing is left to fix, and the pull
// request awaits its merge as after a clean pass.
func (p PRPass) AllDiscarded() bool {
	return p.Recorded && !p.Clean && !p.Sent() && len(p.Findings) > 0 && p.Decided() && len(p.Approved()) == 0
}

// PRPasses are the structured passes of the review of the pull request of a
// task, in order of pass; nil when it has none.
func (s *Service) PRPasses(id string) []PRPass {
	s.mu.Lock()
	defer s.mu.Unlock()

	return clonePRPasses(s.prPasses[id])
}

// AskPRPass records that the app asked for a pass with the structured format,
// replacing the row of the same pass whose report was not recorded.
func (s *Service) AskPRPass(ctx context.Context, id string, pass int) (PRPass, error) {
	if _, ok := s.Get(id); !ok {
		return PRPass{}, fmt.Errorf("ask pr pass %d of task %s: %w", pass, id, ErrNotFound)
	}
	if stored, ok := s.prPass(id, pass); ok && stored.Recorded {
		return PRPass{}, fmt.Errorf("ask pr pass %d of task %s: %w", pass, id, ErrPRPassRecorded)
	}

	asked := PRPass{TaskID: id, Pass: pass, AskedAt: s.now().UTC()}
	if err := s.writePRPass(ctx, asked); err != nil {
		return PRPass{}, err
	}

	s.log.Info("pr pass asked", "task", id, "pass", pass)
	s.changed()
	return asked, nil
}

// UnaskPRPass forgets a pass the app asked for whose report was not recorded,
// when the ask did not reach the agent. A missing or recorded pass is left as it is.
func (s *Service) UnaskPRPass(ctx context.Context, id string, pass int) error {
	stored, ok := s.prPass(id, pass)
	if !ok || stored.Recorded {
		return nil
	}
	if err := s.repo.DeletePRPass(ctx, id, pass); err != nil {
		return err
	}

	s.mu.Lock()
	s.prPasses[id] = slices.DeleteFunc(s.prPasses[id], func(p PRPass) bool { return p.Pass == pass })
	s.mu.Unlock()

	s.log.Info("pr pass unasked", "task", id, "pass", pass)
	s.changed()
	return nil
}

// RecordPRReport keeps the pass of the report in step with it: the first
// readable report is recorded as it is, and a later one that differs is
// reconciled with what the user decided. changed is false when nothing was
// written: the report says what was recorded, or the findings already went to
// the agent.
func (s *Service) RecordPRReport(ctx context.Context, id string, report prreport.Report) (PRPass, bool, error) {
	stored, ok := s.prPass(id, report.Pass)
	if !ok {
		return PRPass{}, false, fmt.Errorf("record report of pr pass %d of task %s: %w", report.Pass, id, ErrNotFound)
	}

	switch {
	case stored.Sent():
		return stored, false, nil
	case !stored.Recorded:
		stored.Recorded = true
		stored.Clean = report.Clean
		stored.SummaryOriginal = report.Summary
		stored.Revision = 1
		stored.RecordedAt = s.now().UTC()
		stored.Findings = prreport.Fresh(report.Findings)
	case prreport.Same(stored.SummaryOriginal, stored.Findings, report):
		return stored, false, nil
	default:
		stored.SummaryOriginal = report.Summary
		stored.Clean = report.Clean
		stored.Findings = prreport.Inherit(stored.Findings, report.Findings)
		stored.Revision++
	}

	if err := s.writePRPass(ctx, stored); err != nil {
		return PRPass{}, false, err
	}
	s.changed()
	return clonePRPass(stored), true, nil
}

// DecidePRFinding records what the user decided about a finding of a pass.
func (s *Service) DecidePRFinding(ctx context.Context, id string, pass, number int, d prreport.Decision) error {
	if _, err := prreport.ParseDecision(string(d)); err != nil {
		return fmt.Errorf("decide finding %d of pass %d of task %s: %w", number, pass, id, err)
	}
	return s.updatePRFinding(ctx, id, pass, number, func(f *prreport.Finding) {
		f.Decision = d
	})
}

// SetPRFindingText records the text of a finding as the user left it.
func (s *Service) SetPRFindingText(ctx context.Context, id string, pass, number int, text string) error {
	text = strings.TrimSpace(text)
	if text == "" {
		return fmt.Errorf("set text of finding %d of pass %d of task %s: %w", number, pass, id, prreport.ErrEmptyText)
	}
	return s.updatePRFinding(ctx, id, pass, number, func(f *prreport.Finding) {
		f.Text = text
	})
}

// ApproveRestOfPRFindings approves, in one write, every finding of a pass that
// has no decision yet, and leaves the decided ones as they are.
func (s *Service) ApproveRestOfPRFindings(ctx context.Context, id string, pass int) error {
	stored, ok := s.prPass(id, pass)
	if !ok {
		return fmt.Errorf("approve the rest of pass %d of task %s: %w", pass, id, ErrNotFound)
	}

	approved := 0
	for i := range stored.Findings {
		if stored.Findings[i].Decision == prreport.DecisionNone {
			stored.Findings[i].Decision = prreport.DecisionApproved
			approved++
		}
	}
	if approved == 0 {
		return nil
	}

	if err := s.writePRPass(ctx, stored); err != nil {
		return err
	}
	s.log.Info("pr findings approved", "task", id, "pass", pass, "findings", approved)
	s.changed()
	return nil
}

// MarkPRPassSent records that the approved findings of a pass went to the agent.
func (s *Service) MarkPRPassSent(ctx context.Context, id string, pass int) error {
	return s.setPRPassSent(ctx, id, pass, s.now().UTC())
}

// UnmarkPRPassSent forgets that the approved findings of a pass went to the
// agent, when the send failed.
func (s *Service) UnmarkPRPassSent(ctx context.Context, id string, pass int) error {
	return s.setPRPassSent(ctx, id, pass, time.Time{})
}

// setPRPassSent rewrites when the approved findings of a pass were sent.
func (s *Service) setPRPassSent(ctx context.Context, id string, pass int, at time.Time) error {
	stored, ok := s.prPass(id, pass)
	if !ok {
		return fmt.Errorf("set sent of pr pass %d of task %s: %w", pass, id, ErrNotFound)
	}
	stored.SentAt = at
	if err := s.writePRPass(ctx, stored); err != nil {
		return err
	}
	s.changed()
	return nil
}

// updatePRFinding rewrites one finding of a pass with mutate, in the store and
// then in the cache.
func (s *Service) updatePRFinding(
	ctx context.Context, id string, pass, number int, mutate func(*prreport.Finding),
) error {
	stored, ok := s.prPass(id, pass)
	if !ok {
		return fmt.Errorf("update finding %d of pass %d of task %s: %w", number, pass, id, ErrNotFound)
	}
	index := slices.IndexFunc(stored.Findings, func(f prreport.Finding) bool { return f.Number == number })
	if index < 0 {
		return fmt.Errorf("update finding %d of pass %d of task %s: %w", number, pass, id, ErrNotFound)
	}
	finding := stored.Findings[index]
	mutate(&finding)
	if err := s.repo.UpdatePRFinding(ctx, id, pass, finding); err != nil {
		return err
	}

	s.mu.Lock()
	if cached := s.prPassIndex(id, pass); cached >= 0 {
		if at := slices.IndexFunc(s.prPasses[id][cached].Findings, func(f prreport.Finding) bool {
			return f.Number == number
		}); at >= 0 {
			s.prPasses[id][cached].Findings[at] = finding
		}
	}
	s.mu.Unlock()

	s.changed()
	return nil
}

// prPass is a copy of a pass the cache holds.
func (s *Service) prPass(id string, pass int) (PRPass, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	index := s.prPassIndex(id, pass)
	if index < 0 {
		return PRPass{}, false
	}
	return clonePRPass(s.prPasses[id][index]), true
}

// prPassIndex finds a pass in the cache, -1 when it holds none. The caller
// holds the lock.
func (s *Service) prPassIndex(id string, pass int) int {
	return slices.IndexFunc(s.prPasses[id], func(p PRPass) bool { return p.Pass == pass })
}

// writePRPass stores a pass with its findings and then puts it in the cache,
// in its place by pass number.
func (s *Service) writePRPass(ctx context.Context, pass PRPass) error {
	if err := s.repo.WritePRPass(ctx, pass); err != nil {
		return err
	}

	pass = clonePRPass(pass)
	s.mu.Lock()
	defer s.mu.Unlock()

	if index := s.prPassIndex(pass.TaskID, pass.Pass); index >= 0 {
		s.prPasses[pass.TaskID][index] = pass
		return nil
	}
	s.prPasses[pass.TaskID] = append(s.prPasses[pass.TaskID], pass)
	slices.SortFunc(s.prPasses[pass.TaskID], func(a, b PRPass) int { return a.Pass - b.Pass })
	return nil
}

// clonePRPass copies the findings a pass carries, so that what a caller holds
// never changes under it.
func clonePRPass(pass PRPass) PRPass {
	pass.Findings = slices.Clone(pass.Findings)
	return pass
}

// clonePRPasses copies the passes and the findings each one carries.
func clonePRPasses(passes []PRPass) []PRPass {
	if len(passes) == 0 {
		return nil
	}
	out := make([]PRPass, len(passes))
	for i, pass := range passes {
		out[i] = clonePRPass(pass)
	}
	return out
}
