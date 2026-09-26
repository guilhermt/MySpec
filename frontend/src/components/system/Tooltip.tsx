import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { type ReactElement, type ReactNode, useEffect, useState } from "react";

export interface TooltipProps {
  content: ReactNode;
  shortcut?: string;
  sub?: string;
  side?: "bottom" | "top";
  children: ReactElement;
}

/** TOOLTIP_DELAY_MS mirrors --delay-tooltip of tokens.css: the pause before a tooltip opens on hover. */
export const TOOLTIP_DELAY_MS = 500;

/** Tooltip names a control on hover after the pause, at once on keyboard focus, and closes on scroll. */
export function Tooltip({ content, shortcut, sub, side, children }: TooltipProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", close, { capture: true });
  }, [open]);

  return (
    <BaseTooltip.Root open={open} onOpenChange={setOpen}>
      <BaseTooltip.Trigger render={children} delay={TOOLTIP_DELAY_MS} />
      <BaseTooltip.Portal>
        {/* sideOffset 6 is --space-1-5. */}
        <BaseTooltip.Positioner side={side ?? "bottom"} sideOffset={6} className="z-(--z-tooltip)">
          <BaseTooltip.Popup
            role="tooltip"
            className="flex max-w-(--size-tooltip-max) items-center gap-2 rounded-sm bg-tooltip-surface px-2 py-1 text-(length:--text-meta) leading-(--leading-meta) font-normal text-tooltip-ink shadow-float transition-opacity duration-(--duration-fast) ease-enter data-starting-style:opacity-0"
          >
            {content}
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
