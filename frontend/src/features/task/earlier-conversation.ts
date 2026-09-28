import { flushSync } from "react-dom";
import { useAppStore } from "@/store/app-store";

/** earlierRowId is the id of the row of Details that opens the earlier conversation of a stage. */
export function earlierRowId(stage: string): string {
  return `earlier-${stage}`;
}

/**
 * leaveEarlierConversation closes the earlier conversation on screen and puts the focus back where
 * the reading started: on the row of Details that opened it, while the panel it was opened from is
 * open beside the conversation, and on the conversation of the place otherwise. The conversation of
 * the place is drawn before the focus moves, so it is there to take it.
 */
export function leaveEarlierConversation(): void {
  const { earlierConversation, panel, closeEarlierConversation } = useAppStore.getState();
  if (earlierConversation === null) {
    return;
  }
  flushSync(closeEarlierConversation);
  const row =
    earlierConversation.from === "panel" && panel !== null
      ? document.getElementById(earlierRowId(earlierConversation.stage))
      : null;
  (row ?? document.querySelector<HTMLElement>('[data-slot="conversation"]'))?.focus();
}
