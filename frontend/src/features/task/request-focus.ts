import { type RefObject, useEffect } from "react";
import type { RequestFocus } from "@/features/task/request";

/** COMPOSER is the field of the composer of the place on screen. */
const COMPOSER = "#composer-input";

/** BAR is the request bar of the place on screen. */
const BAR = "[aria-label=Request]";

// targetOf is the element a focus of the request lands on, null when it isn't on screen.
function targetOf(target: RequestFocus): HTMLElement | null {
  switch (target) {
    case "question": {
      const card = document.querySelector("[data-pending-card=question]");
      const options = card?.querySelectorAll<HTMLElement>("[role=radio], [role=checkbox]") ?? [];
      return [...options].find((option) => option.getAttribute("aria-checked") !== "true") ?? null;
    }
    case "permission":
      return document.querySelector<HTMLElement>(
        "[data-pending-card=permission] [data-default-focus]",
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
 * focusRequest takes the focus to where the request asks it, scrolled into view: the pending
 * card, the primary of the bar, the composer or the bar itself. False when the target isn't on
 * screen.
 */
export function focusRequest(target: RequestFocus): boolean {
  const element = targetOf(target);
  if (element === null) {
    return false;
  }
  element.focus();
  element.scrollIntoView({ block: "nearest" });
  return true;
}

/** focusTitle takes the focus to the title of the place on screen. */
export function focusTitle(): void {
  document.querySelector<HTMLElement>("h1[tabindex='-1']")?.focus();
}

/**
 * useFocusRescue keeps the focus off the body when what held it inside the container goes away,
 * because the action on it resolved the situation: it lands on the composer, else on the current
 * entry of the conversation, else on the title.
 */
export function useFocusRescue(containerRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    let held: Element | null = null;
    const hold = (event: FocusEvent) => {
      held = event.target instanceof Element ? event.target : null;
    };
    const observer = new MutationObserver(() => {
      if (held === null || held.isConnected || document.activeElement !== document.body) {
        return;
      }
      held = null;
      const next =
        container.querySelector<HTMLElement>(COMPOSER) ??
        container.querySelector<HTMLElement>('[role=feed] [tabindex="0"]');
      if (next === null) {
        focusTitle();
      } else {
        next.focus();
      }
    });
    container.addEventListener("focusin", hold);
    observer.observe(container, { childList: true, subtree: true });
    return () => {
      container.removeEventListener("focusin", hold);
      observer.disconnect();
    };
  }, [containerRef]);
}
