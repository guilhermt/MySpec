import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sidebar } from "@/features/sidebar/Sidebar";
import { setTheme, THEMES } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import {
  makeRepository,
  makeReviewCenter,
  makeReviewSummary,
  makeSituation,
  makeState,
  makeTask,
} from "@/test/wails-mock";

const MINUTE = 60_000;

// strip draws the collapsed sidebar with a block of every foot: the chip of an error and of a wait,
// the clock of a turn, and the words of a paused and an idle item.
function strip() {
  const started = new Date(Date.now() - 4 * MINUTE).toISOString();
  renderWithStore(<Sidebar />, {
    ui: { sidebarRail: true },
    state: makeState({
      repositories: [makeRepository()],
      reviewCenter: makeReviewCenter({ pendingCount: 4 }),
      reviews: [makeReviewSummary({ id: "review-1", title: "Rate limit" })],
      tasks: [
        makeTask({
          id: "task-1",
          name: "rotate-keys",
          situations: [
            makeSituation({ id: "s-1", taskId: "task-1", kind: "session_error", group: "error" }),
          ],
        }),
        makeTask({
          id: "task-2",
          name: "add-login",
          situations: [makeSituation({ id: "s-2", taskId: "task-2", kind: "question" })],
        }),
        makeTask({
          id: "task-3",
          name: "rate-limit",
          sessionStatus: "working",
          turnRunning: true,
          processRunning: true,
          turnStartedAt: started,
        }),
        makeTask({ id: "task-4", name: "billing", sessionStatus: "paused" }),
        makeTask({ id: "task-5", name: "invoices" }),
      ],
    }),
  });
  return within(screen.getByRole("tree", { name: "Active items" })).getAllByRole("treeitem");
}

// reach is how far down the state glyph paints: its box, turned for a diamond, and the outline around
// it, counted as if turned too.
function reach(glyph: Element): number {
  const outline = Number.parseFloat(getComputedStyle(glyph).outlineWidth);
  return glyph.getBoundingClientRect().bottom + outline * Math.SQRT2;
}

describe.each(THEMES)("SidebarRail in the %s theme", (theme) => {
  it("keeps the state glyph of every block clear of its clock", () => {
    setTheme(theme);
    const blocks = strip();

    expect(blocks).toHaveLength(6);
    for (const block of blocks) {
      const glyph = block.querySelector("[data-state]");
      const foot = block.lastElementChild;
      if (glyph === null || foot === null) throw new Error("a block has its glyph and its foot");
      expect(reach(glyph)).toBeLessThanOrEqual(foot.getBoundingClientRect().top);
    }
  });

  it("sets the foot of every block on whole pixels", () => {
    setTheme(theme);
    const blocks = strip();

    for (const block of blocks) {
      const foot = block.lastElementChild;
      if (foot === null) throw new Error("a block has its foot");
      for (const box of [block, foot, ...foot.children]) {
        const { top, bottom } = box.getBoundingClientRect();
        expect([top, bottom].map((edge) => Number.isInteger(edge))).toEqual([true, true]);
      }
    }
  });

  it("centres the foot of every block and what a separator says on whole pixels", () => {
    setTheme(theme);
    const blocks = strip();
    const separators = [...document.querySelectorAll("[data-rail-separator]")];

    const pieces = [
      ...blocks.flatMap((block) => {
        const foot = block.lastElementChild;
        return foot === null ? [] : [...foot.querySelectorAll("*")];
      }),
      ...separators.flatMap((separator) => [...separator.querySelectorAll("*")]),
    ].filter((piece) => !piece.matches(".sr-only, .sr-only *, [data-state], [data-state] *"));
    expect(pieces.length).toBeGreaterThan(0);
    for (const piece of pieces) {
      expect(Number.isInteger(piece.getBoundingClientRect().left), piece.outerHTML).toBe(true);
    }
  });
});
