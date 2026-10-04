import { within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HistoryView } from "@/features/history/HistoryView";
import {
  fixHistorySceneClock,
  HISTORY_ITEMS,
  HISTORY_VARIANTS,
  historyScene,
} from "@/test/history-scenes";
import {
  capture,
  cutTexts,
  mainArea,
  NARROW_MAIN,
  offWholePixels,
  overlaps,
  placeHeaderOneLine,
  placeHeaderPieces,
  resolve,
  setTheme,
  settle,
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
const WIDTHS = [WIDE_MAIN, HALF_MAIN, NARROW_MAIN];

// TWO_LINES is the width of the list under which a row passes where and result to a second line.
const TWO_LINES = 860;

// RESULT is the whole History of the plain scene: 12 days, 44 rows.
const DAYS = 12;

// draw draws the History in a main area of a width, and does what the scene has the user do.
async function draw(variant: string, width: number) {
  const scene = historyScene("history", variant);
  const { container, user } = renderWithStore(
    <div style={{ ...mainArea(width), height: "800px", display: "flex" }}>
      <HistoryView />
    </div>,
    { state: scene.state, ui: { location: scene.location, back: scene.back } },
  );
  await scene.after?.(user);
  await settle();
  const area = container.firstElementChild;
  if (!(area instanceof HTMLElement)) {
    throw new Error("the main area is not drawn");
  }
  return { area, band: within(area).getByRole("banner", { hidden: true }), user };
}

// rowsOf are the rows of the list, in order.
const rowsOf = (area: HTMLElement) => [...area.querySelectorAll<HTMLElement>("[data-row-key]")];

// columnsOf are the boxes of the columns of a row: the glyph, the name, where, the result and the time.
function columnsOf(row: HTMLElement) {
  const [glyph, name, meta, time] = [...row.children] as HTMLElement[];
  const [where, result] = [...(meta?.children ?? [])] as HTMLElement[];
  if (!glyph || !name || !where || !result || !time) {
    throw new Error(`the row ${row.getAttribute("aria-label")} lacks a column`);
  }
  return {
    glyph: glyph.getBoundingClientRect(),
    name: name.getBoundingClientRect(),
    where: where.getBoundingClientRect(),
    result: result.getBoundingClientRect(),
    time: time.getBoundingClientRect(),
    row: row.getBoundingClientRect(),
  };
}

// the set of the values of a column, to say they are one.
const distinct = (values: number[]) => [...new Set(values)];

// parts are what the screen draws in a box of its own, that must stand on whole pixels.
function parts(area: HTMLElement): Element[] {
  const column = area.querySelector("[data-older-sentinel]")?.parentElement;
  return [
    ...(column === null || column === undefined ? [] : [...column.children]),
    ...area.querySelectorAll('[role="treeitem"], [data-section-id], [role="search"]'),
    ...area.querySelectorAll('[role="status"], [role="alert"]'),
  ];
}

describe.each(THEMES)("HistoryView, the scenes in the %s theme", (theme) => {
  describe.each(HISTORY_VARIANTS.history)("the history scene, variant “%s”", (variant) => {
    fixHistorySceneClock(historyScene("history", variant));

    it.each(WIDTHS)("draws it at the main area of %ipx", async (width) => {
      setTheme(theme);
      const { area, band } = await draw(variant, width);

      // The header keeps one line, and nothing on it covers anything else.
      expect(placeHeaderOneLine(band)).toBe(true);
      expect(overlaps(placeHeaderPieces(band))).toBe(false);
      // ← has a place behind it, as it has in the app.
      expect(
        within(band).getByRole("button", { name: /^Back to /, hidden: true }),
      ).not.toHaveAttribute("aria-disabled", "true");

      // Every row, day, bar and line of the list stands on whole pixels.
      expect(offWholePixels(parts(area))).toEqual([]);

      // The columns of the rows stand where the first row puts them.
      const rows = rowsOf(area);
      const columns = rows.map(columnsOf);
      const two = columns.some(
        (column) => column.row.height > parseFloat(resolve("var(--size-control)", "height")),
      );
      expect(rows.length === 0 || two === width < TWO_LINES).toBe(true);
      expect(distinct(columns.map((column) => column.name.left))).toHaveLength(
        Math.min(rows.length, 1),
      );
      expect(distinct(columns.map((column) => column.time.right))).toHaveLength(
        Math.min(rows.length, 1),
      );
      if (two) {
        // On two lines, where starts under the name and the rows of one line are as tall as each other.
        expect(distinct(columns.map((column) => column.where.left - column.name.left))).toEqual([
          0,
        ]);
        expect(distinct(columns.map((column) => column.row.height))).toHaveLength(1);
      } else {
        expect(distinct(columns.map((column) => column.where.left))).toHaveLength(
          Math.min(rows.length, 1),
        );
        expect(distinct(columns.map((column) => column.result.left))).toHaveLength(
          Math.min(rows.length, 1),
        );
      }

      // The plain list is the 44 items of the mock in 12 days.
      if (variant === "" || variant === "fresh") {
        expect(rows).toHaveLength(HISTORY_ITEMS);
        expect(area.querySelectorAll("[data-section-id]")).toHaveLength(DAYS);
      }
      // The line the older items add under the list is in the area the capture takes.
      if (variant === "older-loading" || variant === "older-failed") {
        const line = area.querySelector("[data-older-sentinel] + p");
        expect(line).toHaveTextContent(
          variant === "older-loading" ? "Loading older items…" : "Couldn't load older items: ",
        );
        const { top, bottom } = area.getBoundingClientRect();
        const box = line?.getBoundingClientRect();
        expect(box !== undefined && box.top >= top && box.bottom <= bottom).toBe(true);
      }
      // The row just archived is the one selected, the first.
      if (variant === "fresh") {
        expect(area.querySelector('[aria-selected="true"]')).toBe(rows[0]);
      }

      // A tooltip the focus left open would cover the list in the capture: the focus leaves first.
      if (document.querySelector('[role="tooltip"]') !== null) {
        (document.activeElement as HTMLElement | null)?.blur();
        await vi.waitFor(() => {
          if (document.querySelector('[role="tooltip"]') !== null) {
            throw new Error("a tooltip is open");
          }
        });
      }
      await capture(
        `history-history${variant === "" ? "" : `-${variant}`}-${width}-${theme}`,
        area,
      );

      // What the list cuts says its whole text in a tooltip.
      expect(await withoutTooltip(cutTexts(area).slice(0, 8))).toEqual([]);

      // The History draws no primary: a list, the empty states and a line that failed have none.
      expect(visiblePrimaries()).toEqual([]);
    });
  });
});
