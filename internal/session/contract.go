package session

import (
	"cmp"
	"strings"

	"github.com/guilhermt/myspec/internal/contract"
)

// roleOf is what a session is for, which is what its git and GitHub contract
// depends on.
func roleOf(t TaskInfo) contract.Role {
	if _, ok := ParseStepStage(t.Stage); ok {
		return contract.RoleStep
	}
	if _, ok := ParseStepReviewStage(t.Stage); ok {
		return contract.RoleStepReview
	}
	switch t.Stage {
	case PRStage:
		return contract.RolePRDraft
	case PRReviewStage:
		return contract.RolePRReview
	case PRFixStage:
		return contract.RolePRFix
	case ReviewStage:
		if t.Publish {
			return contract.RoleReviewPublish
		}
		return contract.RoleReviewApply
	case DiscussionStage:
		return contract.RoleDiscussion
	default:
		return contract.RolePlanning
	}
}

// turnOf is the turn a message opens: what the app asked of the agent with it.
func turnOf(e *Entry, t TaskInfo) contract.Turn {
	u := e.User
	if u == nil {
		return contract.TurnNone
	}
	switch u.AppKind {
	case AppCommit, AppCommitAll, AppCommitPush, AppCommitAllPush:
		return contract.TurnCommit
	case AppApply, AppReport:
		return contract.TurnApply
	default:
	}
	if u.Prompt && t.Stage == PRFixStage && (t.Request.Kind == AppApply || t.Request.Kind == AppReport) {
		return contract.TurnApply
	}
	return contract.TurnNone
}

// stateOf is what the hook of the Claude Code knows about the session.
func stateOf(r *run, turn contract.Turn) contract.State {
	t := r.task
	return contract.State{
		Role:   roleOf(t),
		Turn:   turn,
		Branch: cmp.Or(t.Branch, t.HeadBranch),
		Base:   strings.TrimPrefix(t.BaseBranch, "origin/"),
		Step:   t.Step,
	}
}

// writeContractLocked records the turn the session is in for the hook. A
// failure only reaches the log: the hook fails closed, so a missing state
// makes it ask, never let an action through.
func (s *Service) writeContractLocked(r *run, turn contract.Turn) {
	if s.hooksDir == "" {
		return
	}
	if err := contract.WriteState(s.hooksDir, r.rec.ID, stateOf(r, turn)); err != nil {
		s.log.Warn("contract state write failed", "task", r.task.ID, "stage", r.rec.Stage, "error", err)
	}
}

// removeContract deletes the state file of a session that is gone.
func (s *Service) removeContract(r *run) {
	if s.hooksDir == "" {
		return
	}
	if err := contract.RemoveState(s.hooksDir, r.rec.ID); err != nil {
		s.log.Warn("contract state remove failed", "task", r.task.ID, "stage", r.rec.Stage, "error", err)
	}
}
