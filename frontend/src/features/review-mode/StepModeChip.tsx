import { useId } from "react";
import { Chip } from "@/components/system/Chip";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/system/Menu";
import { Tooltip } from "@/components/system/Tooltip";
import { reviewModeLabel } from "@/lib/review-modes";
import { asReviewMode, type ReviewMode, type Step } from "@/lib/wails";

export interface StepModeChipProps {
  step: Step;
  /** taskMode is the review mode of the task, the one a step without a mode of its own follows. */
  taskMode: ReviewMode;
  onChange: (mode: ReviewMode) => void;
  /** onFollow drops the mode of the step, which follows the task again. */
  onFollow: () => void;
}

/** STEP_MODES are the modes the menu of a step offers, in its order. */
const STEP_MODES: readonly ReviewMode[] = ["agent", "manual"];

/** MODE_ICONS are the robot of the agent review and the person of the review by the user. */
const MODE_ICONS = { agent: ICONS.agentMode, manual: ICONS.manualMode } as const;

/**
 * StepModeChip picks who reviews a step not started. A mode of its own reads in the first ink, with
 * the mode of the task in the tooltip, and its menu offers to follow the task again; a step that
 * follows the task reads quietly.
 */
export function StepModeChip({ step, taskMode, onChange, onFollow }: StepModeChipProps) {
  const noteId = useId();
  const mode = asReviewMode(step.reviewMode);
  const own = step.reviewModeAdjusted;
  const note = own
    ? `Its own mode · the task reviews with ${reviewModeLabel(taskMode)}`
    : "Follows the task";

  const trigger = (
    <MenuTrigger
      render={
        <Chip
          kind="menu"
          size="sm"
          own={own}
          aria-label={`Review mode of step ${step.number}: ${reviewModeLabel(mode)}`}
          aria-describedby={noteId}
          {...(own ? { defaultNote: note } : { className: "text-ink-3" })}
        >
          <Icon icon={MODE_ICONS[mode]} size="xs" />
          {reviewModeLabel(mode)}
        </Chip>
      }
    />
  );

  return (
    <>
      <Menu>
        {/* The chip draws the note of its own mode; the note of a step that follows is here. */}
        {own ? trigger : <Tooltip content={note}>{trigger}</Tooltip>}
        <MenuContent align="end">
          <MenuRadioGroup
            value={mode}
            onValueChange={(next: string) => {
              const picked = asReviewMode(next);
              if (picked !== mode) onChange(picked);
            }}
          >
            {STEP_MODES.map((option) => (
              <MenuRadioItem key={option} value={option} icon={MODE_ICONS[option]}>
                {reviewModeLabel(option)}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
          {own && (
            <>
              <MenuSeparator />
              <MenuItem onClick={onFollow}>
                {`Follow the task · ${reviewModeLabel(taskMode)}`}
              </MenuItem>
            </>
          )}
        </MenuContent>
      </Menu>
      <span id={noteId} className="sr-only">
        {note}
      </span>
    </>
  );
}
