import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { useViewedSituation } from "@/features/attention/useViewedSituation";
import { api, type Situation } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { resetAppStore } from "@/test/render";
import { makeSituation, makeState, makeTask } from "@/test/wails-mock";

function withSituations(situations: Situation[]) {
  return makeState({ tasks: [makeTask({ situations })] });
}

function focusWindow() {
  act(() => {
    window.dispatchEvent(new Event("focus"));
  });
}

let hasFocus: MockInstance<() => boolean>;

beforeEach(() => {
  hasFocus = vi.spyOn(document, "hasFocus").mockReturnValue(true);
});

afterEach(() => {
  hasFocus.mockRestore();
});

describe("useViewedSituation", () => {
  it("tells the app about the situation whose place opens with the window in front", () => {
    resetAppStore({ state: withSituations([makeSituation({ id: "s1" })]) });
    renderHook(() => useViewedSituation());
    expect(api.viewSituation).not.toHaveBeenCalled();

    act(() => {
      useAppStore.getState().openTask("task-1");
    });

    expect(api.viewSituation).toHaveBeenCalledExactlyOnceWith("s1");
  });

  it("tells it again whenever the window comes back to the front", () => {
    resetAppStore({
      state: withSituations([makeSituation({ id: "s1" })]),
      ui: { location: { kind: "task", id: "task-1" } },
    });
    renderHook(() => useViewedSituation());

    focusWindow();

    expect(api.viewSituation).toHaveBeenCalledTimes(2);
    expect(api.viewSituation).toHaveBeenLastCalledWith("s1");
  });

  it("says nothing while the window is away", () => {
    hasFocus.mockReturnValue(false);
    resetAppStore({
      state: withSituations([makeSituation({ id: "s1" })]),
      ui: { location: { kind: "task", id: "task-1" } },
    });
    renderHook(() => useViewedSituation());

    focusWindow();
    expect(api.viewSituation).not.toHaveBeenCalled();

    hasFocus.mockReturnValue(true);
    focusWindow();
    expect(api.viewSituation).toHaveBeenCalledExactlyOnceWith("s1");
  });

  it("follows the situation on screen, and listens only while there is one", () => {
    resetAppStore({
      state: withSituations([makeSituation({ id: "s1" })]),
      ui: { location: { kind: "task", id: "task-1" } },
    });
    renderHook(() => useViewedSituation());

    act(() => {
      useAppStore.getState().applyState(withSituations([makeSituation({ id: "s2" })]));
    });
    focusWindow();
    expect(vi.mocked(api.viewSituation).mock.calls).toEqual([["s1"], ["s2"], ["s2"]]);

    act(() => {
      useAppStore.getState().applyState(withSituations([]));
    });
    focusWindow();
    expect(api.viewSituation).toHaveBeenCalledTimes(3);
  });

  it("stops listening once it is gone", () => {
    resetAppStore({
      state: withSituations([makeSituation({ id: "s1" })]),
      ui: { location: { kind: "task", id: "task-1" } },
    });
    const { unmount } = renderHook(() => useViewedSituation());

    unmount();
    focusWindow();

    expect(api.viewSituation).toHaveBeenCalledOnce();
  });

  it("keeps a failure to withdraw away from the user", async () => {
    vi.mocked(api.viewSituation).mockRejectedValueOnce(new Error("bus gone"));
    resetAppStore({
      state: withSituations([makeSituation({ id: "s1" })]),
      ui: { location: { kind: "task", id: "task-1" } },
    });

    renderHook(() => useViewedSituation());
    // Let the rejection settle: handled, it neither fails the run nor shows.
    await act(async () => {});

    expect(api.viewSituation).toHaveBeenCalledOnce();
    expect(useAppStore.getState().error).toBeNull();
  });
});
