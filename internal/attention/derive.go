package attention

import (
	"slices"

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
	Repos     []flow.RepoState
	Sessions  map[session.Key]session.Summary
}

// Derive lists the situations of one task: one per place at most, the most
// urgent one when more than one condition holds there.
func Derive(in Input) []Found {
	switch in.Task.Stage {
	case task.StagePRD, task.StageTechSpec, task.StagePlan:
		if found, ok := stageSituation(in); ok {
			return []Found{found}
		}
	case task.StageImplementation:
		if found, ok := stepSituation(in); ok {
			return []Found{found}
		}
	case task.StagePR:
		return repoSituations(in)
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
		return newFound(t, place, kind, sessionBody(kind, placeName(t, place))), true
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
		return newFound(t, place, KindPlanInvalid, planInvalidBody()), true
	}
	if a.Done(t.Stage) {
		if !t.Revisiting {
			// The app moves the task to the next stage on its own.
			return Found{}, false
		}
		return newFound(t, place, KindReadyToContinue, readyToContinueBody(t.Stage)), true
	}
	return newFound(t, place, KindReply, sessionBody(KindReply, placeName(t, place))), true
}

// stepSituation is the situation of a task in implementation, the one of its
// current step: the first step that is not done.
func stepSituation(in Input) (Found, bool) {
	t := in.Task
	index := slices.IndexFunc(in.Steps, func(state flow.StepState) bool { return state.Status != flow.StepDone })
	if index < 0 {
		return Found{}, false
	}
	step := in.Steps[index]
	n := step.Step.Number
	place := Place{Kind: PlaceStep, Step: n}

	if step.Status == flow.StepBlocked {
		var reason task.BlockReason
		if step.Block != nil {
			reason = step.Block.Reason
		}
		return newFound(t, place, KindStepBlocked, stepBlockedBody(n, reason)), true
	}
	if sum, open := in.Sessions[session.Key{TaskID: t.ID, Stage: session.StepStage(n)}]; open {
		if kind, decided := sessionKind(sum); decided {
			if kind == "" {
				return Found{}, false
			}
			return newFound(t, place, kind, sessionBody(kind, placeName(t, place))), true
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
	found := newFound(t, place, KindStepReview, stepReviewBody(n, form, step.CommitFailed))
	found.Form = form
	if form == FormStaged && step.Review != nil {
		found.Percent = step.Review.Percent()
	}
	return found, true
}

// repoSituations are the situations of a task in the PR stage, one per
// repository at most, in the order of the repositories.
func repoSituations(in Input) []Found {
	var situations []Found
	for _, repo := range in.Repos {
		found, ok := repoSituation(in.Task, repo)
		if !ok {
			continue
		}
		situations = append(situations, found)
	}
	return situations
}

// repoSituation is the situation of one repository of the PR stage.
func repoSituation(t task.Task, repo flow.RepoState) (Found, bool) {
	place := Place{Kind: PlaceRepo, RepoPath: repo.RepoPath, Repository: repo.Repository}
	name := repoName(t, place)
	if repo.SessionStage != "" {
		if kind, decided := sessionKind(repo.Session); decided {
			if kind == "" {
				return Found{}, false
			}
			return newFound(t, place, kind, sessionBody(kind, name)), true
		}
	}

	switch repo.Status {
	case flow.RepoBlocked:
		var reason task.PRBlockReason
		if repo.Block != nil {
			reason = repo.Block.Reason
		}
		return newFound(t, place, KindPRBlocked, prBlockedBody(name, reason)), true
	case flow.RepoPRClosed:
		return newFound(t, place, KindPRClosed, prClosedBody(name)), true
	case flow.RepoAwaitingReply:
		return newFound(t, place, KindReply, sessionBody(KindReply, name)), true
	case flow.RepoDraftReady:
		return newFound(t, place, KindDraft, draftBody(name)), true
	case flow.RepoAwaitingDecision:
		return newFound(t, place, KindFindings, findingsBody(name)), true
	case flow.RepoInReview:
		form, percent := FormReview, 0
		if repo.Review != nil && repo.Review.Staged > 0 {
			form, percent = FormStaged, repo.Review.Percent()
		}
		found := newFound(t, place, KindChangesReview, changesReviewBody(name, form, repo.CommitFailed))
		found.Form, found.Percent = form, percent
		return found, true
	case flow.RepoReadyToApprove:
		found := newFound(t, place, KindChangesReview, changesReviewBody(name, FormApprove, repo.CommitFailed))
		found.Form = FormApprove
		return found, true
	case flow.RepoDone:
		form := FormMerge
		if repo.CanClose {
			// The merge could not be confirmed, and the closing is offered.
			form = FormClose
		}
		found := newFound(t, place, KindMerge, mergeBody(name, form))
		found.Form = form
		return found, true
	case flow.RepoMerged:
		found := newFound(t, place, KindMerge, mergeBody(name, FormClose))
		found.Form = FormClose
		return found, true
	case flow.RepoSkipped:
		return newFound(t, place, KindNothingToPublish, nothingToPublishBody(name)), true
	default:
		return Found{}, false
	}
}
