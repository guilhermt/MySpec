import { flushSync } from "react-dom";
import { useAppStore } from "@/store/app-store";

/** earlierRowId is the id of the row of Details that opens the earlier conversation of a stage. */
export function earlierRowId(stage: string): string {
  return `earlier-${stage}`;
}

/**
 * leaveEarlierConversation closes the earlier conversation on screen and puts the focus back where
 * the reading started: on `returnTo` when the close comes from the row itself (a second click on it,
 * regardless of where it was opened from), on the row of Details that opened it while the panel it
 * was opened from is open beside the conversation, and on the conversation of the place otherwise. A
 * place with no conversation to land on, such as a step blocked or a pull request with no session,
 * falls back to the place's title. The conversation of the place is drawn before the focus moves, so
 * it is there to take it.
 */
export function leaveEarlierConversation(returnTo?: HTMLElement | null): void {
  const { earlierConversation, panel, closeEarlierConversation } = useAppStore.getState();
  if (earlierConversation === null) {
    return;
  }
  const row =
    returnTo ??
    (earlierConversation.from === "panel" && panel !== null
      ? document.getElementById(earlierRowId(earlierConversation.stage))
      : null);
  flushSync(closeEarlierConversation);
  (
    row ??
    // The column of a place without a conversation holds no feed, so it takes no focus back.
    document.querySelector("[role=feed]")?.closest<HTMLElement>('[data-slot="conversation"]') ??
    document.querySelector<HTMLElement>("h1")
  )?.focus();
}
