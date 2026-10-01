import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DecisionCard, type DecisionCardItem } from "./DecisionCard";

const ITEMS: DecisionCardItem[] = [
  { id: "1", decided: true, disabled: false },
  { id: "2", decided: false, disabled: false },
  { id: "3", decided: false, disabled: false },
];

function draw(
  items: readonly DecisionCardItem[] = ITEMS,
  onDecide: (id: string, key: "approve" | "discard") => "advance" | "stay" = () => "advance",
  onLeave?: (by: -1 | 1) => void,
) {
  render(
    <DecisionCard
      title="Findings"
      count={items.length}
      label="Findings of pass 1"
      items={items}
      onDecide={onDecide}
      {...(onLeave !== undefined ? { onLeave } : {})}
      renderItem={(item, current) => (
        // biome-ignore lint/a11y/useSemanticElements: a stand-in for the item a screen draws
        <div
          role="group"
          aria-label={`Item ${item.id}`}
          data-finding-id={item.id}
          tabIndex={current ? 0 : -1}
        >
          <button type="button">{`Button ${item.id}`}</button>
        </div>
      )}
    />,
  );
}

describe("DecisionCard", () => {
  it("names the group and its header", () => {
    draw();

    const card = screen.getByRole("group", { name: "Findings of pass 1" });
    expect(card).toHaveAttribute("data-decision-card");
    expect(card).toHaveAttribute("data-feed-keys", "own");
    expect(screen.getByRole("heading", { name: /^Findings/ })).toBeInTheDocument();
  });

  it("puts the one tab stop on the first item still undecided", () => {
    draw();

    expect(screen.getByRole("group", { name: "Item 1" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("group", { name: "Item 2" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("group", { name: "Item 3" })).toHaveAttribute("tabindex", "-1");
  });

  it("falls back to the first item when all are decided or disabled", () => {
    draw(ITEMS.map((item) => ({ ...item, decided: true })));

    expect(screen.getByRole("group", { name: "Item 1" })).toHaveAttribute("tabindex", "0");
  });

  it("moves the tab stop to the item the focus last sat on", async () => {
    draw();

    act(() => screen.getByRole("group", { name: "Item 3" }).focus());

    expect(screen.getByRole("group", { name: "Item 3" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("group", { name: "Item 2" })).toHaveAttribute("tabindex", "-1");
  });

  it("decides with A and D and moves on to the next one undecided", async () => {
    const onDecide = vi.fn(() => "advance" as const);
    draw(ITEMS, onDecide);
    screen.getByRole("group", { name: "Item 2" }).focus();

    await userEvent.keyboard("a");

    expect(onDecide).toHaveBeenCalledWith("2", "approve");
    expect(screen.getByRole("group", { name: "Item 3" })).toHaveFocus();

    await userEvent.keyboard("d");

    expect(onDecide).toHaveBeenLastCalledWith("3", "discard");
  });

  it("wraps around to an item undecided before the one decided", async () => {
    draw([
      { id: "1", decided: false, disabled: false },
      { id: "2", decided: true, disabled: false },
      { id: "3", decided: false, disabled: false },
    ]);
    screen.getByRole("group", { name: "Item 3" }).focus();

    await userEvent.keyboard("a");

    expect(screen.getByRole("group", { name: "Item 1" })).toHaveFocus();
  });

  it("keeps the focus when the press undid or nothing is left undecided", async () => {
    draw(ITEMS, () => "stay");
    screen.getByRole("group", { name: "Item 2" }).focus();

    await userEvent.keyboard("a");

    expect(screen.getByRole("group", { name: "Item 2" })).toHaveFocus();
  });

  it("does not decide a disabled item", async () => {
    const onDecide = vi.fn(() => "advance" as const);
    draw([{ id: "1", decided: true, disabled: true }], onDecide);
    screen.getByRole("group", { name: "Item 1" }).focus();

    await userEvent.keyboard("ad");

    expect(onDecide).not.toHaveBeenCalled();
  });

  it("walks the items with the arrows and hands them over at the ends", async () => {
    const onLeave = vi.fn();
    draw(ITEMS, () => "advance", onLeave);
    screen.getByRole("group", { name: "Item 1" }).focus();

    await userEvent.keyboard("{ArrowUp}");
    expect(onLeave).toHaveBeenLastCalledWith(-1);

    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("group", { name: "Item 3" })).toHaveFocus();

    await userEvent.keyboard("{ArrowDown}");
    expect(onLeave).toHaveBeenLastCalledWith(1);
  });

  it("leaves the keys to a field and to a modifier", async () => {
    const onDecide = vi.fn(() => "advance" as const);
    render(
      <DecisionCard
        title="Findings"
        count={1}
        label="Findings of pass 1"
        items={[{ id: "1", decided: false, disabled: false }]}
        onDecide={onDecide}
        renderItem={() => (
          <div data-finding-id="1">
            <textarea aria-label="Text" />
          </div>
        )}
      />,
    );

    await userEvent.type(screen.getByRole("textbox"), "ad");
    await userEvent.keyboard("{Control>}a{/Control}");

    expect(onDecide).not.toHaveBeenCalled();
  });
});
