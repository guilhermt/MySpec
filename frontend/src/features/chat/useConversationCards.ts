import { useMemo } from "react";
import {
  chipsOf,
  type PendingCards,
  pendingCardsOf,
  type QuickReply,
} from "@/features/chat/composer";
import { type Entry, sessionKey } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";

const NO_ENTRIES: Entry[] = [];

/** ConversationCards are the cards a conversation holds pending and the quick replies of its last speech. */
export interface ConversationCards extends PendingCards {
  chips: QuickReply[];
}

/** useConversationCards reads the pending cards and the quick replies of the conversation of a stage. */
export function useConversationCards(taskId: string, stage: string): ConversationCards {
  const entries = useAppStore(
    (state) => state.transcripts[sessionKey(taskId, stage)]?.entries ?? NO_ENTRIES,
  );
  return useMemo(() => ({ ...pendingCardsOf(entries), chips: chipsOf(entries) }), [entries]);
}
