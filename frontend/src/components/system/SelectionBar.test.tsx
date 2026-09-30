import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { SelectionBar, type SelectionBarProps } from "./SelectionBar";

function bar(props: Partial<SelectionBarProps> = {}) {
  const onDiscuss = vi.fn();
  const onCancel = vi.fn();
  const rendered = renderWithStore(
    <SelectionBar
      count={2}
      numbers="#474 #412"
      filtered={false}
      filteredTooltip={[]}
      onDiscuss={onDiscuss}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { ...rendered, onDiscuss, onCancel };
}

describe("SelectionBar", () => {
  it("is a toolbar of the selected cards with a status count", () => {
    bar();
    const toolbar = screen.getByRole("toolbar", { name: "Selected cards" });
    expect(toolbar).toHaveTextContent("#474 #412");
    expect(screen.getByRole("status")).toHaveTextContent("2 selected");
  });

  it.each([
    [1, "Discuss 1 card"],
    [3, "Discuss 3 cards"],
  ])("offers Discuss for %i selected", async (count, name) => {
    const { user, onDiscuss } = bar({ count });
    await user.click(screen.getByRole("button", { name }));
    expect(onDiscuss).toHaveBeenCalledOnce();
  });

  it("dashes Discuss with the reason when nothing is selected", async () => {
    const { user, onDiscuss } = bar({ count: 0, numbers: "" });
    const button = screen.getByRole("button", { name: "Discuss cards" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Select a card with Space")).toBeInTheDocument();
    await user.click(button);
    expect(onDiscuss).not.toHaveBeenCalled();
  });

  it("cancels", async () => {
    const { user, onCancel } = bar();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("says filtered only when the list is", () => {
    const { unmount } = bar();
    expect(screen.queryByText("· filtered")).not.toBeInTheDocument();
    unmount();
    bar({ filtered: true, filteredTooltip: ["in acme/api"] });
    expect(screen.getByText("· filtered")).toBeInTheDocument();
  });
});
