import { ChevronRight, LoaderCircle, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Markdown } from "@/features/chat/Markdown";
import { STALE_CARD_MS } from "@/lib/boards";
import { messageOf } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { BoardCard } from "@/lib/wails";
import { discussionContext, refreshCard } from "@/store/actions";

/** TEXT_DEBOUNCE_MS is how long the typing rests before the context is asked for again. */
const TEXT_DEBOUNCE_MS = 300;

export interface DiscussionContextPreviewProps {
  boardId: string;
  /** text is what the user wrote about the demand, as it stands now. */
  text: string;
  cards: readonly BoardCard[];
}

/**
 * DiscussionContextPreview shows, read only, the context the discussion will
 * start with, refreshing the cards whose reading is stale first.
 */
export function DiscussionContextPreview({ boardId, text, cards }: DiscussionContextPreviewProps) {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  // The context is read again once the refreshes end, whatever their outcome.
  const [version, setVersion] = useState(0);
  const [debouncedText, setDebouncedText] = useState(text);
  // The refreshes happen once per opening of the dialog, even when the effect
  // runs twice, and over the cards the dialog opened with.
  const refreshStarted = useRef(false);
  const cardsAtMount = useRef(cards);

  // The keys travel as one string so the effects see a value, not a new array
  // on every render.
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
        } catch (failure) {
          // The message is a sentence of its own; the notice wraps it in another.
          setRefreshError(messageOf(failure).replace(/\.$/, ""));
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

  return (
    <div className="flex flex-col gap-1.5">
      <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col gap-1.5">
        <CollapsibleTrigger
          render={
            <button
              type="button"
              className="flex h-8 items-center gap-2 rounded-md text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          }
        >
          <ChevronRight
            aria-hidden="true"
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-[var(--duration-fast)]",
              open && "rotate-90",
            )}
          />
          <span className="font-medium">Context</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="max-h-[40dvh] overflow-y-auto rounded-lg border p-3 text-sm select-text">
            <Markdown>{context}</Markdown>
          </div>
        </CollapsibleContent>
      </Collapsible>
      {refreshing && (
        <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
          Refreshing the cards…
        </p>
      )}
      {refreshError !== null && (
        <p role="alert" className="flex items-start gap-1.5 text-xs text-[var(--status-attention)]">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          {`Couldn't refresh the cards: ${refreshError}. The discussion will use the last reading.`}
        </p>
      )}
    </div>
  );
}
