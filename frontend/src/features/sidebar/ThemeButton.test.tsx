import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemeButton } from "@/features/sidebar/ThemeButton";
import { api, type ThemePreference } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeState } from "@/test/wails-mock";

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
