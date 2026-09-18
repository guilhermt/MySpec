import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePendingReview } from "@/features/reviews/usePendingReview";
import type { Repository } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { resetAppStore } from "@/test/render";
import { makeRepository, makeState } from "@/test/wails-mock";

const PENDING = { repositoryId: "repo-1", number: 31 };

function withRepository(overrides: Partial<Repository>) {
  return makeState({ repositories: [makeRepository(overrides)] });
}

describe("usePendingReview", () => {
  it("waits while the clone runs, then opens the dialog again", () => {
    resetAppStore({
      state: withRepository({ cloned: false, cloning: true, path: "" }),
      ui: { pendingReview: PENDING },
    });
    renderHook(() => usePendingReview());

    expect(useAppStore.getState().startReview).toBeNull();

    act(() => {
      useAppStore.getState().applyState(withRepository({ cloned: true, cloning: false }));
    });

    expect(useAppStore.getState().startReview).toEqual(PENDING);
    expect(useAppStore.getState().pendingReview).toBeNull();
  });

  it("waits for the dialog open for another pull request to close", () => {
    const other = { repositoryId: "repo-2", number: 7 };
    resetAppStore({
      state: withRepository({ cloned: true }),
      ui: { pendingReview: PENDING, startReview: other },
    });
    renderHook(() => usePendingReview());

    expect(useAppStore.getState().startReview).toEqual(other);
    expect(useAppStore.getState().pendingReview).toEqual(PENDING);

    act(() => {
      useAppStore.getState().closeStartReview();
    });

    expect(useAppStore.getState().startReview).toEqual(PENDING);
    expect(useAppStore.getState().pendingReview).toBeNull();
  });

  it("lets the pull request go when its dialog is already open", () => {
    resetAppStore({
      state: withRepository({ cloned: true }),
      ui: { pendingReview: PENDING, startReview: PENDING },
    });
    renderHook(() => usePendingReview());

    expect(useAppStore.getState().pendingReview).toBeNull();

    act(() => {
      useAppStore.getState().closeStartReview();
    });

    expect(useAppStore.getState().startReview).toBeNull();
  });

  it("lets the pull request go without the dialog when the clone fails", () => {
    resetAppStore({
      state: withRepository({ cloned: false, cloning: true, path: "" }),
      ui: { pendingReview: PENDING },
    });
    renderHook(() => usePendingReview());

    act(() => {
      useAppStore
        .getState()
        .applyState(
          withRepository({ cloned: false, cloning: false, path: "", cloneError: "no access" }),
        );
    });

    expect(useAppStore.getState().startReview).toBeNull();
    expect(useAppStore.getState().pendingReview).toBeNull();
  });

  it("does nothing without a pending review", () => {
    resetAppStore({ state: withRepository({}) });
    renderHook(() => usePendingReview());

    expect(useAppStore.getState().startReview).toBeNull();
  });
});
