import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { ItemBlock, type ItemBlockProps } from "./ItemBlock";

function block(props: Partial<ItemBlockProps> = {}) {
  const onOpen = vi.fn();
  const rendered = renderWithStore(
    <ItemBlock
      kind="task"
      name="Add the audit log"
      line2={{ tone: "wait", text: "Question · Reviewer · Step 3/7" }}
      clock={{ kind: "chip", tone: "wait", time: "18m", longTime: "18 minutes" }}
      openLabel="Open the task"
      onOpen={onOpen}
      {...props}
    />,
  );
  return { ...rendered, onOpen };
}

describe("ItemBlock", () => {
  it("says the name, what the item is doing and its clock", () => {
    block();
    expect(screen.getByText("Add the audit log")).toBeInTheDocument();
    expect(screen.getByText("Question · Reviewer · Step 3/7")).toBeInTheDocument();
    expect(screen.getByText("waiting for you, 18 minutes", { exact: false })).toBeInTheDocument();
  });

  it("has no chip when the clock is not a chip", () => {
    block({ clock: { kind: "word", word: "idle" } });
    expect(screen.queryByText("idle")).not.toBeInTheDocument();
  });

  it("opens the item with a button named by the caller", async () => {
    const { user, onOpen } = block();
    await user.click(screen.getByRole("button", { name: "Open the task" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("says Open by default and the caller's text when given, with its key in the tooltip", async () => {
    const { user } = block({ openText: "Open review", shortcut: "R", openLabel: "Open review" });
    const button = screen.getByRole("button", { name: "Open review" });
    expect(button).toHaveTextContent("Open review");
    await user.hover(button);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("R");
  });

  it("is secondary by default and primary when the item waits", () => {
    block({ primary: true });
    expect(screen.getByRole("button", { name: "Open the task" })).toHaveAttribute(
      "data-variant",
      "primary",
    );
  });
});
