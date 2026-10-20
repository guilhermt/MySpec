import { type RefObject, useEffect, useId, useRef, useState } from "react";
import { Popover } from "@/components/system/Popover";
import { ReviewModeOptions } from "@/features/review-mode/ReviewModeOptions";
import {
  prReviewModeNote,
  type ReviewModeNote,
  reviewModeNote,
} from "@/features/review-mode/review-mode-note";
import { asReviewMode, type ReviewMode, type TaskSummary } from "@/lib/wails";
import { setPRReviewModeInPlace, setReviewModeInPlace } from "@/store/actions";
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

interface ModeSaving {
  saving: ReviewMode | null;
  failed: ReviewMode | null;
  choose: (mode: ReviewMode) => Promise<void>;
}

// useModeSaving holds the saving and the failed choice of one group; the popover stays mounted while
// closed, so a stale choice from the last time it was open must not show again when it reopens.
function useModeSaving(
  open: boolean,
  save: (mode: ReviewMode) => Promise<string | null>,
): ModeSaving {
  const [saving, setSaving] = useState<ReviewMode | null>(null);
  const [failed, setFailed] = useState<ReviewMode | null>(null);

  useEffect(() => {
    if (open) {
      setSaving(null);
      setFailed(null);
    }
  }, [open]);

  const choose = async (next: ReviewMode) => {
    setSaving(next);
    setFailed(null);
    const failure = await save(next);
    setSaving(null);
    if (failure !== null) setFailed(next);
  };
  return { saving, failed, choose };
}

interface ReviewModeGroupProps {
  caption: string;
  subject?: "steps" | "pr";
  label: string;
  value: ReviewMode;
  note: ReviewModeNote;
  state: ModeSaving;
  chosenRef: RefObject<HTMLElement | null> | undefined;
}

// ReviewModeGroup is one subject of the popover: its caption, the options and the note under them.
function ReviewModeGroup({
  caption,
  subject = "steps",
  label,
  value,
  note,
  state,
  chosenRef,
}: ReviewModeGroupProps) {
  const noteId = useId();
  const { saving, failed, choose } = state;
  return (
    <div className="flex flex-col gap-(--space-1)">
      <p className="text-(length:--text-micro) leading-(--leading-micro) font-medium text-ink-2">
        {caption}
      </p>
      <ReviewModeOptions
        subject={subject}
        label={label}
        value={value}
        saving={saving}
        disabled={note.disabled}
        layout="column"
        describedBy={noteId}
        onChoose={(next) => void choose(next)}
        {...(chosenRef !== undefined ? { chosenRef } : {})}
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
    </div>
  );
}

/**
 * ReviewModePopover picks who reviews the steps and the pull request of a task, and says below what the choice applies
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
  const chosenRef = useRef<HTMLElement>(null);
  const steps = useModeSaving(open, (mode) => setReviewModeInPlace(task.id, mode));
  const pr = useModeSaving(open, (mode) => setPRReviewModeInPlace(task.id, mode));
  const stepsNote = reviewModeNote(task);
  const prNote = prReviewModeNote(task);

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      anchor={anchor}
      initialFocus={chosenRef}
      {...(finalFocus !== undefined ? { finalFocus } : {})}
      title="Review mode"
    >
      <ReviewModeGroup
        caption="Step review"
        label="Review mode of the task"
        value={asReviewMode(task.reviewMode)}
        note={stepsNote}
        state={steps}
        chosenRef={stepsNote.disabled && !prNote.disabled ? undefined : chosenRef}
      />
      <ReviewModeGroup
        caption="PR review"
        subject="pr"
        label="PR review mode of the task"
        value={asReviewMode(task.prReviewMode)}
        note={prNote}
        state={pr}
        chosenRef={stepsNote.disabled && !prNote.disabled ? chosenRef : undefined}
      />
    </Popover>
  );
}
