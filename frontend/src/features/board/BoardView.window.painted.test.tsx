import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BOARD_ID, measuredState } from "@/dev/measure-board";
import { BoardView } from "@/features/board/BoardView";
import { EMPTY_FILTERS } from "@/features/board/board-view";
import { boardViewKey } from "@/lib/ui-storage";
import { layoutInCommits, mainArea, NARROW_MAIN, settle } from "@/test/painted";
import { renderWithStore } from "@/test/render";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

/**
 * The board of 2,000 cards in ten statuses, every section open, in the area of a 1450px window with
 * the sidebar closed (1134px wide, 1080px tall): the rows the window mounts, where the keys take the
 * focus and what stays mounted. In the area of a 1100px window with the panel open (812px, the list
 * column narrower than 1042px), a row is estimated on two lines and measures one or two.
 */
const MAIN_WIDTH = 1134;
const MAIN_HEIGHT = 1080;
// SECTIONS are the statuses of the measured board, each a header.
const SECTIONS = 10;
// OVERSCAN is the rows CardTree mounts past each end of what shows.
const OVERSCAN = 20;
// PINNED are the rows mounted wherever the scroll is: the tab stop and the open card.
const PINNED = 2;
const UPS = 25;

async function draw(width = MAIN_WIDTH) {
  localStorage.setItem(
    boardViewKey(BOARD_ID),
    JSON.stringify({ filters: EMPTY_FILTERS, collapsed: [] }),
  );
  const { container, user } = renderWithStore(
    <div style={{ ...mainArea(width), height: `${MAIN_HEIGHT}px`, display: "flex" }}>
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

// expectWhole expects a row whole in the area that scrolls: below the bar and its fade, and above
// the bottom of the area.
function expectWhole(row: Element, bar: HTMLElement, scroll: HTMLElement) {
  expect(belowBar(row, bar)).toBeGreaterThanOrEqual(0);
  expect(row.getBoundingClientRect().bottom).toBeLessThanOrEqual(
    scroll.getBoundingClientRect().bottom,
  );
}

// endFocusesTheLast presses End on the second row and expects the focus on the last row of the
// list, whole in the area that scrolls once the scroll has settled.
async function endFocusesTheLast({ list, bar, scroll, user }: Awaited<ReturnType<typeof draw>>) {
  items(list)[1]?.focus();
  await user.keyboard("{End}");
  await vi.waitFor(() => {
    const last = document.activeElement;
    expect(last).toHaveAttribute("role", "treeitem");
    expect(last?.getAttribute("aria-posinset")).toBe(last?.getAttribute("aria-setsize"));
    expect(list).toContainElement(last as HTMLElement);
    // The last row of the list, not just the last of its section: no row and no spacer follows it.
    expect(last?.nextElementSibling).toBeNull();
    expect(last).toBe(items(list).at(-1));
  });
  await vi.waitFor(() => expectWhole(document.activeElement as Element, bar, scroll));
  // It stays there: nothing that comes after the commits moves the scroll away.
  await new Promise((done) => setTimeout(done, 300));
  expectWhole(document.activeElement as Element, bar, scroll);
}

// openPanel opens the first card in the panel, by a click on its row.
async function openPanel({ list, user }: Awaited<ReturnType<typeof draw>>) {
  const card = items(list).find((row) => row.getAttribute("aria-level") === "2");
  await user.click(card as Element);
  await screen.findByRole("complementary");
  await settle();
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

  it("takes End to the last row, mounted and whole in the area that scrolls", async () => {
    await endFocusesTheLast(await draw());
  });

  it("keeps the scroll where End took it when the list is laid out in the middle of the commit, as in WebKitGTK", async () => {
    const drawn = await draw();
    layoutInCommits(drawn.list, drawn.scroll);
    await endFocusesTheLast(drawn);
  });

  it("stays at the bottom with rows in view when the bar is dragged there, laid out in the middle of the commit as in WebKitGTK", async () => {
    const { list, scroll } = await draw();
    layoutInCommits(list, scroll);

    scroll.scrollTo({ top: scroll.scrollHeight });

    await vi.waitFor(() =>
      expect(items(list).at(-1)?.getAttribute("aria-posinset")).toBe(
        items(list).at(-1)?.getAttribute("aria-setsize"),
      ),
    );
    await new Promise((done) => setTimeout(done, 300));
    expect(scroll.scrollTop).toBe(scroll.scrollHeight - scroll.clientHeight);
    const frame = scroll.getBoundingClientRect();
    const shown = items(list).filter((row) => {
      const box = row.getBoundingClientRect();
      return box.bottom > frame.top && box.top < frame.bottom;
    });
    expect(shown.length).toBeGreaterThan(20);
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

  it("keeps the tab stop mounted after the list scrolls far from it", async () => {
    const { list, scroll } = await draw();
    const stop = items(list)[3] as HTMLElement;
    stop.focus();
    await vi.waitFor(() => expect(stop).toHaveAttribute("tabindex", "0"));

    scroll.scrollTo({ top: scroll.scrollHeight });
    await vi.waitFor(() =>
      expect(items(list).at(-1)?.getAttribute("aria-posinset")).toBe(
        items(list).at(-1)?.getAttribute("aria-setsize"),
      ),
    );

    expect(stop).toBeInTheDocument();
    expect(stop).toHaveAttribute("tabindex", "0");
    expect(list.querySelectorAll('[role="treeitem"][tabindex="0"]')).toHaveLength(1);
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
    expect(header).toHaveAttribute("aria-setsize", String(SECTIONS));
    expect(header).toHaveAttribute("aria-posinset", "1");
  });

  it("numbers a header among the headers, wherever the window is", async () => {
    const drawn = await draw();
    await endFocusesTheLast(drawn);
    const headers = items(drawn.list).filter((row) => row.getAttribute("aria-level") === "1");
    // The window at the end holds the header of the last status, the tenth.
    expect(headers.at(-1)).toHaveAttribute("aria-posinset", String(SECTIONS));
    expect(headers.at(-1)).toHaveAttribute("aria-setsize", String(SECTIONS));
  });
});

describe("the board window at 812px, with the panel open", () => {
  it("takes End to the last row, whole in the area that scrolls", async () => {
    const drawn = await draw(NARROW_MAIN);
    await openPanel(drawn);
    await endFocusesTheLast(drawn);
  });

  it("keeps the scroll where End took it when the list is laid out in the middle of the commit, as in WebKitGTK", async () => {
    const drawn = await draw(NARROW_MAIN);
    await openPanel(drawn);
    layoutInCommits(drawn.list, drawn.scroll);
    await endFocusesTheLast(drawn);
  });
});
