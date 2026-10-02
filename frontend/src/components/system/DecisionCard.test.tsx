import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DecisionCard, type DecisionCardItem } from "./DecisionCard";

const ITEMS: DecisionCardItem[] = [
  { id: "1", decided: true, disabled: false },
  { id: "2", decided: false, disabled: false },
  { id: "3", decided: false, disabled: false },
];

function draw(
  items: readonly DecisionCardItem[] = ITEMS,
  onDecide: (id: string, key: "approve" | "discard") => "advance" | "stay" | "refused" = () =>
    "advance",
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
          data-card-item={item.id}
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

  it("takes the focus the feed brings by an end when the card asks for it", () => {
    render(
      <DecisionCard
        title="Drafts"
        count={3}
        label="Drafts of round 1"
        items={ITEMS}
        onDecide={() => "advance"}
        ends
        renderItem={(item, current) => (
          // biome-ignore lint/a11y/useSemanticElements: a stand-in for the item a screen draws
          <div
            role="group"
            aria-label={`Item ${item.id}`}
            data-card-item={item.id}
            tabIndex={current ? 0 : -1}
          />
        )}
      />,
    );
    const card = screen.getByRole("group", { name: "Drafts of round 1" });

    card.dataset.enter = "last";
    act(() => card.focus());
    expect(screen.getByRole("group", { name: "Item 3" })).toHaveFocus();

    act(() => screen.getByRole("group", { name: "Item 3" }).blur());
    card.dataset.enter = "first";
    act(() => card.focus());
    expect(screen.getByRole("group", { name: "Item 1" })).toHaveFocus();
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
          <div data-card-item="1">
            <textarea aria-label="Text" />
          </div>
        )}
      />,
    );

    await userEvent.type(screen.getByRole("textbox"), "ad");
    await userEvent.keyboard("{Control>}a{/Control}");

    expect(onDecide).not.toHaveBeenCalled();
  });

  describe("with the options of a screen of drafts", () => {
    afterEach(() => vi.useRealTimers());

    function drawWith(
      props: Partial<React.ComponentProps<typeof DecisionCard>> = {},
      items: readonly DecisionCardItem[] = ITEMS,
    ) {
      const onDecide = vi.fn(() => "advance" as const);
      const view = render(
        <DecisionCard
          title="Drafts"
          count={items.length}
          label="Drafts of round 1"
          items={items}
          onDecide={onDecide}
          renderItem={(item, current, { tabStop, decide }) => (
            // biome-ignore lint/a11y/useSemanticElements: a stand-in for the item a screen draws
            <div
              role="group"
              aria-label={`Item ${item.id}`}
              data-card-item={item.id}
              data-current={current ? "" : undefined}
              tabIndex={tabStop ? 0 : -1}
            >
              <button
                type="button"
                onClick={() => decide("approve")}
              >{`Approve ${item.id}`}</button>
            </div>
          )}
          {...props}
        />,
      );
      return { onDecide, view };
    }

    it("locks A, D and the clicks for lockMs after a decision", () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      const { onDecide } = drawWith({ lockMs: 900 });
      const item = screen.getByRole("group", { name: "Item 2" });
      act(() => item.focus());

      fireEvent.keyDown(item, { key: "a" });
      vi.advanceTimersByTime(899);
      fireEvent.keyDown(item, { key: "a" });
      expect(onDecide).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1);
      fireEvent.keyDown(item, { key: "a" });
      expect(onDecide).toHaveBeenCalledTimes(2);
    });

    it("does not lock after a refused press, so the next one decides", () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      const onDecide = vi
        .fn<(id: string, key: "approve" | "discard") => "advance" | "stay" | "refused">()
        .mockReturnValueOnce("refused")
        .mockReturnValue("advance");
      drawWith({ lockMs: 900, onDecide });
      const item = screen.getByRole("group", { name: "Item 2" });
      act(() => item.focus());

      fireEvent.keyDown(item, { key: "a" });
      fireEvent.keyDown(item, { key: "d" });

      expect(onDecide).toHaveBeenCalledTimes(2);
      expect(onDecide).toHaveBeenLastCalledWith("2", "discard");
    });

    it("sends the clicks of renderItem through the same lock and the same advance", () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      const { onDecide } = drawWith({ lockMs: 900 });

      fireEvent.click(screen.getByRole("button", { name: "Approve 2" }));
      expect(screen.getByRole("group", { name: "Item 3" })).toHaveFocus();

      fireEvent.click(screen.getByRole("button", { name: "Approve 3" }));
      expect(onDecide).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(900);
      fireEvent.click(screen.getByRole("button", { name: "Approve 3" }));
      expect(onDecide).toHaveBeenLastCalledWith("3", "approve");
    });

    it("makes the preferred item current until the user moves to another", () => {
      drawWith({ preferred: "3" });

      expect(screen.getByRole("group", { name: "Item 3" })).toHaveAttribute("data-current");
      expect(screen.getByRole("group", { name: "Item 3" })).toHaveAttribute("tabindex", "0");

      act(() => screen.getByRole("group", { name: "Item 1" }).focus());

      expect(screen.getByRole("group", { name: "Item 1" })).toHaveAttribute("data-current");
      expect(screen.getByRole("group", { name: "Item 3" })).not.toHaveAttribute("data-current");
    });

    it("ignores a preferred item that is not among the items", () => {
      drawWith({ preferred: "9" });

      expect(screen.getByRole("group", { name: "Item 2" })).toHaveAttribute("data-current");
    });

    it("draws a section as a group with its members in order, and keeps the arrows in the order of the items", async () => {
      drawWith(
        { sections: [{ head: "1", members: ["2", "3"], label: "Epic One and its 2 cards" }] },
        [
          { id: "1", decided: false, disabled: false },
          { id: "2", decided: false, disabled: false },
          { id: "3", decided: false, disabled: false },
        ],
      );

      const section = screen.getByRole("group", { name: "Epic One and its 2 cards" });
      expect(
        within(section)
          .getAllByRole("group")
          .map((item) => item.getAttribute("aria-label")),
      ).toEqual(["Item 1", "Item 2", "Item 3"]);
      expect(screen.getAllByRole("group", { name: /^Item/ })).toHaveLength(3);

      act(() => screen.getByRole("group", { name: "Item 1" }).focus());
      await userEvent.keyboard("{ArrowDown}{ArrowDown}");

      expect(screen.getByRole("group", { name: "Item 3" })).toHaveFocus();
    });

    it("leaves the card without a current item when idle is none, the tab stop on the first", () => {
      const decided = ITEMS.map((item) => ({ ...item, decided: true }));
      drawWith({ idle: "none" }, decided);

      for (const item of decided) {
        expect(screen.getByRole("group", { name: `Item ${item.id}` })).not.toHaveAttribute(
          "data-current",
        );
      }
      expect(screen.getByRole("group", { name: "Item 1" })).toHaveAttribute("tabindex", "0");
      expect(screen.getByRole("group", { name: "Item 2" })).toHaveAttribute("tabindex", "-1");
    });

    it("gives the focus back to the current item when the focused one leaves", () => {
      const { view } = drawWith();
      const second = screen.getByRole("group", { name: "Item 2" });
      act(() => second.focus());
      expect(second).toHaveFocus();

      view.rerender(
        <DecisionCard
          title="Drafts"
          count={2}
          label="Drafts of round 1"
          items={[ITEMS[0] as DecisionCardItem, ITEMS[2] as DecisionCardItem]}
          onDecide={() => "advance"}
          renderItem={(item, _current, { tabStop }) => (
            // biome-ignore lint/a11y/useSemanticElements: a stand-in for the item a screen draws
            <div
              role="group"
              aria-label={`Item ${item.id}`}
              data-card-item={item.id}
              tabIndex={tabStop ? 0 : -1}
            />
          )}
        />,
      );

      expect(screen.getByRole("group", { name: "Item 3" })).toHaveFocus();
    });
  });
});
