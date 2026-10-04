package attention

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/gh"
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

// stagePlace is a planning stage as the place of a sentence names it, after
// "in ": with its article, except One-Shot planning.
func stagePlace(stage task.Stage) string {
	switch stage {
	case task.StagePRD:
		return "the PRD"
	case task.StageTechSpec:
		return "the tech spec"
	case task.StagePlan:
		return "the plan"
	case task.StageOneShot:
		return "One-Shot planning"
	default:
		return string(stage)
	}
}

// placeName is a place as a sentence names it: the stage, "step 3", the pull
// request, the review of one, or the discussion. The conversation of the PR
// stage that reviews the pull request, prReview, is "the review".
func placeName(place Place, prReview bool) string {
	switch place.Kind {
	case PlaceStep:
		return "step " + strconv.Itoa(place.Step)
	case PlacePR:
		if prReview {
			return "the review"
		}
		return "the pull request"
	case PlaceReview:
		return "the review"
	case PlaceDiscussion:
		return "the discussion"
	default:
		return stagePlace(place.Stage)
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
func planInvalidBody(corrections int) string {
	return fmt.Sprintf("The plan is still invalid after %d automatic corrections.", corrections)
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
// review could not bring clean says so. files is how many files changed, -1
// when the worktree was not read.
func stepReviewBody(n int, form Form, commitFailed bool, fallback task.ReviewFallback, files int) string {
	step := "Step " + strconv.Itoa(n)
	switch {
	case commitFailed && (form == FormApprove || fallback == task.FallbackNoCommit):
		return step + ": the last approval didn't produce a commit."
	case fallback == task.FallbackRoundsExhausted:
		return fmt.Sprintf("%s: the agent review didn't come clean after %d rounds. It's yours now.", step, flow.MaxReviewRounds)
	case files == 1:
		return step + " is ready for your review. 1 file changed."
	case files >= 0:
		return fmt.Sprintf("%s is ready for your review. %d files changed.", step, files)
	default:
		return step + " is ready for your review."
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
func prClosedBody(number int) string {
	return fmt.Sprintf("PR #%d was closed without a merge.", number)
}

// draftBody is the notification of a pull request draft that awaits the OK.
func draftBody() string {
	return "The pull request draft is ready for your OK."
}

// findingsBody is the notification of a pull request review that found
// changes for the user: how many to decide, or the approved ones ready to
// apply. A pass in text has no count (-1).
func findingsBody(form Form, count int) string {
	switch {
	case form == FormApply:
		return "The approved findings of the pull request review are ready to apply."
	case count < 0:
		return "The review of the pull request found changes for you to decide."
	case count == 1:
		return "The review of the pull request found 1 change for you to decide."
	default:
		return fmt.Sprintf("The review of the pull request found %d changes for you to decide.", count)
	}
}

// changesReviewBody is the notification of the changes a pull request review
// applied. One that starts ready to approve, because the last approval left no
// commit, says so.
func changesReviewBody(form Form, commitFailed bool) string {
	if form == FormApprove && commitFailed {
		return "The last approval of the pull request didn't produce a commit."
	}
	return "The changes from the review of the pull request are ready for your review."
}

// reviewChangesBody is changesReviewBody for the review of a pull request.
func reviewChangesBody(form Form, commitFailed bool) string {
	if form == FormApprove && commitFailed {
		return "The last approval of the pull request didn't produce a commit."
	}
	return "The changes from the review are ready for your review."
}

// mergeBody is the notification of a pull request whose review is over, which
// it names by its number: merged and ready to close, ready to close because the
// merge could not be confirmed, or ready to merge, with every finding of the
// review discarded or not.
func mergeBody(number int, form Form, merged, discarded bool) string {
	switch {
	case merged:
		return fmt.Sprintf("PR #%d was merged. The task is ready to close.", number)
	case form == FormClose:
		return fmt.Sprintf("PR #%d is ready to close: MySpec couldn't confirm the merge.", number)
	case discarded:
		return fmt.Sprintf("PR #%d is ready to merge: every finding of the review was discarded.", number)
	default:
		return fmt.Sprintf("PR #%d is ready to merge.", number)
	}
}

// reviewMergeBody is the notification of a reviewed pull request ready to
// merge.
func reviewMergeBody() string {
	return "The pull request is ready to merge."
}

// reviewReplyBody is the notification of a pass of a review of a pull request
// that ended without a report the app can act on.
func reviewReplyBody() string {
	return "The reviewer stopped without a report the app can read."
}

// reviewReportBody is the notification of the report of a pass: what it waits
// for depends on how far the user got with its findings, undecided of them
// still to decide.
func reviewReportBody(form Form, undecided int) string {
	switch {
	case form == FormPublish:
		return "The review is ready to publish."
	case form == FormApply:
		return "The approved findings are ready to apply."
	case undecided == 1:
		return "The review has 1 finding for you to decide."
	default:
		return fmt.Sprintf("The review has %d findings for you to decide.", undecided)
	}
}

// draftsBody is the notification of a discussion whose drafts await the user.
func draftsBody(undecided int) string {
	if undecided == 1 {
		return "There is 1 draft to decide in the discussion."
	}
	return fmt.Sprintf("There are %d drafts to decide in the discussion.", undecided)
}

// unreadableDraftsBody is the notification of a discussion whose drafts
// artifact the app cannot read.
func unreadableDraftsBody() string {
	return "The agent wrote drafts the app can't read in the discussion."
}

// draftsPublishFailedBody is the notification of drafts of a discussion GitHub
// did not take: the draft by its title, or how many of them, and why the first
// failed. failed is never empty: a draft that failed is what makes the
// discussion publish_failed.
func draftsPublishFailedBody(failed []discussion.Draft) string {
	if len(failed) == 1 {
		return "Couldn't publish “" + failed[0].Title + "”" + reasonPart(failed[0].PublishError)
	}
	return fmt.Sprintf("Couldn't publish %d drafts", len(failed)) + reasonPart(failed[0].PublishError)
}

// epicCantPublishBody is the notification of a discussion whose epic can't
// publish: what is missing, by how many of its cards are approved, of how many.
func epicCantPublishBody(approved, cards int) string {
	switch {
	case cards == 0:
		return "The epic can't publish: it has no cards. Move two into it, or discard it."
	case cards == 1:
		return "The epic can't publish: it has one card. Move another into it, or discard it."
	case approved == 1:
		return "The epic can't publish: approve one more of its cards, or discard it."
	default:
		return "The epic can't publish: approve two more of its cards, or discard it."
	}
}

// epicDiscardedBody is the notification of a discussion whose discarded epic
// has approved cards that won't publish.
func epicDiscardedBody(approvedCards int) string {
	if approvedCards == 1 {
		return "The epic is discarded, and its approved card won't publish."
	}
	return fmt.Sprintf("The epic is discarded, and %d of its approved cards won't publish.", approvedCards)
}

// readyToArchiveBody is the notification of a discussion every draft of which
// is published or discarded.
func readyToArchiveBody() string {
	return "Every draft is published or discarded. The discussion is ready to archive."
}

// publishFailedBody is the notification of a review GitHub did not take.
func publishFailedBody(message string) string {
	return "The review couldn't be published" + reasonPart(message)
}

// passBlockedBody is the notification of a pass of a review that could not
// start.
func passBlockedBody(message string) string {
	return "The next pass of the review couldn't start" + reasonPart(message)
}

// newCommitsBody is the notification of a pull request that moved since the
// review the user published; count is -1 when the commit is not among the
// recent ones.
func newCommitsBody(count int) string {
	switch {
	case count < 0:
		return "New commits arrived since your review."
	case count == 1:
		return "1 commit arrived since your review."
	default:
		return fmt.Sprintf("%d commits arrived since your review.", count)
	}
}

// knownPrefixes open the messages that wrap what gh or git said: the rest of
// the message is a raw error.
var knownPrefixes = []string{
	"Couldn't publish to GitHub: ",
	"Couldn't write to GitHub: ",
	"Couldn't read from GitHub: ",
	"worktree: ",
}

// homePath matches /home/<user> where a path starts, as the frontend does.
var homePath = regexp.MustCompile("(^|[\\s'\"\x60(])/home/[\\w-]+(?:\\.[\\w-]+)*([/\\s.,:;)'\"\x60]|$)")

// homeTilde writes the home paths of a text as ~.
func homeTilde(text string) string {
	return homePath.ReplaceAllString(text, "${1}~${2}")
}

// reasonPart closes the opening of a notification with why it happened: ": "
// and the reason, ended by a period unless it already ends in a mark, or just
// the period when there is none.
func reasonPart(message string) string {
	reason := reasonOf(message)
	switch {
	case reason == "":
		return "."
	case strings.ContainsAny(reason[len(reason)-1:], ".!?"):
		return ": " + reason
	default:
		return ": " + reason + "."
	}
}

// reasonOf is the reason of a failure inside a notification: the first
// sentence of a message of the product, without its mark and with its first
// letter in lowercase, or a raw error whole, its own final mark included, with
// its home paths as ~.
func reasonOf(message string) string {
	message = strings.TrimSpace(message)
	if message == "" {
		return ""
	}
	raw := false
	for _, prefix := range knownPrefixes {
		if rest, ok := strings.CutPrefix(message, prefix); ok {
			message, raw = strings.TrimSpace(rest), true
			break
		}
	}
	if !raw && strings.ContainsAny(message[len(message)-1:], ".!?") {
		return lowerFirst(firstSentence(message))
	}
	return homeTilde(message)
}

// firstSentence is the text up to the first ".", "!" or "?" followed by a
// space, without the mark; the whole text without its last mark when there is
// none.
func firstSentence(text string) string {
	for i := range len(text) - 1 {
		if strings.IndexByte(".!?", text[i]) >= 0 && text[i+1] == ' ' {
			return text[:i]
		}
	}
	return strings.TrimRight(text, ".!?")
}

// lowerFirst lowercases the first letter of a sentence, except of a name the
// product keeps: GitHub, gh and MySpec.
func lowerFirst(sentence string) string {
	word, _, _ := strings.Cut(sentence, " ")
	if strings.HasPrefix(word, "GitHub") || word == "gh" || word == "MySpec" {
		return sentence
	}
	r, size := utf8.DecodeRuneInString(sentence)
	return string(unicode.ToLower(r)) + sentence[size:]
}

// troubleForm is the form of a pull request in trouble: failed checks, a
// conflict, or both.
func troubleForm(t gh.Trouble) Form {
	switch {
	case len(t.FailedChecks) > 0 && t.Conflict:
		return FormChecksConflict
	case t.Conflict:
		return FormConflict
	default:
		return FormChecks
	}
}

// troubleBody is the notification of a pull request that stopped being ready
// after its review: which checks failed, and the conflict with its base.
func troubleBody(t gh.Trouble, base string) string {
	var sentences []string
	switch len(t.FailedChecks) {
	case 0:
	case 1:
		sentences = append(sentences, "A check failed after the review: "+t.FailedChecks[0]+".")
	default:
		sentences = append(sentences, "Checks failed after the review: "+strings.Join(t.FailedChecks, ", ")+".")
	}
	if t.Conflict {
		if base == "" {
			base = "its base"
		}
		sentences = append(sentences, "The pull request has a conflict with "+base+".")
	}
	return strings.Join(sentences, " ")
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
