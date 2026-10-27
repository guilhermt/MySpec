import type { FocusEvent, KeyboardEvent } from "react";
import { moveFocus, type Slot } from "@/features/deploys/deploy-matrix";

export interface DeployGridKeyboard {
  /** tabIndexOf is 0 on the one Tab stop of the grid and -1 on every other slot. */
  tabIndexOf: (key: string) => 0 | -1;
  /** onKeyDown moves the focus between the slots; it goes on the view. */
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => boolean;
  /** onFocus follows the slot holding the focus; it goes on the grid. */
  onFocus: (event: FocusEvent<HTMLElement>) => void;
}

/** SLOT_ATTRIBUTE marks each cell and passage of the grid with its slot key, which the keyboard focuses by. */
export const SLOT_ATTRIBUTE = "data-slot-key";

/** NAVIGATION are the keys the grid walks with. */
const NAVIGATION = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]);

/** slotOf is the slot a node sits in, null outside the grid. */
export function slotOf(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>(`[${SLOT_ATTRIBUTE}]`) : null;
}

/**
 * useDeployGridKeyboard is the roving tabindex of the matrix: one Tab stop, on the slot of
 * focusKey, else the first slot. The arrows, Home and End (with Ctrl, the whole grid) move the
 * focus and never open anything. A key with Alt or Meta is left to the app.
 */
export function useDeployGridKeyboard(
  rows: readonly (readonly Slot[])[],
  focusKey: string | null,
  setFocusKey: (key: string) => void,
): DeployGridKeyboard {
  const first = rows[0]?.[0]?.key ?? null;
  const valid = focusKey !== null && rows.some((row) => row.some((slot) => slot.key === focusKey));
  const stop = valid ? focusKey : first;

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): boolean => {
    if (event.altKey || event.metaKey || !NAVIGATION.has(event.key)) {
      return false;
    }
    const slot = slotOf(event.target);
    if (slot === null) {
      return false;
    }
    const ctrl = event.ctrlKey;
    if (ctrl && event.key !== "Home" && event.key !== "End") {
      return false;
    }
    const target = moveFocus(rows, slot.getAttribute(SLOT_ATTRIBUTE) ?? "", event.key, ctrl);
    event.preventDefault();
    if (target === null) {
      return true;
    }
    setFocusKey(target);
    event.currentTarget
      .querySelector<HTMLElement>(`[${SLOT_ATTRIBUTE}="${CSS.escape(target)}"]`)
      ?.focus();
    return true;
  };

  return {
    tabIndexOf: (key) => (key === stop ? 0 : -1),
    onKeyDown,
    onFocus: (event) => {
      const key = slotOf(event.target)?.getAttribute(SLOT_ATTRIBUTE);
      if (key !== null && key !== undefined) {
        setFocusKey(key);
      }
    },
  };
}
