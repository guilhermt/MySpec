import { type RefObject, useEffect, useId, useRef, useState } from "react";
import { Popover } from "@/components/system/Popover";
import { ReviewModeOptions } from "@/features/review-mode/ReviewModeOptions";
import { reviewModeNote } from "@/features/review-mode/review-mode-note";
import { asReviewMode, type ReviewMode, type TaskSummary } from "@/lib/wails";
import { setReviewModeInPlace } from "@/store/actions";
import { SaveFailure } from "./SaveFailure";

export interface ReviewModePopoverProps {
  task: TaskSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** anchor is what the popover opens against: the ⋯ button, or the chip in Details. */
  anchor: RefObject<HTMLElement | null>;
  /** finalFocus is where the focus returns on close: the anchor by default. */
  finalFocus?: RefObject<HTMLElement | null>;
}

/**
 * ReviewModePopover picks who reviews the steps of a task, and says below what the choice applies
 * to, or why the mode can't change. The focus opens on the chosen option. A choice saves at once:
 * while it saves, the spinner stands in for the check; when it fails, the note says so, with Try
 * again, which makes the choice again.
 */
export function ReviewModePopover({
  task,
  open,
  onOpenChange,
  anchor,
  finalFocus,
}: ReviewModePopoverProps) {
  const noteId = useId();
  const chosenRef = useRef<HTMLElement>(null);
  const [saving, setSaving] = useState<ReviewMode | null>(null);
  const [failed, setFailed] = useState<ReviewMode | null>(null);
  const note = reviewModeNote(task);

  // The popover stays mounted while closed; a stale saving or failed choice from the last time
  // it was open must not show again when it reopens.
  useEffect(() => {
    if (open) {
      setSaving(null);
      setFailed(null);
    }
  }, [open]);

  const choose = async (next: ReviewMode) => {
    setSaving(next);
    setFailed(null);
    const failure = await setReviewModeInPlace(task.id, next);
    setSaving(null);
    if (failure !== null) setFailed(next);
  };

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      anchor={anchor}
      initialFocus={chosenRef}
      {...(finalFocus !== undefined ? { finalFocus } : {})}
      title="Review mode"
    >
      <ReviewModeOptions
        label="Review mode of the task"
        value={asReviewMode(task.reviewMode)}
        saving={saving}
        disabled={note.disabled}
        layout="column"
        describedBy={noteId}
        onChoose={(next) => void choose(next)}
        chosenRef={chosenRef}
      />
      <div id={noteId} className="text-(length:--text-micro) leading-(--leading-micro) text-ink-3">
        {failed !== null ? (
          <SaveFailure onRetry={() => void choose(failed)}>Couldn't save the mode</SaveFailure>
        ) : saving !== null ? (
          "Saving…"
        ) : (
          note.text
        )}
      </div>
    </Popover>
  );
}
