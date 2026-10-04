import { useEffect } from "react";
import { WINDOW_READY, WINDOW_VIEWPORT } from "@/components/system/useWindowedRows";
import { focusRequest, focusTitle, type RequestFocus } from "@/lib/focus";
import { useAppStore } from "@/store/app-store";

// WAIT_FRAMES is how many frames the arrival waits for the window of the conversation.
const WAIT_FRAMES = 30;

// windowPending tells whether a windowed list is on screen that has not mounted its rows yet.
function windowPending(): boolean {
  return document.querySelector(`[${WINDOW_VIEWPORT}]:not([${WINDOW_READY}])`) !== null;
}

// IN_THE_CONVERSATION are the targets that are cards of the windowed conversation.
const IN_THE_CONVERSATION: readonly RequestFocus[] = ["question", "permission", "finding", "draft"];

export interface ArrivalFocusProps {
  /** target is what the situation on screen asks the focus to go to; null without one, which goes to the composer. */
  target: RequestFocus | null;
  /** ready is the conversation and the bar on screen. */
  ready: boolean;
}

/**
 * ArrivalFocus takes the focus, on arriving at a situation of an item, to what it asks once the
 * conversation and the bar are on screen: the pending card, the primary of the bar, the composer,
 * or the bar; the title when none is there.
 */
export function ArrivalFocus({ target, ready }: ArrivalFocusProps): null {
  const pendingFocus = useAppStore((state) => state.pendingFocus);
  const clearPendingFocus = useAppStore((state) => state.clearPendingFocus);
  const to = target ?? "composer";

  useEffect(() => {
    if (pendingFocus !== "request" || !ready) {
      return undefined;
    }
    // The window of the conversation mounts its rows a commit after the first, so a card of the
    // conversation is looked for once it is ready.
    if (IN_THE_CONVERSATION.includes(to) && windowPending()) {
      let tries = 0;
      let frame = 0;
      const wait = () => {
        tries += 1;
        if (windowPending() && tries < WAIT_FRAMES) {
          frame = requestAnimationFrame(wait);
          return;
        }
        if (!focusRequest(to)) {
          focusTitle();
        }
        clearPendingFocus();
      };
      frame = requestAnimationFrame(wait);
      return () => cancelAnimationFrame(frame);
    }
    if (focusRequest(to)) {
      clearPendingFocus();
      return undefined;
    }
    focusTitle();
    clearPendingFocus();
    return undefined;
  }, [pendingFocus, ready, to, clearPendingFocus]);

  return null;
}
