import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import { Field } from "@/components/system/Field";
import { ICONS } from "@/components/system/icons";
import { Shimmer } from "@/components/system/Shimmer";
import { SunkenLine } from "@/components/system/SunkenLine";
import { Textarea } from "@/components/system/Textarea";
import { Markdown } from "@/features/chat/Markdown";
import { contextLine } from "@/features/task-create/create-task";
import { STALE_CARD_MS } from "@/lib/boards";
import { messageOf } from "@/lib/errors";
import type { BoardCard } from "@/lib/wails";
import { cardContext, refreshCard } from "@/store/actions";

export interface CardContextLineProps {
  boardId: string;
  card: BoardCard;
  /** additional is what the user adds to the end of the context. */
  additional: string;
  onAdditionalChange: (value: string) => void;
  /** readOnly holds the field while the task is being created. */
  readOnly?: boolean;
}

/**
 * CardContextLine says what the context of a task from a card has, and shows it on request. A card
 * whose reading is stale is read again first, once per opening of the dialog.
 */
export function CardContextLine({
  boardId,
  card,
  additional,
  onAdditionalChange,
  readOnly,
}: CardContextLineProps) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  // The context is read again once the refresh ends, whatever its outcome.
  const [version, setVersion] = useState(0);
  const refreshStarted = useRef(false);
  const textId = useId();
  const { key, readAt } = card;

  useEffect(() => {
    if (refreshStarted.current || Date.now() - Date.parse(readAt) <= STALE_CARD_MS) {
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: version asks for the context again
  useEffect(() => {
    let cancelled = false;
    void cardContext(boardId, key).then((context) => {
      if (!cancelled) {
        // A read that failed comes back empty, and a card always has a context to show.
        setText(context === "" ? null : context);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [boardId, key, version]);

  const summary = contextLine(card, text);

  return (
    <div className="flex flex-col gap-(--space-2)">
      <SunkenLine
        action={
          <>
            <Button
              variant="ghost"
              size="xs"
              aria-expanded={open}
              aria-controls={textId}
              disabled={refreshing || text === null}
              disabledReason={
                refreshing ? "The card is being read again." : "The context isn't read yet."
              }
              onClick={() => setOpen((current) => !current)}
            >
              {open ? "Hide" : "Show"}
            </Button>
            {!adding && (
              <Button
                variant="ghost"
                size="xs"
                icon={ICONS.plus}
                disabled={readOnly === true}
                onClick={() => setAdding(true)}
              >
                Add to it
              </Button>
            )}
          </>
        }
      >
        {refreshing ? (
          <span role="status">
            <Shimmer>Refreshing the card…</Shimmer>
          </span>
        ) : refreshError !== null ? (
          <span role="status" className="flex flex-col">
            <span>{`◇ Couldn't refresh the card: ${refreshError}. The task will use the last reading.`}</span>
            <span>{summary}</span>
          </span>
        ) : (
          summary
        )}
      </SunkenLine>
      {open && !refreshing && text !== null && (
        <section
          id={textId}
          // A region that scrolls takes the keyboard.
          // biome-ignore lint/a11y/noNoninteractiveTabindex: see above
          tabIndex={0}
          aria-label="The context from the card"
          className="max-h-[calc(var(--leading-body)*9)] overflow-y-auto rounded-md px-(--space-4) py-(--space-3) text-(length:--text-body) leading-(--leading-body) text-ink-1 ring-1 ring-line-1 select-text focus-visible:focus-ring"
        >
          <Markdown>{text}</Markdown>
        </section>
      )}
      {adding && (
        <Field label="Additional context" complement="optional">
          <Textarea
            rows={3}
            value={additional}
            readOnly={readOnly === true}
            placeholder="Anything the card doesn't say. It goes at the end of the context."
            // The field only exists after the click that asked for it.
            autoFocus
            onChange={(event) => onAdditionalChange(event.target.value)}
          />
        </Field>
      )}
    </div>
  );
}
