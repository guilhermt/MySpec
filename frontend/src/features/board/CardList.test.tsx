import { screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { sections } from "@/features/board/board-view";
import { CardList } from "@/features/board/CardList";
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

function list() {
  const onSelect = vi.fn();
  const onStart = vi.fn();

  function Harness() {
    const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set(["done"]));
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
      />
    );
  }

  return { ...renderWithStore(<Harness />, { state: makeState() }), onSelect, onStart };
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
