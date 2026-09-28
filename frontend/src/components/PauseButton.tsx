import { useId } from "react";
import { Button } from "@/components/system/Button";
import { ICONS } from "@/components/system/icons";
import { Tooltip } from "@/components/system/Tooltip";
import { cn } from "@/lib/utils";

export interface PauseButtonProps {
  /** paused turns the button into Resume. */
  paused: boolean;
  disabled?: boolean;
  /** loading is the pause or the resume on its way: Pausing… or Resuming… with the spinner. */
  loading?: boolean;
  /** disabledReason is why nothing can be paused; it disables the button and is its tooltip and description. */
  disabledReason?: string;
  /** pausedSince is the time of the pause, "14:52"; "" when it is unknown. */
  pausedSince?: string;
  /**
   * item is what the button pauses, named in its tooltip and description: "the task". Without it the
   * tooltip is the bare name of the button.
   */
  item?: string;
  onClick: () => void;
}

/**
 * PauseButton pauses or resumes the conversation of the place, from its header, with no dialog. Below
 * 1360px of main area only the icon stays, with the name in the tooltip.
 */
export function PauseButton({
  paused,
  disabled = false,
  loading = false,
  disabledReason,
  pausedSince = "",
  item,
  onClick,
}: PauseButtonProps) {
  const descriptionId = useId();
  const label = paused ? "Resume" : "Pause";
  const refused = disabledReason !== undefined;
  const description = describe(paused, pausedSince, item, disabledReason);
  return (
    <>
      <Tooltip content={description ?? label}>
        <Button
          variant="ghost"
          size="sm"
          icon={paused ? ICONS.resume : ICONS.pause}
          disabled={disabled || refused}
          loading={loading}
          loadingLabel={paused ? "Resuming…" : "Pausing…"}
          {...(description !== undefined ? { reasonId: descriptionId } : {})}
          onClick={onClick}
          // The gerund has no icon to fold into: it keeps its width, which the title gives up.
          className={cn(
            !loading && "@max-[1360px]/main:w-(--size-control-sm) @max-[1360px]/main:px-0",
          )}
        >
          <span className="@max-[1360px]/main:sr-only">{label}</span>
        </Button>
      </Tooltip>
      {description !== undefined && (
        <span id={descriptionId} className="sr-only">
          {description}
        </span>
      )}
    </>
  );
}

// describe is what the tooltip and the description say: the reason nothing can be paused, or what
// the button does to the item. Without an item there is nothing more than the name to say.
function describe(
  paused: boolean,
  pausedSince: string,
  item: string | undefined,
  disabledReason: string | undefined,
): string | undefined {
  if (disabledReason !== undefined) {
    return disabledReason;
  }
  if (item === undefined) {
    return undefined;
  }
  if (!paused) {
    return `Pause ${item} · the session that works stops`;
  }
  return pausedSince === "" ? `Resume ${item}` : `Resume ${item} · paused since ${pausedSince}`;
}
