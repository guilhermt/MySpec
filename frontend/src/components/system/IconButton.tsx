import { useId } from "react";
import { cn } from "@/lib/utils";
import { Button, type ButtonBaseProps } from "./Button";
import { Icon } from "./Icon";
import type { IconGlyph } from "./icons";
import { Spinner } from "./Spinner";
import { Tooltip } from "./Tooltip";

export interface IconButtonProps
  extends Omit<ButtonBaseProps, "variant" | "icon" | "children" | "shortcut"> {
  label: string;
  /** tooltip is what the tooltip says when it says more than the label does. */
  tooltip?: string;
  loading?: boolean;
  icon: IconGlyph;
  shortcut?: string;
  variant?: "ghost" | "secondary";
}

const SQUARES = {
  md: "w-(--size-control) px-0",
  sm: "w-(--size-control-sm) px-0",
  xs: "w-(--size-control-xs) px-0",
} as const;

/** IconButton is a square button named by its tooltip, which also carries the disabled reason. */
export function IconButton({
  label,
  tooltip = label,
  icon,
  shortcut,
  variant = "ghost",
  size = "md",
  disabled,
  disabledReason,
  reasonId,
  loading,
  className,
  onClick,
  ...props
}: IconButtonProps) {
  const ownReasonId = useId();
  const reason = disabled && disabledReason !== undefined ? disabledReason : undefined;
  const describedBy = reasonId ?? (reason !== undefined ? ownReasonId : undefined);
  return (
    <>
      <Tooltip
        content={reason !== undefined ? `${tooltip} · ${reason}` : tooltip}
        {...(shortcut !== undefined ? { shortcut } : {})}
      >
        <Button
          variant={variant}
          size={size}
          aria-label={label}
          {...props}
          {...(disabled !== undefined ? { disabled } : {})}
          {...(loading ? { "aria-busy": true } : {})}
          {...(describedBy !== undefined ? { reasonId: describedBy } : {})}
          onClick={(event) => {
            // Loading, the label stays the name and the spinner takes the place of the icon.
            if (loading) {
              event.preventDefault();
              return;
            }
            onClick?.(event);
          }}
          className={cn(SQUARES[size], loading && "cursor-progress", className)}
        >
          {loading ? (
            <Spinner tone="current" />
          ) : (
            <Icon icon={icon} size={size === "md" ? "md" : "sm"} />
          )}
        </Button>
      </Tooltip>
      {reason !== undefined && reasonId === undefined && (
        <span id={ownReasonId} className="sr-only">
          {reason}
        </span>
      )}
    </>
  );
}
