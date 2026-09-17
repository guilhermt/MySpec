package attention

import (
	"strconv"

	"github.com/guilhermt/myspec/internal/task"
)

// stageName is a planning stage as a sentence names it.
func stageName(stage task.Stage) string {
	switch stage {
	case task.StagePRD:
		return "PRD"
	case task.StageTechSpec:
		return "tech spec"
	case task.StagePlan:
		return "plan"
	case task.StageOneShot:
		return "One-Shot planning"
	default:
		return string(stage)
	}
}

// placeName is a place as a sentence names it: the stage, "step 3", the pull
// request, or the review of one.
func placeName(place Place) string {
	switch place.Kind {
	case PlaceStep:
		return "step " + strconv.Itoa(place.Step)
	case PlacePR:
		return "the pull request"
	case PlaceReview:
		return "the review"
	default:
		return stageName(place.Stage)
	}
}

// sessionBody is the notification of a situation that lives in the
// conversation of a place: a permission, a question, a reply, or else the error
// the session stopped with.
func sessionBody(kind Kind, where string) string {
	switch kind {
	case KindPermission:
		return "Permission requested in " + where + "."
	case KindQuestion:
		return "The agent has a question in " + where + "."
	case KindReply:
		return "The agent is waiting for your reply in " + where + "."
	default:
		return "The session stopped with an error in " + where + "."
	}
}

// planInvalidBody is the notification of a plan the automatic corrections did
// not fix.
func planInvalidBody() string {
	return "The plan is still invalid after automatic corrections."
}

// readyToContinueBody is the notification of a reopened stage whose document
// is revised.
func readyToContinueBody(stage task.Stage) string {
	if stage == task.StageOneShot {
		return "The One-Shot document is revised and ready to continue."
	}
	return "The " + stageName(stage) + " is revised and ready to continue."
}

// stepBlockedBody is the notification of a step that could not start.
func stepBlockedBody(n int, reason task.BlockReason) string {
	return "Step " + strconv.Itoa(n) + " can't start: " + stepBlockPhrase(reason) + "."
}

// worktreeUnreadableBody is the notification of a step whose worktree cannot
// be read for its review.
func worktreeUnreadableBody(n int) string {
	return "Step " + strconv.Itoa(n) + ": the worktree can't be read."
}

// stepReviewBody is the notification of a step to review. One that starts
// ready to approve, or that went to the user because the commit after a clean
// agent review did not happen, says the commit did not happen; one the agent
// review could not bring clean says so.
func stepReviewBody(n int, form Form, commitFailed bool, fallback task.ReviewFallback) string {
	step := "Step " + strconv.Itoa(n)
	switch {
	case commitFailed && (form == FormApprove || fallback == task.FallbackNoCommit):
		return step + ": the last approval didn't produce a commit."
	case fallback == task.FallbackRoundsExhausted:
		return step + ": the agent review didn't come clean after three rounds."
	default:
		return step + " is ready for review."
	}
}

// reviewerBody is the notification of a situation in the conversation that
// reviews a step: a permission, a question, a pass that ended without its
// report, or else the error the session stopped with.
func reviewerBody(kind Kind, n int) string {
	step := strconv.Itoa(n)
	switch kind {
	case KindPermission:
		return "The reviewer of step " + step + " asks for a permission."
	case KindQuestion:
		return "The reviewer of step " + step + " has a question."
	case KindReply:
		return "The reviewer of step " + step + " stopped without writing its report."
	default:
		return "The review of step " + step + " stopped with an error."
	}
}

// stepEmptyBody is the notification of a step the agent finished without a
// change.
func stepEmptyBody(n int) string {
	return "Step " + strconv.Itoa(n) + " finished without changes."
}

// prBlockedBody is the notification of a PR stage that cannot go on.
func prBlockedBody(reason task.PRBlockReason) string {
	return "The pull request is blocked: " + prBlockPhrase(reason) + "."
}

// prClosedBody is the notification of a pull request closed without a merge.
func prClosedBody() string {
	return "The pull request was closed without a merge."
}

// draftBody is the notification of a pull request draft that awaits the OK.
func draftBody() string {
	return "The pull request draft is ready for your OK."
}

// findingsBody is the notification of a pull request review that found
// changes.
func findingsBody() string {
	return "The review of the pull request found changes for you to decide."
}

// changesReviewBody is the notification of the changes a pull request review
// applied. One that starts ready to approve, because the last approval left no
// commit, says so.
func changesReviewBody(form Form, commitFailed bool) string {
	if form == FormApprove && commitFailed {
		return "The last approval of the pull request didn't produce a commit."
	}
	return "The changes from the review of the pull request are ready for review."
}

// mergeBody is the notification of a pull request whose review closed clean:
// ready to merge while it is open, ready to close once merged or when the merge
// could not be confirmed.
func mergeBody(form Form) string {
	if form == FormClose {
		return "The pull request is ready to close."
	}
	return "The pull request is ready to merge."
}

// reviewReplyBody is the notification of a pass of a review of a pull request
// that ended without a report the app can act on.
func reviewReplyBody() string {
	return "The reviewer stopped without a report the app can read."
}

// reviewReportBody is the notification of the report of a pass: what it waits
// for depends on how far the user got with its findings.
func reviewReportBody(form Form) string {
	switch form {
	case FormPublish:
		return "The review is ready to publish."
	case FormApply:
		return "The approved findings are ready to apply."
	default:
		return "The review has findings for you to decide."
	}
}

// publishFailedBody is the notification of a review GitHub did not take.
func publishFailedBody() string {
	return "The review couldn't be published."
}

// newCommitsBody is the notification of a pull request that moved since the
// review the user published.
func newCommitsBody() string {
	return "The pull request has new commits since your review."
}

// stepBlockPhrase is why a step could not start, inside a sentence: the title
// the interface gives the block, in lowercase.
func stepBlockPhrase(reason task.BlockReason) string {
	switch reason {
	case task.BlockDirty:
		return "the worktree has uncommitted changes"
	case task.BlockFetchFailed:
		return "couldn't fetch origin"
	case task.BlockNoBase:
		return "no base branch"
	case task.BlockPathExists:
		return "the worktree folder already exists"
	case task.BlockBranchExists:
		return "the branch already exists"
	case task.BlockCloneMissing:
		return "the clone of the repository is missing"
	case task.BlockGitFailed:
		return "git failed"
	default:
		return "git failed"
	}
}

// prBlockPhrase is why the PR stage of a task cannot go on, inside a
// sentence: the title the interface gives the block, in lowercase.
func prBlockPhrase(reason task.PRBlockReason) string {
	switch reason {
	case task.PRBlockGHMissing:
		return "the GitHub CLI was not found"
	case task.PRBlockGHAuth:
		return "the GitHub CLI isn't authenticated"
	case task.PRBlockGHFailed:
		return "the GitHub CLI failed"
	case task.PRBlockNoWorktree:
		return "the worktree is gone"
	case task.PRBlockGitFailed:
		return "git failed"
	default:
		return "git failed"
	}
}
