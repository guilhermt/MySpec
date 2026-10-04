import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryView } from "@/features/history/HistoryView";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeArchivedTask, makeHistorySummary, makeState } from "@/test/wails-mock";

const at = (day: number, hour: number) => new Date(2026, 8, day, hour, 2).toISOString();
const A = makeArchivedTask({ id: "a", name: "alpha", archivedAt: at(24, 15) });
const B = makeArchivedTask({ id: "b", name: "bravo", archivedAt: at(24, 11) });
const C = makeArchivedTask({ id: "c", name: "charlie", archivedAt: at(21, 9) });

function view() {
  return renderWithStore(<HistoryView />, {
    state: makeState({
      history: [A, B, C],
      historySummary: makeHistorySummary({ tasks: 3, oldest: at(21, 9) }),
    }),
    ui: { location: { kind: "history" } },
  });
}

function named(level: number, name: RegExp): HTMLElement {
  const found = levelOf(level).find((item) => name.test(item.getAttribute("aria-label") ?? ""));
  if (found === undefined) {
    throw new Error(`no treeitem of level ${level} named ${name}`);
  }
  return found;
}

const header = (name: RegExp) => named(1, name);
const row = (name: RegExp) => named(2, name);

/** levelOf are the treeitems of a level: the days are 1, the rows 2. */
function levelOf(level: number): HTMLElement[] {
  return screen
    .getAllByRole("treeitem")
    .filter((item) => item.getAttribute("aria-level") === String(level));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 24, 15, 10));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("HistoryView keys", () => {
  it("is one tab stop, on the first header", () => {
    view();

    const stops = screen.getAllByRole("treeitem").filter((item) => item.tabIndex === 0);
    expect(stops).toEqual([header(/^Archived today/)]);
  });

  it("goes from the search to the first header with the down arrow, then walks headers and rows", async () => {
    const { user } = view();

    await user.keyboard("{ArrowDown}");
    expect(header(/^Archived today/)).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(row(/^Task alpha/)).toHaveFocus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(header(/^Archived on Monday/)).toHaveFocus();
    await user.keyboard("{End}");
    expect(row(/^Task charlie/)).toHaveFocus();
    await user.keyboard("{Home}");
    expect(header(/^Archived today/)).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(header(/^Archived today/)).toHaveFocus();
  });

  it("goes from a row to its header with the left arrow, and from a header to its first row with the right", async () => {
    const { user } = view();
    row(/^Task bravo/).focus();

    await user.keyboard("{ArrowLeft}");
    expect(header(/^Archived today/)).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(row(/^Task alpha/)).toHaveFocus();
  });

  it("does nothing with the left arrow or Enter on a header", async () => {
    const { user } = view();
    header(/^Archived today/).focus();

    await user.keyboard("{ArrowLeft}{Enter}");

    expect(header(/^Archived today/)).toHaveFocus();
    expect(useAppStore.getState().location).toEqual({ kind: "history" });
  });

  it("opens the task of a row with Enter", async () => {
    const { user } = view();
    row(/^Task charlie/).focus();

    await user.keyboard("{Enter}");

    expect(useAppStore.getState().location).toEqual({ kind: "archived-task", id: "c" });
  });

  it("brings the focus back to the search with the slash, and types it nowhere else", async () => {
    const { user } = view();
    row(/^Task alpha/).focus();

    await user.keyboard("/");
    expect(screen.getByRole("searchbox", { name: "Search History" })).toHaveFocus();
    await user.keyboard("a/b");
    expect(screen.getByRole("searchbox", { name: "Search History" })).toHaveValue("a/b");
  });
});
