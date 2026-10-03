import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { type Ref, useId } from "react";
import { Icon } from "@/components/system/Icon";
import { ICONS, type IconGlyph } from "@/components/system/icons";
import { Spinner } from "@/components/system/Spinner";
import { reviewModeLabel } from "@/lib/review-modes";
import { cn } from "@/lib/utils";
import { asReviewMode, type ReviewMode } from "@/lib/wails";

export interface ReviewModeOptionsProps {
  /** label names the group: "Review mode of a new task", "Review mode of the task". */
  label: string;
  value: ReviewMode;
  /** saving is the option being saved: it shows the spinner in place of the check and "· saving…". */
  saving: ReviewMode | null;
  disabled?: boolean;
  /** disabledReason is why the options can't change, described to a screen reader. */
  disabledReason?: string;
  /** layout is how the options sit: the popover stacks them; Defaults sets them side by side. */
  layout: "column" | "row";
  describedBy?: string;
  onChoose: (mode: ReviewMode) => void;
  chosenRef?: Ref<HTMLElement>;
}

/** MODE_OPTIONS are the two options, each with its icon and what it does. */
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

const LAYOUTS = {
  column: "flex flex-col gap-(--space-1)",
  row: "grid grid-cols-2 gap-(--space-2) @max-[820px]/main:grid-cols-1",
} as const;

/**
 * ReviewModeOptions are the two ways of reviewing the steps, as a radio group: the chosen one in the
 * brand tint with its check, the one being saved with the spinner. While one saves the group is busy
 * and ignores the arrows; when the options can't change they are read-only, with the reason.
 */
export function ReviewModeOptions({
  label,
  value,
  saving,
  disabled = false,
  disabledReason,
  layout,
  describedBy,
  onChoose,
  chosenRef,
}: ReviewModeOptionsProps) {
  const reasonId = useId();
  const mode = saving ?? value;
  const withReason = disabled && disabledReason !== undefined;
  const description = [describedBy, withReason ? reasonId : undefined].filter(Boolean).join(" ");

  return (
    <>
      <RadioGroup
        aria-label={label}
        {...(description !== "" ? { "aria-describedby": description } : {})}
        {...(saving !== null ? { "aria-busy": true } : {})}
        value={mode}
        onValueChange={(next) => {
          const chosen = asReviewMode(next as string);
          if (!disabled && saving === null && chosen !== mode) onChoose(chosen);
        }}
        {...(disabled ? { readOnly: true, "aria-disabled": true } : {})}
        className={LAYOUTS[layout]}
      >
        {MODE_OPTIONS.map((option) => (
          <Radio.Root
            key={option.mode}
            value={option.mode}
            {...(option.mode === mode && chosenRef !== undefined ? { ref: chosenRef } : {})}
            {...(option.mode === saving ? { "aria-busy": true } : {})}
            className={cn(
              "group/option grid w-full grid-cols-[var(--icon)_minmax(0,1fr)_var(--icon)] items-start gap-(--space-2) rounded-md border border-transparent p-(--space-2) text-left text-ink-1 outline-none transition-colors duration-(--duration-fast) ease-standard focus-visible:focus-ring",
              layout === "row" && "border-line-2 p-(--space-3)",
              "not-data-readonly:not-data-checked:hover:bg-veil-hover not-data-readonly:not-data-checked:active:bg-veil-press",
              "data-checked:border-transparent data-checked:bg-brand-tint data-checked:shadow-[inset_0_0_0_var(--border)_var(--brand-ring)]",
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
              <span className="font-medium">
                {reviewModeLabel(option.mode)}
                {option.mode === saving && " · saving…"}
              </span>{" "}
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
      {withReason && (
        <span id={reasonId} className="sr-only">
          {disabledReason}
        </span>
      )}
    </>
  );
}
