import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useStartCard } from "@/features/board/useStartCard";
import { api, type BoardCard } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { resetAppStore } from "@/test/render";
import { makeBoard, makeBoardCard } from "@/test/wails-mock";

const BOARD = makeBoard();
const LOGIN = makeBoardCard({ action: "clone" });
const HEADER = makeBoardCard({ key: "dev/web#7", number: 7, action: "clone" });

describe("useStartCard", () => {
  it("keeps a failed clone on the card that asked for it", async () => {
    resetAppStore({});
    vi.mocked(api.cloneRepository).mockRejectedValueOnce(new Error("gh couldn't clone dev/web."));
    const { result, rerender } = renderHook(
      ({ card }: { card: BoardCard }) => useStartCard(BOARD, card),
      { initialProps: { card: LOGIN } },
    );

    await act(async () => {
      await result.current.clone();
    });

    expect(result.current.error).toBe("gh couldn't clone dev/web.");
    expect(result.current.busy).toBe(false);

    rerender({ card: HEADER });

    expect(result.current.error).toBeNull();
  });

  it("does not offer a step for a clone: the card goes to its primary action", () => {
    resetAppStore({});
    const { result } = renderHook(() => useStartCard(BOARD, LOGIN));

    let order: ReturnType<typeof result.current.run> = null;
    act(() => {
      order = result.current.run(LOGIN);
    });

    expect(order).toBe("focus-primary");
    expect(result.current.offer).toBeNull();
  });

  it("opens the dialog of a card that can start", () => {
    resetAppStore({});
    const card = makeBoardCard({ action: "start" });
    const { result } = renderHook(() => useStartCard(BOARD, card));

    act(() => {
      result.current.run(card);
    });

    expect(useAppStore.getState().newTaskOpen).toBe(true);
    expect(useAppStore.getState().newTaskCard).toEqual({ boardId: BOARD.id, key: card.key });
  });

  it("offers Add to board for the card that asked, and only for it", () => {
    resetAppStore({});
    const add = makeBoardCard({ action: "add_to_board" });
    const { result, rerender } = renderHook(
      ({ card }: { card: BoardCard }) => useStartCard(BOARD, card),
      { initialProps: { card: add } },
    );

    act(() => {
      result.current.run(add);
    });
    expect(result.current.offer).toBe("add");

    rerender({ card: HEADER });
    expect(result.current.offer).toBeNull();
  });

  it("tells the view which card asked for its clone", async () => {
    resetAppStore({});
    const onCloneRequested = vi.fn();
    const { result } = renderHook(() => useStartCard(BOARD, LOGIN, onCloneRequested));

    await act(async () => {
      await result.current.clone();
    });

    expect(onCloneRequested).toHaveBeenCalledExactlyOnceWith(LOGIN.key);
  });
});
