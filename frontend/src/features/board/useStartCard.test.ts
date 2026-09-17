import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useStartCard } from "@/features/board/useStartCard";
import { api, type BoardCard } from "@/lib/wails";
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

    act(() => result.current.run(LOGIN));
    await act(async () => {
      await result.current.clone();
    });

    expect(result.current.offer).toBe("clone");
    expect(result.current.error).toBe("gh couldn't clone dev/web.");
    expect(result.current.busy).toBe(false);

    rerender({ card: HEADER });

    expect(result.current.offer).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
