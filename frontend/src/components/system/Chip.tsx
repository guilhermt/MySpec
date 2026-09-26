import { ChevronDown, X } from "lucide-react";
import { type ComponentProps, type MouseEvent, type ReactNode, useId } from "react";
import { Button as UIButton } from "@/components/ui/button";
import { Toggle as UIToggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { Spinner } from "./Spinner";
import { StateGlyph } from "./StateGlyph";
import { Tooltip } from "./Tooltip";

export interface ChipProps
  extends Omit<ComponentProps<"button">, "children" | "className" | "disabled" | "value"> {
  kind: "toggle" | "menu";
  children: ReactNode;
  pressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  size?: "md" | "sm" | "xs";
  own?: boolean;
  defaultNote?: string;
  loading?: boolean;
  loadingLabel?: string;
  unavailableReason?: string;
  onRemove?: () => void;
  removeLabel?: string;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
}

// Hover stays off the chosen or open chip. The plain hover:, rounded-lg and the pressed backgrounds neutralize the ui toggle and button.
const BASE =
  "h-(--size-chip) min-w-0 gap-1 px-2.5 rounded-(--radius-pill) border border-line-2 bg-surface-2 text-(length:--text-meta) leading-(--leading-meta) font-medium text-ink-2 shadow-none transition-colors duration-(--duration-fast) ease-standard hover:bg-surface-2 hover:text-ink-2 not-aria-disabled:not-aria-pressed:not-aria-expanded:hover:bg-surface-2-hover not-aria-disabled:not-aria-pressed:not-aria-expanded:hover:text-ink-1 focus-visible:border-line-2 focus-visible:ring-0 focus-visible:focus-ring active:not-aria-[haspopup]:translate-y-0 disabled:opacity-100 aria-disabled:dashed-disabled data-[state=on]:bg-brand-tint aria-pressed:bg-brand-tint aria-pressed:text-brand-ink aria-pressed:border-brand-ring aria-expanded:bg-brand-tint aria-expanded:text-brand-ink aria-expanded:border-brand-ring";

const SIZES = {
  md: "",
  sm: "h-(--size-control-sm)",
  xs: "h-(--size-control-xs) px-2 text-(length:--text-micro) leading-(--leading-micro)",
} as const;

/** Chip is a pill that toggles a filter or opens a menu of choices. */
export function Chip({
  kind,
  children,
  pressed,
  onPressedChange,
  size = "md",
  own,
  defaultNote,
  loading,
  loadingLabel,
  unavailableReason,
  onRemove,
  removeLabel,
  disabled,
  disabledReason,
  className,
  onClick,
  ...props
}: ChipProps) {
  const reasonId = useId();
  const withReason = disabled === true && disabledReason !== undefined;
  const inert = disabled === true || loading === true;
  const unavailable = unavailableReason !== undefined;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (inert) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  const attributes = {
    ...props,
    ...(disabled ? { "aria-disabled": true } : {}),
    ...(loading ? { "aria-busy": true } : {}),
    ...(withReason ? { "aria-describedby": reasonId } : {}),
    onClick: handleClick,
    className: cn(
      BASE,
      SIZES[size],
      own && "text-ink-1 border-line-3",
      loading && "cursor-progress",
      className,
    ),
  };

  const content = loading ? (
    <>
      <Spinner tone="current" />
      {loadingLabel}
    </>
  ) : (
    <>
      {unavailable && <StateGlyph state="blocked" size="sm" />}
      {children}
      {unavailable && " · unavailable"}
      {kind === "menu" && <Icon icon={ChevronDown} size="xs" />}
    </>
  );

  let chip =
    kind === "toggle" ? (
      <UIToggle
        {...attributes}
        pressed={pressed ?? false}
        onPressedChange={(next) => {
          if (!inert && !unavailable) onPressedChange?.(next);
        }}
      >
        {content}
      </UIToggle>
    ) : (
      <UIButton variant="default" size="default" {...attributes}>
        {content}
      </UIButton>
    );

  const note = unavailableReason ?? (own ? defaultNote : undefined);
  if (note !== undefined) chip = <Tooltip content={note}>{chip}</Tooltip>;

  if (onRemove !== undefined) {
    chip = (
      <span className="inline-flex items-center gap-0.5">
        {chip}
        <IconButton size="xs" label={removeLabel ?? "Remove"} icon={X} onClick={onRemove} />
      </span>
    );
  }

  if (!withReason) return chip;
  return (
    <span className="inline-flex items-center gap-2">
      {chip}
      <span id={reasonId} className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
        {disabledReason}
      </span>
    </span>
  );
}
