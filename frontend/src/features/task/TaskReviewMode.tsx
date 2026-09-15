import { Bot, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ReviewModePicker } from "@/features/review-mode/ReviewModePicker";
import { reviewModeLabel } from "@/lib/review-modes";
import { asReviewMode, type TaskSummary } from "@/lib/wails";
import { setReviewMode } from "@/store/actions";

/** TaskReviewModeButton opens who reviews the steps of a task, from its header. */
export function TaskReviewModeButton({ task }: { task: TaskSummary }) {
  const mode = asReviewMode(task.reviewMode);
  const Icon = mode === "agent" ? Bot : UserRound;

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={<PopoverTrigger render={<Button variant="ghost" size="icon-sm" />} />}
          aria-label={`Review mode: ${reviewModeLabel(mode)}`}
        >
          <Icon />
        </TooltipTrigger>
        <TooltipContent>Review mode</TooltipContent>
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
