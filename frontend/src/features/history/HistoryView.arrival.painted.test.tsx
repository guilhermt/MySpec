import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HistoryView } from "@/features/history/HistoryView";
import { mainArea, settle } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { makeArchivedTask, makeHistorySummary, makeState } from "@/test/wails-mock";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

const MAIN_WIDTH = 978;
const MAIN_HEIGHT = 800;
const DEEP = 40;

describe("HistoryView, the row just archived, painted", () => {
  it("centres a row that arrives out of view in the scroll", async () => {
    const tasks = Array.from({ length: 100 }, (_, i) =>
      makeArchivedTask({
        id: `old-${String(i).padStart(3, "0")}`,
        name: `Old task ${i}`,
        archivedAt: new Date(2026, 5, 1 + Math.floor(i / 10), 12, i % 10).toISOString(),
      }),
    );
    renderWithStore(
      <div style={{ ...mainArea(MAIN_WIDTH), height: `${MAIN_HEIGHT}px`, display: "flex" }}>
        <HistoryView />
      </div>,
      {
        state: makeState({
          history: tasks,
          historySummary: makeHistorySummary({ tasks: tasks.length }),
        }),
        ui: { location: { kind: "history", fresh: { kind: "task", id: `old-0${DEEP}` } } },
      },
    );
    await document.fonts.ready;
    await settle();

    const viewport = document.querySelector<HTMLElement>("[data-window-viewport]") as HTMLElement;
    const row = screen.getByRole("treeitem", { name: new RegExp(`^Task Old task ${DEEP}\\b`) });
    await vi.waitFor(() => expect(row).toHaveFocus());
    // The scroll settles where the arrival put it, away from the first rows.
    expect(viewport.scrollTop).toBeGreaterThan(0);
    const frame = viewport.getBoundingClientRect();
    const box = row.getBoundingClientRect();
    const offset = box.top + box.height / 2 - (frame.top + frame.height / 2);
    // Near the middle, not at an edge: the bar sticking over the top may shift it by its height.
    expect(Math.abs(offset)).toBeLessThan(frame.height / 6);
  });
});
