import { describe, expect, it } from "vitest";
import type { HistoryEntry } from "@/features/history/history-list";
import { historyRow } from "@/features/history/history-rows";
import {
  makeArchivedDiscussion,
  makeArchivedReview,
  makeArchivedTask,
  makeBoard,
  makeCloseResult,
  makeRepository,
  makeReviewPass,
  makeState,
  makeTaskCard,
} from "@/test/wails-mock";

// 2026-09-24 15:10, local time.
const NOW = new Date(2026, 8, 24, 15, 10).getTime();
const TODAY = new Date(2026, 8, 24, 15, 2).toISOString();
const STATE = makeState({
  repositories: [makeRepository({ boardId: "board-1" })],
  boards: [makeBoard()],
});

const task = (overrides = {}): HistoryEntry => {
  const value = makeArchivedTask({ archivedAt: TODAY, ...overrides });
  return { kind: "task", id: value.id, archivedAt: value.archivedAt, task: value };
};
const review = (overrides = {}): HistoryEntry => {
  const value = makeArchivedReview({ archivedAt: TODAY, ...overrides });
  return { kind: "review", id: value.id, archivedAt: value.archivedAt, review: value };
};
const discussion = (overrides = {}): HistoryEntry => {
  const value = makeArchivedDiscussion({ archivedAt: TODAY, ...overrides });
  return { kind: "discussion", id: value.id, archivedAt: value.archivedAt, discussion: value };
};

describe("historyRow of a task", () => {
  it("says the card, the pull request and the steps, and the accessible name says it all", () => {
    const row = historyRow(
      task({ name: "Idempotency keys", card: { ...makeTaskCard(), number: 398 } }),
      STATE,
      NOW,
      false,
    );

    expect(row).toMatchObject({
      glyph: "task",
      where: "web#398",
      whereTooltip: "dev/web#398",
      result: "PR #12 · 1 step",
      resultStrong: "",
      time: "15:02",
      label: "Task Idempotency keys, web#398, PR #12 · 1 step, archived today at 15:02",
    });
  });

  it("names only the repository without a card", () => {
    expect(historyRow(task(), STATE, NOW, false).where).toBe("web");
  });

  it("says One-Shot instead of the steps, and nothing of the pull request without one", () => {
    const one = historyRow(task({ mode: "one_shot" }), STATE, NOW, false);
    const bare = historyRow(task({ pr: null, steps: [] }), STATE, NOW, false);

    expect(one).toMatchObject({ glyph: "oneShot", result: "PR #12 · One-Shot" });
    expect(one.label.startsWith("One-Shot task ")).toBe(true);
    expect(bare.result).toBe("0 steps");
  });

  it("flags the base the closing left behind, by name", () => {
    const close = makeCloseResult({
      base: { outcome: "skipped", reason: "not_checked_out", detail: "" },
      baseBranch: "dev",
    });

    const row = historyRow(task({ close }), STATE, NOW, true);

    expect(row.resultStrong).toBe(" · dev not updated");
    expect(row.label).toBe(
      "Task add-login, web, PR #12 · 1 step · dev not updated, archived today at 15:02, just archived",
    );
  });

  it("writes owner/name when the owner is not the one of the board of the item", () => {
    const foreign = historyRow(
      task({ repository: "other/web" }),
      makeState({
        repositories: [makeRepository({ boardId: "board-1" })],
        boards: [makeBoard({ owner: "acme" })],
      }),
      NOW,
      false,
    );

    expect(foreign.where).toBe("other/web");
  });
});

describe("historyRow of a review", () => {
  it("counts the passes that wrote a report", () => {
    const merged = historyRow(
      review({ passes: [makeReviewPass(), makeReviewPass()] }),
      STATE,
      NOW,
      false,
    );
    const none = historyRow(review({ passes: [] }), STATE, NOW, false);

    expect(merged).toMatchObject({ glyph: "review", where: "web#31", result: "Merged · 2 passes" });
    expect(none.result).toBe("Merged · no passes");
  });

  it("puts Closed first and strong", () => {
    const row = historyRow(review({ outcome: "closed" }), STATE, NOW, false);

    expect(row).toMatchObject({ resultStrong: "Closed", result: " · 1 pass", strongFirst: true });
    expect(row.label).toContain(", Closed · 1 pass, ");
  });
});

describe("historyRow of a discussion", () => {
  it("says the board and the cards published", () => {
    expect(historyRow(discussion({ publishedCount: 4 }), STATE, NOW, false)).toMatchObject({
      glyph: "discussion",
      where: "Roadmap",
      result: "4 cards published",
    });
    expect(historyRow(discussion({ publishedCount: 1 }), STATE, NOW, false).result).toBe(
      "1 card published",
    );
    expect(
      historyRow(discussion({ publishedCount: 0, board: "" }), STATE, NOW, false),
    ).toMatchObject({ where: "No board", result: "Nothing published" });
  });

  it("names the day of an older item in its label", () => {
    const old = new Date(2026, 8, 21, 11, 5).toISOString();

    expect(historyRow(discussion({ archivedAt: old }), STATE, NOW, false).label).toContain(
      "archived on Monday, Sep 21 at 11:05",
    );
  });
});
