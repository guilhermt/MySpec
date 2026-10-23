// The geometry of the right panels and the width the user gave them, shared by every panel while the app runs.

import { useSyncExternalStore } from "react";

/** PanelFamily is the kind of a right panel: an item panel (task, review, discussion) or a list panel (board, Reviews). */
export type PanelFamily = "item" | "list";

const FAMILIES: Record<PanelFamily, { min: number; share: number; max: number; keep: number }> = {
  // Item panels stand beside the reading column while it keeps 760px.
  item: { min: 360, share: 0.28, max: 480, keep: 760 },
  // List panels stand beside the list while it keeps 440px.
  list: { min: 360, share: 0.42, max: 640, keep: 440 },
};

/** PANEL_UNCOVERED is the strip of the main area, in px, that a panel at its widest leaves uncovered. */
export const PANEL_UNCOVERED = 64;

/** PANEL_KEY_STEP is the width, in px, that one arrow key adds to a panel or takes from it. */
export const PANEL_KEY_STEP = 32;

/** PanelGeometry is what a panel needs to draw itself in a main area. */
export interface PanelGeometry {
  /** width is the width the panel renders at, in whole px. */
  width: number;
  /** min is the default width of the panel's family, below which it never goes. */
  min: number;
  /** max is the widest the panel goes: the area less PANEL_UNCOVERED, never below min. */
  max: number;
  /** beside is whether the panel stands beside the content, which keeps the room of its family. */
  beside: boolean;
}

/**
 * panelGeometry works out the width of a panel of a family in a main area of `area` px, given the width
 * the user adjusted it to, if any, and whether it stands beside the content or covers it.
 */
export function panelGeometry(
  family: PanelFamily,
  area: number,
  adjusted: number | null,
): PanelGeometry {
  const f = FAMILIES[family];
  const min = Math.floor(Math.min(Math.max(f.min, f.share * area), f.max));
  const max = Math.max(min, Math.floor(area) - PANEL_UNCOVERED);
  const width = Math.min(Math.max(min, adjusted ?? min), max);
  return { width, min, max, beside: area - width >= f.keep };
}

let adjusted: number | null = null;
const listeners = new Set<() => void>();

/** getAdjustedPanelWidth is the width the user gave the panels, or null when they never did. */
export function getAdjustedPanelWidth(): number | null {
  return adjusted;
}

/** setAdjustedPanelWidth sets the width every panel opens at; null forgets it, as tests do between cases. */
export function setAdjustedPanelWidth(width: number | null): void {
  if (width === adjusted) {
    return;
  }
  adjusted = width;
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** useAdjustedPanelWidth reads the width the user gave the panels, and renders again when it changes. */
export function useAdjustedPanelWidth(): number | null {
  return useSyncExternalStore(subscribe, getAdjustedPanelWidth);
}
