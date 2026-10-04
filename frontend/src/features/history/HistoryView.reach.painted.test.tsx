import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { HistoryView } from "@/features/history/HistoryView";
import { fixHistorySceneClock, historyScene } from "@/test/history-scenes";
import { mainArea, setTheme, settle, THEMES } from "@/test/painted";
import { renderWithStore } from "@/test/render";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

/** HALF_MAIN is the main area of a 1250px window with the sidebar open, where the 44 rows overflow. */
const HALF_MAIN = 978;

// draw draws the History of the mock, which scrolls, and answers its scroll and its bar.
async function draw() {
  const scene = historyScene("history", "");
  const { container } = renderWithStore(
    <div style={{ ...mainArea(HALF_MAIN), height: "800px", display: "flex" }}>
      <HistoryView />
    </div>,
    { state: scene.state, ui: { location: scene.location } },
  );
  await settle();
  const bar = container.querySelector<HTMLElement>('[role="search"]');
  let viewport = bar?.parentElement ?? null;
  while (viewport !== null && !/auto|scroll/.test(getComputedStyle(viewport).overflowY)) {
    viewport = viewport.parentElement;
  }
  if (bar === null || viewport === null) {
    throw new Error("the History has no bar or no scroll");
  }
  return { bar, viewport };
}

// whollyBelow tells whether the element in focus stands below the bar, inside the scroll.
function whollyBelow(bar: HTMLElement, viewport: HTMLElement): boolean {
  const focused = document.activeElement;
  if (!(focused instanceof HTMLElement) || !viewport.contains(focused)) {
    return false;
  }
  const box = focused.getBoundingClientRect();
  return (
    box.top >= bar.getBoundingClientRect().bottom &&
    box.bottom <= viewport.getBoundingClientRect().bottom
  );
}

// Chromium scrolls an element that takes the focus to the middle of the scroll, which hides where
// the list scrolls it to; WebKitGTK scrolls it the least it can, to the edge, behind the bar. The
// focus here does not scroll, for the scroll to be the list's own, as WebKitGTK leaves it.
const focus = HTMLElement.prototype.focus;
beforeEach(() => {
  HTMLElement.prototype.focus = function (this: HTMLElement, options?: FocusOptions) {
    focus.call(this, { ...options, preventScroll: true });
  };
});
afterEach(() => {
  HTMLElement.prototype.focus = focus;
});

describe.each(THEMES)("HistoryView, the entry the keys reach, in the %s theme", (theme) => {
  fixHistorySceneClock(historyScene("history", ""));

  it("keeps the first day below the bar when ↓ leaves the search with the list scrolled", async () => {
    setTheme(theme);
    const { bar, viewport } = await draw();
    viewport.scrollTop = viewport.scrollHeight;
    (bar.querySelector("input") as HTMLInputElement).focus();

    await userEvent.keyboard("{ArrowDown}");
    await settle();

    expect(document.activeElement?.getAttribute("data-section-id")).not.toBeNull();
    expect(whollyBelow(bar, viewport)).toBe(true);
  });

  it("keeps the first day below the bar when Home goes back from the end", async () => {
    setTheme(theme);
    const { bar, viewport } = await draw();
    (viewport.querySelector("[data-section-id]") as HTMLElement).focus();

    await userEvent.keyboard("{End}");
    await settle();
    await userEvent.keyboard("{Home}");
    await settle();

    expect(viewport.scrollTop).toBe(0);
    expect(whollyBelow(bar, viewport)).toBe(true);
  });

  it("keeps a row below the bar when ↑ moves to one scrolled behind it", async () => {
    setTheme(theme);
    const { bar, viewport } = await draw();
    const rows = [...viewport.querySelectorAll<HTMLElement>("[data-row-key]")];
    const row = rows[20] as HTMLElement;
    row.focus();
    // The row in focus at the top of the scroll, the one before it hidden behind the bar.
    viewport.scrollTop += row.getBoundingClientRect().top - bar.getBoundingClientRect().bottom;
    await settle();

    await userEvent.keyboard("{ArrowUp}");
    await settle();

    expect(document.activeElement).toBe(rows[19]);
    expect(whollyBelow(bar, viewport)).toBe(true);
  });
});
