import { type ComponentProps, type MouseEvent, type ReactNode, useId } from "react";
import { Button as UIButton } from "@/components/ui/button";
import { Toggle as UIToggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import type { ButtonLoading } from "./Button";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { ICONS } from "./icons";
import { Shimmer } from "./Shimmer";
import { Spinner } from "./Spinner";
import { StateGlyph } from "./StateGlyph";
import { Tooltip } from "./Tooltip";

export interface ChipBaseProps
  extends Omit<ComponentProps<"button">, "children" | "className" | "disabled" | "value"> {
  /** kind is what the chip does: toggles a filter, opens a menu, or acts once (a quick reply). */
  kind: "toggle" | "menu" | "action";
  children: ReactNode;
  pressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  size?: "md" | "sm";
  own?: boolean;
  defaultNote?: string;
  reading?: boolean;
  errorReason?: string;
  unavailableReason?: string;
  onRemove?: () => void;
  removeLabel?: string;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
}

/** ChipProps require the gerund on a chip that can load, as ButtonLoading does on a button. */
export type ChipProps = ChipBaseProps & ButtonLoading;

// Hover stays off the chosen or open chip. The plain hover:, rounded-lg and the pressed backgrounds neutralize the ui toggle and button.
const BASE =
  "h-(--size-chip) min-w-0 gap-1 px-2.5 rounded-(--radius-pill) border border-line-2 bg-surface-2 text-(length:--text-meta) leading-(--leading-meta) font-medium text-ink-2 shadow-none transition-colors duration-(--duration-fast) ease-standard hover:bg-surface-2 hover:text-ink-2 not-aria-disabled:not-aria-pressed:not-aria-expanded:hover:bg-surface-2-hover not-aria-disabled:not-aria-pressed:not-aria-expanded:hover:text-ink-1 focus-visible:border-line-2 focus-visible:ring-0 focus-visible:focus-ring active:not-aria-[haspopup]:translate-y-0 disabled:opacity-100 aria-disabled:dashed-disabled data-[state=on]:bg-brand-tint aria-pressed:bg-brand-tint aria-pressed:text-brand-ink aria-pressed:border-brand-ring aria-expanded:bg-brand-tint aria-expanded:text-brand-ink aria-expanded:border-brand-ring";

const SIZES = {
  md: "",
  sm: "h-(--size-chip-sm) px-2 text-(length:--text-micro) leading-(--leading-micro)",
} as const;

/**
 * ERROR is the error state, on data-error: the variant outweighs the plain classes of BASE, and the
 * hover is restated at the weight of the hover of BASE, so the error keeps its veil under the pointer.
 */
const ERROR =
  "data-error:border-state-error data-error:bg-state-error-veil data-error:text-state-error not-aria-disabled:not-aria-pressed:not-aria-expanded:data-error:hover:bg-state-error-veil not-aria-disabled:not-aria-pressed:not-aria-expanded:data-error:hover:text-state-error";

/**
 * Chip is a pill that toggles a filter, opens a menu of choices, or acts once, like a quick reply of
 * the composer. Saving, it shows the spinner and
 * the gerund; reading the catalog, the saved choice shimmers; in error, the error glyph and the
 * error ink on its veil, with the reason in the tooltip and in the description.
 */
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
  reading,
  errorReason,
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
  const errorId = useId();
  const error = errorReason !== undefined;
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
    ...(loading || reading ? { "aria-busy": true } : {}),
    ...(error ? { "data-error": "" } : {}),
    ...(withReason || error
      ? {
          "aria-describedby": [withReason ? reasonId : "", error ? errorId : ""]
            .filter(Boolean)
            .join(" "),
        }
      : {}),
    onClick: handleClick,
    className: cn(
      BASE,
      SIZES[size],
      own && "text-ink-1 border-line-3",
      ERROR,
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
      {error && <StateGlyph state="error" size="sm" />}
      {unavailable && <StateGlyph state="blocked" size="sm" />}
      {reading ? <Shimmer>{children}</Shimmer> : children}
      {unavailable && (
        <>
          {" "}
          <span className="font-normal text-ink-3">· unavailable</span>
        </>
      )}
      {kind === "menu" && <Icon icon={ICONS.expanded} size="xs" />}
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

  const note = errorReason ?? unavailableReason ?? (own ? defaultNote : undefined);
  if (note !== undefined) chip = <Tooltip content={note}>{chip}</Tooltip>;
  if (error) {
    // The tooltip is never the only carrier: the reason is also the description of the chip.
    chip = (
      <>
        {chip}
        <span id={errorId} className="sr-only">
          {errorReason}
        </span>
      </>
    );
  }

  if (onRemove !== undefined) {
    chip = (
      <span className="inline-flex items-center gap-0.5">
        {chip}
        <IconButton
          size="xs"
          label={removeLabel ?? "Remove"}
          icon={ICONS.close}
          onClick={onRemove}
        />
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
