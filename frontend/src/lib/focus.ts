import { type FindingLike, nextToDecide, previousToDecide } from "@/lib/findings";

/**
 * RequestFocus is where the focus goes on arriving at the request, and on Show: the pending card
 * (its first question without a choice, or its default answer), the first finding to decide of the
 * card of findings, the primary of the bar, the composer, or the bar itself when none of its
 * actions can be pressed.
 */
export type RequestFocus = "question" | "permission" | "finding" | "primary" | "composer" | "bar";

/** COMPOSER is the field of the composer of the place on screen. */
export const COMPOSER = "#composer-input";

/** BAR is the request bar of the place on screen. */
const BAR = "[aria-label=Request]";

/** FINDING is a finding of the card of findings. */
const FINDING = "[data-decision-card] [data-finding]";

/** OPTION is an option of a question card: a radio of a single choice, a checkbox of many. */
const OPTION = "[role=radio], [role=checkbox]";

// questionStop is the stop of Tab of the first question of the pending card without a choice, else
// of the first question: the chosen option of a radio group, else its first option.
function questionStop(): HTMLElement | null {
  const card = document.querySelector("[data-pending-card=question]");
  const groups = [...(card?.querySelectorAll<HTMLElement>("[data-question]") ?? [])];
  const group =
    groups.find((each) => each.querySelector(`[aria-checked="true"]`) === null) ?? groups[0];
  return (
    group?.querySelector<HTMLElement>(`:is(${OPTION})[tabindex="0"]`) ??
    group?.querySelector<HTMLElement>(OPTION) ??
    null
  );
}

// targetOf is the element a focus of the request lands on, null when it isn't on screen.
function targetOf(target: RequestFocus): HTMLElement | null {
  switch (target) {
    case "question":
      return questionStop();
    case "permission":
      return document.querySelector<HTMLElement>(
        "[data-pending-card=permission] [data-default-focus]",
      );
    case "finding":
      return (
        document.querySelector<HTMLElement>(
          `${FINDING}[data-decided="false"]:not([data-disabled])`,
        ) ?? document.querySelector<HTMLElement>(FINDING)
      );
    case "primary":
      return (
        document.querySelector<HTMLElement>(
          `${BAR} [data-variant=primary]:not([aria-disabled=true])`,
        ) ?? document.querySelector<HTMLElement>(`${BAR} button:not([aria-disabled=true])`)
      );
    case "composer":
      return document.querySelector<HTMLElement>(COMPOSER);
    case "bar":
      return document.querySelector<HTMLElement>(BAR);
  }
}

/**
 * focusRequest takes the focus to where the request asks it, scrolled into view: the first
 * question without a choice of the pending card, the default answer of the pending permission, the
 * first finding to decide, centred, the primary of the bar, the composer or the bar itself. False
 * when the target isn't on screen.
 */
export function focusRequest(target: RequestFocus): boolean {
  const element = targetOf(target);
  if (element === null) {
    return false;
  }
  element.focus();
  element.scrollIntoView({ block: target === "finding" ? "center" : "nearest" });
  return true;
}

/** focusTitle takes the focus to the title of the place on screen. */
export function focusTitle(): void {
  document.querySelector<HTMLElement>("h1[tabindex='-1']")?.focus();
}

/**
 * focusFindingToDecide takes the focus to the next finding to decide (by 1) or the previous one (by
 * -1), from the finding in focus or from the start, scrolled to the centre. False when there is no
 * card of findings on screen (findings null) or nothing is left to decide.
 */
export function focusFindingToDecide(findings: readonly FindingLike[] | null, by: 1 | -1): boolean {
  if (findings === null) {
    return false;
  }
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
