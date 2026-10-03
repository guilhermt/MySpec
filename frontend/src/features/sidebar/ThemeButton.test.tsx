import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeButton } from "@/features/sidebar/ThemeButton";
import { THEME_PREFERENCE_KEY } from "@/features/theme/theme";
import { api, type ThemePreference } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeStartup, makeState } from "@/test/wails-mock";

function themeButton(theme: ThemePreference) {
  return renderWithStore(<ThemeButton />, { state: makeState({ theme }) });
}

describe("ThemeButton", () => {
  it.each([
    ["system", "Theme: System", "light"],
    ["light", "Theme: Light", "dark"],
    ["dark", "Theme: Dark", "system"],
  ] as const)("says %s and moves to the next theme of the cycle", async (theme, name, next) => {
    const { user } = themeButton(theme);

    await user.click(screen.getByRole("button", { name }));

    expect(api.setTheme).toHaveBeenCalledWith(next);
  });

  it("tells the theme and that a click changes it", async () => {
    const { user } = themeButton("system");

    await user.tab();

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Theme: System · click to change");
  });
});

describe("ThemeButton before the first state", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dataset.theme = "light";
  });

  it("starts from the stored preference and the system the start reported", () => {
    localStorage.setItem(THEME_PREFERENCE_KEY, "dark");

    renderWithStore(<ThemeButton />, { startup: makeStartup({ systemDark: true }) });

    expect(screen.getByRole("button", { name: "Theme: Dark" })).toBeInTheDocument();
  });

  it("paints the next theme at once and sends nothing", async () => {
    const { user } = renderWithStore(<ThemeButton />, {
      startup: makeStartup({ phase: "starting", systemDark: true }),
    });

    await user.click(screen.getByRole("button", { name: "Theme: System" }));

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(screen.getByRole("button", { name: "Theme: Light" })).toBeInTheDocument();
    expect(useAppStore.getState().startupTheme).toBe("light");
    expect(api.setTheme).not.toHaveBeenCalled();
  });

  it("paints the system mode when the cycle comes back to system", async () => {
    localStorage.setItem(THEME_PREFERENCE_KEY, "dark");
    const { user } = renderWithStore(<ThemeButton />, {
      startup: makeStartup({ systemDark: true }),
    });

    await user.click(screen.getByRole("button", { name: "Theme: Dark" }));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(useAppStore.getState().startupTheme).toBe("system");
  });
});
