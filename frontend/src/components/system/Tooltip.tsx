import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { type ReactElement, type ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface TooltipProps {
  /** content is what the tooltip says; a list of strings is one line each. */
  content: ReactNode | readonly string[];
  shortcut?: string;
  sub?: string;
  side?: "bottom" | "top";
  /** hover opens the tooltip under the pointer; false leaves it to keyboard focus. */
  hover?: boolean;
  /** focusOn narrows the focus that opens the tooltip to the descendants it answers true for. */
  focusOn?: (target: Element) => boolean;
  children: ReactElement;
}

/** TOOLTIP_DELAY_MS mirrors --delay-tooltip of tokens.css: the pause before a tooltip opens on hover. */
export const TOOLTIP_DELAY_MS = 500;

/** TOOLTIP_OFFSET_PX mirrors --space-1-5 of tokens.css: the gap between a tooltip and its target. */
export const TOOLTIP_OFFSET_PX = 6;

/**
 * Tooltip names a control on hover after the pause, at once on keyboard focus, and closes on scroll.
 * A focus that is not visible, like the one a dialog opened with the pointer places, opens nothing.
 */
export function Tooltip({
  content,
  shortcut,
  sub,
  side,
  hover = true,
  focusOn,
  children,
}: TooltipProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", close, { capture: true });
  }, [open]);

  return (
    <BaseTooltip.Root
      open={open}
      onOpenChange={(next, details) => {
        if (next && details.reason === "trigger-focus") {
          if (!focusVisible(details.event)) return;
          const target = details.event.target;
          if (focusOn !== undefined && !(target instanceof Element && focusOn(target))) return;
        }
        if (!hover && details.reason === "trigger-hover") return;
        setOpen(next);
      }}
    >
      <BaseTooltip.Trigger render={children} delay={TOOLTIP_DELAY_MS} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner
          side={side ?? "bottom"}
          sideOffset={TOOLTIP_OFFSET_PX}
          className="z-(--z-tooltip)"
        >
          <BaseTooltip.Popup
            role="tooltip"
            className={cn(
              "flex max-w-(--size-tooltip-max) rounded-sm bg-tooltip-surface px-(--space-2) py-(--space-1) text-(length:--text-meta) leading-(--leading-meta) font-normal text-tooltip-ink shadow-float transition-opacity duration-(--duration-fast) ease-enter data-starting-style:opacity-0",
              sub !== undefined
                ? "flex-col items-start gap-(--space-0-5)"
                : "items-center gap-(--space-2)",
            )}
          >
            {isLines(content) ? (
              <span className="flex flex-col">
                {content.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </span>
            ) : (
              content
            )}
            {sub !== undefined && <span className="text-tooltip-ink-2">{sub}</span>}
            {shortcut !== undefined && (
              <kbd className="font-mono text-(length:--text-micro) leading-(--leading-micro) text-tooltip-ink-2 whitespace-nowrap">
                {shortcut}
              </kbd>
            )}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}

/** isLines tells whether the content is a list of lines. */
function isLines(content: ReactNode | readonly string[]): content is readonly string[] {
  return Array.isArray(content) && content.every((line) => typeof line === "string");
}

/** focusVisible tells whether the focus an event brought matches :focus-visible, keyboard focus. */
function focusVisible(event: Event): boolean {
  const element = event.target;
  if (!(element instanceof Element)) return false;
  return (
    element.matches(":focus-visible") ||
    (document.documentElement.dataset.input === "keyboard" && element.matches(":focus"))
  );
}
