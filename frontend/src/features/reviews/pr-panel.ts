import type { PullRequestRowState } from "@/components/system/ListRow";
import {
  cloneMissingReason,
  FORK_REASON,
  pullRequestRowModel,
  rowReference,
  sectionOf,
  yourReviewText,
} from "@/features/reviews/review-list";
import { type ChecksReading, checksSummary, unfinishedChecks } from "@/lib/pull-requests";
import { findRepository } from "@/lib/repositories";
import type { PullCard, PullRequestRow, ReviewSummary, State, TaskSummary } from "@/lib/wails";
import { asMergeable, asPullRequestAction } from "@/lib/wails";
import { age, ageLong, fullTime, readClock } from "@/lib/when";

/**
 * PanelAction is what the panel of a pull request offers, by the case of the
 * pull request. A clone names the repository to clone, and message is what gh
 * said when the last clone failed.
 */
export type PanelAction =
  | { kind: "start"; primary: true; reason: string | null }
  | { kind: "start-own"; reason: string }
  | { kind: "review"; review: ReviewSummary }
  | { kind: "task"; task: TaskSummary | null; taskId: string }
  | { kind: "fork" }
  | { kind: "clone-missing"; reason: string }
  | {
      kind: "clone";
      state: "idle" | "cloning" | "failed";
      repository: string;
      message: string;
    };

/** PrPanelModel is everything the panel of a pull request draws. */
export interface PrPanelModel {
  /** head is the strip of the panel: "api#1302", "acme/api", and the pull request on GitHub. */
  head: { reference: string; repository: string; url: string };
  title: string;
  /** meta is the line under the title; state is the state of the row, only without an active review. */
  meta: {
    author: string;
    state: string | null;
    draft: boolean;
    updated: string;
    updatedTooltip: string;
  };
  action: PanelAction;
  /** checks is the reading of the list; failed takes the place of the age when the repository failed to be read. */
  checks: {
    reading: ChecksReading;
    summary: string;
    age: string;
    ageTooltip: string;
    failed: string | null;
  };
  /** facts are the key and value pairs; labels "" without any, yourReview null outside Reviewed. */
  facts: { branch: string; card: PullCard | null; labels: string; yourReview: string | null };
  body: string;
}

const OWN_REASON =
  "Your own pull request: the review can publish a comment, or apply its findings.";

// startAction is Start review, with the reason the first pass waits: the checks not finished.
function startAction(row: PullRequestRow, reading: ChecksReading): PanelAction {
  if (row.own) {
    return { kind: "start-own", reason: OWN_REASON };
  }
  const unfinished = unfinishedChecks(reading).length;
  return {
    kind: "start",
    primary: true,
    reason:
      unfinished === 0 ? null : `The first pass waits for the checks: ${unfinished} not finished.`,
  };
}

function actionOf(row: PullRequestRow, app: State, reading: ChecksReading): PanelAction {
  const repository = findRepository(app, row.repositoryId);
  switch (asPullRequestAction(row.action)) {
    case "open_review": {
      const review = (app.reviews ?? []).find((candidate) => candidate.id === row.reviewId);
      // A review that left the state before the list was read again offers the start, which the Go refuses in words.
      return review === undefined ? startAction(row, reading) : { kind: "review", review };
    }
    case "open_task":
      return {
        kind: "task",
        task: (app.tasks ?? []).find((candidate) => candidate.id === row.taskId) ?? null,
        taskId: row.taskId,
      };
    case "fork":
      return { kind: "fork" };
    case "clone_missing":
      return { kind: "clone-missing", reason: cloneMissingReason(row, app) };
    case "clone": {
      const message = repository?.cloneError ?? "";
      return {
        kind: "clone",
        state: repository?.cloning === true ? "cloning" : message !== "" ? "failed" : "idle",
        repository: row.repository,
        message,
      };
    }
    case "review":
      return startAction(row, reading);
  }
}

/** panelReason is what the panel says under the action, null when it says nothing. */
export function panelReason(action: PanelAction): string | null {
  switch (action.kind) {
    case "start":
    case "start-own":
      return action.reason;
    case "review":
      return null;
    case "task":
      return "The review of this pull request happens in its task.";
    case "fork":
      return FORK_REASON;
    case "clone-missing":
      return action.reason;
    case "clone":
      switch (action.state) {
        case "idle":
          return `${action.repository} isn't cloned yet. A review needs a clone.`;
        case "cloning":
          return "The dialog opens when the clone ends.";
        case "failed":
          return action.message;
      }
  }
}

// stateText is the state of a row in words, as the meta line of the panel says it.
function stateText(state: PullRequestRowState): string | null {
  switch (state.kind) {
    case "text":
    case "task":
    case "cloning":
      return state.text;
    case "clone-failed":
      return "Clone failed";
    case "review":
      return null;
  }
}

/** prPanelModel is the panel of a pull request of the list. */
export function prPanelModel(row: PullRequestRow, ctx: { app: State; now: number }): PrPanelModel {
  const center = ctx.app.reviewCenter;
  const reading: ChecksReading = {
    checks: row.checks,
    mergeable: asMergeable(row.mergeable),
    checkedAt: center.readAt,
    base: row.baseBranch,
  };
  const failure = (center.failures ?? []).find(
    (candidate) => candidate.repositoryId === row.repositoryId,
  );
  const failedAge = failure === undefined ? "" : age(failure.failedAt, ctx.now);
  return {
    head: { reference: rowReference(row), repository: row.repository, url: row.url },
    title: row.title,
    meta: {
      author: row.own ? "you" : row.author,
      state: row.reviewId === "" ? stateText(pullRequestRowModel(row, ctx).state) : null,
      draft: row.draft,
      updated: `updated ${ageLong(row.updatedAt, ctx.now)}`,
      updatedTooltip: fullTime(row.updatedAt),
    },
    action: actionOf(row, ctx.app, reading),
    checks: {
      reading,
      summary: checksSummary(reading, "panel"),
      age: `read ${age(center.readAt, ctx.now)}`,
      ageTooltip: `Last read ${readClock(center.readAt, ctx.now)}`,
      failed:
        failure === undefined
          ? null
          : `${failure.repository} couldn't be read${failedAge === "" ? "" : ` · ${failedAge}`}`,
    },
    facts: {
      branch: `${row.headBranch} → ${row.baseBranch}`,
      card: row.card,
      labels: (row.labels ?? []).map((label) => label.name).join(", "),
      yourReview:
        sectionOf(row) === "reviewed" && row.yourReview !== null
          ? yourReviewText(row.yourReview, ctx.now)
          : null,
    },
    body: row.body,
  };
}
