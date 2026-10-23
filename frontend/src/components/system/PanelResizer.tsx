import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import { PANEL_KEY_STEP, type PanelGeometry, setAdjustedPanelWidth } from "./panel-width";

export interface PanelResizerProps {
  geometry: PanelGeometry;
}

/**
 * PanelResizer is the left edge of a right panel, which the pointer drags and ← → move, to widen it
 * from its default up to the main area less PANEL_UNCOVERED.
 */
export function PanelResizer({ geometry }: PanelResizerProps) {
  const [dragging, setDragging] = useState(false);
  // The drag reads the geometry of the render it is in, not the one it started in.
  const current = useRef(geometry);
  current.current = geometry;
  const stop = useRef<(() => void) | null>(null);

  useEffect(() => () => stop.current?.(), []);

  const clamp = (width: number) =>
    Math.min(Math.max(Math.floor(width), current.current.min), current.current.max);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = current.current.width;
    const move = (e: globalThis.PointerEvent) =>
      setAdjustedPanelWidth(clamp(startWidth + startX - e.clientX));
    const release = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      delete document.documentElement.dataset.panelResizing;
      stop.current = null;
      setDragging(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    document.documentElement.dataset.panelResizing = "";
    stop.current = release;
    setDragging(true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // A modified arrow belongs to someone else, such as Alt+← going back in the history.
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    const step =
      event.key === "ArrowLeft" ? PANEL_KEY_STEP : event.key === "ArrowRight" ? -PANEL_KEY_STEP : 0;
    if (step === 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setAdjustedPanelWidth(clamp(geometry.width + step));
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: a window splitter is a focusable separator; <hr> is not interactive
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the panel"
      aria-valuenow={geometry.width}
      aria-valuemin={geometry.min}
      aria-valuemax={geometry.max}
      tabIndex={0}
      data-dragging={dragging ? "" : undefined}
      className="group/resizer absolute inset-y-0 left-[calc(var(--space-1)*-1)] z-(--z-sticky) w-(--space-2) cursor-col-resize touch-none outline-none"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-(--space-1) w-(--border-2) -translate-x-1/2 bg-transparent transition-colors duration-(--duration-fast) ease-standard group-hover/resizer:bg-focus group-focus-visible/resizer:bg-focus group-data-[dragging]/resizer:bg-focus"
      />
    </div>
  );
}
