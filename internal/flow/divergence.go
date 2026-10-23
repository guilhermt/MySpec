package flow

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strconv"
	"strings"

	"github.com/guilhermt/myspec/internal/divergence"
	"github.com/guilhermt/myspec/internal/prompts"
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

// draftUnreadablePrefix opens the reason a draft can't be read.
const draftUnreadablePrefix = "The draft can't be read: "

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
func (s *Service) CheckAgain(ctx context.Context, id string) error {
	d, ok := s.divergences.Get(id)
	if !ok {
		return fmt.Errorf("check task %s again: %w", id, ErrNoDivergence)
	}
	if _, ok := s.worktrees.Get(id); ok {
		s.review.Refresh(id)
	}
	if t, ok := s.tasks.Get(id); ok && t.Stage == task.StagePR {
		if d.Kind == divergence.KindPushRejected && d.Stage == session.PRReviewStage {
			// The remote may take the commit now: the push that was held is tried
			// in the evaluation that follows.
			s.setRetryPush(id)
		}
		if d.Kind == divergence.KindPushRejected && d.Stage == session.PRStage {
			// The branch of a pull request that was never opened is pushed by the
			// next approval of the draft: what the user did about the remote is
			// what that push finds out.
			s.clearDivergence(ctx, id, divergence.KindPushRejected)
		}
		s.spawnPRWork(id, s.checkPR)
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
		if isPRStage(d.Stage) {
			return s.askPRCommitAgain(ctx, d)
		}
		return s.askStepCommitAgain(ctx, d)
	case divergence.KindReportMissing, divergence.KindReportUnreadable, divergence.KindReportsAmbiguous:
		if isPRStage(d.Stage) {
			return s.askPRReportAgain(ctx, d)
		}
		return s.askStepReportAgain(ctx, d)
	case divergence.KindNoChanges:
		return s.askPassWorkAgain(ctx, d)
	case divergence.KindDraftMissing, divergence.KindDraftUnreadable:
		return s.askDraftAgain(ctx, d)
	default:
		return fmt.Errorf("ask again in task %s about %s: %w", id, d.Kind, ErrNotAskable)
	}
}

// Adopt accepts what the app found in place of what it expected. choice is the
// path of a candidate, relative to the artifacts folder, or the number of a pull
// request in text; "" is for the divergences with one way out.
func (s *Service) Adopt(ctx context.Context, id, choice string) error {
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
	case divergence.KindNoChanges:
		return s.adoptPassWork(ctx, d)
	case divergence.KindPRWrongBase, divergence.KindPROtherBranch, divergence.KindPRsAmbiguous:
		return s.adoptPR(ctx, d, choice)
	default:
		return fmt.Errorf("adopt in task %s for %s: %w", id, d.Kind, ErrNotAdoptable)
	}
}

// askDraftAgain asks the agent that drafts the pull request for the draft it
// did not leave, or left unreadable. The caller holds the lock of the task.
func (s *Service) askDraftAgain(ctx context.Context, d divergence.Divergence) error {
	t, run, err := s.prOf(d.ItemID)
	if err != nil {
		return err
	}
	if run.Status != task.PRDrafting {
		return fmt.Errorf("ask again about the draft of task %s: %w", d.ItemID, ErrDraftMissing)
	}
	key := session.Key{TaskID: d.ItemID, Stage: session.PRStage}
	if _, err := s.readySession(ctx, key); err != nil {
		return fmt.Errorf("ask again about the draft of task %s: %w", d.ItemID, err)
	}
	if err := s.divergences.Clear(ctx, d.ItemID, prDraftKinds...); err != nil {
		return err
	}
	message := session.AppMessage{Kind: session.AppAgain, Text: draftAgainMessage(t.DraftPath(), d.Facts.Reason)}
	if err := s.sessions.SendFromApp(ctx, key, message); err != nil {
		s.reopen(ctx, d)
		return err
	}
	s.log.Info("draft asked again", "task", d.ItemID)
	return nil
}

// adoptPR takes the pull request the app found as the one of the task: it is
// read by its number and recorded, and the task reads it and pushes to it from
// then on. The caller holds the lock of the task.
func (s *Service) adoptPR(ctx context.Context, d divergence.Divergence, choice string) error {
	if choice == "" && len(d.Facts.PRs) == 1 {
		choice = strconv.Itoa(d.Facts.PRs[0].Number)
	}
	if !slices.ContainsFunc(d.Facts.PRs, func(pr divergence.PR) bool { return strconv.Itoa(pr.Number) == choice }) {
		return fmt.Errorf("adopt %q in task %s: %w", choice, d.ItemID, ErrNoCandidate)
	}
	wt, ok := s.worktrees.Get(d.ItemID)
	if !ok {
		return fmt.Errorf("adopt %q in task %s: %w", choice, d.ItemID, ErrNoWorktree)
	}
	readCtx, cancel := context.WithTimeout(ctx, prCheckTimeout)
	defer cancel()
	number, _ := strconv.Atoi(choice)
	pr, err := s.viewPRNumber(readCtx, wt, number)
	if err != nil {
		return fmt.Errorf("adopt %q in task %s: %w", choice, d.ItemID, err)
	}
	s.recordPR(d.ItemID, pr, false)
	s.log.Info("pull request adopted", "task", d.ItemID, "number", pr.Number)
	return nil
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

// draftAgainMessage is what the app tells the agent when the draft of the pull
// request is not where it asked for it, or can't be read.
func draftAgainMessage(path, reason string) string {
	if reason == "" {
		return fmt.Sprintf("The draft of the pull request isn't at `%s`. Write it there, with the header the instructions of this session give, and stop.", path)
	}
	reason = strings.TrimSuffix(strings.TrimPrefix(reason, draftUnreadablePrefix), ".")
	return fmt.Sprintf("The draft of the pull request at `%s` can't be read: %s. Rewrite it there, with the header the instructions of this session give, and stop.", path, reason)
}

// askPRCommitAgain asks the implementer of a pull request review for the commit
// its last commit turn did not make, as the approval of the review does. A
// review by hand whose divergence asked for the staged changes only has to be
// ready to approve first. The caller holds the lock of the task.
func (s *Service) askPRCommitAgain(ctx context.Context, d divergence.Divergence) error {
	t, run, err := s.prOf(d.ItemID)
	if err != nil {
		return err
	}
	if run.Status != task.PRReviewing {
		return fmt.Errorf("ask again about the commit of task %s: %w", d.ItemID, ErrStepNotReady)
	}
	files := d.Facts.Files
	if !d.Facts.All {
		snap, read := s.review.Snapshot(d.ItemID)
		if !read || snap.Err != "" || !snap.Ready() {
			return fmt.Errorf("ask again about the commit of task %s: %w", d.ItemID, ErrStepNotReady)
		}
		files = snap.Total
	}
	if err = s.fixerAtRest(ctx, d.ItemID); err != nil {
		return fmt.Errorf("ask again about the commit of task %s: %w", d.ItemID, err)
	}
	vars := commitVars(t)
	vars.CommitAll = d.Facts.All
	message, err := s.renderPrompt(prompts.StageCommit, vars)
	if err != nil {
		return err
	}
	if _, err := s.tasks.SetPRRun(ctx, d.ItemID, task.PRCommitting, nil); err != nil {
		return err
	}
	if err := s.divergences.Clear(ctx, d.ItemID, divergence.KindCommitMissing); err != nil {
		s.backToReview(ctx, d.ItemID)
		return err
	}
	kind := session.AppCommit
	if d.Facts.All {
		kind = session.AppCommitAll
	}
	app := session.AppMessage{Text: message, Kind: kind}
	var approved func()
	if !d.Facts.All {
		approved = func() { s.sessions.MarkChangesApproved(ctx, prFixKey(d.ItemID), files) }
	}
	if err := s.sendToFixer(ctx, t, run, app, approved); err != nil {
		s.backToReview(ctx, d.ItemID)
		s.reopen(ctx, d)
		return err
	}
	s.log.Info("pr review asked to commit again", "task", d.ItemID, "all", d.Facts.All)
	return nil
}
