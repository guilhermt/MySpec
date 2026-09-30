import { currentCardPass } from "@/features/reviews/review-conversation";
import { nextToDecide, previousToDecide } from "@/lib/findings";
import type { ReviewSummary } from "@/lib/wails";

/**
 * focusFindingToDecide takes the focus to the next finding to decide (by 1) or the previous one (by
 * -1), from the finding in focus or from the start, scrolled to the centre. False when there is no
 * card of findings on screen or nothing is left to decide.
 */
export function focusFindingToDecide(review: ReviewSummary, by: 1 | -1): boolean {
  const pass = currentCardPass(review);
  if (pass === null) {
    return false;
  }
  const findings = pass.findings ?? [];
  const focused = document.activeElement?.closest<HTMLElement>(
    "[data-decision-card] [data-finding-id]",
  );
  const from =
    focused === null || focused === undefined ? Number.NaN : Number(focused.dataset.findingId);
  const origin = Number.isNaN(from) ? null : from;
  const number = by === 1 ? nextToDecide(findings, origin) : previousToDecide(findings, origin);
  if (number === null) {
    return false;
  }
  const target = document.querySelector<HTMLElement>(
    `[data-decision-card] [data-finding-id="${number}"]`,
  );
  if (target === null) {
    return false;
  }
  target.focus();
  target.scrollIntoView({ block: "center" });
  return true;
}
