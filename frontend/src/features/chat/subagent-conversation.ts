import { flushSync } from "react-dom";
import { useAppStore } from "@/store/app-store";

/**
 * leaveSubagentConversation closes the conversation of the subagent on screen and brings back the
 * one it was opened from, which lands where the reading began: the store keeps the call and the
 * distance of its row from the top as `subagentReturn`, and the conversation that finds it takes
 * it. The conversation is drawn before the call returns, so the one that lands is there to take it.
 */
export function leaveSubagentConversation(): void {
  const { subagentConversation, closeSubagentConversation } = useAppStore.getState();
  if (subagentConversation === null) {
    return;
  }
  flushSync(closeSubagentConversation);
}
