import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HistoryView } from "@/features/history/HistoryView";
import type { ArchivedTask } from "@/lib/wails";
import { layoutInCommits, mainArea, NARROW_MAIN, settle } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { makeArchivedTask, makeHistorySummary, makeRepository, makeState } from "@/test/wails-mock";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

/**
 * The History of 400 archived tasks over 90 days, in the area of a 1450px window with the sidebar
 * closed (1134px wide) and of a 1100px one (812px, where a row is estimated on two lines), 1080px
 * tall: where End and the bar dragged to the bottom leave the scroll and the focus, and what stays
 * mounted.
 */
const ITEMS = 400;
const MAIN_WIDTH = 1134;
const MAIN_HEIGHT = 1080;
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 24, 12);

function state() {
  const tasks: ArchivedTask[] = [];
  for (let i = 0; i < ITEMS; i++) {
    const archivedAt = new Date(NOW - Math.floor((i * 90 * DAY_MS) / ITEMS)).toISOString();
    tasks.push(
      makeArchivedTask({
        id: `item-${i}`,
        name: `Task number ${i}`,
        archivedAt,
        createdAt: archivedAt,
      }),
    );
  }
  return makeState({
    repositories: [makeRepository()],
    history: tasks,
    historySummary: makeHistorySummary({ tasks: ITEMS, oldest: tasks.at(-1)?.archivedAt ?? "" }),
  });
}

async function draw(width = MAIN_WIDTH) {
  const { container, user } = renderWithStore(
    <div style={{ ...mainArea(width), height: `${MAIN_HEIGHT}px`, display: "flex" }}>
      <HistoryView />
    </div>,
    { state: state(), ui: { location: { kind: "history" } } },
  );
  await settle();
  const list = screen.getByRole("tree");
  const bar = screen.getByRole("search");
  const scroll = container.querySelector<HTMLElement>("[data-window-viewport]");
  if (scroll === null) {
    throw new Error("the list is not windowed");
  }
  return { user, list, bar, scroll };
}

const items = (list: HTMLElement) => within(list).getAllByRole("treeitem");

// isLast tells the last row of the History: no row and no spacer follows it.
const isLast = (row: Element | null | undefined) =>
  row?.getAttribute("role") === "treeitem" && row.nextElementSibling === null;

// expectWhole expects a row whole in the area that scrolls: below the bar and its fade, and above
// the bottom of the area.
function expectWhole(row: Element, bar: HTMLElement, scroll: HTMLElement) {
  const fade = Number.parseFloat(getComputedStyle(bar, "::after").height);
  const box = row.getBoundingClientRect();
  expect(box.top).toBeGreaterThanOrEqual(bar.getBoundingClientRect().bottom + fade);
  expect(box.bottom).toBeLessThanOrEqual(scroll.getBoundingClientRect().bottom);
}

// endFocusesTheLast presses End on the first day and expects the focus on the last row, whole in
// the area that scrolls once the scroll has settled.
async function endFocusesTheLast({ list, bar, scroll, user }: Awaited<ReturnType<typeof draw>>) {
  items(list)[0]?.focus();
  await user.keyboard("{End}");
  await vi.waitFor(() => expect(isLast(document.activeElement)).toBe(true));
  await vi.waitFor(() => expectWhole(document.activeElement as Element, bar, scroll));
  // It stays there: nothing that comes after the commits moves the scroll away.
  await new Promise((done) => setTimeout(done, 300));
  expectWhole(document.activeElement as Element, bar, scroll);
}

describe.each([
  ["1134px", MAIN_WIDTH],
  ["812px", NARROW_MAIN],
])("the History window at %s", (_name, width) => {
  it("takes End to the last row, whole in the area that scrolls", async () => {
    await endFocusesTheLast(await draw(width));
  });

  it("keeps the scroll where End took it when the list is laid out in the middle of the commit, as in WebKitGTK", async () => {
    const drawn = await draw(width);
    layoutInCommits(drawn.list, drawn.scroll);
    await endFocusesTheLast(drawn);
  });

  it("stays at the bottom with rows in view when the bar is dragged there, laid out in the middle of the commit as in WebKitGTK", async () => {
    const { list, scroll } = await draw(width);
    layoutInCommits(list, scroll);

    scroll.scrollTo({ top: scroll.scrollHeight });

    await vi.waitFor(() => expect(isLast(items(list).at(-1))).toBe(true));
    await new Promise((done) => setTimeout(done, 300));
    expect(scroll.scrollTop).toBe(scroll.scrollHeight - scroll.clientHeight);
    const frame = scroll.getBoundingClientRect();
    const shown = items(list).filter((row) => {
      const box = row.getBoundingClientRect();
      return box.bottom > frame.top && box.top < frame.bottom;
    });
    expect(shown.length).toBeGreaterThan(10);
  });
});

describe("the History window", () => {
  it("keeps the tab stop mounted after the list scrolls far from it", async () => {
    const { list, scroll } = await draw();
    const stop = items(list).find((row) => row.getAttribute("aria-level") === "2") as HTMLElement;
    stop.focus();
    await vi.waitFor(() => expect(stop).toHaveAttribute("tabindex", "0"));

    scroll.scrollTo({ top: scroll.scrollHeight });
    await vi.waitFor(() => expect(isLast(items(list).at(-1))).toBe(true));

    expect(stop).toBeInTheDocument();
    expect(stop).toHaveAttribute("tabindex", "0");
    expect(list.querySelectorAll('[role="treeitem"][tabindex="0"]')).toHaveLength(1);
  });
});
