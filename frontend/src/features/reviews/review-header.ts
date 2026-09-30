import type { PillView, StepperGlyph } from "@/components/system/Pill";
import type { StepperStepView } from "@/components/system/Stepper";
import type { TaskMenuItem } from "@/features/task/task-menu";
import { choiceLabel } from "@/lib/models";
import { type ChecksReading, checkCounts, checksSummary } from "@/lib/pull-requests";
import { lowerFirst, reviewName, situationFragment, situationLabel } from "@/lib/situations";
import type {
  ModelCatalog,
  PullCard,
  PullRequestRow,
  PullReviewStatus,
  ReviewPass,
  ReviewSummary,
  Situation,
  SituationGroup,
} from "@/lib/wails";
import {
  asPullReviewMode,
  asPullReviewStatus,
  asSessionStatus,
  asSituationGroup,
} from "@/lib/wails";
import { age, clockTime, startedTime } from "@/lib/when";

/** IN_PROGRESS are the states in which the last pass asked for is still under way. */
const IN_PROGRESS: readonly PullReviewStatus[] = [
  "waiting_checks",
  "pass_blocked",
  "reviewing",
  "awaiting_reply",
];

/**
 * reviewPass is the pass a review is at: the one under way (the last asked for, not recorded yet,
 * while it waits for the checks, is blocked, runs or waits for its report), else the last with a
 * report; 1 before any.
 */
export function reviewPass(review: ReviewSummary): number {
  const passes = review.passes ?? [];
  const last = passes.at(-1);
  if (
    last !== undefined &&
    !last.recorded &&
    IN_PROGRESS.includes(asPullReviewStatus(review.status))
  ) {
    return last.pass;
  }
  return passes.filter((pass) => pass.recorded).at(-1)?.pass ?? 1;
}

/** isPausedReview says whether the reviewer's session is paused. */
export function isPausedReview(review: ReviewSummary): boolean {
  return asSessionStatus(review.sessionStatus) === "paused";
}

/** reviewChecks is the live reading of the checks of the pull request of a review. */
export function reviewChecks(review: ReviewSummary): ChecksReading {
  return {
    checks: review.checks,
    mergeable: review.mergeable,
    checkedAt: review.checkedAt,
    base: review.baseBranch,
  };
}

/** VERDICT_WORDS are what a published verdict did to the pull request: "changes requested". */
export const VERDICT_WORDS: Record<string, string> = {
  approve: "approved",
  request_changes: "changes requested",
  comment: "commented",
};

/** ReviewStepperModel is the pill of a review in a stepper of one stage, its name and its tooltip. */
export interface ReviewStepperModel {
  steps: StepperStepView[];
  pill: PillView;
  /** label is "Progress · Pass 1 · waiting for you: decide findings". */
  label: string;
  /** tooltip is the label, the whole state. */
  tooltip: string[];
}

/** Moment is the glyph, the word and the state of the pill. */
type Moment = Pick<PillView, "glyph" | "word" | "shimmer" | "state">;

const SITUATION_GLYPHS: Record<SituationGroup, StepperGlyph> = {
  error: "error",
  waiting: "wait",
  closing: "close",
};

function busy(word: string, state: string): Moment {
  return { glyph: "work", word, shimmer: false, state };
}

// situationState is the state of the pill with a situation: the tone and what the most urgent one
// asks, with how many more; ready to merge says itself.
function situationState(situation: Situation, count: number): string {
  const more = count > 1 ? `, and ${count - 1} more` : "";
  switch (asSituationGroup(situation.group)) {
    case "error":
      return `error: ${situationFragment(situation)}${more}`;
    case "waiting":
      return `waiting for you: ${situationFragment(situation)}${more}`;
    case "closing":
      return `${lowerFirst(situationLabel(situation))}${more}`;
  }
}

// momentOf is the pill of a review neither paused nor waiting on the user.
function momentOf(review: ReviewSummary): Moment {
  switch (asPullReviewStatus(review.status)) {
    case "waiting_checks": {
      const { passed, total } = checkCounts(reviewChecks(review));
      if (review.checkedAt === "" || total === 0) {
        return {
          glyph: "github",
          word: "checking GitHub",
          shimmer: true,
          state: "checking GitHub",
        };
      }
      return {
        glyph: "github",
        word: `checks ${passed}/${total}`,
        shimmer: false,
        state: `waiting for the checks, ${passed} of ${total} passed`,
      };
    }
    case "applying":
      return busy("applying", "applying the findings");
    case "committing":
      return busy("committing", "committing the changes");
    default:
      break;
  }
  if (
    asSessionStatus(review.sessionStatus) === "working" ||
    asPullReviewStatus(review.status) === "reviewing"
  ) {
    return busy("working", "Reviewer working");
  }
  if (asPullReviewStatus(review.status) === "published") {
    const verdict = (review.passes ?? []).at(-1)?.verdict ?? "";
    return {
      glyph: "idle",
      word: "published",
      shimmer: false,
      state: `published, ${VERDICT_WORDS[verdict] ?? "commented"}`,
    };
  }
  return { glyph: null, word: "", shimmer: false, state: "idle" };
}

function pillOf(review: ReviewSummary, name: string, now: number): PillView {
  const place = { name, position: "", qualifier: "", keepsQualifier: false };
  if (isPausedReview(review)) {
    return {
      ...place,
      glyph: "paused",
      word: "paused",
      shimmer: false,
      paused: true,
      state: review.pausedAt === "" ? "paused" : `paused since ${clockTime(review.pausedAt, now)}`,
    };
  }
  const situations = review.situations ?? [];
  const [situation] = situations;
  if (situation !== undefined) {
    return {
      ...place,
      glyph: SITUATION_GLYPHS[asSituationGroup(situation.group)],
      word: "",
      shimmer: false,
      paused: false,
      state: situationState(situation, situations.length),
    };
  }
  return { ...place, ...momentOf(review), paused: false };
}

/**
 * reviewStepper is the pill of a review, alone in a stepper of one stage: the pass, and the glyph and
 * the word of its moment; with a situation the glyph of its gravity and no word, since the bar says
 * it. The accessible name and the tooltip hold the whole state.
 */
export function reviewStepper(review: ReviewSummary, now: number): ReviewStepperModel {
  const name = `Pass ${reviewPass(review)}`;
  const pill = pillOf(review, name, now);
  const label = `Progress · ${name} · ${pill.state}`;
  return {
    steps: [{ id: "pass", name, state: "current" }],
    pill,
    label,
    tooltip: [label],
  };
}

/** ReviewMenuAction is what an item of the ⋯ of a review does. */
export type ReviewMenuAction =
  | "openPR"
  | "refreshPR"
  | "openInEditor"
  | "reviewAgain"
  | "deleteReview";

/** ReviewMenuItem is one item of the ⋯ of a review, as the ⋯ of a task draws it. */
export interface ReviewMenuItem extends Omit<TaskMenuItem, "action"> {
  action: ReviewMenuAction;
}

/** ReviewMenuGroup is a group of the ⋯ of a review; a null label is the group after the separator. */
export interface ReviewMenuGroup {
  label: string | null;
  items: ReviewMenuItem[];
}

/**
 * reviewAgainRefusal is why a review can't take another pass now, as the ⋯ writes it after "· ";
 * null when it can.
 */
export function reviewAgainRefusal(review: ReviewSummary): string | null {
  if (review.canReviewAgain) {
    return null;
  }
  switch (asPullReviewStatus(review.status)) {
    case "waiting_checks":
      return "a pass waits for the checks";
    case "awaiting_reply":
      return `the report of pass ${reviewPass(review)} isn't in yet`;
    case "applying":
      return "the agent is applying the findings";
    case "committing":
      return "the changes are being committed";
    case "reviewing":
      if ((review.passes ?? []).at(-1)?.recorded === false) {
        return "a pass is running";
      }
      return "the reviewer is working";
    default:
      // A turn outside a pass: the user asked the reviewer something.
      return "the reviewer is working";
  }
}

/** reviewPauseRefusal is why Pause does nothing on a review: its session stopped on an error; null otherwise. */
export function reviewPauseRefusal(review: ReviewSummary): string | null {
  return asSessionStatus(review.sessionStatus) === "error"
    ? "Nothing is running to pause: the reviewer's session stopped with an error. Retry it."
    : null;
}

/** reviewContextDetail is the tooltip of the context meter: "Context used by the reviewer: 44%", "…" before the first reading. */
export function reviewContextDetail(review: ReviewSummary): string {
  const used = review.contextPercent === 0 ? "…" : `${Math.round(review.contextPercent)}%`;
  return `Context used by the reviewer: ${used}`;
}

/** reviewMenu is the ⋯ of a review: the pull request, the review, and Delete review… after the separator. */
export function reviewMenu(review: ReviewSummary, now: number): ReviewMenuGroup[] {
  const reference = reviewName(review);
  const checked = age(review.checkedAt, now);
  const again = reviewAgainRefusal(review);
  return [
    {
      label: `Pull request ${reference}`,
      items: [
        {
          id: "pr.open",
          label: "Open PR",
          action: "openPR",
          icon: "external",
          tooltip: `Open ${reference} on GitHub`,
        },
        {
          id: "pr.refresh",
          label: "Refresh PR",
          action: "refreshPR",
          tooltip:
            checked === ""
              ? "Read the pull request now"
              : `Read the pull request now · checked ${checked}`,
        },
        {
          id: "pr.openInEditor",
          label: "Open in VS Code",
          action: "openInEditor",
          icon: "openInEditor",
          shortcut: "Ctrl+E",
          ...(review.worktreePath === ""
            ? { disabledReason: "the worktree doesn't exist yet" }
            : {}),
        },
      ],
    },
    {
      label: "Review",
      items: [
        {
          id: "review.again",
          label: "Review again…",
          action: "reviewAgain",
          ...(again === null ? {} : { disabledReason: again }),
        },
      ],
    },
    {
      label: null,
      items: [
        { id: "review.delete", label: "Delete review…", action: "deleteReview", destructive: true },
      ],
    },
  ];
}

/** ReviewDetailsModel is what the Details panel of a review says. */
export interface ReviewDetailsModel {
  /** pullRequest is the pull request: "acme/web#2291", its author, "login-screen → dev", its card and labels. */
  pullRequest: {
    reference: string;
    url: string;
    author: string;
    branch: string;
    card: PullCard | null;
    labels: string;
  };
  /** checks are the checks read before each pass that kept them, the most recent first. */
  checks: { pass: number; title: string; reading: ChecksReading; summary: string }[];
  /** passes are the passes in order: "Pass 1 · changes · 3 findings", with "published" or the time of the report. */
  passes: { pass: number; text: string; meta: string; file: string }[];
  /** review is the review itself: "Publish · fixed", the model, the worktree, when it started. */
  review: { mode: string; model: string; worktree: string; started: string };
}

function counted(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

// passText is a pass as the Passes of Details list it.
function passText(review: ReviewSummary, pass: ReviewPass, last: boolean): string {
  const name = `Pass ${pass.pass}`;
  if (!pass.recorded) {
    return last && review.unreadableReport !== ""
      ? `${name} · unreadable`
      : `${name} · no report yet`;
  }
  if (pass.clean) {
    return `${name} · clean`;
  }
  return `${name} · changes · ${counted((pass.findings ?? []).length, "finding")}`;
}

// passMeta is what the row of a pass says on its right: where the pass went, else when its report came.
function passMeta(pass: ReviewPass, now: number): string {
  if (pass.published) {
    return "published";
  }
  if (pass.sent) {
    return "sent to the agent";
  }
  return pass.recordedAt === "" ? "" : clockTime(pass.recordedAt, now);
}

/**
 * reviewDetails is the Details panel of a review. row is the line of its pull request in the list,
 * which holds the labels; null without it, and the labels are "".
 */
export function reviewDetails(
  review: ReviewSummary,
  now: number,
  catalog: ModelCatalog,
  row: PullRequestRow | null,
): ReviewDetailsModel {
  const passes = review.passes ?? [];
  const checks = passes
    .filter((pass) => pass.checksReadAt !== "")
    .reverse()
    .map((pass) => {
      const reading: ChecksReading = {
        checks: pass.checks,
        mergeable: pass.mergeable,
        checkedAt: pass.checksReadAt,
        base: review.baseBranch,
      };
      return {
        pass: pass.pass,
        title: `Checks read before pass ${pass.pass} · ${clockTime(pass.checksReadAt, now)}`,
        reading,
        summary: checksSummary(reading),
      };
    });
  return {
    pullRequest: {
      reference: `${review.repository}#${review.number}`,
      url: review.url,
      author: review.author,
      branch: `${review.headBranch} → ${review.baseBranch}`,
      card: review.card,
      labels: (row?.labels ?? []).map((label) => label.name).join(", "),
    },
    checks,
    passes: passes.map((pass, index) => ({
      pass: pass.pass,
      text: passText(review, pass, index === passes.length - 1),
      meta: passMeta(pass, now),
      file: pass.file,
    })),
    review: {
      mode: `${asPullReviewMode(review.mode) === "apply" ? "Apply" : "Publish"} · fixed`,
      model:
        review.sessionModel === ""
          ? ""
          : choiceLabel(catalog, { model: review.sessionModel, effort: review.sessionEffort }),
      worktree: review.worktreePath,
      started: startedTime(review.createdAt, now),
    },
  };
}

/**
 * checkStrip is the strip of a reading of the pull request that failed: when the run of failures
 * began and why. null without a failure, and while the bar of a blocked pass says it.
 */
export function checkStrip(
  review: ReviewSummary,
  now: number,
): { title: string; reason: string } | null {
  if (review.checkError === "" || asPullReviewStatus(review.status) === "pass_blocked") {
    return null;
  }
  const since = age(review.checkErrorAt, now);
  return {
    title: since === "" ? "Couldn't check GitHub" : `Couldn't check GitHub · ${since}`,
    reason: `${review.checkError} New commits, checks and the merge show after the next reading.`,
  };
}
