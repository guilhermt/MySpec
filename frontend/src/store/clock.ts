interface Clock {
  now: number;
  listeners: Set<() => void>;
  timer: ReturnType<typeof setInterval> | null;
}

const clocks = new Map<number, Clock>();

function clockOf(intervalMs: number): Clock {
  let clock = clocks.get(intervalMs);
  if (clock === undefined) {
    clock = { now: Date.now(), listeners: new Set(), timer: null };
    clocks.set(intervalMs, clock);
  }
  return clock;
}

/** clockNow is the last instant the shared clock of the interval read. */
export function clockNow(intervalMs: number): number {
  return clockOf(intervalMs).now;
}

/**
 * subscribeClock listens to the shared clock of the interval: one timer per interval, running while
 * it has a listener, so every chip of the same interval ticks together. The clock that wakes up
 * reads the time at once: its last reading may be as old as the whole time it slept.
 */
export function subscribeClock(intervalMs: number, listener: () => void): () => void {
  const clock = clockOf(intervalMs);
  if (clock.listeners.size === 0) {
    clock.now = Date.now();
    clock.timer = setInterval(() => {
      clock.now = Date.now();
      for (const notify of clock.listeners) {
        notify();
      }
    }, intervalMs);
  }
  clock.listeners.add(listener);
  listener();
  return () => {
    clock.listeners.delete(listener);
    if (clock.listeners.size === 0 && clock.timer !== null) {
      clearInterval(clock.timer);
      clock.timer = null;
    }
  };
}
