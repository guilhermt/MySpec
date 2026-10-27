import type { IconGlyph } from "@/components/system/icons";
import { ICONS } from "@/components/system/icons";
import { closeAttention } from "@/features/history/close-result";
import { reviewName } from "@/lib/situations";
import type { ArchivedReview } from "@/lib/wails";
import { atMoment, deployDuration } from "@/lib/when";
import type { Toast } from "@/store/app-store";

/** ToastContent is what a toast says: its icon, its text and, under it, the result of what left. */
export interface ToastContent {
  icon: IconGlyph;
  text: string;
  detail: string | null;
  /** tone is error for the end of a deploy that failed. */
  tone: "default" | "error";
}

/** toastOf is what the toast of an item that was archived without being open says. */
export function toastOf(toast: Toast, now: number): ToastContent {
  switch (toast.kind) {
    case "task": {
      const { close } = toast.task;
      const attention = close === null ? null : closeAttention(close);
      return {
        icon: ICONS.archive,
        tone: "default",
        text: `“${toast.task.name}” was archived`,
        detail:
          close === null
            ? null
            : `Closed${atMoment(close.closedAt, now)}${attention === null ? "" : ` · ${attention}`}`,
      };
    }
    case "review": {
      const { review } = toast;
      const how = review.outcome === "merged" ? "merged" : "closed without a merge";
      return {
        icon: ICONS.merge,
        tone: "default",
        text: `${reviewName(review)} was ${how}, and its review ended`,
        detail: lastPassLine(review, now),
      };
    }
    case "discussion": {
      const { publishedCount } = toast.discussion;
      return {
        icon: ICONS.archive,
        tone: "default",
        text: `“${toast.discussion.title}” was archived`,
        detail:
          publishedCount === 0
            ? "Nothing published"
            : `${publishedCount} ${publishedCount === 1 ? "card" : "cards"} published`,
      };
    }
    case "deploy": {
      const { deploy } = toast;
      const name = `${deploy.fullName} · ${deploy.environment}`;
      const length = deployDuration(deploy.seconds);
      return deploy.succeeded
        ? { icon: ICONS.deploy, tone: "default", text: `${name} deployed`, detail: `In ${length}` }
        : {
            icon: ICONS.problem,
            tone: "error",
            text: `${name} failed to deploy`,
            detail: `After ${length}`,
          };
    }
  }
}

// lastPassLine is what became of the last pass that went out: published to GitHub, or sent to the
// agent in Apply mode.
function lastPassLine(review: ArchivedReview, now: number): string {
  const applied = review.mode === "apply";
  const gone = (review.passes ?? []).filter((pass) => (applied ? pass.sent : pass.published));
  const last = gone.at(-1);
  if (last === undefined) {
    return "No pass was published";
  }
  return applied
    ? `The findings of pass ${last.pass} went to the agent${atMoment(last.sentAt, now)}`
    : `Pass ${last.pass} was published${atMoment(last.publishedAt, now)}`;
}
