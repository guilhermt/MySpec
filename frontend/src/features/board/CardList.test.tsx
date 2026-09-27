import { screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { sections } from "@/features/board/board-view";
import { CardList } from "@/features/board/CardList";
import type { BoardCard } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeBoard, makeBoardCard, makeState } from "@/test/wails-mock";

const FIRST = makeBoardCard({ key: "dev/web#1", number: 1, title: "First" });
const SECOND = makeBoardCard({ key: "dev/web#2", number: 2, title: "Second", action: "has_task" });
const THIRD = makeBoardCard({
  key: "dev/web#3",
  number: 3,
  title: "Third",
  statusId: "in-progress",
  status: "In progress",
});
const DONE = makeBoardCard({
  key: "dev/web#4",
  number: 4,
  title: "Done one",
  statusId: "done",
  status: "Done",
});
const BOARD = makeBoard({ cards: [FIRST, SECOND, THIRD, DONE] });

function list(checkable: (card: BoardCard) => boolean = () => true) {
  const onSelect = vi.fn();
  const onStart = vi.fn();
  const onDiscuss = vi.fn();

  function Harness() {
    const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set(["done"]));
    const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
    return (
      <CardList
        sections={sections(BOARD, BOARD.cards ?? [])}
        collapsed={collapsed}
        selectedKey={null}
        onToggleSection={(id) => {
          const next = new Set(collapsed);
          if (!next.delete(id)) {
            next.add(id);
          }
          setCollapsed(next);
        }}
        onSelect={onSelect}
        onStart={onStart}
        checked={checked}
        isCheckable={checkable}
        onToggleChecked={(card) => {
          const next = new Set(checked);
          if (!next.delete(card.key)) {
            next.add(card.key);
          }
          setChecked(next);
        }}
        onDiscuss={onDiscuss}
      />
    );
  }

  return {
    ...renderWithStore(<Harness />, { state: makeState() }),
    onSelect,
    onStart,
    onDiscuss,
  };
}

function row(number: number) {
  return screen.getByRole("treeitem", { name: new RegExp(`^#${number}`) });
}

describe("CardList", () => {
  it("makes the first card the tab stop", () => {
    list();

    expect(row(1)).toHaveAttribute("tabindex", "0");
    expect(row(2)).toHaveAttribute("tabindex", "-1");
  });

  it("moves along the visible cards with the arrows, across sections and past collapsed ones", async () => {
    const { user } = list();
    row(1).focus();

    await user.keyboard("{ArrowDown}");
    expect(row(2)).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(row(3)).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(row(3)).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(row(2)).toHaveFocus();
  });

  it("collapses the section with ArrowLeft and expands it with ArrowRight", async () => {
    const { user } = list();
    row(3).focus();

    await user.keyboard("{ArrowLeft}");
    const header = screen.getByRole("button", { name: /^In progress/ });
    expect(header).toHaveFocus();
    expect(screen.queryByRole("treeitem", { name: /^#3/ })).not.toBeInTheDocument();

    await user.keyboard("{ArrowRight}");
    expect(row(3)).toBeInTheDocument();

    await user.keyboard("{ArrowUp}");
    expect(row(2)).toHaveFocus();
  });

  it("leaves Alt with the arrows to the history, neither collapsing nor moving", async () => {
    const { user } = list();
    row(3).focus();

    await user.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    expect(row(3)).toHaveFocus();

    await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
    expect(row(3)).toHaveFocus();
  });

  it("goes from a section header to its first card", async () => {
    const { user } = list();
    screen.getByRole("button", { name: /^In progress/ }).focus();

    await user.keyboard("{ArrowDown}");

    expect(row(3)).toHaveFocus();
  });

  it("opens the focused card on Enter", async () => {
    const { user, onSelect } = list();
    row(2).focus();

    await user.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledWith("dev/web#2");
  });

  it("runs Start task on S only for a card that offers it", async () => {
    const { user, onStart } = list();
    row(2).focus();

    await user.keyboard("s");
    expect(onStart).not.toHaveBeenCalled();

    row(1).focus();
    await user.keyboard("{Control>}s{/Control}");
    expect(onStart).not.toHaveBeenCalled();

    await user.keyboard("S");
    expect(onStart).toHaveBeenCalledExactlyOnceWith(FIRST);
  });

  it("picks the focused card with Space, and leaves an uncheckable one alone", async () => {
    const { user } = list((card) => card.key !== SECOND.key);
    row(1).focus();

    await user.keyboard(" ");
    expect(screen.getByRole("checkbox", { name: "Select #1" })).toBeChecked();

    row(2).focus();
    await user.keyboard(" ");
    expect(screen.getByRole("checkbox", { name: "Select #2" })).not.toBeChecked();
  });

  it("discusses the selected cards on D, and the focused one with no selection", async () => {
    const { user, onDiscuss } = list((card) => card.key !== SECOND.key);
    row(3).focus();

    await user.keyboard("d");
    expect(onDiscuss).toHaveBeenCalledExactlyOnceWith(THIRD);

    // With a selection the view resolves it whole, cards a filter hides included.
    row(1).focus();
    await user.keyboard(" ");
    row(2).focus();
    await user.keyboard("D");
    expect(onDiscuss).toHaveBeenLastCalledWith(null);
  });

  it("leaves D alone on a card of another board with nothing selected", async () => {
    const { user, onDiscuss } = list(() => false);
    row(1).focus();

    await user.keyboard("d");

    expect(onDiscuss).not.toHaveBeenCalled();
  });

  it("shows the count of each section and marks its state", () => {
    list();

    expect(screen.getByRole("button", { name: /^Todo\s*2$/ })).toBeInTheDocument();
    const sectionsItems = screen
      .getAllByRole("treeitem")
      .filter((item) => item.hasAttribute("aria-expanded"));
    expect(sectionsItems.map((item) => item.getAttribute("aria-expanded"))).toEqual([
      "true",
      "true",
      "false",
    ]);
  });
});
