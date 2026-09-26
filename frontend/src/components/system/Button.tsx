import { cva } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import { type ComponentProps, useId } from "react";
import { Button as UIButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import { Kbd } from "./Kbd";
import { Spinner } from "./Spinner";

export interface ButtonProps
  extends Omit<ComponentProps<typeof UIButton>, "variant" | "size" | "className"> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "new";
  size?: "md" | "sm" | "xs";
  icon?: LucideIcon;
  shortcut?: string;
  pressed?: boolean;
  error?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  disabledReason?: string;
  reasonId?: string;
  className?: string;
}

/**
 * button holds the variants of .btn in the specimen. Each plain hover: resets the ui hover, and the
 * not-aria-disabled: ones keep hover and press off while disabled.
 */
const button = cva(
  "h-(--size-control) gap-1.5 px-3 rounded-sm border border-line-2 bg-surface-2 text-ink-2 text-(length:--text-ui) leading-(--leading-ui) font-medium shadow-button transition-[background-color,border-color,color,box-shadow] duration-(--duration-fast) ease-standard focus-visible:ring-0 focus-visible:focus-ring active:not-aria-[haspopup]:translate-y-0 disabled:opacity-100 aria-disabled:dashed-disabled",
  {
    variants: {
      variant: {
        secondary:
          "hover:bg-surface-2 not-aria-disabled:hover:bg-surface-2-hover not-aria-disabled:hover:text-ink-1 not-aria-disabled:active:bg-surface-2-press not-aria-disabled:active:shadow-none focus-visible:border-line-2",
        primary:
          "hover:bg-brand border-brand bg-brand text-brand-on shadow-primary not-aria-disabled:hover:border-brand-hover not-aria-disabled:hover:bg-brand-hover not-aria-disabled:active:border-brand-active not-aria-disabled:active:bg-brand-active not-aria-disabled:active:shadow-none focus-visible:border-brand",
        danger:
          "hover:bg-state-error border-state-error bg-state-error text-state-error-on shadow-primary not-aria-disabled:hover:border-state-error-hover not-aria-disabled:hover:bg-state-error-hover not-aria-disabled:active:border-state-error-press not-aria-disabled:active:bg-state-error-press not-aria-disabled:active:shadow-none focus-visible:border-state-error",
        ghost:
          "hover:bg-transparent border-transparent bg-transparent shadow-none text-ink-2 not-aria-disabled:not-aria-pressed:hover:bg-veil-hover not-aria-disabled:not-aria-pressed:hover:text-ink-1 not-aria-disabled:not-aria-pressed:active:bg-veil-press focus-visible:border-transparent aria-pressed:bg-brand-tint-plane aria-pressed:text-brand-ink",
        new: "hover:bg-surface-2 focus-visible:border-transparent border-transparent bg-surface-2 text-brand-ink shadow-xs not-aria-disabled:hover:bg-brand-tint-hover not-aria-disabled:active:bg-brand-tint-press not-aria-disabled:active:shadow-none",
      },
      size: {
        md: "",
        sm: "h-(--size-control-sm) px-2.5 gap-1 text-(length:--text-meta) leading-(--leading-meta)",
        xs: "h-(--size-control-xs) px-2 gap-1 text-(length:--text-micro) leading-(--leading-micro)",
      },
    },
  },
);

/** Button is the system button: primary, secondary, ghost, danger or new, with its common states. */
export function Button({
  variant = "secondary",
  size = "md",
  icon,
  shortcut,
  pressed,
  error,
  loading,
  loadingLabel,
  disabled,
  disabledReason,
  reasonId,
  className,
  children,
  onClick,
  ...props
}: ButtonProps) {
  const ownReasonId = useId();
  const solid = variant === "primary" || variant === "danger";
  const describedBy =
    reasonId ?? (disabled && disabledReason !== undefined ? ownReasonId : undefined);

  const handleClick: ButtonProps["onClick"] = (event) => {
    // Base UI blocks the click while disabled; loading is the wrapper's own.
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  const control = (
    <UIButton
      variant="default"
      size="default"
      focusableWhenDisabled
      {...props}
      {...(disabled !== undefined ? { disabled } : {})}
      {...(pressed !== undefined ? { "aria-pressed": pressed } : {})}
      {...(loading ? { "aria-busy": true } : {})}
      {...(describedBy !== undefined ? { "aria-describedby": describedBy } : {})}
      onClick={handleClick}
      className={cn(
        button({ variant, size }),
        error && "border-state-error text-state-error bg-state-error-veil shadow-none",
        loading && "cursor-progress",
        className,
      )}
    >
      {loading ? (
        <>
          <Spinner tone={solid ? "on-solid" : "current"} />
          {loadingLabel}
        </>
      ) : (
        <>
          {icon !== undefined && <Icon icon={icon} size={size === "xs" ? "sm" : "md"} />}
          {children}
          {shortcut !== undefined && (
            <span aria-hidden="true">
              {/* The key of the action has no border and no body; on a solid button it keeps the ring of on-primary. */}
              <Kbd
                variant={solid ? "on-primary" : "default"}
                className={cn("h-auto", !solid && "border-0 bg-transparent px-0 shadow-none")}
              >
                {shortcut}
              </Kbd>
            </span>
          )}
        </>
      )}
    </UIButton>
  );

  if (!disabled || disabledReason === undefined || reasonId !== undefined) return control;
  return (
    <span className="inline-flex items-center gap-2">
      {control}
      <span
        id={ownReasonId}
        className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3"
      >
        {disabledReason}
      </span>
    </span>
  );
}
