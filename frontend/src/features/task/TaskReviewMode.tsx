import { ChevronDown } from "lucide-react";
import { Button } from "@/components/system/Button";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { Tooltip } from "@/components/system/Tooltip";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ReviewModePicker } from "@/features/review-mode/ReviewModePicker";
import { reviewModeLabel } from "@/lib/review-modes";
import { asReviewMode, type TaskSummary } from "@/lib/wails";
import { setReviewMode } from "@/store/actions";

/**
 * TaskReviewModeButton opens who reviews the steps of a task, from its header. Below 1040px of main
 * area only the icon stays, with the name in the tooltip.
 */
export function TaskReviewModeButton({ task }: { task: TaskSummary }) {
  const mode = asReviewMode(task.reviewMode);
  const text = `Review: ${reviewModeLabel(mode)}`;

  return (
    <Popover>
      <Tooltip content={text}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              icon={mode === "agent" ? ICONS.agentMode : ICONS.manualMode}
              className="@max-[1040px]/main:w-(--size-control-sm) @max-[1040px]/main:px-0"
            />
          }
        >
          <span className="@max-[1040px]/main:sr-only">{text}</span>
          <Icon icon={ChevronDown} size="sm" className="@max-[1040px]/main:hidden" />
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent align="end" className="w-80 gap-3 p-3">
        <PopoverHeader>
          <PopoverTitle>Review mode</PopoverTitle>
          <PopoverDescription>
            A change applies to the steps that haven't started and have no choice of their own.
          </PopoverDescription>
        </PopoverHeader>
        <div>
          <ReviewModePicker
            label="Task"
            value={mode}
            disabled={!task.reviewModeEditable}
            onChange={(next) => void setReviewMode(task.id, next)}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
