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
    expect(primary).toHaveClass("bg-brand");
    expect(screen.getByRole("button", { name: "Open in History" })).not.toHaveClass("bg-brand");
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

  it("says the description after the title and draws the block before the actions", () => {
    renderWithStore(
      <GonePage
        icon={ICONS.archive}
        title="acme/web#2291 was merged"
        description="jdoe merged it into main at 13:41."
        actions={[{ label: "Open in History", onClick: vi.fn() }]}
      >
        <ul aria-label="Passes">
          <li>Pass 1 · Request changes</li>
        </ul>
      </GonePage>,
    );

    const title = screen.getByText("acme/web#2291 was merged");
    const description = screen.getByText("jdoe merged it into main at 13:41.");
    const block = screen.getByRole("list", { name: "Passes" });
    const action = screen.getByRole("button", { name: "Open in History" });
    expect(title.compareDocumentPosition(description)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(description.compareDocumentPosition(block)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(block.compareDocumentPosition(action)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("draws only the title and the actions without a description or a block", () => {
    const { container } = renderWithStore(
      <GonePage icon={ICONS.trash} title="add-login was deleted" actions={[]} />,
    );

    expect(container.querySelectorAll("p")).toHaveLength(1);
  });
});
