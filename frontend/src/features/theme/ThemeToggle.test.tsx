import { renderHook, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemeToggle } from "@/features/theme/ThemeToggle";
import { THEME_STORAGE_KEY } from "@/features/theme/theme";
import { useApplyTheme } from "@/features/theme/useApplyTheme";
import { api } from "@/lib/wails";
import { renderWithStore, resetAppStore } from "@/test/render";
import { makeState } from "@/test/wails-mock";

describe("ThemeToggle", () => {
  it("marks the current preference", () => {
    renderWithStore(<ThemeToggle />, { state: makeState({ theme: "light" }) });

    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "false");
  });

  it("stores the preference that is picked", async () => {
    const { user } = renderWithStore(<ThemeToggle />, { state: makeState({ theme: "system" }) });

    await user.click(screen.getByRole("button", { name: "Dark" }));

    expect(api.setTheme).toHaveBeenCalledWith("dark");
  });

  it("keeps the current preference when the active item is unpressed", async () => {
    const { user } = renderWithStore(<ThemeToggle />, { state: makeState({ theme: "dark" }) });

    await user.click(screen.getByRole("button", { name: "Dark" }));

    expect(api.setTheme).not.toHaveBeenCalled();
  });
});

describe("useApplyTheme", () => {
  it("follows the system when the preference is system", () => {
    resetAppStore({ state: makeState({ theme: "system", systemDark: true }) });

    renderHook(() => useApplyTheme());

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("overrides a dark system with the light preference", () => {
    resetAppStore({ state: makeState({ theme: "light", systemDark: true }) });

    renderHook(() => useApplyTheme());

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });
});
