import { Popover as BasePopover } from "@base-ui/react/popover";
import { useCallback, useEffect, useRef, useState } from "react";
import { LiveRegion } from "./LiveRegion";
import { TOOLTIP_OFFSET_PX } from "./Tooltip";

/** KEY_NOTICE_MS is how long a key notice stays on screen. */
export const KEY_NOTICE_MS = 4000;

/** KeyNoticeText is a key notice: what did not happen, and why. */
export interface KeyNoticeText {
  title: string;
  reason: string;
}

export interface KeyNoticeState {
  /** id grows with each notice, so a new one replaces the one on screen. */
  id: number;
  anchor: Element;
  text: KeyNoticeText;
}

/**
 * useKeyNotice holds the one key notice on screen: each show takes the place of the last and arms
 * the timeout that hides it.
 */
export function useKeyNotice(): {
  notice: KeyNoticeState | null;
  show: (anchor: Element, text: KeyNoticeText) => void;
  hide: () => void;
} {
  const [notice, setNotice] = useState<KeyNoticeState | null>(null);
  const next = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setNotice(null);
  }, []);

  const show = useCallback(
    (anchor: Element, text: KeyNoticeText) => {
      clearTimeout(timer.current);
      next.current += 1;
      setNotice({ id: next.current, anchor, text });
      timer.current = setTimeout(hide, KEY_NOTICE_MS);
    },
    [hide],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  return { notice, show, hide };
}

export interface KeyNoticeProps {
  notice: KeyNoticeState | null;
  onHide: () => void;
}

/**
 * KeyNotice says why a one-letter key did nothing, on the tooltip's surface under the row that took
 * the key. It never takes the focus. The next key, a click or a scroll closes it; the key that showed
 * it does not, since its own listener enters a tick later, and it listens before the row does, so a
 * key that shows another notice hides this one first. It has no popover-content slot, so the
 * global Esc does not count it as a layer: its owner handles Esc.
 */
export function KeyNotice({ notice, onHide }: KeyNoticeProps) {
  const id = notice?.id;
  useEffect(() => {
    if (id === undefined) return;
    const listen = setTimeout(() => window.addEventListener("keydown", onHide, true), 0);
    window.addEventListener("pointerdown", onHide);
    window.addEventListener("scroll", onHide, { capture: true, passive: true });
    return () => {
      clearTimeout(listen);
      window.removeEventListener("keydown", onHide, true);
      window.removeEventListener("pointerdown", onHide);
      window.removeEventListener("scroll", onHide, { capture: true });
    };
  }, [id, onHide]);

  return (
    <>
      <LiveRegion kind="status" className="sr-only">
        {notice !== null && `${notice.text.title} · ${notice.text.reason}`}
      </LiveRegion>
      <BasePopover.Root
        open={notice !== null}
        modal={false}
        onOpenChange={(open) => {
          if (!open) onHide();
        }}
      >
        <BasePopover.Portal>
          {notice !== null && (
            <BasePopover.Positioner
              anchor={notice.anchor}
              side="bottom"
              align="start"
              sideOffset={TOOLTIP_OFFSET_PX}
              className="z-(--z-tooltip)"
            >
              <BasePopover.Popup
                key={notice.id}
                aria-hidden="true"
                initialFocus={false}
                finalFocus={false}
                className="max-w-(--size-tooltip-max) rounded-sm bg-tooltip-surface px-(--space-2) py-(--space-1) text-(length:--text-meta) leading-(--leading-meta) text-tooltip-ink shadow-float outline-none motion-safe:transition-opacity motion-safe:duration-(--duration-fast) motion-safe:ease-enter motion-safe:data-starting-style:opacity-0"
              >
                <span className="font-semibold">{notice.text.title}</span>
                <span className="text-tooltip-ink-2">{` · ${notice.text.reason}`}</span>
              </BasePopover.Popup>
            </BasePopover.Positioner>
          )}
        </BasePopover.Portal>
      </BasePopover.Root>
    </>
  );
}
