import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCardRefresh } from "@/features/task-create/useCardRefresh";
import { api } from "@/lib/wails";
import { makeBoardCard } from "@/test/wails-mock";

const STALE = () => makeBoardCard({ readAt: new Date(Date.now() - 10 * 60_000).toISOString() });

describe("useCardRefresh", () => {
  it("does nothing without a card or with a fresh one", () => {
    const fresh = makeBoardCard({ readAt: new Date().toISOString() });

    const none = renderHook(() => useCardRefresh("board-1", null));
    const recent = renderHook(() => useCardRefresh("board-1", fresh));

    expect(none.result.current.refreshing).toBe(false);
    expect(recent.result.current.refreshing).toBe(false);
    expect(api.refreshCard).not.toHaveBeenCalled();
  });

  it("reads a stale card again once, and changes the version when it ends", async () => {
    const card = STALE();

    const { result, rerender } = renderHook(() => useCardRefresh("board-1", card));

    expect(result.current.refreshing).toBe(true);
    await waitFor(() => expect(result.current.refreshing).toBe(false));
    rerender();
    expect(result.current.version).toBe(1);
    expect(api.refreshCard).toHaveBeenCalledTimes(1);
  });

  it("keeps the reason without its period when the refresh fails", async () => {
    vi.mocked(api.refreshCard).mockRejectedValue(new Error("GitHub rate limit reached."));
    const card = STALE();

    const { result } = renderHook(() => useCardRefresh("board-1", card));

    await waitFor(() => expect(result.current.refreshError).toBe("GitHub rate limit reached"));
    expect(result.current.version).toBe(1);
  });
});
