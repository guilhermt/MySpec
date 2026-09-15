import { Bot, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fallbackReason, REVIEW_MODES, reviewModeLabel } from "@/lib/review-modes";
import { cn } from "@/lib/utils";
import { asReviewMode, type ReviewFallback, type ReviewMode } from "@/lib/wails";

export interface ReviewModePickerProps {
  value: ReviewMode;
  onChange: (mode: ReviewMode) => void;
  /** label names what the mode is for, as a screen reader says it: "New tasks", "Task", "Step 4". */
  label: string;
  /** field is a bordered control of a form; inline is text-sized, for a list. */
  variant?: "field" | "inline";
  /** muted reads the value quietly, as a step that follows the task does. */
  muted?: boolean;
  disabled?: boolean;
}

/** ReviewModePicker is the one control that picks who reviews, wherever the app offers it. */
export function ReviewModePicker({
  value,
  onChange,
  label,
  variant = "field",
  muted = false,
  disabled = false,
}: ReviewModePickerProps) {
  const pick = (next: string) => {
    const mode = asReviewMode(next);
    if (mode !== value) {
      onChange(mode);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant={variant === "field" ? "outline" : "ghost"}
            size={variant === "field" ? "sm" : "xs"}
            disabled={disabled}
          />
        }
        aria-label={`${label} review mode: ${reviewModeLabel(value)}`}
        className={cn(
          variant === "field" && "min-w-32 justify-between",
          variant === "inline" && !muted && "font-medium",
          muted && "text-muted-foreground",
        )}
      >
        <ReviewModeName mode={value} />
        <ChevronsUpDown aria-hidden="true" className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={variant === "field" ? "start" : "end"} className="w-36">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Review mode</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={value} onValueChange={pick}>
            {REVIEW_MODES.map((mode) => (
              <DropdownMenuRadioItem key={mode} value={mode}>
                <ReviewModeName mode={mode} />
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** ReviewModeName is a mode as the app writes it: "Manual", or "Agent" after a robot. */
export function ReviewModeName({ mode }: { mode: ReviewMode }) {
  return (
    <span className="flex items-center gap-1.5">
      {mode === "agent" && <Bot aria-hidden="true" className="size-3.5" />}
      {reviewModeLabel(mode)}
    </span>
  );
}

export interface ReviewModeValueProps {
  mode: ReviewMode;
  fallback: ReviewFallback;
  className?: string;
}

/** ReviewModeValue is a mode that can no longer change; a step the user ended up reviewing says why. */
export function ReviewModeValue({ mode, fallback, className }: ReviewModeValueProps) {
  const reason = fallbackReason(fallback);
  if (reason === "") {
    return (
      <span className={cn("text-xs", className)}>
        <ReviewModeName mode={mode} />
      </span>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the tooltip opens on focus, so the keyboard reaches the reason it shows.
        render={<span tabIndex={0} />}
        className={cn(
          "rounded-sm text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <ReviewModeName mode={mode} />
        <span className="sr-only">{reason}</span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}
