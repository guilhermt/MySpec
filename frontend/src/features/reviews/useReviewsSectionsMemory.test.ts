import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useReviewsSectionsMemory } from "@/features/reviews/useReviewsSectionsMemory";
import { REVIEWS_SECTIONS_KEY } from "@/lib/ui-storage";

afterEach(() => {
  localStorage.clear();
});

describe("useReviewsSectionsMemory", () => {
  it("starts with the sections that never wait for the user collapsed, and keeps nothing yet", () => {
    const { result } = renderHook(() => useReviewsSectionsMemory());

    expect([...result.current[0]]).toEqual(["reviewed", "yours"]);
    expect(localStorage.getItem(REVIEWS_SECTIONS_KEY)).toBeNull();
  });

  it("keeps each choice and reads it on the next run", () => {
    const first = renderHook(() => useReviewsSectionsMemory());
    act(() => first.result.current[1]("reviewed"));
    act(() => first.result.current[1]("pending"));

    expect(JSON.parse(localStorage.getItem(REVIEWS_SECTIONS_KEY) ?? "null")).toEqual({
      collapsed: ["yours", "pending"],
    });
    first.unmount();

    const second = renderHook(() => useReviewsSectionsMemory());
    expect([...second.result.current[0]]).toEqual(["yours", "pending"]);
  });

  it("keeps an empty choice: every section expanded stays expanded", () => {
    const first = renderHook(() => useReviewsSectionsMemory());
    act(() => first.result.current[1]("reviewed"));
    act(() => first.result.current[1]("yours"));
    first.unmount();

    const second = renderHook(() => useReviewsSectionsMemory());

    expect([...second.result.current[0]]).toEqual([]);
  });

  it("falls back to the default on a value it cannot read", () => {
    localStorage.setItem(REVIEWS_SECTIONS_KEY, JSON.stringify({ collapsed: ["nowhere"] }));

    const { result } = renderHook(() => useReviewsSectionsMemory());

    expect([...result.current[0]]).toEqual(["reviewed", "yours"]);
  });
});
