import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { type RefObject, useId, useRef, useState } from "react";
import { Icon } from "@/components/system/Icon";
import { ICONS, type IconGlyph } from "@/components/system/icons";
import { Popover } from "@/components/system/Popover";
import { Spinner } from "@/components/system/Spinner";
import { reviewModeNote } from "@/features/review-mode/review-mode-note";
import { reviewModeLabel } from "@/lib/review-modes";
import { cn } from "@/lib/utils";
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

/** MODE_OPTIONS are the two options of the popover, each with its icon and what it does. */
const MODE_OPTIONS: readonly { mode: ReviewMode; icon: IconGlyph; description: string }[] = [
  {
    mode: "agent",
    icon: ICONS.agentMode,
    description: "An agent reviews each step with the implementer; clean steps are committed.",
  },
  {
    mode: "manual",
    icon: ICONS.manualMode,
    description: "You review each step in VS Code, stage the files and approve.",
  },
];

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
  const mode = saving ?? asReviewMode(task.reviewMode);

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
      <RadioGroup
        aria-label="Review mode of the task"
        aria-describedby={noteId}
        value={mode}
        onValueChange={(value) => {
          const next = asReviewMode(value as string);
          if (!note.disabled && saving === null && next !== mode) void choose(next);
        }}
        {...(note.disabled ? { readOnly: true, "aria-disabled": true } : {})}
        className="flex flex-col gap-(--space-1)"
      >
        {MODE_OPTIONS.map((option) => (
          <Radio.Root
            key={option.mode}
            value={option.mode}
            {...(option.mode === mode ? { ref: chosenRef } : {})}
            {...(option.mode === saving ? { "aria-busy": true } : {})}
            className={cn(
              "group/option grid w-full grid-cols-[var(--icon)_minmax(0,1fr)_var(--icon)] items-start gap-(--space-2) rounded-md border border-transparent p-(--space-2) text-left text-ink-1 outline-none transition-colors duration-(--duration-fast) ease-standard focus-visible:focus-ring",
              "not-data-readonly:not-data-checked:hover:bg-veil-hover not-data-readonly:not-data-checked:active:bg-veil-press",
              "data-checked:bg-brand-tint data-checked:shadow-[inset_0_0_0_var(--border)_var(--brand-ring)]",
              "data-readonly:dashed-disabled",
            )}
          >
            <Icon
              icon={option.icon}
              tone="muted"
              className="mt-(--space-0-5) group-data-readonly/option:text-ink-4"
            />
            {/* The space between the name and the description keeps them apart in the accessible name. */}
            <span className="flex flex-col gap-(--space-0-5) text-(length:--text-ui) leading-(--leading-ui)">
              <span className="font-medium">{reviewModeLabel(option.mode)}</span>{" "}
              <span className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3 group-data-readonly/option:text-ink-4">
                {option.description}
              </span>
            </span>
            {option.mode === saving ? (
              <Spinner tone="current" className="mt-(--space-0-5) text-brand-ink" />
            ) : (
              <Icon
                icon={ICONS.done}
                tone="active"
                className="mt-(--space-0-5) invisible group-data-checked/option:visible"
              />
            )}
          </Radio.Root>
        ))}
      </RadioGroup>
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
