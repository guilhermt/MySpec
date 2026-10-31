import { act, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeButton } from "@/features/sidebar/ThemeButton";
import { paintMode, THEME_PREFERENCE_KEY } from "@/features/theme/theme";
import { api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeStartup, makeState } from "@/test/wails-mock";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.dataset.theme = "light";
});

describe("ThemeButton", () => {
  it.each([
    ["light", "Theme: Light", "dark"],
    ["dark", "Theme: Dark", "light"],
  ] as const)(
    "says the %s theme on the screen and moves to the opposite one",
    async (mode, name, next) => {
      document.documentElement.dataset.theme = mode;
      const { user } = renderWithStore(<ThemeButton />, { state: makeState({ theme: mode }) });

      await user.click(screen.getByRole("button", { name }));

      expect(api.setTheme).toHaveBeenCalledWith(next);
    },
  );

  it("shows the dark screen of a system theme and moves to light", async () => {
    document.documentElement.dataset.theme = "dark";
    const { user } = renderWithStore(<ThemeButton />, {
      state: makeState({ theme: "system", systemDark: true }),
    });

    await user.click(screen.getByRole("button", { name: "Theme: Dark" }));

    expect(api.setTheme).toHaveBeenCalledWith("light");
  });

  it("shows the light screen of a system theme and moves to dark", async () => {
    const { user } = renderWithStore(<ThemeButton />, {
      state: makeState({ theme: "system", systemDark: false }),
    });

    await user.click(screen.getByRole("button", { name: "Theme: Light" }));

    expect(api.setTheme).toHaveBeenCalledWith("dark");
  });

  it("draws the sun on the light screen", () => {
    renderWithStore(<ThemeButton />, { state: makeState() });

    const button = screen.getByRole("button", { name: "Theme: Light" });
    expect(button.querySelector("svg.lucide-sun")).not.toBeNull();
    expect(button.querySelector("svg.lucide-moon")).toBeNull();
  });

  it("draws the moon on the dark screen", () => {
    document.documentElement.dataset.theme = "dark";
    renderWithStore(<ThemeButton />, { state: makeState() });

    const button = screen.getByRole("button", { name: "Theme: Dark" });
    expect(button.querySelector("svg.lucide-moon")).not.toBeNull();
    expect(button.querySelector("svg.lucide-sun")).toBeNull();
  });

  it.each([
    ["light", "Theme: Light · click to change"],
    ["dark", "Theme: Dark · click to change"],
  ] as const)("tells the %s theme and that a click changes it", async (mode, text) => {
    document.documentElement.dataset.theme = mode;
    const { user } = renderWithStore(<ThemeButton />, { state: makeState() });

    await user.tab();

    expect(await screen.findByRole("tooltip")).toHaveTextContent(text);
  });

  it("follows a paint", () => {
    renderWithStore(<ThemeButton />, { state: makeState() });

    act(() => paintMode("dark"));

    const button = screen.getByRole("button", { name: "Theme: Dark" });
    expect(button.querySelector("svg.lucide-moon")).not.toBeNull();
  });
});

describe("ThemeButton before the first state", () => {
  it("shows the screen, not the stored preference", () => {
    localStorage.setItem(THEME_PREFERENCE_KEY, "light");
    document.documentElement.dataset.theme = "dark";

    renderWithStore(<ThemeButton />, { startup: makeStartup({ systemDark: false }) });

    expect(screen.getByRole("button", { name: "Theme: Dark" })).toBeInTheDocument();
  });

  it("paints the opposite theme at once and sends nothing", async () => {
    const { user } = renderWithStore(<ThemeButton />, {
      startup: makeStartup({ phase: "starting" }),
    });

    await user.click(screen.getByRole("button", { name: "Theme: Light" }));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("button", { name: "Theme: Dark" })).toBeInTheDocument();
    expect(useAppStore.getState().startupTheme).toBe("dark");
    expect(api.setTheme).not.toHaveBeenCalled();
  });

  it("goes back on the second click", async () => {
    const { user } = renderWithStore(<ThemeButton />, {
      startup: makeStartup({ phase: "starting" }),
    });

    await user.click(screen.getByRole("button", { name: "Theme: Light" }));
    await user.click(screen.getByRole("button", { name: "Theme: Dark" }));

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(useAppStore.getState().startupTheme).toBe("light");
  });
});
