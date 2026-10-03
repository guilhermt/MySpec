import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { THEME_PREFERENCE_KEY, THEME_STORAGE_KEY } from "@/features/theme/theme";
import { useApplyTheme } from "@/features/theme/useApplyTheme";
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
