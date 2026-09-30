import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BoardView } from "@/features/board/BoardView";
import {
  BOARD_SCENES,
  type BoardSceneName,
  boardScene,
  fixBoardSceneClock,
} from "@/test/board-scenes";
import {
  capture,
  cutTexts,
  edgesOf,
  mainArea,
  NARROW_MAIN,
  offWholePixels,
  resolve,
  setTheme,
  settle,
  spillsOut,
  THEMES,
  visiblePrimaries,
  withoutTooltip,
} from "@/test/painted";
import { renderWithStore } from "@/test/render";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

/** WIDE_MAIN is the main area of a 2560px window; HALF_MAIN the one of a 1250px window with the sidebar open. */
const WIDE_MAIN = 2180;
const HALF_MAIN = 978;

/** PANEL_MAIN are the main areas the panel is proved at: beside the list down to 800px. */
const PANEL_MAIN = [950, NARROW_MAIN];

/** SCENES are the nine scenes of the view. */
const SCENES = BOARD_SCENES.filter(
  (name) => !["home", "home-disc", "home-none", "create", "create-card"].includes(name),
);

/** WIDTHS are the main areas each scene is drawn at; the card scene is drawn at the narrow ones too. */
const CASES = SCENES.flatMap((name) =>
  [WIDE_MAIN, HALF_MAIN, ...(name === "card" ? PANEL_MAIN : [])].map(
    (width) => [name, width] as const,
  ),
);

fixBoardSceneClock();

// draw draws the view of a scene in a main area of a width, and does what the scene has the user do.
async function draw(name: BoardSceneName, width: number) {
  const { state, location, back, storage, after } = boardScene(name);
  for (const [key, value] of Object.entries(storage)) {
    localStorage.setItem(key, value);
  }
  if (location.kind !== "board") {
    throw new Error("the scene is not a board");
  }
  const { container, user } = renderWithStore(
    <div style={{ ...mainArea(width), height: "800px", display: "flex" }}>
      <BoardView boardId={location.id} />
    </div>,
    { state, ui: { location, back } },
  );
  await after?.(user);
  await settle();
  const area = container.firstElementChild;
  if (!(area instanceof HTMLElement)) {
    throw new Error("the main area is not drawn");
  }
  return { area, user };
}

// rowOf is the row of a card of the view, by its number.
const rowOf = (number: number) =>
  screen.getByRole("treeitem", { name: new RegExp(`^#${number} `) });

// innermost is the deepest element of a row that holds a text, which fails the test when there is none.
function innermost(row: HTMLElement, text: string): HTMLElement {
  const found = [...row.querySelectorAll<HTMLElement>("*")].find(
    (element) =>
      element.textContent?.includes(text) &&
      ![...element.children].some((child) => child.textContent?.includes(text)),
  );
  if (found === undefined) {
    throw new Error(`${row.getAttribute("aria-label")} has no ${text}`);
  }
  return found;
}

/** parts are what a screen draws in a box of its own, that must stand on whole pixels. */
function parts(area: HTMLElement): Element[] {
  return [
    ...area.querySelectorAll("[data-row-key], [data-section-id]"),
    ...area.querySelectorAll('[role="search"], [role="alert"], aside, [role="dialog"]'),
    ...area.querySelectorAll('[role="toolbar"], [data-slot="selection-bar"]'),
  ];
}

describe.each(THEMES)("BoardView, the scenes in the %s theme", (theme) => {
  it.each(CASES)("draws the %s scene at the main area of %ipx", async (name, width) => {
    setTheme(theme);
    const { area } = await draw(name, width);

    // Every box of the screen stands on whole pixels.
    expect(offWholePixels(parts(area))).toEqual([]);

    // A title is never squeezed under a third of its row, and the keys keep their column.
    for (const row of area.querySelectorAll<HTMLElement>("[data-row-key]")) {
      const title = row.children[2];
      const keys = row.lastElementChild;
      if (!(title instanceof HTMLElement) || !(keys instanceof HTMLElement)) {
        throw new Error("a row has no title or keys");
      }
      const label = row.getAttribute("aria-label") ?? "";
      expect(title.getBoundingClientRect().width, `${label} title`).toBeGreaterThanOrEqual(
        row.getBoundingClientRect().width / 3,
      );
      expect(spillsOut(keys), `${label} keys`).toBe(false);
    }

    // What the screen cuts says its whole text in a tooltip.
    expect(await withoutTooltip(cutTexts(area).slice(0, 8))).toEqual([]);

    // The screen has one primary at most.
    expect(visiblePrimaries().length).toBeLessThanOrEqual(1);

    await capture(`board-${name}-${width}-${theme}`, area);
  });

  it("draws the list of the board as the mock counts it: 46 rows with the final sections folded", async () => {
    setTheme(theme);
    const { area } = await draw("board", WIDE_MAIN);

    expect(area.querySelectorAll("[data-row-key]")).toHaveLength(46);
    expect(area.querySelectorAll("[data-section-id]")).toHaveLength(10);
  });

  describe("the card open beside the list", () => {
    it.each(PANEL_MAIN)("keeps every part of the second line whole at %ipx", async (width) => {
      setTheme(theme);
      await draw("card", width);

      for (const [number, texts] of [
        [474, ["Usage-based billing", "#461"]],
        [412, ["API hardening", "Question · Step 3/7"]],
      ] as const) {
        const row = rowOf(number);
        const title = row.children[2];
        if (!(title instanceof HTMLElement)) {
          throw new Error("a row has no title");
        }
        for (const text of texts) {
          const cell = innermost(row, text);
          const line = [...row.children].find((child) => child.contains(cell));
          if (line === undefined) {
            throw new Error(`#${number} has no line with ${text}`);
          }
          // The second line sits under the title, and nothing of it is cut or left out of it.
          const box = cell.getBoundingClientRect();
          const bounds = line.getBoundingClientRect();
          expect(box.top, `#${number} ${text}`).toBeGreaterThanOrEqual(
            title.getBoundingClientRect().bottom,
          );
          expect(
            box.left >= bounds.left && box.right <= bounds.right && box.bottom <= bounds.bottom,
            `#${number} ${text} inside the second line`,
          ).toBe(true);
          expect(cell.scrollWidth, `#${number} ${text} cut`).toBeLessThanOrEqual(cell.clientWidth);
        }
      }
    });

    it("has the panel beside the list at 812px, the list 452px wide, and over it at 790px", async () => {
      setTheme(theme);
      const { area } = await draw("card", NARROW_MAIN);

      const list = area.querySelector<HTMLElement>(".board-list-area");
      expect(list?.getBoundingClientRect().width).toBe(452);
      expect(edgesOf(screen.getByRole("complementary")).left).toBe(edgesOf(list as Element).right);
    });

    it("covers the list with the panel at 790px", async () => {
      setTheme(theme);
      const { area } = await draw("card", 790);

      const list = area.querySelector<HTMLElement>(".board-list-area");
      const panel = screen.getByRole("complementary").getBoundingClientRect();
      const box = (list as Element).getBoundingClientRect();
      expect(box.width).toBe(790);
      expect(panel.left).toBeLessThan(box.right);
    });
  });

  it.each([
    [1041, false],
    [1040, true],
  ])("draws the row of #474 with a second line: at a list of %ipx, %s", async (width, second) => {
    setTheme(theme);
    const { area } = await draw("board", width);

    const list = area.querySelector<HTMLElement>(".board-list-area");
    expect(list?.getBoundingClientRect().width).toBe(width);
    const row = rowOf(474).getBoundingClientRect();
    expect(row.height > parseFloat(resolve("var(--size-control)", "height"))).toBe(second);
  });
});
