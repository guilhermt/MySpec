import { Pause, Play } from "lucide-react";
import { Button } from "@/components/system/Button";
import { Tooltip } from "@/components/system/Tooltip";

export interface PauseButtonProps {
  /** paused turns the button into Resume. */
  paused: boolean;
  disabled?: boolean;
  onClick: () => void;
}

/**
 * PauseButton pauses or resumes the conversation of the place, from its header. Below 1360px of
 * main area only the icon stays, with the name in the tooltip.
 */
export function PauseButton({ paused, disabled = false, onClick }: PauseButtonProps) {
  const label = paused ? "Resume" : "Pause";
  return (
    <Tooltip content={label}>
      <Button
        variant="ghost"
        size="sm"
        icon={paused ? Play : Pause}
        disabled={disabled}
        onClick={onClick}
        className="@max-[1360px]/main:w-(--size-control-sm) @max-[1360px]/main:px-0"
      >
        <span className="@max-[1360px]/main:sr-only">{label}</span>
      </Button>
    </Tooltip>
  );
}
