import { shortName } from "@/lib/repositories";
import type {
  DiscussionSummary,
  ReviewSummary,
  Situation,
  SituationGroup,
  State,
  TaskSummary,
} from "@/lib/wails";
import { asPlaceKind, asSituationForm, asSituationGroup, asSituationKind } from "@/lib/wails";

/** SituationTone is the colour of a situation: an error or block, or a wait. */
export type SituationTone = "error" | "attention";

/** FLASH_MS is how long a row, a counter or a tab stays highlighted for a new situation. */
export const FLASH_MS = 1600;

/** WaitingEntry is one line of "Waiting for you": a situation and the item it belongs to. */
export interface WaitingEntry {
  /** itemId is the task, the review or the discussion the situation is in. */
  itemId: string;
  /** name is what the line reads: the name of a task, name#number of a review, or the title of a discussion. */
  name: string;
  situation: Situation;
}

/** situationTone is the colour of a situation: its group says it. */
export function situationTone(situation: Situation): SituationTone {
  return asSituationGroup(situation.group) === "error" ? "error" : "attention";
}

/**
 * situationLabel is what a situation asks of the user, in the few words the
 * lists and the section have room for. A situation with more than one form
 * reads as the form it is in now.
 */
export function situationLabel(situation: Situation): string {
  const n = situation.place.step;
  const p = situation.percent;
  const form = asSituationForm(situation.form);
  switch (asSituationKind(situation.kind)) {
    case "session_error":
      return "Session error";
    case "step_blocked":
      return `Step ${n} blocked`;
    case "worktree_unreadable":
      return "Can't read worktree";
    case "pr_blocked":
      return "PR blocked";
    case "plan_invalid":
      return "Plan still invalid";
    case "pr_closed":
      return "PR closed unmerged";
    case "permission":
      return "Permission";
    case "question":
      return "Question";
    case "reply":
      return "Waiting for reply";
    case "ready_to_continue":
      return "Ready to continue";
    // The two reviews move through review, staged and approve; a form outside
    // those reads as the start of the review.
    case "step_review":
      if (form === "staged") {
        return `Step ${n} · ${p}% staged`;
      }
      return form === "approve" ? `Approve step ${n}` : `Review step ${n}`;
    case "step_empty":
      return `Step ${n} has no changes`;
    case "draft":
      return "Draft to approve";
    case "findings":
      return "Findings to decide";
    case "changes_review":
      if (form === "staged") {
        return `Changes · ${p}% staged`;
      }
      return form === "approve" ? "Approve changes" : "Review changes";
    case "merge":
      return form === "close" ? "Ready to close" : "Ready to merge";
    // A review report is decided on, then published, and in apply mode applied.
    case "review_report":
      if (form === "publish") {
        return "Publish review";
      }
      return form === "apply" ? "Apply findings" : "Decide findings";
    case "new_commits":
      return "New commits";
    case "drafts":
      return "Decide drafts";
    case "publish_failed":
      return "Publish failed";
    case "pass_blocked":
      return "Pass blocked";
    case "pr_trouble":
      if (form === "checks_conflict") {
        return "Checks failed · conflict";
      }
      return form === "conflict" ? "Conflict with base" : "Checks failed";
  }
}

// A planning stage as a sentence names it.
function stageName(stage: string): string {
  switch (stage) {
    case "prd":
      return "PRD";
    case "tech_spec":
      return "tech spec";
    case "plan":
      return "plan";
    case "one_shot":
      return "One-Shot planning";
    default:
      return stage;
  }
}

/** placeLabel names where in its task a situation is: the stage, "step 3", "step 3 review", or the pull request. */
export function placeLabel(situation: Situation): string {
  const { place } = situation;
  switch (asPlaceKind(place.kind)) {
    case "stage":
      return stageName(place.stage);
    case "step":
      return `step ${place.step}`;
    case "step_review":
      return `step ${place.step} review`;
    case "pr":
      return "pull request";
    case "review":
      return "review";
    case "discussion":
      return "discussion";
  }
}

/** namesPlace reports whether the label of a situation already says where it is. */
export function namesPlace(situation: Situation): boolean {
  switch (asSituationKind(situation.kind)) {
    case "step_blocked":
    case "step_review":
    case "step_empty":
    case "plan_invalid":
    case "review_report":
    case "new_commits":
    case "publish_failed":
    case "pass_blocked":
      return true;
    case "session_error":
    case "worktree_unreadable":
    case "pr_blocked":
    case "pr_closed":
    case "permission":
    case "question":
    case "reply":
    case "ready_to_continue":
    case "draft":
    case "findings":
    case "changes_review":
    case "merge":
    case "pr_trouble":
    case "drafts":
      return false;
  }
}

/**
 * situationDetail is a situation in one line: its label, followed by its place
 * when the label does not name it.
 */
export function situationDetail(situation: Situation): string {
  const label = situationLabel(situation);
  return namesPlace(situation) ? label : `${label} · ${placeLabel(situation)}`;
}

/**
 * summaryLabel is what a task waits for, as its row reads: the label of its
 * most urgent situation and how many others there are. null when it waits for
 * nothing.
 */
export function summaryLabel(situations: readonly Situation[]): string | null {
  const [first] = situations;
  if (first === undefined) {
    return null;
  }
  const label = situationLabel(first);
  return situations.length > 1 ? `${label} +${situations.length - 1}` : label;
}

// The groups, from the most urgent. Written out so the compiler asks for a new
// group's place.
const GROUP_RANK: Record<SituationGroup, number> = { error: 0, waiting: 1, closing: 2 };

/**
 * compareSituations orders situations from the most urgent: by group, then the
 * one that started first. It is the order the Go side gives the situations of a
 * task, applied across tasks.
 */
export function compareSituations(a: Situation, b: Situation): number {
  const byGroup = GROUP_RANK[asSituationGroup(a.group)] - GROUP_RANK[asSituationGroup(b.group)];
  if (byGroup !== 0) {
    return byGroup;
  }
  // A start that does not parse ties, instead of making the order undefined.
  return Date.parse(a.startedAt) - Date.parse(b.startedAt) || 0;
}

/** reviewName is what a line of the interface calls a review: name#number. */
export function reviewName(review: ReviewSummary): string {
  return `${shortName(review.repository)}#${review.number}`;
}

/**
 * waitingEntries is everything the active tasks, reviews and discussions wait
 * on the user for, one entry per situation, most urgent first. The item on
 * screen is left out: the user is already there.
 */
export function waitingEntries(app: State | null, openItemId: string | null): WaitingEntry[] {
  const tasks = (app?.tasks ?? [])
    .filter((task) => task.id !== openItemId)
    .flatMap((task) =>
      (task.situations ?? []).map((situation) => ({
        itemId: task.id,
        name: task.name,
        situation,
      })),
    );
  const reviews = (app?.reviews ?? [])
    .filter((review) => review.id !== openItemId)
    .flatMap((review) =>
      (review.situations ?? []).map((situation) => ({
        itemId: review.id,
        name: reviewName(review),
        situation,
      })),
    );
  const discussions = (app?.discussions ?? [])
    .filter((discussion) => discussion.id !== openItemId)
    .flatMap((discussion) =>
      (discussion.situations ?? []).map((situation) => ({
        itemId: discussion.id,
        name: discussion.title,
        situation,
      })),
    );
  return [...tasks, ...reviews, ...discussions].sort(
    (a, b) =>
      compareSituations(a.situation, b.situation) ||
      a.name.localeCompare(b.name) ||
      a.situation.id.localeCompare(b.situation.id),
  );
}

/**
 * nextWaiting is the item Ctrl+J opens: the one whose most severe situation is
 * the most severe of all, then the one that has waited the longest, leaving out
 * the item on screen. The repository filter plays no part. null when nothing waits.
 */
export function nextWaiting(app: State | null, openItemId: string | null): WaitingEntry | null {
  const items = [
    ...(app?.tasks ?? []).map((task) => ({ id: task.id, name: task.name, all: task.situations })),
    ...(app?.reviews ?? []).map((review) => ({
      id: review.id,
      name: review.title,
      all: review.situations,
    })),
    ...(app?.discussions ?? []).map((discussion) => ({
      id: discussion.id,
      name: discussion.title,
      all: discussion.situations,
    })),
  ];
  let next: WaitingEntry | null = null;
  for (const item of items) {
    const [situation] = [...(item.all ?? [])].sort(compareSituations);
    if (item.id === openItemId || situation === undefined) {
      continue;
    }
    const entry = { itemId: item.id, name: item.name, situation };
    if (
      next === null ||
      (compareSituations(situation, next.situation) ||
        item.name.localeCompare(next.name) ||
        item.id.localeCompare(next.itemId)) < 0
    ) {
      next = entry;
    }
  }
  return next;
}

/** announcePlace is where a situation is, as the announcement of a new one says it; null when the item says enough. */
export function announcePlace(situation: Situation): string | null {
  const { place } = situation;
  switch (asPlaceKind(place.kind)) {
    case "stage":
      switch (place.stage) {
        case "prd":
          return "PRD";
        case "tech_spec":
          return "Tech spec";
        case "plan":
          return "Plan";
        default:
          return "Planning";
      }
    case "step":
      return `Step ${place.step}`;
    case "step_review":
      return "Reviewer";
    case "pr":
      return "PR";
    case "review":
    case "discussion":
      return null;
  }
}

/** announcement is what the live region says of a new situation: `<name>: <what it asks> in <where>`. */
export function announcement(name: string, situation: Situation): string {
  const label = situationLabel(situation);
  const asks = `${label.charAt(0).toLowerCase()}${label.slice(1)}`;
  const place = announcePlace(situation);
  return place === null ? `${name}: ${asks}` : `${name}: ${asks} in ${place}`;
}

/** stageSituation is the situation of the planning stage of a task, null when it has none. */
export function stageSituation(task: TaskSummary): Situation | null {
  return (
    (task.situations ?? []).find((situation) => asPlaceKind(situation.place.kind) === "stage") ??
    null
  );
}

/** stepSituation is the situation of a step of a task, null when it has none. */
export function stepSituation(task: TaskSummary, number: number): Situation | null {
  return (
    (task.situations ?? []).find(
      (situation) =>
        asPlaceKind(situation.place.kind) === "step" && situation.place.step === number,
    ) ?? null
  );
}

/** reviewerSituation is the situation of the conversation that reviews a step of a task, null when it has none. */
export function reviewerSituation(task: TaskSummary, number: number): Situation | null {
  return (
    (task.situations ?? []).find(
      (situation) =>
        asPlaceKind(situation.place.kind) === "step_review" && situation.place.step === number,
    ) ?? null
  );
}

/** stepOrReviewerSituation is the most urgent situation of a step, in its own conversation or in the one of its reviewer. */
export function stepOrReviewerSituation(task: TaskSummary, number: number): Situation | null {
  // The situations of a task come from the most urgent, so the first one of
  // either place is the one that matters.
  return (
    (task.situations ?? []).find((situation) => {
      const kind = asPlaceKind(situation.place.kind);
      return (kind === "step" || kind === "step_review") && situation.place.step === number;
    }) ?? null
  );
}

/** reviewSituation is the situation of a review of a pull request, null when it has none. */
export function reviewSituation(review: ReviewSummary): Situation | null {
  return (
    (review.situations ?? []).find((situation) => asPlaceKind(situation.place.kind) === "review") ??
    null
  );
}

/** discussionSituation is the situation of a discussion of a demand of a board, null when it has none. */
export function discussionSituation(discussion: DiscussionSummary): Situation | null {
  return (
    (discussion.situations ?? []).find(
      (situation) => asPlaceKind(situation.place.kind) === "discussion",
    ) ?? null
  );
}

/** prSituation is the situation of the pull request of a task, null when it has none. */
export function prSituation(task: TaskSummary): Situation | null {
  return (
    (task.situations ?? []).find((situation) => asPlaceKind(situation.place.kind) === "pr") ?? null
  );
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// The units a wait is told in, the largest first.
const WAIT_UNITS = [
  { ms: DAY_MS, short: "d", name: "day" },
  { ms: HOUR_MS, short: "h", name: "hour" },
  { ms: MINUTE_MS, short: "m", name: "minute" },
] as const;

type WaitUnit = (typeof WAIT_UNITS)[number];

/**
 * waitOf is how long a situation has waited, in whole units of the largest
 * unit it reached, rounded down. null under a minute: a start that does not
 * parse, or one ahead of the clock, is no wait at all.
 */
function waitOf(startedAt: string, now: number): { count: number; unit: WaitUnit } | null {
  const span = now - Date.parse(startedAt);
  const elapsed = Number.isNaN(span) ? 0 : Math.max(span, 0);
  const unit = WAIT_UNITS.find((candidate) => elapsed >= candidate.ms);
  return unit === undefined ? null : { count: Math.floor(elapsed / unit.ms), unit };
}

/** compactWait is how long a situation has waited, as the section shows it: now, 5m, 2h, 3d. */
export function compactWait(startedAt: string, now: number): string {
  const wait = waitOf(startedAt, now);
  return wait === null ? "now" : `${wait.count}${wait.unit.short}`;
}

/** spokenWait is how long a situation has waited, in words: just now, 5 minutes, 1 hour. */
export function spokenWait(startedAt: string, now: number): string {
  const wait = waitOf(startedAt, now);
  if (wait === null) {
    return "just now";
  }
  return `${wait.count} ${wait.unit.name}${wait.count === 1 ? "" : "s"}`;
}
