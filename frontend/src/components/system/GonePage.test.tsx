import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { GonePage } from "./GonePage";
import { ICONS } from "./icons";

describe("GonePage", () => {
  it("says what became of the item", () => {
    renderWithStore(<GonePage icon={ICONS.trash} title="add-login was deleted" actions={[]} />);

    expect(screen.getByText("add-login was deleted")).toBeInTheDocument();
  });

  it("makes the first action the primary one and gives it the focus", () => {
    renderWithStore(
      <GonePage
        icon={ICONS.archive}
        title="add-login was closed and archived"
        actions={[
          { label: "Next that needs you", onClick: vi.fn() },
          { label: "Open in History", onClick: vi.fn() },
        ]}
      />,
    );

    const primary = screen.getByRole("button", { name: "Next that needs you" });
    expect(primary).toHaveFocus();
    expect(primary.className).toContain("bg-brand");
    expect(screen.getByRole("button", { name: "Open in History" }).className).not.toContain(
      "bg-brand",
    );
  });

  it("says why an action is off and makes the next one the primary", () => {
    renderWithStore(
      <GonePage
        icon={ICONS.archive}
        title="add-login was closed and archived"
        actions={[
          {
            label: "Next that needs you",
            onClick: vi.fn(),
            disabledReason: "Nothing else needs you now.",
          },
          { label: "Open in History", onClick: vi.fn() },
        ]}
      />,
    );

    const off = screen.getByRole("button", { name: "Next that needs you" });
    expect(off).toHaveAttribute("aria-disabled", "true");
    expect(off).toHaveAccessibleDescription("Nothing else needs you now.");
    expect(screen.getByRole("button", { name: "Open in History" })).toHaveFocus();
  });
});
