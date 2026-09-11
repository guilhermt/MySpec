import { useEffect, useState } from "react";

/**
 * useNow is the current time, taken again every interval while active. An
 * inactive clock does no work at all.
 */
export function useNow(intervalMs: number, active: boolean): number {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!active) {
      return;
    }
    // A clock that wakes up reads the time at once: the last reading may be as
    // old as the whole time it slept.
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, active]);

  return now;
}
