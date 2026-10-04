import type { RequestButton, RequestModel } from "@/components/system/RequestBar";
import type { ComposerContext } from "@/features/chat/composer";
import { isPausedReview, reviewChecks, reviewPass } from "@/features/reviews/review-header";
import { lastRecordedPass } from "@/features/reviews/review-status";
import {
  approveButton,
  approveRestButton,
  type Bar,
  clean,
  drawn,
  type PendingRequest,
  REVIEW_AGAIN_TOOLTIP,
  sessionRequestOf,
  statusOf,
  TONES,
} from "@/features/task/request";
import { reviewCountLabel } from "@/features/task/step-status";
import { decidedCounts } from "@/lib/findings";
import type { RequestFocus } from "@/lib/focus";
import { checksSummary, troubleLabel, troubleText } from "@/lib/pull-requests";
import {
  compactWait,
  counted,
  lowerFirst,
  reviewName,
  reviewSituation,
  spokenWait,
} from "@/lib/situations";
import type { ReviewSummary, Situation, SituationKind } from "@/lib/wails";
import {
  asPullReviewMode,
  asPullReviewStatus,
  asSituationForm,
  asSituationGroup,
  asSituationKind,
  REVIEW_STAGE,
} from "@/lib/wails";

export { reviewChecks };

/** ReviewRequestAction is what a button of the request bar of a review does. */
export type ReviewRequestAction =
  | "show"
  | "retrySession"
  | "nextToDecide"
  | "approveRest"
  | "publish"
  | "apply"
  | "openInEditor"
  | "approve"
  | "openPR"
  | "reviewAgain";

/** ReviewRequestModel is the request bar of the review screen. */
export type ReviewRequestModel = RequestModel<ReviewRequestAction, RequestFocus>;

type ReviewButton = RequestButton<ReviewRequestAction>;
type ReviewBar = Bar<ReviewRequestAction>;

/** ReviewKind is each situation of the review itself, not of its conversation. */
type ReviewKind = Extract<
  SituationKind,
  | "review_report"
  | "publish_failed"
  | "changes_review"
  | "merge"
  | "new_commits"
  | "pr_trouble"
  | "pass_blocked"
>;

/** Want is what the bar asks for: the kind and its form, from the situation or, paused, from the state. */
interface Want {
  kind: ReviewKind;
  /** form is decide, publish or apply of a report; approve of the changes; "" otherwise. */
  form: "" | "decide" | "publish" | "apply" | "approve";
}

/** NEXT_TO_DECIDE goes to the next finding to decide, as Alt+↓ does. */
const NEXT_TO_DECIDE: ReviewButton = {
  action: "nextToDecide",
  label: "Next to decide",
  variant: "secondary",
  shortcut: "Alt ↓",
  tooltip: "The next finding to decide",
  loadingLabel: "",
};

const OPEN_IN_EDITOR: ReviewButton = {
  action: "openInEditor",
  label: "Open in VS Code",
  variant: "secondary",
  shortcut: "Ctrl E",
  loadingLabel: "",
};

const OPEN_PR: ReviewButton = {
  action: "openPR",
  label: "Open PR",
  variant: "secondary",
  loadingLabel: "",
};

function publishButton(disabledReason?: string): ReviewButton {
  return {
    action: "publish",
    label: "Publish review…",
    variant: "primary",
    loadingLabel: "",
    shortcut: "Ctrl ↵",
    ...(disabledReason === undefined ? {} : { disabledReason }),
  };
}

function applyButton(disabledReason?: string): ReviewButton {
  return {
    action: "apply",
    label: "Apply approved",
    variant: "primary",
    loadingLabel: "Sending…",
    ...(disabledReason === undefined ? {} : { disabledReason }),
  };
}

function reviewAgainButton(tooltip?: string): ReviewButton {
  return {
    action: "reviewAgain",
    label: "Review again…",
    variant: "primary",
    loadingLabel: "",
    ...(tooltip === undefined ? {} : { tooltip }),
  };
}

function joined(parts: readonly string[]): string {
  return parts.filter((part) => part !== "").join(" · ");
}

// staleNote is what the bar adds while the pull request moved after the pass being decided.
function staleNote(review: ReviewSummary): string {
  if (!review.stalePass) {
    return "";
  }
  return review.staleCommits > 0
    ? `${counted(review.staleCommits, "commit")} arrived after this pass`
    : "commits arrived after this pass";
}

function reportBar(review: ReviewSummary, form: Want["form"], place: string): ReviewBar {
  const pass = lastRecordedPass(review);
  const { decided, approved, discarded, total } = decidedCounts(pass?.findings ?? []);
  const apply = asPullReviewMode(review.mode) === "apply";
  if (form === "publish") {
    const outcome = pass?.clean ? "A clean pass" : `${approved} approved · ${discarded} discarded`;
    return {
      form: "decision",
      label: "Ready to publish",
      place,
      progress: joined([outcome, staleNote(review)]),
      status: statusOf("Ready to publish", place),
      actions: [publishButton()],
      focus: "primary",
    };
  }
  if (form === "apply") {
    return {
      form: "decision",
      label: "Ready to apply",
      place,
      progress: `${counted(approved, "approved finding")} ${approved === 1 ? "goes" : "go"} to the agent`,
      status: statusOf("Ready to apply", place),
      actions: [applyButton()],
      focus: "primary",
    };
  }
  const left = total - decided;
  const refusal = left > 0 ? `Decide ${left} more` : undefined;
  return {
    form: "decision",
    label: "Decide findings",
    place,
    progress: joined([`${decided} of ${total} decided`, staleNote(review)]),
    status: statusOf("Decide findings", place),
    actions: [
      NEXT_TO_DECIDE,
      // Approve the rest has nothing to approve once every finding is decided.
      ...(left > 0 ? [approveRestButton<ReviewRequestAction>(left)] : []),
      apply ? applyButton(refusal) : publishButton(refusal),
    ],
    focus: "finding",
  };
}

// changesBar is the review of what the agent changed in apply mode: what is staged, and Approve.
function changesBar(review: ReviewSummary, form: Want["form"], place: string): ReviewBar {
  const changes = review.review;
  const notes = [changes === null || changes.error !== "" ? "" : reviewCountLabel(changes)];
  if (review.commitFailed) {
    notes.push("the last approval didn't produce a commit");
  }
  const label = form === "approve" ? "Approve changes" : "Review changes";
  return {
    form: "tinted",
    label,
    place,
    progress: joined(notes),
    status: statusOf(label, place),
    actions: [OPEN_IN_EDITOR, approveButton<ReviewRequestAction>("approve", changes)],
  };
}

// checksNote is the latest reading of the checks, as the bar of new commits says it.
function checksNote(review: ReviewSummary): string {
  const summary = checksSummary(reviewChecks(review));
  return summary === "No checks" ? summary : `Checks ${lowerFirst(summary)}`;
}

function newCommitsBar(review: ReviewSummary, pass: number): ReviewBar {
  // Without the published commit among those read, the count is unknown.
  const known = review.newCommits > 0;
  const label = known ? "New commits" : `New commits since pass ${pass}`;
  const place = known ? `${review.newCommits} since pass ${pass}` : "";
  return {
    form: "tinted",
    label,
    place,
    progress: checksNote(review),
    status: statusOf(label, place),
    actions: [reviewAgainButton()],
  };
}

function barOf(review: ReviewSummary, want: Want): ReviewBar {
  const n = reviewPass(review);
  const place = `pass ${n}`;
  switch (want.kind) {
    case "review_report":
      return reportBar(review, want.form, place);
    case "publish_failed":
      return {
        form: "error",
        label: "Publish failed",
        place,
        progress: review.publishError,
        status: statusOf("Publish failed", place),
        actions: [publishButton()],
        focus: "primary",
      };
    case "changes_review":
      return changesBar(review, want.form, place);
    case "merge": {
      const reference = reviewName(review);
      return {
        form: "tinted",
        label: "Ready to merge",
        place: reference,
        progress: lastRecordedPass(review)?.clean
          ? "A clean pass"
          : `Nothing approved in pass ${n}`,
        status: statusOf("Ready to merge", reference),
        actions: [OPEN_PR],
      };
    }
    case "new_commits":
      return newCommitsBar(review, n);
    case "pr_trouble": {
      const label = troubleLabel(review.trouble);
      return {
        form: "error",
        label,
        place,
        progress: troubleText(review.trouble, review.baseBranch),
        status: statusOf(label, place),
        actions: [reviewAgainButton(REVIEW_AGAIN_TOOLTIP)],
      };
    }
    case "pass_blocked":
      return {
        form: "error",
        label: "Pass blocked",
        place,
        progress: review.passBlocked,
        status: statusOf("Pass blocked", place),
        actions: [reviewAgainButton()],
      };
  }
}

const REVIEW_KINDS: readonly SituationKind[] = [
  "review_report",
  "publish_failed",
  "changes_review",
  "merge",
  "new_commits",
  "pr_trouble",
  "pass_blocked",
];

// situationWant is what a situation of the review itself asks for; null for one of its conversation.
function situationWant(situation: Situation): Want | null {
  const kind = asSituationKind(situation.kind);
  if (!REVIEW_KINDS.includes(kind)) {
    return null;
  }
  switch (asSituationForm(situation.form)) {
    case "publish":
      return { kind: kind as ReviewKind, form: "publish" };
    case "apply":
      return { kind: kind as ReviewKind, form: "apply" };
    case "approve":
      return { kind: kind as ReviewKind, form: "approve" };
    default:
      return { kind: kind as ReviewKind, form: kind === "review_report" ? "decide" : "" };
  }
}

// pausedWant is what the state of a paused review asks for; null where only its session asked.
function pausedWant(review: ReviewSummary): Want | null {
  switch (asPullReviewStatus(review.status)) {
    case "awaiting_decision":
      return { kind: "review_report", form: "decide" };
    case "ready_to_publish":
      return { kind: "review_report", form: "publish" };
    case "ready_to_apply":
      return { kind: "review_report", form: "apply" };
    case "publish_failed":
      return { kind: "publish_failed", form: "" };
    case "in_review":
      return { kind: "changes_review", form: "" };
    case "ready_to_approve":
      return { kind: "changes_review", form: "approve" };
    case "ready_to_merge":
      return { kind: "merge", form: "" };
    case "new_commits":
      return { kind: "new_commits", form: "" };
    case "trouble":
      return { kind: "pr_trouble", form: "" };
    case "pass_blocked":
      return { kind: "pass_blocked", form: "" };
    default:
      return null;
  }
}

// situationRequestOf is the bar of the situation of a review, without the wait.
function situationRequestOf(
  review: ReviewSummary,
  situation: Situation,
  pending: PendingRequest | null,
): ReviewRequestModel {
  const want = situationWant(situation);
  if (want !== null) {
    return drawn(situation, barOf(review, want));
  }
  const session = {
    stage: review.sessionStage === "" ? REVIEW_STAGE : review.sessionStage,
    lastError: review.lastError,
  };
  return sessionRequestOf<ReviewRequestAction>(
    situation,
    session,
    `pass ${reviewPass(review)}`,
    pending,
    {
      label: "Waiting for the report",
      ...(review.unreadableReport === "" ? {} : { progress: review.unreadableReport }),
      actions: [],
    },
  );
}

/**
 * reviewRequestOf is the request bar of the review screen: the situation of the review, with its
 * wait; paused, what the state asks for, quiet, without a chip and without what the session asked;
 * null for everything else. pending is the card the conversation holds pending.
 */
export function reviewRequestOf(
  review: ReviewSummary,
  now: number,
  pending: PendingRequest | null,
): ReviewRequestModel | null {
  if (isPausedReview(review)) {
    const want = pausedWant(review);
    return want === null
      ? null
      : { ...clean(barOf(review, want)), form: "quiet", glyph: "paused", situationId: null };
  }
  const situation = reviewSituation(review);
  if (situation === null) {
    return null;
  }
  return {
    ...situationRequestOf(review, situation, pending),
    time: {
      short: compactWait(situation.startedAt, now),
      long: spokenWait(situation.startedAt, now),
      tone: TONES[asSituationGroup(situation.group)],
    },
  };
}

/**
 * reviewAnnouncement is what the live region says of a bar born with the review open:
 * "web#2291: waiting for you: decide findings in pass 1", or "…: error: …" for an error.
 */
export function reviewAnnouncement(review: ReviewSummary, request: ReviewRequestModel): string {
  const pass = `pass ${reviewPass(review)}`;
  const tone = request.glyph === "error" ? "error" : "waiting for you";
  // A label that names the pass already, "New commits since pass 1", isn't told it again.
  const where = request.label.includes(pass) ? "" : ` in ${pass}`;
  return `${reviewName(review)}: ${tone}: ${lowerFirst(request.label)}${where}`;
}

/** reviewComposerContext is what the composer of a review says: revising the findings, asking for a change. */
export function reviewComposerContext(
  review: ReviewSummary,
): Pick<ComposerContext, "findings" | "askForChange" | "reviseFindings" | "item"> {
  const last = (review.passes ?? []).at(-1);
  const status = asPullReviewStatus(review.status);
  return {
    findings: false,
    askForChange: status === "in_review" || status === "ready_to_approve",
    reviseFindings: last?.recorded === true && !last.clean && !last.published && !last.sent,
    item: "review",
  };
}

/**
 * hasReviewComposer says whether the review screen has a composer: with a session, save while the
 * first pass waits for the checks, before the session got its prompt.
 */
export function hasReviewComposer(review: ReviewSummary): boolean {
  const recorded = (review.passes ?? []).some((pass) => pass.recorded);
  return (
    review.sessionStage !== "" &&
    !(asPullReviewStatus(review.status) === "waiting_checks" && !recorded)
  );
}
