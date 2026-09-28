import { Popover as BasePopover } from "@base-ui/react/popover";
import type { ReactNode, RefObject } from "react";
import { Popover as UIPopover, PopoverTitle as UIPopoverTitle } from "@/components/ui/popover";
import { TOOLTIP_OFFSET_PX } from "./Tooltip";

export interface PopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** anchor is what the popover opens against: the trigger, or the ⋯ button when opened from its menu. */
  anchor: RefObject<HTMLElement | null>;
  /** finalFocus is where the focus returns on close: the anchor by default. */
  finalFocus?: RefObject<HTMLElement | null>;
  /** initialFocus is what takes the focus on open. */
  initialFocus?: RefObject<HTMLElement | null>;
  /** title is the visible title and the accessible name: "Review mode", "Models". */
  title: string;
  children: ReactNode;
}

/**
 * Popover is a floating sheet with a title, opened by its owner against an anchor: it has no trigger
 * of its own, so the same popover opens from a menu item that has already closed and from a chip.
 * Esc closes it and the focus returns to the anchor, or to finalFocus.
 */
export function Popover({
  open,
  onOpenChange,
  anchor,
  finalFocus,
  initialFocus,
  title,
  children,
}: PopoverProps) {
  return (
    <UIPopover open={open} onOpenChange={(next) => onOpenChange(next)}>
      <BasePopover.Portal>
        <BasePopover.Positioner
          anchor={anchor}
          side="bottom"
          align="end"
          sideOffset={TOOLTIP_OFFSET_PX}
          className="z-(--z-overlay)"
        >
          <BasePopover.Popup
            data-slot="popover-content"
            initialFocus={initialFocus ?? true}
            finalFocus={finalFocus ?? anchor}
            className="flex w-(--size-popover) flex-col gap-(--space-3) rounded-lg bg-surface-3 p-(--space-4) text-ink-1 shadow-float outline-none transition-opacity duration-(--duration-fast) ease-enter data-starting-style:opacity-0 data-ending-style:opacity-0"
          >
            <UIPopoverTitle className="text-(length:--text-ui) leading-(--leading-ui) font-semibold text-ink-1">
              {title}
            </UIPopoverTitle>
            {children}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </UIPopover>
  );
}
