import { type RefObject, useEffect } from "react";
import { COMPOSER, focusTitle } from "@/lib/focus";

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
