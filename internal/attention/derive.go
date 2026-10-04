package attention

import (
	"cmp"
	"slices"
	"strings"

	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

// Input is what the situations of one task are derived from, read once for
// the snapshot they go with.
type Input struct {
	Task      task.Task
	Artifacts task.Artifacts
	Steps     []flow.StepState
	PR        *flow.PullRequest // nil outside the PR stage
	Sessions  map[session.Key]session.Summary
}

// Derive lists the situations of one task: one per place at most, the most
// urgent one when more than one condition holds there.
func Derive(in Input) []Found {
	switch in.Task.Stage {
	case task.StagePRD, task.StageTechSpec, task.StagePlan, task.StageOneShot:
		if found, ok := stageSituation(in); ok {
			return []Found{found}
		}
	case task.StageImplementation:
		return stepSituations(in)
	case task.StagePR:
		if in.PR != nil {
			if found, ok := prSituation(in.Task, *in.PR); ok {
				return []Found{found}
			}
		}
	}
	return nil
}

// sessionKind is the situation the session of a place decides on its own:
// none at all while it is paused, or the error, the permission or the
// question it holds. decided is false when the session leaves the decision to
// the place.
func sessionKind(sum session.Summary) (kind Kind, decided bool) {
	switch {
	case sum.Status == session.StatusPaused:
		return "", true
	case sum.Status == session.StatusError || sum.TurnFailed:
		return KindSessionError, true
	case sum.Status == session.StatusNeedsPermission:
		return KindPermission, true
	case sum.Status == session.StatusNeedsAnswer:
		return KindQuestion, true
	default:
		return "", false
	}
}

// newFound is a situation of a task at a place, with the text of its
// notification.
func newFound(t task.Task, place Place, kind Kind, body string) Found {
	return Found{TaskID: t.ID, Place: place, Kind: kind, Title: t.Name, Body: body}
}

// stageSituation is the situation of a task in a planning stage. What the
// session of the stage holds comes first; with the agent at rest, the document
// of the stage tells a task the app moves on by itself from one that waits for
// the user.
func stageSituation(in Input) (Found, bool) {
	t, a := in.Task, in.Artifacts
	sum, open := in.Sessions[session.Key{TaskID: t.ID, Stage: string(t.Stage)}]
	if !open {
		return Found{}, false
	}
	place := Place{Kind: PlaceStage, Stage: t.Stage}
	if kind, decided := sessionKind(sum); decided {
		if kind == "" {
			return Found{}, false
		}
		return newFound(t, place, kind, sessionBody(kind, placeName(place, false))), true
	}
	if !sum.Idle {
		// The agent is working, or a message waits in the queue for it.
		return Found{}, false
	}
	if t.Stage == task.StagePlan && a.Plan.Present && !a.Plan.Valid() {
		if sum.Corrections < flow.MaxCorrections {
			// The app sends the agent the next correction on its own.
			return Found{}, false
		}
		return newFound(t, place, KindPlanInvalid, planInvalidBody(sum.Corrections)), true
	}
	if a.Done(t.Stage) {
		if !t.Revisiting {
			// The app moves the task to the next stage on its own.
			return Found{}, false
		}
		return newFound(t, place, KindReadyToContinue, readyToContinueBody(t.Stage)), true
	}
	return newFound(t, place, KindReply, sessionBody(KindReply, placeName(place, false))), true
}

// stepSituations are the situations of a task in implementation, the ones of
// its current step, the first one that is not done: the step and its reviewer
// are places of their own, each with one situation at most.
func stepSituations(in Input) []Found {
	index := slices.IndexFunc(in.Steps, func(state flow.StepState) bool { return state.Status != flow.StepDone })
	if index < 0 {
		return nil
	}
	step := in.Steps[index]
	var situations []Found
	if found, ok := stepSituation(in.Task, step, in.Sessions); ok {
		situations = append(situations, found)
	}
	if found, ok := reviewerSituation(in.Task, step); ok {
		situations = append(situations, found)
	}
	return situations
}

// stepSituation is the situation of the current step of a task in
// implementation, in the conversation that implements it.
func stepSituation(t task.Task, step flow.StepState, sessions map[session.Key]session.Summary) (Found, bool) {
	n := step.Step.Number
	place := Place{Kind: PlaceStep, Step: n}

	if step.Status == flow.StepBlocked {
		var reason task.BlockReason
		if step.Block != nil {
			reason = step.Block.Reason
		}
		return newFound(t, place, KindStepBlocked, stepBlockedBody(n, reason)), true
	}
	if sum, open := sessions[session.Key{TaskID: t.ID, Stage: session.StepStage(n)}]; open {
		if kind, decided := sessionKind(sum); decided {
			if kind == "" {
				return Found{}, false
			}
			return newFound(t, place, kind, sessionBody(kind, placeName(place, false))), true
		}
	}

	var form Form
	switch step.Status {
	case flow.StepReviewFailed:
		return newFound(t, place, KindWorktreeUnreadable, worktreeUnreadableBody(n)), true
	case flow.StepAwaitingReview:
		form = FormReview
	case flow.StepInReview:
		form = FormStaged
	case flow.StepReadyToApprove:
		form = FormApprove
	case flow.StepNothingToCommit:
		return newFound(t, place, KindStepEmpty, stepEmptyBody(n)), true
	default:
		return Found{}, false
	}
	files := -1
	if step.Review != nil && step.Review.Err == "" {
		files = step.Review.Total
	}
	found := newFound(t, place, KindStepReview, stepReviewBody(n, form, step.CommitFailed, step.Fallback, files))
	found.Form = form
	if form == FormStaged && step.Review != nil {
		found.Percent = step.Review.Percent()
	}
	return found, true
}

// reviewerSituation is the situation of the conversation that reviews a step:
// what its session holds, or the report a pass still owes.
func reviewerSituation(t task.Task, step flow.StepState) (Found, bool) {
	if step.ReviewerStage == "" {
		return Found{}, false
	}
	n := step.Step.Number
	place := Place{Kind: PlaceStepReview, Step: n}
	if kind, decided := sessionKind(step.Reviewer); decided {
		if kind == "" {
			return Found{}, false
		}
		return newFound(t, place, kind, reviewerBody(kind, n)), true
	}
	if step.ReportMissing {
		return newFound(t, place, KindReply, reviewerBody(KindReply, n)), true
	}
	return Found{}, false
}

// prSituation is the situation of the pull request of a task in the PR stage.
func prSituation(t task.Task, pr flow.PullRequest) (Found, bool) {
	place := Place{Kind: PlacePR}
	name := placeName(place, pr.SessionStage == session.PRReviewStage)
	if pr.SessionStage != "" {
		if kind, decided := sessionKind(pr.Session); decided {
			if kind == "" {
				return Found{}, false
			}
			return newFound(t, place, kind, sessionBody(kind, name)), true
		}
	}

	switch pr.Status {
	case flow.PRBlocked:
		var reason task.PRBlockReason
		if pr.Block != nil {
			reason = pr.Block.Reason
		}
		return newFound(t, place, KindPRBlocked, prBlockedBody(reason)), true
	case flow.PRClosedUnmerged:
		return newFound(t, place, KindPRClosed, prClosedBody(pr.PR.Number)), true
	case flow.PRAwaitingReply:
		return newFound(t, place, KindReply, sessionBody(KindReply, name)), true
	case flow.PRDraftReady:
		return newFound(t, place, KindDraft, draftBody()), true
	case flow.PRAwaitingDecision:
		found := newFound(t, place, KindFindings, findingsBody(FormNone, -1))
		if pr.Pass != nil {
			form := FormDecide
			if pr.Pass.Decided() {
				form = FormApply
			}
			found.Form = form
			found.Body = findingsBody(form, len(pr.Pass.Findings))
		}
		return found, true
	case flow.PRInReview:
		form, percent := FormReview, 0
		if pr.Review != nil && pr.Review.Staged > 0 {
			form, percent = FormStaged, pr.Review.Percent()
		}
		found := newFound(t, place, KindChangesReview, changesReviewBody(form, pr.CommitFailed))
		found.Form, found.Percent = form, percent
		return found, true
	case flow.PRReadyToApprove:
		found := newFound(t, place, KindChangesReview, changesReviewBody(FormApprove, pr.CommitFailed))
		found.Form = FormApprove
		return found, true
	case flow.PRTrouble:
		base := cmp.Or(pr.PR.Base, strings.TrimPrefix(pr.BaseBranch, "origin/"))
		found := newFound(t, place, KindPRTrouble, troubleBody(pr.Trouble, base))
		found.Form = troubleForm(pr.Trouble)
		return found, true
	case flow.PRDone:
		form := FormMerge
		if pr.CanClose {
			// The merge could not be confirmed, and the closing is offered.
			form = FormClose
		}
		found := newFound(t, place, KindMerge, mergeBody(pr.PR.Number, form, false, pr.Pass != nil && pr.Pass.AllDiscarded()))
		found.Form = form
		return found, true
	case flow.PRMerged:
		found := newFound(t, place, KindMerge, mergeBody(pr.PR.Number, FormClose, true, false))
		found.Form = FormClose
		return found, true
	default:
		return Found{}, false
	}
}
