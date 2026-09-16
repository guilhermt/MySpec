import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePendingStart } from "@/features/board/usePendingStart";
import type { Repository } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { resetAppStore } from "@/test/render";
import { makeRepository, makeState } from "@/test/wails-mock";

const PENDING = { boardId: "board-1", key: "dev/web#12", repositoryId: "repo-1" };

function withRepository(overrides: Partial<Repository>) {
  return makeState({ repositories: [makeRepository(overrides)] });
}

describe("usePendingStart", () => {
  it("waits while the clone runs, then opens the dialog for the card", () => {
    resetAppStore({
      state: withRepository({ cloned: false, cloning: true, path: "" }),
      ui: { pendingStart: PENDING },
    });
    renderHook(() => usePendingStart());

    expect(useAppStore.getState().newTaskOpen).toBe(false);
    expect(useAppStore.getState().pendingStart).toEqual(PENDING);

    act(() => {
      useAppStore.getState().applyState(withRepository({ cloned: true, cloning: false }));
    });

    expect(useAppStore.getState().newTaskOpen).toBe(true);
    expect(useAppStore.getState().newTaskCard).toEqual({ boardId: "board-1", key: "dev/web#12" });
    expect(useAppStore.getState().pendingStart).toBeNull();
  });

  it("lets the card go without the dialog when the clone fails", () => {
    resetAppStore({
      state: withRepository({ cloned: false, cloning: true, path: "" }),
      ui: { pendingStart: PENDING },
    });
    renderHook(() => usePendingStart());

    act(() => {
      useAppStore
        .getState()
        .applyState(
          withRepository({ cloned: false, cloning: false, path: "", cloneError: "no access" }),
        );
    });

    expect(useAppStore.getState().newTaskOpen).toBe(false);
    expect(useAppStore.getState().pendingStart).toBeNull();
  });

  it("does nothing without a pending start", () => {
    resetAppStore({ state: withRepository({}) });
    renderHook(() => usePendingStart());

    expect(useAppStore.getState().newTaskOpen).toBe(false);
  });
});
