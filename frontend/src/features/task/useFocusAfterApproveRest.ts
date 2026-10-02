import { useCallback, useEffect, useRef } from "react";
import type { RequestModel } from "@/components/system/RequestBar";
import { focusRequest } from "@/lib/focus";

// barKey is what tells one bar from the next: what it says and the buttons it offers.
function barKey(bar: RequestModel<string, string> | null): string {
  if (bar === null) {
    return "";
  }
  return [bar.label, bar.progress ?? "", ...bar.actions.map((button) => button.action)].join("|");
}

/**
 * useFocusAfterApproveRest takes the focus to the primary the bar has once Approve the rest went
 * through: the button that was pressed leaves with the findings it approved. bar is the bar on
 * screen; the function returned runs the approval, which answers whether it went through.
 *
 * The approval is settled by the first bar after it was pressed: the new state can reach the bar
 * before the approval answers, or after. That bar takes the focus to its primary when it no longer
 * offers Approve the rest, and leaves it alone when it still does; later bars never move it.
 */
export function useFocusAfterApproveRest(
  bar: RequestModel<string, string> | null,
): (approve: () => Promise<boolean>) => Promise<void> {
  const key = barKey(bar);
  const offers = bar?.actions.some((button) => button.action === "approveRest") ?? false;
  const pending = useRef(false);
  const latest = useRef({ key, offers });
  useEffect(() => {
    latest.current = { key, offers };
    if (pending.current) {
      pending.current = false;
      if (!offers) {
        focusRequest("primary");
      }
    }
  }, [key, offers]);

  return useCallback(async (approve: () => Promise<boolean>) => {
    const pressedOn = latest.current.key;
    if (!(await approve())) {
      return;
    }
    if (latest.current.key === pressedOn) {
      pending.current = true;
    } else if (!latest.current.offers) {
      focusRequest("primary");
    }
  }, []);
}
