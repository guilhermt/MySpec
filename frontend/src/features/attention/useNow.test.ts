import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNow } from "@/features/attention/useNow";

const START = Date.parse("2026-09-05T10:00:00Z");
const INTERVAL_MS = 1000;

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useNow", () => {
  it("reads the time again every interval while active", () => {
    const { result } = renderHook(() => useNow(INTERVAL_MS, true));
    expect(result.current).toBe(START);

    advance(INTERVAL_MS - 1);
    expect(result.current).toBe(START);

    advance(1);
    expect(result.current).toBe(START + INTERVAL_MS);

    advance(INTERVAL_MS);
    expect(result.current).toBe(START + 2 * INTERVAL_MS);
  });

  it("does no work at all while inactive", () => {
    const { result } = renderHook(() => useNow(INTERVAL_MS, false));

    expect(vi.getTimerCount()).toBe(0);
    advance(5 * INTERVAL_MS);
    expect(result.current).toBe(START);
  });

  it("reads the time at once when it wakes up, and stops when it sleeps again", () => {
    const { result, rerender } = renderHook(({ active }) => useNow(INTERVAL_MS, active), {
      initialProps: { active: false },
    });
    advance(5 * INTERVAL_MS);

    rerender({ active: true });
    expect(result.current).toBe(START + 5 * INTERVAL_MS);

    rerender({ active: false });
    expect(vi.getTimerCount()).toBe(0);
    advance(3 * INTERVAL_MS);
    expect(result.current).toBe(START + 5 * INTERVAL_MS);
  });
});
