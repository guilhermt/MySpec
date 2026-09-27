import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsButton } from "@/features/settings/SettingsButton";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";

function button() {
  return screen.getByRole("button", { name: "Settings" });
}

describe("SettingsButton", () => {
  it("opens the settings and stays pressed", async () => {
    const { user } = renderWithStore(<SettingsButton />);

    await user.click(button());

    expect(useAppStore.getState().location).toEqual({ kind: "settings", section: "defaults" });
    expect(button()).toHaveAttribute("aria-pressed", "true");
  });

  it("closes the settings when it is pressed again", async () => {
    const { user } = renderWithStore(<SettingsButton />, {
      ui: { location: { kind: "settings", section: "defaults" } },
    });

    await user.click(button());

    expect(useAppStore.getState().location).toEqual({ kind: "home" });
    expect(button()).toHaveAttribute("aria-pressed", "false");
  });
});
