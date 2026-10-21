import { useEffect, useRef, useState } from "react";
import { STALE_CARD_MS } from "@/lib/boards";
import { messageOf } from "@/lib/errors";
import type { BoardCard } from "@/lib/wails";
import { refreshCard } from "@/store/actions";

export interface CardRefresh {
  /** refreshing is true while the card is read again. */
  refreshing: boolean;
  /** refreshError is why the card could not be read again, without the final period. */
  refreshError: string | null;
  /** version changes when the refresh ends, whatever its outcome. */
  version: number;
}

function isStale(readAt: string): boolean {
  return Date.now() - Date.parse(readAt) > STALE_CARD_MS;
}

/**
 * useCardRefresh reads a card again when its reading is stale, once per opening of the dialog.
 * Without a card it does nothing.
 */
export function useCardRefresh(boardId: string, card: BoardCard | null): CardRefresh {
  // A stale card is refreshing from the first render, so nothing is read from it before.
  const [refreshing, setRefreshing] = useState(() => card !== null && isStale(card.readAt));
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const refreshStarted = useRef(false);
  const key = card?.key;
  const readAt = card?.readAt;

  useEffect(() => {
    if (key === undefined || readAt === undefined || refreshStarted.current || !isStale(readAt)) {
      return;
    }
    refreshStarted.current = true;
    setRefreshing(true);
    refreshCard(boardId, key)
      // The message is a sentence of its own; the line wraps it in another.
      .catch((reason: unknown) => setRefreshError(messageOf(reason).replace(/\.$/, "")))
      .finally(() => {
        setRefreshing(false);
        setVersion((current) => current + 1);
      });
  }, [boardId, key, readAt]);

  return { refreshing, refreshError, version };
}
