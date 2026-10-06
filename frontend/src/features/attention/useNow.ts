import { useCallback, useRef, useSyncExternalStore } from "react";
import { clockNow, subscribeClock } from "@/store/clock";

const NO_LISTENER = () => undefined;

/**
 * useNow is the current time, taken again every interval while active, from the clock that every
 * chip of the same interval shares. An inactive clock does no work at all and stays at the last
 * instant it read, the mount's when it never ran.
 */
export function useNow(intervalMs: number, active: boolean): number {
  const last = useRef<number>(null);
  last.current ??= Date.now();
  const subscribe = useCallback(
    (listener: () => void) => (active ? subscribeClock(intervalMs, listener) : NO_LISTENER),
    [intervalMs, active],
  );
  const shared = useSyncExternalStore(subscribe, () => clockNow(intervalMs));
  if (active) {
    last.current = shared;
  }
  return last.current;
}
