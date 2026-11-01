import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { THEME_PREFERENCE_KEY, THEME_STORAGE_KEY } from "@/features/theme/theme";
import { useApplyTheme, usePaintedMode } from "@/features/theme/useApplyTheme";
import { useAppStore } from "@/store/app-store";
import { resetAppStore } from "@/test/render";
import { makeState } from "@/test/wails-mock";

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.documentElement.dataset.theme = "dark";
});

describe("useApplyTheme", () => {
  it("paints and stores nothing before the first state", () => {
    resetAppStore();

    renderHook(() => useApplyTheme());

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(THEME_PREFERENCE_KEY)).toBeNull();
  });

  it("paints the mode of the state and stores the mode and the preference", () => {
    resetAppStore({ state: makeState({ theme: "light" }) });

    renderHook(() => useApplyTheme());

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(localStorage.getItem(THEME_PREFERENCE_KEY)).toBe("light");
  });

  it("follows the system when the preference is system", () => {
    resetAppStore({ state: makeState({ theme: "system", systemDark: true }) });

    renderHook(() => useApplyTheme());

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_PREFERENCE_KEY)).toBe("system");
  });
});

describe("usePaintedMode", () => {
  const paintedAfterApplyingTheme = () =>
    renderHook(() => {
      useApplyTheme();
      return usePaintedMode();
    });

  it("reflects the data-theme that was on the screen before the first state", () => {
    resetAppStore();

    const { result } = paintedAfterApplyingTheme();

    expect(result.current).toBe("dark");
  });

  it("follows the system when there is no saved choice", () => {
    resetAppStore({ state: makeState({ theme: "system", systemDark: false }) });
    const { result } = paintedAfterApplyingTheme();
    expect(result.current).toBe("light");

    act(() => {
      useAppStore.getState().applyState(makeState({ theme: "system", systemDark: true }));
    });

    expect(result.current).toBe("dark");
  });

  it("keeps the saved choice when the system changes", () => {
    resetAppStore({ state: makeState({ theme: "light", systemDark: false }) });
    const { result } = paintedAfterApplyingTheme();
    expect(result.current).toBe("light");

    act(() => {
      useAppStore.getState().applyState(makeState({ theme: "light", systemDark: true }));
    });

    expect(result.current).toBe("light");
  });
});
