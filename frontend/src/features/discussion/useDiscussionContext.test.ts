import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDiscussionContext } from "@/features/discussion/useDiscussionContext";
import { api } from "@/lib/wails";
import { makeBoardCard } from "@/test/wails-mock";

const FRESH = new Date(Date.now() - 60_000).toISOString();
const STALE = new Date(Date.now() - 10 * 60_000).toISOString();

const LOGIN = makeBoardCard({ readAt: FRESH });
const RESET = makeBoardCard({ key: "dev/web#13", number: 13, readAt: FRESH });

describe("useDiscussionContext", () => {
  it("has no text until the context is read", async () => {
    const { result } = renderHook(() =>
      useDiscussionContext("board-1", "The login is slow", [LOGIN, RESET]),
    );

    expect(result.current).toEqual({ text: null, refreshing: false, failure: null });
    await waitFor(() => {
      expect(result.current.text).toContain("## Board");
    });
    expect(api.discussionContext).toHaveBeenCalledWith({
      boardId: "board-1",
      text: "The login is slow",
      cards: ["dev/web#12", "dev/web#13"],
    });
    expect(api.refreshCard).not.toHaveBeenCalled();
  });

  it("refreshes the stale cards and reads the context again", async () => {
    const { result } = renderHook(() =>
      useDiscussionContext("board-1", "", [makeBoardCard({ readAt: STALE }), RESET]),
    );

    expect(result.current.refreshing).toBe(true);
    await waitFor(() => {
      expect(result.current.refreshing).toBe(false);
    });
    expect(api.refreshCard).toHaveBeenCalledOnce();
    expect(api.refreshCard).toHaveBeenCalledWith("board-1", "dev/web#12");
    await waitFor(() => {
      expect(api.discussionContext).toHaveBeenCalledTimes(2);
    });
  });

  it("gives the reason a card could not be read again, without its final period", async () => {
    vi.mocked(api.refreshCard).mockRejectedValueOnce(new Error("GitHub rate limit reached."));

    const { result } = renderHook(() =>
      useDiscussionContext("board-1", "", [makeBoardCard({ readAt: STALE })]),
    );

    await waitFor(() => {
      expect(result.current.failure).toBe("GitHub rate limit reached");
    });
  });

  it("reads the context again once the typing rests, and keeps the last one when it fails", async () => {
    const { result, rerender } = renderHook(
      ({ text }) => useDiscussionContext("board-1", text, [LOGIN]),
      { initialProps: { text: "" } },
    );
    await waitFor(() => {
      expect(result.current.text).not.toBeNull();
    });
    const last = result.current.text;
    vi.mocked(api.discussionContext).mockRejectedValueOnce(new Error("no"));

    rerender({ text: "Billing" });

    await waitFor(() => {
      expect(api.discussionContext).toHaveBeenLastCalledWith({
        boardId: "board-1",
        text: "Billing",
        cards: ["dev/web#12"],
      });
    });
    expect(result.current.text).toBe(last);
  });
});
