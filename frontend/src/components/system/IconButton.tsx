import type { LucideIcon } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "./Button";
import { Icon } from "./Icon";
import { Tooltip } from "./Tooltip";

export interface IconButtonProps
  extends Omit<ButtonProps, "variant" | "icon" | "children" | "loadingLabel" | "shortcut"> {
  label: string;
  icon: LucideIcon;
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
  icon,
  shortcut,
  variant = "ghost",
  size = "md",
  disabled,
  disabledReason,
  reasonId,
  loading,
  className,
  ...props
}: IconButtonProps) {
  const ownReasonId = useId();
  const reason = disabled && disabledReason !== undefined ? disabledReason : undefined;
  const describedBy = reasonId ?? (reason !== undefined ? ownReasonId : undefined);
  return (
    <>
      <Tooltip
        content={reason !== undefined ? `${label} · ${reason}` : label}
        {...(shortcut !== undefined ? { shortcut } : {})}
      >
        <Button
          variant={variant}
          size={size}
          aria-label={label}
          {...props}
          {...(disabled !== undefined ? { disabled } : {})}
          {...(loading !== undefined ? { loading } : {})}
          {...(describedBy !== undefined ? { reasonId: describedBy } : {})}
          className={cn(SQUARES[size], className)}
        >
          {/* Loading, Button swaps the icon for the spinner. */}
          <Icon icon={icon} size={size === "md" ? "md" : "sm"} />
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
