import { useEffect, useMemo, useRef, useState } from "react";
import { STALE_CARD_MS } from "@/lib/boards";
import { messageOf } from "@/lib/errors";
import type { BoardCard } from "@/lib/wails";
import { discussionContext, refreshCard } from "@/store/actions";

/** TEXT_DEBOUNCE_MS is how long the typing rests before the context is asked for again. */
const TEXT_DEBOUNCE_MS = 300;

/** DiscussionContext is the context the discussion starts with, and how its cards are being read. */
export interface DiscussionContext {
  /** text is the context as the Go side assembles it; null until the first reading arrives. */
  text: string | null;
  /** refreshing is true while the cards whose reading is stale are read again. */
  refreshing: boolean;
  /** failure is why a card could not be read again, as a sentence; null when none failed. */
  failure: string | null;
}

/**
 * useDiscussionContext assembles, read only, the context the discussion will start with. The cards
 * the dialog opens with are read again first when their reading is stale, once per opening, and
 * the context is asked for again when they end, whatever their outcome. A context that cannot be
 * read leaves the last one.
 */
export function useDiscussionContext(
  boardId: string,
  text: string,
  cards: readonly BoardCard[],
): DiscussionContext {
  const [context, setContext] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [debouncedText, setDebouncedText] = useState(text);
  // The refreshes happen once per opening of the dialog, even when the effect runs twice, and over
  // the cards the dialog opened with.
  const refreshStarted = useRef(false);
  const cardsAtMount = useRef(cards);

  // The keys travel as one string so the effects see a value, not a new array on every render.
  const keyList = cards.map((card) => card.key).join("\n");
  const keys = useMemo(() => (keyList === "" ? [] : keyList.split("\n")), [keyList]);

  useEffect(() => {
    if (refreshStarted.current) {
      return;
    }
    refreshStarted.current = true;
    const stale = cardsAtMount.current.filter(
      (card) => Date.now() - Date.parse(card.readAt) > STALE_CARD_MS,
    );
    if (stale.length === 0) {
      return;
    }
    setRefreshing(true);
    void (async () => {
      for (const card of stale) {
        try {
          await refreshCard(boardId, card.key);
        } catch (reason) {
          // The message is a sentence of its own; the line wraps it in another.
          setFailure(messageOf(reason).replace(/\.$/, ""));
        }
      }
      setRefreshing(false);
      setVersion((current) => current + 1);
    })();
  }, [boardId]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedText(text), TEXT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: version asks for the context again
  useEffect(() => {
    let cancelled = false;
    void discussionContext({ boardId, text: debouncedText, cards: keys })
      .then((next) => {
        if (!cancelled) {
          setContext(next);
        }
      })
      .catch(() => {
        // The context is a preview: a reading that fails leaves the last one.
      });
    return () => {
      cancelled = true;
    };
  }, [boardId, debouncedText, keys, version]);

  return { text: context, refreshing, failure };
}
