import { ChevronRight, LoaderCircle, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Markdown } from "@/features/chat/Markdown";
import { STALE_CARD_MS } from "@/lib/boards";
import { messageOf } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { BoardCard } from "@/lib/wails";
import { cardContext, refreshCard } from "@/store/actions";

export interface CardContextPreviewProps {
  boardId: string;
  card: BoardCard;
}

/**
 * CardContextPreview shows, read only, the context the task will start with,
 * refreshing a card whose reading is stale first.
 */
export function CardContextPreview({ boardId, card }: CardContextPreviewProps) {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  // The context is read again once the refresh ends, whatever its outcome.
  const [version, setVersion] = useState(0);
  // The refresh happens once per opening of the dialog, even when the effect runs twice.
  const refreshStarted = useRef(false);
  const { key, readAt } = card;

  useEffect(() => {
    if (refreshStarted.current || Date.now() - Date.parse(readAt) <= STALE_CARD_MS) {
      return;
    }
    refreshStarted.current = true;
    setRefreshing(true);
    refreshCard(boardId, key)
      // The message is a sentence of its own; the notice wraps it in another.
      .catch((reason: unknown) => setRefreshError(messageOf(reason).replace(/\.$/, "")))
      .finally(() => {
        setRefreshing(false);
        setVersion((current) => current + 1);
      });
  }, [boardId, key, readAt]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: version asks for the context again
  useEffect(() => {
    let cancelled = false;
    void cardContext(boardId, key).then((text) => {
      if (!cancelled) {
        setContext(text);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [boardId, key, version]);

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
          <span className="font-medium">Context from the card</span>
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
          Refreshing the card…
        </p>
      )}
      {refreshError !== null && (
        <p role="alert" className="flex items-start gap-1.5 text-xs text-[var(--status-attention)]">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          {`Couldn't refresh the card: ${refreshError}. The task will use the last reading.`}
        </p>
      )}
    </div>
  );
}
