import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BOARD_ID, measuredState } from "@/dev/measure-board";
import { BoardView } from "@/features/board/BoardView";
import { EMPTY_FILTERS } from "@/features/board/board-view";
import { boardViewKey } from "@/lib/ui-storage";
import { mainArea, settle } from "@/test/painted";
import { renderWithStore } from "@/test/render";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

/**
 * The board of 2,000 cards in ten statuses, every section open, in the area of a 1450px window with
 * the sidebar closed (1134px wide, 1080px tall): the rows the window mounts, where the keys take the
 * focus and what stays mounted.
 */
const MAIN_WIDTH = 1134;
const MAIN_HEIGHT = 1080;
// OVERSCAN is the rows CardTree mounts past each end of what shows.
const OVERSCAN = 20;
// PINNED are the rows mounted wherever the scroll is: the tab stop and the open card.
const PINNED = 2;
const UPS = 25;

async function draw() {
  localStorage.setItem(
    boardViewKey(BOARD_ID),
    JSON.stringify({ filters: EMPTY_FILTERS, collapsed: [] }),
  );
  const { container, user } = renderWithStore(
    <div style={{ ...mainArea(MAIN_WIDTH), height: `${MAIN_HEIGHT}px`, display: "flex" }}>
      <BoardView boardId={BOARD_ID} />
    </div>,
    { state: measuredState(), ui: { location: { kind: "board", id: BOARD_ID } } },
  );
  await settle();
  const list = screen.getByRole("tree");
  const bar = screen.getByRole("search");
  const scroll = container.querySelector<HTMLElement>("[data-window-viewport]");
  if (scroll === null) {
    throw new Error("the list is not windowed");
  }
  return { container, user, list, bar, scroll };
}

const items = (list: HTMLElement) => within(list).getAllByRole("treeitem");

// belowBar is how far under the bottom of the bar and of its fade the top of a row is.
function belowBar(row: Element, bar: HTMLElement): number {
  const fade = Number.parseFloat(getComputedStyle(bar, "::after").height);
  return row.getBoundingClientRect().top - (bar.getBoundingClientRect().bottom + fade);
}

describe("the board window", () => {
  it("mounts the rows that show, the overscan and the pinned ones", async () => {
    const { list, scroll } = await draw();
    const frame = scroll.getBoundingClientRect();
    const shown = items(list).filter((row) => {
      const rect = row.getBoundingClientRect();
      return rect.bottom > frame.top && rect.top < frame.bottom;
    });
    expect(shown.length).toBeGreaterThan(20);
    expect(items(list).length).toBeLessThanOrEqual(shown.length + 2 * OVERSCAN + PINNED);
  });

  it("takes End to the last row, mounted and below the bar", async () => {
    const { list, bar, user } = await draw();
    items(list)[1]?.focus();
    await user.keyboard("{End}");
    await vi.waitFor(() => {
      const last = document.activeElement;
      expect(last).toHaveAttribute("role", "treeitem");
      expect(last?.getAttribute("aria-posinset")).toBe(last?.getAttribute("aria-setsize"));
      expect(list).toContainElement(last as HTMLElement);
    });
    expect(belowBar(document.activeElement as Element, bar)).toBeGreaterThanOrEqual(0);
  });

  it("keeps the focused row below the bar going up from the end, and takes Home to the first row", async () => {
    const { list, bar, user } = await draw();
    items(list)[1]?.focus();
    await user.keyboard("{End}");
    // The ups start from the last row, once End has scrolled there and focused it.
    await vi.waitFor(() => {
      const last = document.activeElement;
      expect(last?.getAttribute("aria-posinset")).toBe(last?.getAttribute("aria-setsize"));
      expect(list).toContainElement(last as HTMLElement);
    });
    for (let up = 0; up < UPS; up++) {
      await user.keyboard("{ArrowUp}");
      await vi.waitFor(() => expect(list).toContainElement(document.activeElement as HTMLElement));
      expect(belowBar(document.activeElement as Element, bar)).toBeGreaterThanOrEqual(0);
    }
    await user.keyboard("{Home}");
    await vi.waitFor(() => expect(document.activeElement).toBe(items(list)[0]));
    // At the top of the scroll the first header sits under the fade of the bar, as the list rests.
    expect(document.activeElement?.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      bar.getBoundingClientRect().bottom,
    );
  });

  it("keeps the open card mounted after the list scrolls to its end", async () => {
    const { list, user } = await draw();
    const card = items(list).find((row) => row.getAttribute("aria-level") === "2");
    const name = card?.getAttribute("aria-label") ?? "";
    await user.click(card as Element);
    expect(screen.getByRole("treeitem", { name })).toHaveAttribute("aria-selected", "true");
    items(list)[0]?.focus();
    await user.keyboard("{End}");
    await vi.waitFor(() => expect(list).toContainElement(document.activeElement as HTMLElement));
    expect(screen.getByRole("treeitem", { name })).toHaveAttribute("aria-selected", "true");
  });

  it("says level, size and position on every row", async () => {
    const { list } = await draw();
    for (const row of items(list)) {
      expect(row).toHaveAttribute("aria-level");
      expect(row).toHaveAttribute("aria-setsize");
      expect(row).toHaveAttribute("aria-posinset");
    }
    const header = items(list).find((row) => row.getAttribute("aria-level") === "1");
    expect(header).toHaveAttribute("aria-setsize", "10");
    expect(header).toHaveAttribute("aria-posinset", "1");
  });
});
