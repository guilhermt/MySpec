import { useEffect } from "react";
import { focusRequest, focusTitle, type RequestFocus } from "@/lib/focus";
import { useAppStore } from "@/store/app-store";

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
      return;
    }
    if (!focusRequest(to)) {
      focusTitle();
    }
    clearPendingFocus();
  }, [pendingFocus, ready, to, clearPendingFocus]);

  return null;
}
