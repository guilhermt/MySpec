import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MenuRow, type MenuRowItem } from "@/components/MenuRow";
import { Button } from "@/components/system/Button";
import { Menu, MenuContent, MenuTrigger } from "@/components/system/Menu";
import { renderWithStore } from "@/test/render";

function open(items: readonly MenuRowItem[], onSelect = vi.fn()) {
  const result = renderWithStore(
    <Menu>
      <MenuTrigger render={<Button />}>More actions</MenuTrigger>
      <MenuContent>
        {items.map((item) => (
          <MenuRow key={item.label} item={item} onSelect={() => onSelect(item.label)} />
        ))}
      </MenuContent>
    </Menu>,
  );
  return { ...result, onSelect };
}

describe("MenuRow", () => {
  it("draws the label with its sub and the › of a popover, and acts on a click", async () => {
    const { user, onSelect } = open([{ label: "Review mode", sub: "Agent", opensPopover: true }]);
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await screen.findByRole("menu");

    const item = screen.getByRole("menuitem", { name: /Review mode/ });
    expect(item).toHaveTextContent("Review mode › Agent");
    await user.click(item);

    expect(onSelect).toHaveBeenCalledExactlyOnceWith("Review mode");
  });

  it("disables an item with its reason", async () => {
    const { user } = open([{ label: "Discard step 4…", disabledReason: "the step is running" }]);
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await screen.findByRole("menu");

    expect(screen.getByRole("menuitem", { name: /Discard step 4…/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByText(/· the step is running/)).toBeInTheDocument();
  });

  it("gives the item its tooltip when it has one", async () => {
    const { user } = open([{ label: "Read the pull request", tooltip: "checked 2m ago" }]);
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await screen.findByRole("menu");
    await user.keyboard("{ArrowDown}");

    expect(await screen.findByRole("tooltip")).toHaveTextContent("checked 2m ago");
  });
});
