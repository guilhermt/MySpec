import { useEffect, useId, useState } from "react";
import { Button } from "@/components/system/Button";
import { Field } from "@/components/system/Field";
import { ICONS } from "@/components/system/icons";
import { LiveRegion } from "@/components/system/LiveRegion";
import { Shimmer } from "@/components/system/Shimmer";
import { StateGlyph } from "@/components/system/StateGlyph";
import { SunkenLine } from "@/components/system/SunkenLine";
import { Textarea } from "@/components/system/Textarea";
import { Markdown } from "@/features/chat/Markdown";
import { AttachedImages } from "@/features/images/AttachedImages";
import { CardImageFailures } from "@/features/images/CardImageFailures";
import { ContextImages } from "@/features/images/ContextImages";
import { DropHint } from "@/features/images/DropHint";
import { pasteImages } from "@/features/images/pasteImages";
import type { CardImagesReading } from "@/features/images/useCardImages";
import { useImageDrop } from "@/features/images/useImageDrop";
import { contextLine } from "@/features/task-create/create-task";
import type { CardRefresh } from "@/features/task-create/useCardRefresh";
import { type Attachment, imagesPart } from "@/lib/images";
import { cn } from "@/lib/utils";
import type { BoardCard } from "@/lib/wails";
import { cardContext } from "@/store/actions";

export interface CardContextLineProps {
  boardId: string;
  card: BoardCard;
  /** additional is what the user adds to the end of the context. */
  additional: string;
  onAdditionalChange: (value: string) => void;
  /** readOnly holds the field while the task is being created. */
  readOnly?: boolean;
  /** refresh is the state of the card being read again, which the dialog owns. */
  refresh: CardRefresh;
  /** cardImages are the images of the card, read into the cache. */
  cardImages: CardImagesReading;
  /** images are the images the user attached to the additional context. */
  images: Attachment[];
  onAttach: (files: File[]) => void;
  /** onRemoveImage draws the × of each attached image; without it they stay. */
  onRemoveImage?: (id: string) => void;
  /** imageRefusal says why the last image wasn't attached. */
  imageRefusal: string | null;
}

/**
 * CardContextLine says what the context of a task from a card has, and shows it on request. The
 * card is read again first when its reading is stale, by the dialog.
 */
export function CardContextLine({
  boardId,
  card,
  additional,
  onAdditionalChange,
  readOnly,
  refresh,
  cardImages,
  images,
  onAttach,
  onRemoveImage,
  imageRefusal,
}: CardContextLineProps) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState<string | null>(null);
  // A read that failed leaves no text; the app notice already said why.
  const [unread, setUnread] = useState(false);
  const textId = useId();
  const { key } = card;
  const { refreshing, refreshError, version } = refresh;
  const drop = useImageDrop(onAttach, readOnly !== true);

  // biome-ignore lint/correctness/useExhaustiveDependencies: version asks for the context again
  useEffect(() => {
    let cancelled = false;
    void cardContext(boardId, key).then((context) => {
      if (!cancelled) {
        // A read that failed comes back empty, and a card always has a context to show.
        setText(context === "" ? null : context);
        setUnread(context === "");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [boardId, key, version]);

  const summary =
    contextLine(card, text) +
    imagesPart(cardImages.images.length + images.length, cardImages.reading);

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
                refreshing
                  ? "The card is being read again."
                  : unread
                    ? "Couldn't read the context."
                    : "The context isn't read yet."
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
        <LiveRegion kind="status" className="sr-only">
          {refreshing
            ? "Refreshing the card…"
            : refreshError !== null && `Couldn't refresh the card: ${refreshError}.`}
        </LiveRegion>
        {refreshing ? (
          <Shimmer>Refreshing the card…</Shimmer>
        ) : refreshError !== null ? (
          <span className="flex flex-col">
            <span>
              <StateGlyph state="blocked" className="mr-(--space-1-5) align-middle" />
              {`Couldn't refresh the card: ${refreshError}. The task will use the last reading.`}
            </span>
            <span>{summary}</span>
          </span>
        ) : (
          summary
        )}
      </SunkenLine>
      <CardImageFailures failures={cardImages.failures} />
      {open && !refreshing && text !== null && (
        <section
          id={textId}
          // A region that scrolls takes the keyboard.
          // biome-ignore lint/a11y/noNoninteractiveTabindex: see above
          tabIndex={0}
          aria-label="The context from the card"
          className="max-h-[calc(var(--leading-body)*9)] overflow-y-auto rounded-md px-(--space-4) py-(--space-3) text-(length:--text-body) leading-(--leading-body) text-ink-1 ring-1 ring-line-1 select-text focus-visible:focus-ring"
        >
          <Markdown images={{ kind: "omit" }}>{text}</Markdown>
          {cardImages.images.length + images.length > 0 && (
            <ContextImages read={cardImages.images} attached={images} />
          )}
        </section>
      )}
      {adding && (
        <div className="relative flex flex-col gap-(--space-2)" {...drop.handlers}>
          <Field
            label="Additional context"
            complement="optional"
            {...(imageRefusal !== null ? { error: imageRefusal } : {})}
          >
            <Textarea
              rows={3}
              value={additional}
              readOnly={readOnly === true}
              placeholder="Anything the card doesn't say. It goes at the end of the context."
              // The field only exists after the click that asked for it.
              autoFocus
              onChange={(event) => onAdditionalChange(event.target.value)}
              onPaste={(event) => readOnly !== true && pasteImages(event, onAttach)}
              className={cn(drop.dragging && "border-dashed border-focus")}
            />
          </Field>
          {drop.dragging && <DropHint />}
          {images.length > 0 && (
            <AttachedImages
              attachments={images}
              {...(onRemoveImage !== undefined ? { onRemove: onRemoveImage } : {})}
            />
          )}
        </div>
      )}
    </div>
  );
}
